/**
 * Validação de estoque na montagem do pedido (seção 15).
 * Estoque 0 => item bloqueia emissão. Parcial => mostra disponível + opções.
 * Nunca confirma acima do disponível, salvo `allowOversell` (regra administrativa futura).
 */
export type StockItemStatus = "ok" | "partial" | "out_of_stock";
export type StockAction = "use_available" | "change_quantity" | "substitute_or_complement" | "remove_item" | "change_item";

export interface StockCheckItem {
  productId: string;
  productName: string;
  unit: string;
  requestedQty: number;
  availableQty: number;
}

export interface StockCheckResult extends StockCheckItem {
  status: StockItemStatus;
  message: string | null;
  actions: StockAction[];
}

export function checkStock(items: StockCheckItem[], allowOversell = false) {
  const results: StockCheckResult[] = items.map((i) => {
    const available = Math.max(0, i.availableQty);
    if (allowOversell || i.requestedQty <= available)
      return { ...i, status: "ok", message: null, actions: [] };
    if (available === 0)
      return {
        ...i,
        status: "out_of_stock",
        message: "Produto sem estoque.",
        actions: ["remove_item", "change_item"],
      };
    return {
      ...i,
      status: "partial",
      message: `Disponível: ${available} ${i.unit}.`,
      actions: ["use_available", "change_quantity", "substitute_or_complement", "remove_item"],
    };
  });
  return {
    items: results,
    canIssue: results.every((r) => r.status === "ok"),
    blockingCount: results.filter((r) => r.status !== "ok").length,
  };
}
