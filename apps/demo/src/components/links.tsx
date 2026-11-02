/**
 * Destino de uma notificação ou alerta: abre a pendência certa
 * (pedido, comprovante, cliente, rota, ocorrência, lista filtrada) ou leva à aba certa.
 */
import { Fragment, useEffect, useState } from "react";
import { ClipboardList, Receipt, AlertTriangle } from "lucide-react";
import { daysBetween, PAYMENT_REQUEST_STATUS } from "@galato/domain";
import {
  ORDERS, PAYMENT_REQUESTS, CUSTOMERS, DELIVERY_ROUTES, FREEZER_OCCURRENCES, NONCONFORMITIES, INCIDENTS, EPI_REQUESTS,
  TRANSFER_REQUESTS, SELLERS, VEHICLES, DRIVERS, CURRENT_SELLER, PARAMS, TODAY, TODAY_ROUTE, customerById, sellerById,
  type NotifLink, type Order, type PaymentRequest, type Role,
} from "../data/mock";
import { financeQueue } from "../data/selectors";
import { newestFirst } from "../data/orders";
import { requestTab, useStore } from "../data/store";
import { Badge, Sheet, brl, Empty } from "./ui";
import { ProofView, InfoSheet } from "./details";
import { OrderOpen } from "./order-flow";
import { CustomerSheet, OrderRow, fmtDateTime } from "./business";
import { OccurrenceDetail } from "./freezer-occurrences";
import { RouteDetail } from "../screens/Ops";
import { SellerPanel, ClientList } from "../screens/Reports";
import { LeadSheet, viewerFor } from "./leads";
import { LEADS } from "../data/leads";

const MANAGER_ROLES: Role[] = ["sales_manager", "sales_coordinator", "general_manager"];
const isManager = (r: Role | null) => !!r && MANAGER_ROLES.includes(r);

/** Vendedores que o perfil enxerga (gerente comercial = equipe dele). */
function scopeOf(role: Role | null): string[] {
  if (role === "seller") return [CURRENT_SELLER.id];
  if (role === "sales_manager") return SELLERS.filter((s) => s.managerId === "m1").map((s) => s.id);
  return SELLERS.map((s) => s.id);
}

/** Vai para uma aba e fecha. */
let navigateDone: (() => void) | null = null;
function GoTab({ tab, onClose }: { tab: string; onClose: () => void }) {
  useEffect(() => { requestTab(tab); (navigateDone ?? onClose)(); }, []);
  return null;
}

