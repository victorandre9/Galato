/**
 * Situação financeira do cliente e efeito no pedido (seção 21).
 * Vendedor SEMPRE consegue salvar. Bloqueio financeiro retém o pedido em "blocked"
 * até liberação — nunca segue para faturamento automaticamente.
 */
import { daysBetween, type IsoDate } from "./dates.js";

export type CreditStatus = "clear" | "attention" | "blocked";

export interface ReceivableLite {
  id: string;
  amountCents: number;
  openCents: number;
  dueDate: IsoDate;
  paidDate: IsoDate | null;
}

export interface CustomerFinancialSummary {
  openCount: number;
  openCents: number;
  overdueCount: number;
  overdueCents: number;
  nextDueDate: IsoDate | null;
  /** média de atraso (dias) dos títulos pagos com atraso + vencidos em aberto */
  averageDelayDays: number;
  creditStatus: CreditStatus;
}

export function summarizeReceivables(
  rows: ReceivableLite[],
  today: IsoDate,
  manualBlock: boolean,
): CustomerFinancialSummary {
  const open = rows.filter((r) => r.openCents > 0);
  const overdue = open.filter((r) => r.dueDate < today);
  const delays = rows
    .map((r) => {
      const ref = r.paidDate ?? (r.openCents > 0 ? today : null);
      return ref ? Math.max(0, daysBetween(r.dueDate, ref)) : 0;
    })
    .filter((d) => d > 0);
  const nextDue = open.filter((r) => r.dueDate >= today).map((r) => r.dueDate).sort()[0] ?? null;
  const creditStatus: CreditStatus = manualBlock ? "blocked" : overdue.length > 0 ? "attention" : "clear";
  return {
    openCount: open.length,
    openCents: open.reduce((s, r) => s + r.openCents, 0),
    overdueCount: overdue.length,
    overdueCents: overdue.reduce((s, r) => s + r.openCents, 0),
    nextDueDate: nextDue,
    averageDelayDays: delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0,
    creditStatus,
  };
}

export const CREDIT_BLOCK_MESSAGE =
  "Este pedido poderá ser salvo, porém ficará bloqueado até análise/liberação do financeiro.";

export function orderSubmissionNotice(status: CreditStatus): string | null {
  return status === "blocked" ? CREDIT_BLOCK_MESSAGE : null;
}
