/** Visitas do dia do vendedor, em tempo real (gerente geral, gerente comercial e supervisor): agendadas × realizadas, check-in ativo, check-in/checkout e histórico dia a dia. */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Radio, CheckCircle2, Clock, XCircle, Video, CalendarDays, BarChart3 } from "lucide-react";
import { TODAY, NOW, SELLERS, customerById } from "../data/mock";
import { useStore } from "../data/store";
import { sellerDayVisits, sellerNow, prevWorkday, nextWorkday, type DayVisit } from "../data/dayvisits";
import { Sheet, Card, Kpi, Badge, Progress, pct } from "./ui";
import { VisitSheet } from "./visits";
import { UserPhoto } from "./userphoto";

const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : "");
const dia = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const minsSince = (iso?: string) => (iso ? Math.max(0, Math.round((NOW.getTime() - Date.parse(iso)) / 60000)) : 0);

export function SellerDaySheet({ sellerId, onClose, onPanel }: { sellerId: string; onClose: () => void; onPanel?: () => void }) {
  useStore();
  const [date, setDate] = useState(TODAY);
  const [open, setOpen] = useState<DayVisit | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30_000); return () => clearInterval(t); }, []);
  const s = SELLERS.find((x) => x.id === sellerId)!;
  const { routeName, list } = sellerDayVisits(sellerId, date);
  const planned = list.filter((v) => !v.extra);
  const done = list.filter((v) => v.status === "visitado");
  const active = list.find((v) => v.status === "em_andamento");
  const pending = list.filter((v) => v.status === "pendente");
  const missed = list.filter((v) => v.status === "nao_visitado");
  const isToday = date === TODAY;
  const doneOfPlanned = planned.filter((v) => v.status === "visitado").length;
  if (open) return <VisitSheet v={open.entry} customerId={open.customerId} onClose={() => setOpen(null)} />;
  const row = (v: DayVisit) => {
    const c = customerById.get(v.customerId)!;
    const e = v.entry;
    return (
      <div key={v.customerId + e.id} className={`row click dv-row dv-${v.status}`} onClick={() => setOpen(v)}>
        <span className="dv-ic">{v.status === "em_andamento" ? <Radio size={17} /> : v.status === "visitado" ? <CheckCircle2 size={17} /> : v.status === "pendente" ? <Clock size={17} /> : <XCircle size={17} />}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="title small">{c.tradeName}{v.extra ? <span className="xs muted"> · fora da rota</span> : null}</div>
          <div className="sub">{c.district} · {c.address}</div>
          {e.result && v.status !== "pendente" && <div className="xs" style={{ marginTop: 2 }}>{e.result}</div>}
        </div>
        <div className="end dv-end">
          {v.status === "em_andamento" && <><Badge tone="warning">check-in {hhmm(e.inAt)}</Badge><span className="xs semi gold">há {minsSince(e.inAt)} min</span></>}
          {v.status === "visitado" && <><span className="num small semi">{hhmm(e.inAt)} – {hhmm(e.outAt)}</span><span className="xs muted">{e.minutes} min</span>{e.orderNumbers?.map((n) => <span key={n} className="visit-order">{n}</span>)}{(e.hasVideo || e.demoVideo) ? <span className="visit-video"><Video size={12} /> vídeo</span> : <span className="xs muted">vídeo apagado</span>}</>}
          {v.status === "pendente" && <Badge tone="neutral">pendente</Badge>}
          {v.status === "nao_visitado" && <Badge tone="danger">não visitado</Badge>}
        </div>
      </div>
    );
  };
  return (
    <Sheet title={`Visitas · ${s.name}`} onClose={onClose} wide icon={<MapPin size={18} />}>
      <div className="dv-nav">
        <button className="icon-btn" aria-label="Dia anterior" onClick={() => setDate(prevWorkday(date))}><ChevronLeft size={18} /></button>
        <div className="dv-date"><CalendarDays size={15} /> <b>{isToday ? "Hoje · " : ""}{dia(date)}</b><span className="xs muted">{routeName}</span></div>
        <button className="icon-btn" aria-label="Próximo dia" disabled={isToday} onClick={() => setDate(nextWorkday(date))}><ChevronRight size={18} /></button>
        {!isToday && <button className="btn btn-ghost btn-sm" onClick={() => setDate(TODAY)}>Hoje</button>}
      </div>

      <div className="grid g2 gd-4">
        <Kpi label="Agendadas" value={planned.length} foot={`clientes da ${routeName}`} />
        <Kpi label="Realizadas" tone="success" value={<>{doneOfPlanned} <small>/ {planned.length}</small></>}>
          <div className="progress-row"><Progress value={planned.length ? (doneOfPlanned / planned.length) * 100 : 0} /><b className="num xs">{pct(planned.length ? (doneOfPlanned / planned.length) * 100 : 0)}</b></div>
        </Kpi>
        <Kpi label={isToday ? "Pendentes" : "Não visitados"} tone="red" value={isToday ? pending.length : missed.length} />
        <Kpi label="Com pedido" tone="gold" value={done.filter((v) => v.entry.orderIds?.length).length} foot={`${done.length - planned.filter((v) => v.status === "visitado").length} fora da rota`} />
      </div>

      {isToday && (
        <div className={`dv-now ${active ? "on" : ""}`}>
          {active ? <>
            <span className="dv-pulse" />
            <div className="grow"><div className="xs semi">AGORA · CHECK-IN ATIVO</div><div className="bold">{customerById.get(active.customerId)?.tradeName}</div><div className="small">entrou às {hhmm(active.entry.inAt)} · há {minsSince(active.entry.inAt)} min · {customerById.get(active.customerId)?.district}</div></div>
          </> : <div className="grow small">{pending.length ? `Sem check-in ativo agora · ${pending.length} cliente(s) ainda por visitar` : "Todas as visitas do dia concluídas"}</div>}
        </div>
      )}

      {active && <Card title="Em atendimento" className="mt">{row(active)}</Card>}
      <Card title={`Realizadas (${done.length})`} className="mt" sub="check-in → checkout · toque para ver detalhes, pedido e vídeo">
        <div className="list">{done.map(row)}</div>
        {!done.length && <div className="small muted">Nenhuma visita realizada{isToday ? " ainda" : ""}.</div>}
      </Card>
      {isToday ? (
        <Card title={`Faltam visitar (${pending.length})`} className="mt">
          <div className="list">{pending.map(row)}</div>
          {!pending.length && <div className="small green semi">Nenhuma pendente.</div>}
        </Card>
      ) : missed.length > 0 && (
        <Card title={`Não visitados (${missed.length})`} className="mt"><div className="list">{missed.map(row)}</div></Card>
      )}
      <p className="xs muted mt">O histórico de visitas não é apagado. Só o vídeo do freezer é removido 60 dias após a visita. Não é possível finalizar uma visita sem o vídeo.</p>
      {onPanel && <button className="btn btn-ghost btn-block mt" onClick={onPanel}><BarChart3 size={16} /> Painel do vendedor (metas e vendas)</button>}
    </Sheet>
  );
}

