/**
 * Efeito de toque: o botão/card afunda (0,2 s), sobe (0,2 s) e só então a ação acontece
 * (a nova tela entra com animação de 0,2 s). Botões de câmera/galeria e campos ficam instantâneos.
 */
const PRESSABLE = ".btn, .icon-btn, .chip, .action-tile, .card.click, .order-row.click, .ent-role, .ent-tile, .bn-item, .side-item, .row.click, .kpi.click, .bucket, .route-pick, .occ-type, .theme-switch button, .bullet-row, .linkbtn, tr.click";
const NO_DELAY = "[data-instant], .step-btn, input, select, textarea, label, a[href], [type=submit]";
const DOWN = 100, UP = 100;
let replaying = false;

function onClick(e: MouseEvent) {
  if (replaying || e.defaultPrevented || e.button !== 0) return;
  const t = e.target as HTMLElement | null;
  const el = t?.closest?.(PRESSABLE) as HTMLElement | null;
  if (!el || el.closest(NO_DELAY) || t?.closest(NO_DELAY) || (el as HTMLButtonElement).disabled) return;
  if (el.dataset.pressing) { e.preventDefault(); e.stopPropagation(); return; }
  e.preventDefault(); e.stopPropagation();
  el.dataset.pressing = "1";
  // aro de fora parado: copia o aro para uma moldura fixa; o botão de dentro encolhe ~20% e volta
  el.style.setProperty("--rim", getComputedStyle(el).boxShadow);
  el.classList.add("press-down");
  setTimeout(() => {
    el.classList.remove("press-down"); el.classList.add("press-up");
    setTimeout(() => {
      el.classList.remove("press-up"); delete el.dataset.pressing;
      el.style.removeProperty("--rim");
      if (!el.isConnected) return;
      replaying = true;
      try { (t && el.contains(t) ? t : el).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); }
      finally { replaying = false; }
    }, UP);
  }, DOWN);
}

export function installPressEffect() {
  if (typeof window === "undefined") return;
  // robô de teste automático: ação imediata (o efeito visual continua no :active)
  if (navigator.webdriver) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  window.addEventListener("click", onClick, true);
}
