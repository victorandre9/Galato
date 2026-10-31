/** Perfil VENDEDOR — mobile-first. Responde: quanto vendi, quanto falta, onde agir agora. */
import { useState } from "react";
import {
  Home, Users, ClipboardList, MapPinned, MoreHorizontal, ShoppingCart, Coins, Target, CalendarClock, Search,
  FileText, Hourglass, FileCheck2, Truck, Receipt, UserRound, Zap, ArrowUp, ArrowDown, CheckCircle2,
} from "lucide-react";
import { bucketLabel, PAYMENT_REQUEST_STATUS } from "@galato/domain";
import { PARAMS, CUSTOMERS, TODAY_ROUTE, CURRENT_SELLER as ME, sellerById, customerById, type Customer, type Order, TODAY } from "../data/mock";
import { newestFirst } from "../data/orders";
import { OrderOpen } from "../components/order-flow";
import {
  sellerGoal, todayRouteBuckets, ordersOf, quotesOf, countByStatus, OPEN_QUOTE, AWAITING_CREDIT, IN_ROUTE,
  sellerSalesToday, financeQueue, customerRow, dayLabel,
} from "../data/selectors";
import { useStore, commit } from "../data/store";
import { Shell, Greeting, ProfilePanel } from "../components/shell";
import { Card, Kpi, Ring, Sheet, brl, brl0, pct, Chip, Badge, Empty, Progress, ConfirmModal } from "../components/ui";
import { CustomerSheet, CustomerTable, CustomerRowView, OrderRow, OrderBuilder, fmtDate } from "../components/business";

export function SellerApp() {
  const [tab, setTab] = useState("home");
  const [open, setOpen] = useState<Customer | null>(null);
  useStore();
  const tabs = [
    { id: "home", label: "Início", icon: <Home size={20} /> },
    { id: "customers", label: "Clientes", icon: <Users size={20} /> },
    { id: "orders", label: "Pedidos", icon: <ClipboardList size={20} /> },
    { id: "route", label: "Rota", icon: <MapPinned size={20} /> },
    { id: "more", label: "Mais", icon: <MoreHorizontal size={20} /> },
  ];
  return (
    <Shell tabs={tabs} tab={tab} onTab={setTab} roleLabel="Vendedor externo" userName={ME.name} narrow>
      {tab === "home" && <SellerHome onOpen={setOpen} goTab={setTab} />}
      {tab === "customers" && <SellerCustomers onOpen={setOpen} />}
      {tab === "orders" && <SellerOrders />}
      {tab === "route" && <SellerRoute onOpen={setOpen} />}
      {tab === "more" && <ProfilePanel name={ME.name} role={`Vendedor externo · ${ME.region}`} />}
      {open && <CustomerSheet c={open} viewerSellerId={ME.id} onClose={() => setOpen(null)} />}
    </Shell>
  );
}

