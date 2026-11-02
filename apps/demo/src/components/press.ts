/**
 * Efeito de toque em TUDO que é clicável: encolhe ~20% e volta num movimento único e fluido;
 * a ação acontece logo depois. Câmera/galeria, quantidade e campos: animam sem atraso.
 * Menu de baixo: sem efeito e sem atraso.
 */
const SKIP = ".bottom-nav, input, select, textarea, label";
const INSTANT = "[data-instant], .step-btn, a[href], [type=submit]";
export const PRESS_MS = 200; // ir (≈100 ms) + voltar (≈100 ms)
let replaying = false;

const hasReactClick = (el: Element) => {
  const k = Object.keys(el).find((x) => x.startsWith("__reactProps"));
  return !!(k && (el as unknown as Record<string, { onClick?: unknown }>)[k]?.onClick);
};

/** Sobe a partir do toque até achar o elemento clicável (botão, link, linha/card com ação). */
export function clickableFrom(t: Element | null): HTMLElement | null {
  for (let el = t as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.matches(SKIP)) return null;
    if (el.matches(".sheet, .overlay, main, .main")) return null;
    if (el.matches("button, [role=button], [role=radio], a[href], .click") || hasReactClick(el)) return el;
  }
  return null;
}

function animate(el: HTMLElement) {
  const isDark = document.documentElement.dataset.theme === "dark";
  el.style.setProperty("--rim", getComputedStyle(el).boxShadow);
  el.dataset.pressing = "1";
  el.classList.add("press-anim");
  if (isDark) el.classList.add("press-frame");
  const a = el.animate(
    [{ "--press-s": 1 } as Keyframe, { "--press-s": 0.8, offset: 0.5 } as Keyframe, { "--press-s": 1 } as Keyframe],
    { duration: PRESS_MS, easing: "cubic-bezier(.45, 0, .55, 1)" },
  );
  const done = () => { el.classList.remove("press-anim", "press-frame"); delete el.dataset.pressing; el.style.removeProperty("--rim"); };
  a.onfinish = done; a.oncancel = done;
}

function onClick(e: MouseEvent) {
  if (replaying || e.defaultPrevented || e.button !== 0) return;
  const t = e.target as HTMLElement | null;
  const el = clickableFrom(t);
  if (!el || (el as HTMLButtonElement).disabled) return;
  if (el.dataset.pressing) { e.preventDefault(); e.stopPropagation(); return; }
  // instantâneos: anima, mas a ação acontece na hora
  if (el.matches(INSTANT) || el.closest(INSTANT)) { animate(el); return; }
  e.preventDefault(); e.stopPropagation();
  animate(el);
  setTimeout(() => {
    if (!el.isConnected) return;
    replaying = true;
    try { (t && el.contains(t) ? t : el).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); }
    finally { replaying = false; }
  }, PRESS_MS);
}

export function installPressEffect() {
  if (typeof window === "undefined") return;
  // robô de teste automático: ação imediata
  if (navigator.webdriver) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  window.addEventListener("click", onClick, true);
}
