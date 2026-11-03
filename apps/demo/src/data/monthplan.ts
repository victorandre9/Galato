/** Plano do mês (meta total, metas por vendedor/região e premiação), definido pelo gerente geral. */
import { SELLERS, TODAY } from "./mock";

export interface MonthPlan {
  id: string; // AAAA-MM
  totalCents: number;
  perSeller: Record<string, number>;
  prizes: { place: 1 | 2 | 3; prize: string; on: boolean }[];
  criterion: "pct" | "sales";
  message?: string;
  updatedAt?: string; updatedBy?: string;
}
export const MONTH_PLANS: MonthPlan[] = [];

export function planFor(key: string): MonthPlan {
  const p = MONTH_PLANS.find((x) => x.id === key);
  if (p) return p;
  const perSeller = Object.fromEntries(SELLERS.map((s) => [s.id, s.monthlyGoalCents]));
  return {
    id: key, totalCents: Object.values(perSeller).reduce((a, b) => a + b, 0), perSeller, criterion: "pct",
    prizes: [{ place: 1, prize: "Garrafa de whisky", on: true }, { place: 2, prize: "", on: false }, { place: 3, prize: "", on: false }],
    message: "Vamos juntos bater a meta!",
  };
}

/** Aplica a meta do mês atual definida pelo gerente geral às metas dos vendedores (todo o app usa). */
export function applyCurrentPlan() {
  const p = MONTH_PLANS.find((x) => x.id === TODAY.slice(0, 7));
  if (!p) return;
  for (const s of SELLERS) if (p.perSeller[s.id]) s.monthlyGoalCents = p.perSeller[s.id]!;
}
