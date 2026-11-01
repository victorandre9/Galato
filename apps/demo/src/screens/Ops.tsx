/** Coordenador de Transportes (desktop-first), Financeiro e Faturamento. */
import { useState } from "react";
import {
  LayoutDashboard, Route, AlertTriangle, MoreHorizontal, Layers, PlusCircle, Truck, Package, CheckCircle2, Activity,
  XCircle, Bell, FileUp, Users, Wallet, History, Clock, FileCheck2, Receipt, Check, Wrench, MapPin, HardHat,
} from "lucide-react";
import { PAYMENT_REQUEST_STATUS, DELIVERY_STATUS, ORDER_STATUS } from "@galato/domain";
import {
  PARAMS, DELIVERY_ROUTES, DRIVERS, VEHICLES, INCIDENTS, NONCONFORMITIES, PAYMENT_REQUESTS, ORDERS, TODAY, NOW,
  TRANSPORT_COORD, FINANCE_USER, BILLING_USER, customerById, sellerById, type DeliveryRoute, type PaymentRequest, type Order,
  EPI_REQUESTS, PROOFS, CUSTOMERS, nowStamp,
} from "../data/mock";
import { notify, MANAGERS_KEYS } from "../data/notify";
import { setOrderStatus } from "../data/orders";
import { EPI_STATUS } from "@galato/domain";
import { logisticsOverview, routeProgress, financeQueue, financial, dayLabel } from "../data/selectors";
import { commit, useStore } from "../data/store";
import { Shell, Greeting, ProfilePanel } from "../components/shell";
import { Card, Kpi, Sheet, Badge, Progress, Chip, brl, pct, Empty, SectionTitle, scrollToId } from "../components/ui";
import { DeliveryListSheet } from "./Manager";
import { fmtDate, fmtDateTime, CustomerName } from "../components/business";
import { OrderOpen } from "../components/order-flow";
import { ProofView } from "../components/details";
import { CustomerHistory } from "./Reports";

// =================================================================== TRANSPORTES
export function TransportApp() {
  const [tab, setTab] = useState("home");
  useStore();
  const log = logisticsOverview();
  const tabs = [
    { id: "home", label: "Início", icon: <LayoutDashboard size={20} /> },
    { id: "routes", label: "Rotas", icon: <Route size={20} /> },
    { id: "issues", label: "Ocorrências", icon: <AlertTriangle size={20} />, count: log.openIncidents.length + log.openNc.length },
    { id: "fleet", label: "Frota", icon: <Truck size={20} /> },
    { id: "more", label: "Mais", icon: <MoreHorizontal size={20} /> },
  ];
  return (
    <Shell tabs={tabs} tab={tab} onTab={setTab} roleLabel="Coordenador de Transportes" userName={TRANSPORT_COORD.name}>
      {tab === "home" && <TransportHome goTab={setTab} />}
      {tab === "routes" && <RoutesView />}
      {tab === "issues" && <IssuesView />}
      {tab === "fleet" && <FleetView />}
      {tab === "more" && <ProfilePanel name={TRANSPORT_COORD.name} role="Coordenador de Transportes / Logística" />}
    </Shell>
  );
}

