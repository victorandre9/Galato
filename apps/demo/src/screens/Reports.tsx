/** Relatórios da gestão — dashboard do mês, por vendedor. */
import { orderStatusText } from "../data/orders";
import { useMemo, useState } from "react";
import { BarChart3, Users, MapPin, Target, PieChart } from "lucide-react";
import { addDays, businessDaysBetween, isBusinessDay, monthBounds, rankByAttainment, daysBetween, inactivityBucket, bucketLabel, ORDER_STATUS, type IsoDate } from "@galato/domain";
import { FileText, UserX, History, Share2, Download } from "lucide-react";
import { toast } from "../data/store";
import { VisitHistoryCard } from "../components/visits";
import { matchCustomer } from "../data/search";
import { SearchBox } from "../components/ui";
import { sellerMonthOrders, customerOrders, customersWithoutPurchaseThisMonth, type HistOrder } from "../data/history";
import { fmtDate, fmtDateTime, termLabel, termShort } from "../components/business";
import { PARAMS, SELLERS, CUSTOMERS, ORDERS, TODAY, PRODUCTS, sellerById, customerById } from "../data/mock";
import { sellerGoal, teamGoal, dayLabel, statusLabel, financial } from "../data/selectors";
import { useStore } from "../data/store";
import { Card, Kpi, Chip, Badge, Progress, brl0, brl, pct, Sheet, Curve, scrollToId } from "../components/ui";

const cal = PARAMS.workCalendar;

// ---------------------------------------------------------------- dados derivados (fictícios, determinísticos)
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function businessDaysSoFar(): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = monthBounds(TODAY).first; d <= TODAY; d = addDays(d, 1)) if (isBusinessDay(d, cal)) out.push(d);
  return out;
}

/** Venda diária por vendedor: distribui o realizado do mês pelos dias úteis já passados. */
/** Todos os dias úteis do mês (o gráfico já nasce com o mês inteiro e vai sendo preenchido). */
function businessDaysOfMonth(): IsoDate[] {
  const out: IsoDate[] = [];
  const { first, last } = monthBounds(TODAY);
  for (let d = first; d <= last; d = addDays(d, 1)) if (isBusinessDay(d, cal)) out.push(d);
  return out;
}

function sellerDaily(sellerId: string) {
  // cada barra = soma dos pedidos daquele dia (o toque na barra mostra exatamente esses pedidos)
  const days = businessDaysOfMonth();
  const orders = sellerMonthOrders(sellerId);
  const daily = sellerGoal(sellerId).dailyGoalCents;
  return days.map((d) => ({ date: d, sales: orders.filter((o) => o.date === d).reduce((a, o) => a + o.totalCents, 0), goal: daily, future: d > TODAY }));
}

function teamDaily(ids: string[]) {
  const per = ids.map(sellerDaily);
  return per[0]!.map((_, i) => ({
    date: per[0]![i]!.date,
    sales: per.reduce((a, p) => a + p[i]!.sales, 0),
    goal: per.reduce((a, p) => a + p[i]!.goal, 0),
    future: per[0]![i]!.future,
  }));
}

function sellerMonthVisits(sellerId: string) {
  const s = SELLERS.find((x) => x.id === sellerId)!;
  const days = businessDaysSoFar().length;
  const planned = days * s.visitsPlannedToday;
  const rate = Math.min(1, s.visitsDoneToday / Math.max(1, s.visitsPlannedToday) + 0.06 + hash(sellerId) * 0.05);
  const done = Math.round(planned * rate);
  const withOrder = Math.round(done * (0.42 + hash(sellerId + "conv") * 0.22));
  return { planned, done, pct: planned ? (done / planned) * 100 : 0, withOrder, conversion: done ? (withOrder / done) * 100 : 0, noSale: done - withOrder };
}

/** Sazonalidade fictícia de sorvete: verão alto, inverno baixo (jan..dez). */
const SEASON = [1.25, 1.2, 1.1, 0.95, 0.8, 0.65, 0.62, 0.7, 0.9, 1.0, 1.1, 1.25];
export type MonthPoint = { key: string; label: string; sales: number; goal: number; partial: boolean };

/** Meses (jan=0) em que a equipe não bateu a meta no histórico fictício: inverno. */
const TEAM_MISSED_MONTHS = [5, 7];

