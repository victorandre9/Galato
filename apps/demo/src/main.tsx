import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./future.css";
import "./enterprise.css";
import "./glass.css";
import "./glass-themes.css";
import "./nav-ig.css";
import "./cards-ig.css";
import "./dark-gray.css";
import "./lupa.css";
import { installPressEffect } from "./components/press";
import App from "./App";
import { CHECKINS } from "./data/mock";
import { deleteVideo, daysUntilPurge, retryPendingUploads } from "./components/video";
import { persistChanges } from "./data/sync";
import { setState, getState, setOnline } from "./data/store";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

// holofote: o card sob o dedo/mouse recebe a posição do cursor
window.addEventListener("pointermove", (e) => {
  const el = (e.target as HTMLElement | null)?.closest?.(".card") as HTMLElement | null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}, { passive: true });

// retenção: apaga o arquivo do vídeo 60 dias após o checkout; a visita nunca é apagada
async function purgeOldVideos() {
  const old = CHECKINS.filter((k) => k.video && !k.video.purgedAt && k.video.savedAt && daysUntilPurge(k.video.savedAt) <= 0);
  if (!old.length) return;
  for (const k of old) { await deleteVideo(k.video!.key); k.video!.purgedAt = new Date().toISOString(); }
  persistChanges();
  setState({ version: getState().version + 1 });
}
setTimeout(purgeOldVideos, 10_000);
setInterval(purgeOldVideos, 6 * 3_600_000);

// vídeos que não subiram por falta de internet: tenta de novo
setInterval(retryPendingUploads, 30_000);
window.addEventListener("online", () => { retryPendingUploads(); });

// iPhone: mantém a barra de baixo presa ao fundo da área visível (zoom, teclado, barra do Safari)
(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  const update = () => {
    const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    root.style.setProperty("--vv-bottom", `${Math.round(offset)}px`);
    // teclado aberto: só esconde a barra se houver um campo de texto em uso
    const a = document.activeElement as HTMLElement | null;
    const typing = !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable);
    root.classList.toggle("kb-open", typing && offset > 120);
  };
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("focusin", update);
  window.addEventListener("focusout", () => setTimeout(update, 50));
  // voltando do app minimizado: recalcula (o iPhone informa uma altura errada por um instante)
  const resume = () => { root.classList.remove("kb-open"); update(); setTimeout(update, 300); setTimeout(update, 900); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") resume(); });
  window.addEventListener("pageshow", resume);
  window.addEventListener("focus", resume);
  update();
})();

// Chrome/Android: liga a distorção "bolha" do vidro da barra de baixo (o Safari não suporta)
try { if (/Chrome|Chromium|Edg\//.test(navigator.userAgent) && !/iPhone|iPad|iPod/.test(navigator.userAgent)) document.documentElement.classList.add("can-refract"); } catch { /* ok */ }

installPressEffect();

// funciona sem internet: guarda o app no aparelho (instalado na tela inicial ou no navegador)
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
}

// app instalado no celular (iPhone principalmente) fica aberto em segundo plano com a versão antiga:
// ao voltar para o app (e a cada 5 min) confere se saiu versão nova e recarrega sozinho
{
  let first: string | null = null;
  const sig = async () => {
    try {
      const r = await fetch("./assets/app.js", { method: "HEAD", cache: "no-store" });
      return r.ok ? (r.headers.get("etag") ?? r.headers.get("last-modified") ?? r.headers.get("content-length")) : null;
    } catch { return null; }
  };
  const check = async () => {
    if (!navigator.onLine) return;
    const now = await sig();
    if (!now) return;
    if (first === null) { first = now; return; }
    if (now !== first) {
      try { const regs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((regs ?? []).map((r) => r.update())); } catch { /* ok */ }
      // trava contra recarregar em sequência (no máximo 1 vez por minuto)
      try { const last = Number(sessionStorage.getItem("galato-reload") ?? 0); if (Date.now() - last < 60_000) return; sessionStorage.setItem("galato-reload", String(Date.now())); } catch { /* ok */ }
      location.reload();
    }
  };
  check();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  window.addEventListener("focus", check);
  setInterval(check, 5 * 60_000);
}

// internet do aparelho caiu/voltou: o app avisa, guarda tudo no aparelho e sincroniza sozinho ao voltar
window.addEventListener("offline", () => setOnline(false));
window.addEventListener("online", () => { setOnline(true); setTimeout(retryPendingUploads, 1500); });
if (!navigator.onLine) setOnline(false);
