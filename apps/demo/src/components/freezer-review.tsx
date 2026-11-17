/**
 * Menu "Conferência de freezers" (só o Gerente).
 * Do dia → visitas finalizadas viram uma fila de freezers para assistir e conferir (OK / problema).
 * Faltam → visitas do dia que ainda não aconteceram (freezers sem vídeo ainda).
 * Ficaram para trás → vídeos de dias anteriores sem conferência, ordenados pelo prazo até apagar.
 * Por vendedor → produtividade e pendências de cada um.
 * Histórico → todos os freezers, com alertas (sem conferência, problema recorrente, sem visita).
 */
import { useMemo, useState } from "react";
import { type IsoDate } from "@galato/domain";
import {
  Snowflake, CheckCircle2, AlertTriangle, Clock, ChevronLeft, ChevronRight, Play, VideoOff, History, Users, CalendarClock,
  ListChecks, SkipForward, Undo2, Radio, XCircle,
} from "lucide-react";
import { CHECKINS, SELLERS, TODAY, nowStamp } from "../data/mock";
import { commit, useStore } from "../data/store";
import { notify } from "../data/notify";
import { nextWorkday, prevWorkday } from "../data/dayvisits";
import {
  FREEZER_REVIEWS, FZ_ISSUES, FZ_FLAGS, freezerDay, freezerBacklog, freezerHistory, sellerIdsOf, sellerName,
  type FzItem, type FzIssue, type FzState, type FzFlag, type FreezerSummary,
} from "../data/freezer-review";
import { Badge, Card, Chip, Kpi, Progress, Sheet, SearchBox, pct } from "./ui";
import { CheckinVideoPlayer } from "./checkout";
import { DemoFreezerPlayer } from "./visits";
import { PatrimonyHistory } from "./freezer-occurrences";
import { norm } from "../data/search";

type View = "dia" | "faltam" | "atras" | "vend" | "hist";
const fmtD = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "");
const STATE: Record<FzState, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  conferir: { label: "A conferir", tone: "warning" },
  ok: { label: "OK", tone: "success" },
  problema: { label: "Problema", tone: "danger" },
  sem_video: { label: "Sem vídeo", tone: "neutral" },
};
const fzName = (a: { brand?: string; type?: string; model: string }) => [a.brand, a.model || a.type].filter(Boolean).join(" · ");
const matchItem = (i: { customer: { tradeName: string; legalName: string; district: string; code: string }; asset: { patrimony: string; model: string; type?: string; brand?: string }; sellerId: string }, q: string) =>
  !q.trim() || norm(`${i.customer.tradeName} ${i.customer.legalName} ${i.customer.district} ${i.customer.code} ${i.asset.patrimony} ${fzName(i.asset)} ${sellerName(i.sellerId)}`).includes(norm(q));

export function freezerReviewCount(scope: string[]) {
  const d = freezerDay(scope, TODAY).items.filter((i) => i.state === "conferir").length;
  return d + freezerBacklog(scope).length;
}

