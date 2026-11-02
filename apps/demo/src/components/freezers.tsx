/**
 * Freezers do cliente (patrimônio) e questionário da primeira visita.
 * Cada freezer é um registro próprio (nunca só "quantidade").
 */
import { useState } from "react";
import { Snowflake, Plus, Pencil, Undo2, QrCode, MapPinned, ClipboardCheck, AlertTriangle, Lock } from "lucide-react";
import {
  CUSTOMERS, ASSETS, PARAMS, FREEZER_CATALOG, freezerLabel, freezerValue, sellerById, nowStamp, type Asset, type Customer, type FreezerFormat,
} from "../data/mock";
import { notify, MANAGERS_KEYS } from "../data/notify";
import { commit } from "../data/store";
import { Badge, Card, Chip, Sheet, brl } from "./ui";
import { PatrimonyHistory } from "./freezer-occurrences";

export type AssetMove = { at: string; by: string; action: "incluido" | "editado" | "retirado" | "confirmado"; patrimony: string; detail: string };

const RETURN_REASONS = ["Devolução (cliente encerrou)", "Troca por outro freezer", "Manutenção", "Cliente sem giro", "Outro"];

/** Rascunho editável de um freezer. */
type Draft = { id: string; patrimony: string; brand: string; format: FreezerFormat; liters: number; voltage: string; model: string; isNew: boolean };

const normVoltage = (v: string) => (v.startsWith("1") ? "110/127V" : "220V");
const toDraft = (a: Asset): Draft => ({
  id: a.id, patrimony: a.patrimony, brand: a.brand ?? "Gelopar",
  format: a.format ?? (/vertical/i.test(a.type) ? "vertical" : "horizontal"),
  liters: a.liters, voltage: normVoltage(a.voltage), model: a.model, isNew: false,
});
const fromDraft = (d: Draft, customerId: string): Asset => ({
  id: d.id, patrimony: d.patrimony, type: freezerLabel(d.format, d.liters), model: d.model, brand: d.brand, format: d.format,
  voltage: d.voltage, liters: d.liters, valueCents: freezerValue(d.format), status: "installed", customerId,
});
const describe = (d: Draft) => `${d.brand} · ${d.format === "vertical" ? "Vertical" : "Horizontal"} · ${d.liters} L · ${d.voltage}`;
/**
 * Próximo número de patrimônio livre (gerado pelo sistema, bloqueado para edição).
 * Considera freezers em todos os clientes, estoque, já retirados (não reaproveita) e
 * os que estão sendo incluídos agora neste formulário.
 */
export function nextPatrimony(pending: string[] = []): string {
  const used = [
    ...CUSTOMERS.flatMap((c) => c.assets.map((a) => a.patrimony)),
    ...CUSTOMERS.flatMap((c) => (c.assetLog ?? []).map((m) => m.patrimony)),
    ...ASSETS.map((a) => a.patrimony),
    ...pending,
  ].map((p) => Number(p) || 0);
  return String(Math.max(0, ...used) + 1).padStart(6, "0");
}
const newDraft = (pending: string[]): Draft => ({ id: `a-new-${Date.now()}`, patrimony: nextPatrimony(pending), brand: FREEZER_CATALOG.brands[0], format: "horizontal", liters: 411, voltage: "220V", model: "", isNew: true });

/** Onde está instalado um patrimônio (para não cadastrar o mesmo freezer em dois clientes). */
function ownerOf(patrimony: string, exceptCustomer: string) {
  return CUSTOMERS.find((c) => c.id !== exceptCustomer && c.assets.some((a) => a.patrimony === patrimony));
}

/**
 * Editor da lista de freezers. Controlado: recebe rascunhos e devolve alterações.
 */
