/**
 * Busca padrão do app: sem acento, sem maiúscula, várias palavras (todas precisam bater)
 * e CNPJ/telefone com ou sem pontuação.
 * Clientes: nome, razão social, CNPJ, código, bairro, endereço, cidade, vendedor.
 * Pedidos: número, nota fiscal, valor, status + tudo do cliente.
 */
import { CUSTOMERS, SELLERS, customerById, type Customer } from "./mock";

export const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const sellerName = (id?: string) => (id ? SELLERS.find((s) => s.id === id)?.name ?? "" : "");

export function customerText(c?: Customer | null) {
  if (!c) return "";
  return `${c.tradeName} ${c.legalName} ${c.code} ${c.document} ${c.district} ${c.address} ${c.city} ${c.buyerName} ${sellerName(c.sellerId)}`;
}

function hit(text: string, digitsSrc: string, q: string) {
  if (!q.trim()) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 4 && digitsSrc.replace(/\D/g, "").includes(digits)) return true;
  const hay = norm(text);
  return norm(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export function matchCustomer(c: Customer | null | undefined, q: string) {
  if (!q.trim()) return true;
  if (!c) return false;
  return hit(customerText(c), `${c.document} ${c.code} ${c.phone}`, q);
}
export const matchCustomerId = (id: string, q: string) => matchCustomer(customerById.get(id) ?? CUSTOMERS.find((x) => x.id === id), q);

/** Qualquer coisa com cliente/vendedor/número (pedido, comprovante, ocorrência...). */
export function matchRecord(r: { customerId?: string; sellerId?: string; number?: string; invoiceNumber?: string | null; extra?: string }, q: string) {
  if (!q.trim()) return true;
  const c = r.customerId ? customerById.get(r.customerId) : undefined;
  const text = `${r.number ?? ""} ${r.invoiceNumber ?? ""} ${r.extra ?? ""} ${sellerName(r.sellerId)} ${customerText(c)}`;
  return hit(text, `${r.number ?? ""} ${r.invoiceNumber ?? ""} ${c?.document ?? ""} ${c?.code ?? ""}`, q);
}

/** Prospect: nome, responsável, telefone, endereço, bairro, tipo, CNPJ/razão (cadastro) e vendedor. */
export function matchLead(l: { name: string; contact: string; phone: string; address: string; district: string; type: string; sellerId: string; cadastro?: { cnpj: string; legalName: string } }, q: string) {
  return hit(`${l.name} ${l.contact} ${l.phone} ${l.address} ${l.district} ${l.type} ${l.cadastro?.cnpj ?? ""} ${l.cadastro?.legalName ?? ""} ${sellerName(l.sellerId)}`, `${l.phone} ${l.cadastro?.cnpj ?? ""}`, q);
}
