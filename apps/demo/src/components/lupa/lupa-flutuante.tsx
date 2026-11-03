/**
 * A lupa que acompanha a pessoa pelo aplicativo inteiro (copiada do app Verifica).
 *
 * Um toque abre a busca: digita o que lembra (cliente, CNPJ, bairro, pedido, NF, placa, patrimônio,
 * prospect, vendedor, tela…) e cai direto no lugar certo. Procura em todos os processos que o perfil
 * logado pode ver (data/busca-global.ts).
 *
 * Segurar solta a lupa do lugar: ela pode ir para qualquer canto e lembra onde ficou, por aparelho.
 * Com o mouse em cima, vira por um instante um robozinho (pecas-do-robo.tsx).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CornerDownLeft, Move, RotateCcw, Users, ClipboardList, Receipt, Filter, Truck, AlertTriangle, Snowflake, Package, Bell, LayoutGrid, FileText, UserRound } from "lucide-react";
import { useStore } from "../../data/store";
import { buscarTudo, type Achado, type Grupo } from "../../data/busca-global";
import type { NotifLink } from "../../data/mock";
import { LinkView } from "../links";
import { IconeLupa } from "./icone-lupa";
import { LupaRobo } from "./pecas-do-robo";

const SEGURAR_MS = 450;
const TOLERANCIA_PX = 10;
const TAMANHO = 52;
type Posicao = { x: number; y: number };

function chaveDaPosicao(): string {
  return `lupa:posicao:${window.matchMedia("(min-width: 1024px)").matches ? "pc" : "celular"}`;
}
function lerPosicao(): Posicao | null {
  try {
    const bruto = localStorage.getItem(chaveDaPosicao());
    if (!bruto) return null;
    const salvo = JSON.parse(bruto) as Posicao;
    return typeof salvo.x === "number" && typeof salvo.y === "number" ? salvo : null;
  } catch { return null; }
}
function gravarPosicao(posicao: Posicao | null) {
  try {
    if (posicao) localStorage.setItem(chaveDaPosicao(), JSON.stringify(posicao));
    else localStorage.removeItem(chaveDaPosicao());
  } catch { /* sem armazenamento: só não lembra do lugar */ }
}
function dentroDaJanela(x: number, y: number) {
  const margem = TAMANHO / 2 + 6;
  return { left: Math.min(Math.max(x, margem), window.innerWidth - margem), top: Math.min(Math.max(y, margem), window.innerHeight - margem) };
}

