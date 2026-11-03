/**
 * Resultados do mês (apresentação da reunião mensal): rankings dos vendedores por
 * faturamento, % da meta, visitas e clientes novos (primeiro pedido no mês). Cada card abre o detalhe.
 */
import { useMemo, useState } from "react";
import { Trophy, Medal, TrendingUp, TrendingDown, MapPin, UserPlus, Target, ChevronRight, Presentation, Users, Map as MapIcon, Store, AlertTriangle } from "lucide-react";
import { SELLERS, CUSTOMERS, TODAY, customerById } from "../data/mock";
import { customerOrders } from "../data/history";
import { LEADS } from "../data/leads";
import { useStore, setPresent, commit } from "../data/store";
import { nowStamp, GENERAL_MANAGER } from "../data/mock";
import { MONTH_PLANS, planFor, applyCurrentPlan, type MonthPlan } from "../data/monthplan";
import { Gift, Pencil, Save, X as XIcon, Sparkles } from "lucide-react";
import { Card, Kpi, Sheet, Chip, Progress, Badge, brl0, pct } from "./ui";
import { sellerYear, SellerPanel, CustomerHistory } from "../screens/Reports";
import { UserPhoto } from "./userphoto";

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; }

interface Row { id: string; name: string; sales: number; goal: number; pct: number; visits: number; visitsPlanned: number; newClients: { id: string; name: string; date: string; valueCents: number }[] }
type Metric = "sales" | "pct" | "visits" | "new";
const METRICS: { id: Metric; label: string; icon: React.ReactNode; fmt: (r: Row) => string; val: (r: Row) => number; sub: (r: Row) => string }[] = [
  { id: "sales", label: "Maior faturamento", icon: <TrendingUp size={17} />, val: (r) => r.sales, fmt: (r) => brl0(r.sales), sub: (r) => `meta ${brl0(r.goal)}` },
  { id: "pct", label: "Maior % da meta", icon: <Target size={17} />, val: (r) => r.pct, fmt: (r) => pct(r.pct), sub: (r) => `${brl0(r.sales)} de ${brl0(r.goal)}` },
  { id: "visits", label: "Mais visitas", icon: <MapPin size={17} />, val: (r) => r.visits, fmt: (r) => `${r.visits}`, sub: (r) => `de ${r.visitsPlanned} planejadas · ${pct((r.visits / Math.max(1, r.visitsPlanned)) * 100)}` },
  { id: "new", label: "Mais clientes novos", icon: <UserPlus size={17} />, val: (r) => r.newClients.length, fmt: (r) => `${r.newClients.length}`, sub: () => "1º pedido no mês" },
];

const monthName = (key: string) => { const [y, m] = key.split("-").map(Number) as [number, number]; return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }); };

function monthRows(key: string, scope: string[]): Row[] {
  const current = key === TODAY.slice(0, 7);
  return SELLERS.filter((s) => scope.includes(s.id)).map((s) => {
    const mp = sellerYear(s.id).find((m) => m.key === key)!;
    const carteira = CUSTOMERS.filter((c) => c.sellerId === s.id);
    const progress = current ? Math.min(1, Number(TODAY.slice(8, 10)) / 30) : 1;
    const visitsPlanned = Math.round(carteira.length * 4.3 * progress);
    const visits = Math.round(visitsPlanned * (0.74 + hash(s.id + key + "v") * 0.24));
    const nNew = Math.round((current ? 1 : 2) + hash(s.id + key + "n") * (current ? 3 : 6));
    const pool = carteira.slice().sort((a, b) => hash(a.id + key) - hash(b.id + key));
    const [y, m] = key.split("-").map(Number) as [number, number];
    const newClients = pool.slice(0, nNew).map((c, i) => ({
      id: c.id, name: c.tradeName, valueCents: Math.round((40_000 + hash(c.id + key + "x") * 260_000) / 100) * 100,
      date: `${y}-${String(m).padStart(2, "0")}-${String(Math.min(current ? Number(TODAY.slice(8, 10)) : 28, 2 + Math.floor(hash(c.id + key + i) * 26))).padStart(2, "0")}`,
    }));
    // clientes vindos da prospecção (aprovados no mês atual) contam como novos
    if (current) for (const l of LEADS.filter((x) => x.sellerId === s.id && x.stage === "cliente" && x.customerId))
      newClients.unshift({ id: l.customerId!, name: l.name, date: TODAY, valueCents: l.proposal?.valueCents ?? 0 });
    return { id: s.id, name: s.name, sales: mp.sales, goal: mp.goal, pct: (mp.sales / Math.max(1, mp.goal)) * 100, visits, visitsPlanned, newClients };
  });
}

