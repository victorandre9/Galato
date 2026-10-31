/**
 * Histórico de pedidos fictício para relatórios.
 * Gera pedidos do mês por vendedor (somando o "vendido no mês") e o histórico
 * dos 6 meses anteriores por cliente (somando a compra mensal de cada mês).
 * Junta com os pedidos reais criados no teste.
 */
import { addDays, isBusinessDay, monthBounds, type IsoDate } from "@galato/domain";
import { PARAMS, CUSTOMERS, SELLERS, PRODUCTS, ORDERS, TODAY, type Order, type OrderItem } from "./mock";
import { newestFirst } from "./orders";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

export interface HistOrder {
  id: string; number: string; invoiceNumber: string | null; customerId: string; sellerId: string; date: IsoDate;
  status: string; totalCents: number; paymentTermDays: number; items: OrderItem[]; live: boolean;
}

function itemsFor(seed: string, amount: number): OrderItem[] {
  const n = 1 + Math.floor(hash(seed + "n") * 4);
  const prods = [...PRODUCTS].sort((a, b) => hash(seed + a.id) - hash(seed + b.id)).slice(0, n);
  const items: OrderItem[] = [];
  let rem = amount;
  prods.forEach((p, i) => {
    const last = i === prods.length - 1;
    if (!last) {
      const share = Math.round(amount * (0.2 + hash(seed + p.id + "s") * 0.3));
      const qty = Math.max(1, Math.round(share / p.priceCents));
      if (qty * p.priceCents >= rem) return;
      items.push({ productId: p.id, qty, unitPriceCents: p.priceCents });
      rem -= qty * p.priceCents;
    } else {
      const qty = Math.max(1, Math.round(rem / p.priceCents));
      items.push({ productId: p.id, qty, unitPriceCents: Math.max(1, Math.round(rem / qty)) });
    }
  });
  return items;
}

const sum = (items: OrderItem[]) => items.reduce((a, it) => a + it.qty * it.unitPriceCents, 0);
const termFor = (v: number) => (v <= 50_000 ? 7 : v <= 150_000 ? 14 : 21);

function businessDaysBetween(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isBusinessDay(d, PARAMS.workCalendar)) out.push(d);
  return out;
}

const liveToHist = (o: Order): HistOrder => ({
  id: o.id, number: o.number, invoiceNumber: o.invoiceNumber ?? null, customerId: o.customerId, sellerId: o.sellerId,
  date: o.createdAt.slice(0, 10), status: o.status, totalCents: o.totalCents, paymentTermDays: o.paymentTermDays, items: o.items, live: true,
});

const cache = new Map<string, HistOrder[]>();

/** Pedidos do mês de um vendedor (sintéticos + criados no teste). */
export function sellerMonthOrders(sellerId: string): HistOrder[] {
  const s = SELLERS.find((x) => x.id === sellerId)!;
  const first = monthBounds(TODAY).first;
  const live = ORDERS.filter((o) => o.kind === "ORDER" && o.sellerId === sellerId && o.createdAt.slice(0, 10) >= first && !["draft", "cancelled"].includes(o.status)).map(liveToHist);
  const key = `m-${sellerId}`;
  let synth = cache.get(key);
  if (!synth) {
    const buyers = CUSTOMERS.filter((c) => c.sellerId === sellerId && c.lastPurchaseDate && c.lastPurchaseDate >= first);
    const days = businessDaysBetween(first, TODAY);
    // o vendido no mês = pedidos já existentes no sistema + histórico sintético
    const target = Math.max(0, s.monthAchievedCents - live.reduce((a, o) => a + o.totalCents, 0));
    const count = Math.max(buyers.length, Math.min(s.ordersMonth, buyers.length * 3));
    const plan: { customerId: string; date: IsoDate; w: number }[] = [];
    buyers.forEach((c) => plan.push({ customerId: c.id, date: c.lastPurchaseDate!, w: 1 }));
    for (let i = buyers.length; i < count && buyers.length; i++) {
      const c = buyers[Math.floor(hash(`${key}c${i}`) * buyers.length)]!;
      const before = days.filter((d) => d < c.lastPurchaseDate!);
      if (!before.length) continue;
      plan.push({ customerId: c.id, date: before[Math.floor(hash(`${key}d${i}`) * before.length)]!, w: 0.6 + hash(`${key}w${i}`) });
    }
    const wsum = plan.reduce((a, p) => a + p.w, 0) || 1;
    synth = plan.map((p, i) => {
      const amount = Math.max(5_000, Math.round((target * p.w) / wsum));
      const items = itemsFor(`${key}${i}`, amount);
      const total = sum(items);
      const recent = p.date >= addDays(TODAY, -2);
      return {
        id: `h-${sellerId}-${i}`, number: `PV-${57000 + Math.floor(hash(`${key}n${i}`) * 1200)}`,
        invoiceNumber: `NF ${118000 + Math.floor(hash(`${key}f${i}`) * 9000)}`, customerId: p.customerId, sellerId,
        date: p.date, status: recent ? "invoiced" : "completed", totalCents: total, paymentTermDays: termFor(total), items, live: false,
      };
    });
    cache.set(key, synth);
  }
  return [...live, ...synth].sort(newestFirst<HistOrder>((x) => x.date));
}

/** Histórico completo de um cliente: mês atual + 6 meses anteriores. */
export function customerOrders(customerId: string): HistOrder[] {
  const c = CUSTOMERS.find((x) => x.id === customerId)!;
  const month = sellerMonthOrders(c.sellerId).filter((o) => o.customerId === customerId);
  const key = `c-${customerId}`;
  let past = cache.get(key);
  if (!past) {
    past = [];
    const first = monthBounds(TODAY).first;
    c.monthlyHistoryCents.forEach((value, idx) => {
      if (!value) return;
      const monthsBack = c.monthlyHistoryCents.length - idx;
      let start = first;
      for (let k = 0; k < monthsBack; k++) start = monthBounds(addDays(start, -1)).first;
      const lp = c.lastPurchaseDate;
      const endDay = lp && lp >= start && lp <= monthBounds(start).last ? lp : monthBounds(start).last;
      const days = businessDaysBetween(start, endDay);
      const n = 1 + Math.floor(hash(`${key}${idx}`) * 3);
      for (let j = 0; j < n; j++) {
        const items = itemsFor(`${key}${idx}-${j}`, Math.round(value / n));
        past!.push({
          id: `${key}-${idx}-${j}`, number: `PV-${50000 + Math.floor(hash(`${key}p${idx}${j}`) * 7000)}`,
          invoiceNumber: hash(`${key}nf${idx}${j}`) < 0.9 ? `NF ${100000 + Math.floor(hash(`${key}f${idx}${j}`) * 18000)}` : null,
          customerId, sellerId: c.sellerId,
          date: endDay === lp && j === n - 1 ? lp : (days[Math.floor(((j + 0.5) / n) * Math.max(1, days.length - 1))] ?? start),
          status: "completed", totalCents: sum(items), paymentTermDays: termFor(sum(items)), items, live: false,
        });
      }
    });
    cache.set(key, past);
  }
  return [...month, ...past].sort(newestFirst<HistOrder>((x) => x.date));
}

/** Clientes da carteira sem pedido no mês atual. */
export function customersWithoutPurchaseThisMonth(sellerId: string) {
  const first = monthBounds(TODAY).first;
  const buyers = new Set(sellerMonthOrders(sellerId).map((o) => o.customerId));
  return CUSTOMERS.filter((c) => c.sellerId === sellerId && !buyers.has(c.id) && !(c.lastPurchaseDate && c.lastPurchaseDate >= first));
}
