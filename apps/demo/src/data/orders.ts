/** Regras de pedido usadas pelas telas da demo. */
import { TODAY, SELLERS, ORDERS, customerById, sellerById, nowStamp, type Order } from "./mock";
import { statusLabel } from "./selectors";

/** Registra um evento na linha do tempo do pedido (com hora real). */
export function logOrder(o: Order, by: string, text: string) {
  (o.log ??= []).push({ at: nowStamp(), by, text });
}
/** Muda o status e registra quem e quando. */
export function setOrderStatus(o: Order, status: string, by: string, text?: string) {
  o.status = status;
  logOrder(o, by, text ?? statusLabel(status));
}
import { notify, MANAGERS_KEYS } from "./notify";
import { formatBRL } from "@galato/domain";

/** Pedidos criados no teste têm id "n<timestamp>": servem para ordenar pelo último emitido. */
export const emittedRank = (id: string) => (/^n\d+$/.test(id) ? Number(id.slice(1)) : 0);

/** Último emitido primeiro; depois do mais recente para o mais antigo. */
export function newestFirst<T extends { id: string }>(dateOf: (x: T) => string) {
  return (a: T, b: T) => emittedRank(b.id) - emittedRank(a.id) || dateOf(b).localeCompare(dateOf(a));
}

/** Enquanto o crédito não liberou, o vendedor ainda pode alterar ou cancelar. */
export const EDITABLE_ORDER_STATUSES = ["draft", "awaiting_credit_review", "in_approval", "blocked"];
export const isOrderEditable = (o: Order) => o.kind === "ORDER" && EDITABLE_ORDER_STATUSES.includes(o.status);

const counts = (o: Order) => o.kind === "ORDER" && !["draft", "cancelled"].includes(o.status);

/** Ajusta venda do dia/mês do vendedor quando um pedido muda de valor ou situação. */
export function applySalesDelta(o: Order, before: { total: number; counted: boolean }) {
  const s = SELLERS.find((x) => x.id === o.sellerId);
  if (!s) return;
  const isToday = o.createdAt.startsWith(TODAY);
  const nowCounted = counts(o);
  const delta = (nowCounted ? o.totalCents : 0) - (before.counted ? before.total : 0);
  s.monthAchievedCents += delta;
  if (isToday) s.todayAchievedCents += delta;
  if (nowCounted !== before.counted) {
    const step = nowCounted ? 1 : -1;
    s.ordersMonth += step;
    if (isToday) s.ordersToday += step;
  }
}

export function cancelOrder(o: Order, reason: string) {
  const before = { total: o.totalCents, counted: counts(o) };
  setOrderStatus(o, "cancelled", sellerById.get(o.sellerId)?.name ?? "Vendedor", `Cancelado pelo vendedor · ${reason}`);
  applySalesDelta(o, before);
  const c = customerById.get(o.customerId);
  notify({ kind: "comercial", priority: "high", title: "Pedido cancelado pelo vendedor", text: `${o.number} · ${c?.tradeName} · ${formatBRL(o.totalCents)} · ${reason} · ${sellerById.get(o.sellerId)?.name}.`, to: ["finance", ...MANAGERS_KEYS] });
}

export const findOrder = (id: string) => ORDERS.find((o) => o.id === id);