export function sellerYear(sellerId: string): MonthPoint[] {
  const s = SELLERS.find((x) => x.id === sellerId)!;
  const [y, m] = TODAY.split("-").map(Number) as [number, number];
  const base = s.monthlyGoalCents / SEASON[m - 1]!;
  // desempenho relativo do vendedor dentro da equipe (quem está abaixo hoje tende a estar abaixo no histórico)
  const teamPerf = SELLERS.reduce((a, x) => a + x.monthAchievedCents, 0) / SELLERS.reduce((a, x) => a + x.monthlyGoalCents, 0);
  const rel = s.monthAchievedCents / s.monthlyGoalCents / teamPerf;
  const out: MonthPoint[] = [];
  for (let back = 11; back >= 0; back--) {
    const d = new Date(Date.UTC(y, m - 1 - back, 1));
    const mi = d.getUTCMonth();
    const key = `${d.getUTCFullYear()}-${String(mi + 1).padStart(2, "0")}`;
    const goal = back === 0 ? s.monthlyGoalCents : Math.round((base * SEASON[mi]!) / 100_000) * 100_000;
    const teamFactor = TEAM_MISSED_MONTHS.includes(mi) ? 0.91 : 1.07;
    const sales = back === 0 ? s.monthAchievedCents : Math.round(goal * teamFactor * rel * (0.95 + hash(sellerId + key) * 0.1));
    out.push({ key, label: d.toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" }) + (mi === 0 ? `/${String(d.getUTCFullYear()).slice(2)}` : ""), sales, goal, partial: back === 0 });
  }
  return out;
}
function teamYear(ids: string[]): MonthPoint[] {
  const per = ids.map(sellerYear);
  return per[0]!.map((p, i) => ({ ...p, sales: per.reduce((a, x) => a + x[i]!.sales, 0), goal: per.reduce((a, x) => a + x[i]!.goal, 0) }));
}

function YearChart({ data }: { data: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 240, padL = 56, padR = 12, padT = 24, padB = 30;
  const max = Math.max(...data.map((d) => Math.max(d.sales, d.goal))) * 1.1 || 1;
  const step = (W - padL - padR) / data.length;
  const bw = Math.min(34, step - 10);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const h = hover !== null ? data[hover] : null;
  const fmtK = (v: number) => (v >= 100_000_000 ? `${(v / 100_000_000).toFixed(1).replace(".", ",")}mi` : v >= 100_000 ? `${Math.round(v / 100_000)}k` : "0");
  return (
    <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Vendas por mês comparadas à meta, últimos 12 meses">
        {ticks.map((t) => (
          <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={padL - 8} y={y(t) + 4} className="axis-label" textAnchor="end">{fmtK(t)}</text></g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * step + (step - bw) / 2;
          const top = y(d.sales);
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={padL + i * step} y={padT} width={step} height={H - padT - padB} fill="transparent" />
              <path d={`M${x},${H - padB} V${top + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - padB} Z`}
                className={`bar ${d.sales >= d.goal ? "bar-hit" : ""} ${d.partial ? "bar-partial" : ""} ${hover === i ? "bar-hover" : ""}`} />
              <line x1={x - 4} x2={x + bw + 4} y1={y(d.goal)} y2={y(d.goal)} className="goal-tick" />
              {/* % da meta sempre visível em cima da barra (sem precisar passar o mouse) */}
              <text x={x + bw / 2} y={Math.min(top, y(d.goal)) - 5} className={`bar-pct ${d.sales >= d.goal ? "hit" : "miss"}`} textAnchor="middle">{pct((d.sales / Math.max(1, d.goal)) * 100)}</text>
              <text x={x + bw / 2} y={H - padB + 16} className="axis-label axis-month" textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {h && (
        <div className="chart-tip" style={{ left: `${Math.min(88, Math.max(12, ((padL + hover! * step + step / 2) / W) * 100))}%` }}>
          <b>{h.label}{h.partial ? " (mês em andamento)" : ""}</b>
          <span>Vendido {brl0(h.sales)}</span>
          <span>Meta {brl0(h.goal)} · <b className={h.sales >= h.goal ? "green" : "red"}>{pct((h.sales / h.goal) * 100)}</b></span>
        </div>
      )}
      <div className="chart-legend"><span><i className="sw sw-bar" /> Vendido no mês</span><span><i className="sw sw-hit" /> Bateu a meta</span><span><i className="sw sw-goal-h" /> Meta do mês</span><span><i className="sw sw-partial" /> Mês atual (parcial)</span></div>
    </div>
  );
}

function YearSummary({ data }: { data: MonthPoint[] }) {
  const closed = data.filter((d) => !d.partial);
  const hit = closed.filter((d) => d.sales >= d.goal).length;
  const best = closed.reduce((a, d) => (d.sales > a.sales ? d : a), closed[0]!);
  const worst = closed.reduce((a, d) => (d.sales < a.sales ? d : a), closed[0]!);
  const last3 = closed.slice(-3).reduce((a, d) => a + d.sales, 0), prev3 = closed.slice(-6, -3).reduce((a, d) => a + d.sales, 0);
  const trend = prev3 ? ((last3 - prev3) / prev3) * 100 : 0;
  return (
    <div className="flex wrap small t2" style={{ gap: "6px 18px", marginTop: 8 }}>
      <span>Meta batida em <b>{hit} de {closed.length}</b> meses (<b className={hit / closed.length >= 0.8 ? "green" : "gold"}>{pct((hit / closed.length) * 100)}</b>)</span>
      <span>Melhor: <b>{best.label}</b> {brl0(best.sales)}</span>
      <span>Pior: <b>{worst.label}</b> {brl0(worst.sales)}</span>
      <span>Últimos 3 meses x 3 anteriores: <b className={trend >= 0 ? "green" : "red"}>{trend >= 0 ? "+" : ""}{pct(trend, 1)}</b></span>
    </div>
  );
}

// ---------------------------------------------------------------- gráficos
function DailyChart({ data, height = 220, orders, hideCustomer }: { data: { date: IsoDate; sales: number; goal: number; future?: boolean }[]; height?: number; orders?: HistOrder[]; hideCustomer?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [openO, setOpenO] = useState<HistOrder | null>(null);
  const pick = (i: number) => { setHover(i); if (orders) setSel(sel === i ? null : i); };
  const W = 720, H = height, padL = 52, padR = 12, padT = 14, padB = 30;
  const max = Math.max(...data.map((d) => Math.max(d.sales, d.goal))) * 1.12 || 1;
  const step = (W - padL - padR) / data.length;
  const bw = Math.max(6, Math.min(28, step - 6));
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const goalY = y(data[0]?.goal ?? 0);
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Vendas por dia útil comparadas à meta diária">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={padL - 8} y={y(t) + 4} className="axis-label" textAnchor="end">{t >= 100000 ? `${Math.round(t / 100000)}k` : "0"}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * step + (step - bw) / 2;
          const top = y(d.sales);
          const hit = d.sales >= d.goal;
          if (d.future) return (
            <g key={d.date}>
              <rect x={x} y={H - padB - 3} width={bw} height={3} rx={1.5} className="bar-future" />
              <text x={x + bw / 2} y={H - padB + 16} className="axis-label axis-future" textAnchor="middle">{d.date.slice(8)}</text>
            </g>
          );
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onClick={() => pick(i)} style={orders ? { cursor: "pointer" } : undefined} opacity={sel !== null && sel !== i ? 0.4 : 1}>
              <rect x={padL + i * step} y={padT} width={step} height={H - padT - padB} fill="transparent" />
              {d.sales > 0 && <path d={`M${x},${H - padB} V${top + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - padB} Z`}
                className={`bar ${hit ? "bar-hit" : ""} ${hover === i ? "bar-hover" : ""}`} />}
              <text x={x + bw / 2} y={H - padB + 16} className="axis-label" textAnchor="middle">{d.date.slice(8)}</text>
            </g>
          );
        })}
        <line x1={padL} x2={W - padR} y1={goalY} y2={goalY} className="goal-line" />
      </svg>
      {h && (
        <div className="chart-tip" style={{ left: `${((padL + hover! * step + step / 2) / W) * 100}%` }}>
          <b>{dayLabel(h.date)}</b>
          <span>Vendido {brl0(h.sales)}</span>
          <span>Meta {brl0(h.goal)} · <b className={h.sales >= h.goal ? "green" : "red"}>{pct((h.sales / h.goal) * 100)}</b></span>
        </div>
      )}
      <div className="chart-legend"><span><i className="sw sw-bar" /> Vendido no dia</span><span><i className="sw sw-hit" /> Bateu a meta</span><span><i className="sw sw-goal" /> Meta diária</span></div>
      {orders && sel === null && <div className="xs muted mt">Toque no dia para ver os pedidos daquele dia.</div>}
      {orders && sel !== null && (() => {
        const d = data[sel]!;
        const list = orders.filter((o) => o.date === d.date);
        return (
          <div className="day-orders mt">
            <div className="flex between" style={{ alignItems: "center", gap: 8, marginBottom: 8 }}>
              <b className="small">Pedidos de {dayLabel(d.date)} ({list.length}) · {brl0(list.reduce((a, o) => a + o.totalCents, 0))}</b>
              <button className="link" onClick={() => setSel(null)}>Fechar</button>
            </div>
            <div className="order-cards">
              {list.map((o) => <OrderBalloon key={o.id} o={o} hideCustomer={hideCustomer} onClick={() => setOpenO(o)} />)}
              {!list.length && <div className="small muted">Nenhum pedido neste dia.</div>}
            </div>
          </div>
        );
      })()}
      {openO && <OrderDetail o={openO} onClose={() => setOpenO(null)} />}
    </div>
  );
}

/** Barra realizado x marcador de meta (bullet), uma linha por vendedor. */
function BulletRows({ rows, onOpen }: { rows: { id: string; name: string; achieved: number; target: number; pct: number }[]; onOpen: (id: string) => void }) {
  const max = Math.max(...rows.map((r) => Math.max(r.achieved, r.target))) * 1.05 || 1;
  return (
    <div className="bullets">
      {rows.map((r, i) => (
        <button key={r.id} className="bullet-row" onClick={() => onOpen(r.id)} title={`${r.name}: ${brl0(r.achieved)} de ${brl0(r.target)} (${pct(r.pct)})`}>
          <span className="bullet-name"><span className={`pos p${i + 1}`}>{i + 1}º</span>{r.name}</span>
          <span className="bullet-track">
            <span className={`bullet-bar ${r.pct >= 100 ? "hit" : ""}`} style={{ width: `${(r.achieved / max) * 100}%` }} />
            <span className="bullet-goal" style={{ left: `${(r.target / max) * 100}%` }} />
          </span>
          <span className="bullet-val num"><b>{brl0(r.achieved)}</b><span className="xs muted"> / {brl0(r.target)}</span></span>
          <span className={`bullet-pct num ${r.pct >= 100 ? "green" : r.pct < 80 ? "red" : "gold"}`}>{pct(r.pct)}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- tela
export function ReportsView({ scope }: { scope: string[] }) {
  useStore();
  const [sortBy, setSortBy] = useState<"pct" | "value">("pct");
  const [period, setPeriod] = useState<"month" | "day">("month");
  const [open, setOpen] = useState<string | null>(null);
  const [curveOpen, setCurveOpen] = useState<string | null>(null);
  const [curveCust, setCurveCust] = useState<string | null>(null);
  const [rank, setRank] = useState(false);
  const g = teamGoal(scope);
  const daily = useMemo(() => teamDaily(scope), [scope.join(",")]);
  const daysHit = daily.filter((d) => d.sales >= d.goal).length;

  const base = SELLERS.filter((s) => scope.includes(s.id)).map((s) => {
    const sg = sellerGoal(s.id);
    const achieved = period === "month" ? sg.achievedMonthCents : sg.achievedTodayCents;
    const target = period === "month" ? sg.monthlyGoalCents : sg.dailyGoalCents;
    return { id: s.id, name: s.name, achieved, target, pct: target ? (achieved / target) * 100 : 0 };
  });
  const ranked = sortBy === "pct"
    ? rankByAttainment(base).map((r) => base.find((b) => b.id === r.id)!)
    : [...base].sort((a, b) => b.achieved - a.achieved);

  const visits = SELLERS.filter((s) => scope.includes(s.id)).map((s) => ({ s, v: sellerMonthVisits(s.id) }));
  const vt = visits.reduce((a, x) => ({ planned: a.planned + x.v.planned, done: a.done + x.v.done, withOrder: a.withOrder + x.v.withOrder }), { planned: 0, done: 0, withOrder: 0 });
  const curve = (["A", "B", "C", "D"] as const).map((c) => {
    const list = CUSTOMERS.filter((x) => scope.includes(x.sellerId) && x.abcd === c);
    return { c, n: list.length, value: list.reduce((a, x) => a + x.avgMonthlyCents, 0) };
  });
  const curveMax = Math.max(...curve.map((c) => c.value)) || 1;
  const orders = ORDERS.filter((o) => o.kind === "ORDER" && scope.includes(o.sellerId));
  const ticket = g.achievedMonthCents / Math.max(1, SELLERS.filter((s) => scope.includes(s.id)).reduce((a, s) => a + s.ordersMonth, 0));

  return (
    <>
      <div className="flex between wrap" style={{ margin: "6px 0 12px", gap: 8 }}>
        <div>
          <h2>Relatórios</h2>
          <p className="small muted">Mês atual até {dayLabel(TODAY)} · {businessDaysBetween(monthBounds(TODAY).first, TODAY, cal)} de {g.businessDaysInMonth} dias úteis</p>
        </div>
      </div>

      <div className="grid g2 gd-4">
        <Kpi icon={<Target size={17} />} label="Meta do mês" value={brl0(g.monthlyGoalCents)} foot={`meta diária ${brl0(g.dailyGoalCents)}`} onClick={() => setRank(true)} />
        <Kpi icon={<BarChart3 size={17} />} tone="gold" label="Vendido no mês" value={brl0(g.achievedMonthCents)} onClick={() => setRank(true)}>
          <div className="progress-row"><Progress value={g.monthAttainmentPct} /><b className="num xs">{pct(g.monthAttainmentPct)}</b></div>
        </Kpi>
        <Kpi icon={<MapPin size={17} />} tone="info" label="Visitas no mês" onClick={() => scrollToId("rel-visitas")} value={<>{vt.done} <small>/ {vt.planned}</small></>} foot={`conversão em pedido ${pct((vt.withOrder / Math.max(1, vt.done)) * 100)}`} />
        <Kpi icon={<Users size={17} />} tone="success" label="Ticket médio" onClick={() => scrollToId("rel-diario")} value={brl0(ticket)} foot={`${daysHit} de ${daily.filter((d) => !d.future).length} dias com meta batida`} />
      </div>

      <Card id="rel-diario" title="Vendas por dia útil x meta diária" icon={<BarChart3 size={17} />} sub="equipe · toque no dia para ver os pedidos">
        <DailyChart data={daily} orders={scope.flatMap(sellerMonthOrders)} />
      </Card>

      <Card title="Vendas x meta · últimos 12 meses" icon={<BarChart3 size={17} />} sub="equipe · sazonalidade (inverno é temporada baixa)" className="mt">
        <YearChart data={teamYear(scope)} />
        <YearSummary data={teamYear(scope)} />
      </Card>

      <Card title="Realizado x meta por vendedor" icon={<Target size={17} />} className="mt" sub="toque no vendedor para ver o painel dele">
        <div className="flex wrap mb" style={{ gap: 14 }}>
          <div className="chips"><span className="xs muted semi" style={{ alignSelf: "center" }}>Período</span>
            <Chip on={period === "month"} onClick={() => setPeriod("month")}>Mês</Chip>
            <Chip on={period === "day"} onClick={() => setPeriod("day")}>Hoje</Chip>
          </div>
          <div className="chips"><span className="xs muted semi" style={{ alignSelf: "center" }}>Ordenar por</span>
            <Chip on={sortBy === "pct"} onClick={() => setSortBy("pct")}>% da meta (ranking oficial)</Chip>
            <Chip on={sortBy === "value"} onClick={() => setSortBy("value")}>Faturamento</Chip>
          </div>
        </div>
        <BulletRows rows={ranked} onOpen={setOpen} />
        {(() => { const tA = base.reduce((a, r) => a + r.achieved, 0), tT = base.reduce((a, r) => a + r.target, 0); return (
          <div className="bullet-total"><span className="semi">Total da equipe</span><span className="num"><b>{brl0(tA)}</b> <span className="muted xs">/ {brl0(tT)}</span></span><b className={`num ${tA >= tT ? "green" : "red"}`}>{pct(tT ? (tA / tT) * 100 : 0)}</b></div>
        ); })()}
        <div className="chart-legend"><span><i className="sw sw-bar" /> Vendido</span><span><i className="sw sw-hit" /> Meta batida</span><span><i className="sw sw-goal-v" /> Meta</span></div>
      </Card>

      <div className="grid gd gd-21 mt">
        <Card id="rel-visitas" title="Visitas e conversão no mês" icon={<MapPin size={17} />}>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Vendedor</th><th className="r">Planejadas</th><th className="r">Realizadas</th><th>% realizadas</th><th className="r">Com pedido</th><th className="r">Sem venda</th><th className="r">Conversão</th></tr></thead>
              <tbody>
                {[...visits].sort((a, b) => b.v.pct - a.v.pct).map(({ s, v }) => (
                  <tr key={s.id} className="click" onClick={() => setOpen(s.id)}>
                    <td className="semi">{s.name}</td><td className="r">{v.planned}</td><td className="r">{v.done}</td>
                    <td style={{ minWidth: 130 }}><div className="progress-row"><Progress value={v.pct} color="green" /><b className="xs num">{pct(v.pct)}</b></div></td>
                    <td className="r">{v.withOrder}</td><td className="r red">{v.noSale}</td><td className="r bold num">{pct(v.conversion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Carteira por curva ABCD" icon={<PieChart size={17} />} sub="média mensal de compra">
          {curve.map((c) => (
            <div key={c.c} className="row click" onClick={() => setCurveOpen(c.c)}>
              <Curve c={c.c} />
              <div className="grow">
                <div className="flex between small"><span>{c.n} clientes</span><b className="num">{brl0(c.value)}</b></div>
                <div style={{ marginTop: 5 }}><Progress rel thin value={(c.value / curveMax) * 100} /></div>
              </div>
            </div>
          ))}
          <div className="xs muted mt">Faixas configuráveis: A ≥ R$ 3.000 · B ≥ R$ 1.600 · C ≥ R$ 800 · D abaixo.</div>
        </Card>
      </div>

      <p className="xs muted mt">Pedidos no período: {orders.length} registrados no sistema de demonstração. Dados fictícios.</p>
      {open && <SellerPanel id={open} onClose={() => setOpen(null)} />}
      {rank && <RankingSheet scope={scope} onClose={() => setRank(false)} />}
      {curveOpen && (
        <Sheet title={`Clientes curva ${curveOpen}`} onClose={() => setCurveOpen(null)} wide icon={<PieChart size={18} />}>
          <ClientList items={CUSTOMERS.filter((x) => scope.includes(x.sellerId) && x.abcd === curveOpen).map((c) => ({ c, days: c.lastPurchaseDate ? daysBetween(c.lastPurchaseDate, TODAY) : null }))} onOpen={setCurveCust} />
        </Sheet>
      )}
      {curveCust && <CustomerHistory id={curveCust} onClose={() => setCurveCust(null)} />}
    </>
  );
}

export function SellerPanel({ id, onClose }: { id: string; onClose: () => void }) {
  useStore();
  const s = sellerById.get(id)!;
  const g = sellerGoal(id);
  const daily = sellerDaily(id);
  const v = sellerMonthVisits(id);
  const orders = sellerMonthOrders(id);
  const noPurchase = customersWithoutPurchaseThisMonth(id).map((c) => ({ c, days: c.lastPurchaseDate ? daysBetween(c.lastPurchaseDate, TODAY) : null }))
    .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));
  const [bucket, setBucket] = useState<number | null>(null);
  const [order, setOrder] = useState<HistOrder | null>(null);
  const [cust, setCust] = useState<string | null>(null);
  const [buyersOpen, setBuyersOpen] = useState(false);
  const buckets = PARAMS.inactivity.dashboardBuckets;
  const shown = noPurchase.filter((x) => bucket === null || inactivityBucket(x.days, buckets) === bucket);
  const ordersTotal = orders.reduce((a, o) => a + o.totalCents, 0);
  return (
    <Sheet title={`${s.name} · vendeu ${pct(g.monthAttainmentPct)} da meta`} onClose={onClose} wide icon={<Users size={18} />}>
      <div className="grid g2 gd-4">
        <Kpi label="Meta do mês" value={brl0(g.monthlyGoalCents)} foot={`${s.region} · ver 12 meses`} onClick={() => scrollToId(`sp-year-${id}`)} />
        <Kpi label="Vendido no mês" tone="gold" value={brl0(g.achievedMonthCents)} onClick={() => scrollToId(`sp-orders-${id}`)}>
          <div className="progress-row"><Progress value={g.monthAttainmentPct} /><b className="num xs">{pct(g.monthAttainmentPct)}</b></div>
        </Kpi>
        <Kpi label="Falta" tone="info" value={brl0(g.missingMonthCents)} onClick={() => scrollToId(`sp-daily-${id}`)}
          foot={g.missingMonthCents <= 0 ? "meta do mês batida ✓" : g.remainingBusinessDays > 0
            ? `${brl0(g.requiredPerRemainingDayCents)}/dia × ${g.remainingBusinessDays} dia${g.remainingBusinessDays === 1 ? "" : "s"} út${g.remainingBusinessDays === 1 ? "il" : "eis"} = ${brl0(g.requiredPerRemainingDayCents * g.remainingBusinessDays)}`
            : "sem dias úteis restantes no mês"} />
        <Kpi label="Visitas / conversão" tone="success" value={`${v.done}/${v.planned}`} foot={`${pct(v.conversion)} viraram pedido · toque p/ ver clientes`} onClick={() => setBuyersOpen(true)} />
      </div>
      <Card id={`sp-daily-${id}`} title="Vendas por dia útil x meta diária · mês atual"><DailyChart data={daily} height={190} orders={orders} /></Card>
      <Card id={`sp-year-${id}`} title="Vendas x meta · últimos 12 meses" className="mt" sub="evolução e sazonalidade">
        <YearChart data={sellerYear(id)} />
        <YearSummary data={sellerYear(id)} />
      </Card>

      <Card id={`sp-orders-${id}`} title={`Pedidos do mês (${orders.length})`} icon={<FileText size={17} />} className="mt" sub={`total ${brl0(ordersTotal)} · toque para ver os itens`}>
        <div className="only-mobile order-cards">
          {orders.map((o) => <OrderBalloon key={o.id} o={o} onClick={() => setOrder(o)} />)}
        </div>
        <div className="table-wrap only-desktop" style={{ maxHeight: 420, overflowY: "auto" }}>
          <table className="t">
            <thead><tr><th>Data</th><th>Pedido</th><th>Nota fiscal</th><th>Cliente</th><th className="r">Valor</th><th className="r">Prazo</th><th>Status</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="click" onClick={() => setOrder(o)}>
                  <td>{o.createdAt ? fmtDateTime(o.createdAt) : fmtDate(o.date)}</td><td className="semi">{o.number}</td><td>{o.invoiceNumber ?? <span className="muted">sem NF</span>}</td>
                  <td><span className="flex" style={{ gap: 6 }}><Curve c={customerById.get(o.customerId)!.abcd} /> {customerById.get(o.customerId)?.tradeName}</span></td>
                  <td className="r num semi">{brl(o.totalCents)}</td><td className="r">{termShort(o.paymentTermDays)}</td>
                  <td><Badge tone={(ORDER_STATUS as unknown as Record<string, { tone: "neutral" }>)[o.status]?.tone ?? "neutral"}>{statusLabel(o.status)}</Badge></td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan={7} className="muted">Nenhum pedido no mês.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`Clientes sem compra no mês (${noPurchase.length})`} icon={<UserX size={17} />} className="mt" sub="toque no cliente para ver o histórico">
        <div className="chips mb">
          <Chip on={bucket === null} onClick={() => setBucket(null)}>Todos</Chip>
          {buckets.map((b) => <Chip key={b} on={bucket === b} onClick={() => setBucket(b)}>{bucketLabel(b, buckets)} ({noPurchase.filter((x) => inactivityBucket(x.days, buckets) === b).length})</Chip>)}
        </div>
        <ClientList items={shown} onOpen={setCust} />
      </Card>
      {order && <OrderDetail o={order} onClose={() => setOrder(null)} onCustomer={(cid) => { setOrder(null); setCust(cid); }} />}
      {buyersOpen && <BuyersSheet sellerId={id} onClose={() => setBuyersOpen(false)} onOpen={setCust} />}
      {cust && <CustomerHistory id={cust} onClose={() => setCust(null)} />}
    </Sheet>
  );
}

// ---------------------------------------------------------------- lista de clientes com ordenação e filtros
type ClientItem = { c: (typeof CUSTOMERS)[number]; days: number | null };
const SORTS: { id: string; label: string; cmp: (a: ClientItem, b: ClientItem) => number }[] = [
  { id: "days", label: "Dias sem compra", cmp: (a, b) => (b.days ?? 9999) - (a.days ?? 9999) },
  { id: "curve", label: "Curva A→D", cmp: (a, b) => a.c.abcd.localeCompare(b.c.abcd) || (b.days ?? 9999) - (a.days ?? 9999) },
  { id: "route", label: "Rota", cmp: (a, b) => a.c.routeCode.localeCompare(b.c.routeCode, "pt-BR", { numeric: true }) || a.c.tradeName.localeCompare(b.c.tradeName, "pt-BR") },
  { id: "name", label: "Nome A→Z", cmp: (a, b) => a.c.tradeName.localeCompare(b.c.tradeName, "pt-BR") },
  { id: "avg", label: "Maior média", cmp: (a, b) => b.c.avgMonthlyCents - a.c.avgMonthlyCents },
];
const routeName = (code: string) => PARAMS.commercialRoutes.find((r) => r.code === code)?.name ?? code;

export function ClientList({ items, onOpen, showDays = true }: { items: ClientItem[]; onOpen: (id: string) => void; showDays?: boolean }) {
  const [sort, setSort] = useState(showDays ? "days" : "name");
  const [curve, setCurve] = useState<string | null>(null);
  const [route, setRoute] = useState<string>("");
  const [q, setQ] = useState("");
  const routes = [...new Set(items.map((x) => x.c.routeCode))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const sorts = SORTS.filter((x) => showDays || x.id !== "days");
  const cmp = (sorts.find((x) => x.id === sort) ?? sorts[0]!).cmp;
  const list = items.filter((x) => (!curve || x.c.abcd === curve) && (!route || x.c.routeCode === route) && matchCustomer(x.c, q)).sort(cmp);
  return (
    <>
      <SearchBox value={q} onChange={setQ} />
      <div className="filter-box">
        <div className="filter-row">
          <label className="filter-f"><span>Ordenar por</span>
            <select className="input input-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar por">
              {sorts.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          <label className="filter-f"><span>Rota</span>
            <select className="input input-sm" value={route} onChange={(e) => setRoute(e.target.value)} aria-label="Rota">
              <option value="">Todas as rotas</option>
              {routes.map((r) => <option key={r} value={r}>{routeName(r)} ({items.filter((x) => x.c.routeCode === r).length})</option>)}
            </select>
          </label>
        </div>
        <div className="filter-f"><span>Curva</span>
          <div className="seg-curve" role="radiogroup" aria-label="Curva">
            <button className={!curve ? "on" : ""} onClick={() => setCurve(null)}>Todas</button>
            {["A", "B", "C", "D"].map((k) => <button key={k} className={curve === k ? "on" : ""} onClick={() => setCurve(curve === k ? null : k)}>{k} <small>{items.filter((x) => x.c.abcd === k).length}</small></button>)}
          </div>
        </div>
      </div>
      <div className="xs muted mb">{list.length} cliente(s)</div>
      <div className="table-wrap" style={{ maxHeight: 420, overflowY: "auto" }}>
        <table className="t">
          <thead><tr><th>Cliente</th><th>Curva</th><th>Rota</th><th>Última compra</th>{showDays && <th className="r">Dias sem compra</th>}<th className="r">Média mensal</th><th className="r">Freezers</th><th>Contato</th></tr></thead>
          <tbody>
            {list.map(({ c, days }) => (
              <tr key={c.id} className="click" onClick={() => onOpen(c.id)}>
                <td><div className="semi">{c.tradeName}</div><div className="xs muted">{c.code} · {c.district}</div></td>
                <td><Curve c={c.abcd} /></td><td>{routeName(c.routeCode)}</td>
                <td>{fmtDate(c.lastPurchaseDate)}</td>
                {showDays && <td className={`r bold num ${days === null || days >= 28 ? "red" : days >= 14 ? "gold" : ""}`}>{days ?? "nunca"}</td>}
                <td className="r num">{brl0(c.avgMonthlyCents)}</td><td className="r">{c.assets.length}</td><td className="small">{c.whatsapp}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={8} className="muted">Nenhum cliente neste filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Carteira do vendedor no mês: com compra de um lado, sem compra do outro. */
function BuyersSheet({ sellerId, onClose, onOpen }: { sellerId: string; onClose: () => void; onOpen: (id: string) => void }) {
  const without = new Set(customersWithoutPurchaseThisMonth(sellerId).map((c) => c.id));
  const mine = CUSTOMERS.filter((c) => c.sellerId === sellerId);
  const toItem = (c: (typeof CUSTOMERS)[number]): ClientItem => ({ c, days: c.lastPurchaseDate ? daysBetween(c.lastPurchaseDate, TODAY) : null });
  const withBuy = mine.filter((c) => !without.has(c.id)).map(toItem);
  const noBuy = mine.filter((c) => without.has(c.id)).map(toItem);
  const [side, setSide] = useState<"with" | "without">("with");
  return (
    <Sheet title={`Clientes no mês · ${sellerById.get(sellerId)?.name}`} onClose={onClose} wide icon={<Users size={18} />}>
      <div className="grid g2">
        <Kpi label="Com compra no mês" tone="success" value={withBuy.length} foot={`${pct(mine.length ? (withBuy.length / mine.length) * 100 : 0)} da carteira`} onClick={() => setSide("with")} />
        <Kpi label="Sem compra no mês" tone="red" value={noBuy.length} foot="toque para ver" onClick={() => setSide("without")} />
      </div>
      <div className="split-2">
        <Card title={`Com compra (${withBuy.length})`} className={side === "with" ? "" : "hide-mobile"}>
          <ClientList items={withBuy} onOpen={onOpen} showDays={false} />
        </Card>
        <Card title={`Sem compra (${noBuy.length})`} className={side === "without" ? "" : "hide-mobile"}>
          <ClientList items={noBuy} onOpen={onOpen} />
        </Card>
      </div>
    </Sheet>
  );
}

export function OrderDetail({ o, onClose, onCustomer, actions }: { o: HistOrder; onClose: () => void; onCustomer?: (id: string) => void; actions?: React.ReactNode }) {
  const c = customerById.get(o.customerId)!;
  const days = c.lastPurchaseDate ? daysBetween(c.lastPurchaseDate, TODAY) : null;
  return (
    <Sheet title={`${o.number}${o.invoiceNumber ? ` · ${o.invoiceNumber}` : ""}`} onClose={onClose} icon={<FileText size={18} />}>
      <Card>
        <dl className="kv">
          <dt>Cliente</dt><dd>{onCustomer ? <button className="linkbtn" onClick={() => onCustomer(c.id)}>{c.tradeName}</button> : c.tradeName}</dd>
          <dt>Código / CNPJ</dt><dd>{c.code} · {c.document}</dd>
          <dt>Vendedor</dt><dd>{sellerById.get(o.sellerId)?.name}</dd>
          <dt>Emitido em</dt><dd>{o.createdAt ? fmtDateTime(o.createdAt) : fmtDate(o.date)}</dd>
          <dt>Nota fiscal</dt><dd>{o.fiscalDoc === "sem_nf" ? "Sem nota fiscal (escolha do vendedor)" : o.invoiceNumber ?? (o.fiscalDoc === "com_nf" ? "Com nota · a emitir no faturamento" : "Sem NF")}</dd>
          <dt>Condição</dt><dd>{termLabel(o.paymentTermDays)}</dd>
          <dt>Status</dt><dd>{orderStatusText(o)}</dd>
          <dt>Cliente sem compra há</dt><dd>{days === null ? "—" : `${days} dia(s)`} · curva {c.abcd}</dd>
        </dl>
        {onCustomer && <button className="btn btn-soft btn-sm btn-block mt" onClick={() => onCustomer(c.id)}><History size={14} /> Ver histórico de compras do cliente</button>}
      </Card>
      {o.status !== "cancelled" ? <OrderSteps status={o.status} /> : <div className="mt"><Badge tone="neutral">Pedido cancelado</Badge></div>}
      <PdfButtons o={o} />
      {actions}
      {o.log && o.log.length > 0 && (
        <Card title="Linha do tempo" className="mt" sub="hora de cada etapa">
          <div className="timeline">
            {[...o.log].reverse().map((e, i) => (
              <div key={i} className={`tl-item ${i === 0 ? "" : "done"}`}>
                <div className="flex between wrap" style={{ gap: 6 }}><span className="semi">{e.text}</span><span className="small num">{fmtDateTime(e.at)}</span></div>
                <div className="xs muted">{e.by}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card title="Itens" className="mt">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Código</th><th>Produto</th><th className="r">Qtd</th><th className="r">Unitário</th><th className="r">Total</th></tr></thead>
            <tbody>
              {o.items.map((it, i) => {
                const p = PRODUCTS.find((x) => x.id === it.productId)!;
                return (
                  <tr key={i}>
                    <td className="small">{p.code}</td>
                    <td><div className="semi">{p.commercialName}</div><div className="xs muted">{p.packaging}</div></td>
                    <td className="r">{it.qty}</td><td className="r num">{brl(it.unitPriceCents)}</td><td className="r num semi">{brl(it.qty * it.unitPriceCents)}</td>
                  </tr>
                );
              })}
              <tr><td colSpan={4} className="r bold">Total</td><td className="r num bold">{brl(o.totalCents)}</td></tr>
            </tbody>
          </table>
        </div>
      </Card>
    </Sheet>
  );
}

export function CustomerHistory({ id, onClose }: { id: string; onClose: () => void }) {
  const c = customerById.get(id)!;
  const orders = customerOrders(id);
  const [order, setOrder] = useState<HistOrder | null>(null);
  const days = c.lastPurchaseDate ? daysBetween(c.lastPurchaseDate, TODAY) : null;
  const fin = financial(c);
  const months = [...c.monthlyHistoryCents.map((v, i) => ({ label: monthLabel(c.monthlyHistoryCents.length - i), key: monthKey(c.monthlyHistoryCents.length - i), v })),
    { label: "Atual", key: TODAY.slice(0, 7), v: orders.filter((o) => o.date >= monthBounds(TODAY).first).reduce((a, o) => a + o.totalCents, 0) }]
    .map((m) => ({ ...m, n: orders.filter((o) => o.date.startsWith(m.key)).length }));
  const max = Math.max(...months.map((m) => m.v)) || 1;
  const [sel, setSel] = useState<string | null>(null);
  const selM = months.find((m) => m.key === sel);
  const shown = sel ? orders.filter((o) => o.date.slice(0, 7) === sel) : orders;
  const pick = (k: string) => { setSel(sel === k ? null : k); setTimeout(() => scrollToId("hist-pedidos"), 60); };
  return (
    <Sheet title={`${c.tradeName} · histórico de compras`} onClose={onClose} wide icon={<History size={18} />}>
      <div className="grid g2 gd-4">
        <Kpi label="Dias sem compra" tone={days === null || days >= 28 ? "red" : "gold"} value={days ?? "nunca"} foot={`última: ${fmtDate(c.lastPurchaseDate)} · ${brl0(c.lastPurchaseCents)}`} />
        <Kpi label="Média mensal" value={brl0(c.avgMonthlyCents)} foot={<>curva <Curve c={c.abcd} /></>} />
        <Kpi label="Financeiro" tone="info" value={brl0(fin.openCents)} foot={fin.overdueCents ? `vencido ${brl0(fin.overdueCents)}` : "sem vencidos"} />
        <Kpi label="Freezers" tone="success" value={c.assets.length} foot={`${sellerById.get(c.sellerId)?.name} · ${PARAMS.commercialRoutes.find((r) => r.code === c.routeCode)?.name}`} />
      </div>
      <Card title="Compras por mês" sub="toque no mês para ver os pedidos">
        <div className="month-bars">
          {months.map((m) => (
            <div key={m.label} className={`month-bar click ${sel === m.key ? "sel" : ""} ${sel && sel !== m.key ? "dim" : ""}`} role="button" onClick={() => pick(m.key)} title={`${m.label}: ${brl0(m.v)}`}>
              <span className="num mb-val">{m.v ? brl0(m.v) : "–"}</span>
              <i style={{ height: `${Math.max(2, (m.v / max) * 100)}%` }} className={m.label === "Atual" ? "now" : ""}>
                {m.n > 0 && <b className="mb-count">{m.n}<small>{m.n === 1 ? "pedido" : "pedidos"}</small></b>}
              </i>
              <span className="mb-label">{m.label === "Atual" ? "mês atual" : m.label}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card id="hist-pedidos" title={selM ? `Pedidos de ${selM.label === "Atual" ? "este mês" : selM.label} (${shown.length})` : `Pedidos (${orders.length})`} className="mt" sub={selM ? `total ${brl0(shown.reduce((a, o) => a + o.totalCents, 0))}` : "toque no pedido para ver os itens da nota"}
        link={sel ? "Ver todos" : undefined} onLink={() => setSel(null)}>
        <div className="only-mobile order-cards">
          {shown.map((o) => <OrderBalloon key={o.id} o={o} hideCustomer onClick={() => setOrder(o)} />)}
          {!orders.length && <div className="small muted">Nenhuma compra registrada · cliente ainda não comprou.</div>}
        </div>
        <div className="table-wrap only-desktop" style={{ maxHeight: 380, overflowY: "auto" }}>
          <table className="t">
            <thead><tr><th>Data</th><th>Pedido</th><th>Nota fiscal</th><th className="r">Valor</th><th className="r">Prazo</th><th className="r">Itens</th><th>Status</th></tr></thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} className="click" onClick={() => setOrder(o)}>
                  <td>{o.createdAt ? fmtDateTime(o.createdAt) : fmtDate(o.date)}</td><td className="semi">{o.number}</td><td>{o.invoiceNumber ?? <span className="muted">sem NF</span>}</td>
                  <td className="r num semi">{brl(o.totalCents)}</td><td className="r">{termShort(o.paymentTermDays)}</td><td className="r">{o.items.length}</td>
                  <td>{statusLabel(o.status)}</td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan={7} className="muted">Nenhuma compra registrada · cliente ainda não comprou.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt"><VisitHistoryCard customerId={id} /></div>
      <div className="small t2 mt">{c.address} — {c.district}, {c.city}/{c.state} · {c.buyerName} · {c.whatsapp}</div>
      {order && <OrderDetail o={order} onClose={() => setOrder(null)} />}
    </Sheet>
  );
}

function monthKey(back: number) {
  const d = new Date(`${monthBounds(TODAY).first}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - back);
  return d.toISOString().slice(0, 7);
}

function monthLabel(back: number) {
  const d = new Date(`${monthBounds(TODAY).first}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - back);
  return d.toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
}

/** Ranking completo com linha de total (abre ao clicar no ranking). */
export function RankingSheet({ scope, onClose, initial = "month" }: { scope: string[]; onClose: () => void; initial?: "month" | "day" }) {
  useStore();
  const [period, setPeriod] = useState<"month" | "day">(initial);
  const [open, setOpen] = useState<string | null>(null);
  const rows = SELLERS.filter((s) => scope.includes(s.id)).map((s) => {
    const g = sellerGoal(s.id);
    const achieved = period === "month" ? g.achievedMonthCents : g.achievedTodayCents;
    const target = period === "month" ? g.monthlyGoalCents : g.dailyGoalCents;
    return { id: s.id, name: s.name, achieved, target };
  });
  const ranked = rankByAttainment(rows);
  const tA = rows.reduce((a, r) => a + r.achieved, 0), tT = rows.reduce((a, r) => a + r.target, 0);
  return (
    <Sheet title="Ranking de vendas" onClose={onClose} wide icon={<Target size={18} />}>
      <div className="chips mb">
        <Chip on={period === "month"} onClick={() => setPeriod("month")}>Meta do mês</Chip>
        <Chip on={period === "day"} onClick={() => setPeriod("day")}>Meta do dia</Chip>
        <span className="xs muted" style={{ alignSelf: "center" }}>Ordenado por % de cumprimento da meta · toque no vendedor</span>
      </div>
      <Card>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>#</th><th>Vendedor</th><th className="r">Vendido</th><th className="r">Meta</th><th>% da meta</th><th className="r">Falta</th></tr></thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.id} className="click" onClick={() => setOpen(r.id)}>
                  <td><span className={`pos p${r.position}`}>{r.position}º</span></td>
                  <td className="semi">{r.name}</td>
                  <td className="r num semi">{brl0(r.achieved)}</td><td className="r num">{brl0(r.target)}</td>
                  <td style={{ minWidth: 160 }}><div className="progress-row"><Progress value={r.attainmentPct ?? 0} color={(r.attainmentPct ?? 0) >= 100 ? "green" : undefined} /><b className="num xs">{pct(r.attainmentPct ?? 0)}</b></div></td>
                  <td className="r num red">{brl0(r.pending)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td></td><td className="bold">Total da equipe</td>
                <td className="r num bold">{brl0(tA)}</td><td className="r num bold">{brl0(tT)}</td>
                <td><div className="progress-row"><Progress value={tT ? (tA / tT) * 100 : 0} color="red" /><b className="num xs">{pct(tT ? (tA / tT) * 100 : 0)}</b></div></td>
                <td className="r num bold red">{brl0(Math.max(0, tT - tA))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      {open && <SellerPanel id={open} onClose={() => setOpen(null)} />}
    </Sheet>
  );
}

function OrderBalloon({ o, onClick, hideCustomer }: { o: HistOrder; onClick: () => void; hideCustomer?: boolean }) {
  const c = customerById.get(o.customerId)!;
  return (
    <button className="order-balloon" onClick={onClick}>
      <div className="flex between"><b>{o.number}</b><b className="num">{brl(o.totalCents)}</b></div>
      {!hideCustomer && <div className="flex" style={{ gap: 6, marginTop: 4 }}><Curve c={c.abcd} /><span className="semi small">{c.tradeName}</span></div>}
      <div className="flex between xs muted" style={{ marginTop: 4 }}>
        <span>{o.createdAt ? fmtDateTime(o.createdAt) : fmtDate(o.date)} · {o.invoiceNumber ?? "sem NF"} · {o.items.length} itens · {termShort(o.paymentTermDays)}</span>
        <span>{statusLabel(o.status)}</span>
      </div>
    </button>
  );
}

const STEPS: { label: string; statuses: string[] }[] = [
  { label: "Pedido", statuses: ["draft"] },
  { label: "Crédito", statuses: ["awaiting_credit_review", "in_approval", "blocked"] },
  { label: "Liberado", statuses: ["credit_approved", "scheduled_for_billing", "sent_to_billing", "billing_in_progress", "billing_error"] },
  { label: "Faturado", statuses: ["invoiced"] },
  { label: "Em rota", statuses: ["in_delivery_route", "in_transit"] },
  { label: "Entregue", statuses: ["delivered", "completed"] },
];
function OrderSteps({ status }: { status: string }) {
  const idx = Math.max(0, STEPS.findIndex((s) => s.statuses.includes(status)));
  const problem = status === "blocked";
  return (
    <div className="steps mt">
      {STEPS.map((s, i) => (
        <div key={s.label} className={`step-item ${i < idx || status === "completed" || status === "delivered" ? "done" : i === idx ? (problem ? "bad" : "now") : ""}`}>
          <span className="dot" /><span className="xs">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Compartilhar / baixar o PDF do pedido (logo e moldura da Galato). */
export function PdfButtons({ o }: { o: HistOrder & { kind?: string } }) {
  const [busy, setBusy] = useState(false);
  const go = async (modo: "share" | "download") => {
    setBusy(true);
    try {
      const { compartilharPdf } = await import("../utils/pedido-pdf");
      const r = await compartilharPdf(o, modo);
      if (r === "downloaded") toast("PDF do pedido baixado", "success");
    } catch { toast("Não foi possível gerar o PDF", "danger"); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid g2 mt" style={{ marginBottom: 0 }}>
      <button className="btn btn-gold" disabled={busy} data-instant="" onClick={() => go("share")}><Share2 size={16} /> {busy ? "Gerando…" : "Compartilhar PDF"}</button>
      <button className="btn btn-ghost" disabled={busy} data-instant="" onClick={() => go("download")}><Download size={16} /> Baixar PDF</button>
    </div>
  );
}
