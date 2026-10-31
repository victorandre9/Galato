/**
 * Persistência compartilhada da demo.
 *
 * Base: dados fictícios gerados em mock.ts (determinísticos).
 * Sobreposição: cada entidade alterada no teste é gravada inteira no banco
 * compartilhado do artifact (coleção "overlay"). Todos os aparelhos que abrem
 * o link aplicam as sobreposições em tempo real.
 * Restaurar = apagar as sobreposições (volta tudo para a base).
 *
 * Fora do Claude (dev local) o banco não existe: funciona só em memória.
 */
import {
  CUSTOMERS, ORDERS, PAYMENT_REQUESTS, DELIVERY_ROUTES, INCIDENTS, NONCONFORMITIES, EPI_REQUESTS, SELLERS,
  NOTIFICATIONS, TRANSFER_REQUESTS, TEMP_ACCESS, PROOFS,
} from "./mock";

type Entity = { id: string };
const REG: Record<string, Entity[]> = {
  customer: CUSTOMERS, order: ORDERS, payreq: PAYMENT_REQUESTS, route: DELIVERY_ROUTES, incident: INCIDENTS,
  nc: NONCONFORMITIES, epi: EPI_REQUESTS, seller: SELLERS, notif: NOTIFICATIONS, transfer: TRANSFER_REQUESTS,
  tempaccess: TEMP_ACCESS, proof: PROOFS,
};
const COLLECTION = "overlay";
const keyOf = (type: string, id: string) => `${type}~${id}`.replace(/[^A-Za-z0-9_\-.~:@+]/g, "_");

/** JSON atual de cada entidade (para detectar o que mudou). */
const known = new Map<string, string>();
/** JSON original da base (para restaurar). */
const pristine = new Map<string, string>();
const keyMeta = new Map<string, { type: string; id: string }>();

function snapshotAll(into: Map<string, string>) {
  for (const [type, list] of Object.entries(REG))
    for (const e of list) {
      const k = keyOf(type, e.id);
      keyMeta.set(k, { type, id: e.id });
      into.set(k, JSON.stringify(e));
    }
}
snapshotAll(pristine);
snapshotAll(known);

export type DbMode = "connecting" | "shared" | "local";
type Listener = () => void;
let mode: DbMode = "connecting";
let db: any = null;
let onRemote: Listener = () => {};
let onMode: (m: DbMode) => void = () => {};
const offlineDirty = new Set<string>();
let writeChain: Promise<unknown> = Promise.resolve();
let online = true;

export function getDbMode() { return mode; }

function replaceInPlace(target: Record<string, unknown>, data: Record<string, unknown>) {
  for (const k of Object.keys(target)) if (!(k in data)) delete target[k];
  Object.assign(target, structuredClone(data));
}

function applyDoc(type: string, id: string, json: string | null) {
  const list = REG[type];
  if (!list) return false;
  const k = keyOf(type, id);
  const body = json ?? pristine.get(k) ?? null;
  const idx = list.findIndex((e) => e.id === id);
  if (body === null) {
    // entidade criada no teste e removida (restaurar): some da lista
    if (idx >= 0) list.splice(idx, 1);
    known.delete(k);
    return true;
  }
  if (known.get(k) === body) return false; // eco da própria gravação
  const data = JSON.parse(body);
  if (idx >= 0) replaceInPlace(list[idx] as unknown as Record<string, unknown>, data);
  else if (type === "route") list.push(data);
  else list.unshift(data);
  keyMeta.set(k, { type, id });
  known.set(k, body);
  return true;
}

function writeKey(k: string) {
  if (!db) return;
  const meta = keyMeta.get(k);
  if (!meta) return;
  const json = known.get(k);
  const ref = db.collection(COLLECTION).doc(k);
  writeChain = writeChain
    .then(() => (json === undefined ? ref.delete() : ref.set({ type: meta.type, id: meta.id, json, at: new Date().toISOString() })))
    .catch((e: unknown) => console.warn("Falha ao gravar", k, e));
}

/** Chamado depois de cada ação: detecta entidades alteradas e grava. */
export function persistChanges() {
  const changed: string[] = [];
  for (const [type, list] of Object.entries(REG))
    for (const e of list) {
      const k = keyOf(type, e.id);
      const json = JSON.stringify(e);
      if (known.get(k) !== json) {
        known.set(k, json);
        keyMeta.set(k, { type, id: e.id });
        changed.push(k);
      }
    }
  if (!online) { changed.forEach((k) => offlineDirty.add(k)); return changed.length; }
  changed.forEach(writeKey);
  return changed.length;
}

export function setSyncOnline(v: boolean) {
  online = v;
  if (v) { offlineDirty.forEach(writeKey); offlineDirty.clear(); }
}

/** Apaga todas as alterações do teste e volta à base fictícia. */
export async function resetDemo() {
  if (db) {
    const snap = await db.collection(COLLECTION).get();
    for (const d of snap.docs) await db.collection(COLLECTION).doc(d.id).delete();
  }
  // restaura localmente também (para modo local e resposta imediata)
  for (const k of [...known.keys()]) {
    const meta = keyMeta.get(k)!;
    applyDoc(meta.type, meta.id, null);
  }
  offlineDirty.clear();
  onRemote();
}

export function startSync(opts: { onRemoteChange: Listener; onModeChange: (m: DbMode) => void }) {
  onRemote = opts.onRemoteChange;
  onMode = (m) => { mode = m; opts.onModeChange(m); };
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!claude?.use) { onMode("local"); return; }
  const timer = setTimeout(() => { if (mode === "connecting") onMode("local"); }, 10_000);
  claude.use("db").then((ns) => {
    if (!ns) { clearTimeout(timer); onMode("local"); return; }
    db = ns;
    db.collection(COLLECTION).onSnapshot(
      (snap: any) => {
        let touched = false;
        for (const ch of snap.docChanges()) {
          const data = ch.doc.data() as { type: string; id: string; json: string } | undefined;
          if (!data) continue;
          touched = applyDoc(data.type, data.id, ch.type === "removed" ? null : data.json) || touched;
        }
        if (!snap.metadata.fromCache) { clearTimeout(timer); if (mode !== "shared") onMode("shared"); }
        if (touched) onRemote();
      },
      (e: { code: string }) => { clearTimeout(timer); console.warn("db", e.code); onMode("local"); },
    );
  }).catch(() => { clearTimeout(timer); onMode("local"); });
}
