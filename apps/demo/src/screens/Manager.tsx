/** Gestão comercial (gerente geral, gerente, coordenador) — desktop-first, responsivo. */
import { useState } from "react";
import {
  LayoutDashboard, TrendingUp, MapPin, UserX, Truck, Wallet, Snowflake, Briefcase, MoreHorizontal, Crown, Target,
  BarChart3, AlertTriangle, Trophy, Receipt, ClipboardList, Clock, ArrowRightLeft, CalendarRange, Check, X as XIcon,
} from "lucide-react";
import { bucketLabel, PAYMENT_REQUEST_STATUS, type AbcdClass } from "@galato/domain";
import { PARAMS, SELLERS, CUSTOMERS, MANAGERS, TODAY, customerById, sellerById, TRANSFER_REQUESTS, TEMP_ACCESS, type Customer, type Role } from "../data/mock";
import { notify } from "../data/notify";
import { ReportsView, RankingSheet, SellerPanel } from "./Reports";
import { RouteDetail, ChecklistSummary } from "./Ops";
import { CHECKINS, PAYMENT_REQUESTS, NONCONFORMITIES, VEHICLES, type DeliveryRoute, type PaymentRequest } from "../data/mock";
import {
  teamGoal, sellerGoal, salesRanking, visitsRanking, visitsTotal, logisticsOverview, financeQueue, assetsOverview,
  inactiveTotals, ordersOf, countByStatus, AWAITING_CREDIT, IN_BILLING, IN_ROUTE, termKpi, customerRow, dayLabel,
  yesterdaySummary,
} from "../data/selectors";
import { DRIVERS, DELIVERY_ROUTES, YESTERDAY_ROUTE, type YesterdayDelivery } from "../data/mock";
import { History, CheckCircle2, XCircle, CalendarClock, ChevronRight, Package } from "lucide-react";
import { filterCustomers } from "@galato/domain";
import { commit, useStore } from "../data/store";
import { Shell, Greeting, ProfilePanel } from "../components/shell";
import { Card, Kpi, Ring, Sheet, brl, brl0, pct, Chip, Badge, Progress, RankingList } from "../components/ui";
import { CustomerSheet, CustomerTable, fmtDate } from "../components/business";

const ROLE_INFO: Partial<Record<Role, { label: string; name: string }>> = {
  general_manager: { label: "Gerente geral", name: "Paulo Henrique Lopes" },
  sales_coordinator: { label: "Coordenador comercial", name: "Ricardo Nunes" },
  sales_manager: { label: "Gerente comercial", name: MANAGERS[0]!.name },
};

export function ManagerApp({ role }: { role: Role }) {
  const [tab, setTab] = useState("home");
  const [open, setOpen] = useState<Customer | null>(null);
  useStore();
  const info = ROLE_INFO[role]!;
  // gerente comercial vê só a própria equipe; coordenação/gerente geral veem tudo
  const scope = role === "sales_manager" ? SELLERS.filter((s) => s.managerId === "m1").map((s) => s.id) : SELLERS.map((s) => s.id);
  const fq = financeQueue();
  const tabs = [
    { id: "home", label: "Início", icon: <LayoutDashboard size={20} /> },
    { id: "sales", label: "Metas", icon: <TrendingUp size={20} /> },
    { id: "visits", label: "Visitas", icon: <MapPin size={20} /> },
    { id: "deliveries", label: "Entregas", icon: <Truck size={20} /> },
    { id: "more", label: "Mais", icon: <MoreHorizontal size={20} /> },
    { id: "reports", label: "Relatórios", icon: <BarChart3 size={20} /> },
    { id: "inactive", label: "Clientes sem compra", icon: <UserX size={20} /> },
    { id: "finance", label: "Financeiro", icon: <Wallet size={20} />, count: fq.breached },
    { id: "assets", label: "Ativos / freezers", icon: <Snowflake size={20} /> },
    { id: "portfolio", label: "Carteiras", icon: <Briefcase size={20} />, count: TRANSFER_REQUESTS.filter((r) => r.status === "pending").length },
  ];
  return (
    <Shell tabs={tabs} tab={tab} onTab={setTab} roleLabel={info.label} userName={info.name}>
      {tab === "home" && <ManagerHome scope={scope} role={role} info={info} goTab={setTab} />}
      {tab === "sales" && <SalesView scope={scope} />}
      {tab === "reports" && <ReportsView scope={scope} />}
      {tab === "visits" && <VisitsView scope={scope} />}
      {tab === "inactive" && <InactiveView scope={scope} onOpen={setOpen} />}
      {tab === "deliveries" && <DeliveriesView />}
      {tab === "finance" && <FinanceView />}
      {tab === "assets" && <AssetsView scope={scope} onOpen={setOpen} />}
      {tab === "portfolio" && <PortfolioView />}
      {tab === "more" && (
        <div className="stack">
          <div className="grid g2 only-mobile" style={{ marginBottom: 0 }}>
            {tabs.slice(5).map((t) => <button key={t.id} className="action-tile" onClick={() => setTab(t.id)}><span className="ic">{t.icon}</span>{t.label}</button>)}
          </div>
          <ProfilePanel name={info.name} role={info.label} />
        </div>
      )}
      {open && <CustomerSheet c={open} onClose={() => setOpen(null)} />}
    </Shell>
  );
}

