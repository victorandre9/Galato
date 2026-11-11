/**
 * Visitas do dia de um vendedor (agendadas × realizadas), para qualquer data:
 * hoje em tempo real (check-in ativo, feitas e pendentes) e dias anteriores (histórico que não apaga).
 * Só o vídeo do freezer é apagado 60 dias depois da visita.
 */
import { addDays, isBusinessDay, routeForDate, type IsoDate } from "@galato/domain";
import { CHECKINS, CUSTOMERS, ORDERS, PARAMS, SELLERS, TODAY, NOW, CURRENT_SELLER } from "./mock";
import { visitHistory, type VisitEntry } from "./visits";
import { customerOrders } from "./history";

export type DayStatus = "em_andamento" | "visitado" | "pendente" | "nao_visitado";
export interface DayVisit { entry: VisitEntry; customerId: string; status: DayStatus; extra: boolean }

const cal = { workWeekdays: PARAMS.workCalendar.workWeekdays, holidays: PARAMS.workCalendar.holidays };
export const isWorkday = (d: IsoDate) => isBusinessDay(d, cal);
export const prevWorkday = (d: IsoDate) => { let x = addDays(d, -1); while (!isWorkday(x)) x = addDays(x, -1); return x; };
export const nextWorkday = (d: IsoDate) => { let x = addDays(d, 1); while (!isWorkday(x)) x = addDays(x, 1); return x; };

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; }
const stamp = (d: string, minutesFrom8: number) => new Date(Date.parse(`${d}T08:00:00-03:00`) + minutesFrom8 * 60000).toISOString();
const sellerName = (id: string) => SELLERS.find((s) => s.id === id)?.name ?? "Vendedor";

