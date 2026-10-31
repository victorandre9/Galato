/** AppShell: sidebar no desktop, bottom navigation no mobile. */
import { useState, type ReactNode } from "react";
import { Bell, Menu, Moon, Sun, CalendarDays, LogOut, Maximize, RotateCcw, Database, BellOff } from "lucide-react";
import { setState, setTheme, useStore, toast } from "../data/store";
import { TODAY } from "../data/mock";
import { dayLabel } from "../data/selectors";
import { notificationsFor, viewerId } from "../data/notify";
import { persistChanges, resetDemo } from "../data/sync";
import { SyncIndicator, Sheet, Badge, ConfirmModal, Empty } from "./ui";

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isMac = () => /Mac/.test(navigator.platform) && !isIOS();
const IOS_TIP = "No iPhone/iPad a Apple não permite tela cheia em sites. No Safari, toque em “aA” ao lado do endereço → “Ocultar Barra de Ferramentas”. Virar o celular na horizontal também ajuda.";
const desktopTip = () => (isMac() ? "Para tela cheia use Ctrl + Cmd + F." : "Para tela cheia aperte F11.");

export function toggleFullscreen() {
  if (isIOS()) { toast(IOS_TIP, "info", 9000); return; }
  try {
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    const req = document.documentElement.requestFullscreen?.();
    if (!req) { toast(desktopTip(), "info", 6000); return; }
    req.catch(() => toast(desktopTip(), "info", 6000));
  } catch { toast(desktopTip(), "info", 6000); }
}

export interface Tab { id: string; label: string; icon: ReactNode; count?: number }

