/**
 * Catálogo de status (rótulo + tom visual). Separa TIPO do documento de STATUS.
 * Máquinas de estado completas: docs/05-maquinas-de-estado.md.
 */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";
export interface StatusDef { label: string; tone: Tone; terminal?: boolean }

export const DOCUMENT_TYPES = { SIMPLE_QUOTE: "Orçamento simples", QUOTE: "Orçamento", ORDER: "Pedido" } as const;

export const QUOTE_STATUS = {
  draft: { label: "Rascunho", tone: "neutral" },
  ready: { label: "Pronto para envio", tone: "info" },
  sent: { label: "Enviado", tone: "info" },
  awaiting_customer: { label: "Aguardando cliente", tone: "warning" },
  negotiation: { label: "Negociação", tone: "warning" },
  approved: { label: "Aprovado", tone: "success" },
  rejected: { label: "Recusado", tone: "danger", terminal: true },
  expired: { label: "Expirado", tone: "neutral", terminal: true },
  cancelled: { label: "Cancelado", tone: "neutral", terminal: true },
  converted: { label: "Convertido em pedido", tone: "brand", terminal: true },
} satisfies Record<string, StatusDef>;

export const ORDER_STATUS = {
  draft: { label: "Rascunho", tone: "neutral" },
  awaiting_credit_review: { label: "Aguardando análise financeira", tone: "warning" },
  in_approval: { label: "Em aprovação", tone: "warning" },
  credit_approved: { label: "Aprovado pelo crédito", tone: "success" },
  scheduled_for_billing: { label: "Programado p/ faturamento", tone: "info" },
  sent_to_billing: { label: "Enviado ao faturamento", tone: "info" },
  billing_in_progress: { label: "Em faturamento", tone: "info" },
  invoiced: { label: "Faturado", tone: "success" },
  in_delivery_route: { label: "Em rota de entrega", tone: "brand" },
  in_transit: { label: "Em trânsito", tone: "brand" },
  delivered: { label: "Entregue", tone: "success" },
  completed: { label: "Concluído", tone: "success", terminal: true },
  blocked: { label: "Bloqueado", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "neutral", terminal: true },
  billing_error: { label: "Erro de faturamento", tone: "danger" },
} satisfies Record<string, StatusDef>;
export type OrderStatus = keyof typeof ORDER_STATUS;

export const PAYMENT_REQUEST_STATUS = {
  pending: { label: "Pendente", tone: "warning" },
  in_analysis: { label: "Em análise", tone: "info" },
  confirmed: { label: "Pagamento confirmado", tone: "success", terminal: true },
  not_identified: { label: "Pagamento não identificado", tone: "danger", terminal: true },
  incorrect_receipt: { label: "Comprovante incorreto", tone: "danger", terminal: true },
  divergence: { label: "Divergência", tone: "danger", terminal: true },
  rejected: { label: "Reprovado", tone: "danger", terminal: true },
  other: { label: "Outro motivo", tone: "neutral", terminal: true },
} satisfies Record<string, StatusDef>;
export type PaymentRequestStatus = keyof typeof PAYMENT_REQUEST_STATUS;

export const DELIVERY_STATUS = {
  scheduled: { label: "Programada", tone: "neutral" },
  in_transit: { label: "Em trânsito", tone: "brand" },
  delivered: { label: "Entregue", tone: "success", terminal: true },
  not_delivered: { label: "Não entregue", tone: "danger", terminal: true },
} satisfies Record<string, StatusDef>;
export type DeliveryStatus = keyof typeof DELIVERY_STATUS;

export const EPI_STATUS = {
  requested: { label: "Solicitado", tone: "info" },
  in_analysis: { label: "Em análise", tone: "warning" },
  approved: { label: "Aprovado", tone: "success" },
  awaiting_purchase: { label: "Aguardando compra", tone: "warning" },
  delivered: { label: "Entregue", tone: "success", terminal: true },
  rejected: { label: "Recusado", tone: "danger", terminal: true },
} satisfies Record<string, StatusDef>;