export function LinkView({ link, onClose, onNavigate }: { link: NotifLink; onClose: () => void; onNavigate?: () => void }) {
  const s = useStore();
  navigateDone = onNavigate ?? null;
  const role = s.role;
  switch (link.t) {
    case "order": {
      const o = ORDERS.find((x) => x.id === link.id);
      if (!o) return <InfoSheet title="Pedido" rows={[["Situação", "Pedido não encontrado (dados restaurados?)"]]} onClose={onClose} />;
      return <OrderOpen order={o} canEdit={role === "seller" && o.sellerId === CURRENT_SELLER.id} onClose={onClose} />;
    }
    case "proof": {
      const p = PAYMENT_REQUESTS.find((x) => x.id === link.id);
      if (!p) return <InfoSheet title="Comprovante" rows={[["Situação", "Comprovante não encontrado"]]} onClose={onClose} />;
      if (role === "finance") return <FinanceGo onClose={onClose}><ProofView p={p} onClose={onClose} /></FinanceGo>;
      return <ProofView p={p} onClose={onClose} />;
    }
    case "customer": {
      const c = customerById.get(link.id);
      if (!c) return null;
      return <CustomerSheet c={c} viewerSellerId={role === "seller" ? CURRENT_SELLER.id : undefined} onClose={onClose} />;
    }
    case "route": {
      const r = DELIVERY_ROUTES.find((x) => x.id === link.id);
      if (!r) return null;
      return <RouteDetail r={r} onClose={onClose} />;
    }
    case "occ": {
      const o = FREEZER_OCCURRENCES.find((x) => x.id === link.id);
      if (!o) return null;
      return <OccurrenceDetail occ={o} viewer={role === "seller" ? "seller" : "manager"} onClose={onClose} />;
    }
    case "seller": return <SellerPanel id={link.id} onClose={onClose} />;
    case "nc": {
      if (role === "transport_coordinator") return <GoTab tab="issues" onClose={onClose} />;
      const n = NONCONFORMITIES.find((x) => x.id === link.id);
      if (!n) return null;
      const route = DELIVERY_ROUTES.find((r) => r.vehicleId === n.vehicleId || r.checklistVehicleId === n.vehicleId);
      return <NcSheet title={`Não conformidade · ${n.item}`} rows={[
        ["Veículo", VEHICLES.find((v) => v.id === n.vehicleId)?.plate ?? "—"], ["Motorista", DRIVERS.find((d) => d.id === n.driverId)?.name ?? "—"],
        ["Descrição", n.description], ["Gravidade", n.severity === "critical" ? "Crítica" : n.severity === "medium" ? "Média" : "Baixa"],
        ["Situação", n.status === "open" ? "Aberta" : n.status === "in_treatment" ? "Em tratamento" : "Resolvida"], ["Responsável", n.responsible ?? "—"],
      ]} routeId={route?.id} onClose={onClose} />;
    }
    case "incident": {
      if (role === "transport_coordinator") return <GoTab tab="issues" onClose={onClose} />;
      const i = INCIDENTS.find((x) => x.id === link.id);
      if (!i) return null;
      return <NcSheet title={`Ocorrência · ${i.type}`} rows={[
        ["Descrição", i.description], ["Motorista", DRIVERS.find((d) => d.id === i.driverId)?.name ?? "—"],
        ["Rota", DELIVERY_ROUTES.find((r) => r.id === i.routeId)?.name ?? "—"], ["Cliente", i.customerId ? customerById.get(i.customerId)?.tradeName ?? "—" : "—"],
        ["Situação", i.status === "open" ? "Aberta" : i.status === "in_treatment" ? "Em tratamento" : "Resolvida"],
      ]} routeId={i.routeId} onClose={onClose} />;
    }
    case "epi": {
      if (role === "driver") return <GoTab tab="history" onClose={onClose} />;
      if (role === "transport_coordinator") return <GoTab tab="home" onClose={onClose} />;
      const e = EPI_REQUESTS.find((x) => x.id === link.id);
      return e ? <InfoSheet title={`EPI · ${e.type}`} rows={[["Quantidade", `${e.qty} un.`], ["Motivo", e.reason], ["Motorista", DRIVERS.find((d) => d.id === e.driverId)?.name ?? "—"]]} onClose={onClose} /> : null;
    }
    case "transfer": {
      if (isManager(role)) return <GoTab tab="portfolio" onClose={onClose} />;
      const tr = TRANSFER_REQUESTS.find((x) => x.id === link.id);
      const c = tr ? customerById.get(tr.customerId) : undefined;
      return c ? <CustomerSheet c={c} viewerSellerId={role === "seller" ? CURRENT_SELLER.id : undefined} onClose={onClose} /> : null;
    }
    case "orders": return <OrdersListSheet title={link.title} statuses={link.statuses} scope={scopeOf(role)} canEdit={role === "seller"} onClose={onClose} />;
    case "proofs":
      if (role === "finance") return <GoTab tab="queue" onClose={onClose} />;
      return <ProofsListSheet title={link.title} late={!!link.late} scope={scopeOf(role)} onClose={onClose} />;
    case "clients-route": return <RouteClientsSheet sellerId={link.sellerId} days={link.days} onClose={onClose} />;
    case "lead": {
      const l = LEADS.find((x) => x.id === link.id);
      if (!l) return <InfoSheet title="Prospecção" rows={[["Situação", "Prospect não encontrado"]]} onClose={onClose} />;
      return <LeadSheet lead={l} viewer={viewerFor(role)} onClose={onClose} />;
    }
    case "tab": return <GoTab tab={link.tab} onClose={onClose} />;
  }
}

/** Financeiro: abre o comprovante e já deixa a fila de pendências atrás. */
function FinanceGo({ children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { requestTab("queue"); }, []);
  return <>{children}</>;
}

