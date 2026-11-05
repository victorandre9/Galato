/** Indicadores derivados — tudo calculado pelas regras de @galato/domain. */
import {
  goalProgress, rankByAttainment, daysWithoutPurchase, inactivityBucket, summarizeReceivables,
  orderFinancialQueue, slaLevel, minutesOf, timeInTimezone, ORDER_STATUS, weightedAverageTerm, isoDateInTimezone,
  type IsoDate,
} from "@galato/domain";
import {
  PARAMS, TODAY, NOW, SELLERS, CUSTOMERS, ORDERS, PAYMENT_REQUESTS, DELIVERY_ROUTES, ASSETS, INCIDENTS,
  NONCONFORMITIES, TODAY_ROUTE, DRIVERS, VEHICLES, type Customer, type DeliveryRoute, type NotifLink,
} from "./mock";

const cal = PARAMS.workCalendar;

export function sellerGoal(sellerId: string) {
  const s = SELLERS.find((x) => x.id === sellerId)!;
  return goalProgress({ today: TODAY, monthlyGoalCents: s.monthlyGoalCents, achievedMonthCents: s.monthAchievedCents, achievedTodayCents: s.todayAchievedCents, calendar: cal });
}

export function teamGoal(sellerIds = SELLERS.map((s) => s.id)) {
  const ss = SELLERS.filter((s) => sellerIds.includes(s.id));
  return goalProgress({
    today: TODAY,
    monthlyGoalCents: ss.reduce((a, s) => a + s.monthlyGoalCents, 0),
    achievedMonthCents: ss.reduce((a, s) => a + s.monthAchievedCents, 0),
    achievedTodayCents: ss.reduce((a, s) => a + s.todayAchievedCents, 0),
    calendar: cal,
  });
}

export function financial(c: Customer) {
  return summarizeReceivables(c.receivables, TODAY, c.manualCreditBlock);
}

export function customerRow(c: Customer) {
  const days = daysWithoutPurchase(c.lastPurchaseDate, TODAY);
  return { c, days, bucket: inactivityBucket(days, PARAMS.inactivity.dashboardBuckets), fin: financial(c) };
}

export function todayRouteBuckets(sellerId: string) {
  const rows = CUSTOMERS.filter((c) => c.sellerId === sellerId && c.routeCode === TODAY_ROUTE?.code).map(customerRow);
  const buckets = PARAMS.inactivity.dashboardBuckets.map((b) => ({ bucket: b, rows: rows.filter((r) => r.bucket === b) }));
  return { total: rows.length, rows, buckets };
}

export function ordersOf(sellerId?: string) {
  return ORDERS.filter((o) => o.kind === "ORDER" && (!sellerId || o.sellerId === sellerId));
}
export function quotesOf(sellerId?: string) {
  return ORDERS.filter((o) => o.kind === "QUOTE" && (!sellerId || o.sellerId === sellerId));
}
export function countByStatus(list: { status: string }[], statuses: string[]) {
  return list.filter((o) => statuses.includes(o.status)).length;
}

export const OPEN_QUOTE = ["draft", "ready", "sent", "awaiting_customer", "negotiation", "approved"];
export const AWAITING_CREDIT = ["awaiting_credit_review", "in_approval", "blocked"];
export const IN_BILLING = ["credit_approved", "scheduled_for_billing", "sent_to_billing", "billing_in_progress"];
export const IN_ROUTE = ["in_delivery_route", "in_transit"];

export function sellerSalesToday(sellerId: string) {
  const list = ordersOf(sellerId);
  const today = list.filter((o) => o.createdAt.startsWith(TODAY));
  const s = SELLERS.find((x) => x.id === sellerId)!;
  return { count: s.ordersToday, ticketCents: Math.round(s.monthAchievedCents / s.ordersMonth) };
}

export function salesRanking(mode: "day" | "month") {
  return rankByAttainment(SELLERS.map((s) => {
    const g = sellerGoal(s.id);
    return mode === "day"
      ? { id: s.id, name: s.name, target: g.dailyGoalCents, achieved: s.todayAchievedCents }
      : { id: s.id, name: s.name, target: s.monthlyGoalCents, achieved: s.monthAchievedCents };
  }));
}

export function visitsRanking() {
  return rankByAttainment(SELLERS.map((s) => ({ id: s.id, name: s.name, target: s.visitsPlannedToday, achieved: s.visitsDoneToday })));
}

export function visitsTotal() {
  const planned = SELLERS.reduce((a, s) => a + s.visitsPlannedToday, 0);
  const done = SELLERS.reduce((a, s) => a + s.visitsDoneToday, 0);
  return { planned, done, pct: planned ? (done / planned) * 100 : 0 };
}

