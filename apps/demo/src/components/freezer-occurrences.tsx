/**
 * Ocorrências de freezer (abertas pelo vendedor no atendimento ou no pedido).
 *  A) Perda de produtos  → gestão aprova ou recusa bonificação
 *  B) Defeito no freezer → avaliação (parede/tomada/culpa) → visita técnica → encerramento
 *  C) Outros produtos no freezer Galato → foto + descrição → gestão registra tratativa
 * Toda ocorrência é ligada a um patrimônio e forma o histórico de manutenções dele.
 */
import { useState, type ReactElement } from "react";
import { Plus, AlertOctagon, PackageX, Wrench, Ban, CheckCircle2, XCircle, CalendarClock, Search, QrCode, History } from "lucide-react";
import {
  FREEZER_OCCURRENCES, PRODUCTS, PARAMS, customerById, sellerById, nowStamp, TODAY,
  type Customer, type FreezerOccurrence, type FreezerOccStatus, type FreezerOccType,
} from "../data/mock";
import { notify, MANAGERS_KEYS } from "../data/notify";
import { commit, useStore } from "../data/store";
import { Badge, Card, Chip, Sheet, Stepper, brl } from "./ui";
import { PhotoCapture } from "./photo";

export const OCC_TYPES: Record<FreezerOccType, { label: string; short: string; hint: string; icon: ReactElement }> = {
  perda: { label: "Perda de produtos", short: "Perda", hint: "Queda de energia, pane elétrica… informe os produtos perdidos para a gestão avaliar a bonificação.", icon: <PackageX size={20} /> },
  defeito: { label: "Defeito no freezer", short: "Defeito", hint: "Avalie a instalação, indique se foi culpa do cliente e solicite a visita do técnico.", icon: <Wrench size={20} /> },
  outros_produtos: { label: "Outros produtos no freezer Galato", short: "Outros produtos", hint: "Fotografe e descreva os produtos de outras marcas que estão no freezer.", icon: <Ban size={20} /> },
};

export const OCC_STATUS: Record<FreezerOccStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" | "brand"; open: boolean }> = {
  aguardando_gestor: { label: "Aguardando gestão", tone: "warning", open: true },
  bonificacao_aprovada: { label: "Bonificação aprovada", tone: "success", open: false },
  bonificacao_recusada: { label: "Bonificação recusada", tone: "danger", open: false },
  tecnico_solicitado: { label: "Técnico solicitado", tone: "warning", open: true },
  visita_agendada: { label: "Visita agendada", tone: "info", open: true },
  concluida: { label: "Concluída", tone: "success", open: false },
  tratada: { label: "Tratada pela gestão", tone: "success", open: false },
};

const LOSS_REASONS = ["Queda de energia", "Pane elétrica na região", "Freezer desligado", "Outro"];
const fmtDT = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: PARAMS.timezone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " às");
export const lossValue = (o: FreezerOccurrence) => (o.lostItems ?? []).reduce((a, it) => a + it.qty * it.unitPriceCents, 0);
export const occurrencesOfPatrimony = (pat: string) => FREEZER_OCCURRENCES.filter((o) => o.patrimony === pat).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const managerOf = (sellerId: string) => {
  const s = sellerById.get(sellerId);
  return ["sales_coordinator", "general_manager", ...(s?.managerId === "m1" ? ["sales_manager"] : [])];
};

