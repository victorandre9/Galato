/**
 * Conferência de freezers pela gestão.
 * Cada visita finalizada gera um vídeo (checkout). A gestão confere freezer por freezer:
 * OK ou problema (com motivo). O que não for conferido até o vídeo ser apagado (60 dias) "fica para trás".
 */
import { addDays, daysBetween, type IsoDate } from "@galato/domain";
import { CHECKINS, CUSTOMERS, SELLERS, TODAY, type Asset, type Customer } from "./mock";
import { sellerDayVisits, isWorkday, prevWorkday, type DayVisit } from "./dayvisits";
import { visitHistory, type VisitEntry } from "./visits";
import { VIDEO_LIMITS } from "../components/video";

export type FzIssue = "sujo" | "desligado" | "gelo" | "concorrente" | "vazio" | "exposicao" | "danificado" | "local" | "video_ruim" | "outro";
export const FZ_ISSUES: Record<FzIssue, string> = {
  sujo: "Sujo / desorganizado",
  desligado: "Desligado ou sem gelar",
  gelo: "Gelo acumulado",
  concorrente: "Produto concorrente dentro",
  vazio: "Vazio / pouco estoque",
  exposicao: "Exposição ruim (sabores misturados)",
  danificado: "Danificado (porta, vidro, adesivo)",
  local: "Fora do lugar combinado",
  video_ruim: "Vídeo não mostra o freezer",
  outro: "Outro",
};

export interface FreezerReview {
  id: string; customerId: string; patrimony: string; date: IsoDate; sellerId: string; visitId: string;
  status: "ok" | "problema"; issues: FzIssue[]; note?: string; sellerNotified?: boolean;
  reviewedAt: string; reviewedBy: string; synthetic?: boolean;
}
/** Conferências feitas no app (sincronizadas com o banco). */
export const FREEZER_REVIEWS: FreezerReview[] = [];

export const reviewKey = (customerId: string, patrimony: string, date: IsoDate) => `fr~${customerId}~${patrimony}~${date}`;

