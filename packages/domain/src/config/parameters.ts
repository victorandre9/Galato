/**
 * Parâmetros configuráveis da plataforma.
 *
 * REGRA: nenhum valor de negócio fica hardcoded nas regras. Toda regra recebe
 * os parâmetros por argumento. Os valores DEFAULT abaixo são apenas iniciais
 * (apresentação) e serão substituídos pela tela de configuração administrativa.
 *
 * Itens marcados `aValidar: true` dependem de decisão da diretoria/gerência.
 *
 * Dinheiro: sempre em CENTAVOS (inteiro). Nunca float para valores monetários.
 */
import { z } from "zod";

export const AbcdClassSchema = z.enum(["A", "B", "C", "D"]);
export type AbcdClass = z.infer<typeof AbcdClassSchema>;

export const AbcdRuleSchema = z.object({
  class: AbcdClassSchema,
  /** inclusivo, centavos/mês */
  minMonthlyCents: z.number().int().nonnegative(),
  /** inclusivo, centavos/mês; null = sem teto */
  maxMonthlyCents: z.number().int().nonnegative().nullable(),
});
export type AbcdRule = z.infer<typeof AbcdRuleSchema>;

export const PaymentTermRuleSchema = z.object({
  /** inclusivo; null = acima de todos os anteriores */
  maxAmountCents: z.number().int().positive().nullable(),
  days: z.number().int().nonnegative(),
});
export type PaymentTermRule = z.infer<typeof PaymentTermRuleSchema>;

export const CommercialRouteDefSchema = z.object({
  code: z.string(), // código interno estável
  name: z.string(), // nome amigável (renomeável)
  weekday: z.number().int().min(0).max(6), // 0=domingo … 6=sábado
});
export type CommercialRouteDef = z.infer<typeof CommercialRouteDefSchema>;

