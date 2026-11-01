/**
 * Botão "voltar" do celular / navegador (e gesto de voltar do iPhone):
 * 1º fecha a janela aberta por cima; 2º volta para a aba anterior.
 * Mantém uma entrada extra no histórico enquanto houver para onde voltar.
 */
type Closer = { id: number; close: () => void };
const layers: Closer[] = [];
let seq = 0;
let guard = false;
let tabs: { has: () => boolean; back: () => void } | null = null;

const canBack = () => layers.length > 0 || !!tabs?.has();
function arm() {
  if (guard || !canBack()) return;
  try { history.pushState({ galato: 1 }, ""); guard = true; } catch { /* ok */ }
}

if (typeof window !== "undefined")
  window.addEventListener("popstate", () => {
    guard = false;
    const top = layers[layers.length - 1];
    if (top) top.close();
    else if (tabs?.has()) tabs.back();
    setTimeout(arm, 60);
  });

/** Janela (folha/modal) aberta: o voltar fecha ela. Retorna a função de remover. */
export function registerLayer(close: () => void) {
  const id = ++seq;
  layers.push({ id, close });
  arm();
  return () => { const i = layers.findIndex((l) => l.id === id); if (i >= 0) layers.splice(i, 1); };
}

/** Abas da tela atual (o voltar retorna para a aba anterior). */
export function registerTabs(t: { has: () => boolean; back: () => void } | null) { tabs = t; arm(); }
export const armBack = arm;
