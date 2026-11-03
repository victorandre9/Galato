/** AppShell: sidebar no desktop, bottom navigation no mobile. */
import { UserPhoto } from "./userphoto";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { registerTabs, armBack } from "./back";
import { Palette, Bell, ChevronLeft, ChevronRight, X, Menu, Moon, Sun, CalendarDays, LogOut, Maximize, RotateCcw, Database, BellOff } from "lucide-react";
import { setState, setTheme, useStore, toast, toggleDark, THEME_LABEL, USER_THEMES, getState, setPresent, type Theme } from "../data/store";
import { TODAY, TODAY_ROUTE, PARAMS, CUSTOMERS, ORDERS, PAYMENT_REQUESTS, customerById, type Customer, type Order, type PaymentRequest, type NotifLink } from "../data/mock";
import { daysBetween } from "@galato/domain";
import { CustomerSheet } from "./business";
import { OrderOpen } from "./order-flow";
import { ProofView, InfoSheet } from "./details";
import { ClientList } from "../screens/Reports";
import { LinkView } from "./links";
import { dayLabel } from "../data/selectors";
import { notificationsFor, viewerId } from "../data/notify";
import { persistChanges, resetDemo } from "../data/sync";
import { SyncIndicator, Sheet, Badge, ConfirmModal, Empty, scrollPageTop } from "./ui";


export function toggleFullscreen() {
  const on = !getState().present;
  setPresent(on);
  // computador/Android: também usa a tela cheia do navegador (sem aviso se não der; no iPhone fica só o modo apresentação)
  try {
    if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  } catch { /* ok */ }
}

export interface Tab { id: string; label: string; icon: ReactNode; count?: number }

