/** Cartão "Histórico de visitas" da ficha do cliente (vendedor, supervisor e gerente). */
import { useState } from "react";
import { MapPin, CheckCircle2, XCircle, Clock, UserRound, Video } from "lucide-react";
import { useStore } from "../data/store";
import { visitHistory, type VisitEntry } from "../data/visits";
import { Card, Badge } from "./ui";

const fmtD = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });
const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : "");

export function VisitHistoryCard({ customerId, onVideo }: { customerId: string; onVideo?: (checkinId: string) => void }) {
  useStore();
  const all = visitHistory(customerId);
  const [more, setMore] = useState(false);
  const list = more ? all : all.slice(0, 5);
  const done = all.filter((v) => v.status === "visitado").length;
  const withOrder = all.filter((v) => v.orderNumber).length;
  return (
    <Card id="hist-visitas" title={`Histórico de visitas (${all.length})`} icon={<MapPin size={17} />} sub={all.length ? `${done} visitadas · ${withOrder} com pedido` : undefined}>
      <div className="list">
        {list.map((v) => <VisitRow key={v.id} v={v} onVideo={onVideo} />)}
        {!all.length && <div className="small muted">Nenhuma visita registrada ainda.</div>}
      </div>
      {all.length > 5 && <button className="link mt" onClick={() => setMore(!more)}>{more ? "Ver menos" : `Ver todas (${all.length})`}</button>}
    </Card>
  );
}

function VisitRow({ v, onVideo }: { v: VisitEntry; onVideo?: (checkinId: string) => void }) {
  const icon = v.status === "nao_visitado" ? <XCircle size={17} className="red" /> : v.status === "em_andamento" ? <Clock size={17} className="gold" /> : <CheckCircle2 size={17} className="green" />;
  return (
    <div className="row" style={{ alignItems: "flex-start" }}>
      <span style={{ marginTop: 2 }}>{icon}</span>
      <div className="grow">
        <div className="title small">{fmtD(v.date)}{v.inAt ? ` · ${hhmm(v.inAt)}${v.outAt ? `–${hhmm(v.outAt)}` : ""}` : ""}{v.minutes ? ` (${v.minutes} min)` : ""}</div>
        <div className="sub" style={{ whiteSpace: "normal" }}>{v.sellerName}{v.contact ? <> · <UserRound size={11} style={{ verticalAlign: -1 }} /> falou com {v.contact}</> : ""}</div>
        <div className="xs" style={{ whiteSpace: "normal", marginTop: 2 }}>{v.result}{v.note ? ` · ${v.note}` : ""}</div>
      </div>
      <div className="end" style={{ gap: 4 }}>
        <Badge tone={v.status === "nao_visitado" ? "danger" : v.status === "em_andamento" ? "warning" : v.orderNumber ? "success" : "neutral"}>
          {v.status === "nao_visitado" ? "Não visitado" : v.status === "em_andamento" ? "Em andamento" : v.orderNumber ? "Com pedido" : "Visitado"}
        </Badge>
        {v.checkinId && v.hasVideo && onVideo && <button className="btn btn-soft btn-sm" onClick={() => onVideo(v.checkinId!)}><Video size={13} /> Vídeo</button>}
      </div>
    </div>
  );
}
