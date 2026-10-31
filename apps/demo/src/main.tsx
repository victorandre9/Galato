import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./future.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

// holofote: o card sob o dedo/mouse recebe a posição do cursor
window.addEventListener("pointermove", (e) => {
  const el = (e.target as HTMLElement | null)?.closest?.(".card") as HTMLElement | null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}, { passive: true });