function SellerHome({ onOpen, goTab }: { onOpen: (c: Customer) => void; goTab: (t: string) => void }) {
  const g = sellerGoal(ME.id);
  const route = todayRouteBuckets(ME.id);
  const orders = ordersOf(ME.id);
  const quotes = quotesOf(ME.id);
  const fq = financeQueue(ME.id);
  const sales = sellerSalesToday(ME.id);
  const [bucket, setBucket] = useState<number | null>(null);
  const [quick, setQuick] = useState(false);
  const buckets = PARAMS.inactivity.dashboardBuckets;
  const dayVsGoal = g.dayAttainmentPct;

  return (
    <>
      <Greeting icon={<UserRound size={22} />} title={`Olá, ${ME.name.split(" ")[0]}!`} sub="Seu desempenho comercial" />

      <div className="grid g2">
        <Kpi icon={<ShoppingCart size={17} />} label="Venda do dia" value={brl0(ME.todayAchievedCents)}
          foot={<><span className={dayVsGoal >= 100 ? "up" : "down"}>{dayVsGoal >= 100 ? <ArrowUp size={12} /> : <ArrowDown size={12} />} {pct(dayVsGoal)}</span> da meta do dia ({brl0(g.dailyGoalCents)})</>} />
        <Kpi icon={<Coins size={17} />} tone="gold" label="Acumulado do mês" value={brl0(g.achievedMonthCents)}
          foot={<>{sales.count} pedidos hoje · ticket {brl0(sales.ticketCents)}</>} />
      </div>

      <Card className="mb">
        <div className="flex" style={{ gap: 18, alignItems: "center" }}>
          <Ring value={g.monthAttainmentPct} size={118} label={pct(g.monthAttainmentPct)} sub="da meta" />
          <dl className="kv" style={{ flex: 1 }}>
            <dt>Meta do mês</dt><dd className="num">{brl0(g.monthlyGoalCents)}</dd>
            <dt>Falta</dt><dd className="num red">{brl0(g.missingMonthCents)}</dd>
            <dt>Por dia útil</dt><dd className="num">{brl0(g.requiredPerRemainingDayCents)}</dd>
            <dt>Dias úteis rest.</dt><dd>{g.remainingBusinessDays} de {g.businessDaysInMonth}</dd>
          </dl>
        </div>
      </Card>

      <Card className="mb">
        <div className="flex between"><span className="semi flex" style={{ gap: 8 }}><MapPinned size={17} className="red" /> Visitas de hoje</span>
          <b className="num">{ME.visitsDoneToday} <span className="muted small">/ {ME.visitsPlannedToday}</span></b></div>
        <div className="progress-row mt"><Progress value={(ME.visitsDoneToday / Math.max(1, ME.visitsPlannedToday)) * 100} color="green" /><b className="num xs">{pct((ME.visitsDoneToday / Math.max(1, ME.visitsPlannedToday)) * 100)}</b></div>
        <div className="xs muted mt">Check-in no cliente conta como visita realizada.</div>
      </Card>

      <Card title={<>Rota de hoje · {TODAY_ROUTE?.name ?? "sem rota"}</>} icon={<MapPinned size={17} />} link="Ver rota" onLink={() => goTab("route")}>
        <div className="flex between mb small"><span className="t2">{route.total} clientes na rota</span><span className="muted xs">sem compra há:</span></div>
        <div className="buckets">
          {route.buckets.map((b, i) => (
            <div key={b.bucket} className={`bucket b${i}`} onClick={() => setBucket(b.bucket)}>
              <span>{bucketLabel(b.bucket, buckets)}</span><b className="num">{b.rows.length}</b>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid g4 mt">
        <StatusTile icon={<FileText size={18} />} label="Orçamentos abertos" n={countByStatus(quotes, OPEN_QUOTE)} tone="info" onClick={() => goTab("orders")} />
        <StatusTile icon={<Hourglass size={18} />} label="Aguard. crédito" n={countByStatus(orders, AWAITING_CREDIT)} tone="warning" onClick={() => goTab("orders")} />
        <StatusTile icon={<FileCheck2 size={18} />} label="Faturados" n={countByStatus(orders, ["invoiced"])} tone="success" onClick={() => goTab("orders")} />
        <StatusTile icon={<Truck size={18} />} label="Em rota" n={countByStatus(orders, IN_ROUTE)} tone="brand" onClick={() => goTab("orders")} />
      </div>

      <Card title="Quitações pendentes" icon={<Receipt size={17} />} sub={`SLA ${PARAMS.financialSla.responseHours}h`}>
        {fq.queue.slice(0, 4).map((p) => (
          <div key={p.id} className="row">
            <Badge tone={p.method === "PIX" ? "brand" : "info"}>{p.method}</Badge>
            <div className="grow"><div className="title small">{CUSTOMERS.find((c) => c.id === p.customerId)?.tradeName}</div><div className="sub">{p.number} · {PAYMENT_REQUEST_STATUS[p.status].label}</div></div>
            <div className="end"><div className="num semi small">{brl(p.amountCents)}</div>
              {p.sla.level === "breached" ? <Badge tone="danger">+{Math.floor(p.sla.elapsedHours)}h</Badge> : <span className="xs muted">{Math.floor(p.sla.elapsedHours)}h</span>}</div>
          </div>
        ))}
        {!fq.queue.length && <Empty icon={<CheckCircle2 />} text="Nenhuma quitação pendente." />}
      </Card>

      <div className="grid g3 mt">
        <button className="action-tile" onClick={() => setQuick(true)}><span className="ic"><Zap size={20} /></span>Orçamento rápido</button>
        <button className="action-tile gold" onClick={() => goTab("customers")}><span className="ic"><ShoppingCart size={20} /></span>Novo pedido</button>
        <button className="action-tile" onClick={() => goTab("route")}><span className="ic"><CalendarClock size={20} /></span>Planejar semana</button>
      </div>

      {bucket !== null && (
        <Sheet title={`Rota de hoje · sem compra há ${bucketLabel(bucket, buckets)}`} onClose={() => setBucket(null)} wide>
          <CustomerTable list={route.buckets.find((b) => b.bucket === bucket)!.rows.map((r) => r.c)} onOpen={(c) => { setBucket(null); onOpen(c); }} />
        </Sheet>
      )}
      {quick && <QuickQuote onClose={() => setQuick(false)} />}
    </>
  );
}

function QuickQuote({ onClose }: { onClose: () => void }) {
  const c = CUSTOMERS.find((x) => x.sellerId === ME.id)!;
  return <OrderBuilder c={c} kind="SIMPLE_QUOTE" onClose={onClose} />;
}

function StatusTile({ icon, label, n, tone, onClick }: { icon: React.ReactNode; label: string; n: number; tone: "info" | "warning" | "success" | "brand"; onClick?: () => void }) {
  return (
    <button className="action-tile" onClick={onClick} style={{ minHeight: 96 }}>
      <span className="ic" style={{ background: `var(--${tone === "brand" ? "gold" : tone}-soft)`, color: `var(--${tone === "brand" ? "gold" : tone})` }}>{icon}</span>
      <span className="xs t2" style={{ fontWeight: 500 }}>{label}</span>
      <b className="num" style={{ fontSize: 18 }}>{n}</b>
    </button>
  );
}

function SellerCustomers({ onOpen }: { onOpen: (c: Customer) => void }) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [curve, setCurve] = useState<string | null>(null);
  const list = CUSTOMERS.filter((c) =>
    (scope === "all" || c.sellerId === ME.id) && (!curve || c.abcd === curve) &&
    (!q || `${c.tradeName} ${c.code} ${c.document} ${c.city}`.toLowerCase().includes(q.toLowerCase())),
  ).slice(0, 80);
  return (
    <>
      <h2 style={{ margin: "6px 0 12px" }}>Clientes</h2>
      <div className="search mb"><Search size={17} /><input className="input" placeholder="Nome, código, CNPJ ou cidade" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="chips mb">
        <Chip on={scope === "mine"} onClick={() => setScope("mine")}>Minha carteira</Chip>
        <Chip on={scope === "all"} onClick={() => setScope("all")}>Todas as carteiras</Chip>
        {["A", "B", "C", "D"].map((x) => <Chip key={x} on={curve === x} onClick={() => setCurve(curve === x ? null : x)}>Curva {x}</Chip>)}
      </div>
      <Card>
        <div className="list">
          {list.map((c) => c.sellerId === ME.id
            ? <CustomerRowView key={c.id} c={c} onClick={() => onOpen(c)} />
            : <CustomerRowView key={c.id} c={c} onClick={() => onOpen(c)} extra={<Badge tone="neutral">{sellerById.get(c.sellerId)?.name.split(" ")[0]}</Badge>} />)}
        </div>
      </Card>
    </>
  );
}

function SellerOrders() {
  useStore();
  const [kind, setKind] = useState<"ORDER" | "QUOTE">("ORDER");
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<Order | null>(null);
  const sortNewest = newestFirst<Order>((x) => x.createdAt);
  const all = (kind === "ORDER" ? ordersOf(ME.id) : quotesOf(ME.id)).sort(sortNewest);
  const groups: { id: string; label: string; statuses: string[] }[] = kind === "ORDER" ? [
    { id: "all", label: "Todos", statuses: [] },
    { id: "credit", label: "Aguardando crédito", statuses: AWAITING_CREDIT },
    { id: "billing", label: "Em faturamento", statuses: ["credit_approved", "scheduled_for_billing", "sent_to_billing", "billing_in_progress", "billing_error"] },
    { id: "invoiced", label: "Faturados", statuses: ["invoiced"] },
    { id: "route", label: "Em rota", statuses: IN_ROUTE },
    { id: "done", label: "Entregues", statuses: ["delivered", "completed"] },
  ] : [
    { id: "all", label: "Todos", statuses: [] },
    { id: "open", label: "Em aberto", statuses: OPEN_QUOTE },
    { id: "closed", label: "Encerrados", statuses: ["rejected", "expired", "cancelled", "converted"] },
  ];
  const g = groups.find((x) => x.id === filter) ?? groups[0]!;
  const list = g.statuses.length ? all.filter((o) => g.statuses.includes(o.status)) : all;
  const today = all.filter((o) => o.createdAt.startsWith(TODAY) && !["draft", "cancelled"].includes(o.status));
  return (
    <>
      <h2 style={{ margin: "6px 0 12px" }}>Meus pedidos</h2>
      <div className="chips mb">
        <Chip on={kind === "ORDER"} onClick={() => { setKind("ORDER"); setFilter("all"); }}>Pedidos</Chip>
        <Chip on={kind === "QUOTE"} onClick={() => { setKind("QUOTE"); setFilter("all"); }}>Orçamentos</Chip>
      </div>
      {kind === "ORDER" && (
        <div className="grid g2">
          <Kpi icon={<ShoppingCart size={17} />} label="Tirados hoje" value={today.length} foot={brl(today.reduce((a, o) => a + o.totalCents, 0))} />
          <Kpi icon={<Hourglass size={17} />} tone="gold" label="Aguardando crédito" value={countByStatus(all, AWAITING_CREDIT)} foot="toque no filtro abaixo" />
        </div>
      )}
      <div className="chips mb">
        {groups.map((x) => (
          <Chip key={x.id} on={filter === x.id} onClick={() => setFilter(x.id)}>
            {x.label} ({x.statuses.length ? all.filter((o) => x.statuses.includes(o.status)).length : all.length})
          </Chip>
        ))}
      </div>
      <Card title={g.label === "Todos" ? (kind === "ORDER" ? "Todos os pedidos" : "Todos os orçamentos") : g.label} sub="toque para ver itens e andamento">
        <div className="list">{list.map((o) => <OrderRow key={o.id} o={o} onClick={() => setOpen(o)} />)}</div>
        {!list.length && <Empty icon={<FileCheck2 />} text="Nenhum pedido neste filtro." />}
      </Card>
      {open && <OrderOpen order={open} canEdit onClose={() => setOpen(null)} />}
    </>
  );
}


function SellerRoute({ onOpen }: { onOpen: (c: Customer) => void }) {
  const [day, setDay] = useState(TODAY_ROUTE?.code ?? "R1");
  const [planned, setPlanned] = useState<Record<string, boolean>>({});
  const routeDef = PARAMS.commercialRoutes.find((r) => r.code === day)!;
  const list = CUSTOMERS.filter((c) => c.sellerId === ME.id && c.routeCode === day)
    .map(customerRow).sort((a, b) => (b.days ?? 999) - (a.days ?? 999));
  return (
    <>
      <h2 style={{ margin: "6px 0 4px" }}>Rotas e planejamento</h2>
      <p className="small muted mb">Planejamento da próxima semana carregado das rotas cadastradas. Ajuste visitas, dia e prioridade.</p>
      <div className="chips mb">
        {PARAMS.commercialRoutes.map((r) => (
          <Chip key={r.code} on={day === r.code} onClick={() => setDay(r.code)}>
            {r.name} · {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][r.weekday]}{r.code === TODAY_ROUTE?.code ? " (hoje)" : ""}
          </Chip>
        ))}
      </div>
      <Card title={`${routeDef.name} · ${list.length} clientes`} sub={day === TODAY_ROUTE?.code ? `hoje, ${dayLabel(TODAY)}` : "próxima semana"}>
        <div className="progress-row mb"><span className="xs muted">Prioridade sugerida: mais dias sem compra primeiro</span></div>
        <div className="list">
          {list.map(({ c, days }) => (
            <div key={c.id} className="row">
              <input type="checkbox" checked={planned[c.id] ?? true} onChange={(e) => setPlanned({ ...planned, [c.id]: e.target.checked })} style={{ width: 18, height: 18, accentColor: "var(--brand)" }} />
              <div className="grow click" onClick={() => onOpen(c)} style={{ cursor: "pointer" }}>
                <div className="title">{c.tradeName}</div>
                <div className="sub">{c.district} · últ. compra {fmtDate(c.lastPurchaseDate)}</div>
              </div>
              <div className="end"><span className={`bold num ${days !== null && days >= 21 ? "red" : ""}`}>{days === null ? "nunca" : `${days}d`}</span></div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-block mt" onClick={() => commit(() => {}, "Planejamento salvo · visível para a coordenação")}>Salvar planejamento</button>
      </Card>
      <p className="xs muted mt">Aprovação formal do planejamento: {PARAMS.planning.weeklyPlanApprovalRequired ? "exigida" : "não exigida (parâmetro configurável)"}</p>
    </>
  );
}