function TransportHome({ goTab }: { goTab: (t: string) => void }) {
  const log = logisticsOverview();
  const [importing, setImporting] = useState<null | "system" | "manual">(null);
  const [detail, setDetail] = useState<DeliveryRoute | null>(null);
  const [list, setList] = useState<null | "all" | "delivered">(null);
  return (
    <>
      <Greeting icon={<Layers size={22} />} title={`Olá, ${TRANSPORT_COORD.name.split(" ")[0]}!`} sub="Gestão e controle das rotas" />
      <div className="grid g2 hero-actions">
        <button className="action-tile gold" onClick={() => setImporting("system")}><span className="ic"><Layers size={22} /></span>Rotas extraídas do sistema</button>
        <button className="action-tile" onClick={() => setImporting("manual")}><span className="ic"><PlusCircle size={22} /></span>Lançar rota manualmente</button>
      </div>

      <div className="grid g3 gd-4">
        <Kpi icon={<Route size={17} />} label="Rotas do dia" value={log.routes.length} foot={`${log.activeRoutes} em operação`} onClick={() => goTab("routes")} />
        <Kpi icon={<Package size={17} />} tone="gold" label="Entregas previstas" value={log.total} onClick={() => setList("all")} />
        <Kpi icon={<CheckCircle2 size={17} />} tone="success" label="Entregas realizadas" value={log.delivered} foot={`${log.pending} pendentes`} onClick={() => setList("delivered")} />
        <Kpi icon={<Activity size={17} />} tone="info" label="% concluído" value={pct(log.pct)} onClick={() => scrollToId("tempo-real")}>
          <Progress value={log.pct} />
        </Kpi>
      </div>
      <div className="grid g3 gd-4">
        <Kpi icon={<Users size={17} />} label="Motoristas em operação" value={`${log.activeRoutes}/${DRIVERS.length}`} onClick={() => goTab("fleet")} />
        <Kpi icon={<AlertTriangle size={17} />} tone="gold" label="Ocorrências" value={log.openIncidents.length} onClick={() => goTab("issues")} />
        <Kpi icon={<XCircle size={17} />} label="Não conformidades" value={log.openNc.length} onClick={() => goTab("issues")} />
        <Kpi icon={<Clock size={17} />} tone="info" label="Pendências do dia anterior" value={log.yesterdayPending} onClick={() => goTab("issues")} />
      </div>

      <div className="grid gd gd-2">
        <EpiCard />
        <InvoicedAwaitingRoute />
      </div>
      <Card title={`Alertas (${log.alerts.length})`} icon={<Bell size={17} />} className="mb">
        <div className="grid gd gd-2" style={{ gap: 4, marginBottom: 0 }}>
          {log.alerts.map((a, i) => <div key={i} className="alert-line"><span className="dotc" style={{ background: a.tone === "danger" ? "var(--danger)" : "var(--gold)" }} />{a.text}</div>)}
        </div>
        <div className="xs muted mt">Limites configuráveis: motorista sem iniciar após {PARAMS.logistics.driverNotStartedAlertAfter}; rota {PARAMS.logistics.routeBehindPacePercent} p.p. abaixo do ritmo.</div>
      </Card>
      {list && <DeliveryListSheet filter={list} onClose={() => setList(null)} />}
      <Card id="tempo-real" title="Entregas em tempo real" icon={<MapPin size={17} />} link="Rotas" onLink={() => goTab("routes")}>
        <RoutesTable onOpen={setDetail} />
      </Card>
      {importing && <ImportSheet mode={importing} onClose={() => setImporting(null)} />}
      {detail && <RouteDetail r={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function RoutesTable({ onOpen }: { onOpen: (r: DeliveryRoute) => void }) {
  const log = logisticsOverview();
  return (
    <>
      <div className="only-mobile list">
        {log.routes.map(({ r, p, driver }) => (
          <div key={r.id} className="row click" onClick={() => onOpen(r)}>
            <div className="grow">
              <div className="title">{r.code} · {r.name}</div>
              <div className="sub">{driver.name} · {p.status}</div>
              <div style={{ marginTop: 5 }}><Progress thin value={p.pct} color={p.behind ? undefined : "green"} /></div>
            </div>
            <div className="end"><div className="semi num">{p.delivered}/{p.total}</div>{p.behind ? <Badge tone="warning">Atrasada</Badge> : !r.startedAt ? <Badge tone="danger">Não iniciou</Badge> : null}</div>
          </div>
        ))}
      </div>
      <div className="only-desktop table-wrap">
        <table className="t">
          <thead><tr><th>Rota</th><th>Motorista</th><th>Veículo</th><th>Origem</th><th>Status</th><th className="r">Entregues</th><th className="r">Pend.</th><th className="r">Falhas</th><th>Progresso</th></tr></thead>
          <tbody>
            {log.routes.map(({ r, p, driver, vehicle }) => (
              <tr key={r.id} className="click" onClick={() => onOpen(r)}>
                <td className="semi">{r.code} · {r.name}</td><td>{driver.name}</td><td>{vehicle.plate}</td>
                <td><Badge tone="neutral">{r.source === "system" ? "Sistema" : r.source === "manual_pdf" ? "PDF manifesto" : "Manual"}</Badge></td>
                <td><Badge tone={!r.startedAt ? "danger" : p.behind ? "warning" : "brand"}>{!r.startedAt ? "Não iniciou" : p.behind ? "Abaixo do ritmo" : p.status}</Badge></td>
                <td className="r green semi">{p.delivered}</td><td className="r">{p.pending}</td><td className="r red">{p.failed}</td>
                <td style={{ minWidth: 150 }}><div className="progress-row"><Progress value={p.pct} color="green" /><b className="xs num">{pct(p.pct)}</b></div>{p.expectedPct !== null && <div className="xs muted">esperado {pct(p.expectedPct)}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function RouteDetail({ r, onClose }: { r: DeliveryRoute; onClose: () => void }) {
  const [zoom, setZoom] = useState<string | null>(null);
  const [cust, setCust] = useState<string | null>(null);
  const p = routeProgress(r);
  const toTable = () => scrollToId(`route-table-${r.id}`);
  const driver = DRIVERS.find((d) => d.id === r.driverId)!;
  const vehicle = VEHICLES.find((v) => v.id === r.vehicleId)!;
  return (
    <Sheet title={`${r.code} · ${r.name}`} onClose={onClose} wide icon={<Route size={18} />}>
      <div className="grid g2 gd-4">
        <Kpi label="Motorista" onClick={toTable} value={<span style={{ fontSize: 15 }}>{driver.name}</span>} foot={driver.phone} />
        <Kpi label="Veículo" onClick={() => scrollToId(`route-check-${r.id}`)} value={<span style={{ fontSize: 15 }}>{vehicle.plate}</span>} foot={vehicle.model} />
        <Kpi label="Entregues" tone="success" onClick={toTable} value={`${p.delivered}/${p.total}`} foot={pct(p.pct)} />
        <Kpi label="Início" tone="gold" onClick={toTable} value={<span style={{ fontSize: 15 }}>{r.startedAt ? new Date(r.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: PARAMS.timezone }) : "não iniciou"}</span>} />
      </div>
      <div id={`route-check-${r.id}`}><ChecklistSummary r={r} /></div>
      <Card id={`route-table-${r.id}`} sub="toque na entrega para ver o cliente">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>#</th><th>Cliente</th><th>Nota</th><th className="r">Vol.</th><th>Status</th><th>Detalhe</th></tr></thead>
            <tbody>
              {r.deliveries.map((d) => (
                <tr key={d.id} className="click" onClick={() => setCust(d.customerId)}>
                  <td>{d.seq}</td><td><CustomerName id={d.customerId} /></td><td>{d.invoiceNumber}</td><td className="r">{d.volumes}</td>
                  <td><Badge tone={DELIVERY_STATUS[d.status].tone}>{DELIVERY_STATUS[d.status].label}</Badge></td>
                  <td className="small">
                    {(() => { const pf = PROOFS.find((x) => x.deliveryId === d.id); return pf
                      ? <a href={pf.dataUrl} target="_blank" rel="noreferrer" className="flex" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setZoom(pf.dataUrl); }}><img className="proof-thumb" src={pf.dataUrl} alt="Comprovante" /> {pf.type}</a>
                      : d.nonDeliveryReason ?? (d.proofName ? `✓ ${d.proofName}` : ""); })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {zoom && <Sheet title="Comprovante de entrega" onClose={() => setZoom(null)}><div className="photo-preview"><img src={zoom} alt="Comprovante" /></div></Sheet>}
      {cust && <CustomerHistory id={cust} onClose={() => setCust(null)} />}
    </Sheet>
  );
}

function ImportSheet({ mode, onClose }: { mode: "system" | "manual"; onClose: () => void }) {
  const [step, setStep] = useState(mode === "system" ? 1 : 0);
  const [driver, setDriver] = useState(DRIVERS[1]!.id);
  const [vehicle, setVehicle] = useState(VEHICLES[1]!.id);
  const [name, setName] = useState("Rota 7 — Contagem 2");
  const sample = CUSTOMERS.filter((c) => c.city === "Contagem").slice(0, 3);
  const extractedReal = sample.map((c, k) => ({ nf: `NF ${125911 + k}`, customer: c.tradeName, customerId: c.id, vol: [18, 12, 40][k]!, ok: true }));
  const extracted = [...extractedReal, { nf: "NF 125918", customer: "Bar do Zé", customerId: "", vol: 6, ok: false }];
  return (
    <Sheet title={mode === "system" ? "Rotas extraídas do sistema" : "Lançar rota manualmente"} onClose={onClose} wide icon={mode === "system" ? <Layers size={18} /> : <FileUp size={18} />}>
      <p className="small muted mb">{mode === "system"
        ? "A roteirização continua no sistema atual. Rotas chegam via integração; aqui você só vincula motorista e veículo."
        : "Contingência: importe o PDF do manifesto. O sistema extrai notas e clientes e você confere antes de confirmar."}</p>
      {step === 0 && (
        <div className="upload" onClick={() => setStep(1)} style={{ padding: 40 }}><FileUp size={28} /><br />Selecionar PDF do manifesto</div>
      )}
      {step >= 1 && (
        <div className="grid gd gd-12">
          <Card title="Vincular">
            <div className="field"><label>Nome da rota</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label>Motorista</label><select className="input" value={driver} onChange={(e) => setDriver(e.target.value)}>{DRIVERS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div className="field"><label>Veículo</label><select className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>{VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.model}</option>)}</select></div>
          </Card>
          <Card title={`Conferência · ${extracted.length} notas extraídas`}>
            {extracted.map((x) => (
              <div key={x.nf} className="row">
                {x.ok ? <CheckCircle2 size={18} className="green" /> : <AlertTriangle size={18} className="gold" />}
                <div className="grow"><div className="title small">{x.customer}</div><div className="sub">{x.nf} · {x.vol} volumes</div></div>
                {!x.ok && <Badge tone="warning">Cliente não encontrado — associar</Badge>}
              </div>
            ))}
            <div className="xs muted mt">Notas com cliente não encontrado ficam fora até serem associadas.</div>
            <button className="btn btn-primary btn-block mt" onClick={() => {
              commit(() => {
                const n = DELIVERY_ROUTES.length + 1;
                DELIVERY_ROUTES.push({
                  id: `rt-new-${Date.now()}`, code: `R${String(n).padStart(2, "0")}`, name, date: TODAY, source: mode === "system" ? "system" : "manual_pdf",
                  driverId: driver, vehicleId: vehicle, startedAt: null, finishedAt: null, expectedEnd: "17:00",
                  deliveries: extractedReal.map((x, k) => ({ id: `dl-new-${Date.now()}-${k}`, seq: k + 1, customerId: x.customerId, invoiceNumber: x.nf, orderNumber: "—", volumes: x.vol, status: "scheduled" as const })),
                });
                notify({ kind: "logistica", title: "Nova rota atribuída", text: `Rota ${name} com ${extractedReal.length} entregas atribuída a você.`, to: [`driver:${driver}`] });
              }, `Rota “${name}” confirmada e atribuída · motorista notificado`);
              onClose();
            }}>Confirmar importação</button>
          </Card>
        </div>
      )}
    </Sheet>
  );
}

function RoutesView() {
  const [detail, setDetail] = useState<DeliveryRoute | null>(null);
  return (
    <>
      <h2 style={{ margin: "6px 0 4px" }}>Rotas · {dayLabel(TODAY)}</h2>
      <p className="small muted mb">Código interno + nome amigável (renomeável). Clique para detalhar.</p>
      <Card><RoutesTable onOpen={setDetail} /></Card>
      {detail && <RouteDetail r={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function IssuesView() {
  return (
    <>
      <h2 style={{ margin: "6px 0 12px" }}>Ocorrências e não conformidades</h2>
      <div className="grid gd gd-2">
        <Card title="Ocorrências" icon={<AlertTriangle size={17} />}>
          {INCIDENTS.map((i) => (
            <div key={i.id} className="row" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <div className="title">{i.type}</div>
                <div className="small t2" style={{ whiteSpace: "normal" }}>{i.description}</div>
                <div className="sub">{DRIVERS.find((d) => d.id === i.driverId)?.name} · {DELIVERY_ROUTES.find((r) => r.id === i.routeId)?.name} · {fmtDate(i.createdAt)}{i.customerId ? ` · ${customerById.get(i.customerId)?.tradeName}` : ""}</div>
              </div>
              {i.status === "resolved" ? <Badge tone="success">Resolvida</Badge>
                : <button className="btn btn-soft btn-sm" onClick={() => commit(() => { i.status = i.status === "open" ? "in_treatment" : "resolved"; }, "Ocorrência atualizada")}>{i.status === "open" ? "Tratar" : "Resolver"}</button>}
            </div>
          ))}
        </Card>
        <Card title="Não conformidades" icon={<Wrench size={17} />}>
          {NONCONFORMITIES.map((n) => (
            <div key={n.id} className="row" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <div className="flex"><span className="title">{n.item}</span>{n.severity === "critical" && <Badge tone="danger">Crítica</Badge>}</div>
                <div className="small t2" style={{ whiteSpace: "normal" }}>{n.description}</div>
                <div className="sub">{VEHICLES.find((v) => v.id === n.vehicleId)?.plate} · {DRIVERS.find((d) => d.id === n.driverId)?.name} · resp. {n.responsible}</div>
              </div>
              {n.status === "resolved" ? <Badge tone="success">Resolvida</Badge>
                : <button className="btn btn-soft btn-sm" onClick={() => commit(() => { n.status = n.status === "open" ? "in_treatment" : "resolved"; }, "Não conformidade atualizada")}>{n.status === "open" ? "Tratar" : "Resolver"}</button>}
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

function FleetView() {
  useStore();
  const log = logisticsOverview();
  const [open, setOpen] = useState<DeliveryRoute | null>(null);
  return (
    <>
      <h2 style={{ margin: "6px 0 12px" }}>Motoristas e veículos</h2>
      <Card>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Motorista</th><th>Veículo</th><th>Rota</th><th>Situação</th><th className="r">Entregas</th><th>NC abertas</th></tr></thead>
            <tbody>
              {log.routes.map(({ r, p, driver, vehicle }) => (
                <tr key={r.id} className="click" onClick={() => setOpen(r)}>
                  <td className="semi">{driver.name}</td><td>{vehicle.plate} · {vehicle.model}</td><td>{r.name}</td>
                  <td><Badge tone={r.startedAt ? "success" : "danger"}>{r.startedAt ? "Em operação" : "Não iniciou"}</Badge></td>
                  <td className="r">{p.delivered}/{p.total}</td>
                  <td>{NONCONFORMITIES.filter((n) => n.vehicleId === vehicle.id && n.status !== "resolved").length || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {open && <RouteDetail r={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// =================================================================== FINANCEIRO
export function FinanceApp() {
  const [tab, setTab] = useState("queue");
  useStore();
  const fq = financeQueue();
  const tabs = [
    { id: "queue", label: "Pendências", icon: <Wallet size={20} />, count: fq.breached },
    { id: "history", label: "Histórico", icon: <History size={20} /> },
    { id: "more", label: "Perfil", icon: <MoreHorizontal size={20} /> },
  ];
  return (
    <Shell tabs={tabs} tab={tab} onTab={setTab} roleLabel="Financeiro / Crédito" userName={FINANCE_USER.name}>
      {tab === "queue" && <FinanceQueue />}
      {tab === "history" && <FinanceHistory />}
      {tab === "more" && <ProfilePanel name={FINANCE_USER.name} role="Financeiro / Crédito" />}
    </Shell>
  );
}

function FinanceQueue() {
  const fq = financeQueue();
  const [filter, setFilter] = useState<"all" | "PIX" | "BOLETO" | "late">("all");
  const [open, setOpen] = useState<PaymentRequest | null>(null);
  const blocked = ORDERS.filter((o) => o.kind === "ORDER" && ["blocked", "awaiting_credit_review", "in_approval"].includes(o.status));
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const list = fq.queue.filter((q) => filter === "all" || (filter === "late" ? q.sla.level === "breached" : q.method === filter));
  return (
    <>
      <Greeting icon={<Wallet size={22} />} title={`Olá, ${FINANCE_USER.name.split(" ")[0]}!`} sub="Pagamentos que precisam ser verificados agora" />
      <div className="grid g2 gd-4">
        <Kpi icon={<Receipt size={17} />} label="Pendentes" value={fq.queue.length} foot={`${fq.carryOver} do dia anterior`} onClick={() => { setFilter("all"); scrollToId("fila"); }} />
        <Kpi icon={<Clock size={17} />} tone="red" label={`Sem resposta > ${PARAMS.financialSla.responseHours}h`} value={fq.breached} onClick={() => { setFilter("late"); scrollToId("fila"); }} foot="alerta para gerente, coordenação e vendedor" />
        <Kpi tone="gold" label="PIX" value={fq.pix} foot="prioridade" onClick={() => { setFilter("PIX"); scrollToId("fila"); }} />
        <Kpi tone="info" label="Pedidos aguardando crédito" value={blocked.length} onClick={() => scrollToId("aguardando-credito")} />
      </div>
      <div className="grid gd gd-21">
        <Card id="fila" title="Fila priorizada" sub="dia anterior → PIX → boleto">
          <div className="chips mb">
            <Chip on={filter === "all"} onClick={() => setFilter("all")}>Todas</Chip>
            <Chip on={filter === "PIX"} onClick={() => setFilter("PIX")}>PIX</Chip>
            <Chip on={filter === "BOLETO"} onClick={() => setFilter("BOLETO")}>Boleto</Chip>
            <Chip on={filter === "late"} onClick={() => setFilter("late")}>&gt; 24h</Chip>
          </div>
          {list.map((p, i) => (
            <div key={p.id} className="row click" onClick={() => setOpen(p)}>
              <span className="pos">{i + 1}</span>
              <Badge tone={p.method === "PIX" ? "brand" : "info"}>{p.method}</Badge>
              <div className="grow">
                <div className="title">{customerById.get(p.customerId)?.tradeName}</div>
                <div className="sub">{p.number} · {p.receivableDoc} · {sellerById.get(p.sellerId)?.name}{p.carryOver ? " · dia anterior" : ""}</div>
              </div>
              <div className="end">
                <div className="num semi">{brl(p.amountCents)}</div>
                <Badge tone={p.sla.level === "breached" ? "danger" : p.sla.level === "warning" ? "warning" : "success"}><Clock size={11} /> {Math.floor(p.sla.elapsedHours)}h</Badge>
              </div>
            </div>
          ))}
          {!list.length && <Empty icon={<CheckCircle2 />} text="Fila zerada." />}
        </Card>
        <Card id="aguardando-credito" title="Pedidos aguardando crédito">
          {blocked.slice(0, 8).map((o) => (
            <div key={o.id} className="row">
              <div className="grow click" style={{ cursor: "pointer" }} onClick={() => setOpenOrder(o)}><div className="title small">{o.number} · <CustomerName id={o.customerId} /></div><div className="sub">{brl(o.totalCents)} · {o.fiscalDoc === "sem_nf" ? "sem NF" : "com NF"} · emitido {fmtDateTime(o.createdAt)} · {ORDER_STATUS[o.status as keyof typeof ORDER_STATUS].label}</div></div>
              <button className="btn btn-soft btn-sm" onClick={() => commit(() => {
                setOrderStatus(o, "credit_approved", FINANCE_USER.name, "Pedido liberado pelo crédito");
                notify({ kind: "financeiro", title: "Pedido liberado pelo crédito", text: `${o.number} · ${customerById.get(o.customerId)?.tradeName} · ${brl(o.totalCents)} segue para faturamento.`, to: [`seller:${o.sellerId}`, "billing"] });
              }, `${o.number} liberado pelo crédito · segue para faturamento`)}>Liberar</button>
            </div>
          ))}
        </Card>
      </div>
      {openOrder && <OrderOpen order={openOrder} canEdit={false} onClose={() => setOpenOrder(null)} />}
      {open && <AnalyzeSheet p={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function AnalyzeSheet({ p: view, onClose }: { p: PaymentRequest; onClose: () => void }) {
  // a fila entrega uma cópia; a resposta precisa ir para o registro original
  const p = PAYMENT_REQUESTS.find((x) => x.id === view.id) ?? view;
  const c = customerById.get(p.customerId)!;
  const f = financial(c);
  const answers: [PaymentRequest["status"], string][] = [
    ["confirmed", "Pagamento confirmado"], ["not_identified", "Não identificado"], ["incorrect_receipt", "Comprovante incorreto"],
    ["divergence", "Divergência"], ["rejected", "Reprovado"], ["other", "Outro motivo"],
  ];
  return (
    <Sheet title={`Análise · ${p.number}`} onClose={onClose} wide icon={<Receipt size={18} />}>
      <div className="grid gd gd-2">
        <Card>
          <dl className="kv">
            <dt>Cliente</dt><dd>{c.code} · {c.tradeName}</dd><dt>Vendedor</dt><dd>{sellerById.get(p.sellerId)?.name}</dd>
            <dt>Método</dt><dd>{p.method}</dd><dt>Débito</dt><dd>{p.receivableDoc}</dd><dt>Valor</dt><dd className="num">{brl(p.amountCents)}</dd>
            <dt>Enviado em</dt><dd>{new Date(p.createdAt).toLocaleString("pt-BR", { timeZone: PARAMS.timezone })}</dd>
          </dl>
          <div className="divider" />
          <dl className="kv"><dt>Em aberto</dt><dd>{brl(f.openCents)}</dd><dt>Vencido</dt><dd className="red">{brl(f.overdueCents)}</dd><dt>Média de atraso</dt><dd>{f.averageDelayDays.toFixed(1)} d</dd></dl>
        </Card>
        <Card>
          {p.attachmentDataUrl
            ? <div className="photo-preview"><img src={p.attachmentDataUrl} alt="Comprovante de pagamento" /></div>
            : <div className="upload done" style={{ padding: 30 }}>📎 {p.attachmentName}</div>}
          <div className="semi mt mb">Responder</div>
          <div className="grid g2" style={{ marginBottom: 0 }}>
            {answers.map(([st, label]) => (
              <button key={st} className={`btn btn-sm ${st === "confirmed" ? "btn-primary" : "btn-ghost"}`} onClick={() => {
                commit(() => {
                  p.status = st; p.respondedAt = nowStamp();
                  notify({ kind: "financeiro", priority: st === "confirmed" ? "normal" : "high", title: `Comprovante ${p.number}: ${label}`, text: `${c.tradeName} · ${p.method} · ${brl(p.amountCents)}.`, to: [`seller:${p.sellerId}`, "sales_manager"] });
                }, `${label} · vendedor e gerente notificados`);
                onClose();
              }}>{st === "confirmed" && <Check size={14} />} {label}</button>
            ))}
          </div>
        </Card>
      </div>
    </Sheet>
  );
}

function FinanceHistory() {
  useStore();
  const [open, setOpen] = useState<(typeof PAYMENT_REQUESTS)[number] | null>(null);
  const done = PAYMENT_REQUESTS.filter((p) => !["pending", "in_analysis"].includes(p.status));
  return (
    <>
      <h2 style={{ margin: "6px 0 12px" }}>Histórico de solicitações</h2>
      <Card>
        {done.map((p) => (
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

// =================================================================== FATURAMENTO
export function BillingApp() {
  const [tab, setTab] = useState("board");
  useStore();
  const tabs = [
    { id: "board", label: "Faturamento", icon: <FileCheck2 size={20} /> },
    { id: "more", label: "Perfil", icon: <MoreHorizontal size={20} /> },
  ];
  return (
    <Shell tabs={tabs} tab={tab} onTab={setTab} roleLabel="Faturamento" userName={BILLING_USER.name}>
      {tab === "board" && <BillingBoard />}
      {tab === "more" && <ProfilePanel name={BILLING_USER.name} role="Faturamento" />}
    </Shell>
  );
}

function BillingBoard() {
  useStore();
  const [openOrder, setOpenOrder] = useState<(typeof ORDERS)[number] | null>(null);
  const cols: { id: string; title: string; statuses: string[]; next?: [string, string] }[] = [
    { id: "todo", title: "Liberados pelo crédito · a faturar", statuses: ["credit_approved", "scheduled_for_billing", "sent_to_billing", "billing_in_progress", "billing_error"], next: ["invoiced", "Faturar"] },
    { id: "done", title: "Faturados", statuses: ["invoiced"] },
  ];
  const orders = ORDERS.filter((o) => o.kind === "ORDER");
  return (
    <>
      <Greeting icon={<FileCheck2 size={22} />} title={`Olá, ${BILLING_USER.name.split(" ")[0]}!`} sub="Pedidos liberados pelo crédito → notas → logística" />
      <div className="grid g2 gd-4">
        {cols.map((c) => <Kpi key={c.id} onClick={() => scrollToId(`col-${c.id}`)} label={c.id === "todo" ? "A faturar" : c.title} tone="gold" value={orders.filter((o) => c.statuses.includes(o.status)).length} />)}
      </div>
      <div className="grid gd" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {cols.map((col) => {
          const list = orders.filter((o) => col.statuses.includes(o.status));
          return (
            <Card key={col.id} id={`col-${col.id}`} title={`${col.title} (${list.length})`}>
              {list.slice(0, 10).map((o) => (
                <div key={o.id} className="row" style={{ alignItems: "flex-start" }}>
                  <div className="grow click" style={{ cursor: "pointer" }} onClick={() => setOpenOrder(o)}>
                    <div className="title small">{o.number} · <CustomerName id={o.customerId} /></div>
                    <div className="sub">{brl(o.totalCents)} · {sellerById.get(o.sellerId)?.name.split(" ")[0]} · emitido {fmtDateTime(o.createdAt)}{o.fiscalDoc && <> · <span className={`nf-tag ${o.fiscalDoc}`}>{o.fiscalDoc === "com_nf" ? "com NF" : "sem NF"}</span></>}</div>
                    {o.billingError && <div className="xs red semi" style={{ whiteSpace: "normal" }}>{o.billingError}</div>}
                    {o.invoiceNumber && col.id === "done" && <div className="xs green semi">{o.invoiceNumber} · disponível para logística</div>}
                  </div>
                  {col.next && <button className="btn btn-soft btn-sm" onClick={() => commit(() => {
                    setOrderStatus(o, col.next![0], BILLING_USER.name, col.next![0] === "invoiced" && o.fiscalDoc === "sem_nf" ? "Faturado sem nota fiscal" : undefined);
                    if (o.status === "invoiced") notify({ kind: "comercial", title: "Pedido faturado", text: `${o.number} · ${customerById.get(o.customerId)?.tradeName} faturado. Nota disponível para a logística.`, to: [`seller:${o.sellerId}`, "transport_coordinator"] });
                    if (o.status === "invoiced" && o.fiscalDoc !== "sem_nf") o.invoiceNumber = `NF ${126000 + Math.floor(Math.random() * 900)}`;
                    if (o.status !== "billing_error") o.billingError = undefined;
                  }, `${o.number}: ${ORDER_STATUS[col.next![0] as keyof typeof ORDER_STATUS].label}`)}>{col.next[1]}</button>}
                </div>
              ))}
              {!list.length && <div className="small muted">Vazio.</div>}
            </Card>
          );
        })}
      </div>
      {openOrder && <OrderOpen order={openOrder} canEdit={false} onClose={() => setOpenOrder(null)} />}
    </>
  );
}

// ------------------------------------------------------------------- EPI (coordenação)
function EpiCard() {
  useStore();
  const open = EPI_REQUESTS.filter((e) => !["delivered", "rejected"].includes(e.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const next: Record<string, [string, string][]> = {
    requested: [["approved", "Aprovar"], ["rejected", "Recusar"]],
    in_analysis: [["approved", "Aprovar"], ["rejected", "Recusar"]],
    approved: [["delivered", "Entregue"], ["awaiting_purchase", "Aguard. compra"]],
    awaiting_purchase: [["delivered", "Entregue"]],
  };
  return (
    <Card title={`Solicitações de EPI (${open.length})`} icon={<HardHat size={17} />}>
      {open.map((e) => {
        const st = EPI_STATUS[e.status as keyof typeof EPI_STATUS];
        const driver = DRIVERS.find((d) => d.id === e.driverId);
        return (
          <div key={e.id} className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <div className="grow">
              <div className="title">{e.qty}× {e.type}</div>
              <div className="sub">{driver?.name} · {fmtDate(e.createdAt)} · {e.reason}</div>
              <div style={{ marginTop: 4 }}><Badge tone={st.tone}>{st.label}</Badge></div>
            </div>
            <div className="flex" style={{ gap: 6 }}>
              {(next[e.status] ?? []).map(([to, label]) => (
                <button key={to} className={`btn btn-sm ${to === "rejected" ? "btn-ghost" : "btn-soft"}`} onClick={() => commit(() => {
                  e.status = to;
                  notify({ kind: "operacional", title: `EPI: ${EPI_STATUS[to as keyof typeof EPI_STATUS].label}`, text: `Sua solicitação de ${e.qty}× ${e.type} foi atualizada.`, to: [`driver:${e.driverId}`] });
                }, `EPI ${EPI_STATUS[to as keyof typeof EPI_STATUS].label.toLowerCase()} · motorista avisado`)}>{label}</button>
              ))}
            </div>
          </div>
        );
      })}
      {!open.length && <Empty icon={<CheckCircle2 />} text="Nenhuma solicitação de EPI pendente." />}
    </Card>
  );
}

// ------------------------------------------------------------------- notas faturadas → rota
function InvoicedAwaitingRoute() {
  useStore();
  const linked = new Set(DELIVERY_ROUTES.flatMap((r) => r.deliveries.map((d) => d.orderId).filter(Boolean)));
  const list = ORDERS.filter((o) => o.kind === "ORDER" && o.status === "invoiced" && !linked.has(o.id)).slice(0, 8);
  const [route, setRoute] = useState<Record<string, string>>({});
  return (
    <Card title={`Notas faturadas aguardando rota (${list.length})`} icon={<FileCheck2 size={17} />} sub="vindas do faturamento">
      {list.map((o) => {
        const c = customerById.get(o.customerId)!;
        const rid = route[o.id] ?? DELIVERY_ROUTES[0]!.id;
        return (
          <div key={o.id} className="row" style={{ flexWrap: "wrap" }}>
            <div className="grow" style={{ minWidth: 160 }}>
              <div className="title small">{o.invoiceNumber ?? `${o.number} · sem NF`} · {c.tradeName}</div>
              <div className="sub">{o.number} · {c.city} · {sellerById.get(o.sellerId)?.name.split(" ")[0]}</div>
            </div>
            <select id={`route-${o.id}`} className="input" style={{ width: "auto", padding: "7px 10px", fontSize: 12.5 }} value={rid} onChange={(e) => setRoute({ ...route, [o.id]: e.target.value })}>
              {DELIVERY_ROUTES.filter((r) => !r.finishedAt).map((r) => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
            </select>
            <button className="btn btn-soft btn-sm" onClick={() => commit(() => {
              const r = DELIVERY_ROUTES.find((x) => x.id === rid)!;
              const vol = o.items.reduce((a, it) => a + it.qty, 0);
              r.deliveries.push({ id: `dl-${o.id}`, seq: r.deliveries.length + 1, customerId: o.customerId, invoiceNumber: o.invoiceNumber ?? (o.fiscalDoc === "sem_nf" ? `${o.number} (sem NF)` : "NF —"), orderNumber: o.number, volumes: vol, status: r.startedAt ? "in_transit" : "scheduled", orderId: o.id });
              setOrderStatus(o, r.startedAt ? "in_transit" : "in_delivery_route", TRANSPORT_COORD.name, `Em rota de entrega · ${r.name} · placa ${VEHICLES.find((v) => v.id === r.vehicleId)?.plate ?? "—"}`);
              notify({ kind: "logistica", title: "Nova entrega na sua rota", text: `${c.tradeName} · ${o.invoiceNumber} · ${vol} volumes.`, to: [`driver:${r.driverId}`] });
              notify({ kind: "logistica", title: "Pedido em rota de entrega", text: `${o.number} · ${c.tradeName} entrou na rota ${r.name} · placa ${VEHICLES.find((v) => v.id === r.vehicleId)?.plate ?? "—"}.`, to: [`seller:${o.sellerId}`] });
            }, `${o.invoiceNumber} incluída na rota · motorista avisado`)}>Incluir</button>
          </div>
        );
      })}
      {!list.length && <Empty icon={<CheckCircle2 />} text="Nenhuma nota aguardando rota." />}
    </Card>
  );
}

/** Resumo do checklist do veículo de uma rota (para coordenação e gestão). */
export function ChecklistSummary({ r }: { r: DeliveryRoute }) {
  const ncs = NONCONFORMITIES.filter((n) => n.vehicleId === (r.checklistVehicleId ?? r.vehicleId) && n.status !== "resolved");
  return (
    <Card className="mb">
      <div className="flex between wrap" style={{ gap: 8 }}>
        <span className="semi">Checklist do veículo</span>
        {r.checklistDone
          ? <Badge tone={r.checklistNcs?.length ? "warning" : "success"}>Realizado {r.checklistAt ? `às ${new Date(r.checklistAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}{r.checklistNcs?.length ? ` · ${r.checklistNcs.length} não conformidade(s)` : " · sem problemas"}</Badge>
          : <Badge tone="danger">Não realizado</Badge>}
      </div>
      {ncs.length > 0 && (
        <div className="mt">
          {ncs.map((n) => (
            <div key={n.id} className="alert-line"><span className="dotc" style={{ background: n.severity === "critical" ? "var(--danger)" : "var(--gold)" }} />
              <span><b>{n.item}</b> · {n.description} <span className="muted">({n.status === "open" ? "aberta" : "em tratamento"})</span></span></div>
          ))}
        </div>
      )}
    </Card>
  );
}