export const PaymentMethodSchema = z.enum(["PIX", "BOLETO"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PlatformParametersSchema = z.object({
  timezone: z.string(),
  abcd: z.object({
    rules: z.array(AbcdRuleSchema).min(1),
    /** janela (meses) para calcular a média mensal de compra — aValidar */
    averageWindowMonths: z.number().int().positive(),
  }),
  workCalendar: z.object({
    /** dias úteis da semana (0=dom … 6=sáb) */
    workWeekdays: z.array(z.number().int().min(0).max(6)),
    /** feriados YYYY-MM-DD */
    holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  }),
  commercialRoutes: z.array(CommercialRouteDefSchema),
  inactivity: z.object({
    /** limites inferiores dos baldes do dashboard (último é "N+") */
    dashboardBuckets: z.array(z.number().int().positive()).min(1),
    /** dias sem compra a partir dos quais freezer é "ativo sem giro" — aValidar */
    idleAssetThresholdDays: z.number().int().positive(),
    /** tolerância (dias) sobre a frequência esperada — aValidar */
    frequencyToleranceDays: z.number().int().nonnegative(),
  }),
  paymentTerms: z.object({
    rules: z.array(PaymentTermRuleSchema).min(1),
  }),
  financialQueue: z.object({
    /** ordem de prioridade dos métodos */
    methodPriority: z.array(PaymentMethodSchema),
    /** pendências de dias anteriores passam à frente das do dia */
    carryOverFirst: z.boolean(),
  }),
  financialSla: z.object({
    responseHours: z.number().positive(),
    /** % do SLA a partir do qual vira "atenção" (antes de estourar) */
    warningAtPercent: z.number().min(0).max(100),
  }),
  orders: z.object({
    /** permite confirmar quantidade acima do estoque (futura regra administrativa) */
    allowOversell: z.boolean(),
    /** pedidos com crédito OK seguem direto para aprovado — aValidar */
    creditAutoApproveWhenClear: z.boolean(),
    /** quem pode definir data prevista de entrega */
    deliveryDateEditableBy: z.array(z.string()),
  }),
  discounts: z.object({
    /** limite de desconto (%) por papel — aValidar */
    maxPercentByRole: z.record(z.string(), z.number().min(0).max(100)),
  }),
  planning: z.object({
    /** exige aprovação formal do planejamento semanal — aValidar (inicia false) */
    weeklyPlanApprovalRequired: z.boolean(),
  }),
  portfolio: z.object({
    /** remove acesso temporário automaticamente ao fim do período */
    autoRevokeTemporaryAccess: z.boolean(),
  }),
  referral: z.object({
    /** comissão/bonificação por indicação — definida posteriormente pela empresa */
    enabled: z.boolean(),
    commissionPercent: z.number().min(0).max(100).nullable(),
    fixedBonusCents: z.number().int().nonnegative().nullable(),
  }),
  logistics: z.object({
    /** HH:mm — motorista sem iniciar após este horário gera alerta */
    driverNotStartedAlertAfter: z.string().regex(/^\d{2}:\d{2}$/),
    /** pontos percentuais abaixo do ritmo esperado para alertar */
    routeBehindPacePercent: z.number().min(0).max(100),
    /** horário padrão de fim de rota para cálculo de ritmo */
    defaultRouteEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  catalogs: z.object({
    incidentTypes: z.array(z.string()),
    epiTypes: z.array(z.string()),
    nonDeliveryReasons: z.array(z.string()),
    deliveryProofTypes: z.array(z.string()),
    nonconformityPhotoRequired: z.boolean(),
    paymentResponseReasons: z.array(z.string()),
  }),
});
export type PlatformParameters = z.infer<typeof PlatformParametersSchema>;

const BRL = (reais: number) => Math.round(reais * 100);

/** Valores iniciais para apresentação. NÃO são regra imutável. */
export const DEFAULT_PARAMETERS: PlatformParameters = {
  timezone: "America/Sao_Paulo",
  abcd: {
    rules: [
      { class: "D", minMonthlyCents: 0, maxMonthlyCents: BRL(799.99) },
      { class: "C", minMonthlyCents: BRL(800), maxMonthlyCents: BRL(1599.99) },
      { class: "B", minMonthlyCents: BRL(1600), maxMonthlyCents: BRL(2999.99) },
      { class: "A", minMonthlyCents: BRL(3000), maxMonthlyCents: null },
    ],
    averageWindowMonths: 3,
  },
  workCalendar: { workWeekdays: [1, 2, 3, 4, 5], holidays: [] },
  commercialRoutes: [
    { code: "R1", name: "Rota 1", weekday: 1 },
    { code: "R2", name: "Rota 2", weekday: 2 },
    { code: "R3", name: "Rota 3", weekday: 3 },
    { code: "R4", name: "Rota 4", weekday: 4 },
    { code: "R5", name: "Rota 5", weekday: 5 },
  ],
  inactivity: {
    dashboardBuckets: [7, 14, 21, 28],
    idleAssetThresholdDays: 30,
    frequencyToleranceDays: 2,
  },
  paymentTerms: {
    rules: [
      { maxAmountCents: BRL(500), days: 7 },
      { maxAmountCents: BRL(1500), days: 14 },
      { maxAmountCents: null, days: 21 },
    ],
  },
  financialQueue: { methodPriority: ["PIX", "BOLETO"], carryOverFirst: true },
  financialSla: { responseHours: 24, warningAtPercent: 75 },
  orders: {
    allowOversell: false,
    creditAutoApproveWhenClear: false,
    deliveryDateEditableBy: ["seller", "sales_manager", "sales_coordinator", "general_manager"],
  },
  discounts: {
    maxPercentByRole: { seller: 5, sales_manager: 10, sales_coordinator: 10, general_manager: 15 },
  },
  planning: { weeklyPlanApprovalRequired: false },
  portfolio: { autoRevokeTemporaryAccess: true },
  referral: { enabled: false, commissionPercent: null, fixedBonusCents: null },
  logistics: {
    driverNotStartedAlertAfter: "08:30",
    routeBehindPacePercent: 20,
    defaultRouteEndTime: "17:00",
  },
  catalogs: {
    incidentTypes: ["Acidente de trânsito", "Avaria de mercadoria", "Ocorrência no cliente", "Outro"],
    epiTypes: ["Luva térmica", "Bota de segurança", "Jaqueta térmica", "Colete refletivo", "Outro"],
    nonDeliveryReasons: [
      "Cliente fechado",
      "Endereço incorreto",
      "Cliente recusou",
      "Mercadoria avariada",
      "Problema no veículo",
      "Divergência",
      "Outro",
    ],
    deliveryProofTypes: ["Canhoto NF", "NF assinada", "CTe assinado", "Outro"],
    nonconformityPhotoRequired: false,
    paymentResponseReasons: [
      "Pagamento confirmado",
      "Pagamento não identificado",
      "Comprovante incorreto",
      "Divergência",
      "Reprovado",
      "Outro motivo",
    ],
  },
};

/** Lista de parâmetros que dependem de validação da diretoria (exibida na tela admin). */
export const PARAMETERS_PENDING_VALIDATION = [
  "abcd.averageWindowMonths",
  "inactivity.idleAssetThresholdDays",
  "inactivity.frequencyToleranceDays",
  "orders.creditAutoApproveWhenClear",
  "discounts.maxPercentByRole",
  "planning.weeklyPlanApprovalRequired",
  "referral.*",
  "logistics.*",
] as const;
