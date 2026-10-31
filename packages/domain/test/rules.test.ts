import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMETERS as P, goalProgress, businessDaysInMonth, rankByAttainment, classifyAbcd,
  validateAbcdRules, recommendPaymentTerm, decidePaymentTerm, checkStock, orderFinancialQueue,
  slaLevel, inactivityBucket, filterCustomers, routeForDate, forbiddenSellerFields, summarizeReceivables,
} from "../src/index.js";

const cal = P.workCalendar;

describe("metas por dia útil", () => {
  it("conta dias úteis do mês (out/2026 = 22)", () => {
    expect(businessDaysInMonth("2026-10-15", cal)).toBe(22);
  });
  it("respeita feriado parametrizado", () => {
    expect(businessDaysInMonth("2026-10-15", { ...cal, holidays: ["2026-10-12"] })).toBe(21);
  });
  it("meta diária = mensal / dias úteis e falta por dia útil restante", () => {
    const g = goalProgress({ today: "2026-10-26", monthlyGoalCents: 22_000_000, achievedMonthCents: 18_000_000, achievedTodayCents: 600_000, calendar: cal });
    expect(g.dailyGoalCents).toBe(1_000_000);
    expect(g.remainingBusinessDays).toBe(5); // 26..30
    expect(g.requiredPerRemainingDayCents).toBe(800_000);
    expect(g.dayAttainmentPct).toBeCloseTo(60);
  });
});

describe("ranking proporcional", () => {
  it("ordena por % e não por valor absoluto (exemplo seção 34)", () => {
    const r = rankByAttainment([
      { id: "b", name: "B", target: 20, achieved: 14 },
      { id: "a", name: "A", target: 15, achieved: 12 },
    ]);
    expect(r.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r[0]!.attainmentPct).toBe(80);
  });
  it("sem meta vai para o fim sem posição", () => {
    const r = rankByAttainment([{ id: "x", name: "X", target: 0, achieved: 9 }, { id: "y", name: "Y", target: 10, achieved: 1 }]);
    expect(r[1]).toMatchObject({ id: "x", position: null });
  });
});

describe("curva ABCD", () => {
  it("regras padrão válidas e classificação nas bordas", () => {
    expect(validateAbcdRules(P.abcd.rules)).toEqual([]);
    expect(classifyAbcd(79_999, P.abcd.rules)).toBe("D");
    expect(classifyAbcd(80_000, P.abcd.rules)).toBe("C");
    expect(classifyAbcd(160_000, P.abcd.rules)).toBe("B");
    expect(classifyAbcd(300_000, P.abcd.rules)).toBe("A");
  });
  it("detecta lacuna", () => {
    expect(validateAbcdRules([{ class: "D", minMonthlyCents: 0, maxMonthlyCents: 100 }, { class: "A", minMonthlyCents: 500, maxMonthlyCents: null }]).length).toBeGreaterThan(0);
  });
});

describe("prazo de pagamento", () => {
  it("recomenda por faixa", () => {
    expect(recommendPaymentTerm(50_000, P.paymentTerms.rules)).toBe(7);
    expect(recommendPaymentTerm(150_000, P.paymentTerms.rules)).toBe(14);
    expect(recommendPaymentTerm(150_001, P.paymentTerms.rules)).toBe(21);
  });
  it("registra desvio maior exige permissão", () => {
    const d = decidePaymentTerm(40_000, 14, P.paymentTerms.rules);
    expect(d).toMatchObject({ deviation: "longer", deviationDays: 7, requiresOverridePermission: true });
  });
});

describe("estoque", () => {
  it("zerado bloqueia, parcial mostra disponível", () => {
    const r = checkStock([
      { productId: "1", productName: "Gelinho", unit: "caixas", requestedQty: 10, availableQty: 9 },
      { productId: "2", productName: "Pote 2L", unit: "caixas", requestedQty: 2, availableQty: 0 },
    ]);
    expect(r.canIssue).toBe(false);
    expect(r.items[0]!.message).toBe("Disponível: 9 caixas.");
    expect(r.items[1]!.message).toBe("Produto sem estoque.");
  });
});

describe("fila do financeiro", () => {
  const now = new Date("2026-10-30T15:00:00Z");
  it("pendência de ontem antes; depois PIX → boleto; FIFO", () => {
    const q = orderFinancialQueue([
      { id: "pixHoje", method: "PIX", createdAt: "2026-10-30T13:00:00Z", open: true },
      { id: "boletoOntem", method: "BOLETO", createdAt: "2026-10-29T13:00:00Z", open: true },
      { id: "boletoHoje", method: "BOLETO", createdAt: "2026-10-30T12:00:00Z", open: true },
      { id: "fechado", method: "PIX", createdAt: "2026-10-28T12:00:00Z", open: false },
    ], now, P);
    expect(q.map((x) => x.id)).toEqual(["boletoOntem", "pixHoje", "boletoHoje"]);
  });
  it("SLA 24h", () => {
    expect(slaLevel(new Date("2026-10-29T14:00:00Z"), now, P.financialSla).level).toBe("breached");
    expect(slaLevel(new Date("2026-10-30T14:00:00Z"), now, P.financialSla).level).toBe("ok");
  });
});

describe("clientes", () => {
  it("baldes 7/14/21/28+", () => {
    const b = P.inactivity.dashboardBuckets;
    expect([3, 7, 13, 14, 27, 60, null].map((d) => inactivityBucket(d, b))).toEqual([null, 7, 7, 14, 21, 28, 28]);
  });
  it("filtro combinado: curva A + 15 dias + Rota 2", () => {
    const list = [
      { id: "1", abcd: "A" as const, commercialRouteCode: "R2", lastPurchaseDate: "2026-10-01", freezerCount: 2 },
      { id: "2", abcd: "A" as const, commercialRouteCode: "R2", lastPurchaseDate: "2026-10-25", freezerCount: 1 },
      { id: "3", abcd: "B" as const, commercialRouteCode: "R2", lastPurchaseDate: "2026-09-01", freezerCount: 0 },
    ];
    expect(filterCustomers(list, { curves: ["A"], minDaysWithoutPurchase: 15, routeCodes: ["R2"] }, "2026-10-30").map((c) => c.id)).toEqual(["1"]);
  });
  it("rota do dia: segunda = Rota 1", () => {
    expect(routeForDate("2026-10-26", P.commercialRoutes)?.code).toBe("R1");
  });
  it("vendedor não edita dado fiscal", () => {
    expect(forbiddenSellerFields({ phone: "x", document: "y" })).toEqual(["document"]);
  });
  it("crédito bloqueado manualmente", () => {
    expect(summarizeReceivables([], "2026-10-30", true).creditStatus).toBe("blocked");
  });
});
