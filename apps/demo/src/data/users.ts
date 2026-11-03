/**
 * Usuários da plataforma (cadastro feito pelo gerente geral = usuário master).
 * O limite de usuários é definido por nós (plano contratado), não pelo cliente.
 */
import { SELLERS, DRIVERS, COORDINATOR, GENERAL_MANAGER, FINANCE_USER, BILLING_USER, TRANSPORT_COORD } from "./mock";

/** Limite do plano contratado (definido pela equipe de programação). */
export const USER_LIMIT = 20;

export type UserRole = "general_manager" | "sales_coordinator" | "seller" | "finance" | "billing" | "transport_coordinator" | "driver";
export const USER_ROLE_LABEL: Record<UserRole, string> = {
  general_manager: "Gerente geral (master)", sales_coordinator: "Supervisor comercial", seller: "Vendedor externo",
  finance: "Financeiro / Crédito", billing: "Faturamento", transport_coordinator: "Coord. Transportes", driver: "Motorista",
};
export interface AppUser { id: string; name: string; role: UserRole; email: string; phone: string; active: boolean; refId?: string; master?: boolean }

const mail = (n: string) => `${n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(" ").slice(0, 2).join(".")}@galato.com.br`;
export const USERS: AppUser[] = [
  { id: "u-g1", name: GENERAL_MANAGER.name, role: "general_manager", email: mail(GENERAL_MANAGER.name), phone: "(31) 99811-2040", active: true, refId: GENERAL_MANAGER.id, master: true },
  { id: "u-c1", name: COORDINATOR.name, role: "sales_coordinator", email: mail(COORDINATOR.name), phone: "(31) 99722-3311", active: true, refId: COORDINATOR.id },
  ...SELLERS.map((s, i) => ({ id: `u-${s.id}`, name: s.name, role: "seller" as const, email: mail(s.name), phone: `(31) 99${600 + i * 7}-${4100 + i * 37}`, active: true, refId: s.id })),
  { id: "u-f1", name: FINANCE_USER.name, role: "finance", email: mail(FINANCE_USER.name), phone: "(31) 99633-8080", active: true, refId: FINANCE_USER.id },
  { id: "u-b1", name: BILLING_USER.name, role: "billing", email: mail(BILLING_USER.name), phone: "(31) 99544-1290", active: true, refId: BILLING_USER.id },
  { id: "u-t1", name: TRANSPORT_COORD.name, role: "transport_coordinator", email: mail(TRANSPORT_COORD.name), phone: "(31) 99455-7712", active: true, refId: TRANSPORT_COORD.id },
  ...DRIVERS.map((d) => ({ id: `u-${d.id}`, name: d.name, role: "driver" as const, email: mail(d.name), phone: d.phone, active: true, refId: d.id })),
];

/** Chave da foto do usuário (a mesma usada no perfil de cada um). */
export function photoKeyOf(u: AppUser) {
  if (u.role === "seller" && u.refId) return `seller:${u.refId}`;
  if (u.role === "driver" && u.refId) return `driver:${u.refId}`;
  if (u.master) return "general_manager";
  if (u.refId && ["c1", "f1", "b1", "t1"].includes(u.refId)) return u.role;
  return `user:${u.id}`;
}

/** Mantém o nome igual nas outras telas quando o master edita. */
export function applyUserName(u: AppUser) {
  const s = SELLERS.find((x) => x.id === u.refId); if (s && u.role === "seller") s.name = u.name;
  const d = DRIVERS.find((x) => x.id === u.refId); if (d && u.role === "driver") d.name = u.name;
}