export function ManagerFreezerReview({ scope }: { scope: string[] }) {
  useStore();
  const [view, setView] = useState<View>("dia");
  const [date, setDate] = useState<IsoDate>(TODAY);
  const [seller, setSeller] = useState("all");
  const [stateF, setStateF] = useState<"all" | FzState>("conferir");
  const [flagF, setFlagF] = useState<"all" | "alerta" | FzFlag>("alerta");
  const [sq, setSq] = useState("");
  const [queue, setQueue] = useState<{ items: FzItem[]; idx: number } | null>(null);
  const [fz, setFz] = useState<FreezerSummary | null>(null);
  const ids = sellerIdsOf(scope, seller);
  const ver = FREEZER_REVIEWS.length + CHECKINS.length;
  const day = useMemo(() => freezerDay(ids, date), [ids.join(), date, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const backlog = useMemo(() => freezerBacklog(ids), [ids.join(), ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const hist = useMemo(() => (view === "hist" || fz ? freezerHistory(ids) : []), [ids.join(), ver, view, !!fz]); // eslint-disable-line react-hooks/exhaustive-deps

  if (queue) return <ReviewSheet items={queue.items} start={queue.idx} onClose={() => setQueue(null)} />;
  if (fz) {
    const live = hist.find((h) => h.asset.patrimony === fz.asset.patrimony && h.customer.id === fz.customer.id) ?? fz;
    return <FreezerSheet s={live} onClose={() => setFz(null)} onReview={(i) => setQueue({ items: [i], idx: 0 })} />;
  }

  const items = day.items;
  const toReview = items.filter((i) => i.state === "conferir");
  const done = items.filter((i) => i.state === "ok" || i.state === "problema");
  const probs = items.filter((i) => i.state === "problema");
  const noVideo = items.filter((i) => i.state === "sem_video");
  const pendFreezers = day.pending.reduce((a, p) => a + p.freezers, 0);
  const reviewable = items.length - noVideo.length;
  const progress = reviewable ? (done.length / reviewable) * 100 : 0;
  const shown = items.filter((i) => (stateF === "all" || i.state === stateF) && matchItem(i, sq));
  const startQueue = (list: FzItem[], idx = 0) => list.length && setQueue({ items: list, idx });

  return (
    <>
      <h2 style={{ margin: "6px 0 4px" }}>Conferência de freezers</h2>
      <p className="small muted mb">Cada visita finalizada traz o vídeo do freezer. Confira freezer por freezer: OK ou problema. O vídeo é apagado {60} dias após a visita.</p>

      <div className="chips mb fzr-tabs">
        <Chip on={view === "dia"} onClick={() => setView("dia")}><ListChecks size={14} /> Do dia ({toReview.length})</Chip>
        <Chip on={view === "faltam"} onClick={() => setView("faltam")}><Clock size={14} /> Visitas que faltam ({day.pending.filter((p) => p.status !== "nao_visitado").length})</Chip>
        <Chip on={view === "atras"} onClick={() => setView("atras")}><CalendarClock size={14} /> Ficaram para trás ({backlog.length})</Chip>
        <Chip on={view === "vend"} onClick={() => setView("vend")}><Users size={14} /> Por vendedor</Chip>
        <Chip on={view === "hist"} onClick={() => setView("hist")}><History size={14} /> Histórico</Chip>
      </div>

      <div className="flex fzr-filters" style={{ gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {(view === "dia" || view === "faltam" || view === "vend") && (
          <div className="fzr-daynav">
            <button className="btn btn-ghost btn-sm" aria-label="Dia anterior" onClick={() => setDate(prevWorkday(date))}><ChevronLeft size={16} /></button>
            <span className="semi small">{date === TODAY ? "Hoje · " : ""}{fmtD(date)}</span>
            <button className="btn btn-ghost btn-sm" aria-label="Próximo dia" disabled={date >= TODAY} onClick={() => setDate(nextWorkday(date))}><ChevronRight size={16} /></button>
            {date !== TODAY && <button className="btn btn-soft btn-sm" onClick={() => setDate(TODAY)}>Hoje</button>}
          </div>
        )}
        <select id="fzr-seller" className="input" style={{ width: "auto", minWidth: 170 }} value={seller} onChange={(e) => setSeller(e.target.value)}>
          <option value="all">Todos os vendedores</option>
          {SELLERS.filter((s) => scope.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {view === "dia" && (
        <>
          <div className="grid g2 gd-4">
            <Kpi icon={<ListChecks size={17} />} tone="gold" label="A conferir" value={toReview.length} foot={`${items.length} freezers em ${new Set(items.map((i) => i.visit.id)).size} visitas finalizadas`} onClick={() => setStateF("conferir")} />
            <Kpi icon={<CheckCircle2 size={17} />} tone="success" label="Conferidos" value={<>{done.length} <small>/ {reviewable}</small></>} onClick={() => setStateF("ok")}>
              <div className="progress-row"><Progress value={progress} /><b className="num xs">{pct(progress)}</b></div>
            </Kpi>
            <Kpi icon={<AlertTriangle size={17} />} label="Com problema" value={probs.length} foot={noVideo.length ? `${noVideo.length} sem vídeo` : "vendedor avisado para corrigir"} onClick={() => setStateF("problema")} />
            <Kpi icon={<Clock size={17} />} tone="info" label="Visitas que faltam" value={day.pending.filter((p) => p.status !== "nao_visitado").length} foot={`${pendFreezers} freezers ainda sem vídeo`} onClick={() => setView("faltam")} />
          </div>
          {toReview.length > 0 && (
            <button id="fzr-start" className="btn btn-primary btn-block btn-lg mb" onClick={() => startQueue(toReview)}>
              <Play size={18} /> Conferir em sequência ({toReview.length} freezer{toReview.length > 1 ? "s" : ""})
            </button>
          )}
          {!toReview.length && items.length > 0 && <div className="fzr-done mb"><CheckCircle2 size={18} /> Tudo conferido neste dia{backlog.length ? ` · ainda há ${backlog.length} de dias anteriores` : ""}.</div>}
          <SearchBox value={sq} onChange={setSq} placeholder="Cliente, patrimônio, bairro, modelo ou vendedor" />
          <div className="chips mb">
            {(["conferir", "ok", "problema", "sem_video", "all"] as const).map((k) => (
              <Chip key={k} on={stateF === k} onClick={() => setStateF(k)}>{k === "all" ? `Todos (${items.length})` : `${STATE[k].label} (${items.filter((i) => i.state === k).length})`}</Chip>
            ))}
          </div>
          <Card>
            <div className="list">{shown.map((i) => <FzRow key={i.key} i={i} onClick={() => i.hasVideo ? startQueue(shown.filter((x) => x.hasVideo), shown.filter((x) => x.hasVideo).indexOf(i)) : openSummary(i)} />)}</div>
            {!shown.length && <div className="empty"><div className="ic"><Snowflake /></div>{items.length ? "Nenhum freezer neste filtro." : date === TODAY ? "Nenhuma visita finalizada ainda hoje." : "Nenhuma visita finalizada neste dia."}</div>}
          </Card>
        </>
      )}

      {view === "faltam" && <PendingView pending={day.pending} perSeller={day.perSeller} date={date} sq={sq} setSq={setSq} />}

      {view === "atras" && (
        <>
          <div className="grid g2 gd-4">
            <Kpi icon={<CalendarClock size={17} />} tone="gold" label="Vídeos sem conferir" value={backlog.length} foot="de dias anteriores" />
            <Kpi icon={<AlertTriangle size={17} />} label="Vencem em até 7 dias" value={backlog.filter((i) => i.daysLeft <= 7).length} foot="depois o vídeo é apagado" />
            <Kpi icon={<Users size={17} />} tone="info" label="Clientes" value={new Set(backlog.map((i) => i.customer.id)).size} />
            <Kpi icon={<History size={17} />} tone="success" label="Mais antigo" value={backlog.length ? fmtD(backlog.reduce((a, i) => (i.date < a ? i.date : a), TODAY)) : "—"} />
          </div>
          {backlog.length > 0 && <button className="btn btn-primary btn-block btn-lg mb" onClick={() => startQueue(backlog.filter((i) => matchItem(i, sq)))}><Play size={18} /> Conferir atrasados (mais urgentes primeiro)</button>}
          <SearchBox value={sq} onChange={setSq} placeholder="Cliente, patrimônio, bairro, modelo ou vendedor" />
          <Card>
            <div className="list">{backlog.filter((i) => matchItem(i, sq)).map((i, n, arr) => <FzRow key={i.key} i={i} showDate onClick={() => startQueue(arr, n)} />)}</div>
            {!backlog.length && <div className="empty"><div className="ic"><CheckCircle2 /></div>Nenhum vídeo ficou para trás. 👏</div>}
          </Card>
        </>
      )}

      {view === "vend" && <SellersView scope={ids} date={date} onPick={(id) => { setSeller(id); setView("dia"); }} />}

      {view === "hist" && <HistoryView hist={hist} flagF={flagF} setFlagF={setFlagF} sq={sq} setSq={setSq} onOpen={setFz} />}
    </>
  );

  function openSummary(i: FzItem) {
    const s = freezerHistory([i.sellerId]).find((h) => h.asset.patrimony === i.asset.patrimony && h.customer.id === i.customer.id);
    if (s) setFz(s);
  }
}

function FzRow({ i, onClick, showDate }: { i: FzItem; onClick: () => void; showDate?: boolean }) {
  const st = STATE[i.state];
  return (
    <div className={`row click fzr-row fzr-${i.state}`} onClick={onClick}>
      <span className="fzr-ic">{i.state === "ok" ? <CheckCircle2 size={18} /> : i.state === "problema" ? <AlertTriangle size={18} /> : i.state === "sem_video" ? <VideoOff size={18} /> : <Snowflake size={18} />}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="title small">{i.asset.patrimony} · {i.customer.tradeName}</div>
        <div className="sub">{sellerName(i.sellerId)} · {showDate ? `${fmtD(i.date)} · ` : ""}checkout {hhmm(i.visit.outAt)} · {fzName(i.asset)}</div>
        {i.review?.status === "problema" && <div className="xs red" style={{ marginTop: 2 }}>{i.review.issues.map((x) => FZ_ISSUES[x]).join(" · ")}{i.review.note ? ` · ${i.review.note}` : ""}</div>}
      </div>
      <div className="end" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <Badge tone={st.tone}>{st.label}</Badge>
        {i.state === "conferir" && i.date < TODAY && <span className={`xs semi ${i.daysLeft <= 7 ? "red" : "muted"}`}>apaga em {Math.max(0, i.daysLeft)}d</span>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ conferência (fila)
function ReviewSheet({ items, start, onClose }: { items: FzItem[]; start: number; onClose: () => void }) {
  useStore();
  const [idx, setIdx] = useState(Math.max(0, start));
  const [mode, setMode] = useState<"pick" | "problem">("pick");
  const [issues, setIssues] = useState<FzIssue[]>([]);
  const [note, setNote] = useState("");
  const [warnSeller, setWarnSeller] = useState(true);
  const [count, setCount] = useState({ ok: 0, prob: 0 });
  const it = items[idx];
  const reset = () => { setMode("pick"); setIssues([]); setNote(""); setWarnSeller(true); };
  const go = (n: number) => { reset(); setIdx(n); };

  if (!it) {
    return (
      <Sheet title="Conferência concluída" onClose={onClose} icon={<CheckCircle2 size={18} />}>
        <div className="card" style={{ textAlign: "center" }}>
          <CheckCircle2 size={40} className="green" />
          <div className="bold mt" style={{ fontSize: 18 }}>Fila conferida</div>
          <div className="small muted">{count.ok} OK · {count.prob} com problema</div>
        </div>
        <button className="btn btn-primary btn-block mt" onClick={onClose}>Voltar</button>
      </Sheet>
    );
  }
  const current = FREEZER_REVIEWS.find((r) => r.id === it.key) ?? it.review;
  const checkin = it.visit.checkinId ? CHECKINS.find((k) => k.id === it.visit.checkinId) : undefined;
  const sameVisit = items.filter((x, n) => n > idx && x.visit.id === it.visit.id && x.date === it.date && x.customer.id === it.customer.id && !FREEZER_REVIEWS.some((r) => r.id === x.key));

  const save = (status: "ok" | "problema", targets: FzItem[]) => commit(() => {
    for (const t of targets) {
      const i = FREEZER_REVIEWS.findIndex((r) => r.id === t.key);
      const r = {
        id: t.key, customerId: t.customer.id, patrimony: t.asset.patrimony, date: t.date, sellerId: t.sellerId, visitId: t.visit.id,
        status, issues: status === "problema" ? issues : [], ...(note.trim() ? { note: note.trim() } : {}),
        ...(status === "problema" && warnSeller ? { sellerNotified: true } : {}), reviewedAt: nowStamp(), reviewedBy: "Gestão",
      };
      if (i >= 0) FREEZER_REVIEWS[i] = r; else FREEZER_REVIEWS.unshift(r);
    }
    if (status === "problema" && warnSeller) {
      notify({ link: { t: "customer", id: it.customer.id }, kind: "comercial", priority: "high", title: `Freezer ${it.asset.patrimony}: corrigir na próxima visita`,
        text: `${it.customer.tradeName} · ${issues.map((x) => FZ_ISSUES[x]).join(", ")}${note.trim() ? ` · ${note.trim()}` : ""} (vídeo de ${fmtD(it.date)}).`, to: [`seller:${it.sellerId}`] });
    }
    setCount((c) => ({ ok: c.ok + (status === "ok" ? targets.length : 0), prob: c.prob + (status === "problema" ? targets.length : 0) }));
    // pula os já conferidos agora e segue para o próximo
    let n = idx + 1;
    while (n < items.length && targets.some((t) => t.key === items[n]!.key)) n++;
    reset(); setIdx(n);
  }, status === "ok" ? (targets.length > 1 ? `${targets.length} freezers conferidos · OK` : "Freezer conferido · OK") : warnSeller ? "Problema registrado · vendedor avisado" : "Problema registrado");

  return (
    <Sheet title={`Conferir freezer ${idx + 1} de ${items.length}`} onClose={onClose} icon={<Snowflake size={18} />}>
      <div className="progress-row mb"><Progress value={((idx) / items.length) * 100} rel /><b className="num xs">{idx}/{items.length}</b></div>
      <div className="fzr-video">
        {checkin?.video ? <CheckinVideoPlayer checkin={checkin} />
          : it.hasVideo ? <DemoFreezerPlayer date={it.date} patrimonies={[it.asset.patrimony]} />
          : <div className="small muted" style={{ padding: 14 }}><VideoOff size={16} style={{ verticalAlign: -3 }} /> Sem vídeo para esta visita (apagado após {60} dias ou não enviado).</div>}
      </div>
      <div className="card mt">
        <dl className="kv">
          <dt>Freezer</dt><dd><b>{it.asset.patrimony}</b> · {fzName(it.asset)}</dd>
          <dt>Cliente</dt><dd>{it.customer.tradeName} · {it.customer.district}</dd>
          <dt>Vendedor</dt><dd>{sellerName(it.sellerId)}</dd>
          <dt>Visita</dt><dd>{fmtD(it.date)} · {hhmm(it.visit.inAt)}–{hhmm(it.visit.outAt)}{it.visit.minutes ? ` (${it.visit.minutes} min)` : ""}</dd>
          <dt>Resultado</dt><dd>{it.visit.result}</dd>
          {it.visit.note && <><dt>Observação</dt><dd>📝 {it.visit.note}</dd></>}
          {current && <><dt>Conferência</dt><dd><Badge tone={current.status === "ok" ? "success" : "danger"}>{current.status === "ok" ? "OK" : "Problema"}</Badge> {current.issues.map((x) => FZ_ISSUES[x]).join(", ")}</dd></>}
        </dl>
      </div>

      {mode === "pick" ? (
        <>
          <div className="grid g2 mt" style={{ marginBottom: 0 }}>
            <button id="fzr-ok" className="btn btn-success btn-lg fzr-okbtn" disabled={!it.hasVideo} onClick={() => save("ok", [it])}><CheckCircle2 size={18} /> Freezer OK</button>
            <button id="fzr-prob" className="btn btn-danger btn-lg" onClick={() => setMode("problem")}><AlertTriangle size={18} /> Problema</button>
          </div>
          {sameVisit.length > 0 && it.hasVideo && (
            <button className="btn btn-soft btn-block mt" onClick={() => save("ok", [it, ...sameVisit])}><ListChecks size={16} /> OK para os {sameVisit.length + 1} freezers deste cliente</button>
          )}
        </>
      ) : (
        <div className="card mt">
          <div className="semi small mb">O que está errado?</div>
          <div className="chips">{(Object.keys(FZ_ISSUES) as FzIssue[]).map((k) => <Chip key={k} on={issues.includes(k)} onClick={() => setIssues((xs) => xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k])}>{FZ_ISSUES[k]}</Chip>)}</div>
          <div className="field mt"><label>Observação</label><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: picolé da concorrência na prateleira de cima" /></div>
          <label className="flex small" style={{ gap: 8 }}><input type="checkbox" checked={warnSeller} onChange={(e) => setWarnSeller(e.target.checked)} /> Avisar {sellerName(it.sellerId).split(" ")[0]} para corrigir na próxima visita</label>
          <div className="grid g2 mt" style={{ marginBottom: 0 }}>
            <button className="btn btn-ghost" onClick={reset}>Voltar</button>
            <button id="fzr-saveprob" className="btn btn-danger" disabled={!issues.length} onClick={() => save("problema", [it])}>Salvar problema</button>
          </div>
          {!issues.length && <div className="xs muted mt">Escolha pelo menos um motivo.</div>}
        </div>
      )}

      <div className="flex mt" style={{ justifyContent: "space-between", gap: 8 }}>
        <button className="btn btn-ghost btn-sm" disabled={idx === 0} onClick={() => go(idx - 1)}><ChevronLeft size={15} /> Anterior</button>
        {current && !current.synthetic && FREEZER_REVIEWS.some((r) => r.id === it.key) && (
          <button className="btn btn-ghost btn-sm" onClick={() => commit(() => { const n = FREEZER_REVIEWS.findIndex((r) => r.id === it.key); if (n >= 0) FREEZER_REVIEWS.splice(n, 1); }, "Conferência desfeita")}><Undo2 size={15} /> Desfazer</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => go(idx + 1)}>Pular <SkipForward size={15} /></button>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------ visitas que faltam
function PendingView({ pending, perSeller, date, sq, setSq }: { pending: ReturnType<typeof freezerDay>["pending"]; perSeller: Map<string, { planned: number; done: number }>; date: IsoDate; sq: string; setSq: (s: string) => void }) {
  const groups = [...perSeller.entries()].map(([sid, n]) => ({ sid, n, list: pending.filter((p) => p.sellerId === sid && matchItem({ customer: p.customer, asset: { patrimony: "", model: "" }, sellerId: sid }, sq)) }));
  const past = date < TODAY;
  return (
    <>
      <p className="small muted mb">{past ? "Clientes da rota que ficaram sem visita neste dia: os freezers deles ficaram sem vídeo." : "Clientes da rota de hoje que ainda não tiveram checkout: o vídeo dos freezers chega quando o vendedor finalizar a visita."}</p>
      <SearchBox value={sq} onChange={setSq} placeholder="Cliente, bairro ou vendedor" />
      {groups.map(({ sid, n, list }) => (
        <Card key={sid} title={sellerName(sid)} icon={<Users size={17} />} sub={`${n.done} de ${n.planned} visitas feitas · ${list.reduce((a, p) => a + p.freezers, 0)} freezers sem vídeo`}>
          <div className="progress-row mb"><Progress value={n.planned ? (n.done / n.planned) * 100 : 0} /><b className="num xs">{pct(n.planned ? (n.done / n.planned) * 100 : 0)}</b></div>
          <div className="list">
            {list.map((p) => (
              <div key={p.customer.id} className="row">
                <span className="fzr-ic">{p.status === "em_andamento" ? <Radio size={17} className="gold" /> : p.status === "nao_visitado" ? <XCircle size={17} className="red" /> : <Clock size={17} className="muted" />}</span>
                <div className="grow"><div className="title small">{p.customer.tradeName}</div><div className="sub">{p.customer.district} · {p.freezers} freezer{p.freezers === 1 ? "" : "s"}</div></div>
                <Badge tone={p.status === "em_andamento" ? "warning" : p.status === "nao_visitado" ? "danger" : "neutral"}>{p.status === "em_andamento" ? `em visita desde ${hhmm(p.inAt)}` : p.status === "nao_visitado" ? "não visitado" : "pendente"}</Badge>
              </div>
            ))}
            {!list.length && <div className="small muted">Nenhuma visita pendente. ✅</div>}
          </div>
        </Card>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ por vendedor
function SellersView({ scope, date, onPick }: { scope: string[]; date: IsoDate; onPick: (id: string) => void }) {
  const rows = scope.map((sid) => {
    const d = freezerDay([sid], date);
    const back = freezerBacklog([sid]);
    const rev = d.items.filter((i) => i.state !== "sem_video");
    const done = rev.filter((i) => i.review).length;
    return { sid, n: d.perSeller.get(sid)!, fz: d.items.length, done, prob: d.items.filter((i) => i.state === "problema").length, todo: d.items.filter((i) => i.state === "conferir").length, noVid: d.items.length - rev.length, back: back.length, pctv: rev.length ? (done / rev.length) * 100 : 0 };
  }).sort((a, b) => b.todo + b.back - (a.todo + a.back));
  return (
    <Card>
      <div className="list">
        {rows.map((r) => (
          <div key={r.sid} className="row click" onClick={() => onPick(r.sid)} style={{ alignItems: "flex-start" }}>
            <div className="grow">
              <div className="title small">{sellerName(r.sid)}</div>
              <div className="sub">{r.n.done}/{r.n.planned} visitas · {r.fz} freezers · {r.done} conferidos · {r.prob} problema{r.prob === 1 ? "" : "s"}{r.noVid ? ` · ${r.noVid} sem vídeo` : ""}</div>
              <div className="progress-row" style={{ marginTop: 6 }}><Progress value={r.pctv} thin /><b className="num xs">{pct(r.pctv)}</b></div>
            </div>
            <div className="end" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              {r.todo > 0 ? <Badge tone="warning">{r.todo} a conferir</Badge> : <Badge tone="success">dia em dia</Badge>}
              {r.back > 0 && <span className="xs semi red">{r.back} atrasado{r.back === 1 ? "" : "s"}</span>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ histórico
function HistoryView({ hist, flagF, setFlagF, sq, setSq, onOpen }: { hist: FreezerSummary[]; flagF: "all" | "alerta" | FzFlag; setFlagF: (f: "all" | "alerta" | FzFlag) => void; sq: string; setSq: (s: string) => void; onOpen: (s: FreezerSummary) => void }) {
  const [lim, setLim] = useState(60);
  const alert = (h: FreezerSummary) => h.flags.some((f) => f !== "sem_visita");
  const list = hist.filter((h) => (flagF === "all" || (flagF === "alerta" ? alert(h) : h.flags.includes(flagF))) && matchItem(h, sq))
    .sort((a, b) => b.flags.length - a.flags.length || (b.daysSinceReview ?? 999) - (a.daysSinceReview ?? 999));
  const rev7 = hist.filter((h) => h.daysSinceReview !== null && h.daysSinceReview <= 7).length;
  return (
    <>
      <div className="grid g2 gd-4">
        <Kpi icon={<Snowflake size={17} />} tone="info" label="Freezers instalados" value={hist.length} foot={`${new Set(hist.map((h) => h.customer.id)).size} clientes`} onClick={() => setFlagF("all")} />
        <Kpi icon={<CheckCircle2 size={17} />} tone="success" label="Conferidos nos últimos 7 dias" value={pct(hist.length ? (rev7 / hist.length) * 100 : 0)} foot={`${rev7} de ${hist.length}`} />
        <Kpi icon={<AlertTriangle size={17} />} label="Com alerta" value={hist.filter(alert).length} onClick={() => setFlagF("alerta")} />
        <Kpi icon={<History size={17} />} tone="gold" label="Problemas em 30 dias" value={hist.reduce((a, h) => a + h.problems30, 0)} onClick={() => setFlagF("recorrente")} />
      </div>
      <SearchBox value={sq} onChange={setSq} placeholder="Patrimônio, cliente, bairro, modelo ou vendedor" />
      <div className="chips mb">
        <Chip on={flagF === "alerta"} onClick={() => setFlagF("alerta")}>Com alerta ({hist.filter(alert).length})</Chip>
        {(Object.keys(FZ_FLAGS) as FzFlag[]).map((f) => <Chip key={f} on={flagF === f} onClick={() => setFlagF(f)}>{FZ_FLAGS[f].label} ({hist.filter((h) => h.flags.includes(f)).length})</Chip>)}
        <Chip on={flagF === "all"} onClick={() => setFlagF("all")}>Todos ({hist.length})</Chip>
      </div>
      <Card>
        <div className="list">
          {list.slice(0, lim).map((h) => (
            <div key={h.customer.id + h.asset.patrimony} className="row click" onClick={() => onOpen(h)} style={{ alignItems: "flex-start" }}>
              <span className="fzr-ic"><Snowflake size={18} /></span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="title small">{h.asset.patrimony} · {h.customer.tradeName}</div>
                <div className="sub">{sellerName(h.sellerId)} · {fzName(h.asset)} · última visita {h.lastVisit ? fmtD(h.lastVisit) : "—"} · última conferência {h.lastReviewed ? fmtD(h.lastReviewed.date) : "nunca"}</div>
                {h.flags.length > 0 && <div className="flex" style={{ gap: 4, flexWrap: "wrap", marginTop: 4 }}>{h.flags.map((f) => <Badge key={f} tone={FZ_FLAGS[f].tone}>{FZ_FLAGS[f].label}</Badge>)}</div>}
              </div>
              <div className="end xs muted" style={{ textAlign: "right" }}>{h.reviewed}/{h.visits}<br />conferidos</div>
            </div>
          ))}
        </div>
        {list.length > lim && <button className="btn btn-ghost btn-block mt" onClick={() => setLim(lim + 60)}>Mostrar mais ({list.length - lim})</button>}
        {!list.length && <div className="empty"><div className="ic"><CheckCircle2 /></div>Nenhum freezer neste filtro.</div>}
      </Card>
    </>
  );
}

function FreezerSheet({ s, onClose, onReview }: { s: FreezerSummary; onClose: () => void; onReview: (i: FzItem) => void }) {
  return (
    <Sheet title={`Freezer ${s.asset.patrimony}`} onClose={onClose} icon={<Snowflake size={18} />}>
      <div className="card">
        <dl className="kv">
          <dt>Cliente</dt><dd>{s.customer.tradeName} · {s.customer.district}</dd>
          <dt>Vendedor</dt><dd>{sellerName(s.sellerId)}</dd>
          <dt>Modelo</dt><dd>{fzName(s.asset)} · {s.asset.voltage}</dd>
          <dt>Visitas com vídeo</dt><dd>{s.timeline.filter((i) => i.hasVideo).length} · {s.reviewed} conferidas · {s.problems} com problema</dd>
          <dt>Última conferência</dt><dd>{s.lastReviewed ? `${fmtD(s.lastReviewed.date)} · ${s.lastReviewed.review!.status === "ok" ? "OK" : "problema"}` : "nunca"}</dd>
        </dl>
        {s.flags.length > 0 && <div className="flex mt" style={{ gap: 4, flexWrap: "wrap" }}>{s.flags.map((f) => <Badge key={f} tone={FZ_FLAGS[f].tone}>{FZ_FLAGS[f].label}</Badge>)}</div>}
      </div>
      <Card title="Linha do tempo" icon={<History size={17} />} sub="toque num vídeo para conferir" className="mt">
        <div className="list">
          {s.timeline.map((i) => <FzRow key={i.key} i={i} showDate onClick={() => i.hasVideo && onReview(i)} />)}
          {!s.timeline.length && <div className="small muted">Nenhuma visita registrada para este freezer.</div>}
        </div>
      </Card>
      <PatrimonyHistory patrimony={s.asset.patrimony} />
    </Sheet>
  );
}