// ---------------------------------------------------------------- financeiro
export const OPEN_PR = ["pending", "in_analysis"];
export function financeQueue(sellerId?: string) {
  const list = PAYMENT_REQUESTS.filter((p) => !sellerId || p.sellerId === sellerId);
  const queue = orderFinancialQueue(
    list.map((p) => ({ ...p, open: OPEN_PR.includes(p.status) })), NOW, PARAMS,
  ).map((p) => ({ ...p, sla: slaLevel(new Date(p.createdAt), NOW, PARAMS.financialSla) }));
  return {
    queue,
    breached: queue.filter((q) => q.sla.level === "breached").length,
    pix: queue.filter((q) => q.method === "PIX").length,
    boleto: queue.filter((q) => q.method === "BOLETO").length,
    carryOver: queue.filter((q) => q.carryOver).length,
    closed: list.filter((p) => !OPEN_PR.includes(p.status)),
  };
}

// ---------------------------------------------------------------- logística
export function routeProgress(r: DeliveryRoute) {
  const total = r.deliveries.length;
  const delivered = r.deliveries.filter((d) => d.status === "delivered").length;
  const failed = r.deliveries.filter((d) => d.status === "not_delivered").length;
  const pending = total - delivered - failed;
  const pct = total ? (delivered / total) * 100 : 0;
  // ritmo esperado: linear entre início e fim previsto
  let expectedPct: number | null = null;
  if (r.startedAt) {
    const start = minutesOf(timeInTimezone(new Date(r.startedAt), PARAMS.timezone));
    const end = minutesOf(r.expectedEnd);
    const now = minutesOf(timeInTimezone(NOW, PARAMS.timezone));
    expectedPct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  }
  const status = r.finishedAt ? "Finalizada" : r.startedAt ? "Em rota" : "Não iniciada";
  const behind = expectedPct !== null && expectedPct - (((delivered + failed) / total) * 100) > PARAMS.logistics.routeBehindPacePercent;
  return { total, delivered, failed, pending, pct, expectedPct, status, behind };
}

export function logisticsOverview() {
  const routes = DELIVERY_ROUTES.map((r) => ({ r, p: routeProgress(r), driver: DRIVERS.find((d) => d.id === r.driverId)!, vehicle: VEHICLES.find((v) => v.id === r.vehicleId)! }));
  const total = routes.reduce((a, x) => a + x.p.total, 0);
  const delivered = routes.reduce((a, x) => a + x.p.delivered, 0);
  const failed = routes.reduce((a, x) => a + x.p.failed, 0);
  const nowMin = minutesOf(timeInTimezone(NOW, PARAMS.timezone));
  const alerts: { tone: "danger" | "warning"; text: string; link: NotifLink }[] = [];
  for (const x of routes) {
    const link: NotifLink = { t: "route", id: x.r.id };
    if (!x.r.startedAt && nowMin > minutesOf(PARAMS.logistics.driverNotStartedAlertAfter))
      alerts.push({ tone: "danger", text: `${x.driver.name.split(" ")[0]} não iniciou a rota ${x.r.name}`, link });
    if (x.p.behind) alerts.push({ tone: "warning", text: `Rota ${x.r.name} abaixo do ritmo esperado (${Math.round(x.p.pct)}% vs ${Math.round(x.p.expectedPct ?? 0)}%)`, link });
    if (x.p.failed) alerts.push({ tone: "warning", text: `${x.p.failed} entrega(s) não realizada(s) na rota ${x.r.name}`, link });
  }
  for (const nc of NONCONFORMITIES.filter((n) => n.severity === "critical" && n.status !== "resolved"))
    alerts.push({ tone: "danger", text: `Não conformidade crítica: ${nc.item} — ${VEHICLES.find((v) => v.id === nc.vehicleId)?.plate}`, link: { t: "nc", id: nc.id } });
  const openIncidents = INCIDENTS.filter((i) => i.status !== "resolved");
  const yesterdayPending = openIncidents.filter((i) => !i.createdAt.startsWith(TODAY)).length;
  return {
    routes, total, delivered, failed, pending: total - delivered - failed, pct: total ? (delivered / total) * 100 : 0,
    activeRoutes: routes.filter((x) => x.r.startedAt && !x.r.finishedAt).length,
    alerts, openIncidents, openNc: NONCONFORMITIES.filter((n) => n.status !== "resolved"), yesterdayPending,
  };
}

// ---------------------------------------------------------------- ativos
export function assetsOverview(sellerIds?: string[]) {
  // fonte da verdade: freezers cadastrados em cada cliente (inclusões/retiradas do app entram aqui)
  const installed = CUSTOMERS.flatMap((c) => c.assets);
  const returned = CUSTOMERS.reduce((n, c) => n + (c.assetLog ?? []).filter((m) => m.action === "retirado").length, 0);
  const byCustomer = CUSTOMERS.filter((c) => c.assets.length && (!sellerIds || sellerIds.includes(c.sellerId)));
  const idle = byCustomer
    .map(customerRow)
    .filter((r) => r.days === null || r.days >= PARAMS.inactivity.idleAssetThresholdDays)
    .map((r) => ({ ...r, value: r.c.assets.reduce((a, x) => a + x.valueCents, 0) }))
    .sort((a, b) => b.value - a.value);
  const bySeller = SELLERS.map((s) => {
    const list = CUSTOMERS.filter((c) => c.sellerId === s.id).flatMap((c) => c.assets);
    return { seller: s, count: list.length, value: list.reduce((a, x) => a + x.valueCents, 0) };
  });
  return {
    onStreet: installed.length,
    valueOnStreet: installed.reduce((a, x) => a + x.valueCents, 0),
    inStock: ASSETS.filter((a) => a.status === "stock").length + returned,
    maintenance: ASSETS.filter((a) => a.status === "maintenance").length,
    idle, idleValue: idle.reduce((a, x) => a + x.value, 0), idleCount: idle.reduce((a, x) => a + x.c.assets.length, 0),
    bySeller,
  };
}