export function LupaFlutuante({ tabs, onTab }: { tabs: { id: string; label: string }[]; onTab: (t: string) => void }) {
  const [aberta, setAberta] = useState(false);
  const [posicao, setPosicao] = useState<{ left: number; top: number } | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [destino, setDestino] = useState<NotifLink | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const gesto = useRef({ inicioX: 0, inicioY: 0, timer: null as ReturnType<typeof setTimeout> | null, soltou: false, engolirClique: false });

  useEffect(() => {
    const aplicar = () => { const s = lerPosicao(); setPosicao(s ? dentroDaJanela(s.x * window.innerWidth, s.y * window.innerHeight) : null); };
    aplicar();
    window.addEventListener("resize", aplicar);
    return () => window.removeEventListener("resize", aplicar);
  }, []);

  /* Ctrl+K (ou ⌘K) e "/" abrem a busca no computador. */
  useEffect(() => {
    const naTecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo?.tagName ?? "");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setAberta(true); }
      else if (e.key === "/" && !digitando) { e.preventDefault(); setAberta(true); }
    };
    window.addEventListener("keydown", naTecla);
    return () => window.removeEventListener("keydown", naTecla);
  }, []);

  const cancelarTimer = () => { if (gesto.current.timer) clearTimeout(gesto.current.timer); gesto.current.timer = null; };
  const aoApertar = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const alvo = e.currentTarget, id = e.pointerId;
    Object.assign(gesto.current, { inicioX: e.clientX, inicioY: e.clientY, soltou: false, engolirClique: false });
    cancelarTimer();
    gesto.current.timer = setTimeout(() => {
      gesto.current.soltou = true; gesto.current.engolirClique = true; setArrastando(true);
      try { alvo.setPointerCapture(id); } catch { /* ok */ }
      navigator.vibrate?.(18);
    }, SEGURAR_MS);
  };
  const aoMover = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (gesto.current.soltou) { setPosicao(dentroDaJanela(e.clientX, e.clientY)); return; }
    if (Math.hypot(e.clientX - gesto.current.inicioX, e.clientY - gesto.current.inicioY) > TOLERANCIA_PX) cancelarTimer();
  };
  const aoSoltar = (e: React.PointerEvent<HTMLButtonElement>) => {
    cancelarTimer();
    if (!gesto.current.soltou) return;
    gesto.current.soltou = false; setArrastando(false);
    const final = dentroDaJanela(e.clientX, e.clientY);
    setPosicao(final);
    gravarPosicao({ x: final.left / window.innerWidth, y: final.top / window.innerHeight });
  };
  const devolverAoLugar = useCallback(() => { gravarPosicao(null); setPosicao(null); }, []);
  const fechar = useCallback(() => { setAberta(false); requestAnimationFrame(() => botao.current?.focus()); }, []);

  return (
    <>
      <button
        ref={botao} type="button" aria-label="Pesquisar" data-instant=""
        onPointerDown={aoApertar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => { if (gesto.current.engolirClique) { gesto.current.engolirClique = false; return; } setAberta(true); }}
        style={posicao ? { left: posicao.left, top: posicao.top } : undefined}
        className={`lupa-orbe ${posicao ? "lupa-orbe--movida" : "lupa-orbe--lugar"} ${arrastando ? "lupa-orbe--arrastando" : ""} ${aberta ? "lupa-orbe--escondida" : ""}`}
      >
        <LupaRobo />
        <span className={`lupa-dica ${posicao && posicao.left < 240 ? "lupa-dica--direita" : ""}`} aria-hidden>
          <span className="lupa-dica__titulo">Clique para pesquisar</span>
          <span className="lupa-dica__texto">Segure para mover</span>
        </span>
      </button>
      {aberta && (
        <PainelDeBusca tabs={tabs} fechar={fechar} movida={posicao !== null} devolverAoLugar={devolverAoLugar}
          ir={(a) => { fechar(); if (!a.abrir) return; if (a.abrir.t === "tab") onTab(a.abrir.tab); else setDestino(a.abrir.link); }} />
      )}
      {destino && <LinkView link={destino} onClose={() => setDestino(null)} onNavigate={() => setDestino(null)} />}
    </>
  );
}

const ICONE: Record<Grupo, React.ReactNode> = {
  Telas: <LayoutGrid size={16} />, Clientes: <Users size={16} />, Pedidos: <ClipboardList size={16} />, Orçamentos: <FileText size={16} />,
  Comprovantes: <Receipt size={16} />, Prospects: <Filter size={16} />, Equipe: <UserRound size={16} />, Logística: <Truck size={16} />,
  Ocorrências: <AlertTriangle size={16} />, Freezers: <Snowflake size={16} />, Produtos: <Package size={16} />, Avisos: <Bell size={16} />,
};
const POR_GRUPO = 6;

