/**
 * Fila do financeiro e SLA (seções 23 e 24).
 *
 * Prioridade (parametrizável):
 *  1. pendências abertas de dias anteriores (carry-over) primeiro, se `carryOverFirst`;
 *  2. dentro de cada grupo, ordem dos métodos (`methodPriority`, padrão PIX → BOLETO);
 *  3. FIFO por data de criação.
 *
 * Nenhuma solicitação aberta some da fila: só sai ao atingir estado terminal.
 */
import type { PaymentMethod, PlatformParameters } from "../config/parameters.js";
import { isoDateInTimezone } from "./dates.js";

export interface QueueItem {
  id: string;
  method: PaymentMethod;
  createdAt: string; // ISO datetime
  open: boolean;
}

export type SlaLevel = "ok" | "warning" | "breached";

export function slaLevel(
  createdAt: Date,
  now: Date,
  sla: PlatformParameters["financialSla"],
): { level: SlaLevel; elapsedHours: number; remainingHours: number } {
  const elapsed = (now.getTime() - createdAt.getTime()) / 3_600_000;
  const pct = (elapsed / sla.responseHours) * 100;
  const level: SlaLevel = elapsed > sla.responseHours ? "breached" : pct >= sla.warningAtPercent ? "warning" : "ok";
  return { level, elapsedHours: elapsed, remainingHours: sla.responseHours - elapsed };
}

export function orderFinancialQueue<T extends QueueItem>(
  items: T[],
  now: Date,
  params: Pick<PlatformParameters, "financialQueue" | "timezone">,
): (T & { carryOver: boolean })[] {
  const today = isoDateInTimezone(now, params.timezone);
  const prio = (m: PaymentMethod) => {
    const i = params.financialQueue.methodPriority.indexOf(m);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return items
    .filter((i) => i.open)
    .map((i) => ({ ...i, carryOver: isoDateInTimezone(new Date(i.createdAt), params.timezone) < today }))
    .sort((a, b) => {
      if (params.financialQueue.carryOverFirst && a.carryOver !== b.carryOver) return a.carryOver ? -1 : 1;
      if (prio(a.method) !== prio(b.method)) return prio(a.method) - prio(b.method);
      return a.createdAt.localeCompare(b.createdAt);
    });
}

/** Papéis que recebem alerta quando o SLA estoura (seção 24). */
export const SLA_BREACH_NOTIFY = ["sales_manager", "sales_coordinator", "finance", "responsible_seller"] as const;
