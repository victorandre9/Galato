/**
 * API da demonstração (Vercel Function + Neon).
 *
 *   GET    /api/data?r=overlay&since=N   → alterações com seq > N
 *   POST   /api/data?r=overlay           → { docs: [{ k, type, id, json|null }] }
 *   POST   /api/data?r=reset             → volta tudo aos dados fictícios (para todos)
 *   GET    /api/data?r=video&key=K       → arquivo do vídeo
 *   POST   /api/data?r=video             → { key, mime, data (base64) }
 *   DELETE /api/data?r=video&key=K
 *
 * Sem DATABASE_URL responde 503 e o app funciona só no aparelho (modo local).
 * Vídeos: até 1,5 MB cada; apagados do banco 60 dias depois de enviados.
 */
import { neon } from "@neondatabase/serverless";
import type { IncomingMessage, ServerResponse } from "node:http";

type Sql = (text: string, params?: unknown[]) => Promise<any[]>;
type Req = IncomingMessage & { body?: unknown };

const MAX_VIDEO_B64 = Math.ceil((1.5 * 1024 * 1024 * 4) / 3);
const RETENTION_DAYS = 60;

let sqlFn: Sql | null = null;
function getSql(): Sql | null {
  const injected = (globalThis as { __galatoSql?: Sql }).__galatoSql;
  if (injected) return injected;
  if (sqlFn) return sqlFn;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!url) return null;
  const q = neon(url);
  sqlFn = (text, params = []) => q.query(text, params) as Promise<any[]>;
  return sqlFn;
}

let schema: Promise<void> | null = null;
function ensureSchema(sql: Sql) {
  schema ??= (async () => {
    await sql("create sequence if not exists galato_overlay_seq");
    await sql("create table if not exists galato_overlay (k text primary key, type text not null, id text not null, json text, seq bigint not null)");
    await sql("create index if not exists galato_overlay_seq_idx on galato_overlay (seq)");
    await sql("create table if not exists galato_video (key text primary key, mime text not null, data text not null, created_at timestamptz not null default now())");
  })().catch((e) => { schema = null; throw e; });
  return schema;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req: Req): Promise<any> {
  if (req.body !== undefined && req.body !== null && typeof req.body !== "string" && !Buffer.isBuffer(req.body)) return req.body;
  let raw: string;
  if (typeof req.body === "string") raw = req.body;
  else if (Buffer.isBuffer(req.body)) raw = req.body.toString("utf8");
  else {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    raw = Buffer.concat(chunks).toString("utf8");
  }
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req: Req, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://x");
  const r = url.searchParams.get("r");
  const sql = getSql();
  if (!sql) return send(res, 503, { error: "no-db" });
  try {
    await ensureSchema(sql);

    if (r === "overlay" && req.method === "GET") {
      const since = Number(url.searchParams.get("since") ?? 0) || 0;
      const docs = await sql("select k, type, id, json, seq::text as seq from galato_overlay where seq > $1 order by seq limit 5000", [since]);
      const last = docs.length ? Number(docs[docs.length - 1].seq) : since;
      return send(res, 200, { ok: true, seq: last, docs: docs.map((d) => ({ k: d.k, type: d.type, id: d.id, json: d.json })) });
    }

    if (r === "overlay" && req.method === "POST") {
      const body = await readBody(req);
      const docs: { k: string; type: string; id: string; json: string | null }[] = Array.isArray(body?.docs) ? body.docs : [];
      if (!docs.length) return send(res, 200, { ok: true });
      await sql(
        `insert into galato_overlay (k, type, id, json, seq)
         select k, t, i, j, nextval('galato_overlay_seq') from unnest($1::text[], $2::text[], $3::text[], $4::text[]) as x(k, t, i, j)
         on conflict (k) do update set type = excluded.type, id = excluded.id, json = excluded.json, seq = excluded.seq`,
        [docs.map((d) => String(d.k)), docs.map((d) => String(d.type)), docs.map((d) => String(d.id)), docs.map((d) => (d.json == null ? null : String(d.json)))],
      );
      return send(res, 200, { ok: true });
    }

    if (r === "reset" && req.method === "POST") {
      await sql("update galato_overlay set json = null, seq = nextval('galato_overlay_seq') where json is not null");
      await sql("delete from galato_video");
      return send(res, 200, { ok: true });
    }

    if (r === "video") {
      const key = url.searchParams.get("key") ?? "";
      if (req.method === "GET") {
        const rows = await sql("select mime, data from galato_video where key = $1", [key]);
        if (!rows.length) return send(res, 404, { error: "not-found" });
        const buf = Buffer.from(rows[0].data, "base64");
        res.statusCode = 200;
        res.setHeader("content-type", rows[0].mime || "video/mp4");
        res.setHeader("content-length", String(buf.length));
        res.setHeader("cache-control", "private, max-age=3600");
        return res.end(buf);
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const k = String(body?.key ?? ""), data = String(body?.data ?? ""), mime = String(body?.mime ?? "video/mp4");
        if (!k || !data) return send(res, 400, { error: "missing" });
        if (data.length > MAX_VIDEO_B64) return send(res, 413, { error: "too-large" });
        await sql("insert into galato_video (key, mime, data) values ($1, $2, $3) on conflict (key) do update set mime = excluded.mime, data = excluded.data", [k, mime, data]);
        await sql(`delete from galato_video where created_at < now() - interval '${RETENTION_DAYS} days'`);
        return send(res, 200, { ok: true });
      }
      if (req.method === "DELETE") {
        await sql("delete from galato_video where key = $1", [key]);
        return send(res, 200, { ok: true });
      }
    }
    return send(res, 404, { error: "unknown" });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "db", message: (e as Error).message });
  }
}