function NcSheet({ title, rows, routeId, onClose }: { title: string; rows: [string, React.ReactNode][]; routeId?: string; onClose: () => void }) {
  const [route, setRoute] = useState(false);
  const r = routeId ? DELIVERY_ROUTES.find((x) => x.id === routeId) : undefined;
  if (route && r) return <RouteDetail r={r} onClose={() => setRoute(false)} />;
  return (
    <Sheet title={title} onClose={onClose} icon={<AlertTriangle size={18} />}>
      <div className="card"><dl className="kv">{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl></div>
      {r && <button className="btn btn-ghost btn-block mt" onClick={() => setRoute(true)}>Ver a rota {r.name}</button>}
    </Sheet>
  );
}

/** Lista de pedidos filtrada (ex.: bloqueados pelo crédito). */
export function OrdersListSheet({ title, statuses, scope, canEdit, onClose }: { title: string; statuses: string[]; scope: string[]; canEdit?: boolean; onClose: () => void }) {
  useStore();
  const [open, setOpen] = useState<Order | null>(null);
  const list = ORDERS.filter((o) => o.kind === "ORDER" && scope.includes(o.sellerId) && statuses.includes(o.status)).sort(newestFirst<Order>((x) => x.createdAt));
  if (open) return <OrderOpen order={open} canEdit={!!canEdit && open.sellerId === CURRENT_SELLER.id} onClose={() => setOpen(null)} />;
  return (
    <Sheet title={`${title} (${list.length})`} onClose={onClose} icon={<ClipboardList size={18} />}>
      <p className="small muted mb">Toque no pedido para ver itens, linha do tempo e o que fazer.</p>
      <div className="list">{list.map((o) => <OrderRow key={o.id} o={o} onClick={() => setOpen(o)} />)}</div>
      {!list.length && <Empty icon={<ClipboardList />} text="Nenhum pedido nesta situação agora." />}
    </Sheet>
  );
}

/** Lista de comprovantes (ex.: sem resposta além do SLA). */
function ProofsListSheet({ title, late, scope, onClose }: { title: string; late: boolean; scope: string[]; onClose: () => void }) {
  useStore();
  const [open, setOpen] = useState<PaymentRequest | null>(null);
  const q = financeQueue().queue.filter((p) => scope.includes(p.sellerId) && (!late || p.sla.level === "breached"));
  if (open) return <ProofView p={open} onClose={() => setOpen(null)} />;
  return (
    <Sheet title={`${title} (${q.length})`} onClose={onClose} icon={<Receipt size={18} />}>
      <p className="small muted mb">Prazo de resposta do financeiro: {PARAMS.financialSla.responseHours}h. Toque para ver o comprovante.</p>
      {q.map((p) => (
        <div key={p.id} className="row click" onClick={() => setOpen(PAYMENT_REQUESTS.find((x) => x.id === p.id) ?? null)}>
          <Badge tone={p.method === "PIX" ? "brand" : "info"}>{p.method}</Badge>
          <div className="grow"><div className="title small">{customerById.get(p.customerId)?.tradeName}</div><div className="sub">{p.number} · {sellerById.get(p.sellerId)?.name} · {fmtDateTime(p.createdAt)}</div></div>
          <div className="end"><div className="num semi small">{brl(p.amountCents)}</div><Badge tone={p.sla.level === "breached" ? "danger" : "warning"}>{Math.floor(p.sla.elapsedHours)}h · {PAYMENT_REQUEST_STATUS[p.status].label}</Badge></div>
        </div>
      ))}
      {!q.length && <Empty icon={<Receipt />} text="Nenhum comprovante atrasado." />}
    </Sheet>
  );
}

/** Clientes da rota do dia sem compra há mais de N dias. */
function RouteClientsSheet({ sellerId, days, onClose }: { sellerId: string; days: number; onClose: () => void }) {
  const s = useStore();
  const [cust, setCust] = useState<string | null>(null);
  const list = CUSTOMERS.filter((c) => c.sellerId === sellerId && (!TODAY_ROUTE || c.routeCode === TODAY_ROUTE.code) && (!c.lastPurchaseDate || daysBetween(c.lastPurchaseDate, TODAY) > days));
  const c = cust ? customerById.get(cust) : undefined;
  if (c) return <CustomerSheet c={c} viewerSellerId={s.role === "seller" ? CURRENT_SELLER.id : undefined} onClose={() => setCust(null)} />;
  return (
    <Sheet title={`Clientes da rota sem compra (${list.length})`} onClose={onClose} wide>
      <ClientList items={list.map((x) => ({ c: x, days: x.lastPurchaseDate ? daysBetween(x.lastPurchaseDate, TODAY) : null }))} onOpen={setCust} />
    </Sheet>
  );
}

/** Linha de alerta clicável: abre a pendência ligada a ela. */
export function AlertLine({ tone, text, link, children }: { tone: "danger" | "warning"; text?: React.ReactNode; link?: NotifLink; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`alert-line ${link ? "click" : ""}`} style={link ? { cursor: "pointer" } : undefined} role={link ? "button" : undefined} tabIndex={link ? 0 : undefined}
        onClick={link ? () => setOpen(true) : undefined} onKeyDown={link ? (e) => { if (e.key === "Enter") setOpen(true); } : undefined}>
        <span className="dotc" style={{ background: tone === "danger" ? "var(--danger)" : "var(--gold)" }} />{children ?? text}
      </div>
      {open && link && <LinkView link={link} onClose={() => setOpen(false)} onNavigate={() => setOpen(false)} />}
    </>
  );
}