function ManagerHome({ scope, role, info, goTab }: { scope: string[]; role: Role; info: { label: string; name: string }; goTab: (t: string) => void }) {
  const g = teamGoal(scope);
  const vt = visitsTotal();
  const log = logisticsOverview();
  const fq = financeQueue();
  const assets = assetsOverview(scope);
  const inactive = inactiveTotals(scope);
  const orders = ordersOf().filter((o) => scope.includes(o.sellerId));
  const term = termKpi();
  const [rankMode, setRankMode] = useState<"day" | "month">("day");
  const ranking = salesRanking(rankMode).filter((r) => scope.includes(r.id));
  const vr = visitsRanking().filter((r) => scope.includes(r.id));
  const vPlanned = vr.reduce((a, r) => a + r.target, 0), vDone = vr.reduce((a, r) => a + r.achieved, 0);
  const [drill, setDrill] = useState<null | "visits" | "deliveries">(null);
  const [rankOpen, setRankOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState<DeliveryRoute | null>(null);
  const [sellerOpen, setSellerOpen] = useState<string | null>(null);
  const alerts: { tone: "danger" | "warning"; text: string; tab: string }[] = [
    ...ranking.filter((r) => (r.attainmentPct ?? 0) < 70).map((r) => ({ tone: "danger" as const, text: `${r.name} em ${pct(r.attainmentPct ?? 0)} da meta ${rankMode === "day" ? "do dia" : "do mês"}`, tab: "sales" })),
    ...(fq.breached ? [{ tone: "danger" as const, text: `${fq.breached} solicitações financeiras sem resposta há +${PARAMS.financialSla.responseHours}h`, tab: "finance" }] : []),
    ...log.alerts.slice(0, 3).map((a) => ({ ...a, tab: "deliveries" })),
    { tone: "warning", text: `${countByStatus(orders, ["blocked"])} pedidos bloqueados por crédito`, tab: "finance" },
    { tone: "warning", text: `${assets.idleCount} freezers sem giro (${brl0(assets.idleValue)})`, tab: "assets" },
  ];

  return (
    <>
      <Greeting icon={<Crown size={22} />} title={`Olá, ${info.name.split(" ")[0]}!`} sub={`${info.label} · ${role === "sales_manager" ? "sua equipe" : "visão executiva da operação"}`} />

      <div className="grid g2 gd-4">
        <Kpi icon={<Target size={17} />} label="Meta do dia" value={brl0(g.dailyGoalCents)}>
          <div className="progress-row"><Progress value={g.dayAttainmentPct} /><b className="num xs">{pct(g.dayAttainmentPct)}</b></div>
          <div className="kpi-foot">Realizado {brl0(g.achievedTodayCents)} · falta {brl0(g.missingTodayCents)}</div>
        </Kpi>
        <Kpi icon={<BarChart3 size={17} />} tone="gold" label="Vendas do mês" value={brl0(g.achievedMonthCents)}>
          <div className="progress-row"><Progress value={g.monthAttainmentPct} color="red" /><b className="num xs">{pct(g.monthAttainmentPct)}</b></div>
          <div className="kpi-foot">Meta {brl0(g.monthlyGoalCents)} · {g.remainingBusinessDays} {g.remainingBusinessDays === 1 ? "dia útil restante" : "dias úteis rest."}</div>
        </Kpi>
        <Kpi icon={<MapPin size={17} />} tone="info" label="Visitas do dia" value={<>{vDone} <small>/ {vPlanned}</small></>} onClick={() => setDrill("visits")}>
          <div className="progress-row"><Progress value={(vDone / vPlanned) * 100} color="green" /><b className="num xs">{pct((vDone / vPlanned) * 100)}</b></div>
          <div className="kpi-foot">Check-in conta como visita · toque p/ detalhar</div>
        </Kpi>
        <Kpi icon={<Truck size={17} />} tone="success" label="Entregas do dia" value={<>{log.delivered} <small>/ {log.total}</small></>} onClick={() => setDrill("deliveries")}>
          <div className="progress-row"><Progress value={log.pct} color="green" /><b className="num xs">{pct(log.pct)}</b></div>
          <div className="kpi-foot">{log.pending} pendentes · {log.failed} não realizadas</div>
        </Kpi>
      </div>

      <YesterdayCard scope={scope} />

      <div className="grid gd gd-21">
        <Card title="Ranking por vendedor" icon={<Trophy size={17} />} sub="ordenado por % da meta" link="Ver ranking completo" onLink={() => setRankOpen(true)}>
          <div className="chips mb">
            <Chip on={rankMode === "day"} onClick={() => setRankMode("day")}>Meta do dia</Chip>
            <Chip on={rankMode === "month"} onClick={() => setRankMode("month")}>Meta do mês</Chip>
          </div>
          <RankingList rows={ranking} format={(r) => `${brl0(r.achieved)} / ${brl0(r.target)}`} onRow={setSellerOpen} />
          {(() => { const tA = ranking.reduce((a, r) => a + r.achieved, 0), tT = ranking.reduce((a, r) => a + r.target, 0); return (
            <div className="bullet-total" style={{ cursor: "pointer" }} onClick={() => setRankOpen(true)}><span className="semi">Total da equipe</span><span className="num"><b>{brl0(tA)}</b> <span className="muted xs">/ {brl0(tT)}</span></span><b className={`num ${tA >= tT ? "green" : "red"}`}>{pct(tT ? (tA / tT) * 100 : 0)}</b></div>
          ); })()}
        </Card>
        <Card title={`Exceções e alertas (${alerts.length})`} icon={<AlertTriangle size={17} />}>
          {alerts.map((a, i) => (
            <div key={i} className="alert-line click" style={{ cursor: "pointer" }} onClick={() => goTab(a.tab)}>
              <span className="dotc" style={{ background: a.tone === "danger" ? "var(--danger)" : "var(--gold)" }} />{a.text}
            </div>
          ))}
        </Card>
      </div>

      <div className="grid gd gd-3">
        <Card title="Ranking de visitas" icon={<MapPin size={17} />} sub="% realizadas/planejadas" link="Ver" onLink={() => goTab("visits")}>
          <RankingList rows={vr} format={(r) => `${r.achieved}/${r.target} visitas`} />
        </Card>
        <Card title="Clientes sem compra" icon={<UserX size={17} />} link="Filtrar" onLink={() => goTab("inactive")}>
          <div className="buckets">
            {inactive.map((b, i) => (
              <div key={b.bucket} className={`bucket b${i}`} onClick={() => goTab("inactive")}><span>{bucketLabel(b.bucket, PARAMS.inactivity.dashboardBuckets)}</span><b className="num">{b.count}</b></div>
            ))}
          </div>
          <div className="divider" />
          <dl className="kv">
            <dt>Prazo médio vendido</dt><dd>{term.avg.toFixed(1)} dias</dd>
            <dt>Prazo acima do recomendado</dt><dd className="gold">{term.longer} pedidos</dd>
            <dt>Ticket médio</dt><dd className="num">{brl(Math.round(g.achievedMonthCents / SELLERS.filter((s) => scope.includes(s.id)).reduce((a, s) => a + s.ordersMonth, 0)))}</dd>
          </dl>
        </Card>
        <Card title="Financeiro" icon={<Receipt size={17} />} link="Ver fila" onLink={() => goTab("finance")}>
          <div className="grid g3" style={{ marginBottom: 10 }}>
            <MiniStat label="Pendentes" n={fq.queue.length} />
            <MiniStat label={`> ${PARAMS.financialSla.responseHours}h`} n={fq.breached} danger />
            <MiniStat label="Do dia anterior" n={fq.carryOver} />
          </div>
          <div className="list">
            {fq.queue.slice(0, 3).map((p) => (
              <div key={p.id} className="row">
                <Badge tone={p.method === "PIX" ? "brand" : "info"}>{p.method}</Badge>
                <div className="grow"><div className="title small">{customerById.get(p.customerId)?.tradeName}</div><div className="sub">{sellerById.get(p.sellerId)?.name}</div></div>
                <Badge tone={p.sla.level === "breached" ? "danger" : p.sla.level === "warning" ? "warning" : "neutral"}>{Math.floor(p.sla.elapsedHours)}h</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gd gd-3">
        <Card title="Pipeline de pedidos" icon={<ClipboardList size={17} />}>
          {[
            ["Aguardando crédito", countByStatus(orders, AWAITING_CREDIT), "warning"],
            ["Em faturamento", countByStatus(orders, IN_BILLING), "info"],
            ["Faturados", countByStatus(orders, ["invoiced"]), "success"],
            ["Em rota / trânsito", countByStatus(orders, IN_ROUTE), "brand"],
            ["Erro de faturamento", countByStatus(orders, ["billing_error"]), "danger"],
          ].map(([l, n, t]) => (
            <div key={l as string} className="row"><span className="grow">{l}</span><Badge tone={t as never}>{n as number}</Badge></div>
          ))}
        </Card>
        <Card title="Ativos na rua" icon={<Snowflake size={17} />} link="Ver" onLink={() => goTab("assets")}>
          <div className="flex" style={{ gap: 16 }}>
            <Ring value={(1 - assets.idleCount / Math.max(1, assets.onStreet)) * 100} size={96} stroke={10} label={assets.onStreet} sub="freezers" />
            <dl className="kv" style={{ flex: 1 }}>
              <dt>Valor na rua</dt><dd className="num">{brl0(assets.valueOnStreet)}</dd>
              <dt>Sem giro</dt><dd className="red">{assets.idleCount}</dd>
              <dt>Valor parado</dt><dd className="num red">{brl0(assets.idleValue)}</dd>
            </dl>
          </div>
        </Card>
        <Card title="Logística agora" icon={<Truck size={17} />} link="Ver" onLink={() => goTab("deliveries")}>
          {log.routes.slice(0, 4).map(({ r, p, driver }) => (
            <div key={r.id} className="row click" onClick={() => setRouteOpen(r)}>
              <div className="grow"><div className="title small">{r.name}</div><div className="sub">{driver.name.split(" ")[0]} · {p.status}</div>
                <div className="mt" style={{ marginTop: 4 }}><Progress thin value={p.pct} color="green" /></div></div>
              <div className="end num semi small">{p.delivered}/{p.total}</div>
            </div>
          ))}
        </Card>
      </div>

      {routeOpen && <RouteDetail r={routeOpen} onClose={() => setRouteOpen(null)} />}
      {rankOpen && <RankingSheet scope={scope} initial={rankMode} onClose={() => setRankOpen(false)} />}
      {sellerOpen && <SellerPanel id={sellerOpen} onClose={() => setSellerOpen(null)} />}
      {drill === "visits" && (
        <Sheet title={`Visitas do dia · ${dayLabel(TODAY)}`} onClose={() => setDrill(null)} wide><VisitsTable scope={scope} /></Sheet>
      )}
      {drill === "deliveries" && (
        <Sheet title="Entregas do dia por rota" onClose={() => setDrill(null)} wide><DeliveriesTable /></Sheet>
      )}
    </>
  );
}

function MiniStat({ label, n, danger }: { label: string; n: number; danger?: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: 8, borderRadius: 12, background: danger && n ? "var(--danger-soft)" : "var(--neutral-soft)" }}>
      <b className={`num ${danger && n ? "red" : ""}`} style={{ fontSize: 20 }}>{n}</b>
      <div className="xs muted">{label}</div>
    </div>
  );
}

function SalesView({ scope }: { scope: string[] }) {
  const rows = salesRanking("month").filter((r) => scope.includes(r.id));
  const [open, setOpen] = useState<string | null>(null);
  const g = teamGoal(scope);
  return (
    <>
      <h2 style={{ margin: "6px 0 4px" }}>Metas e ranking proporcional</h2>
      <p className="small muted mb">Meta diária = meta mensal ÷ {g.businessDaysInMonth} dias úteis. Ranking pelo % de atingimento, nunca pelo valor absoluto.</p>
      <div className="grid g2 gd-4">
        <Kpi label="Meta mensal (equipe)" value={brl0(g.monthlyGoalCents)} foot={`${g.businessDaysInMonth} dias úteis no mês`} />
        <Kpi label="Realizado no mês" tone="gold" value={brl0(g.achievedMonthCents)} foot={pct(g.monthAttainmentPct, 1)} />
        <Kpi label="Falta" tone="info" value={brl0(g.missingMonthCents)} foot={`${g.remainingBusinessDays} dia(s) útil(eis) restante(s)`} />
        <Kpi label="Necessário por dia útil" tone="success" value={brl0(g.requiredPerRemainingDayCents)} foot={`meta diária original ${brl0(g.dailyGoalCents)}`} />
      </div>
      <Card>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>#</th><th>Vendedor</th><th className="r">Meta mês</th><th className="r">Realizado</th><th>% mês</th><th className="r">Meta dia</th><th className="r">Hoje</th><th className="r">% dia</th><th className="r">Falta</th><th className="r">Por dia útil</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const sg = sellerGoal(r.id);
                return (
                  <tr key={r.id} className="click" onClick={() => setOpen(r.id)}>
                    <td><span className={`pos p${r.position}`}>{r.position}º</span></td>
                    <td className="semi">{r.name}</td>
                    <td className="r num">{brl0(sg.monthlyGoalCents)}</td>
                    <td className="r num">{brl0(sg.achievedMonthCents)}</td>
                    <td style={{ minWidth: 130 }}><div className="progress-row"><Progress value={sg.monthAttainmentPct} /><b className="num xs">{pct(sg.monthAttainmentPct)}</b></div></td>
                    <td className="r num">{brl0(sg.dailyGoalCents)}</td>
                    <td className="r num">{brl0(sg.achievedTodayCents)}</td>
                    <td className={`r bold num ${sg.dayAttainmentPct >= 100 ? "green" : sg.dayAttainmentPct < 70 ? "red" : ""}`}>{pct(sg.dayAttainmentPct)}</td>
                    <td className="r num red">{brl0(sg.missingMonthCents)}</td>
                    <td className="r num">{brl0(sg.requiredPerRemainingDayCents)}</td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td></td><td className="bold">Total da equipe</td>
                <td className="r num bold">{brl0(g.monthlyGoalCents)}</td><td className="r num bold">{brl0(g.achievedMonthCents)}</td>
                <td><div className="progress-row"><Progress value={g.monthAttainmentPct} color="red" /><b className="num xs">{pct(g.monthAttainmentPct)}</b></div></td>
                <td className="r num">{brl0(g.dailyGoalCents)}</td><td className="r num">{brl0(g.achievedTodayCents)}</td>
                <td className="r bold num">{pct(g.dayAttainmentPct)}</td><td className="r num red bold">{brl0(g.missingMonthCents)}</td><td className="r num">{brl0(g.requiredPerRemainingDayCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      {open && <SellerPanel id={open} onClose={() => setOpen(null)} />}
      <p className="xs muted mt">Toque em um vendedor para ver os pedidos do mês e os clientes sem compra.</p>
    </>
  );
}

function VisitsTable({ scope }: { scope: string[] }) {
  const rows = visitsRanking().filter((r) => scope.includes(r.id));
  return (
    <div className="table-wrap">
      <table className="t">
        <thead><tr><th>#</th><th>Vendedor</th><th className="r">Planejadas</th><th className="r">Realizadas</th><th>%</th><th className="r">Pendentes</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><span className={`pos p${r.position}`}>{r.position}º</span></td>
              <td className="semi">{r.name}</td><td className="r">{r.target}</td><td className="r">{r.achieved}</td>
              <td style={{ minWidth: 140 }}><div className="progress-row"><Progress value={r.attainmentPct ?? 0} color="green" /><b className="xs num">{pct(r.attainmentPct ?? 0)}</b></div></td>
              <td className="r red semi">{r.pending}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VisitsView({ scope }: { scope: string[] }) {
  const vt = visitsTotal();
  return (
    <>
      <h2 style={{ margin: "6px 0 12px" }}>Visitas do dia</h2>
      <div className="grid g3">
        <Kpi label="Planejadas" value={vt.planned} />
        <Kpi label="Realizadas" tone="success" value={vt.done} foot="check-in = visita" />
        <Kpi label="Atingimento" tone="gold" value={pct(vt.pct)} />
      </div>
      <Card title="Ranking por % de visitas realizadas"><VisitsTable scope={scope} /></Card>
      <CheckinsCard scope={scope} />
    </>
  );
}

function InactiveView({ scope, onOpen }: { scope: string[]; onOpen: (c: Customer) => void }) {
  const [days, setDays] = useState<number | null>(15);
  const [month, setMonth] = useState(false);
  const [curves, setCurves] = useState<AbcdClass[]>([]);
  const [freezer, setFreezer] = useState<boolean | undefined>(undefined);
  const [routes, setRoutes] = useState<string[]>([]);
  const [seller, setSeller] = useState<string | null>(null);
  const base = CUSTOMERS.filter((c) => scope.includes(c.sellerId) && (!seller || c.sellerId === seller));
  const list = filterCustomers(
    base.map((c) => ({ ...c, commercialRouteCode: c.routeCode, freezerCount: c.assets.length })),
    { minDaysWithoutPurchase: days ?? undefined, noPurchaseThisMonth: month, curves, hasFreezer: freezer, routeCodes: routes },
    TODAY,
  ).map((x) => customerById.get(x.id)!).sort((a, b) => (customerRow(b).days ?? 999) - (customerRow(a).days ?? 999));
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <>
      <h2 style={{ margin: "6px 0 4px" }}>Clientes sem compra</h2>
      <p className="small muted mb">Filtros combináveis. Ex.: Curva A + mais de 15 dias + Rota 2.</p>
      <Card className="mb">
        <div className="stack">
          <div className="chips"><span className="xs muted semi" style={{ alignSelf: "center" }}>Período</span>
            <Chip on={month} onClick={() => setMonth(!month)}>Sem compra no mês</Chip>
            {[7, 15, 30].map((d) => <Chip key={d} on={days === d} onClick={() => setDays(days === d ? null : d)}>+{d} dias</Chip>)}
          </div>
          <div className="chips"><span className="xs muted semi" style={{ alignSelf: "center" }}>Curva</span>
            {(["A", "B", "C", "D"] as AbcdClass[]).map((c) => <Chip key={c} on={curves.includes(c)} onClick={() => setCurves(toggle(curves, c))}>Curva {c}</Chip>)}
            <Chip on={freezer === true} onClick={() => setFreezer(freezer === true ? undefined : true)}>Com freezer</Chip>
            <Chip on={freezer === false} onClick={() => setFreezer(freezer === false ? undefined : false)}>Sem freezer</Chip>
          </div>
          <div className="chips"><span className="xs muted semi" style={{ alignSelf: "center" }}>Rota</span>
            {PARAMS.commercialRoutes.map((r) => <Chip key={r.code} on={routes.includes(r.code)} onClick={() => setRoutes(toggle(routes, r.code))}>{r.name}</Chip>)}
          </div>
          <div className="chips"><span className="xs muted semi" style={{ alignSelf: "center" }}>Vendedor</span>
            <Chip on={!seller} onClick={() => setSeller(null)}>Todos</Chip>
            {SELLERS.filter((s) => scope.includes(s.id)).map((s) => <Chip key={s.id} on={seller === s.id} onClick={() => setSeller(s.id)}>{s.name.split(" ")[0]}</Chip>)}
          </div>
        </div>
      </Card>
      <Card title={`${list.length} clientes encontrados`}>
        <CustomerTable list={list.slice(0, 120)} onOpen={onOpen} />
      </Card>
    </>
  );
}

function DeliveriesTable() {
  useStore();
  const log = logisticsOverview();
  const [open, setOpen] = useState<DeliveryRoute | null>(null);
  return (
    <div className="table-wrap">
      {open && <RouteDetail r={open} onClose={() => setOpen(null)} />}
      <table className="t">
        <thead><tr><th>Rota</th><th>Motorista</th><th>Veículo</th><th>Status</th><th className="r">Programadas</th><th className="r">Realizadas</th><th className="r">Pendentes</th><th className="r">Não realiz.</th><th>%</th></tr></thead>
        <tbody>
          {log.routes.map(({ r, p, driver, vehicle }) => (
            <tr key={r.id} className="click" onClick={() => setOpen(r)}>
              <td className="semi">{r.code} · {r.name}</td><td>{driver.name}</td><td>{vehicle.plate}</td>
              <td><Badge tone={p.status === "Em rota" ? (p.behind ? "warning" : "brand") : p.status === "Não iniciada" ? "danger" : "success"}>{p.behind ? "Atrasada" : p.status}</Badge></td>
              <td className="r">{p.total}</td><td className="r green semi">{p.delivered}</td><td className="r">{p.pending}</td><td className="r red">{p.failed}</td>
              <td style={{ minWidth: 130 }}><div className="progress-row"><Progress value={p.pct} color="green" /><b className="xs num">{pct(p.pct)}</b></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliveriesView() {
  const log = logisticsOverview();
  return (
    <>
      <h2 style={{ margin: "6px 0 12px" }}>Entregas do dia</h2>
      <div className="grid g2 gd-4">
        <Kpi label="Programadas" value={log.total} />
        <Kpi label="Realizadas" tone="success" value={log.delivered} foot={pct(log.pct)} />
        <Kpi label="Pendentes" tone="gold" value={log.pending} />
        <Kpi label="Não realizadas" tone="red" value={log.failed} />
      </div>
      <Card title="Por rota, motorista e veículo" sub="toque na rota para ver entregas e comprovantes"><DeliveriesTable /></Card>
      <ChecklistsCard />
      <Card title="Entregas com atenção" icon={<AlertTriangle size={17} />} className="mt">
        {log.alerts.map((a, i) => <div key={i} className="alert-line"><span className="dotc" style={{ background: a.tone === "danger" ? "var(--danger)" : "var(--gold)" }} />{a.text}</div>)}
      </Card>
    </>
  );
}

function FinanceView() {
  useStore();
  const fq = financeQueue();
  const [open, setOpen] = useState<PaymentRequest | null>(null);
  const answered = PAYMENT_REQUESTS.filter((p) => !["pending", "in_analysis"].includes(p.status) && p.respondedAt).sort((a, b) => (b.respondedAt ?? "").localeCompare(a.respondedAt ?? "")).slice(0, 8);
  return (
    <>
      <h2 style={{ margin: "6px 0 4px" }}>Solicitações financeiras</h2>
      <p className="small muted mb">Nenhuma solicitação some: só sai da fila com resposta do financeiro. Ordem: pendências de ontem → PIX → boleto.</p>
      <div className="grid g2 gd-4">
        <Kpi label="Pendentes" value={fq.queue.length} />
        <Kpi label={`Sem resposta > ${PARAMS.financialSla.responseHours}h`} tone="red" value={fq.breached} />
        <Kpi label="PIX" tone="gold" value={fq.pix} />
        <Kpi label="Boleto" tone="info" value={fq.boleto} />
      </div>
      <Card>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>#</th><th>Solicitação</th><th>Cliente</th><th>Vendedor</th><th>Método</th><th className="r">Valor</th><th>Status</th><th>SLA</th></tr></thead>
            <tbody>
              {fq.queue.map((p, i) => (
                <tr key={p.id} className="click" onClick={() => setOpen(p)}>
                  <td>{i + 1}</td><td className="semi">{p.number}{p.carryOver && <> <Badge tone="danger">dia anterior</Badge></>}</td>
                  <td>{customerById.get(p.customerId)?.tradeName}</td><td>{sellerById.get(p.sellerId)?.name}</td>
                  <td><Badge tone={p.method === "PIX" ? "brand" : "info"}>{p.method}</Badge></td><td className="r num">{brl(p.amountCents)}</td>
                  <td>{PAYMENT_REQUEST_STATUS[p.status].label}</td>
                  <td><Badge tone={p.sla.level === "breached" ? "danger" : p.sla.level === "warning" ? "warning" : "success"}><Clock size={11} /> {Math.floor(p.sla.elapsedHours)}h</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Respondidas recentemente" className="mt" sub="toque para ver o comprovante">
        {answered.map((p) => (
          <div key={p.id} className="row click" onClick={() => setOpen(p)}>
            <Badge tone={p.method === "PIX" ? "brand" : "info"}>{p.method}</Badge>
            <div className="grow"><div className="title small">{customerById.get(p.customerId)?.tradeName}</div><div className="sub">{p.number} · {sellerById.get(p.sellerId)?.name}</div></div>
            <Badge tone={PAYMENT_REQUEST_STATUS[p.status].tone}>{PAYMENT_REQUEST_STATUS[p.status].label}</Badge>
          </div>
        ))}
      </Card>
      {open && <ProofView p={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function AssetsView({ scope, onOpen }: { scope: string[]; onOpen: (c: Customer) => void }) {
  const a = assetsOverview(scope);
  return (
    <>
      <h2 style={{ margin: "6px 0 12px" }}>Ativos / freezers</h2>
      <div className="grid g2 gd-4">
        <Kpi icon={<Snowflake size={17} />} label="Freezers na rua" value={a.onStreet} foot={`${a.inStock} em estoque · ${a.maintenance} em manutenção`} />
        <Kpi tone="gold" label="Valor na rua" value={brl0(a.valueOnStreet)} />
        <Kpi tone="red" label="Ativos sem giro" value={a.idleCount} foot={`clientes ≥ ${PARAMS.inactivity.idleAssetThresholdDays} dias sem compra`} />
        <Kpi tone="red" label="Valor de ativos sem giro" value={brl0(a.idleValue)} />
      </div>
      <div className="grid gd gd-12">
        <Card title="Por vendedor">
          {a.bySeller.filter((x) => scope.includes(x.seller.id)).map((x) => (
            <div key={x.seller.id} className="row"><span className="grow semi">{x.seller.name}</span><span className="muted small">{x.count} un.</span><span className="num semi">{brl0(x.value)}</span></div>
          ))}
        </Card>
        <Card title="Ativos sem giro" icon={<AlertTriangle size={17} />}>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Cliente</th><th>Vendedor</th><th className="r">Dias s/ compra</th><th className="r">Freezers</th><th className="r">Valor</th><th>Última compra</th></tr></thead>
              <tbody>
                {a.idle.slice(0, 30).map((r) => (
                  <tr key={r.c.id} className="click" onClick={() => onOpen(r.c)}>
                    <td className="semi">{r.c.tradeName}</td><td>{sellerById.get(r.c.sellerId)?.name.split(" ")[0]}</td>
                    <td className="r red bold">{r.days ?? "nunca"}</td><td className="r">{r.c.assets.length}</td>
                    <td className="r num">{brl0(r.value)}</td><td>{fmtDate(r.c.lastPurchaseDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

function PortfolioView() {
  useStore();
  const reqs = TRANSFER_REQUESTS.filter((r) => r.status === "pending");
  const decided = TRANSFER_REQUESTS.filter((r) => r.status !== "pending").slice(0, 5);
  const [form, setForm] = useState({ titular: "s3", sub: "s1", from: TODAY, to: "", reason: "Férias" });
  const decide = (r: (typeof TRANSFER_REQUESTS)[number], ok: boolean) => commit(() => {
    const c = customerById.get(r.customerId)!;
    r.status = ok ? "approved" : "rejected"; r.decidedAt = new Date().toISOString(); r.decidedBy = "Gestão";
    if (ok) c.sellerId = r.toSellerId;
    notify({ kind: "comercial", title: ok ? "Transferência aprovada" : "Transferência recusada", text: `${c.tradeName}: ${ok ? `agora na carteira de ${sellerById.get(r.toSellerId)?.name}` : "permanece com o vendedor atual"}.`, to: [`seller:${r.toSellerId}`, `seller:${r.fromSellerId}`] });
  }, ok ? "Transferência aprovada · carteira anterior, aprovador e motivo registrados" : "Transferência rejeitada · histórico registrado");
  return (
    <>
      <h2 style={{ margin: "6px 0 12px" }}>Carteiras</h2>
      <div className="grid gd gd-2">
        <Card title={`Transferências pendentes (${reqs.length})`} icon={<ArrowRightLeft size={17} />}>
          {reqs.map((r) => {
            const c = customerById.get(r.customerId)!;
            return (
              <div key={r.id} className="row" style={{ alignItems: "flex-start" }}>
                <div className="grow">
                  <div className="title">{c.tradeName}</div>
                  <div className="sub">{sellerById.get(r.fromSellerId)?.name} → {sellerById.get(r.toSellerId)?.name} · {fmtDate(r.createdAt)}</div>
                  <div className="small t2" style={{ whiteSpace: "normal", marginTop: 4 }}>“{r.reason}”</div>
                </div>
                <div className="flex" style={{ gap: 6 }}>
                  <button className="icon-btn" aria-label="Recusar" onClick={() => decide(r, false)}><XIcon size={16} /></button>
                  <button className="icon-btn" aria-label="Aprovar" style={{ background: "var(--success)", color: "#fff" }} onClick={() => decide(r, true)}><Check size={16} /></button>
                </div>
              </div>
            );
          })}
          {!reqs.length && <div className="small muted">Nenhuma transferência pendente.</div>}
          {decided.length > 0 && <div className="section-title" style={{ fontSize: 13 }}>Histórico</div>}
          {decided.map((r) => (
            <div key={r.id} className="row"><span className="grow small">{customerById.get(r.customerId)?.tradeName} · {sellerById.get(r.fromSellerId)?.name.split(" ")[0]} → {sellerById.get(r.toSellerId)?.name.split(" ")[0]}</span><Badge tone={r.status === "approved" ? "success" : "danger"}>{r.status === "approved" ? "Aprovada" : "Recusada"}</Badge></div>
          ))}
        </Card>
        <Card title="Acesso temporário à carteira" icon={<CalendarRange size={17} />} sub="férias, afastamento, cobertura">
          <div className="grid g2" style={{ marginBottom: 0 }}>
            <div className="field"><label>Titular</label><select id="ta-holder" className="input" value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })}>{SELLERS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="field"><label>Substituto</label><select id="ta-sub" className="input" value={form.sub} onChange={(e) => setForm({ ...form, sub: e.target.value })}>{SELLERS.filter((s) => s.id !== form.titular).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="field"><label>Início</label><input id="ta-from" type="date" className="input" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></div>
            <div className="field"><label>Fim</label><input id="ta-to" type="date" className="input" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></div>
          </div>
          <div className="field"><label>Motivo</label><select id="ta-reason" className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}><option>Férias</option><option>Afastamento</option><option>Cobertura temporária</option></select></div>
          <p className="xs muted mb">Acesso removido automaticamente no fim do período. Preparado para integração futura com RH.</p>
          <button className="btn btn-primary btn-block" disabled={!form.to || form.to < form.from} onClick={() => commit(() => {
            TEMP_ACCESS.unshift({ id: `ta${Date.now()}`, holderSellerId: form.titular, substituteSellerId: form.sub, from: form.from, to: form.to, reason: form.reason, createdAt: new Date().toISOString() });
            notify({ kind: "comercial", title: "Acesso temporário liberado", text: `Você cobre a carteira de ${sellerById.get(form.titular)?.name} de ${fmtDate(form.from)} a ${fmtDate(form.to)} (${form.reason}).`, to: [`seller:${form.sub}`] });
          }, `Carteira de ${sellerById.get(form.titular)?.name.split(" ")[0]} liberada para ${sellerById.get(form.sub)?.name.split(" ")[0]} até ${fmtDate(form.to)}`)}>Liberar acesso temporário</button>
          {TEMP_ACCESS.length > 0 && <div className="section-title" style={{ fontSize: 13 }}>Acessos ativos</div>}
          {TEMP_ACCESS.map((t) => (
            <div key={t.id} className="row"><span className="grow small">{sellerById.get(t.substituteSellerId)?.name} cobre {sellerById.get(t.holderSellerId)?.name}</span><span className="xs muted">{fmtDate(t.from)} → {fmtDate(t.to)}</span><Badge tone={t.to >= TODAY ? "success" : "neutral"}>{t.to >= TODAY ? t.reason : "Expirado"}</Badge></div>
          ))}
        </Card>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ fechamento do dia anterior
function YesterdayCard({ scope }: { scope: string[] }) {
  useStore();
  const y = yesterdaySummary(scope);
  const [open, setOpen] = useState(false);
  const Stat = ({ label, done, target, pctV }: { label: string; done: string; target: string; pctV: number }) => (
    <div className="yd-stat">
      <div className="xs muted semi">{label}</div>
      <div className="flex between" style={{ alignItems: "baseline" }}>
        <b className="num" style={{ fontSize: 19 }}>{done} <small className="muted" style={{ fontSize: 12, fontWeight: 500 }}>/ {target}</small></b>
        <b className={`num small ${pctV >= 100 ? "green" : pctV < 80 ? "red" : "gold"}`}>{pct(pctV)}</b>
      </div>
      <Progress thin value={pctV} color={pctV >= 100 ? "green" : pctV < 80 ? "red" : undefined} />
    </div>
  );
  const issues = [
    y.belowGoal.length && `${y.belowGoal.length} vendedor(es) abaixo da meta`,
    y.incomplete.length && `${y.incomplete.length} com visitas incompletas`,
    y.unfinished.length && `${y.unfinished.length} motorista(s) não finalizaram a rota`,
    y.pendingFailed.length && `${y.pendingFailed.length} entrega(s) não concluída(s)`,
  ].filter(Boolean) as string[];
  return (
    <>
      <div className="card click yd-card mb" role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={(e) => e.key === "Enter" && setOpen(true)}>
        <div className="card-title">
          <span className="ic"><History size={17} /></span>
          <span>Fechamento de ontem <span className="card-sub">{dayLabel(y.date)}</span></span>
          <span style={{ marginLeft: "auto" }}>{y.ok ? <Badge tone="success"><CheckCircle2 size={12} /> Concluído</Badge> : <Badge tone="danger"><XCircle size={12} /> Com pendências</Badge>}</span>
        </div>
        <div className="grid g3" style={{ marginBottom: 10 }}>
          <Stat label="Faturamento x meta" done={brl0(y.sales)} target={brl0(y.goal)} pctV={y.salesPct} />
          <Stat label="Visitas x planejadas" done={String(y.vDone)} target={String(y.vPlanned)} pctV={y.visitsPct} />
          <Stat label="Entregas x programadas" done={String(y.delivered)} target={String(y.deliveriesTotal)} pctV={y.deliveriesPct} />
        </div>
        <div className="flex between wrap" style={{ gap: 8 }}>
          <span className="small t2">{issues.length ? issues.join(" · ") : "Equipe concluiu tudo o que foi planejado."}</span>
          <span className="small red semi flex" style={{ gap: 2 }}>Toque para ver detalhes <ChevronRight size={14} /></span>
        </div>
      </div>
      {open && <YesterdaySheet scope={scope} onClose={() => setOpen(false)} />}
    </>
  );
}

function YesterdaySheet({ scope, onClose }: { scope: string[]; onClose: () => void }) {
  useStore();
  const y = yesterdaySummary(scope);
  const reschedule = (d: YesterdayDelivery) => commit(() => {
    const r = DELIVERY_ROUTES.find((x) => x.name === d.routeName && !x.finishedAt) ?? DELIVERY_ROUTES.find((x) => !x.finishedAt)!;
    r.deliveries.push({ id: `re-${d.id}`, seq: r.deliveries.length + 1, customerId: d.customerId, invoiceNumber: d.invoiceNumber, orderNumber: "—", volumes: 10, status: r.startedAt ? "in_transit" : "scheduled" });
    d.rescheduledTo = r.id;
    const c = customerById.get(d.customerId)!;
    notify({ kind: "logistica", title: "Reentrega incluída na sua rota", text: `${c.tradeName} · ${d.invoiceNumber} (pendente de ontem${d.reason ? `: ${d.reason}` : ""}).`, to: [`driver:${r.driverId}`, "transport_coordinator"] });
    notify({ kind: "logistica", title: "Entrega reprogramada", text: `${c.tradeName} · ${d.invoiceNumber} volta para rota hoje.`, to: [`seller:${c.sellerId}`] });
  }, "Entrega reprogramada para hoje · motorista e coordenação avisados");
  return (
    <Sheet title={`Fechamento de ontem · ${dayLabel(y.date)}`} onClose={onClose} wide icon={<History size={18} />}>
      <div className="grid g3">
        <Kpi label="Faturamento x meta" value={brl0(y.sales)} foot={`meta ${brl0(y.goal)} · ${pct(y.salesPct)}`} />
        <Kpi label="Visitas x planejadas" tone="info" value={`${y.vDone}/${y.vPlanned}`} foot={pct(y.visitsPct)} />
        <Kpi label="Entregas x programadas" tone="success" value={`${y.delivered}/${y.deliveriesTotal}`} foot={pct(y.deliveriesPct)} />
      </div>
      <Card title={`Vendedores abaixo da meta do dia (${y.belowGoal.length})`} icon={<Target size={17} />}>
        {y.belowGoal.sort((a, b) => a.salesPct - b.salesPct).map((r) => (
          <div key={r.sellerId} className="row">
            <div className="grow">
              <div className="title">{r.name}</div>
              <div className="sub">Meta {brl0(r.goalCents)} · vendeu {brl0(r.salesCents)} · faltou <b className="red">{brl0(r.goalCents - r.salesCents)}</b></div>
              <div style={{ marginTop: 5 }}><Progress thin value={r.salesPct} color={r.salesPct < 80 ? "red" : undefined} /></div>
            </div>
            <b className={`num ${r.salesPct < 80 ? "red" : "gold"}`}>{pct(r.salesPct)}</b>
          </div>
        ))}
        {!y.belowGoal.length && <div className="small green semi">Todos bateram a meta do dia.</div>}
      </Card>
      <Card title={`Motoristas que não finalizaram a rota (${y.unfinished.length})`} icon={<Truck size={17} />} className="mt">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Motorista</th><th>Veículo</th><th>Rota</th><th className="r">Entregues</th><th>Início</th><th>Fim</th><th>Situação</th></tr></thead>
            <tbody>
              {y.routes.sort((a, b) => Number(!!a.finishedAt) - Number(!!b.finishedAt)).map((r) => (
                <tr key={r.routeName}>
                  <td className="semi">{r.driver.name}</td><td>{r.vehicle.plate} · {r.vehicle.model.split(" ").slice(0, 2).join(" ")}</td><td>{r.routeName}</td>
                  <td className={`r semi ${r.delivered < r.total ? "red" : "green"}`}>{r.delivered}/{r.total}</td>
                  <td>{new Date(r.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: PARAMS.timezone })}</td>
                  <td>{r.finishedAt ? new Date(r.finishedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: PARAMS.timezone }) : "—"}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 200 }}>{r.finishedAt ? <Badge tone="success">Finalizou</Badge> : <><Badge tone="danger">Não finalizou</Badge> <span className="xs muted">{r.note}</span></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Metas e visitas por vendedor" sub="ordenado por % da meta" className="mt">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>#</th><th>Vendedor</th><th className="r">Meta do dia</th><th className="r">Vendido</th><th className="r">%</th><th className="r">Pedidos</th><th className="r">Visitas</th><th>Não visitados</th></tr></thead>
            <tbody>
              {y.salesRank.map((rk) => {
                const r = y.rows.find((x) => x.sellerId === rk.id)!;
                return (
                  <tr key={r.sellerId}>
                    <td><span className={`pos p${rk.position}`}>{rk.position}º</span></td>
                    <td className="semi">{r.name}</td>
                    <td className="r num">{brl0(r.goalCents)}</td><td className="r num">{brl0(r.salesCents)}</td>
                    <td className={`r bold num ${r.salesPct >= 100 ? "green" : r.salesPct < 80 ? "red" : "gold"}`}>{pct(r.salesPct)}</td>
                    <td className="r">{r.orders}</td>
                    <td className={`r semi ${r.visitsDone < r.visitsPlanned ? "red" : "green"}`}>{r.visitsDone}/{r.visitsPlanned}</td>
                    <td className="small" style={{ whiteSpace: "normal", minWidth: 220 }}>{r.missedCustomerIds.map((id) => customerById.get(id)?.tradeName).join(", ") || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={`Entregas não concluídas (${y.failed.length})`} icon={<Package size={17} />} className="mt">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Cliente</th><th>Nota</th><th>Rota</th><th>Motorista</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {y.failed.map((d) => (
                <tr key={d.id}>
                  <td className="semi">{customerById.get(d.customerId)?.tradeName}</td><td>{d.invoiceNumber}</td><td>{d.routeName}</td>
                  <td>{DRIVERS.find((x) => x.id === d.driverId)?.name}</td>
                  <td>{d.status === "no_record" ? <Badge tone="danger">Sem baixa do motorista</Badge> : <Badge tone="warning">{d.reason}</Badge>}</td>
                  <td>{d.rescheduledTo ? <Badge tone="success">Reprogramada hoje</Badge>
                    : <button className="btn btn-soft btn-sm" onClick={() => reschedule(d)}><CalendarClock size={14} /> Reprogramar hoje</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {(y.openPayments > 0 || y.openIncidents > 0) && (
        <Card title="Ainda abertos desde ontem" icon={<AlertTriangle size={17} />} className="mt">
          <div className="alert-line"><span className="dotc" style={{ background: "var(--danger)" }} />{y.openPayments} comprovante(s) de pagamento sem resposta do financeiro</div>
          <div className="alert-line"><span className="dotc" style={{ background: "var(--gold)" }} />{y.openIncidents} ocorrência(s) logística(s) em aberto</div>
        </Card>
      )}
    </Sheet>
  );
}

function ProofView({ p, onClose }: { p: PaymentRequest; onClose: () => void }) {
  const c = customerById.get(p.customerId)!;
  const st = PAYMENT_REQUEST_STATUS[p.status];
  return (
    <Sheet title={`Comprovante ${p.number}`} onClose={onClose} icon={<Receipt size={18} />}>
      <Card>
        <dl className="kv">
          <dt>Cliente</dt><dd>{c.code} · {c.tradeName}</dd><dt>Vendedor</dt><dd>{sellerById.get(p.sellerId)?.name}</dd>
          <dt>Método</dt><dd>{p.method}</dd><dt>Débito</dt><dd>{p.receivableDoc}</dd><dt>Valor</dt><dd className="num">{brl(p.amountCents)}</dd>
          <dt>Enviado</dt><dd>{new Date(p.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</dd>
          <dt>Situação</dt><dd><Badge tone={st.tone}>{st.label}</Badge></dd>
        </dl>
      </Card>
      <div className="mt">
        {p.attachmentDataUrl ? <div className="photo-preview"><img src={p.attachmentDataUrl} alt="Comprovante" /></div>
          : <div className="upload done" style={{ padding: 24 }}>📎 {p.attachmentName}</div>}
      </div>
      <p className="xs muted mt">A gestão acompanha; a resposta é do financeiro.</p>
    </Sheet>
  );
}

function CheckinsCard({ scope }: { scope: string[] }) {
  useStore();
  const list = CHECKINS.filter((k) => k.date === TODAY && scope.includes(k.sellerId));
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <Card title={`Check-ins registrados agora (${list.length})`} className="mt" sub="visitas feitas no app durante o teste">
      {list.map((k) => (
        <div key={k.id} className="row">
          <div className="grow"><div className="title small">{customerById.get(k.customerId)?.tradeName}</div><div className="sub">{sellerById.get(k.sellerId)?.name}</div></div>
          <span className="small">{hhmm(k.inAt)} → {k.outAt ? hhmm(k.outAt) : "em andamento"}</span>
          {k.outAt ? <Badge tone="success">{Math.max(1, Math.round((new Date(k.outAt).getTime() - new Date(k.inAt).getTime()) / 60000))} min</Badge> : <Badge tone="info">Em visita</Badge>}
        </div>
      ))}
      {!list.length && <div className="small muted">Nenhum check-in feito no app ainda hoje.</div>}
    </Card>
  );
}

function ChecklistsCard() {
  useStore();
  const ncs = NONCONFORMITIES.filter((n) => n.status !== "resolved");
  return (
    <Card title="Checklists dos veículos e não conformidades" icon={<ClipboardList size={17} />} className="mt">
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Rota</th><th>Motorista</th><th>Veículo</th><th>Checklist</th><th>Não conformidades</th></tr></thead>
          <tbody>
            {DELIVERY_ROUTES.map((r) => {
              const v = VEHICLES.find((x) => x.id === (r.checklistVehicleId ?? r.vehicleId))!;
              const mine = ncs.filter((n) => n.vehicleId === v.id);
              return (
                <tr key={r.id}>
                  <td className="semi">{r.name}</td><td>{DRIVERS.find((d) => d.id === r.driverId)?.name}</td><td>{v.plate}</td>
                  <td>{r.checklistDone ? <Badge tone="success">Feito {r.checklistAt ? new Date(r.checklistAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</Badge> : r.startedAt ? <Badge tone="neutral">Antes do app</Badge> : <Badge tone="danger">Pendente</Badge>}</td>
                  <td style={{ whiteSpace: "normal" }}>{mine.length ? mine.map((n) => <Badge key={n.id} tone={n.severity === "critical" ? "danger" : "warning"}>{n.item}</Badge>) : <span className="muted small">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
