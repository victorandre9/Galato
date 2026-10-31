/**
 * Prazo de pagamento recomendado x valor do pedido (seção 26).
 */
import type { PaymentTermRule } from "../config/parameters.js";

export function recommendPaymentTerm(amountCents: number, rules: PaymentTermRule[]): number {
  const sorted = [...rules].sort(
    (a, b) => (a.maxAmountCents ?? Number.MAX_SAFE_INTEGER) - (b.maxAmountCents ?? Number.MAX_SAFE_INTEGER),
  );
  const hit = sorted.find((r) => r.maxAmountCents === null || amountCents <= r.maxAmountCents);
  if (!hit) throw new Error("Regras de prazo não cobrem o valor — adicione faixa sem teto.");
  return hit.days;
}

export type TermDeviation = "equal" | "shorter" | "longer";

export interface PaymentTermDecision {
  recommendedDays: number;
  grantedDays: number;
  deviation: TermDeviation;
  deviationDays: number;
  /** precisa de permissão `payment_term:override` */
  requiresOverridePermission: boolean;
  /** deve ser registrado para KPI de prazo */
  mustRecordDeviation: boolean;
}

export function decidePaymentTerm(
  amountCents: number,
  grantedDays: number,
  rules: PaymentTermRule[],
): PaymentTermDecision {
  const recommended = recommendPaymentTerm(amountCents, rules);
  const diff = grantedDays - recommended;
  const deviation: TermDeviation = diff === 0 ? "equal" : diff < 0 ? "shorter" : "longer";
  return {
    recommendedDays: recommended,
    grantedDays,
    deviation,
    deviationDays: diff,
    requiresOverridePermission: diff > 0,
    mustRecordDeviation: diff !== 0,
  };
}

/** KPI: prazo médio vendido ponderado por valor. */
export function weightedAverageTerm(orders: { amountCents: number; grantedDays: number }[]): number {
  const total = orders.reduce((s, o) => s + o.amountCents, 0);
  if (total === 0) return 0;
  return orders.reduce((s, o) => s + o.amountCents * o.grantedDays, 0) / total;
}