// ======================================================================= abertura (vendedor)
export function FreezerOccurrenceSheet({ c, onClose }: { c: Customer; onClose: () => void }) {
  const by = sellerById.get(c.sellerId)?.name ?? "Vendedor";
  const [kind, setKind] = useState<FreezerOccType | null>(null);
  const [pat, setPat] = useState<string | null>(c.assets.length === 1 ? c.assets[0]!.patrimony : null);
  // perda
  const [lossReason, setLossReason] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  // defeito
  const [nearWall, setNearWall] = useState<boolean | null>(null);
  const [directOutlet, setDirectOutlet] = useState<boolean | null>(null);
  const [fault, setFault] = useState<boolean | null>(null);
  const [justif, setJustif] = useState("");
  const [defect, setDefect] = useState("");
  // geral
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  const lost = Object.entries(items).filter(([, n]) => n > 0).map(([productId, qty]) => ({ productId, qty, unitPriceCents: PRODUCTS.find((p) => p.id === productId)!.priceCents }));
  const lossTotal = lost.reduce((a, it) => a + it.qty * it.unitPriceCents, 0);
  // culpa do cliente com instalação correta (longe da parede e direto na tomada) exige justificativa
  const needsJustif = fault === true && nearWall === false && directOutlet === true;
  const valid =
    !!kind && !!pat &&
    (kind === "perda" ? !!lossReason && lost.length > 0 :
     kind === "defeito" ? nearWall !== null && directOutlet !== null && fault !== null && defect.trim().length >= 3 && (!needsJustif || justif.trim().length >= 10) :
     !!photo && desc.trim().length >= 5);

  function submit() {
    commit(() => {
      const n = FREEZER_OCCURRENCES.length + 1;
      const base: FreezerOccurrence = {
        id: `fo${Date.now()}`, number: `OF-${String(1000 + n)}`, type: kind!, customerId: c.id, sellerId: c.sellerId, patrimony: pat!,
        createdAt: nowStamp(), status: kind === "defeito" ? "tecnico_solicitado" : "aguardando_gestor", log: [],
        ...(photo ? { photo } : {}),
      };
      if (kind === "perda") Object.assign(base, { lossReason, lostItems: lost, description: desc.trim() || undefined });
      if (kind === "defeito") Object.assign(base, { nearWall, directOutlet, customerFault: fault, faultJustification: justif.trim() || undefined, defect: defect.trim() });
      if (kind === "outros_produtos") Object.assign(base, { description: desc.trim() });
      base.log.push({ at: base.createdAt, by, text: kind === "defeito" ? "Defeito registrado · visita do técnico solicitada" : "Ocorrência aberta · enviada à gestão" });
      FREEZER_OCCURRENCES.unshift(base);
      const what = kind === "perda" ? `perda de ${lost.length} produto(s) · ${brl(lossTotal)} · ${lossReason}` : kind === "defeito" ? `defeito · ${fault ? "culpa do cliente" : "sem culpa do cliente"} · técnico solicitado` : "outros produtos no freezer";
      notify({ link: { t: "occ", id: base.id }, kind: "comercial", priority: "high", title: `Ocorrência de freezer: ${OCC_TYPES[kind!].short}`, text: `${c.tradeName} · patrimônio ${pat} · ${what} · ${by}.`, to: managerOf(c.sellerId) });
    }, `Ocorrência registrada · ${kind === "defeito" ? "visita do técnico solicitada à gestão" : "enviada à gestão"}`);
    onClose();
  }

  const YesNo = ({ value, onChange, yes = "Sim", no = "Não", badYes }: { value: boolean | null; onChange: (v: boolean) => void; yes?: string; no?: string; badYes?: boolean }) => (
    <div className="grid g2" style={{ marginBottom: 0 }}>
      <button className={`route-pick ${value === true ? "on" : ""} ${value === true && badYes ? "bad" : ""}`} onClick={() => onChange(true)}><b>{yes}</b></button>
      <button className={`route-pick ${value === false ? "on" : ""} ${value === false && !badYes ? "bad" : ""}`} onClick={() => onChange(false)}><b>{no}</b></button>
    </div>
  );

  return (
    <Sheet title="Ocorrência de freezer" onClose={onClose} icon={<AlertOctagon size={18} />}>
      <div className="small t2 mb">{c.tradeName} · {c.code}</div>

      <div className="section-title" style={{ marginTop: 0 }}>1. Tipo de ocorrência</div>
      <div className="stack" style={{ gap: 8 }}>
        {(Object.keys(OCC_TYPES) as FreezerOccType[]).map((k) => (
          <button key={k} className={`occ-type ${kind === k ? "on" : ""}`} onClick={() => setKind(k)}>
            <span className="occ-ic">{OCC_TYPES[k].icon}</span>
            <span className="grow"><b>{OCC_TYPES[k].label}</b><span className="xs">{OCC_TYPES[k].hint}</span></span>
          </button>
        ))}
      </div>

      {kind && (
        <>
          <div className="section-title">2. Qual freezer (patrimônio)?</div>
          {c.assets.length === 0 && <div className="small red semi">Este cliente não tem freezer cadastrado. Cadastre o freezer na ficha do cliente antes de abrir a ocorrência.</div>}
          <div className="stack" style={{ gap: 8 }}>
            {c.assets.map((a) => (
              <button key={a.id} className={`occ-type ${pat === a.patrimony ? "on" : ""}`} onClick={() => setPat(a.patrimony)}>
                <span className="occ-ic blue"><QrCode size={18} /></span>
                <span className="grow"><b>Patrimônio {a.patrimony}</b><span className="xs">{a.brand ?? "Gelopar"} · {a.format === "vertical" ? "Vertical" : "Horizontal"} · {a.liters} L · {a.voltage}</span></span>
              </button>
            ))}
          </div>
        </>
      )}

      {kind === "perda" && pat && (
        <>
          <div className="section-title">3. Motivo</div>
          <div className="chips">{LOSS_REASONS.map((r) => <Chip key={r} on={lossReason === r} onClick={() => setLossReason(r)}>{r}</Chip>)}</div>
          <div className="section-title">4. Produtos perdidos</div>
          <div className="search mb"><Search size={17} /><input id="loss-search" className="input" placeholder="Buscar produto" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="list">
            {PRODUCTS.filter((p) => !q || `${p.commercialName} ${p.code}`.toLowerCase().includes(q.toLowerCase())).map((p) => {
              const n = items[p.id] ?? 0;
              return (
                <div key={p.id} className={`product-row ${n ? "in-cart" : ""}`} onClick={() => { if (!n) setItems({ ...items, [p.id]: 1 }); }}>
                  <div className="grow"><div className="title flex" style={{ gap: 6 }}>{p.commercialName}{n > 0 && <span key={n} className="qty-badge">×{n}</span>}</div><div className="sub">{p.packaging} · {brl(p.priceCents)}</div></div>
                  {n === 0
                    ? <button className="step-btn plus add-first" aria-label="Adicionar" onClick={(e) => { e.stopPropagation(); setItems({ ...items, [p.id]: 1 }); }}><Plus size={18} /></button>
                    : <Stepper value={n} onChange={(v) => setItems({ ...items, [p.id]: v })} label={`Perda de ${p.commercialName}`} />}
                </div>
              );
            })}
          </div>
          {lost.length > 0 && <div className="card mt" style={{ padding: 12 }}><div className="flex between"><span className="semi">{lost.length} produto(s) perdido(s)</span><b className="num">{brl(lossTotal)}</b></div></div>}
          <div className="field mt"><label>Observação (opcional)</label><textarea id="loss-note" className="input" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <PhotoCapture value={photo} onChange={setPhoto} label="Foto (opcional)" />
        </>
      )}

      {kind === "defeito" && pat && (
        <>
          <div className="section-title">3. Avaliação da instalação</div>
          <div className="field"><label>O freezer estava próximo da parede (sem ventilação)?</label><YesNo value={nearWall} onChange={setNearWall} badYes /></div>
          <div className="field"><label>O freezer estava ligado direto na tomada (sem extensão)?</label><YesNo value={directOutlet} onChange={setDirectOutlet} /></div>
          <div className="field"><label>Qual o defeito?</label><textarea id="defect" className="input" rows={2} placeholder="Ex.: não gela, barulho no motor, porta não veda…" value={defect} onChange={(e) => setDefect(e.target.value)} /></div>
          <div className="section-title">4. Foi culpa do cliente?</div>
          <YesNo value={fault} onChange={setFault} yes="Sim, culpa do cliente" no="Não foi culpa do cliente" badYes />
          {needsJustif && (
            <div className="field mt">
              <label className="red">Justifique: a instalação estava correta (longe da parede e direto na tomada), mas você marcou culpa do cliente.</label>
              <textarea id="fault-justification" className="input" rows={3} value={justif} onChange={(e) => setJustif(e.target.value)} placeholder="Explique por que foi culpa do cliente" />
            </div>
          )}
          <PhotoCapture value={photo} onChange={setPhoto} label="Foto do freezer (opcional)" />
          <div className="xs muted mt">Ao enviar, a visita do técnico é solicitada à gestão, que combina a data.</div>
        </>
      )}

      {kind === "outros_produtos" && pat && (
        <>
          <div className="section-title">3. Foto dos produtos no freezer</div>
          <PhotoCapture value={photo} onChange={setPhoto} label="Fotografar o freezer" />
          <div className="field mt"><label>Descreva quais produtos de outras marcas (ou outros tipos) estão no freezer</label>
            <textarea id="other-products" className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: picolés da marca X, refrigerantes, gelo…" />
          </div>
        </>
      )}

      <button className="btn btn-primary btn-lg mt" disabled={!valid} onClick={submit}>
        {!kind ? "Escolha o tipo" : !pat ? "Escolha o freezer" : kind === "defeito" ? "Enviar e solicitar técnico" : "Enviar para a gestão"}
      </button>
    </Sheet>
  );
}