export function ResultsView({ scope }: { scope: string[] }) {
  useStore();
  const months = sellerYear(SELLERS[0]!.id).map((m) => m.key);
  const closed = months.slice(0, -1).slice(-6);
  const [key, setKey] = useState(closed[closed.length - 1]!);
  const rows = useMemo(() => monthRows(key, scope), [key, scope.join(",")]);
  const [screen, setScreen] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [open, setOpen] = useState<Metric | null>(null);
  const [seller, setSeller] = useState<string | null>(null);
  const [cust, setCust] = useState<string | null>(null);
  const tot = { sales: rows.reduce((a, r) => a + r.sales, 0), goal: rows.reduce((a, r) => a + r.goal, 0), visits: rows.reduce((a, r) => a + r.visits, 0), planned: rows.reduce((a, r) => a + r.visitsPlanned, 0), news: rows.reduce((a, r) => a + r.newClients.length, 0) };
  const current = key === TODAY.slice(0, 7);
  return (
    <>
      <div className="flex between wrap" style={{ gap: 10, alignItems: "center", margin: "6px 0 10px" }}>
        <div><h2 style={{ margin: 0 }}>Resultados do mês</h2><div className="small muted">Apresentação da reunião mensal · {monthName(key)}{current ? " (parcial, mês em andamento)" : ""}</div></div>
        <button className="btn btn-ghost btn-sm" onClick={() => setPresent(true)}><Presentation size={15} /> Apresentar em tela cheia</button>
      </div>
      <div className="chips mb">
        {closed.map((k) => <Chip key={k} on={key === k} onClick={() => setKey(k)}>{monthName(k).replace(" de ", "/")}</Chip>)}
        <Chip on={current} onClick={() => setKey(months[months.length - 1]!)}>Mês atual (parcial)</Chip>
      </div>
      <div className="results-screens mb">
        {([[1, "Vendedores", <Users size={16} />], [2, "Regiões", <MapIcon size={16} />], [3, "Top 20 clientes", <Store size={16} />], [4, "Clientes em queda", <TrendingDown size={16} />], [5, "Meta do mês", <Target size={16} />]] as const).map(([n, label, ic]) => (
          <button key={n} className={`btn ${screen === n ? "btn-primary" : "btn-ghost"}`} onClick={() => setScreen(n)}>{ic} <span className="rs-n">{n}</span> {label}</button>
        ))}
      </div>
      {screen === 2 && <RegionsScreen rows={rows} monthKey={key} onSeller={setSeller} />}
      {screen === 3 && <ClientsScreen monthKey={key} months={months} scope={scope} onCustomer={setCust} />}
      {screen === 5 && <GoalScreen months={months} scope={scope} />}
      {screen === 4 && <DropScreen monthKey={key} months={months} scope={scope} onCustomer={setCust} />}
      {screen === 1 && <>
      <div className="grid g2 gd-4">
        <Kpi icon={<TrendingUp size={17} />} tone="gold" label="Faturamento da equipe" value={brl0(tot.sales)} onClick={() => setOpen("sales")}>
          <div className="progress-row"><Progress value={(tot.sales / tot.goal) * 100} /><b className="num xs">{pct((tot.sales / tot.goal) * 100)}</b></div>
        </Kpi>
        <Kpi icon={<Target size={17} />} label="Meta da equipe" value={brl0(tot.goal)} foot={tot.sales >= tot.goal ? "meta batida ✓" : `faltaram ${brl0(tot.goal - tot.sales)}`} onClick={() => setOpen("pct")} />
        <Kpi icon={<MapPin size={17} />} tone="info" label="Visitas realizadas" value={<>{tot.visits} <small>/ {tot.planned}</small></>} onClick={() => setOpen("visits")}>
          <div className="progress-row"><Progress value={(tot.visits / Math.max(1, tot.planned)) * 100} /><b className="num xs">{pct((tot.visits / Math.max(1, tot.planned)) * 100)}</b></div>
        </Kpi>
        <Kpi icon={<UserPlus size={17} />} tone="success" label="Clientes novos" value={tot.news} foot="1º pedido no mês · toque para ver" onClick={() => setOpen("new")} />
      </div>
      <div className="grid gd gd-2">
        {METRICS.map((m) => {
          const ranked = rows.slice().sort((a, b) => m.val(b) - m.val(a));
          const max = Math.max(1, m.val(ranked[0]!));
          return (
            <Card key={m.id} title={m.label} icon={m.icon} link="Ver ranking" onLink={() => setOpen(m.id)} onClick={() => setOpen(m.id)} className="results-card">
              <div className="podium">
                {[1, 0, 2].map((i) => ranked[i] && (
                  <div key={ranked[i]!.id} className={`podium-col p${i + 1}`} role="button" onClick={(e) => { e.stopPropagation(); setSeller(ranked[i]!.id); }}>
                    <div className="podium-medal">{i === 0 ? <Trophy size={16} /> : <Medal size={14} />}</div>
                    <UserPhoto name={ranked[i]!.name} size={i === 0 ? 58 : 46} userKey={`seller:${ranked[i]!.id}`} />
                    <div className="podium-name">{ranked[i]!.name.split(" ")[0]}</div>
                    <div className="podium-val num">{m.fmt(ranked[i]!)}</div>
                    <div className="podium-bar"><span>{i + 1}º</span></div>
                  </div>
                ))}
              </div>
              <div className="list mt">
                {ranked.slice(3).map((r, i) => (
                  <div key={r.id} className="row" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setSeller(r.id); }}>
                    <span className="pos">{i + 4}º</span>
                    <div className="grow"><div className="title small">{r.name}</div><Progress thin rel={m.id !== "pct"} value={m.id === "pct" ? r.pct : (m.val(r) / max) * 100} /></div>
                    <div className="end num semi small">{m.fmt(r)}</div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
      </>}
      {open && (
        <Sheet title={`${METRICS.find((m) => m.id === open)!.label} · ${monthName(key)}`} onClose={() => setOpen(null)} wide icon={<Trophy size={18} />}>
          {(() => {
            const m = METRICS.find((x) => x.id === open)!;
            const ranked = rows.slice().sort((a, b) => m.val(b) - m.val(a));
            return (
              <>
                <div className="list">
                  {ranked.map((r, i) => (
                    <div key={r.id} className="row click" onClick={() => setSeller(r.id)}>
                      <span className={`pos p${i + 1}`}>{i + 1}º</span>
                      <UserPhoto name={r.name} size={36} userKey={`seller:${r.id}`} />
                      <div className="grow"><div className="title">{r.name}</div><div className="sub">{m.sub(r)}</div></div>
                      <div className="end"><b className="num">{m.fmt(r)}</b></div>
                      <ChevronRight size={16} className="muted" />
                    </div>
                  ))}
                </div>
                {open === "new" && (
                  <Card title="Clientes novos do mês" className="mt" sub="toque no cliente para ver o histórico">
                    <div className="list">
                      {ranked.flatMap((r) => r.newClients.map((c) => (
                        <div key={r.id + c.id} className="row click" onClick={() => setCust(c.id)}>
                          <div className="grow"><div className="title small">{c.name}</div><div className="sub">{r.name} · 1º pedido em {new Date(`${c.date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</div></div>
                          <div className="end"><Badge tone="success">novo</Badge><div className="num xs">{brl0(c.valueCents)}</div></div>
                        </div>
                      )))}
                    </div>
                  </Card>
                )}
              </>
            );
          })()}
        </Sheet>
      )}
      {seller && <SellerPanel id={seller} onClose={() => setSeller(null)} />}
      {cust && <CustomerHistory id={cust} onClose={() => setCust(null)} />}
    </>
  );
}

// ---------------------------------------------------------------- tela 2: regiões
function RegionsScreen({ rows, monthKey, onSeller }: { rows: Row[]; monthKey: string; onSeller: (id: string) => void }) {
  const regs = rows.map((r) => {
    const s = SELLERS.find((x) => x.id === r.id)!;
    const clients = CUSTOMERS.filter((c) => c.sellerId === r.id).length;
    return { ...r, region: s.region, clients, visitPct: (r.visits / Math.max(1, r.visitsPlanned)) * 100, ticket: r.sales / Math.max(1, Math.round(r.visits * 0.55)) };
  }).sort((a, b) => b.sales - a.sales);
  const max = Math.max(1, regs[0]?.sales ?? 1);
  const avgVisit = regs.reduce((a, r) => a + r.visitPct, 0) / Math.max(1, regs.length);
  return (
    <Card title={`Ranking das regiões · ${monthName(monthKey)}`} icon={<MapIcon size={17} />} sub="faturamento × visitas realizadas · toque para ver o vendedor">
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>#</th><th>Região</th><th>Vendedor</th><th className="r">Faturamento</th><th style={{ minWidth: 160 }}>% da meta</th><th className="r">Visitas</th><th style={{ minWidth: 140 }}>% visitas</th><th className="r">Clientes</th><th>Leitura</th></tr></thead>
          <tbody>
            {regs.map((r, i) => {
              const flag = i <= 1 && r.visitPct < avgVisit ? "Vende bem, mas visita abaixo da média: dá para fazer mais" : r.visitPct >= 92 && r.pct < 90 ? "Visita bastante, mas a conversão está baixa" : r.pct >= 100 ? "Meta batida" : "";
              return (
                <tr key={r.id} className="click" onClick={() => onSeller(r.id)}>
                  <td><span className={`pos p${i + 1}`}>{i + 1}º</span></td>
                  <td className="semi">{r.region}</td>
                  <td>{r.name.split(" ")[0]}</td>
                  <td className="r num semi">{brl0(r.sales)}<div className="xs muted"><Progress thin rel value={(r.sales / max) * 100} /></div></td>
                  <td><div className="progress-row"><Progress value={r.pct} /><b className="num xs">{pct(r.pct)}</b></div></td>
                  <td className="r num">{r.visits}<span className="xs muted"> / {r.visitsPlanned}</span></td>
                  <td><div className="progress-row"><Progress value={r.visitPct} /><b className="num xs">{pct(r.visitPct)}</b></div></td>
                  <td className="r num">{r.clients}</td>
                  <td className="small">{flag && <span className={r.pct >= 100 && !flag.startsWith("Vende") ? "green semi" : "gold semi"}>{flag.startsWith("Vende") && <AlertTriangle size={13} style={{ verticalAlign: -2 }} />} {flag}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="xs muted mt">Média de visitas realizadas da equipe: {pct(avgVisit)}. Regiões no topo do faturamento com visitas abaixo da média ganham o aviso.</p>
    </Card>
  );
}

// ---------------------------------------------------------------- tela 3: top 20 clientes
/** Valor comprado pelo cliente no mês (histórico de 12 meses; mês atual = pedidos do mês). */
function clientMonthValue(customerId: string, months: string[], key: string) {
  const c = customerById.get(customerId)!;
  const back = months.length - 1 - months.indexOf(key);
  if (back <= 0) return customerOrders(customerId).filter((o) => o.date.startsWith(key)).reduce((a, o) => a + o.totalCents, 0);
  return c.monthlyHistoryCents[c.monthlyHistoryCents.length - back] ?? 0;
}

function Delta({ now, prev }: { now: number; prev: number }) {
  const d = now - prev;
  const p = prev ? (d / prev) * 100 : 100;
  if (!prev && !now) return <span className="xs muted">—</span>;
  const up = d >= 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`}>
      {up ? <TrendingUp size={15} /> : <TrendingDown size={15} />} {up ? "+" : "−"}{brl0(Math.abs(d))} <small>({up ? "+" : "−"}{pct(Math.abs(p))})</small>
    </span>
  );
}

function ClientsScreen({ monthKey, months, scope, onCustomer }: { monthKey: string; months: string[]; scope: string[]; onCustomer: (id: string) => void }) {
  const [trend, setTrend] = useState<string | null>(null);
  const prevKey = months[months.indexOf(monthKey) - 1];
  const list = CUSTOMERS.filter((c) => scope.includes(c.sellerId))
    .map((c) => ({ c, now: clientMonthValue(c.id, months, monthKey), prev: prevKey ? clientMonthValue(c.id, months, prevKey) : 0 }))
    .sort((a, b) => b.now - a.now).slice(0, 20);
  const prevRank = new Map(CUSTOMERS.filter((c) => scope.includes(c.sellerId)).map((c) => ({ id: c.id, v: prevKey ? clientMonthValue(c.id, months, prevKey) : 0 })).sort((a, b) => b.v - a.v).map((x, i) => [x.id, i + 1]));
  return (
    <>
      <Card title={`Top 20 clientes · ${monthName(monthKey)}`} icon={<Store size={17} />} sub={`comparado com ${prevKey ? monthName(prevKey) : "o mês anterior"} · toque para ver a evolução`}>
        <div className="list">
          {list.map(({ c, now, prev }, i) => {
            const was = prevRank.get(c.id);
            return (
              <div key={c.id} className="row click" onClick={() => setTrend(c.id)}>
                <span className={`pos p${i + 1}`}>{i + 1}º</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="title small">{c.tradeName}</div>
                  <div className="sub">{c.district} · {SELLERS.find((s) => s.id === c.sellerId)?.name.split(" ")[0]}{was ? ` · era ${was}º no mês anterior` : ""}</div>
                </div>
                <div className="end" style={{ alignItems: "flex-end" }}>
                  <b className="num">{brl0(now)}</b>
                  <Delta now={now} prev={prev} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      {trend && <ClientTrendSheet id={trend} months={months} onClose={() => setTrend(null)} onHistory={() => { onCustomer(trend); setTrend(null); }} />}
    </>
  );
}

function ClientTrendSheet({ id, months, onClose, onHistory }: { id: string; months: string[]; onClose: () => void; onHistory: () => void }) {
  const c = customerById.get(id)!;
  const n = c.monthlyHistoryCents.length;
  const vals = months.filter((k) => months.length - 1 - months.indexOf(k) <= n).map((k) => ({ k, v: clientMonthValue(id, months, k) }));
  const max = Math.max(1, ...vals.map((x) => x.v));
  return (
    <Sheet title={`${c.tradeName} · mês a mês`} onClose={onClose} icon={<TrendingUp size={18} />}>
      <div className="list">
        {vals.slice().reverse().map((x, i, arr) => {
          const prev = arr[i + 1]?.v ?? 0;
          const cur = x.k === TODAY.slice(0, 7);
          return (
            <div key={x.k} className="row">
              <div style={{ width: 120 }} className="small semi">{monthName(x.k)}{cur ? " (parcial)" : ""}</div>
              <div className="grow"><Progress thin rel value={(x.v / max) * 100} /></div>
              <div className="end" style={{ alignItems: "flex-end", minWidth: 150 }}><b className="num small">{brl0(x.v)}</b>{arr[i + 1] && <Delta now={x.v} prev={prev} />}</div>
            </div>
          );
        })}
      </div>
      <button className="btn btn-ghost btn-block mt" onClick={onHistory}>Abrir histórico completo do cliente (pedidos e visitas)</button>
    </Sheet>
  );
}

// ---------------------------------------------------------------- tela 4: clientes em queda
const DROP_REASONS = ["Mudou de fornecedor", "Mudou a gestão / dono", "Estoque alto", "Preço / condição", "Problema com freezer", "Fechado / reforma", "Sazonalidade", "Outro"];

function dropRows(monthKey: string, months: string[], scope: string[]) {
  const idx = months.indexOf(monthKey);
  return CUSTOMERS.filter((c) => scope.includes(c.sellerId)).map((c) => {
    const n = c.monthlyHistoryCents.length;
    const prevKeys = months.slice(Math.max(0, idx - 3), idx).filter((k) => months.length - 1 - months.indexOf(k) <= n);
    const base = prevKeys.length ? prevKeys.reduce((a, k) => a + clientMonthValue(c.id, months, k), 0) / prevKeys.length : 0;
    const now = clientMonthValue(c.id, months, monthKey);
    return { c, base, now, diff: now - base, pctDrop: base ? ((now - base) / base) * 100 : 0, nPrev: prevKeys.length };
  }).filter((r) => r.base >= 300_000 && r.diff < 0).sort((a, b) => a.pctDrop - b.pctDrop).slice(0, 20);
}

function DropScreen({ monthKey, months, scope, onCustomer }: { monthKey: string; months: string[]; scope: string[]; onCustomer: (id: string) => void }) {
  useStore();
  const [open, setOpen] = useState<string | null>(null);
  const current = monthKey === TODAY.slice(0, 7);
  const rows = dropRows(monthKey, months, scope);
  const lost = rows.reduce((a, r) => a + r.diff, 0);
  return (
    <>
      <div className="grid g2 gd-4">
        <Kpi icon={<TrendingDown size={17} />} tone="red" label="Clientes em queda (top 20)" value={rows.length} foot="queda vs média dos 3 meses anteriores" />
        <Kpi icon={<TrendingDown size={17} />} tone="red" label="Faturamento perdido" value={brl0(Math.abs(lost))} foot="soma da queda desses clientes" />
        <Kpi icon={<AlertTriangle size={17} />} tone="gold" label="Sem motivo registrado" value={rows.filter((r) => !r.c.dropNote).length} foot="ouvir o vendedor na reunião" />
        <Kpi icon={<Users size={17} />} tone="info" label="Vendedores envolvidos" value={new Set(rows.map((r) => r.c.sellerId)).size} />
      </div>
      <Card title={`Clientes que mais caíram · ${monthName(monthKey)}`} icon={<TrendingDown size={17} />} sub={`${current ? "mês parcial · " : ""}toque no cliente para registrar o motivo apontado pelo vendedor`}>
        <div className="list">
          {rows.map((r, i) => (
            <div key={r.c.id} className="row click" onClick={() => setOpen(r.c.id)}>
              <span className="pos">{i + 1}º</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="title small">{r.c.tradeName}</div>
                <div className="sub">{r.c.district} · {SELLERS.find((s) => s.id === r.c.sellerId)?.name.split(" ")[0]} · média anterior {brl0(r.base)}</div>
                {r.c.dropNote ? <div className="xs mt"><Badge tone="info">{r.c.dropNote.reason}</Badge>{r.c.dropNote.note ? <span className="muted"> {r.c.dropNote.note}</span> : null}</div> : <div className="xs gold semi mt">Motivo ainda não registrado</div>}
              </div>
              <div className="end" style={{ alignItems: "flex-end" }}>
                <b className="num">{brl0(r.now)}</b>
                <span className="delta down"><TrendingDown size={15} /> {pct(Math.abs(r.pctDrop))} <small>(−{brl0(Math.abs(r.diff))})</small></span>
              </div>
            </div>
          ))}
          {!rows.length && <div className="small muted">Nenhum cliente com queda relevante neste mês.</div>}
        </div>
      </Card>
      {open && <DropSheet id={open} months={months} onClose={() => setOpen(null)} onHistory={() => { onCustomer(open); setOpen(null); }} />}
    </>
  );
}

function DropSheet({ id, months, onClose, onHistory }: { id: string; months: string[]; onClose: () => void; onHistory: () => void }) {
  const c = customerById.get(id)!;
  const [reason, setReason] = useState<string | null>(c.dropNote?.reason ?? null);
  const [note, setNote] = useState(c.dropNote?.note ?? "");
  const n = c.monthlyHistoryCents.length;
  const vals = months.filter((k) => months.length - 1 - months.indexOf(k) <= n).map((k) => ({ k, v: clientMonthValue(id, months, k) }));
  const max = Math.max(1, ...vals.map((x) => x.v));
  return (
    <Sheet title={`${c.tradeName} · queda de compras`} onClose={onClose} icon={<TrendingDown size={18} />}>
      <div className="small muted mb">{c.district} · vendedor {SELLERS.find((s) => s.id === c.sellerId)?.name} · {c.buyerName} · {c.phone}</div>
      <div className="list mb">
        {vals.slice().reverse().map((x, i, arr) => (
          <div key={x.k} className="row">
            <div style={{ width: 120 }} className="small semi">{monthName(x.k)}</div>
            <div className="grow"><Progress thin rel value={(x.v / max) * 100} /></div>
            <div className="end" style={{ alignItems: "flex-end", minWidth: 150 }}><b className="num small">{brl0(x.v)}</b>{arr[i + 1] && <Delta now={x.v} prev={arr[i + 1]!.v} />}</div>
          </div>
        ))}
      </div>
      <div className="field"><label>O que o vendedor apontou na reunião</label>
        <div className="chips">{DROP_REASONS.map((r) => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}</div>
      </div>
      <div className="field"><label>Anotação / plano de ação</label><textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: concorrente deu freezer novo; visitar na quinta com proposta de comodato" /></div>
      <div className="grid g2" style={{ marginBottom: 0 }}>
        <button className="btn btn-ghost" onClick={onHistory}>Histórico completo</button>
        <button className="btn btn-primary" disabled={!reason} onClick={() => { commit(() => { c.dropNote = { reason: reason!, note: note.trim() || undefined, at: nowStamp(), by: GENERAL_MANAGER.name }; }, "Motivo registrado"); onClose(); }}>Salvar motivo</button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- tela 5: meta do mês (editável)
function GoalScreen({ months, scope }: { months: string[]; scope: string[] }) {
  useStore();
  const curKey = months[months.length - 1]!;
  const prevKey = months[months.length - 2]!;
  const prev = monthRows(prevKey, scope);
  const prevSales = prev.reduce((a, r) => a + r.sales, 0), prevGoal = prev.reduce((a, r) => a + r.goal, 0);
  const saved = planFor(curKey);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<MonthPlan>(() => structuredClone(saved));
  const plan = edit ? draft : saved;
  const sellers = SELLERS.filter((s) => scope.includes(s.id));
  const sum = sellers.reduce((a, s) => a + (plan.perSeller[s.id] ?? 0), 0);
  const growth = prevSales ? ((plan.totalCents - prevSales) / prevSales) * 100 : 0;
  const toReais = (c: number) => String(Math.round(c / 100));
  const fromReais = (t: string) => Math.max(0, Math.round(Number(t.replace(/\D/g, "")) * 100));
  const distribute = () => {
    const base = sellers.reduce((a, s) => a + (draft.perSeller[s.id] ?? s.monthlyGoalCents), 0) || 1;
    const per = Object.fromEntries(sellers.map((s) => [s.id, Math.round((draft.totalCents * ((draft.perSeller[s.id] ?? s.monthlyGoalCents) / base)) / 100_000) * 100_000]));
    setDraft({ ...draft, perSeller: { ...draft.perSeller, ...per } });
  };
  const save = () => {
    commit(() => {
      const rec = { ...draft, updatedAt: nowStamp(), updatedBy: GENERAL_MANAGER.name };
      const i = MONTH_PLANS.findIndex((x) => x.id === curKey);
      if (i >= 0) MONTH_PLANS[i] = rec; else MONTH_PLANS.push(rec);
      applyCurrentPlan();
    }, "Meta do mês salva · metas dos vendedores atualizadas");
    setEdit(false);
  };
  return (
    <div className="goal-stage">
      <div className="flex between wrap" style={{ gap: 10, alignItems: "center" }}>
        <div className="small muted">Mês passado ({monthName(prevKey)}) × meta de {monthName(curKey)}</div>
        {!edit ? <button className="btn btn-ghost btn-sm" onClick={() => { setDraft(structuredClone(saved)); setEdit(true); }}><Pencil size={14} /> Editar metas e premiação</button>
          : <div className="flex" style={{ gap: 8 }}><button className="btn btn-ghost btn-sm" onClick={() => setEdit(false)}><XIcon size={14} /> Cancelar</button><button className="btn btn-primary btn-sm" onClick={save}><Save size={14} /> Salvar</button></div>}
      </div>
      <div className="goal-hero">
        <div className="goal-prev">
          <div className="gh-label">Mês passado · {monthName(prevKey)}</div>
          <div className="gh-num">{brl0(prevSales)}</div>
          <div className="gh-sub">meta {brl0(prevGoal)} · <b className={prevSales >= prevGoal ? "green" : "red"}>{pct((prevSales / Math.max(1, prevGoal)) * 100)}</b></div>
          <Progress value={(prevSales / Math.max(1, prevGoal)) * 100} />
        </div>
        <div className="goal-main">
          <div className="gh-label"><Sparkles size={16} /> Meta de {monthName(curKey)}</div>
          {edit ? <input id="goal-total" className="input goal-input num" inputMode="numeric" value={toReais(draft.totalCents)} onChange={(e) => setDraft({ ...draft, totalCents: fromReais(e.target.value) })} />
            : <div className="gh-big num">{brl0(plan.totalCents)}</div>}
          <div className="gh-sub">{growth >= 0 ? "+" : ""}{pct(growth)} sobre o realizado do mês passado</div>
          {edit ? <input className="input mt" value={draft.message ?? ""} onChange={(e) => setDraft({ ...draft, message: e.target.value })} placeholder="Frase para a equipe" />
            : plan.message && <div className="gh-msg">“{plan.message}”</div>}
        </div>
      </div>

      <Card title="Meta por região e vendedor" icon={<MapIcon size={17} />} sub={edit ? `soma das metas: ${brl0(sum)}${sum !== draft.totalCents ? ` · diferença ${brl0(draft.totalCents - sum)}` : " ✓"}` : "divisão da meta do mês"}
        link={edit ? "Distribuir pela meta total" : undefined} onLink={distribute}>
        <div className="goal-sellers">
          {sellers.map((s) => {
            const g = plan.perSeller[s.id] ?? s.monthlyGoalCents;
            const last = prev.find((r) => r.id === s.id);
            return (
              <div key={s.id} className="goal-seller">
                <UserPhoto name={s.name} size={52} userKey={`seller:${s.id}`} />
                <div className="gs-name">{s.name.split(" ")[0]}</div>
                <div className="gs-region">{s.region}</div>
                {edit ? <input className="input num" inputMode="numeric" value={toReais(g)} onChange={(e) => setDraft({ ...draft, perSeller: { ...draft.perSeller, [s.id]: fromReais(e.target.value) } })} />
                  : <div className="gs-goal num">{brl0(g)}</div>}
                <div className="gs-last">mês passado {brl0(last?.sales ?? 0)} ({pct(last?.pct ?? 0)})</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Premiação do mês" icon={<Gift size={17} />} className="mt" sub={plan.criterion === "pct" ? "ranking por % da meta" : "ranking por faturamento"}>
        {edit && (
          <div className="chips mb">
            <Chip on={draft.criterion === "pct"} onClick={() => setDraft({ ...draft, criterion: "pct" })}>Por % da meta</Chip>
            <Chip on={draft.criterion === "sales"} onClick={() => setDraft({ ...draft, criterion: "sales" })}>Por faturamento</Chip>
          </div>
        )}
        <div className="prizes">
          {plan.prizes.map((p, i) => (edit || (p.on && p.prize)) && (
            <div key={p.place} className={`prize p${p.place} ${!p.on ? "off" : ""}`}>
              <div className="prize-place">{p.place === 1 ? <Trophy size={26} /> : <Medal size={22} />}<span>{p.place}º lugar</span></div>
              {edit ? (
                <>
                  <input className="input" value={p.prize} placeholder="Prêmio (ex.: garrafa de whisky)" onChange={(e) => { const prizes = draft.prizes.map((x, j) => (j === i ? { ...x, prize: e.target.value, on: !!e.target.value || x.on } : x)); setDraft({ ...draft, prizes }); }} />
                  <div className="chips mt"><Chip on={p.on} onClick={() => setDraft({ ...draft, prizes: draft.prizes.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })}>{p.on ? "Ativo" : "Sem prêmio"}</Chip></div>
                </>
              ) : <div className="prize-name">{p.prize}</div>}
            </div>
          ))}
          {!edit && !plan.prizes.some((p) => p.on && p.prize) && <div className="small muted">Sem premiação definida para este mês.</div>}
        </div>
      </Card>
      {saved.updatedAt && !edit && <p className="xs muted mt">Última edição: {saved.updatedBy} · {new Date(saved.updatedAt).toLocaleString("pt-BR")}</p>}
    </div>
  );
}
