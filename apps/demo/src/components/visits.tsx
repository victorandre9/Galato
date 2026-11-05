/** Histórico de visitas da ficha do cliente (vendedor, supervisor e gerente): cada visita abre o detalhe, com o pedido que saiu dela e o vídeo do freezer. */
import { useState } from "react";
import { MapPin, CheckCircle2, XCircle, Clock, UserRound, Video, ClipboardList, ChevronRight, Snowflake, Route as RouteIc } from "lucide-react";
import { useStore } from "../data/store";
import { visitHistory, type VisitEntry } from "../data/visits";
import { customerOrders, type HistOrder } from "../data/history";
import { CHECKINS, customerById } from "../data/mock";
import { Card, Badge, Sheet, brl } from "./ui";
import { CheckinVideo } from "./checkout";
import { OrderDetail } from "../screens/Reports";

const fmtD = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long" });
const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : "");

export function VisitHistoryCard({ customerId }: { customerId: string; onVideo?: (checkinId: string) => void }) {
  useStore();
  const all = visitHistory(customerId);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<VisitEntry | null>(null);
  const list = more ? all : all.slice(0, 6);
  const done = all.filter((v) => v.status === "visitado").length;
  const withOrder = all.filter((v) => v.orderIds?.length).length;
  return (
    <Card id="hist-visitas" title={`Histórico de visitas (${all.length})`} icon={<MapPin size={17} />} sub={all.length ? `${done} visitadas · ${withOrder} com pedido · toque para ver` : undefined}>
      <div className="list">
        {list.map((v) => <VisitRow key={v.id} v={v} onClick={() => setOpen(v)} />)}
        {!all.length && <div className="small muted">Nenhuma visita registrada ainda.</div>}
      </div>
      {all.length > 6 && <button className="link mt" onClick={() => setMore(!more)}>{more ? "Ver menos" : `Ver todas (${all.length})`}</button>}
      {open && <VisitSheet v={open} customerId={customerId} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function VisitRow({ v, onClick }: { v: VisitEntry; onClick: () => void }) {
  const icon = v.status === "nao_visitado" ? <XCircle size={17} className="red" /> : v.status === "em_andamento" ? <Clock size={17} className="gold" /> : <CheckCircle2 size={17} className="green" />;
  return (
    <div className="row click visit-row" onClick={onClick} style={{ alignItems: "flex-start" }}>
      <span style={{ marginTop: 2 }}>{icon}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="title small">{fmtD(v.date)}{v.inAt ? ` · ${hhmm(v.inAt)}${v.outAt ? `–${hhmm(v.outAt)}` : ""}` : ""}{v.minutes ? ` (${v.minutes} min)` : ""}</div>
        <div className="sub" style={{ whiteSpace: "normal" }}>{v.sellerName}{v.contact ? <> · <UserRound size={11} style={{ verticalAlign: -1 }} /> falou com {v.contact}</> : ""}</div>
        <div className="xs" style={{ whiteSpace: "normal", marginTop: 2 }}>{v.result}{v.note ? ` · ${v.note}` : ""}</div>
      </div>
      <div className="end visit-end">
        <Badge tone={v.status === "nao_visitado" ? "danger" : v.status === "em_andamento" ? "warning" : v.orderIds?.length ? "success" : "neutral"}>
          {v.status === "nao_visitado" ? "Não visitado" : v.status === "em_andamento" ? "Em andamento" : v.orderIds?.length ? "Com pedido" : "Sem pedido"}
        </Badge>
        {v.orderNumbers?.map((n) => <span key={n} className="visit-order">{n}</span>)}
        {(v.hasVideo || v.demoVideo) && <span className="visit-video"><Video size={12} /> vídeo</span>}
      </div>
      <ChevronRight size={16} className="muted" style={{ alignSelf: "center" }} />
    </div>
  );
}

function VisitSheet({ v, customerId, onClose }: { v: VisitEntry; customerId: string; onClose: () => void }) {
  const c = customerById.get(customerId)!;
  const [order, setOrder] = useState<HistOrder | null>(null);
  const [video, setVideo] = useState(false);
  const orders = customerOrders(customerId).filter((o) => v.orderIds?.includes(o.id));
  const checkin = v.checkinId ? CHECKINS.find((k) => k.id === v.checkinId) : undefined;
  if (order) return <OrderDetail o={order} onClose={() => setOrder(null)} />;
  if (video && checkin?.video) return <CheckinVideo checkin={checkin} title={`Vídeo do freezer · ${c.tradeName}`} onClose={() => setVideo(false)} />;
  if (video) return <DemoFreezerVideo c={c.tradeName} date={v.date} patrimonies={c.assets.map((a) => a.patrimony)} onClose={() => setVideo(false)} />;
  return (
    <Sheet title={`Visita · ${fmtD(v.date)}`} onClose={onClose} icon={<MapPin size={18} />}>
      <div className="card">
        <dl className="kv">
          <dt>Cliente</dt><dd>{c.tradeName}</dd>
          <dt>Vendedor</dt><dd>{v.sellerName}</dd>
          <dt>Situação</dt><dd>{v.status === "nao_visitado" ? "Não visitado" : v.status === "em_andamento" ? "Em andamento" : "Visitado"}</dd>
          {v.inAt && <><dt>Check-in</dt><dd>{hhmm(v.inAt)}</dd></>}
          {v.outAt && <><dt>Checkout</dt><dd>{hhmm(v.outAt)}{v.minutes ? ` · ${v.minutes} min no cliente` : ""}</dd></>}
          {v.contact && <><dt>Falou com</dt><dd>{v.contact}</dd></>}
          <dt>Resultado</dt><dd>{v.result}</dd>
          {v.note && <><dt>Anotação</dt><dd>{v.note}</dd></>}
        </dl>
      </div>
      {orders.length > 0 && (
        <Card title="Pedido que saiu desta visita" icon={<ClipboardList size={17} />} className="mt" sub="toque para abrir o pedido">
          <div className="list">
            {orders.map((o) => (
              <div key={o.id} className="row click" onClick={() => setOrder(o)}>
                <div className="grow"><div className="title small">{o.number}</div><div className="sub">{o.invoiceNumber ?? "sem NF"} · {o.items.length} itens</div></div>
                <div className="end num semi">{brl(o.totalCents)}</div>
                <ChevronRight size={16} className="muted" />
              </div>
            ))}
          </div>
        </Card>
      )}
      {v.status !== "nao_visitado" && (
        (checkin?.video || v.demoVideo)
          ? <button className="btn btn-primary btn-block mt" onClick={() => setVideo(true)}><Video size={16} /> Ver vídeo do freezer</button>
          : <div className="small muted mt"><Snowflake size={13} style={{ verticalAlign: -2 }} /> {c.assets.length ? "Sem vídeo do freezer nesta visita." : "Cliente sem freezer Galato: não há vídeo."}</div>
      )}
    </Sheet>
  );
}

/** Vídeo do freezer das visitas de demonstração (no sistema real toca o vídeo gravado no checkout). */
function DemoFreezerVideo({ c, date, patrimonies, onClose }: { c: string; date: string; patrimonies: string[]; onClose: () => void }) {
  return (
    <Sheet title={`Vídeo do freezer · ${c}`} onClose={onClose} icon={<Video size={18} />}>
      <div className="demo-video">
        <svg viewBox="0 0 320 200" className="demo-video__svg" aria-hidden>
          <rect x="0" y="0" width="320" height="200" fill="#1a1d23" />
          <g className="demo-video__pan">
            <rect x="70" y="40" width="180" height="130" rx="10" fill="#e9eef5" stroke="#9fb0c4" strokeWidth="3" />
            <rect x="82" y="52" width="156" height="60" rx="6" fill="#bcd7ef" opacity=".7" />
            {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={92 + i * 29} y="62" width="22" height="40" rx="4" fill={["#E31B2C", "#F5A800", "#ffffff", "#E31B2C", "#F5A800"][i]} />)}
            <rect x="82" y="120" width="156" height="40" rx="6" fill="#dfe6ee" />
            <text x="160" y="146" textAnchor="middle" fontSize="13" fontWeight="800" fill="#C8102E">GALATO</text>
          </g>
          <circle cx="292" cy="22" r="6" fill="#E31B2C" className="demo-video__rec" />
          <text x="278" y="26" textAnchor="end" fontSize="11" fill="#fff">REC</text>
          <text x="12" y="190" fontSize="11" fill="#cfd6e0">{new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · {patrimonies.join(", ")}</text>
        </svg>
      </div>
      <p className="small muted mt">Vídeo de demonstração. No sistema em uso, aqui toca o vídeo de até 10 segundos que o vendedor grava no checkout da visita, mostrando o freezer por dentro e por fora.</p>
    </Sheet>
  );
}