export function sellerDayVisits(sellerId: string, date: IsoDate): { routeName: string; list: DayVisit[] } {
  const route = routeForDate(date, PARAMS.commercialRoutes);
  const mine = CUSTOMERS.filter((c) => c.sellerId === sellerId);
  const planned = route ? mine.filter((c) => c.routeCode === route.code) : [];
  const out: DayVisit[] = [];

  if (date === TODAY) {
    const s = SELLERS.find((x) => x.id === sellerId)!;
    const real = new Map(CHECKINS.filter((k) => k.sellerId === sellerId && k.date === TODAY).map((k) => [k.customerId, k]));
    const order = planned.slice().sort((a, b) => hash(a.id + date) - hash(b.id + date));
    // o check-in já soma em visitsDoneToday: desconta todos os check-ins reais (abertos e fechados)
    let doneLeft = Math.max(0, s.visitsDoneToday - real.size);
    const activeReal = [...real.values()].some((k) => !k.outAt);
    // "em atendimento" fictício só para vendedores que não estão sendo usados no teste (sem check-in real hoje)
    let activeLeft = !activeReal && real.size === 0 && sellerId !== CURRENT_SELLER.id && doneLeft < order.length && hash(sellerId + date) > 0.25 ? 1 : 0;
    const nowMin = (NOW.getTime() - Date.parse(`${TODAY}T08:00:00-03:00`)) / 60000;
    const totalDone = doneLeft;
    const slot = Math.max(15, (nowMin - 30) / Math.max(1, totalDone)); // visitas espalhadas entre 8h e agora
    let slotIdx = 0;
    // check-in real em cliente fora da rota do dia também aparece
    for (const [cid, k] of real) if (!order.some((c) => c.id === cid)) {
      const hist = visitHistory(cid).find((v) => v.date === TODAY && v.live);
      if (hist) out.push({ entry: hist, customerId: cid, status: k.outAt ? "visitado" : "em_andamento", extra: true });
    }
    for (const c of order) {
      const k = real.get(c.id);
      const hist = visitHistory(c.id).find((v) => v.date === TODAY && v.live);
      if (k && hist) { out.push({ entry: hist, customerId: c.id, status: k.outAt ? "visitado" : "em_andamento", extra: false }); continue; }
      const todays = customerOrders(c.id).filter((o) => o.date === TODAY);
      const base: VisitEntry = { id: `dv-${c.id}-${date}`, date, sellerId, sellerName: sellerName(sellerId), status: "visitado", result: "", live: false };
      if (doneLeft > 0) {
        doneLeft--;
        const dur = Math.min(Math.floor(slot * 0.75), 12 + Math.floor(hash(c.id + "d") * 22));
        const inAt = stamp(date, 5 + slotIdx * slot + Math.floor(hash(c.id + "g") * Math.max(1, slot - dur - 3))); slotIdx++;
        out.push({ customerId: c.id, status: "visitado", extra: false, entry: { ...base, inAt, outAt: new Date(Date.parse(inAt) + dur * 60000).toISOString(), minutes: dur,
          contact: c.buyerName, demoVideo: true,
          result: todays.length ? `Tirou pedido · ${todays.map((o) => o.number).join(", ")}` : "Sem pedido · Estoque ainda alto",
          ...(todays.length ? { orderIds: todays.map((o) => o.id), orderNumbers: todays.map((o) => o.number), orderNumber: todays[0]!.number } : {}) } });
      } else if (activeLeft > 0) {
        activeLeft--;
        const inAt = new Date(NOW.getTime() - (6 + Math.floor(hash(c.id) * 18)) * 60000).toISOString();
        out.push({ customerId: c.id, status: "em_andamento", extra: false, entry: { ...base, status: "em_andamento", inAt, result: "Visita em andamento (check-in ativo)" } });
      } else {
        out.push({ customerId: c.id, status: "pendente", extra: false, entry: { ...base, status: "nao_visitado", result: "Ainda não visitado hoje" } });
      }
    }
  } else {
    const seen = new Set<string>();
    for (const c of planned) {
      seen.add(c.id);
      const v = visitHistory(c.id).find((x) => x.date === date);
      if (v) { out.push({ entry: v, customerId: c.id, status: v.status === "nao_visitado" ? "nao_visitado" : "visitado", extra: false }); continue; }
      // dias mais antigos que o histórico detalhado: registro fictício estável
      const missed = hash(c.id + date + "m") < 0.08;
      const dur = 10 + Math.floor(hash(c.id + date) * 25);
      const inAt = stamp(date, 10 + Math.floor(hash(c.id + date + "h") * 480));
      const e: VisitEntry = missed
        ? { id: `dv-${c.id}-${date}`, date, sellerId, sellerName: sellerName(sellerId), status: "nao_visitado", result: "Não visitado · cliente da rota ficou sem visita", live: false }
        : { id: `dv-${c.id}-${date}`, date, sellerId, sellerName: sellerName(sellerId), status: "visitado", live: false, inAt, outAt: new Date(Date.parse(inAt) + dur * 60000).toISOString(), minutes: dur, contact: c.buyerName, result: "Sem pedido", demoVideo: date >= addDays(TODAY, -60) };
      out.push({ entry: e, customerId: c.id, status: missed ? "nao_visitado" : "visitado", extra: false });
    }
    // visitas fora da rota do dia (ex.: dia em que saiu pedido)
    for (const c of mine) {
      if (seen.has(c.id)) continue;
      const v = visitHistory(c.id).find((x) => x.date === date && x.status !== "nao_visitado");
      if (v) out.push({ entry: v, customerId: c.id, status: "visitado", extra: true });
    }
  }
  const rank: Record<DayStatus, number> = { em_andamento: 0, visitado: 1, pendente: 2, nao_visitado: 3 };
  out.sort((a, b) => rank[a.status] - rank[b.status] || (a.entry.inAt ?? "").localeCompare(b.entry.inAt ?? ""));
  void ORDERS;
  return { routeName: route?.name ?? "sem rota", list: out };
}

/** Resumo do dia para a lista "agora em campo". */
export function sellerNow(sellerId: string) {
  const { list } = sellerDayVisits(sellerId, TODAY);
  const active = list.find((v) => v.status === "em_andamento");
  const done = list.filter((v) => v.status === "visitado");
  const last = done.slice().sort((a, b) => (b.entry.outAt ?? "").localeCompare(a.entry.outAt ?? ""))[0];
  return { active, done: done.length, planned: list.filter((v) => !v.extra).length, pending: list.filter((v) => v.status === "pendente").length, last };
}
