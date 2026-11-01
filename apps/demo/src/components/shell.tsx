/** AppShell: sidebar no desktop, bottom navigation no mobile. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { registerTabs, armBack } from "./back";
import { Palette, Bell, ChevronLeft, Menu, Moon, Sun, CalendarDays, LogOut, Maximize, RotateCcw, Database, BellOff } from "lucide-react";
import { setState, setTheme, useStore, toast, toggleDark, THEME_LABEL, type Theme } from "../data/store";
import { TODAY, TODAY_ROUTE, PARAMS, CUSTOMERS, ORDERS, PAYMENT_REQUESTS, customerById, type Customer, type Order, type PaymentRequest } from "../data/mock";
import { daysBetween } from "@galato/domain";
import { CustomerSheet } from "./business";
import { OrderOpen } from "./order-flow";
import { ProofView, InfoSheet } from "./details";
import { ClientList } from "../screens/Reports";
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
  // histórico de abas: o "voltar" (botão da tela ou do aparelho) retorna para a anterior
  const hist = useRef<string[]>([]);
  const [, bump] = useState(0);
  const onTabRef = useRef(onTab); onTabRef.current = onTab;
  const lastTab = useRef(tab);
  const goingBack = useRef(false);
  // toda troca de aba (menu, atalhos, cards) entra no histórico
  useEffect(() => {
    if (tab === lastTab.current) return;
    if (goingBack.current) goingBack.current = false;
    else { hist.current.push(lastTab.current); if (hist.current.length > 30) hist.current.shift(); armBack(); }
    lastTab.current = tab; bump((n) => n + 1);
  }, [tab]);
  const go = (t: string) => onTab(t);
  const goBack = () => { const prev = hist.current.pop(); if (prev !== undefined) { goingBack.current = true; onTabRef.current(prev); window.scrollTo({ top: 0 }); } };
  useEffect(() => { registerTabs({ has: () => hist.current.length > 0, back: goBack }); return () => registerTabs(null); }, []);
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
            <button key={t.id} className={`side-item ${tab === t.id ? "active" : ""}`} onClick={() => go(t.id)}>
              {t.icon} {t.label}
              {!!t.count && <span className="count badge tone-danger">{t.count}</span>}
            </button>
          ))}
          <div className="spacer" />
          <div className="card" style={{ padding: 12 }}>
            <div className="semi small">{userName}</div>
            <div className="xs muted">{roleLabel}</div>
            <div className="flex mt" style={{ gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleDark(s.theme)}>
                {s.theme !== "dark" ? <Moon size={15} /> : <Sun size={15} />} {s.theme !== "dark" ? "Escuro" : "Claro"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setState({ role: null })}><LogOut size={15} /> Trocar</button>
            </div>
          </div>
        </aside>
        <main className="main">
          <header className="app-header">
            {hist.current.length > 0 && <button className="icon-btn back-btn" onClick={goBack} aria-label="Voltar" title="Voltar"><ChevronLeft size={21} /></button>}
            <button className="icon-btn menu-btn" onClick={() => setState({ role: null })} aria-label="Trocar perfil"><Menu size={20} /></button>
            <img className="logo" src="./galato-logo.png" alt="Galato" />
            <div className="only-desktop flex">
              <span className="pill"><CalendarDays size={14} /> Hoje, {dayLabel(TODAY)}</span>
            </div>
            <div className="header-right">
              <span className="only-desktop"><SyncIndicator /></span>
              <button className="icon-btn only-desktop" onClick={() => toggleDark(s.theme)} aria-label="Tema">
                {s.theme !== "dark" ? <Moon size={18} /> : <Sun size={18} />}
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
          <button key={t.id} className={`bn-item ${tab === t.id ? "active" : ""}`} onClick={() => { go(t.id); window.scrollTo({ top: 0 }); }}>
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
        <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <span>Aparência</span>
          <ThemePicker />
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

type NotifTarget = { kind: "order"; o: Order } | { kind: "proof"; p: PaymentRequest } | { kind: "customer"; c: Customer } | { kind: "clients"; title: string; list: Customer[] } | { kind: "text"; title: string; text: string };

/** Descobre para onde a notificação leva (pedido, comprovante, cliente ou lista de clientes). */
function targetOf(n: { title: string; text: string; to: string[] }): NotifTarget {
  const t = `${n.title} ${n.text}`;
  const num = t.match(/\b(PV|ORC)-\d+/)?.[0];
  const o = num ? ORDERS.find((x) => x.number === num) : undefined;
  if (o) return { kind: "order", o };
  const sq = t.match(/\bSQ-\d+/)?.[0];
  const p = sq ? PAYMENT_REQUESTS.find((x) => x.number === sq) : undefined;
  if (p) return { kind: "proof", p };
  if (/sem compra|sem comprar/i.test(t)) {
    const sid = n.to.find((x) => x.startsWith("seller:"))?.slice(7);
    const route = TODAY_ROUTE?.code;
    const days = Number(t.match(/(\d+)\s*dias/)?.[1] ?? PARAMS.inactivity.idleAssetThresholdDays);
    const list = CUSTOMERS.filter((c) => (!sid || c.sellerId === sid) && (!/rota/i.test(t) || !route || c.routeCode === route)
      && (!c.lastPurchaseDate || daysBetween(c.lastPurchaseDate, TODAY) > days));
    return { kind: "clients", title: n.title, list };
  }
  const c = [...CUSTOMERS].sort((a, b) => b.tradeName.length - a.tradeName.length).find((x) => t.includes(x.tradeName));
  if (c) return { kind: "customer", c };
  return { kind: "text", title: n.title, text: n.text };
}

