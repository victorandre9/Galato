/**
 * Botão "voltar" do celular / navegador (e gesto de voltar do iPhone). Nunca fecha o app sem querer:
 * 1º fecha a janela aberta por cima; 2º volta para a aba anterior;
 * 3º na tela inicial do perfil, volta para a escolha de perfil;
 * 4º na escolha de perfil, avisa "toque de novo para sair" e só sai no 2º toque (em até 2,5 s).
 * Sempre mantém uma entrada extra no histórico para o voltar cair aqui, e não fora do app.
 */
type Closer = { id: number; close: () => void };
const layers: Closer[] = [];
let seq = 0;
let guard = false;
let tabs: { has: () => boolean; back: () => void } | null = null;
let root: { has: () => boolean; back: () => void } | null = null;
let notice: ((text: string) => void) | null = null;
let exitArmedAt = 0;
let leaving = false;

function arm() {
  if (guard || leaving) return;
  try { history.pushState({ galato: 1 }, ""); guard = true; } catch { /* ok */ }
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    guard = false;
    if (leaving) return;
    const top = layers[layers.length - 1];
    if (top) top.close();
    else if (tabs?.has()) tabs.back();
    else if (root?.has()) root.back();
    else if (Date.now() - exitArmedAt < 2500) {
      // segundo toque: deixa sair do app
      leaving = true;
      try { history.back(); } catch { /* ok */ }
      return;
    } else {
      exitArmedAt = Date.now();
      notice?.("Toque em voltar de novo para sair do app");
    }
    setTimeout(arm, 60);
  });
  // primeira entrada: o voltar já cai no app
  if (document.readyState === "complete") arm(); else window.addEventListener("load", () => arm(), { once: true });
}

/** Janela (folha/modal) aberta: o voltar fecha ela. Retorna a função de remover. */
export function registerLayer(close: () => void) {
  const id = ++seq;
  layers.push({ id, close });
  arm();
  return () => { const i = layers.findIndex((l) => l.id === id); if (i >= 0) layers.splice(i, 1); };
}

/** Abas da tela atual (o voltar retorna para a aba anterior). */
export function registerTabs(t: { has: () => boolean; back: () => void } | null) { tabs = t; arm(); }
/** Tela inicial do perfil: o voltar leva para a escolha de perfil. */
export function registerRoot(r: { has: () => boolean; back: () => void } | null) { root = r; arm(); }
/** Mostra o aviso de "toque de novo para sair". */
export function registerBackNotice(fn: (text: string) => void) { notice = fn; }
export const armBack = arm;
