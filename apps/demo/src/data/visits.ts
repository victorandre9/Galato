/**
 * Histórico de visitas de um cliente: visitas registradas no app (check-in/checkout)
 * + histórico fictício das semanas anteriores (dia da rota do cliente).
 */
import { addDays, type IsoDate } from "@galato/domain";
import { PARAMS, CHECKINS, CUSTOMERS, SELLERS, TODAY, YESTERDAY, YESTERDAY_SELLERS } from "./mock";
import { customerOrders } from "./history";

export interface VisitEntry {
  id: string; date: IsoDate; inAt?: string; outAt?: string; minutes?: number;
  sellerId: string; sellerName: string; contact?: string;
  status: "visitado" | "nao_visitado" | "em_andamento";
  result: string; orderNumber?: string; note?: string; live: boolean; checkinId?: string; hasVideo?: boolean;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
const NO_ORDER = ["Estoque ainda alto", "Comprador ausente, volta na próxima", "Pediu retorno na quinta", "Pagamento pendente", "Fechado no horário da visita"];
const ROLES = ["(dono)", "(gerente)", "(comprador)", "(caixa)"];
const stamp = (d: IsoDate, h: number, m: number) => `${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-03:00`;

const cache = new Map<string, VisitEntry[]>();

export function visitHistory(customerId: string): VisitEntry[] {
  const c = CUSTOMERS.find((x) => x.id === customerId);
  if (!c) return [];
  const sellerName = (id: string) => SELLERS.find((s) => s.id === id)?.name ?? "Vendedor";
  // visitas registradas no app
  const live: VisitEntry[] = CHECKINS.filter((k) => k.customerId === customerId).map((k) => ({
    id: k.id, date: k.date, inAt: k.inAt, outAt: k.outAt, sellerId: k.sellerId, sellerName: sellerName(k.sellerId),
    minutes: k.outAt ? Math.max(1, Math.round((Date.parse(k.outAt) - Date.parse(k.inAt)) / 60000)) : undefined,
    contact: k.contact, status: k.outAt ? "visitado" : "em_andamento", result: k.result ?? (k.outAt ? "Visita registrada" : "Visita em andamento"),
    note: k.note, live: true, checkinId: k.id, hasVideo: !!k.video,
  }));
  let synth = cache.get(customerId);
  if (!synth) {
    synth = [];
    const route = PARAMS.commercialRoutes.find((r) => r.code === c.routeCode);
    const orders = customerOrders(customerId);
    if (route) {
      // as últimas 10 semanas, no dia da rota do cliente (sem contar hoje)
      for (let d = addDays(TODAY, -1), n = 0; n < 10 && d > addDays(TODAY, -75); d = addDays(d, -1)) {
        const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
        if (wd !== route.weekday) continue;
        n++;
        const key = `${customerId}${d}`;
        const missedYesterday = d === YESTERDAY && YESTERDAY_SELLERS.some((y) => y.missedCustomerIds.includes(customerId));
        const missed = missedYesterday || (d !== YESTERDAY && hash(key + "m") < 0.08);
        const order = orders.find((o) => o.date === d) ?? orders.find((o) => o.date > addDays(d, -1) && o.date <= addDays(d, 1));
        const h = 8 + Math.floor(hash(key + "h") * 9), m = Math.floor(hash(key + "i") * 60), dur = 8 + Math.floor(hash(key + "d") * 30);
        const inAt = stamp(d, h, m);
        synth.push({
          id: `v-${key}`, date: d, sellerId: c.sellerId, sellerName: sellerName(c.sellerId), live: false,
          ...(missed ? { status: "nao_visitado" as const, result: "Não visitado · cliente da rota ficou sem visita" } : {
            status: "visitado" as const, inAt, outAt: new Date(Date.parse(inAt) + dur * 60000).toISOString(), minutes: dur,
            contact: hash(key + "c") < 0.7 ? `${c.buyerName} ${ROLES[Math.floor(hash(key + "r") * ROLES.length)]}` : `Funcionário no balcão`,
            result: order ? `Tirou pedido · ${order.number}` : `Sem pedido · ${NO_ORDER[Math.floor(hash(key + "n") * NO_ORDER.length)]}`,
            ...(order ? { orderNumber: order.number } : {}),
          }),
        });
      }
    }
    cache.set(customerId, synth);
  }
  const liveDates = new Set(live.map((v) => v.date));
  return [...live, ...synth.filter((v) => !liveDates.has(v.date))].sort((a, b) => (b.inAt ?? b.date).localeCompare(a.inAt ?? a.date));
}