export type FzState = "conferir" | "ok" | "problema" | "sem_video";
export interface FzItem {
  key: string; date: IsoDate; customer: Customer; asset: Asset; sellerId: string; visit: VisitEntry;
  hasVideo: boolean; review: FreezerReview | null; state: FzState;
  /** dias até o vídeo ser apagado */
  daysLeft: number;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
const workdaysAgo = (d: IsoDate) => { let n = 0; for (let x = TODAY; x > d; x = prevWorkday(x)) n++; return n; };

/** Conferência real (feita no app) ou, nos dados de demonstração, a conferência "já feita" dos dias anteriores. */
export function reviewFor(customerId: string, patrimony: string, date: IsoDate, sellerId: string, visitId: string): FreezerReview | null {
  const id = reviewKey(customerId, patrimony, date);
  const real = FREEZER_REVIEWS.find((r) => r.id === id);
  if (real) return real;
  if (date >= TODAY) return null;
  const n = workdaysAgo(date), h = hash(id);
  const done = n <= 1 ? h < 0.45 : n <= 5 ? h < 0.94 : h < 0.996;
  if (!done) return null;
  const prob = hash(id + "p") < 0.07;
  const issues: FzIssue[] = prob ? [(["sujo", "gelo", "concorrente", "vazio", "exposicao"] as FzIssue[])[Math.floor(hash(id + "i") * 5)]!] : [];
  return { id, customerId, patrimony, date, sellerId, visitId, status: prob ? "problema" : "ok", issues, reviewedAt: `${addDays(date, n > 1 ? 1 : 0)}T10:00:00-03:00`, reviewedBy: "Gestão", synthetic: true };
}

function videoOf(v: VisitEntry): boolean {
  if (v.checkinId) { const k = CHECKINS.find((x) => x.id === v.checkinId); return !!k?.video && !k.video.purgedAt; }
  return !!(v.hasVideo || v.demoVideo);
}

function toItems(c: Customer, v: VisitEntry): FzItem[] {
  const hasVideo = videoOf(v);
  const daysLeft = VIDEO_LIMITS.retentionDays - daysBetween(v.date, TODAY);
  return c.assets.map((a) => {
    const review = reviewFor(c.id, a.patrimony, v.date, v.sellerId, v.id);
    const state: FzState = review ? review.status : hasVideo ? "conferir" : "sem_video";
    return { key: reviewKey(c.id, a.patrimony, v.date), date: v.date, customer: c, asset: a, sellerId: v.sellerId, visit: v, hasVideo, review, state, daysLeft };
  });
}

// visitas de dias passados não mudam: guarda para não recalcular
const dayCache = new Map<string, DayVisit[]>();
function dayList(sellerId: string, date: IsoDate): DayVisit[] {
  if (date >= TODAY) return sellerDayVisits(sellerId, date).list;
  const k = `${sellerId}|${date}`;
  let l = dayCache.get(k);
  if (!l) { l = sellerDayVisits(sellerId, date).list; dayCache.set(k, l); }
  return l;
}

const custMap = () => new Map(CUSTOMERS.map((c) => [c.id, c]));

export interface PendingVisit { customer: Customer; sellerId: string; status: DayVisit["status"]; freezers: number; inAt?: string }

/** Versão dos dados que mudam o resultado (conferências e check-ins). */
const version = () => `${FREEZER_REVIEWS.map((r) => r.id + r.reviewedAt).join()}|${CHECKINS.map((k) => k.id + (k.outAt ?? "")).join()}`;
const memo = new Map<string, unknown>();
function cached<T>(key: string, fn: () => T): T {
  const k = `${key}#${version()}`;
  if (memo.has(k)) return memo.get(k) as T;
  if (memo.size > 400) memo.clear();
  const v = fn(); memo.set(k, v); return v;
}

/** Freezers das visitas finalizadas do dia + visitas que ainda faltam. */
export function freezerDay(sellerIds: string[], date: IsoDate) {
  return cached(`day|${sellerIds.join()}|${date}`, () => computeDay(sellerIds, date));
}
function computeDay(sellerIds: string[], date: IsoDate) {
  const cm = custMap();
  const items: FzItem[] = [];
  const pending: PendingVisit[] = [];
  const perSeller = new Map<string, { planned: number; done: number }>();
  for (const sid of sellerIds) {
    const list = dayList(sid, date);
    perSeller.set(sid, { planned: list.filter((v) => !v.extra).length, done: list.filter((v) => v.status === "visitado").length });
    for (const dv of list) {
      const c = cm.get(dv.customerId);
      if (!c) continue;
      if (dv.status === "visitado" && dv.entry.outAt) items.push(...toItems(c, { ...dv.entry, sellerId: sid }));
      else pending.push({ customer: c, sellerId: sid, status: dv.status, freezers: c.assets.length, inAt: dv.entry.inAt });
    }
  }
  items.sort((a, b) => (a.visit.outAt ?? "").localeCompare(b.visit.outAt ?? ""));
  return { items, pending, perSeller };
}

/** Vídeos de dias anteriores ainda não conferidos (antes de serem apagados). */
export function freezerBacklog(sellerIds: string[]): FzItem[] {
  return cached(`back|${sellerIds.join()}`, () => computeBacklog(sellerIds));
}
function computeBacklog(sellerIds: string[]): FzItem[] {
  const out: FzItem[] = [];
  const limit = addDays(TODAY, -VIDEO_LIMITS.retentionDays);
  for (let d = prevWorkday(TODAY); d > limit; d = prevWorkday(d)) {
    if (!isWorkday(d)) continue;
    out.push(...freezerDay(sellerIds, d).items.filter((i) => i.state === "conferir"));
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export type FzFlag = "atrasado" | "vence" | "recorrente" | "sem_conferencia" | "sem_visita" | "ultimo_problema";
export const FZ_FLAGS: Record<FzFlag, { label: string; tone: "danger" | "warning" | "neutral" }> = {
  vence: { label: "Vídeo vence em até 7 dias", tone: "danger" },
  atrasado: { label: "Vídeo sem conferir", tone: "warning" },
  ultimo_problema: { label: "Último vídeo com problema", tone: "danger" },
  recorrente: { label: "Problema recorrente", tone: "danger" },
  sem_conferencia: { label: "Sem conferência há +15 dias", tone: "warning" },
  sem_visita: { label: "Sem visita há +15 dias", tone: "neutral" },
};

export interface FreezerSummary {
  asset: Asset; customer: Customer; sellerId: string; timeline: FzItem[];
  visits: number; reviewed: number; problems: number; problems30: number;
  lastVisit: IsoDate | null; lastReviewed: FzItem | null; daysSinceReview: number | null; daysSinceVisit: number | null;
  pendingVideos: number; minDaysLeft: number | null; flags: FzFlag[];
}

/** Histórico de todos os freezers instalados (todas as visitas registradas). */
export function freezerHistory(sellerIds: string[]): FreezerSummary[] {
  return cached(`hist|${sellerIds.join()}`, () => computeHistory(sellerIds));
}
function computeHistory(sellerIds: string[]): FreezerSummary[] {
  const today = freezerDay(sellerIds, TODAY).items;
  const out: FreezerSummary[] = [];
  for (const c of CUSTOMERS) {
    if (!sellerIds.includes(c.sellerId) || !c.assets.length) continue;
    const visits = visitHistory(c.id).filter((v) => v.status === "visitado" && v.outAt && v.date < TODAY);
    const todays = today.filter((i) => i.customer.id === c.id);
    for (const a of c.assets) {
      const timeline = [...todays.filter((i) => i.asset.patrimony === a.patrimony), ...visits.flatMap((v) => toItems(c, v).filter((i) => i.asset.patrimony === a.patrimony))]
        .sort((x, y) => y.date.localeCompare(x.date));
      const reviewed = timeline.filter((i) => i.review);
      const lastReviewed = reviewed[0] ?? null;
      const pend = timeline.filter((i) => i.state === "conferir" && i.date < TODAY);
      const problems30 = reviewed.filter((i) => i.review!.status === "problema" && daysBetween(i.date, TODAY) <= 30).length;
      const lastVisit = timeline[0]?.date ?? null;
      const dRev = lastReviewed ? daysBetween(lastReviewed.date, TODAY) : null;
      const dVis = lastVisit ? daysBetween(lastVisit, TODAY) : null;
      const minLeft = pend.length ? Math.min(...pend.map((i) => i.daysLeft)) : null;
      const flags: FzFlag[] = [];
      if (minLeft !== null && minLeft <= 7) flags.push("vence");
      if (pend.length) flags.push("atrasado");
      if (lastReviewed?.review?.status === "problema") flags.push("ultimo_problema");
      if (problems30 >= 2) flags.push("recorrente");
      if (dRev === null || dRev > 15) flags.push("sem_conferencia");
      if (dVis === null || dVis > 15) flags.push("sem_visita");
      out.push({
        asset: a, customer: c, sellerId: c.sellerId, timeline, visits: timeline.length, reviewed: reviewed.length,
        problems: reviewed.filter((i) => i.review!.status === "problema").length, problems30,
        lastVisit, lastReviewed, daysSinceReview: dRev, daysSinceVisit: dVis, pendingVideos: pend.length, minDaysLeft: minLeft, flags,
      });
    }
  }
  return out;
}

export const sellerIdsOf = (scope: string[], f: string) => (f === "all" ? scope : [f]);
export const sellerName = (id: string) => SELLERS.find((s) => s.id === id)?.name ?? "Vendedor";
