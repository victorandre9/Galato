/**
 * Liberações: tudo que espera decisão da gestão num lugar só.
 * Supervisor comercial: aprovações comerciais. Gerente geral: as mesmas + logística + acompanhamento do financeiro.
 */
import { useState } from "react";
import { ShieldCheck, ChevronRight, Briefcase, Snowflake, UserPlus, Truck, ClipboardList, Receipt, HardHat, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ORDERS, TRANSFER_REQUESTS, FREEZER_OCCURRENCES, YESTERDAY_DELIVERIES, EPI_REQUESTS, customerById, type NotifLink, type Role } from "../data/mock";
import { LEADS } from "../data/leads";
import { financeQueue, logisticsOverview, AWAITING_CREDIT } from "../data/selectors";
import { useStore } from "../data/store";
import { Card, Empty, Badge } from "./ui";
import { LinkView } from "./links";
import { LeadListSheet } from "./leads";
import { YesterdaySheet } from "../screens/Manager";

type Item = { id: string; group: string; icon: React.ReactNode; label: string; sub: string; n: number; tone: "danger" | "warning" | "info"; go: () => void };

function items(role: Role, scope: string[], goTab: (t: string) => void, open: (x: Open) => void): Item[] {
  const inScope = (sellerId: string) => scope.includes(sellerId);
  const transfers = TRANSFER_REQUESTS.filter((r) => r.status === "pending");
  const bonif = FREEZER_OCCURRENCES.filter((o) => inScope(o.sellerId) && o.status === "aguardando_gestor");
  const cad = LEADS.filter((l) => inScope(l.sellerId) && l.stage === "cadastro" && l.cadastro?.status === "pendente");
  const notDelivered = YESTERDAY_DELIVERIES.filter((d) => d.status !== "delivered" && !d.rescheduledTo && inScope(customerById.get(d.customerId)?.sellerId ?? ""));
  const credit = ORDERS.filter((o) => o.kind === "ORDER" && inScope(o.sellerId) && AWAITING_CREDIT.includes(o.status));
  const late = financeQueue().queue.filter((p) => inScope(p.sellerId) && p.sla.level === "breached");
  const list: Item[] = [
    { id: "transfer", group: "Comercial", icon: <Briefcase size={17} />, label: "Transferências de carteira", sub: "aprovar ou recusar", n: transfers.length, tone: "warning", go: () => goTab("portfolio") },
    { id: "bonif", group: "Comercial", icon: <Snowflake size={17} />, label: "Bonificações de freezer", sub: "perda de produto · aprovar ou recusar", n: bonif.length, tone: "warning", go: () => goTab("fzocc") },
    { id: "resched", group: "Comercial", icon: <Truck size={17} />, label: "Entregas de ontem sem reagendar", sub: "reagendar a entrega", n: notDelivered.length, tone: "danger", go: () => open({ k: "yday" }) },
    { id: "cad", group: "Comercial", icon: <UserPlus size={17} />, label: "Cadastros novos no financeiro", sub: "clientes vindos da prospecção", n: cad.length, tone: "info", go: () => open({ k: "leads", title: "Cadastros novos no financeiro", ids: cad.map((l) => l.id) }) },
    { id: "credit", group: "Financeiro", icon: <ClipboardList size={17} />, label: "Pedidos aguardando crédito", sub: "liberação do financeiro", n: credit.length, tone: "info", go: () => open({ k: "link", link: { t: "orders", title: "Pedidos aguardando crédito", statuses: AWAITING_CREDIT } }) },
    { id: "proofs", group: "Financeiro", icon: <Receipt size={17} />, label: "Comprovantes sem resposta > 24h", sub: "cobrar o financeiro", n: late.length, tone: "danger", go: () => open({ k: "link", link: { t: "proofs", title: "Comprovantes além do SLA", late: true } }) },
  ];
  if (role === "general_manager") {
    const log = logisticsOverview();
    const epi = EPI_REQUESTS.filter((e) => e.status === "requested");
    list.push(
      { id: "nc", group: "Logística", icon: <AlertTriangle size={17} />, label: "Ocorrências e não conformidades", sub: "veículos e entregas", n: log.openIncidents.length + log.openNc.length, tone: "danger", go: () => goTab("lissues") },
      { id: "epi", group: "Logística", icon: <HardHat size={17} />, label: "Pedidos de EPI", sub: "aprovar ou recusar", n: epi.length, tone: "warning", go: () => goTab("lfleet") },
    );
  }
  return list;
}

type Open = { k: "yday" } | { k: "leads"; title: string; ids: string[] } | { k: "link"; link: NotifLink };

export function approvalsCount(role: Role, scope: string[]) {
  return items(role, scope, () => {}, () => {}).filter((i) => i.id !== "credit" && i.id !== "cad").reduce((s, i) => s + i.n, 0);
}

export function ApprovalsView({ role, scope, goTab }: { role: Role; scope: string[]; goTab: (t: string) => void }) {
  useStore();
  const [open, setOpen] = useState<Open | null>(null);
  const list = items(role, scope, goTab, setOpen);
  const groups = [...new Set(list.map((i) => i.group))];
  const total = list.reduce((s, i) => s + i.n, 0);
  return (
    <>
      <h2 style={{ margin: "6px 0 4px" }}>Liberações</h2>
      <p className="small muted mb">Tudo que espera uma decisão {role === "general_manager" ? "do comercial, do financeiro e da logística" : "do comercial e do financeiro"}. Toque para resolver.</p>
      {groups.map((g) => (
        <Card key={g} title={g} icon={<ShieldCheck size={16} />} className="mb">
          <div className="list">
            {list.filter((i) => i.group === g).map((i) => (
              <div key={i.id} className="row click" onClick={i.go}>
                <span className="ic-round">{i.icon}</span>
                <div className="grow"><div className="title small">{i.label}</div><div className="sub">{i.sub}</div></div>
                <Badge tone={i.n ? i.tone : "success"}>{i.n}</Badge>
                <ChevronRight size={16} className="muted" />
              </div>
            ))}
          </div>
        </Card>
      ))}
      {!total && <Empty icon={<CheckCircle2 />} text="Nada esperando decisão agora." />}
      {open?.k === "yday" && <YesterdaySheet scope={scope} onClose={() => setOpen(null)} />}
      {open?.k === "leads" && <LeadListSheet title={open.title} items={LEADS.filter((l) => open.ids.includes(l.id))} viewer="manager" onClose={() => setOpen(null)} />}
      {open?.k === "link" && <LinkView link={open.link} onClose={() => setOpen(null)} onNavigate={() => setOpen(null)} />}
    </>
  );
}