export function Shell({ tabs, tab, onTab, roleLabel, userName, narrow, children }: {
  tabs: Tab[]; tab: string; onTab: (t: string) => void; roleLabel: string; userName: string; narrow?: boolean; children: ReactNode;
}) {
  const s = useStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const mine = s.role ? notificationsFor(s.role) : [];
  const me = s.role ? viewerId(s.role) : "";
  const unread = mine.filter((n) => !n.readBy.includes(me)).length;
  return (
    <>
      {!s.online && <div className="offline-bar">Sem conexão · você continua trabalhando, tudo é salvo no aparelho e sincroniza sozinho</div>}
      <div className={`shell ${narrow ? "narrow" : ""}`}>
        <aside className="sidebar">
          <div className="brand">
            <img src="./galato-logo.png" alt="Galato Sorvetes" />
            <div><b>Galato</b><span>Plataforma integrada</span></div>
          </div>
          {tabs.filter((t) => t.id !== "more").map((t) => (
            <button key={t.id} className={`side-item ${tab === t.id ? "active" : ""}`} onClick={() => onTab(t.id)}>
              {t.icon} {t.label}
              {!!t.count && <span className="count badge tone-danger">{t.count}</span>}
            </button>
          ))}
          <div className="spacer" />
          <div className="card" style={{ padding: 12 }}>
            <div className="semi small">{userName}</div>
            <div className="xs muted">{roleLabel}</div>
            <div className="flex mt" style={{ gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setTheme(s.theme === "light" ? "dark" : "light")}>
                {s.theme === "light" ? <Moon size={15} /> : <Sun size={15} />} {s.theme === "light" ? "Escuro" : "Claro"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setState({ role: null })}><LogOut size={15} /> Trocar</button>
            </div>
          </div>
        </aside>
        <main className="main">
          <header className="app-header">
            <button className="icon-btn menu-btn" onClick={() => setState({ role: null })} aria-label="Trocar perfil"><Menu size={20} /></button>
            <img className="logo" src="./galato-logo.png" alt="Galato" />
            <div className="only-desktop flex">
              <span className="pill"><CalendarDays size={14} /> Hoje, {dayLabel(TODAY)}</span>
            </div>
            <div className="header-right">
              <span className="only-desktop"><SyncIndicator /></span>
              <button className="icon-btn only-desktop" onClick={() => setTheme(s.theme === "light" ? "dark" : "light")} aria-label="Tema">
                {s.theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <button className="icon-btn only-desktop" onClick={toggleFullscreen} aria-label="Tela cheia" title="Tela cheia"><Maximize size={18} /></button>
              <button className="icon-btn" aria-label="Notificações" onClick={() => setNotifOpen(true)}>
                <Bell size={19} />{unread > 0 && <span className="notif-count">{unread > 9 ? "9+" : unread}</span>}
              </button>
            </div>
          </header>
          {children}
        </main>
        {notifOpen && <NotificationCenter onClose={() => setNotifOpen(false)} />}
      </div>
      <nav className="bottom-nav">
        {tabs.slice(0, 5).map((t) => (
          <button key={t.id} className={`bn-item ${tab === t.id ? "active" : ""}`} onClick={() => { onTab(t.id); window.scrollTo({ top: 0 }); }}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

export function Greeting({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="greeting">
      <span className="avatar">{icon}</span>
      <div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      <span className="date-pill only-mobile"><SyncIndicator /></span>
    </div>
  );
}

export function ProfilePanel({ name, role, extra }: { name: string; role: string; extra?: ReactNode }) {
  const s = useStore();
  return (
    <div className="stack">
      <div className="card flex" style={{ gap: 14 }}>
        <span className="avatar" style={{ width: 56, height: 56, borderRadius: 18, display: "grid", placeItems: "center", background: "var(--brand-soft)", color: "var(--brand)", fontWeight: 700, fontSize: 20 }}>
          {name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
        </span>
        <div><div className="bold">{name}</div><div className="small muted">{role}</div></div>
      </div>
      {extra}
      <div className="card">
        <div className="card-title">Preferências</div>
        <div className="flex between row">
          <span>Tema</span>
          <div className="chips">
            <button className={`chip ${s.theme === "light" ? "on" : ""}`} onClick={() => setTheme("light")}><Sun size={13} /> Claro</button>
            <button className={`chip ${s.theme === "dark" ? "on" : ""}`} onClick={() => setTheme("dark")}><Moon size={13} /> Escuro</button>
          </div>
        </div>
        <div className="flex between row"><span>Conexão (simulação)</span><SyncIndicator /></div>
        <div className="row xs muted">Clique no indicador para simular perda de internet. Ações continuam funcionando e sincronizam sozinhas ao reconectar.</div>
      </div>
      <DemoDataPanel />
      <button className="btn btn-ghost btn-block" onClick={toggleFullscreen}><Maximize size={16} /> Tela cheia</button>
      <button className="btn btn-ghost btn-block" onClick={() => setState({ role: null })}><LogOut size={16} /> Trocar perfil de demonstração</button>
    </div>
  );
}

function NotificationCenter({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const list = s.role ? notificationsFor(s.role) : [];
  const me = s.role ? viewerId(s.role) : "";
  const close = () => {
    // marca como lidas ao fechar
    let changed = false;
    for (const n of list) if (!n.readBy.includes(me)) { n.readBy.push(me); changed = true; }
    if (changed) { persistChanges(); setState({ version: s.version + 1 }); }
    onClose();
  };
  const tone = { financeiro: "brand", comercial: "info", logistica: "warning", alerta: "danger", operacional: "neutral", sistema: "neutral" } as const;
  return (
    <Sheet title={`Notificações (${list.filter((n) => !n.readBy.includes(me)).length} novas)`} onClose={close} icon={<Bell size={18} />}>
      {list.map((n) => (
        <div key={n.id} className="row" style={{ alignItems: "flex-start", opacity: n.readBy.includes(me) ? 0.6 : 1 }}>
          <span className="dotc" style={{ width: 9, height: 9, borderRadius: 9, marginTop: 6, flexShrink: 0, background: n.readBy.includes(me) ? "transparent" : n.priority === "high" ? "var(--danger)" : "var(--gold)" }} />
          <div className="grow">
            <div className="flex between"><span className="semi">{n.title}</span><span className="xs muted">{new Date(n.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div className="small t2" style={{ whiteSpace: "normal" }}>{n.text}</div>
            <div style={{ marginTop: 4 }}><Badge tone={tone[n.kind]}>{n.kind}</Badge></div>
          </div>
        </div>
      ))}
      {!list.length && <Empty icon={<BellOff />} text="Nenhuma notificação." />}
    </Sheet>
  );
}

export function DemoDataPanel() {
  const s = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="card">
      <div className="card-title"><span className="ic"><Database size={17} /></span>Dados da demonstração</div>
      <div className="small t2 mb">
        {s.dbMode === "shared" ? "Banco compartilhado ativo: o que você faz aqui aparece nos outros perfis e aparelhos, em tempo real."
          : s.dbMode === "connecting" ? "Conectando ao banco compartilhado…"
          : s.dbMode === "readonly" ? <><b className="gold">Somente leitura.</b> Você vê o banco compartilhado, mas o que fizer fica salvo só neste aparelho. Para gravar para todos, o dono precisa te convidar por e-mail como Editor (com o link público desligado).</>
          : "Modo local: os dados ficam só neste aparelho (fora do link do Claude)."}
      </div>
      <button className="btn btn-ghost btn-block btn-sm" onClick={() => setConfirm(true)}><RotateCcw size={15} /> Restaurar dados de demonstração</button>
      {confirm && (
        <ConfirmModal title="Restaurar dados?" confirmLabel="Restaurar" danger onClose={() => setConfirm(false)}
          onConfirm={async () => { setConfirm(false); await resetDemo(); toast("Dados de demonstração restaurados", "success"); }}
          text={s.dbMode === "shared" ? "Apaga pedidos, comprovantes, entregas e demais alterações feitas no teste, para todos os aparelhos. Os dados fictícios originais voltam." : "Apaga as alterações feitas neste aparelho. Os dados fictícios originais voltam."} />
      )}
    </div>
  );
}