/** Lista "Agora em campo": onde cada vendedor está neste momento. */
export function NowInFieldCard({ scope, onSeller }: { scope: string[]; onSeller: (id: string) => void }) {
  useStore();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30_000); return () => clearInterval(t); }, []);
  return (
    <Card title="Agora em campo" icon={<Radio size={17} />} sub="tempo real · toque no vendedor para ver as visitas do dia" className="mb">
      <div className="list">
        {SELLERS.filter((s) => scope.includes(s.id)).map((s) => {
          const n = sellerNow(s.id);
          const c = n.active ? customerById.get(n.active.customerId) : undefined;
          return (
            <div key={s.id} className="row click" onClick={() => onSeller(s.id)}>
              <UserPhoto name={s.name} size={38} userKey={`seller:${s.id}`} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="title small">{s.name}</div>
                <div className="sub">{c ? <span className="gold semi">● em {c.tradeName} desde {hhmm(n.active!.entry.inAt)} (há {minsSince(n.active!.entry.inAt)} min)</span>
                  : n.last ? `sem check-in ativo · último checkout ${hhmm(n.last.entry.outAt)} em ${customerById.get(n.last.customerId)?.tradeName}` : "ainda não fez check-in hoje"}</div>
              </div>
              <div className="end" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}><b className="num">{n.done}/{n.planned}</b><span className="xs muted">{n.pending} pendentes</span></div>
              <ChevronRight size={16} className="muted" />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