export function Shell({ tabs, tab, onTab, roleLabel, userName, narrow, children }: {
  tabs: Tab[]; tab: string; onTab: (t: string) => void; roleLabel: string; userName: string; narrow?: boolean; children: ReactNode;
}) {
  const s = useStore();
  const [notifOpen, setNotifOpen] = useState(false);
  // apresentação: menu lateral escondido; aparece ao encostar o mouse na borda esquerda e recua ao sair dele
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    if (!s.present) { setPeek(false); return; }
    const onMove = (e: MouseEvent) => {
      if (e.clientX <= 14) { setPeek(true); return; }
      const w = (document.querySelector(".sidebar") as HTMLElement | null)?.getBoundingClientRect().width ?? 280;
      if (e.clientX > w + 24) setPeek(false);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [s.present]);
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
  const goBack = () => { const prev = hist.current.pop(); if (prev !== undefined) { goingBack.current = true; onTabRef.current(prev); scrollPageTop(); } };
  useEffect(() => { registerTabs({ has: () => hist.current.length > 0, back: goBack }); return () => registerTabs(null); }, []);
  // troca de aba pedida por notificação/alerta
  // barra de baixo estilo Instagram: descendo a tela ela "engorda" e volta; subindo fica menor
  const [navSize, setNavSize] = useState("");
  useEffect(() => {
    const el = document.getElementById("root"); if (!el) return;
    let last = el.scrollTop, timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const y = el.scrollTop, d = y - last; last = y;
      if (Math.abs(d) < 2) return;
      setNavSize(d > 0 ? "grow" : "shrink");
      clearTimeout(timer); timer = setTimeout(() => setNavSize(""), 380);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); clearTimeout(timer); };
  }, []);
  const seenNav = useRef(s.navN);
  useEffect(() => {
    if (s.navN === seenNav.current) return;
    seenNav.current = s.navN;
    if (s.navTab && tabs.some((t) => t.id === s.navTab)) { onTabRef.current(s.navTab); scrollPageTop(); }
  }, [s.navN]);
  const mine = s.role ? notificationsFor(s.role) : [];
  const me = s.role ? viewerId(s.role) : "";
  const unread = mine.filter((n) => !n.readBy.includes(me)).length;
  return (
    <>
      {!s.online && <div className="offline-bar">Sem conexão · você continua trabalhando, tudo é salvo no aparelho e sincroniza sozinho</div>}
      <div className={`shell ${narrow ? "narrow" : ""}`}>
        <aside className={`sidebar ${peek ? "peek" : ""}`} onMouseLeave={() => setPeek(false)} onClick={(e) => { if (s.present && (e.target as HTMLElement).closest(".side-item")) setPeek(false); }}>
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
            <div className="flex" style={{ gap: 10, alignItems: "center" }}>
              <UserPhoto name={userName} size={40} editable />
              <div style={{ minWidth: 0 }}><div className="semi small">{userName}</div><div className="xs muted">{roleLabel}</div></div>
            </div>
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
            <div className="header-left">
              {hist.current.length > 0 && <button className="icon-btn back-btn" onClick={goBack} aria-label="Voltar" title="Voltar"><ChevronLeft size={21} /></button>}
              <button className="icon-btn menu-btn" onClick={() => setState({ role: null })} aria-label="Trocar perfil"><Menu size={20} /></button>
            </div>
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
      {s.present && <PresentBar tabs={tabs.filter((t) => t.id !== "more")} tab={tab} onTab={onTab} />}
      <nav className={`bottom-nav ig ${navSize}`}>
        <NavLens />
        {tabs.slice(0, 5).map((t) => (
          <button key={t.id} aria-label={t.label} title={t.label} className={`bn-item ${tab === t.id ? "active" : ""}`} onClick={() => { go(t.id); scrollPageTop(); }}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

export function Greeting({ title, sub }: { icon?: ReactNode; title: string; sub: string; name?: string }) {
  return (
    <div className="greeting">
      <UserPhoto name={title.replace(/^Olá,\s*/, "").replace(/!$/, "")} size={48} editable />
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
        <UserPhoto name={name} size={72} editable />
        <div><div className="bold">{name}</div><div className="small muted">{role}</div><div className="xs muted mt">Toque na foto para trocar</div></div>
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
  const [link, setLink] = useState<NotifLink | null>(null);
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
        <div key={n.id} className="row click" onClick={() => { if (!n.readBy.includes(me)) { n.readBy.push(me); persistChanges(); } if (n.link) setLink(n.link); else setTarget(targetOf(n)); }} style={{ alignItems: "flex-start", opacity: n.readBy.includes(me) ? 0.6 : 1 }}>
          <span className="dotc" style={{ width: 9, height: 9, borderRadius: 9, marginTop: 6, flexShrink: 0, background: n.readBy.includes(me) ? "transparent" : n.priority === "high" ? "var(--danger)" : "var(--gold)" }} />
          <div className="grow">
            <div className="flex between"><span className="semi">{n.title}</span><span className="xs muted">{new Date(n.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div className="small t2" style={{ whiteSpace: "normal" }}>{n.text}</div>
            <div style={{ marginTop: 4 }}><Badge tone={tone[n.kind]}>{n.kind}</Badge></div>
          </div>
        </div>
      ))}
      {!list.length && <Empty icon={<BellOff />} text="Nenhuma notificação." />}
      {link && <LinkView link={link} onClose={() => setLink(null)} onNavigate={() => { setLink(null); close(); }} />}
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
      {USER_THEMES.map((t) => (
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
  // Clássico (🎨) e o escuro vermelho ficam guardados no código, fora das opções do usuário
  const all: { t: Theme; icon: ReactNode; label: string }[] = [
    { t: "light", icon: <Sun size={16} />, label: "Claro" },
    { t: "classic", icon: <Palette size={16} />, label: "Clássico (claro anterior)" },
    { t: "dark", icon: <Moon size={16} />, label: "Escuro" },
  ];
  const opts = all.filter((o) => USER_THEMES.includes(o.t));
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Aparência">
      {opts.map((o) => (
        <button key={o.t} role="radio" aria-checked={s.theme === o.t} aria-label={o.label} title={o.label}
          className={s.theme === o.t ? "on" : ""} onClick={() => setTheme(o.t)}>{o.icon}</button>
      ))}
    </div>
  );
}

/** Modo apresentação: barrinha discreta para passar de tela (como slides) e sair. */
function PresentBar({ tabs, tab, onTab }: { tabs: Tab[]; tab: string; onTab: (t: string) => void }) {
  const i = Math.max(0, tabs.findIndex((t) => t.id === tab));
  const go = (d: number) => { const n = tabs[(i + d + tabs.length) % tabs.length]; if (n) { onTab(n.id); scrollPageTop(); } };
  const goRef = useRef(go); goRef.current = go;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector(".sheet")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") goRef.current(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") goRef.current(-1);
      else if (e.key === "Escape") setPresent(false);
    };
    // arrastar para o lado troca de tela (celular)
    let x0 = 0, y0 = 0;
    const ts = (e: TouchEvent) => { x0 = e.touches[0]!.clientX; y0 = e.touches[0]!.clientY; };
    const te = (e: TouchEvent) => {
      if (document.querySelector(".sheet")) return;
      const dx = e.changedTouches[0]!.clientX - x0, dy = e.changedTouches[0]!.clientY - y0;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) goRef.current(dx < 0 ? 1 : -1);
    };
    window.addEventListener("keydown", key); window.addEventListener("touchstart", ts, { passive: true }); window.addEventListener("touchend", te, { passive: true });
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("touchstart", ts); window.removeEventListener("touchend", te); };
  }, []);
  return (
    <div className="present-bar" role="toolbar" aria-label="Apresentação">
      <button className="icon-btn" onClick={() => go(-1)} aria-label="Tela anterior"><ChevronLeft size={18} /></button>
      <span className="present-label">{tabs[i]?.label} <small>{i + 1}/{tabs.length}</small></span>
      <button className="icon-btn" onClick={() => go(1)} aria-label="Próxima tela"><ChevronRight size={18} /></button>
      <button className="icon-btn" onClick={() => toggleFullscreen()} aria-label="Sair da apresentação" title="Sair da apresentação"><X size={18} /></button>
    </div>
  );
}

