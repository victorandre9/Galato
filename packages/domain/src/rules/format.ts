const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const formatBRL = (cents: number, compact = false) => (compact ? brl0 : brl).format(cents / 100);
export const formatPct = (v: number, digits = 0) => `${v.toFixed(digits).replace(".", ",")}%`;
export const formatInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
