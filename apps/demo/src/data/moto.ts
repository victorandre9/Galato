/** Moto do vendedor: checklist (itens de segurança e km) e despesas (óleo, combustível, outras) com foto do comprovante. */
import { SELLERS, NOW } from "./mock";

export const MOTO_ITEMS = ["Pneus (calibragem e desgaste)", "Freios dianteiro e traseiro", "Nível de óleo", "Farol, lanterna e setas", "Buzina e retrovisores", "Corrente e relação", "Documento (CRLV) em dia", "Capacete e baú"] as const;
export type MotoItemState = "ok" | "problema";
export interface MotoChecklist { id: string; sellerId: string; at: string; km: number; items: Record<string, MotoItemState>; note?: string; photo?: string; plate: string }
export type ExpenseType = "oleo" | "combustivel" | "outras";
export const EXPENSE_LABEL: Record<ExpenseType, string> = { oleo: "Troca de óleo", combustivel: "Combustível", outras: "Outras despesas" };
export interface MotoExpense { id: string; sellerId: string; at: string; type: ExpenseType; description: string; valueCents: number; km?: number; photo?: string; status: "enviada" | "aprovada" | "recusada" }

export const MOTO_PLATES: Record<string, string> = Object.fromEntries(SELLERS.map((s, i) => [s.id, `${["PXK", "QTR", "RBN", "OMG", "PUZ"][i % 5]}-${3 + i}${"ABCDE"[i % 5]}${41 + i * 7}`]));

const iso = (daysAgo: number, h = 8) => new Date(NOW.getTime() - daysAgo * 86_400_000 - (10 - h) * 3_600_000).toISOString();
export const MOTO_CHECKLISTS: MotoChecklist[] = SELLERS.flatMap((s, i) => [7, 1].map((d, j) => ({
  id: `mc-${s.id}-${j}`, sellerId: s.id, at: iso(d + i % 2), km: 18_400 + i * 2_310 + j * 260, plate: MOTO_PLATES[s.id]!,
  items: Object.fromEntries(MOTO_ITEMS.map((it, k) => [it, i === 4 && j === 1 && k === 0 ? "problema" as const : "ok" as const])),
  ...(i === 4 && j === 1 ? { note: "Pneu traseiro gasto, precisa trocar." } : {}),
})));
export const MOTO_EXPENSES: MotoExpense[] = SELLERS.flatMap((s, i) => [
  { id: `me-${s.id}-1`, sellerId: s.id, at: iso(2 + i), type: "combustivel" as const, description: "Abastecimento posto da rota", valueCents: 4_500 + i * 700, status: "aprovada" as const },
  { id: `me-${s.id}-2`, sellerId: s.id, at: iso(1), type: "combustivel" as const, description: "Abastecimento", valueCents: 3_800 + i * 500, status: "enviada" as const },
  ...(i % 2 === 0 ? [{ id: `me-${s.id}-3`, sellerId: s.id, at: iso(9), type: "oleo" as const, description: "Troca de óleo 10W30 + filtro", valueCents: 6_500, km: 18_200 + i * 2_310, status: "aprovada" as const }] : []),
]);
