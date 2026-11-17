/** Ocorrências do cliente (comerciais): cliente vai parar de comprar, reclamação, preço, entrega, etc. */
export type ComOccType = "parar" | "qualidade" | "entrega" | "preco" | "financeiro" | "atendimento" | "outros";
export type ComOccStatus = "aberta" | "em_tratativa" | "resolvida";
export interface ComOccurrence {
  id: string; number: string; type: ComOccType; customerId: string; sellerId: string;
  text: string; createdAt: string; createdBy: string; status: ComOccStatus;
  photo?: string; urgent?: boolean;
  log: { at: string; by: string; text: string }[];
}
export const COM_OCCURRENCES: ComOccurrence[] = [];
