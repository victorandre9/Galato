/**
 * Curva ABCD parametrizável (seção 13).
 */
import type { AbcdClass, AbcdRule } from "../config/parameters.js";

export function validateAbcdRules(rules: AbcdRule[]): string[] {
  const errors: string[] = [];
  const sorted = [...rules].sort((a, b) => a.minMonthlyCents - b.minMonthlyCents);
  if (sorted[0] && sorted[0].minMonthlyCents !== 0) errors.push("Primeira faixa deve iniciar em R$ 0.");
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!;
    const next = sorted[i + 1];
    if (r.maxMonthlyCents !== null && r.maxMonthlyCents < r.minMonthlyCents)
      errors.push(`Faixa ${r.class}: máximo menor que mínimo.`);
    if (next) {
      if (r.maxMonthlyCents === null) errors.push(`Faixa ${r.class} sem teto não pode ser seguida de outra.`);
      else if (next.minMonthlyCents !== r.maxMonthlyCents + 1)
        errors.push(`Lacuna ou sobreposição entre ${r.class} e ${next.class}.`);
    } else if (r.maxMonthlyCents !== null) {
      errors.push(`Última faixa (${r.class}) deve ser sem teto.`);
    }
  }
  if (new Set(rules.map((r) => r.class)).size !== rules.length) errors.push("Classes duplicadas.");
  return errors;
}

export function classifyAbcd(averageMonthlyCents: number, rules: AbcdRule[]): AbcdClass {
  const v = Math.max(0, Math.round(averageMonthlyCents));
  const hit = rules.find(
    (r) => v >= r.minMonthlyCents && (r.maxMonthlyCents === null || v <= r.maxMonthlyCents),
  );
  if (!hit) throw new Error(`Nenhuma faixa ABCD cobre ${v} centavos — revise parâmetros.`);
  return hit.class;
}

/** Média mensal sobre a janela configurada (meses sem compra contam como 0). */
export function averageMonthly(monthlyTotalsCents: number[], windowMonths: number): number {
  if (windowMonths <= 0) return 0;
  const last = monthlyTotalsCents.slice(-windowMonths);
  const sum = last.reduce((a, b) => a + b, 0);
  return Math.round(sum / windowMonths);
}
