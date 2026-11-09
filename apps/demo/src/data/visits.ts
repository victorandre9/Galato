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
  /** pedidos que saíram desta visita (id do histórico de pedidos) */
  orderIds?: string[]; orderNumbers?: string[];
  /** vídeo do freezer da demonstração (visitas fictícias de clientes com freezer) */
  demoVideo?: boolean; extra?: boolean;
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
  const orders = customerOrders(customerId);
  const ordersOn = (d: string) => orders.filter((o) => o.date === d);
  // visitas registradas no app (check-in/checkout), já ligadas ao pedido do mesmo dia
  const live: VisitEntry[] = CHECKINS.filter((k) => k.customerId === customerId).map((k) => {
    const os = ordersOn(k.date);
    return {
      id: k.id, date: k.date, inAt: k.inAt, outAt: k.outAt, sellerId: k.sellerId, sellerName: sellerName(k.sellerId),
      minutes: k.outAt ? Math.max(1, Math.round((Date.parse(k.outAt) - Date.parse(k.inAt)) / 60000)) : undefined,
      contact: k.contact, status: k.outAt ? "visitado" as const : "em_andamento" as const,
      result: os.length ? `Tirou pedido · ${os.map((o) => o.number).join(", ")}` : k.result ?? (k.outAt ? "Visita registrada" : "Visita em andamento"),
      note: k.note, live: true, checkinId: k.id, hasVideo: !!k.video,
      ...(os.length ? { orderIds: os.map((o) => o.id), orderNumbers: os.map((o) => o.number), orderNumber: os[0]!.number } : {}),
    };
  });
  const cacheKey = `${customerId}:${orders.length}`;
  let synth = cache.get(cacheKey);
  if (!synth) {
    synth = [];
    const route = PARAMS.commercialRoutes.find((r) => r.code === c.routeCode);
    const since = addDays(TODAY, -75);
    // dias de visita: o dia da rota nas últimas 10 semanas + todo dia em que saiu pedido (toda venda nasce de uma visita)
    const dates = new Set<string>();
    if (route) for (let d = addDays(TODAY, -1), n = 0; n < 10 && d > since; d = addDays(d, -1)) {
      if (new Date(`${d}T12:00:00Z`).getUTCDay() !== route.weekday) continue;
      n++; dates.add(d);
    }
    for (const o of orders) if (o.date > since && o.date <= TODAY) dates.add(o.date);
    for (const d of dates) {
      const key = `${customerId}${d}`;
      const os = ordersOn(d);
      const onRoute = !!route && new Date(`${d}T12:00:00Z`).getUTCDay() === route.weekday;
      const missedYesterday = d === YESTERDAY && YESTERDAY_SELLERS.some((y) => y.missedCustomerIds.includes(customerId));
      const missed = !os.length && (missedYesterday || (d !== YESTERDAY && hash(key + "m") < 0.08));
      const h = 8 + Math.floor(hash(key + "h") * 9), m = Math.floor(hash(key + "i") * 60), dur = 8 + Math.floor(hash(key + "d") * 30);
      const inAt = stamp(d, h, m);
      synth.push({
        id: `v-${key}`, date: d, sellerId: c.sellerId, sellerName: sellerName(c.sellerId), live: false, extra: !onRoute,
        ...(missed ? { status: "nao_visitado" as const, result: "Não visitado · cliente da rota ficou sem visita" } : {
          status: "visitado" as const, inAt, outAt: new Date(Date.parse(inAt) + dur * 60000).toISOString(), minutes: dur,
          contact: hash(key + "c") < 0.7 ? `${c.buyerName} ${ROLES[Math.floor(hash(key + "r") * ROLES.length)]}` : `Funcionário no balcão`,
          result: os.length ? `Tirou pedido · ${os.map((o) => o.number).join(", ")}` : `Sem pedido · ${NO_ORDER[Math.floor(hash(key + "n") * NO_ORDER.length)]}`,
          demoVideo: d >= addDays(TODAY, -60),
          ...(os.length ? { orderIds: os.map((o) => o.id), orderNumbers: os.map((o) => o.number), orderNumber: os[0]!.number } : {}),
        }),
      });
    }
    cache.set(cacheKey, synth);
  }
  const liveDates = new Set(live.map((v) => v.date));
  return [...live, ...synth.filter((v) => !liveDates.has(v.date))].sort((a, b) => (b.inAt ?? b.date).localeCompare(a.inAt ?? a.date));
}