function FreezerList({ c, drafts, setDrafts, removed, setRemoved }: {
  c: Customer; drafts: Draft[]; setDrafts: (d: Draft[]) => void;
  removed: { draft: Draft; reason: string }[]; setRemoved: (r: { draft: Draft; reason: string }[]) => void;
}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Draft | null>(null);
  const [reason, setReason] = useState(RETURN_REASONS[0]!);
  const conflict = editing ? ownerOf(editing.patrimony, c.id) : undefined;
  const dup = editing ? drafts.some((d) => d.id !== editing.id && d.patrimony === editing.patrimony) : false;
  const validPat = editing ? /^\d{6}$/.test(editing.patrimony) : false;

  return (
    <div className="stack">
      {drafts.map((d) => {
        return (
          <div key={d.id} className="freezer-row">
            <span className="freezer-ic"><QrCode size={22} /></span>
            <div className="grow">
              <div className="title">Patrimônio {d.patrimony} {d.isNew && <Badge tone="success">novo</Badge>}</div>
              <div className="sub"><span className={`fmt-tag ${d.format}`}>{d.format === "vertical" ? "Vertical" : "Horizontal"}</span> {d.brand} · {d.liters} L · {d.voltage}{d.model ? ` · ${d.model}` : ""}</div>
            </div>
            <button className="icon-btn" aria-label="Editar freezer" onClick={() => setEditing({ ...d })}><Pencil size={15} /></button>
            <button className="icon-btn" aria-label="Retirar freezer" onClick={() => { setRemoving(d); setReason(RETURN_REASONS[0]!); }}><Undo2 size={15} /></button>
          </div>
        );
      })}
      {!drafts.length && <div className="small muted">Nenhum freezer Galato neste cliente.</div>}
      {removed.length > 0 && (
        <div className="small" style={{ padding: 10, borderRadius: 12, background: "var(--warning-soft)" }}>
          A retirar: {removed.map((r) => `${r.draft.patrimony} (${r.reason})`).join(", ")}
          <button className="linkbtn" style={{ marginLeft: 8 }} onClick={() => { setDrafts([...drafts, ...removed.filter((r) => !r.draft.isNew).map((r) => r.draft)]); setRemoved([]); }}>desfazer</button>
        </div>
      )}
      <button className="btn btn-ghost btn-block" onClick={() => setEditing(newDraft(drafts.map((d) => d.patrimony)))}>
        <Plus size={16} /> Incluir freezer
      </button>

      {editing && (
        <Sheet title={editing.isNew && !drafts.some((d) => d.id === editing.id) ? "Incluir freezer" : `Editar patrimônio ${editing.patrimony}`} onClose={() => setEditing(null)} icon={<Snowflake size={18} />}>
          <div className="field"><label>Número do patrimônio</label>
            <div className="patrimony-lock" id="freezer-patrimony">
              <Lock size={16} /><b className="num">{editing.patrimony}</b>
              <span className="xs">{editing.isNew ? "gerado pelo sistema" : "bloqueado"}</span>
            </div>
            <span className="xs muted">{editing.isNew ? "Número entregue automaticamente: identifique o freezer com ele (plaqueta/QR Code)." : "O número do patrimônio não pode ser alterado."}</span>
          </div>
          <div className="field"><label>Marca</label>
            <div className="chips">{FREEZER_CATALOG.brands.map((b) => <Chip key={b} on={editing.brand === b} onClick={() => setEditing({ ...editing, brand: b })}>{b}</Chip>)}</div>
          </div>
          <div className="field"><label>Formato</label>
            <div className="chips">{FREEZER_CATALOG.formats.map((f) => (
              <Chip key={f.id} on={editing.format === f.id} onClick={() => setEditing({ ...editing, format: f.id, liters: (f.liters as readonly number[]).includes(editing.liters) ? editing.liters : 411 })}>{f.label}</Chip>
            ))}</div>
          </div>
          <div className="field"><label>Litragem</label>
            {(() => {
              const opts = FREEZER_CATALOG.formats.find((f) => f.id === editing.format)!.liters as readonly number[];
              const custom = !opts.includes(editing.liters);
              return (
                <>
                  <div className="chips">
                    {opts.map((l) => <Chip key={l} on={editing.liters === l} onClick={() => setEditing({ ...editing, liters: l })}>{l} L</Chip>)}
                    <Chip on={custom} onClick={() => setEditing({ ...editing, liters: custom ? editing.liters : 0 })}>Outra</Chip>
                  </div>
                  {custom && <input id="freezer-liters" className="input mt" inputMode="numeric" placeholder="Litros (ex.: 450)" value={editing.liters || ""}
                    onChange={(e) => setEditing({ ...editing, liters: Number(e.target.value.replace(/\D/g, "").slice(0, 4)) || 0 })} />}
                </>
              );
            })()}
          </div>
          <div className="field"><label>Voltagem</label>
            <div className="chips">{FREEZER_CATALOG.voltages.map((v) => <Chip key={v} on={editing.voltage === v} onClick={() => setEditing({ ...editing, voltage: v })}>{v}</Chip>)}</div>
          </div>
          <div className="field"><label>Modelo (opcional)</label>
            <input id="freezer-model" className="input" placeholder="Ex.: modelo da etiqueta" value={editing.model} onChange={(e) => setEditing({ ...editing, model: e.target.value.slice(0, 20) })} />
          </div>
          {conflict && <div className="small red semi mb"><AlertTriangle size={14} /> Este patrimônio consta no cliente {conflict.tradeName}. Confira a plaqueta.</div>}
          {dup && <div className="small red semi mb">Este patrimônio já está na lista.</div>}
          <button className="btn btn-primary btn-block" disabled={!validPat || !!conflict || dup || editing.liters < 50} onClick={() => {
            const exists = drafts.some((d) => d.id === editing.id);
            setDrafts(exists ? drafts.map((d) => (d.id === editing.id ? editing : d)) : [...drafts, editing]);
            setEditing(null);
          }}>Salvar freezer</button>
        </Sheet>
      )}

      {removing && (
        <Sheet title={`Retirar patrimônio ${removing.patrimony}`} onClose={() => setRemoving(null)} icon={<Undo2 size={18} />}>
          <div className="field"><label>Motivo</label>
            <div className="stack" style={{ gap: 6 }}>{RETURN_REASONS.map((r) => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}</div>
          </div>
          <p className="xs muted mb">O freezer sai deste cliente e volta para o estoque da Galato. Fica registrado no histórico.</p>
          <button className="btn btn-danger btn-block" onClick={() => {
            setDrafts(drafts.filter((d) => d.id !== removing.id));
            setRemoved([...removed, { draft: removing, reason }]);
            setRemoving(null);
          }}>Confirmar retirada</button>
        </Sheet>
      )}
    </div>
  );
}

/** Aplica as alterações de freezers no cliente e registra o histórico. Devolve um resumo. */
function applyFreezers(c: Customer, drafts: Draft[], removed: { draft: Draft; reason: string }[], by: string, confirmAll: boolean) {
  const before = new Map(c.assets.map((a) => [a.id, a]));
  const moves: AssetMove[] = (c.assetLog ??= []);
  const at = nowStamp();
  const next = drafts.map((d) => fromDraft(d, c.id));
  let added = 0, edited = 0;
  for (const a of next) {
    const old = before.get(a.id);
    if (!old) { added++; moves.push({ at, by, action: "incluido", patrimony: a.patrimony, detail: `${a.brand} · ${a.type} · ${a.voltage}` }); }
    else if (old.patrimony !== a.patrimony || old.type !== a.type || normVoltage(old.voltage) !== a.voltage || (old.brand ?? "Gelopar") !== a.brand || old.model !== a.model) {
      edited++; moves.push({ at, by, action: "editado", patrimony: a.patrimony, detail: `antes: ${old.patrimony} · ${old.type} · ${old.voltage}` });
    } else if (confirmAll) moves.push({ at, by, action: "confirmado", patrimony: a.patrimony, detail: "conferido na 1ª visita" });
  }
  for (const r of removed) if (before.has(r.draft.id)) moves.push({ at, by, action: "retirado", patrimony: r.draft.patrimony, detail: r.reason });
  c.assets = next;
  return { added, edited, removed: removed.filter((r) => before.has(r.draft.id)).length };
}

/** Gerenciar freezers a qualquer momento (ficha do cliente). */
export function FreezerManager({ c, onClose }: { c: Customer; onClose: () => void }) {
  const [drafts, setDrafts] = useState<Draft[]>(() => c.assets.map(toDraft));
  const [removed, setRemoved] = useState<{ draft: Draft; reason: string }[]>([]);
  const by = sellerById.get(c.sellerId)?.name ?? "Vendedor";
  return (
    <Sheet title={`Freezers · ${c.tradeName}`} onClose={onClose} icon={<Snowflake size={18} />}>
      <FreezerList c={c} drafts={drafts} setDrafts={setDrafts} removed={removed} setRemoved={setRemoved} />
      <button className="btn btn-primary btn-block mt" onClick={() => {
        commit(() => {
          const r = applyFreezers(c, drafts, removed, by, false);
          if (r.added || r.edited || r.removed)
            notify({ link: { t: "customer", id: c.id }, kind: "comercial", title: "Freezers atualizados", text: `${c.tradeName}: ${r.added} incluído(s), ${r.edited} editado(s), ${r.removed} retirado(s) · ${by}.`, to: [...MANAGERS_KEYS] });
        }, "Freezers salvos · histórico registrado");
        onClose();
      }}>Salvar alterações</button>
      <AssetHistory c={c} />
      {c.assets.map((a) => <PatrimonyHistory key={a.id} patrimony={a.patrimony} />)}
    </Sheet>
  );
}

export function AssetHistory({ c }: { c: Customer }) {
  const log = [...(c.assetLog ?? [])].reverse();
  if (!log.length) return null;
  const label = { incluido: "Incluído", editado: "Editado", retirado: "Retirado", confirmado: "Conferido" } as const;
  const tone = { incluido: "success", editado: "info", retirado: "warning", confirmado: "neutral" } as const;
  return (
    <Card title="Movimentações de freezers" className="mt">
      {log.slice(0, 12).map((m, i) => (
        <div key={i} className="row">
          <Badge tone={tone[m.action]}>{label[m.action]}</Badge>
          <div className="grow"><div className="title small">Patrimônio {m.patrimony}</div><div className="sub">{m.detail}</div></div>
          <span className="xs muted">{new Date(m.at).toLocaleString("pt-BR", { timeZone: PARAMS.timezone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {m.by.split(" ")[0]}</span>
        </div>
      ))}
    </Card>
  );
}

/**
 * Primeira visita: antes do check-in, confirmar rota e freezers.
 * `onDone` recebe o cliente já atualizado para seguir com o check-in.
 */
export function FirstVisitSheet({ c, onClose, onDone }: { c: Customer; onClose: () => void; onDone: () => void }) {
  const [route, setRoute] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>(() => c.assets.map(toDraft));
  const [removed, setRemoved] = useState<{ draft: Draft; reason: string }[]>([]);
  const [noFreezer, setNoFreezer] = useState(false);
  const [freezersOk, setFreezersOk] = useState(false);
  const by = sellerById.get(c.sellerId)?.name ?? "Vendedor";
  const ready = !!route && (freezersOk || (noFreezer && drafts.length === 0));
  return (
    <Sheet title="Primeira visita ao cliente" onClose={onClose} icon={<ClipboardCheck size={18} />}>
      <div className="card mb" style={{ background: "var(--gold-soft)" }}>
        <div className="semi">Responda algumas informações antes de continuar com o atendimento.</div>
        <div className="small t2">{c.tradeName} · {c.code}. Só é pedido na primeira visita.</div>
      </div>

      <div className="section-title" style={{ marginTop: 6 }}><span className="flex" style={{ gap: 8 }}><MapPinned size={17} className="red" /> 1. De qual rota é o cliente?</span></div>
      <div className="grid g3" style={{ marginBottom: 6 }}>
        {PARAMS.commercialRoutes.map((r) => (
          <button key={r.code} className={`route-pick ${route === r.code ? "on" : ""}`} onClick={() => setRoute(r.code)}>
            <b>{r.name}</b><span className="xs">{["dom", "segunda", "terça", "quarta", "quinta", "sexta", "sáb"][r.weekday]}</span>
          </button>
        ))}
      </div>
      {c.routeCode && <p className="xs muted">No cadastro atual: {PARAMS.commercialRoutes.find((x) => x.code === c.routeCode)?.name}.</p>}

      <div className="section-title"><span className="flex" style={{ gap: 8 }}><Snowflake size={17} className="red" /> 2. Freezers no cliente (patrimônio)</span></div>
      <p className="small t2 mb">Confira as plaquetas. Inclua o que faltar, corrija ou retire o que não está mais no cliente.</p>
      <FreezerList c={c} drafts={drafts} setDrafts={(d) => { setDrafts(d); setFreezersOk(false); if (d.length) setNoFreezer(false); }} removed={removed} setRemoved={setRemoved} />
      <div className="chips mt">
        <Chip on={freezersOk && !noFreezer} onClick={() => { setFreezersOk(true); setNoFreezer(false); }}>{drafts.length ? `Conferi os ${drafts.length} freezer(s)` : "Lista conferida"}</Chip>
        {drafts.length === 0 && <Chip on={noFreezer} onClick={() => { setNoFreezer(true); setFreezersOk(true); }}>Cliente não tem freezer Galato</Chip>}
      </div>

      <button className="btn btn-primary btn-lg mt" disabled={!ready} onClick={() => {
        commit(() => {
          const oldRoute = c.routeCode;
          c.routeCode = route!;
          const r = applyFreezers(c, drafts, removed, by, true);
          c.onboardedAt = nowStamp(); c.onboardedBy = by;
          notify({ link: { t: "customer", id: c.id },
            kind: "comercial", title: "Cliente cadastrado na 1ª visita",
            text: `${c.tradeName}: ${PARAMS.commercialRoutes.find((x) => x.code === route)?.name}${oldRoute !== route ? ` (antes ${PARAMS.commercialRoutes.find((x) => x.code === oldRoute)?.name})` : ""} · ${c.assets.length} freezer(s)${r.added ? ` · ${r.added} incluído(s)` : ""}${r.removed ? ` · ${r.removed} retirado(s)` : ""} · ${by}.`,
            to: [...MANAGERS_KEYS],
          });
        }, "Cadastro da 1ª visita salvo");
        onDone();
      }}>{ready ? "Salvar e fazer check-in" : !route ? "Escolha a rota" : "Confirme os freezers"}</button>
    </Sheet>
  );
}