/** Botão de sair da apresentação na tela de entrada (sem barra de telas). */
export function PresentExit() {
  const s = useStore();
  if (!s.present || s.role) return null;
  return <div className="present-bar solo"><button className="icon-btn" onClick={() => toggleFullscreen()} aria-label="Sair da apresentação"><X size={18} /></button></div>;
}

/**
 * Lente da barra de baixo (efeito Instagram): mostra o que está atrás AMPLIADO, como uma lupa.
 * Funciona em qualquer navegador (inclusive iPhone): uma cópia da tela, alinhada e ampliada, acompanha a rolagem.
 */
const LENS_ZOOM = 1.22;
function NavLens() {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.getElementById("root");
    const main = document.querySelector(".shell .main") as HTMLElement | null;
    const b = box.current, i = inner.current;
    if (!root || !main || !b || !i) return;
    // no computador a barra de baixo não aparece: não monta a lente
    if (window.matchMedia?.("(min-width: 1024px)").matches) return;
    // navegador de teste automático: sem a cópia (não confunde os testes)
    if (navigator.webdriver) return;
    let raf = 0, cloneT: ReturnType<typeof setTimeout> | undefined;
    const place = () => {
      raf = 0;
      const m = main.getBoundingClientRect(), n = b.getBoundingClientRect();
      const left = m.left - n.left, top = m.top - n.top;
      const ox = n.width / 2 - left, oy = n.height / 2 - top;
      i.style.width = `${m.width}px`;
      i.style.transform = `translate(${left}px, ${top}px)`;
      (i.firstElementChild as HTMLElement | null)?.style.setProperty("transform-origin", `${ox}px ${oy}px`);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };
    const clone = () => {
      const c = main.cloneNode(true) as HTMLElement;
      c.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      c.querySelectorAll("video, iframe").forEach((el) => el.remove());
      c.classList.remove("main"); c.classList.add("lens-copy");
      c.setAttribute("inert", ""); c.setAttribute("aria-hidden", "true");
      c.style.transform = `scale(${LENS_ZOOM})`;
      i.replaceChildren(c);
      place();
    };
    clone();
    const mo = new MutationObserver(() => { clearTimeout(cloneT); cloneT = setTimeout(clone, 40); });
    mo.observe(main, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style"] });
    root.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule); ro.observe(b);
    return () => { mo.disconnect(); ro.disconnect(); root.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); cancelAnimationFrame(raf); clearTimeout(cloneT); };
  }, []);
  return <div className="nav-lens" ref={box} aria-hidden="true"><div className="nav-lens-inner" ref={inner} /></div>;
}