function NotificationCenter({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [target, setTarget] = useState<NotifTarget | null>(null);
  const [cust, setCust] = useState<Customer | null>(null);
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
        <div key={n.id} className="row click" onClick={() => { if (!n.readBy.includes(me)) { n.readBy.push(me); persistChanges(); } setTarget(targetOf(n)); }} style={{ alignItems: "flex-start", opacity: n.readBy.includes(me) ? 0.6 : 1 }}>
          <span className="dotc" style={{ width: 9, height: 9, borderRadius: 9, marginTop: 6, flexShrink: 0, background: n.readBy.includes(me) ? "transparent" : n.priority === "high" ? "var(--danger)" : "var(--gold)" }} />
          <div className="grow">
            <div className="flex between"><span className="semi">{n.title}</span><span className="xs muted">{new Date(n.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div className="small t2" style={{ whiteSpace: "normal" }}>{n.text}</div>
            <div style={{ marginTop: 4 }}><Badge tone={tone[n.kind]}>{n.kind}</Badge></div>
          </div>
        </div>
      ))}
      {!list.length && <Empty icon={<BellOff />} text="Nenhuma notificação." />}
      {target?.kind === "order" && <OrderOpen order={target.o} canEdit={s.role === "seller"} onClose={() => setTarget(null)} />}
      {target?.kind === "proof" && <ProofView p={target.p} onClose={() => setTarget(null)} />}
      {target?.kind === "customer" && <CustomerSheet c={target.c} viewerSellerId={s.role === "seller" ? target.c.sellerId : undefined} onClose={() => setTarget(null)} />}
      {target?.kind === "text" && <InfoSheet title={target.title} rows={[["Mensagem", target.text]]} onClose={() => setTarget(null)} />}
      {target?.kind === "clients" && (
        <Sheet title={`${target.title} (${target.list.length})`} onClose={() => setTarget(null)} wide>
          <ClientList items={target.list.map((c) => ({ c, days: c.lastPurchaseDate ? daysBetween(c.lastPurchaseDate, TODAY) : null }))} onOpen={(id) => setCust(customerById.get(id) ?? null)} />
        </Sheet>
      )}
      {cust && <CustomerSheet c={cust} viewerSellerId={s.role === "seller" ? cust.sellerId : undefined} onClose={() => setCust(null)} />}
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
        {s.dbMode === "shared" ? "Banco de dados ligado: o que você faz aqui aparece nos outros perfis e aparelhos em poucos segundos."
          : s.dbMode === "connecting" ? "Conectando ao banco compartilhado…"
          : s.dbMode === "readonly" ? <><b className="gold">Somente leitura.</b> Você vê o banco compartilhado, mas o que fizer fica salvo só neste aparelho. Para gravar para todos, o dono precisa te convidar por e-mail como Editor (com o link público desligado).</>
          : "Os dados ficam salvos neste aparelho: o que você faz aparece em todos os perfis aqui e continua lá mesmo se fechar ou recarregar."}
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

/** Escolha de aparência: Empresarial (novo), Clássico (claro anterior) ou Escuro. */
export function ThemePicker() {
  const s = useStore();
  return (
    <div className="chips" role="radiogroup" aria-label="Aparência">
      {(["light", "classic", "dark"] as Theme[]).map((t) => (
        <button key={t} role="radio" aria-checked={s.theme === t} className={`chip ${s.theme === t ? "on" : ""}`} onClick={() => setTheme(t)}>
          {t === "dark" ? <Moon size={13} /> : <Sun size={13} />} {THEME_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

/** Três botões pequenos de aparência para o topo: Empresarial · Clássico · Escuro. */
export function ThemeSwitch() {
  const s = useStore();
  const opts: { t: Theme; icon: ReactNode; label: string }[] = [
    { t: "light", icon: <Sun size={16} />, label: "Empresarial (claro)" },
    { t: "classic", icon: <Palette size={16} />, label: "Clássico (claro anterior)" },
    { t: "dark", icon: <Moon size={16} />, label: "Escuro" },
  ];
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Aparência">
      {opts.map((o) => (
        <button key={o.t} role="radio" aria-checked={s.theme === o.t} aria-label={o.label} title={o.label}
          className={s.theme === o.t ? "on" : ""} onClick={() => setTheme(o.t)}>{o.icon}</button>
      ))}
    </div>
  );
}
