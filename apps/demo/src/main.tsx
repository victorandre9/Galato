import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./future.css";
import App from "./App";
import { CHECKINS } from "./data/mock";
import { deleteVideo, daysUntilPurge } from "./components/video";
import { persistChanges } from "./data/sync";
import { setState, getState } from "./data/store";

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
setTimeout(purgeOldVideos, 3000);
setInterval(purgeOldVideos, 6 * 3_600_000);
