/**
 * Store em memória da demo. Simula a arquitetura offline-first:
 * toda ação grava "localmente" na hora; se offline vira pendente; ao voltar
 * conexão, sincroniza sozinho (sem botão "Importar").
 */
import { useSyncExternalStore } from "react";
import type { Role } from "./mock";
import { persistChanges, setSyncOnline, startSync, type DbMode } from "./sync";

/** light = Empresarial (novo, padrão) · classic = visual anterior claro · dark = escuro */
export type Theme = "light" | "classic" | "dark";
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
  dbMode: DbMode;
  /** pedido de troca de aba (vindo de notificação/alerta) */
  navTab: string | null;
  navN: number;
  /** modo apresentação (tela cheia dentro do app, como slides) */
  present: boolean;
}

function initialTheme(): Theme {
  try {
    const t = localStorage.getItem("galato-theme");
    if (t === "light" || t === "dark" || t === "classic") return t;
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
  toasts: [], version: 0, dbMode: "connecting", navTab: null, navN: 0, present: false,
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
export function toast(text: string, tone: Toast["tone"] = "success", ms = 3200) {
  const t = { id: ++toastId, text, tone };
  setState({ toasts: [...state.toasts, t] });
  setTimeout(() => setState({ toasts: state.toasts.filter((x) => x.id !== t.id) }), ms);
}

/**
 * Executa mutação nos dados mock e registra "gravação local".
 * Online: salva → sincroniza. Offline: fica pendente.
 */
export function commit(mutate: () => void, message: string) {
  mutate();
  persistChanges();
  if (state.online) {
    setState({ version: state.version + 1, sync: "syncing" });
    toast(message, "success");
    setTimeout(() => setState({ sync: state.pendingSync ? "pending" : "synced", lastSyncedAt: new Date() }), 600);
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
      setSyncOnline(true);
      setState({ pendingSync: 0, sync: "synced", lastSyncedAt: new Date() });
      toast(`${n} registro(s) sincronizado(s) automaticamente`, "success");
    }, 1200);
  } else {
    setSyncOnline(online);
    setState({ online });
  }
}

/** Atualização vinda de outro aparelho / outra pessoa. */
startSync({
  onRemoteChange: () => setState({ version: state.version + 1 }),
  onModeChange: (m) => {
    setState({ dbMode: m });
    if (m === "readonly") toast("Somente leitura: você não tem permissão de gravar no banco compartilhado. O que fizer fica salvo só neste aparelho.", "warning", 8000);
  },
});

export function setTheme(theme: Theme) {
  try { localStorage.setItem("galato-theme", theme); } catch { /* ok */ }
  setState({ theme });
}

/** Botão sol/lua: alterna entre o claro escolhido e o escuro. */
export function toggleDark(current: Theme) {
  let lastLight: Theme = "light";
  try { const v = localStorage.getItem("galato-light-theme"); if (v === "classic") lastLight = "classic"; } catch { /* ok */ }
  if (current === "dark") setTheme(lastLight);
  else { try { localStorage.setItem("galato-light-theme", current); } catch { /* ok */ } setTheme("dark"); }
}
export const THEME_LABEL: Record<Theme, string> = { light: "Empresarial (claro)", classic: "Clássico (claro anterior)", dark: "Escuro" };

/** Leva para uma aba da tela atual (usado por notificações e alertas). */
export function requestTab(tab: string) { setState({ navTab: tab, navN: state.navN + 1 }); }

/** Modo apresentação: some topo, menus e barras; fica só o conteúdo. */
export function setPresent(on: boolean) {
  setState({ present: on });
  try { document.documentElement.classList.toggle("present", on); } catch { /* ok */ }
  (document.getElementById("root") ?? document.documentElement).scrollTo({ top: 0 });
}
