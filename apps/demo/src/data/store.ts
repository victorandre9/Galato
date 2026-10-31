/**
 * Store em memória da demo. Simula a arquitetura offline-first:
 * toda ação grava "localmente" na hora; se offline vira pendente; ao voltar
 * conexão, sincroniza sozinho (sem botão "Importar").
 */
import { useSyncExternalStore } from "react";
import type { Role } from "./mock";

export type Theme = "light" | "dark";
export interface Toast { id: number; text: string; tone: "success" | "info" | "warning" | "danger" }
export type SyncState = "synced" | "pending" | "syncing";

interface UiState {
  role: Role | null;
  theme: Theme;
  online: boolean;
  pendingSync: number;
  sync: SyncState;
  lastSyncedAt: Date;
  toasts: Toast[];
  version: number;
  driverDayStarted: boolean;
  driverDayFinished: boolean;
  driverChecklistDone: boolean;
}

function initialTheme(): Theme {
  try {
    const t = localStorage.getItem("galato-theme");
    if (t === "light" || t === "dark") return t;
  } catch { /* storage indisponível */ }
  try {
    const attr = document.documentElement.dataset.theme;
    if (attr === "light" || attr === "dark") return attr;
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  } catch { /* ok */ }
  return "light";
}

let state: UiState = {
  role: null, theme: initialTheme(), online: true, pendingSync: 0, sync: "synced", lastSyncedAt: new Date(),
  toasts: [], version: 0, driverDayStarted: false, driverDayFinished: false, driverChecklistDone: false,
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setState(patch: Partial<UiState>) {
  state = { ...state, ...patch };
  emit();
}
export function getState() { return state; }
export function useStore(): UiState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

let toastId = 0;
export function toast(text: string, tone: Toast["tone"] = "success") {
  const t = { id: ++toastId, text, tone };
  setState({ toasts: [...state.toasts, t] });
  setTimeout(() => setState({ toasts: state.toasts.filter((x) => x.id !== t.id) }), 3200);
}

/**
 * Executa mutação nos dados mock e registra "gravação local".
 * Online: salva → sincroniza. Offline: fica pendente.
 */
export function commit(mutate: () => void, message: string) {
  mutate();
  if (state.online) {
    setState({ version: state.version + 1, sync: "syncing" });
    toast(message, "success");
    setTimeout(() => setState({ sync: state.pendingSync ? "pending" : "synced", lastSyncedAt: new Date() }), 700);
  } else {
    setState({ version: state.version + 1, pendingSync: state.pendingSync + 1, sync: "pending" });
    toast(`${message} · salvo no aparelho, sincroniza ao voltar a conexão`, "warning");
  }
}

export function setOnline(online: boolean) {
  if (online && state.pendingSync > 0) {
    setState({ online, sync: "syncing" });
    const n = state.pendingSync;
    setTimeout(() => {
      setState({ pendingSync: 0, sync: "synced", lastSyncedAt: new Date() });
      toast(`${n} registro(s) sincronizado(s) automaticamente`, "success");
    }, 1400);
  } else {
    setState({ online });
  }
}

export function setTheme(theme: Theme) {
  try { localStorage.setItem("galato-theme", theme); } catch { /* ok */ }
  setState({ theme });
}
