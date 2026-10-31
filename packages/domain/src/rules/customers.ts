/**
 * Clientes: inatividade, filtros combinados, rota do dia, frequência esperada,
 * campos editáveis pelo vendedor e visão limitada fora da carteira.
 */
import type { AbcdClass, CommercialRouteDef } from "../config/parameters.js";
import { daysBetween, weekday, type IsoDate } from "./dates.js";
import { monthBounds } from "./business-days.js";

// ---------- Rota comercial do dia (seção 28) ----------
export function routeForDate(date: IsoDate, routes: CommercialRouteDef[]): CommercialRouteDef | null {
  return routes.find((r) => r.weekday === weekday(date)) ?? null;
}

// ---------- Dias sem compra / baldes (seção 28) ----------
export function daysWithoutPurchase(lastPurchase: IsoDate | null, today: IsoDate): number | null {
  return lastPurchase ? daysBetween(lastPurchase, today) : null;
}

/**
 * Baldes [7,14,21,28] => "7" = 7..13, "14" = 14..20, "21" = 21..27, "28+" = ≥28.
 * Cliente que nunca comprou cai no último balde.
 */
export function inactivityBucket(days: number | null, buckets: number[]): number | null {
  const sorted = [...buckets].sort((a, b) => a - b);
  if (days === null) return sorted[sorted.length - 1] ?? null;
  let hit: number | null = null;
  for (const b of sorted) if (days >= b) hit = b;
  return hit;
}

export function bucketLabel(bucket: number, buckets: number[]): string {
  const max = Math.max(...buckets);
  return bucket === max ? `${bucket}+ dias` : `${bucket} dias`;
}

// ---------- Filtros combinados (seção 29) ----------
export interface CustomerForFilter {
  id: string;
  abcd: AbcdClass;
  commercialRouteCode: string | null;
  lastPurchaseDate: IsoDate | null;
  freezerCount: number;
}

export interface InactivityFilter {
  noPurchaseThisMonth?: boolean;
  minDaysWithoutPurchase?: number;
  /** período personalizado: SEM compra dentro do intervalo */
  noPurchaseBetween?: { from: IsoDate; to: IsoDate };
  curves?: AbcdClass[];
  hasFreezer?: boolean;
  routeCodes?: string[];
}

export function filterCustomers<T extends CustomerForFilter>(list: T[], f: InactivityFilter, today: IsoDate): T[] {
  const { first } = monthBounds(today);
  return list.filter((c) => {
    const lp = c.lastPurchaseDate;
    if (f.noPurchaseThisMonth && lp !== null && lp >= first) return false;
    if (f.minDaysWithoutPurchase !== undefined) {
      const d = daysWithoutPurchase(lp, today);
      if (d !== null && d < f.minDaysWithoutPurchase) return false;
    }
    if (f.noPurchaseBetween && lp !== null && lp >= f.noPurchaseBetween.from && lp <= f.noPurchaseBetween.to)
      return false;
    if (f.curves?.length && !f.curves.includes(c.abcd)) return false;
    if (f.hasFreezer !== undefined && (c.freezerCount > 0) !== f.hasFreezer) return false;
    if (f.routeCodes?.length && (!c.commercialRouteCode || !f.routeCodes.includes(c.commercialRouteCode)))
      return false;
    return true;
  });
}

// ---------- Frequência esperada (seção 30) ----------
export type ExpectedFrequency =
  | { kind: "weekly" }
  | { kind: "biweekly" }
  | { kind: "monthly" }
  | { kind: "custom"; days: number };

export function frequencyDays(f: ExpectedFrequency): number {
  switch (f.kind) {
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "monthly":
      return 30;
    case "custom":
      return f.days;
  }
}

export function isOutOfFrequency(
  lastPurchase: IsoDate | null,
  f: ExpectedFrequency,
  today: IsoDate,
  toleranceDays: number,
): boolean {
  if (!lastPurchase) return true;
  return daysBetween(lastPurchase, today) > frequencyDays(f) + toleranceDays;
}

// ---------- Campos editáveis pelo vendedor (seção 6) ----------
export const SELLER_EDITABLE_CUSTOMER_FIELDS = [
  "phone",
  "whatsapp",
  "buyerName",
  "responsibleName",
  "mainContact",
  "commercialNotes",
  "commercialRouteCode",
] as const;
export type SellerEditableField = (typeof SELLER_EDITABLE_CUSTOMER_FIELDS)[number];

/** Retorna campos proibidos presentes no patch (vazio = ok). Validado no BACKEND. */
export function forbiddenSellerFields(patch: Record<string, unknown>): string[] {
  return Object.keys(patch).filter((k) => !(SELLER_EDITABLE_CUSTOMER_FIELDS as readonly string[]).includes(k));
}

// ---------- Visão fora da carteira (seção 7) ----------
export interface CustomerFull {
  id: string;
  code: string;
  legalName: string;
  tradeName: string;
  document: string;
  city: string;
  state: string;
  region: string | null;
  responsibleSellerId: string;
  responsibleSellerName: string;
  [k: string]: unknown;
}

export interface CustomerLimitedView {
  id: string;
  code: string;
  tradeName: string;
  city: string;
  state: string;
  region: string | null;
  responsibleSellerName: string;
  access: "limited";
  canRequestTransfer: true;
  canForwardOpportunity: true;
}

export function limitedCustomerView(c: CustomerFull): CustomerLimitedView {
  return {
    id: c.id,
    code: c.code,
    tradeName: c.tradeName,
    city: c.city,
    state: c.state,
    region: c.region,
    responsibleSellerName: c.responsibleSellerName,
    access: "limited",
    canRequestTransfer: true,
    canForwardOpportunity: true,
  };
}
