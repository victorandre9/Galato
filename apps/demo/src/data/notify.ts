/** Central de notificações: cria e filtra por quem está vendo. */
import { NOTIFICATIONS, NOW, CURRENT_SELLER, CURRENT_DRIVER, type NotifKind, type Role } from "./mock";

let seq = 0;
export function notify(n: { kind: NotifKind; title: string; text: string; to: string[]; priority?: "normal" | "high" }) {
  NOTIFICATIONS.unshift({
    id: `n${Date.now().toString(36)}${(seq++).toString(36)}`,
    at: new Date().toISOString() > NOW.toISOString() ? new Date().toISOString() : NOW.toISOString(),
    kind: n.kind, priority: n.priority ?? "normal", title: n.title, text: n.text, to: n.to, readBy: [],
  });
}

/** Chaves que identificam o usuário de demonstração do perfil atual. */
export function viewerKeys(role: Role): string[] {
  if (role === "seller") return ["seller", `seller:${CURRENT_SELLER.id}`];
  if (role === "driver") return ["driver", `driver:${CURRENT_DRIVER.id}`];
  return [role];
}
export const viewerId = (role: Role) => viewerKeys(role)[viewerKeys(role).length - 1]!;

export function notificationsFor(role: Role) {
  const keys = viewerKeys(role);
  return NOTIFICATIONS.filter((n) => n.to.some((t) => keys.includes(t))).sort((a, b) => b.at.localeCompare(a.at));
}

export const MANAGERS_KEYS = ["sales_manager", "sales_coordinator", "general_manager"];