// ======================================================================= detalhe + ações
export function OccurrenceDetail({ occ: view, viewer, onClose }: { occ: FreezerOccurrence; viewer: "seller" | "manager"; onClose: () => void }) {
  useStore();
  const o = FREEZER_OCCURRENCES.find((x) => x.id === view.id) ?? view;
  const c = customerById.get(o.customerId)!;
  const asset = c.assets.find((a) => a.patrimony === o.patrimony);
  const st = OCC_STATUS[o.status];
  const [note, setNote] = useState("");
  const [date, setDate] = useState(TODAY);
  const who = viewer === "manager" ? "Gestão" : sellerById.get(o.sellerId)?.name ?? "Vendedor";
  const act = (status: FreezerOccStatus, text: string, toast: string, extra?: () => void) => commit(() => {
    o.status = status; extra?.();
    o.log.push({ at: nowStamp(), by: who, text: note.trim() ? `${text} · ${note.trim()}` : text });
    notify({ link: { t: "occ", id: o.id }, kind: "comercial", title: `Ocorrência ${o.number}: ${OCC_STATUS[status].label}`, text: `${c.tradeName} · patrimônio ${o.patrimony}${note.trim() ? ` · ${note.trim()}` : ""}.`, to: viewer === "manager" ? [`seller:${o.sellerId}`] : managerOf(o.sellerId) });
  }, toast);
  // após a ação volta para a lista (o aviso confirma)
  const act2 = (...args: Parameters<typeof act>) => { act(...args); onClose(); };

  return (
    <Sheet title={`${OCC_TYPES[o.type].label} · ${o.number}`} onClose={onClose} icon={<AlertOctagon size={18} />}>
      <Card>
        <div className="flex between wrap mb" style={{ gap: 6 }}><Badge tone={st.tone}>{st.label}</Badge><span className="xs muted">aberta {fmtDT(o.createdAt)}</span></div>
        <dl className="kv">
          <dt>Cliente</dt><dd>{c.tradeName}</dd>
          <dt>Vendedor</dt><dd>{sellerById.get(o.sellerId)?.name}</dd>
          <dt>Patrimônio</dt><dd>{o.patrimony}{asset ? ` · ${asset.brand ?? "Gelopar"} · ${asset.format === "vertical" ? "Vertical" : "Horizontal"} · ${asset.liters} L` : ""}</dd>
          {o.type === "perda" && <><dt>Motivo</dt><dd>{o.lossReason}</dd><dt>Valor da perda</dt><dd className="num red">{brl(lossValue(o))}</dd></>}
          {o.type === "defeito" && <>
            <dt>Próximo da parede?</dt><dd className={o.nearWall ? "red" : "green"}>{o.nearWall ? "Sim" : "Não"}</dd>
            <dt>Direto na tomada?</dt><dd className={o.directOutlet ? "green" : "red"}>{o.directOutlet ? "Sim" : "Não (extensão)"}</dd>
            <dt>Culpa do cliente?</dt><dd className={o.customerFault ? "red" : "green"}>{o.customerFault ? "Sim" : "Não"}</dd>
            <dt>Defeito</dt><dd>{o.defect}</dd>
            {o.technicianDate && <><dt>Visita do técnico</dt><dd>{new Date(`${o.technicianDate}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</dd></>}
          </>}
        </dl>
        {o.faultJustification && <div className="small mt" style={{ padding: 10, borderRadius: 12, background: "var(--warning-soft)" }}><b>Justificativa:</b> {o.faultJustification}</div>}
        {o.description && <div className="small mt"><b>Descrição:</b> {o.description}</div>}
      </Card>

      {o.type === "perda" && (
        <Card title="Produtos perdidos" className="mt">
          {(o.lostItems ?? []).map((it) => {
            const p = PRODUCTS.find((x) => x.id === it.productId)!;
            return <div key={it.productId} className="row"><span className="grow small semi">{it.qty}× {p.commercialName}</span><span className="num small">{brl(it.qty * it.unitPriceCents)}</span></div>;
          })}
        </Card>
      )}
      {o.photo && <div className="photo-preview mt"><img src={o.photo} alt="Foto da ocorrência" /></div>}

      {st.open && (
        <Card title="Ação" className="mt">
          <div className="field"><label>Comentário (opcional)</label><textarea id="occ-note" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {o.type === "perda" && viewer === "manager" && (
            <div className="grid g2" style={{ marginBottom: 0 }}>
              <button className="btn btn-ghost" onClick={() => act2("bonificacao_recusada", "Bonificação recusada", "Bonificação recusada · vendedor avisado")}><XCircle size={16} /> Recusar</button>
              <button className="btn btn-primary" onClick={() => act2("bonificacao_aprovada", `Bonificação aprovada · ${brl(lossValue(o))}`, "Bonificação aprovada · vendedor avisado")}><CheckCircle2 size={16} /> Aprovar bonificação</button>
            </div>
          )}
          {o.type === "outros_produtos" && viewer === "manager" && (
            <button className="btn btn-primary btn-block" onClick={() => act2("tratada", "Tratativa registrada pela gestão", "Ocorrência tratada · vendedor avisado")}><CheckCircle2 size={16} /> Registrar tratativa</button>
          )}
          {o.type === "defeito" && o.status === "tecnico_solicitado" && viewer === "manager" && (
            <>
              <div className="field"><label>Data da visita do técnico</label><input id="tech-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <button className="btn btn-primary btn-block" onClick={() => act2("visita_agendada", `Visita do técnico agendada para ${new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`, "Visita agendada · vendedor avisado", () => { o.technicianDate = date; })}><CalendarClock size={16} /> Agendar visita do técnico</button>
            </>
          )}
          {o.type === "defeito" && o.status === "visita_agendada" && (
            <button className="btn btn-primary btn-block" onClick={() => act2("concluida", "Técnico realizou a visita · ocorrência encerrada", "Ocorrência encerrada")}><CheckCircle2 size={16} /> Técnico já foi · encerrar</button>
          )}
          {viewer === "seller" && o.status !== "visita_agendada" && <div className="small muted">Aguardando a gestão. Você é avisado no sino quando houver resposta.</div>}
        </Card>
      )}

      <Card title="Linha do tempo" className="mt">
        <div className="timeline">
          {[...o.log].reverse().map((e, i) => (
            <div key={i} className={`tl-item ${i === 0 ? "" : "done"}`}>
              <div className="flex between wrap" style={{ gap: 6 }}><span className="semi">{e.text}</span><span className="small num">{fmtDT(e.at)}</span></div>
              <div className="xs muted">{e.by}</div>
            </div>
          ))}
        </div>
      </Card>
      <PatrimonyHistory patrimony={o.patrimony} exceptId={o.id} />
    </Sheet>
  );
}

/** Histórico de manutenções/ocorrências de um patrimônio. */
export function PatrimonyHistory({ patrimony, exceptId }: { patrimony: string; exceptId?: string }) {
  const list = occurrencesOfPatrimony(patrimony).filter((o) => o.id !== exceptId);
  if (!list.length) return null;
  return (
    <Card title={`Histórico do patrimônio ${patrimony}`} icon={<History size={16} />} className="mt">
      {list.map((o) => (
        <div key={o.id} className="row">
          <Badge tone={OCC_STATUS[o.status].tone}>{OCC_TYPES[o.type].short}</Badge>
          <div className="grow"><div className="title small">{o.number} · {OCC_STATUS[o.status].label}</div><div className="sub">{fmtDT(o.createdAt)}{o.type === "defeito" ? ` · ${o.defect}` : ""}</div></div>
        </div>
      ))}
    </Card>
  );
}

// ======================================================================= listas
export function OccurrenceRow({ o, onClick }: { o: FreezerOccurrence; onClick: () => void }) {
  const c = customerById.get(o.customerId);
  const st = OCC_STATUS[o.status];
  return (
    <div className="order-row click" onClick={onClick}>
      <div className="flex between" style={{ gap: 8 }}>
        <span className="semi flex" style={{ gap: 6 }}><span className="occ-mini">{OCC_TYPES[o.type].icon}</span>{OCC_TYPES[o.type].short} · {o.number}</span>
        {o.type === "perda" && <b className="num">{brl(lossValue(o))}</b>}
      </div>
      <div className="order-customer" style={{ marginTop: 3 }}>{c?.tradeName}</div>
      <div className="flex between wrap" style={{ gap: 6, marginTop: 5 }}>
        <span className="xs muted">Patrimônio {o.patrimony} · {sellerById.get(o.sellerId)?.name.split(" ")[0]} · {fmtDT(o.createdAt)}</span>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
    </div>
  );
}

/** Aba da gestão: todas as ocorrências de freezer da equipe. */
export function ManagerFreezerOccurrences({ scope }: { scope: string[] }) {
  useStore();
  const [f, setF] = useState<"open" | "all" | FreezerOccType>("open");
  const [open, setOpen] = useState<FreezerOccurrence | null>(null);
  const all = FREEZER_OCCURRENCES.filter((o) => scope.includes(o.sellerId));
  const list = all.filter((o) => f === "all" || (f === "open" ? OCC_STATUS[o.status].open : o.type === f));
  return (
    <>
      <h2 style={{ margin: "6px 0 4px" }}>Ocorrências de freezer</h2>
      <p className="small muted mb">Abertas pelos vendedores: perda de produtos (bonificação), defeito (visita técnica) e outros produtos no freezer.</p>
      <div className="chips mb">
        <Chip on={f === "open"} onClick={() => setF("open")}>Pendentes ({all.filter((o) => OCC_STATUS[o.status].open).length})</Chip>
        {(Object.keys(OCC_TYPES) as FreezerOccType[]).map((k) => <Chip key={k} on={f === k} onClick={() => setF(k)}>{OCC_TYPES[k].short} ({all.filter((o) => o.type === k).length})</Chip>)}
        <Chip on={f === "all"} onClick={() => setF("all")}>Todas ({all.length})</Chip>
      </div>
      <Card>
        <div className="list">{list.map((o) => <OccurrenceRow key={o.id} o={o} onClick={() => setOpen(o)} />)}</div>
        {!list.length && <div className="empty"><div className="ic"><CheckCircle2 /></div>Nenhuma ocorrência neste filtro.</div>}
      </Card>
      {open && <OccurrenceDetail occ={open} viewer="manager" onClose={() => setOpen(null)} />}
    </>
  );
}