function PainelDeBusca({ tabs, fechar, movida, devolverAoLugar, ir }: { tabs: { id: string; label: string }[]; fechar: () => void; movida: boolean; devolverAoLugar: () => void; ir: (a: Achado) => void }) {
  const s = useStore();
  const [termo, setTermo] = useState("");
  const [marcada, setMarcada] = useState(0);
  const [abertos, setAbertos] = useState<Set<Grupo>>(new Set());
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const todos = useMemo(() => (s.role ? buscarTudo(termo, s.role, tabs) : []), [termo, s.role, s.version, tabs]);
  const grupos = useMemo(() => {
    const m = new Map<Grupo, Achado[]>();
    for (const a of todos) m.set(a.grupo, [...(m.get(a.grupo) ?? []), a]);
    return [...m.entries()];
  }, [todos]);
  const visiveis = useMemo(() => grupos.flatMap(([g, l]) => (abertos.has(g) ? l : l.slice(0, POR_GRUPO))), [grupos, abertos]);

  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => { setMarcada(0); setAbertos(new Set()); }, [termo]);
  useEffect(() => { lista.current?.querySelector<HTMLElement>(`[data-indice="${marcada}"]`)?.scrollIntoView({ block: "nearest" }); }, [marcada]);

  const naTecla = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); fechar(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setMarcada((a) => Math.min(a + 1, visiveis.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setMarcada((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const a = visiveis[marcada]; if (a) ir(a); }
  };
  const semResultado = termo.trim() !== "" && !todos.length;
  let idx = -1;

  return createPortal(
    <div className="lupa-fundo" onClick={(e) => { if (e.target === e.currentTarget) fechar(); }} onKeyDown={naTecla}>
      <div role="dialog" aria-modal="true" aria-label="Pesquisar no aplicativo" className="lupa-painel">
        <div className="lupa-topo">
          <IconeLupa className="lupa-topo__icone" />
          <input ref={campo} id="lupa-campo" value={termo} onChange={(e) => setTermo(e.target.value)} type="search"
            placeholder="Cliente, CNPJ, bairro, pedido, NF, placa, patrimônio, tela…" aria-label="O que você procura" autoComplete="off" enterKeyHint="go" />
          <button type="button" className="lupa-esc" onClick={fechar}>Esc</button>
        </div>
        <div className="lupa-lista" ref={lista}>
          {!termo.trim() && <p className="lupa-secao">Telas · comece a digitar para procurar em tudo</p>}
          {semResultado ? (
            <p className="lupa-vazio">Nada encontrado com “{termo.trim()}”. Tente outra palavra, o CNPJ ou o número.</p>
          ) : grupos.map(([g, l]) => (
            <div key={g} className="lupa-grupo">
              {termo.trim() && <p className="lupa-secao">{g} <span>{l.length}</span></p>}
              {(abertos.has(g) ? l : l.slice(0, POR_GRUPO)).map((a) => {
                idx++;
                const i = idx;
                return (
                  <div key={a.id} data-indice={i} role="option" aria-selected={i === marcada} onMouseMove={() => setMarcada(i)} onClick={() => ir(a)}
                    className={`lupa-opcao ${i === marcada ? "lupa-opcao--marcada" : ""} ${!a.abrir ? "lupa-opcao--info" : ""}`}>
                    <span className="lupa-opcao__ic">{a.grupo === "Telas" ? <ArrowRight size={16} /> : ICONE[a.grupo]}</span>
                    <span className="lupa-opcao__txt"><b>{a.titulo}</b><small>{a.sub}</small></span>
                    {i === marcada && a.abrir && <CornerDownLeft size={15} className="lupa-opcao__enter" />}
                  </div>
                );
              })}
              {l.length > POR_GRUPO && !abertos.has(g) && (
                <button type="button" className="lupa-mais" onClick={() => setAbertos(new Set([...abertos, g]))}>Ver todos os {l.length} em {g.toLowerCase()}</button>
              )}
            </div>
          ))}
        </div>
        <div className="lupa-rodape">
          <span><Move size={13} /> Segure a lupa para levá-la a outro lugar da tela.</span>
          {movida ? <button type="button" className="lupa-devolver" onClick={devolverAoLugar}><RotateCcw size={13} /> Devolver a lupa ao lugar</button>
            : <span className="lupa-atalho">Atalho: Ctrl + K</span>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
