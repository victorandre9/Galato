/**
 * Ranking PROPORCIONAL (seções 33 e 34).
 * Ordena por % de atingimento, nunca por valor absoluto.
 * Empate: maior realizado absoluto, depois nome.
 * Sem meta/planejado (alvo 0) => sem % e vai para o fim.
 */
export interface RankingInput {
  id: string;
  name: string;
  target: number; // meta (centavos) ou visitas planejadas
  achieved: number; // realizado (centavos) ou visitas realizadas
}

export interface RankingRow extends RankingInput {
  position: number | null;
  attainmentPct: number | null;
  pending: number;
}

export function rankByAttainment(rows: RankingInput[]): RankingRow[] {
  const withPct = rows.map((r) => ({
    ...r,
    attainmentPct: r.target > 0 ? (r.achieved / r.target) * 100 : null,
    pending: Math.max(0, r.target - r.achieved),
  }));
  withPct.sort((a, b) => {
    if (a.attainmentPct === null && b.attainmentPct === null) return a.name.localeCompare(b.name);
    if (a.attainmentPct === null) return 1;
    if (b.attainmentPct === null) return -1;
    if (b.attainmentPct !== a.attainmentPct) return b.attainmentPct - a.attainmentPct;
    if (b.achieved !== a.achieved) return b.achieved - a.achieved;
    return a.name.localeCompare(b.name);
  });
  let pos = 0;
  return withPct.map((r) => ({ ...r, position: r.attainmentPct === null ? null : ++pos }));
}
