/**
 * Ocorrência do cliente (geral): aberta pelo vendedor (na visita ou fora dela) ou pela gestão,
 * direto na ficha do cliente. A gestão trata e o vendedor acompanha o histórico.
 */
import { useState } from "react";
import { MessageSquareWarning, CheckCircle2 } from "lucide-react";
import { customerById, sellerById, nowStamp, type Customer } from "../data/mock";
import { COM_OCCURRENCES, type ComOccurrence, type ComOccStatus, type ComOccType } from "../data/comocc";
import { notify } from "../data/notify";
import { commit, useStore } from "../data/store";
import { matchRecord } from "../data/search";
import { Badge, Card, Chip, Sheet, SearchBox, Faltando } from "./ui";
import { PhotoCapture } from "./photo";

export const COM_TYPES: Record<ComOccType, { label: string; hint: string }> = {
  parar: { label: "Cliente diz que vai parar de comprar", hint: "conte o motivo que ele deu" },
  qualidade: { label: "Reclamação de produto / qualidade", hint: "qual produto, lote, o que aconteceu" },
  entrega: { label: "Reclamação de entrega", hint: "atraso, avaria, falta de item" },
  preco: { label: "Preço / concorrência", hint: "qual concorrente e qual preço ele citou" },
  financeiro: { label: "Cobrança / financeiro", hint: "boleto, limite, cobrança indevida" },
  atendimento: { label: "Reclamação de atendimento", hint: "o que aconteceu e com quem" },
  outros: { label: "Outro assunto", hint: "descreva" },
};
export const COM_STATUS: Record<ComOccStatus, { label: string; tone: "danger" | "warning" | "success"; open: boolean }> = {
  aberta: { label: "Aberta", tone: "danger", open: true },
  em_tratativa: { label: "Em tratativa", tone: "warning", open: true },
  resolvida: { label: "Resolvida", tone: "success", open: false },
};
const MGR = ["sales_coordinator", "general_manager"];
const fmt = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}`;

export function CustomerOccurrenceSheet({ c, author, onClose }: { c: Customer; author: "seller" | "manager"; onClose: () => void }) {
  const [type, setType] = useState<ComOccType | null>(null);
  const [text, setText] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const by = author === "manager" ? "Gestão" : sellerById.get(c.sellerId)?.name ?? "Vendedor";
  const ok = !!type && text.trim().length >= 5;
  return (
    <Sheet title="Ocorrência do cliente" onClose={onClose} icon={<MessageSquareWarning size={18} />}>
      <div className="small muted mb">{c.tradeName} · fica no histórico do cliente e {author === "seller" ? "vai para a gestão" : "o vendedor é avisado"}.</div>
      <div className="section-title" style={{ marginTop: 0 }}>Assunto</div>
      <div className="list">
        {(Object.keys(COM_TYPES) as ComOccType[]).map((k) => (
          <button key={k} className={`row click${type === k ? " on" : ""}`} style={type === k ? { outline: "2px solid var(--brand)" } : undefined} onClick={() => { setType(k); if (k === "parar") setUrgent(true); }}>
            <div className="grow"><div className="semi small">{COM_TYPES[k].label}</div></div>
          </button>
        ))}
      </div>
      <div className="field mt"><label>O que aconteceu</label>
        <textarea id="comocc-text" className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={type ? `Ex.: ${COM_TYPES[type].hint}` : "Escolha o assunto acima"} />
      </div>
      <label className="flex small mt" style={{ gap: 8 }}><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Urgente (risco de perder o cliente)</label>
      <div className="mt"><PhotoCapture value={photo} onChange={setPhoto} label="Foto (opcional)" /></div>
      <Faltando itens={[!type && ["Assunto", "define quem trata e como aparece nos relatórios"], text.trim().length < 5 && ["O que aconteceu", "a gestão precisa entender o caso sem ligar para você"]]} />
      <button className="btn btn-primary btn-block mt" disabled={!ok} onClick={() => commit(() => {
        const at = nowStamp();
        const o: ComOccurrence = { id: `co${Date.now()}`, number: `OC-${String(1001 + COM_OCCURRENCES.length)}`, type: type!, customerId: c.id, sellerId: c.sellerId, text: text.trim(), createdAt: at, createdBy: by, status: "aberta", urgent, ...(photo ? { photo } : {}), log: [{ at, by, text: "Ocorrência aberta" }] };
        COM_OCCURRENCES.unshift(o);
        notify({ link: { t: "customer", id: c.id }, kind: "comercial", priority: urgent ? "high" : undefined, title: `Ocorrência ${o.number}: ${COM_TYPES[o.type].label}`, text: `${c.tradeName} · ${o.text} · ${by}`, to: author === "seller" ? MGR : [`seller:${c.sellerId}`] });
        onClose();
      }, author === "seller" ? "Ocorrência registrada · enviada à gestão" : "Ocorrência registrada · vendedor avisado")}>Registrar ocorrência</button>
    </Sheet>
  );
}

export function CustomerOccurrenceDetail({ occ, viewer, onClose }: { occ: ComOccurrence; viewer: "seller" | "manager"; onClose: () => void }) {
  useStore();
  const o = COM_OCCURRENCES.find((x) => x.id === occ.id) ?? occ;
  const c = customerById.get(o.customerId);
  const [note, setNote] = useState("");
  const who = viewer === "manager" ? "Gestão" : sellerById.get(o.sellerId)?.name ?? "Vendedor";
  const act = (status: ComOccStatus, text: string, t: string) => commit(() => {
    o.status = status; o.log.push({ at: nowStamp(), by: who, text: note.trim() ? `${text} · ${note.trim()}` : text });
    notify({ link: { t: "customer", id: o.customerId }, kind: "comercial", title: `Ocorrência ${o.number}: ${COM_STATUS[status].label}`, text: `${c?.tradeName ?? ""}${note.trim() ? ` · ${note.trim()}` : ""}`, to: viewer === "manager" ? [`seller:${o.sellerId}`] : MGR });
    setNote("");
  }, t);
  return (
    <Sheet title={`Ocorrência ${o.number}`} onClose={onClose} icon={<MessageSquareWarning size={18} />}>
      <div className="flex" style={{ gap: 6, flexWrap: "wrap" }}><Badge tone={COM_STATUS[o.status].tone}>{COM_STATUS[o.status].label}</Badge>{o.urgent && <Badge tone="danger">Urgente</Badge>}</div>
      <div className="semi mt">{COM_TYPES[o.type].label}</div>
      <div className="small t2">{c?.tradeName} · vendedor {sellerById.get(o.sellerId)?.name}</div>
      <div className="mt small" style={{ padding: 10, borderRadius: 12, background: "var(--gold-soft)", whiteSpace: "pre-wrap" }}>{o.text}</div>
      {o.photo && <div className="photo-preview mt"><img src={o.photo} alt="Foto da ocorrência" /></div>}
      <div className="section-title">Histórico</div>
      <div className="list">{o.log.map((l, i) => <div key={i} className="row"><div className="grow small"><b>{l.by}</b> · {l.text}</div><span className="xs muted">{fmt(l.at)}</span></div>)}</div>
      {COM_STATUS[o.status].open && (
        <>
          <div className="field mt"><label>{viewer === "manager" ? "Tratativa / resposta" : "Comentário"}</label><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={viewer === "manager" ? "Ex.: liguei para o cliente, vamos dar 5% no próximo pedido" : "Ex.: cliente pediu retorno até sexta"} /></div>
          {viewer === "manager" ? (
            <div className="grid2" style={{ gap: 8 }}>
              <button className="btn btn-ghost" disabled={!note.trim()} onClick={() => act("em_tratativa", "Em tratativa", "Tratativa registrada · vendedor avisado")}>Em tratativa</button>
              <button className="btn btn-primary" onClick={() => act("resolvida", "Resolvida", "Ocorrência resolvida")}><CheckCircle2 size={16} /> Resolver</button>
            </div>
          ) : (
            <button className="btn btn-primary btn-block" disabled={!note.trim()} onClick={() => act(o.status, "Comentário", "Comentário enviado à gestão")}>Enviar comentário</button>
          )}
        </>
      )}
    </Sheet>
  );
}

export function CustomerOccurrenceRow({ o, onClick, showCustomer }: { o: ComOccurrence; onClick: () => void; showCustomer?: boolean }) {
  return (
    <button className="row click" onClick={onClick}>
      <div className="grow">
        <div className="semi small">{o.number} · {COM_TYPES[o.type].label}</div>
        <div className="xs muted">{showCustomer ? `${customerById.get(o.customerId)?.tradeName} · ` : ""}{fmt(o.createdAt)} · {o.createdBy} · {o.text.slice(0, 60)}</div>
      </div>
      {o.urgent && COM_STATUS[o.status].open && <Badge tone="danger">Urgente</Badge>}
      <Badge tone={COM_STATUS[o.status].tone}>{COM_STATUS[o.status].label}</Badge>
    </button>
  );
}

/** Aba da gestão: ocorrências de clientes da equipe. */
export function ManagerCustomerOccurrences({ scope }: { scope: string[] }) {
  useStore();
  const [f, setF] = useState<"open" | "all" | ComOccType>("open");
  const [sq, setSq] = useState("");
  const [open, setOpen] = useState<ComOccurrence | null>(null);
  const all = COM_OCCURRENCES.filter((o) => scope.includes(o.sellerId));
  const list = all.filter((o) => (f === "all" || (f === "open" ? COM_STATUS[o.status].open : o.type === f)) && matchRecord({ customerId: o.customerId, sellerId: o.sellerId, number: o.number, extra: `${COM_TYPES[o.type].label} ${o.text}` }, sq));
  return (
    <>
      <h2 style={{ margin: "6px 0 4px" }}>Ocorrências de clientes</h2>
      <p className="small muted mb">Abertas na ficha do cliente: cliente vai parar de comprar, reclamações, preço/concorrência, financeiro e outros.</p>
      <SearchBox value={sq} onChange={setSq} placeholder="Cliente, CNPJ, nº, vendedor ou texto" />
      <div className="chips mb">
        <Chip on={f === "open"} onClick={() => setF("open")}>Pendentes ({all.filter((o) => COM_STATUS[o.status].open).length})</Chip>
        {(Object.keys(COM_TYPES) as ComOccType[]).filter((k) => all.some((o) => o.type === k)).map((k) => <Chip key={k} on={f === k} onClick={() => setF(k)}>{COM_TYPES[k].label.split(" / ")[0]} ({all.filter((o) => o.type === k).length})</Chip>)}
        <Chip on={f === "all"} onClick={() => setF("all")}>Todas ({all.length})</Chip>
      </div>
      <Card>
        <div className="list">{list.map((o) => <CustomerOccurrenceRow key={o.id} o={o} showCustomer onClick={() => setOpen(o)} />)}</div>
        {!list.length && <div className="empty"><div className="ic"><CheckCircle2 /></div>Nenhuma ocorrência neste filtro.</div>}
      </Card>
      {open && <CustomerOccurrenceDetail occ={open} viewer="manager" onClose={() => setOpen(null)} />}
    </>
  );
}
