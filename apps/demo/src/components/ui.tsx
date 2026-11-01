/** Design system Galato — componentes base. */
import { useEffect, useRef, type ReactNode } from "react";
import { registerLayer } from "./back";
import { createPortal } from "react-dom";
import { Plus, Minus, Trash2, X, ChevronLeft, ChevronRight, Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import { formatBRL, formatPct, type Tone } from "@galato/domain";
import { setOnline, useStore } from "../data/store";

export const brl = (c: number) => formatBRL(c);
export const brl0 = (c: number) => formatBRL(c, true);
export const pct = (v: number, d = 0) => formatPct(v, d);

/** Leva até a seção e destaca com um brilho, para o toque sempre ter resposta visível. */
export const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.remove("flash");
  void el.offsetWidth; // reinicia a animação
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 1600);
};

export function Card({ children, title, icon, link, onLink, onClick, className = "", sub, id }: {
  children?: ReactNode; title?: ReactNode; icon?: ReactNode; link?: string; onLink?: () => void;
  onClick?: () => void; className?: string; sub?: string; id?: string;
}) {
  return (
    <div id={id} className={`card ${onClick ? "click" : ""} ${className}`} onClick={onClick}>
      {title && (
        <div className="card-title">
          {icon && <span className="ic">{icon}</span>}
          <span>{title} {sub && <span className="card-sub">{sub}</span>}</span>
          {link && (
            <button className="link" onClick={(e) => { e.stopPropagation(); onLink?.(); }}>
              {link} <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function Kpi({ icon, label, value, foot, tone = "red", onClick, children }: {
  icon?: ReactNode; label: string; value: ReactNode; foot?: ReactNode; tone?: "red" | "gold" | "success" | "info";
  onClick?: () => void; children?: ReactNode;
}) {
  return (
    <Card onClick={onClick} className="kpi">
      <div className="kpi-head">
        {icon && <span className={`kpi-ic ${tone === "red" ? "" : tone}`}>{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="kpi-value num">{value}</div>
      {children}
      {foot && <div className="kpi-foot">{foot}</div>}
    </Card>
  );
}

export function Progress({ value, color, thin }: { value: number; color?: "red" | "green"; thin?: boolean }) {
  return (
    <div className={`progress ${color ?? ""} ${thin ? "thin" : ""}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 120, stroke = 12, label, sub }: { value: number; size?: number; stroke?: number; label?: ReactNode; sub?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const id = `rg${size}${stroke}`;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--ring-a, #FFD35C)" }} />
            <stop offset="100%" style={{ stopColor: "var(--ring-b, #F5A800)" }} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div className="ring-label"><b className="num">{label ?? pct(value)}</b>{sub && <span>{sub}</span>}</div>
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

export function Curve({ c }: { c: string }) {
  return <span className={`curve curve-${c}`}>{c}</span>;
}

export function Chip({ on, children, onClick }: { on?: boolean; children: ReactNode; onClick?: () => void }) {
  return <button className={`chip ${on ? "on" : ""}`} onClick={onClick}>{children}</button>;
}

let openSheets = 0;
/** Fecha pela tecla/gesto "voltar" do aparelho. */
function useBackClose(onClose: () => void) {
  const ref = useRef(onClose); ref.current = onClose;
  useEffect(() => registerLayer(() => ref.current()), []);
}

export function Sheet({ title, onClose, children, wide, icon }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; icon?: ReactNode }) {
  useBackClose(onClose);
  useEffect(() => {
    // só a folha de cima fecha com Esc; trava a rolagem enquanto houver alguma aberta
    const depth = ++openSheets;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && depth === openSheets) onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); if (--openSheets === 0) document.body.style.overflow = ""; };
  }, [onClose]);
  // sempre sobre a tela inteira (mesmo quando aberta de dentro de outra janela)
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className={`sheet ${wide ? "wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head">
          <button className="icon-btn sheet-back" onClick={onClose} aria-label="Voltar" title="Voltar"><ChevronLeft size={20} /></button>
          {icon && <span className="red flex">{icon}</span>}
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmModal({ title, text, confirmLabel, onConfirm, onClose, danger, children, disabled }: {
  title: string; text: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void;
  danger?: boolean; children?: ReactNode; disabled?: boolean;
}) {
  useBackClose(onClose);
  return createPortal(
    <div className="overlay center" onClick={onClose}>
      <div className="sheet modal" onClick={(e) => e.stopPropagation()} style={{ paddingTop: 20 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h2>
        <div className="t2 small" style={{ marginBottom: 16 }}>{text}</div>
        {children}
        <div className="grid g2" style={{ marginTop: 8, marginBottom: 0 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={disabled} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function SyncIndicator() {
  const s = useStore();
  if (!s.online)
    return (
      <button className="sync offline" onClick={() => setOnline(true)} title="Simulação: clique para reconectar">
        <CloudOff size={14} /> Offline{s.pendingSync ? ` · ${s.pendingSync} pendente(s)` : ""}
      </button>
    );
  if (s.sync === "syncing") return <span className="sync syncing"><RefreshCw size={14} className="spin" /> Sincronizando</span>;
  return (
    <button className="sync synced" onClick={() => setOnline(false)} title="Simulação: clique para ficar offline">
      <Cloud size={14} /> Sincronizado
    </button>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  const icon = { success: <CheckCircle2 size={18} className="green" />, warning: <AlertTriangle size={18} className="gold" />, danger: <XCircle size={18} className="red" />, info: <Info size={18} /> };
  return (
    <div className="toasts">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{icon[t.tone]}<span>{t.text}</span></div>)}
    </div>
  );
}

export function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="empty"><div className="ic">{icon}</div>{text}</div>;
}

export function RankingList({ rows, format, onRow }: {
  rows: { id: string; name: string; position: number | null; attainmentPct: number | null; achieved: number; target: number }[];
  format: (r: { achieved: number; target: number }) => ReactNode; onRow?: (id: string) => void;
}) {
  return (
    <div className="list">
      {rows.map((r) => (
        <div key={r.id} className={`row ${onRow ? "click" : ""}`} onClick={() => onRow?.(r.id)}>
          <span className={`pos p${r.position ?? 0}`}>{r.position ? `${r.position}º` : "–"}</span>
          <div className="grow">
            <div className="title">{r.name}</div>
            <div className="progress-row" style={{ marginTop: 5 }}>
              <Progress thin value={r.attainmentPct ?? 0} color={(r.attainmentPct ?? 0) >= 100 ? "green" : undefined} />
            </div>
          </div>
          <div className="end">
            <div className="bold num">{r.attainmentPct === null ? "s/ meta" : pct(r.attainmentPct)}</div>
            <div className="sub num xs muted">{format(r)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="section-title"><span>{children}</span>{action}</div>;
}

/**
 * Seletor de quantidade padrão do app: − valor +.
 * Com valor > 0 fica colorido; o número "pula" a cada toque.
 * Com `min` = 0, o − no 1 vira lixeira (remove).
 */
export function Stepper({ value, onChange, min = 0, max, size = "md", label = "quantidade" }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; size?: "sm" | "md"; label?: string;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(max === undefined ? value + 1 : Math.min(max, value + 1));
  return (
    <div className={`stepper ${size} ${value > 0 ? "active" : ""}`} onClick={(e) => e.stopPropagation()} role="group" aria-label={label}>
      <button type="button" className="step-btn minus" aria-label="Diminuir" disabled={value <= min} onClick={dec}>
        {value === 1 && min === 0 ? <Trash2 size={size === "sm" ? 13 : 15} /> : <Minus size={size === "sm" ? 14 : 16} />}
      </button>
      <b key={value} className="num step-val">{value}</b>
      <button type="button" className="step-btn plus" aria-label="Adicionar" disabled={max !== undefined && value >= max} onClick={inc}>
        <Plus size={size === "sm" ? 14 : 16} />
      </button>
    </div>
  );
}