export function termKpi() {
  const orders = ordersOf();
  const deviated = orders.filter((o) => o.paymentTermDays !== o.recommendedTermDays);
  return {
    avg: weightedAverageTerm(orders.map((o) => ({ amountCents: o.totalCents, grantedDays: o.paymentTermDays }))),
    longer: deviated.filter((o) => o.paymentTermDays > o.recommendedTermDays).length,
    shorter: deviated.filter((o) => o.paymentTermDays < o.recommendedTermDays).length,
  };
}

export function statusLabel(s: string) {
  return (ORDER_STATUS as Record<string, { label: string }>)[s]?.label ?? s;
}

export function inactiveTotals(sellerIds?: string[]) {
  const rows = CUSTOMERS.filter((c) => !sellerIds || sellerIds.includes(c.sellerId)).map(customerRow);
  return PARAMS.inactivity.dashboardBuckets.map((b) => ({ bucket: b, count: rows.filter((r) => r.bucket === b).length }));
}

export const dayLabel = (d: IsoDate) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

// ---------------------------------------------------------------- dia anterior
import { YESTERDAY, YESTERDAY_SELLERS, YESTERDAY_DELIVERIES, YESTERDAY_ROUTES } from "./mock";
export function yesterdaySummary(scope: string[]) {
  const rows = YESTERDAY_SELLERS.filter((y) => scope.includes(y.sellerId)).map((y) => {
    const s = SELLERS.find((x) => x.id === y.sellerId)!;
    const daily = goalProgress({ today: YESTERDAY, monthlyGoalCents: s.monthlyGoalCents, achievedMonthCents: 0, achievedTodayCents: 0, calendar: cal }).dailyGoalCents;
    return { ...y, name: s.name, goalCents: daily, salesPct: daily ? (y.salesCents / daily) * 100 : 0, visitsPct: y.visitsPlanned ? (y.visitsDone / y.visitsPlanned) * 100 : 0 };
  });
  const salesRank = rankByAttainment(rows.map((r) => ({ id: r.sellerId, name: r.name, target: r.goalCents, achieved: r.salesCents })));
  const visitRank = rankByAttainment(rows.map((r) => ({ id: r.sellerId, name: r.name, target: r.visitsPlanned, achieved: r.visitsDone })));
  const goal = rows.reduce((a, r) => a + r.goalCents, 0);
  const sales = rows.reduce((a, r) => a + r.salesCents, 0);
  const vPlanned = rows.reduce((a, r) => a + r.visitsPlanned, 0);
  const vDone = rows.reduce((a, r) => a + r.visitsDone, 0);
  const dl = YESTERDAY_DELIVERIES;
  const failed = dl.filter((d) => d.status !== "delivered");
  const delivered = dl.length - failed.length;
  const openPayments = PAYMENT_REQUESTS.filter((p) => OPEN_PR.includes(p.status) && isoDateInTimezone(new Date(p.createdAt), PARAMS.timezone) <= YESTERDAY).length;
  const openIncidents = INCIDENTS.filter((i) => i.status !== "resolved" && i.createdAt.slice(0, 10) <= YESTERDAY).length;
  const incomplete = rows.filter((r) => r.visitsDone < r.visitsPlanned);
  const routes = YESTERDAY_ROUTES.map((r) => {
    const list = dl.filter((d) => d.routeName === r.routeName);
    const done = list.filter((d) => d.status === "delivered").length;
    return { ...r, total: list.length, delivered: done, driver: DRIVERS.find((x) => x.id === r.driverId)!, vehicle: VEHICLES.find((v) => v.id === r.vehicleId)! };
  });
  const unfinished = routes.filter((r) => !r.finishedAt);
  const belowGoal = rows.filter((r) => r.salesCents < r.goalCents);
  const ok = sales >= goal && vDone >= vPlanned && failed.length === 0 && unfinished.length === 0;
  return {
    date: YESTERDAY, rows, salesRank, visitRank, goal, sales, salesPct: goal ? (sales / goal) * 100 : 0,
    vPlanned, vDone, visitsPct: vPlanned ? (vDone / vPlanned) * 100 : 0,
    deliveriesTotal: dl.length, delivered, deliveriesPct: dl.length ? (delivered / dl.length) * 100 : 0, failed,
    pendingFailed: failed.filter((f) => !f.rescheduledTo), openPayments, openIncidents, incomplete, ok,
    routes, unfinished, belowGoal,
  };
}
