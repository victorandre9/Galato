/**
 * Prospecção: do pré-cadastro até virar cliente.
 * Vendedor conduz as etapas; financeiro aprova o cadastro; gerente acompanha o funil.
 */
import { useState } from "react";
import {
  UserPlus, Phone, MessageCircle, Building2, RotateCcw, XCircle, CheckCircle2, ClipboardCheck, Send, Calculator,
  Filter, History, Target, Search, Clock, Users, ChevronRight,
} from "lucide-react";
import { classifyAbcd, addDays, daysBetween } from "@galato/domain";
import { PARAMS, PRODUCTS, SELLERS, TODAY, CURRENT_SELLER, FINANCE_USER, customerById, sellerById, nowStamp, type Role } from "../data/mock";
import {
  LEADS, STAGES, OPEN_STAGES, stageOf, BUSINESS_TYPES, BRANDS, PRODUCT_MIX, SWITCH_REASONS, LOST_REASONS, CONTACT_RESULTS,
  leadToCustomer, type Lead, type LeadStage,
} from "../data/leads";
import { notify, MANAGERS_KEYS } from "../data/notify";
import { commit, useStore } from "../data/store";
import { Card, Kpi, Sheet, Badge, Chip, Curve, Empty, Progress, Stepper, ColsHead, brl, brl0, pct } from "./ui";
import { CustomerSheet, fmtDateTime } from "./business";

type Viewer = "seller" | "manager" | "finance";
const fmtDay = (d?: string) => (d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");
const sellerName = (id: string) => sellerById.get(id)?.name ?? "Vendedor";
const log = (l: Lead, by: string, text: string) => l.log.push({ at: nowStamp(), by, text });
const stageIdx = (s: LeadStage) => ["lead", "contato", "qualificacao", "proposta", "negociacao", "cadastro", "cliente"].indexOf(s);
export const leadsOf = (scope: string[]) => LEADS.filter((l) => scope.includes(l.sellerId));
export const pendingCadastros = () => LEADS.filter((l) => l.stage === "cadastro" && l.cadastro?.sentAt && l.cadastro.status === "pendente");
const daysOpen = (l: Lead) => Math.max(0, daysBetween(l.createdAt.slice(0, 10), TODAY));

const MONTHLY = [
  { label: "até R$ 600", cents: 50_000 }, { label: "R$ 600 a 1.500", cents: 100_000 },
  { label: "R$ 1.500 a 3.000", cents: 220_000 }, { label: "acima de R$ 3.000", cents: 420_000 },
];

function MultiChips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {options.map((o) => <Chip key={o} on={value.includes(o)} onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}>{o}</Chip>)}
    </div>
  );
}
function OneChips<T extends string | number>({ options, value, onChange, label }: { options: T[]; value: T | null; onChange: (v: T) => void; label?: (v: T) => string }) {
  return <div className="chips">{options.map((o) => <Chip key={String(o)} on={value === o} onClick={() => onChange(o)}>{label ? label(o) : String(o)}</Chip>)}</div>;
}
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="field"><label>{label}</label>{children}</div>;

export function StageBadge({ s }: { s: LeadStage }) {
  const st = stageOf(s);
  return <Badge tone={st.tone}>{st.label}</Badge>;
}

/** Linha da lista de prospecção. */
export function LeadRow({ l, onClick, showSeller }: { l: Lead; onClick: () => void; showSeller?: boolean }) {
  const late = l.nextAt && l.nextAt < TODAY && OPEN_STAGES.includes(l.stage);
  return (
    <div className="row click" onClick={onClick}>
      <span className="ic-round"><Building2 size={16} /></span>
      <div className="grow">
        <div className="title">{l.name} {l.score && <Curve c={l.score} />}</div>
        <div className="sub">{[l.type, l.district].filter(Boolean).join(" · ")}{showSeller ? ` · ${sellerName(l.sellerId).split(" ")[0]}` : ""}{l.nextAt && OPEN_STAGES.includes(l.stage) ? ` · próximo passo ${l.nextAt === TODAY ? "hoje" : fmtDay(l.nextAt)}` : ""}</div>
      </div>
      <div className="end">
        <StageBadge s={l.stage} />
        <div className={`sub xs ${late ? "red" : "muted"}`}>{late ? "atrasado" : `${daysOpen(l)} dias`}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pré-cadastro
export function LeadForm({ onClose, onSaved, sellerId = CURRENT_SELLER.id }: { onClose: () => void; onSaved?: (l: Lead) => void; sellerId?: string }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const ok = name.trim().length > 2 && phone.replace(/\D/g, "").length >= 10 && !!type;
  const save = () => {
    const by = sellerName(sellerId);
    const l: Lead = {
      id: `ld${Date.now().toString(36)}`, sellerId, createdAt: nowStamp(), stage: "lead", name: name.trim(), contact: contact.trim(),
      phone, address: address.trim(), district: district.trim(), type: type!, nextAt: TODAY, nextStep: "Fazer o 1º contato",
      log: [{ at: nowStamp(), by, text: "Pré-cadastro criado" }], ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    commit(() => { LEADS.unshift(l); }, `${l.name} entrou na prospecção`);
    onSaved?.(l);
    onClose();
  };
  return (
    <Sheet title="Novo cliente · pré-cadastro" onClose={onClose} icon={<UserPlus size={18} />}>
      <p className="small muted mb">Só o básico para começar. CNPJ e dados fiscais ficam para quando o cliente fechar.</p>
      <Field label="Nome do estabelecimento"><input id="lead-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Padaria Pão Quente" /></Field>
      <Field label="Responsável"><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Quem decide a compra" /></Field>
      <Field label="Telefone / WhatsApp"><input id="lead-phone" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(31) 99999-0000" /></Field>
      <Field label="Endereço"><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua e número" /></Field>
      <Field label="Bairro"><input className="input" value={district} onChange={(e) => setDistrict(e.target.value)} /></Field>
      <Field label="Tipo de negócio"><OneChips options={BUSINESS_TYPES} value={type} onChange={setType} /></Field>
      <Field label="Observação (opcional)"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <button className="btn btn-primary btn-block" disabled={!ok} onClick={save}><UserPlus size={16} /> Salvar pré-cadastro</button>
      {!ok && <p className="xs muted mt">Preencha nome, telefone e tipo de negócio.</p>}
    </Sheet>
  );
}

// ---------------------------------------------------------------- ficha do prospect
export function LeadSheet({ lead, viewer, onClose }: { lead: Lead; viewer: Viewer; onClose: () => void }) {
  useStore();
  const l = LEADS.find((x) => x.id === lead.id) ?? lead;
  const [step, setStep] = useState<null | "contato" | "quali" | "proposta" | "negocia" | "cadastro" | "perdido" | "quote" | "approve" | "refuse" | "fix">(null);
  const [cust, setCust] = useState(false);
  const st = stageOf(l.stage);
  const by = viewer === "finance" ? FINANCE_USER.name : sellerName(l.sellerId);
  const canAct = viewer === "seller";
  const idx = stageIdx(l.stage);
  const c = l.customerId ? customerById.get(l.customerId) : undefined;
  if (cust && c) return <CustomerSheet c={c} viewerSellerId={viewer === "seller" ? CURRENT_SELLER.id : undefined} onClose={() => setCust(false)} />;
  const back = () => setStep(null);
  if (step === "contato") return <ContactForm l={l} by={by} onClose={back} />;
  if (step === "quali") return <QualiForm l={l} by={by} onClose={back} />;
  if (step === "proposta") return <ProposalForm l={l} by={by} onClose={back} />;
  if (step === "negocia") return <NoteForm l={l} by={by} title="Negociação" label="O que o cliente pediu?" placeholder="Ex.: prazo de 21 dias, freezer maior…" cta="Registrar negociação" onSave={(t) => { l.stage = "negociacao"; l.nextAt = addDays(TODAY, 2); log(l, by, `Em negociação · ${t}`); }} onClose={back} />;
  if (step === "cadastro") return <CadastroForm l={l} by={by} onClose={back} />;
  if (step === "perdido") return <LostForm l={l} by={by} onClose={back} />;
  if (step === "quote") return <LeadQuote l={l} by={by} onClose={back} />;
  if (step === "approve") return <ApproveForm l={l} onClose={back} onDone={onClose} />;
  if (step === "refuse") return <NoteForm l={l} by={by} title="Recusar cadastro" label="Motivo da recusa" placeholder="Ex.: CNPJ com restrição" cta="Recusar cadastro" danger onSave={(t) => {
    l.cadastro!.status = "recusado"; l.cadastro!.reply = t; l.stage = "perdido"; l.lostReason = "Cadastro recusado pelo financeiro"; l.retryAt = addDays(TODAY, 90);
    log(l, by, `Cadastro recusado · ${t}`);
    notify({ link: { t: "lead", id: l.id }, kind: "financeiro", priority: "high", title: "Cadastro recusado", text: `${l.name} · ${t}`, to: [`seller:${l.sellerId}`, ...MANAGERS_KEYS] });
  }} onClose={onClose} />;
  if (step === "fix") return <NoteForm l={l} by={by} title="Pedir correção" label="O que precisa corrigir?" placeholder="Ex.: inscrição estadual não confere" cta="Devolver ao vendedor" onSave={(t) => {
    l.cadastro!.status = "correcao"; l.cadastro!.reply = t; log(l, by, `Financeiro pediu correção · ${t}`);
    notify({ link: { t: "lead", id: l.id }, kind: "financeiro", priority: "high", title: "Cadastro precisa de correção", text: `${l.name} · ${t}`, to: [`seller:${l.sellerId}`] });
  }} onClose={onClose} />;

  const wa = `https://wa.me/55${l.phone.replace(/\D/g, "")}`;
  return (
    <Sheet title={l.name} onClose={onClose} icon={<Building2 size={18} />}>
      <div className="card">
        <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <StageBadge s={l.stage} />
          {l.score && <span className="small">Potencial <Curve c={l.score} /></span>}
        </div>
        {l.stage !== "perdido" && <div className="mt"><Progress value={((Math.max(0, idx) + 1) / 7) * 100} color={l.stage === "cliente" ? "green" : undefined} /></div>}
        <div className="chips mt" style={{ flexWrap: "wrap" }}>
          {STAGES.filter((s) => s.id !== "perdido").map((s, i) => <span key={s.id} className={`xs ${i <= idx ? "bold" : "muted"}`}>{i + 1}. {s.label}{i < 6 ? " ›" : ""}</span>)}
        </div>
        <div className="divider" />
        <div className="small"><b>Próximo passo:</b> {l.stage === "perdido" ? `tentar de novo em ${fmtDay(l.retryAt)}` : l.stage === "cadastro" && l.cadastro?.status === "correcao" ? "corrigir o cadastro e reenviar" : l.stage === "cadastro" && !l.cadastro?.sentAt ? "completar o cadastro e enviar ao financeiro" : (l.nextStep ?? st.next)}{l.nextAt && OPEN_STAGES.includes(l.stage) ? ` · ${l.nextAt === TODAY ? "hoje" : fmtDay(l.nextAt)}` : ""}</div>
        {l.cadastro?.reply && <div className="small mt red">Financeiro: {l.cadastro.reply}</div>}
      </div>

      <div className="card mt">
        <dl className="kv">
          <dt>Responsável</dt><dd>{l.contact || "—"}</dd>
          <dt>Telefone</dt><dd>{l.phone}</dd>
          <dt>Endereço</dt><dd>{[l.address, l.district].filter(Boolean).join(" · ") || "—"}</dd>
          <dt>Tipo</dt><dd>{l.type}</dd>
          <dt>Vendedor</dt><dd>{sellerName(l.sellerId)}</dd>
          <dt>Na prospecção há</dt><dd>{daysOpen(l)} dias</dd>
          {l.quali && <><dt>Marca atual</dt><dd>{l.quali.brand}</dd><dt>Freezer</dt><dd>{l.quali.freezer === "concorrente" ? `${l.quali.freezers} do concorrente` : l.quali.freezer === "proprio" ? `${l.quali.freezers} próprio(s)` : "não tem"}</dd>
            <dt>Compra estimada</dt><dd>{brl0(l.quali.monthlyCents)}/mês · {l.quali.freq}</dd><dt>Mix</dt><dd>{l.quali.mix.join(", ")}</dd><dt>Trocaria por</dt><dd>{l.quali.switchReason.join(", ")}</dd></>}
          {l.proposal && <><dt>Proposta</dt><dd>{brl0(l.proposal.valueCents)}/mês · prazo {l.proposal.termDays ? `${l.proposal.termDays} dias` : "à vista"}{l.proposal.comodato ? " · freezer em comodato" : ""}</dd></>}
          {l.quote && <><dt>Orçamento rápido</dt><dd>{brl(l.quote.totalCents)} · {l.quote.items.length} itens</dd></>}
          {l.cadastro && <><dt>CNPJ</dt><dd>{l.cadastro.cnpj}</dd><dt>Razão social</dt><dd>{l.cadastro.legalName}</dd><dt>IE</dt><dd>{l.cadastro.ie}</dd><dt>Entrega</dt><dd>{l.cadastro.deliveryAddress} · {l.cadastro.cep}</dd><dt>Rota</dt><dd>{l.cadastro.routeCode}</dd></>}
          {l.stage === "perdido" && <><dt>Motivo da perda</dt><dd>{l.lostReason}</dd><dt>Tentar de novo</dt><dd>{fmtDay(l.retryAt)}</dd></>}
          {l.notes && <><dt>Observação</dt><dd>{l.notes}</dd></>}
        </dl>
      </div>

      {canAct && (
        <div className="stack mt">
          {l.stage === "lead" && <button className="btn btn-primary btn-block" onClick={() => setStep("contato")}><Phone size={16} /> Registrar 1º contato</button>}
          {l.stage === "contato" && <button className="btn btn-primary btn-block" onClick={() => setStep("quali")}><Target size={16} /> Qualificar cliente</button>}
          {l.stage === "qualificacao" && <button className="btn btn-primary btn-block" onClick={() => setStep("proposta")}><ClipboardCheck size={16} /> Montar proposta</button>}
          {l.stage === "proposta" && <div className="grid g2" style={{ marginBottom: 0 }}>
            <button className="btn btn-ghost" onClick={() => setStep("negocia")}>Cliente quer negociar</button>
            <button className="btn btn-primary" onClick={() => commit(() => { l.stage = "cadastro"; l.nextStep = "Completar o cadastro"; log(l, by, "Cliente aceitou a proposta"); }, "Proposta aceita · complete o cadastro")}>Cliente aceitou</button>
          </div>}
          {l.stage === "negociacao" && <div className="grid g2" style={{ marginBottom: 0 }}>
            <button className="btn btn-ghost" onClick={() => setStep("proposta")}>Ajustar proposta</button>
            <button className="btn btn-primary" onClick={() => commit(() => { l.stage = "cadastro"; l.nextStep = "Completar o cadastro"; log(l, by, "Negociação fechada"); }, "Fechado · complete o cadastro")}>Fechou negócio</button>
          </div>}
          {l.stage === "cadastro" && (!l.cadastro?.sentAt || l.cadastro.status === "correcao") && <button className="btn btn-primary btn-block" onClick={() => setStep("cadastro")}><Send size={16} /> {l.cadastro?.status === "correcao" ? "Corrigir e reenviar" : "Completar cadastro e enviar ao financeiro"}</button>}
          {l.stage === "cadastro" && l.cadastro?.sentAt && l.cadastro.status === "pendente" && <div className="alert-line"><Clock size={15} /> Cadastro com o financeiro desde {fmtDateTime(l.cadastro.sentAt)}</div>}
          {l.stage === "cliente" && c && <button className="btn btn-primary btn-block" onClick={() => setCust(true)}><CheckCircle2 size={16} /> Abrir ficha do cliente</button>}
          {l.stage === "perdido" && <button className="btn btn-primary btn-block" onClick={() => commit(() => { l.stage = "contato"; l.nextAt = TODAY; l.nextStep = "Retomar contato"; delete l.lostReason; delete l.retryAt; if (l.cadastro) delete l.cadastro.status; log(l, by, "Prospecção reaberta"); }, `${l.name} reaberto`)}><RotateCcw size={16} /> Reabrir prospecção</button>}
          {OPEN_STAGES.includes(l.stage) && <div className="grid g2" style={{ marginBottom: 0 }}>
            <button className="btn btn-ghost" onClick={() => setStep("quote")}><Calculator size={16} /> Orçamento rápido</button>
            <a className="btn btn-ghost" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>
          </div>}
          {OPEN_STAGES.includes(l.stage) && <button className="btn btn-ghost btn-block" onClick={() => setStep("perdido")}><XCircle size={16} /> Marcar como perdido</button>}
        </div>
      )}
      {viewer === "finance" && l.stage === "cadastro" && l.cadastro?.status === "pendente" && (
        <div className="stack mt">
          <button className="btn btn-primary btn-block" onClick={() => setStep("approve")}><CheckCircle2 size={16} /> Aprovar e criar cliente</button>
          <div className="grid g2" style={{ marginBottom: 0 }}>
            <button className="btn btn-ghost" onClick={() => setStep("fix")}>Pedir correção</button>
            <button className="btn btn-danger" onClick={() => setStep("refuse")}>Recusar</button>
          </div>
        </div>
      )}
      {viewer !== "seller" && l.stage === "cliente" && c && <button className="btn btn-ghost btn-block mt" onClick={() => setCust(true)}>Abrir ficha do cliente</button>}

      <div className="card mt">
        <div className="card-title"><span className="ic"><History size={16} /></span><span>Histórico</span></div>
        <div className="list">
          {[...l.log].reverse().map((e, i) => (
            <div key={i} className="row"><div className="grow"><div className="small">{e.text}</div><div className="sub xs">{fmtDateTime(e.at)} · {e.by}</div></div></div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function ContactForm({ l, by, onClose }: { l: Lead; by: string; onClose: () => void }) {
  const [res, setRes] = useState<string | null>(null);
  const [next, setNext] = useState(addDays(TODAY, 2));
  const [note, setNote] = useState("");
  return (
    <Sheet title={`1º contato · ${l.name}`} onClose={onClose} icon={<Phone size={18} />}>
      <Field label="Como foi?"><OneChips options={CONTACT_RESULTS} value={res} onChange={setRes} /></Field>
      <Field label="Próximo passo em"><input type="date" className="input" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      <Field label="Anotação (opcional)"><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <button className="btn btn-primary btn-block" disabled={!res} onClick={() => {
        commit(() => { l.stage = "contato"; l.nextAt = next; l.nextStep = "Qualificar: marca, freezer e volume"; log(l, by, `1º contato · ${res}${note ? ` · ${note}` : ""}`); }, "Contato registrado");
        onClose();
      }}>Salvar contato</button>
    </Sheet>
  );
}

function QualiForm({ l, by, onClose }: { l: Lead; by: string; onClose: () => void }) {
  const q = l.quali;
  const [brand, setBrand] = useState<string | null>(q?.brand ?? null);
  const [fz, setFz] = useState<"proprio" | "concorrente" | "nao" | null>(q?.freezer ?? null);
  const [n, setN] = useState(q?.freezers ?? 1);
  const [monthly, setMonthly] = useState<number | null>(q?.monthlyCents ?? null);
  const [freq, setFreq] = useState<string | null>(q?.freq ?? null);
  const [mix, setMix] = useState<string[]>(q?.mix ?? []);
  const [why, setWhy] = useState<string[]>(q?.switchReason ?? []);
  const score = monthly !== null ? classifyAbcd(monthly, PARAMS.abcd.rules) : null;
  const ok = brand && fz && monthly !== null && freq && mix.length;
  return (
    <Sheet title={`Qualificação · ${l.name}`} onClose={onClose} icon={<Target size={18} />}>
      <Field label="Marca que vende hoje"><OneChips options={BRANDS} value={brand} onChange={setBrand} /></Field>
      <Field label="Freezer"><OneChips options={["concorrente", "proprio", "nao"] as const} value={fz} onChange={setFz} label={(v) => v === "concorrente" ? "Do concorrente" : v === "proprio" ? "Próprio" : "Não tem"} /></Field>
      {fz && fz !== "nao" && <Field label="Quantos freezers"><Stepper value={n} min={1} onChange={setN} /></Field>}
      <Field label="Compra estimada por mês"><OneChips options={MONTHLY.map((m) => m.cents)} value={monthly} onChange={setMonthly} label={(v) => MONTHLY.find((m) => m.cents === v)!.label} /></Field>
      <Field label="Frequência de compra"><OneChips options={["Semanal", "Quinzenal", "Mensal"]} value={freq} onChange={setFreq} /></Field>
      <Field label="Mix que vende"><MultiChips options={PRODUCT_MIX} value={mix} onChange={setMix} /></Field>
      <Field label="O que faria trocar de fornecedor"><MultiChips options={SWITCH_REASONS} value={why} onChange={setWhy} /></Field>
      {score && <div className="card mb small">Potencial calculado: <Curve c={score} /> · pela compra estimada de {brl0(monthly!)}/mês</div>}
      <button className="btn btn-primary btn-block" disabled={!ok} onClick={() => {
        commit(() => {
          l.quali = { brand: brand!, freezer: fz!, freezers: fz === "nao" ? 0 : n, monthlyCents: monthly!, freq: freq!, mix, switchReason: why };
          l.score = score!; if (stageIdx(l.stage) < 2) l.stage = "qualificacao"; l.nextAt = addDays(TODAY, 2); l.nextStep = "Montar a proposta";
          log(l, by, `Qualificado · trabalha com ${brand} · potencial ${score}`);
        }, `Qualificado · potencial ${score}`);
        onClose();
      }}>Salvar qualificação</button>
    </Sheet>
  );
}

function ProposalForm({ l, by, onClose }: { l: Lead; by: string; onClose: () => void }) {
  const [value, setValue] = useState(String(Math.round((l.proposal?.valueCents ?? (l.quali?.monthlyCents ?? 100_000) * 0.6) / 100)));
  const [term, setTerm] = useState<number | null>(l.proposal?.termDays ?? 14);
  const [com, setCom] = useState(l.proposal?.comodato ?? l.quali?.freezer !== "proprio");
  const [note, setNote] = useState(l.proposal?.note ?? "");
  const cents = Math.round(Number(value.replace(/\D/g, "")) * 100);
  return (
    <Sheet title={`Proposta · ${l.name}`} onClose={onClose} icon={<ClipboardCheck size={18} />}>
      <Field label="Compra mensal prevista (R$)"><input className="input" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
      <Field label="Prazo de pagamento"><OneChips options={[0, 7, 14, 21]} value={term} onChange={setTerm} label={(d) => d ? `${d} dias` : "À vista/PIX"} /></Field>
      <Field label="Freezer em comodato"><OneChips options={["sim", "nao"]} value={com ? "sim" : "nao"} onChange={(v) => setCom(v === "sim")} label={(v) => v === "sim" ? "Sim, emprestar freezer" : "Não precisa"} /></Field>
      <Field label="Condições (opcional)"><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: 1º pedido com 5% de desconto" /></Field>
      <button className="btn btn-primary btn-block" disabled={!cents || term === null} onClick={() => {
        commit(() => {
          l.proposal = { valueCents: cents, comodato: com, termDays: term!, ...(note ? { note } : {}) };
          if (stageIdx(l.stage) < 3) l.stage = "proposta"; l.nextAt = addDays(TODAY, 3); l.nextStep = "Aguardar a resposta do cliente";
          log(l, by, `Proposta · ${brl0(cents)}/mês · ${term ? `${term} dias` : "à vista"}${com ? " · comodato" : ""}`);
        }, "Proposta registrada");
        onClose();
      }}>Salvar proposta</button>
    </Sheet>
  );
}

function NoteForm({ l, title, label, placeholder, cta, onSave, onClose, danger }: { l: Lead; by: string; title: string; label: string; placeholder: string; cta: string; onSave: (t: string) => void; onClose: () => void; danger?: boolean }) {
  const [t, setT] = useState("");
  return (
    <Sheet title={`${title} · ${l.name}`} onClose={onClose}>
      <Field label={label}><textarea className="input" rows={3} value={t} onChange={(e) => setT(e.target.value)} placeholder={placeholder} /></Field>
      <button className={`btn ${danger ? "btn-danger" : "btn-primary"} btn-block`} disabled={t.trim().length < 3} onClick={() => { commit(() => onSave(t.trim()), `${title} · registrado`); onClose(); }}>{cta}</button>
    </Sheet>
  );
}

function CadastroForm({ l, by, onClose }: { l: Lead; by: string; onClose: () => void }) {
  const k = l.cadastro;
  const [cnpj, setCnpj] = useState(k?.cnpj ?? "");
  const [legal, setLegal] = useState(k?.legalName ?? "");
  const [ie, setIe] = useState(k?.ie ?? "");
  const [cep, setCep] = useState(k?.cep ?? "");
  const [addr, setAddr] = useState(k?.deliveryAddress ?? l.address);
  const [route, setRoute] = useState(k?.routeCode ?? PARAMS.commercialRoutes[0]!.code);
  const [found, setFound] = useState(false);
  const digits = cnpj.replace(/\D/g, "");
  const lookup = () => {
    // consulta simulada da Receita
    setLegal(`${l.name.toUpperCase()} LTDA`); setIe(String(100000 + (Number(digits.slice(-5)) || 4321))); setCep(cep || "30140-000"); if (!addr.trim()) setAddr(`Rua da Bahia, ${100 + (Number(digits.slice(-3)) || 0)}`); setFound(true);
  };
  const ok = digits.length === 14 && legal.trim() && ie.trim() && addr.trim();
  return (
    <Sheet title={`Cadastro · ${l.name}`} onClose={onClose} icon={<Building2 size={18} />}>
      {k?.reply && <div className="alert-line mb"><span className="dotc" style={{ background: "var(--danger)" }} />Financeiro pediu: {k.reply}</div>}
      <Field label="CNPJ">
        <div className="flex" style={{ gap: 8 }}>
          <input id="lead-cnpj" className="input" inputMode="numeric" value={cnpj} onChange={(e) => { setCnpj(e.target.value); setFound(false); }} placeholder="00.000.000/0001-00" />
          <button className="btn btn-soft" disabled={digits.length !== 14} onClick={lookup}><Search size={15} /> Buscar</button>
        </div>
      </Field>
      {found && <p className="xs green mb">Dados encontrados na Receita (simulação).</p>}
      <Field label="Razão social"><input className="input" value={legal} onChange={(e) => setLegal(e.target.value)} /></Field>
      <Field label="Inscrição estadual"><input className="input" value={ie} onChange={(e) => setIe(e.target.value)} /></Field>
      <Field label="CEP"><input className="input" inputMode="numeric" value={cep} onChange={(e) => setCep(e.target.value)} /></Field>
      <Field label="Endereço de entrega"><input className="input" value={addr} onChange={(e) => setAddr(e.target.value)} /></Field>
      <Field label="Rota comercial">
        <select className="input" value={route} onChange={(e) => setRoute(e.target.value)}>
          {PARAMS.commercialRoutes.map((r) => <option key={r.code} value={r.code}>{r.name} · {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][r.weekday]}</option>)}
        </select>
      </Field>
      <button className="btn btn-primary btn-block" disabled={!ok} onClick={() => {
        commit(() => {
          l.cadastro = { cnpj, legalName: legal.trim(), ie: ie.trim(), cep, deliveryAddress: addr.trim(), routeCode: route, sentAt: nowStamp(), status: "pendente" };
          l.stage = "cadastro"; l.nextStep = "Aguardando aprovação do financeiro"; delete l.nextAt;
          log(l, by, k?.status === "correcao" ? "Cadastro corrigido e reenviado ao financeiro" : "Cadastro completo enviado ao financeiro");
          notify({ link: { t: "lead", id: l.id }, kind: "financeiro", priority: "high", title: "Cadastro de cliente novo", text: `${l.name} · ${by} · aguarda aprovação e limite.`, to: ["finance"] });
          notify({ link: { t: "lead", id: l.id }, kind: "comercial", title: "Cliente novo em cadastro", text: `${l.name} (${by}) foi enviado ao financeiro.`, to: MANAGERS_KEYS });
        }, "Cadastro enviado ao financeiro");
        onClose();
      }}><Send size={16} /> Enviar ao financeiro</button>
    </Sheet>
  );
}

function LostForm({ l, by, onClose }: { l: Lead; by: string; onClose: () => void }) {
  const [r, setR] = useState<string | null>(null);
  const [retry, setRetry] = useState(addDays(TODAY, 60));
  return (
    <Sheet title={`Perdido · ${l.name}`} onClose={onClose} icon={<XCircle size={18} />}>
      <Field label="Motivo"><OneChips options={LOST_REASONS} value={r} onChange={setR} /></Field>
      <Field label="Tentar de novo em"><input type="date" className="input" value={retry} onChange={(e) => setRetry(e.target.value)} /></Field>
      <button className="btn btn-danger btn-block" disabled={!r} onClick={() => {
        commit(() => { l.stage = "perdido"; l.lostReason = r!; l.retryAt = retry; delete l.nextAt; log(l, by, `Perdido · ${r}`); }, `${l.name} marcado como perdido`);
        onClose();
      }}>Marcar como perdido</button>
    </Sheet>
  );
}

function LeadQuote({ l, by, onClose }: { l: Lead; by: string; onClose: () => void }) {
  const [items, setItems] = useState<Record<string, number>>(() => Object.fromEntries((l.quote?.items ?? []).map((i) => [i.productId, i.qty])));
  const [q, setQ] = useState("");
  const list = PRODUCTS.filter((p) => p.active && `${p.commercialName} ${p.category}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  const total = Object.entries(items).reduce((s, [id, n]) => s + n * (PRODUCTS.find((p) => p.id === id)?.priceCents ?? 0), 0);
  const chosen = Object.entries(items).filter(([, n]) => n > 0);
  const text = encodeURIComponent(`Orçamento Galato Sorvetes · ${l.name}\n${chosen.map(([id, n]) => `${n}x ${PRODUCTS.find((p) => p.id === id)?.commercialName}`).join("\n")}\nTotal: ${brl(total)}`);
  return (
    <Sheet title={`Orçamento rápido · ${l.name}`} onClose={onClose} icon={<Calculator size={18} />}>
      <p className="small muted mb">Preço de tabela, sem precisar de cadastro. Vira pedido quando o cliente for aprovado.</p>
      <div className="search mb"><Search size={17} /><input className="input" placeholder="Buscar produto" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="list">
        {list.map((p) => (
          <div key={p.id} className="row">
            <div className="grow"><div className="title small">{p.commercialName}</div><div className="sub">{p.packaging} · {brl(p.priceCents)}</div></div>
            <Stepper size="sm" value={items[p.id] ?? 0} onChange={(v) => setItems((x) => ({ ...x, [p.id]: v }))} />
          </div>
        ))}
      </div>
      <div className="card mt flex" style={{ justifyContent: "space-between" }}><b>Total</b><b className="num">{brl(total)}</b></div>
      <div className="grid g2 mt" style={{ marginBottom: 0 }}>
        <a className={`btn btn-ghost ${total ? "" : "disabled"}`} href={`https://wa.me/55${l.phone.replace(/\D/g, "")}?text=${text}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Enviar</a>
        <button className="btn btn-primary" disabled={!total} onClick={() => {
          commit(() => { l.quote = { items: chosen.map(([productId, qty]) => ({ productId, qty })), totalCents: total }; log(l, by, `Orçamento rápido · ${brl(total)}`); }, "Orçamento salvo no prospect");
          onClose();
        }}>Salvar</button>
      </div>
    </Sheet>
  );
}

function ApproveForm({ l, onClose, onDone }: { l: Lead; onClose: () => void; onDone: () => void }) {
  const sug = Math.max(100_000, Math.round(((l.proposal?.valueCents ?? l.quali?.monthlyCents ?? 100_000) * 1.2) / 50_000) * 50_000);
  const [limit, setLimit] = useState<number | null>(sug);
  return (
    <Sheet title={`Aprovar cadastro · ${l.name}`} onClose={onClose} icon={<CheckCircle2 size={18} />}>
      <div className="card mb"><dl className="kv"><dt>CNPJ</dt><dd>{l.cadastro?.cnpj}</dd><dt>Razão social</dt><dd>{l.cadastro?.legalName}</dd><dt>Proposta</dt><dd>{l.proposal ? `${brl0(l.proposal.valueCents)}/mês · ${l.proposal.termDays ? `${l.proposal.termDays} dias` : "à vista"}` : "—"}</dd></dl></div>
      <Field label="Limite de crédito inicial"><OneChips options={[...new Set([100_000, 300_000, 500_000, 1_000_000, sug])].sort((a, b) => a - b)} value={limit} onChange={setLimit} label={(v) => brl0(v)} /></Field>
      <button className="btn btn-primary btn-block" disabled={!limit} onClick={() => {
        commit(() => {
          const c = leadToCustomer(l, limit!);
          l.customerId = c.id; l.stage = "cliente"; l.cadastro!.status = "aprovado"; l.cadastro!.limitCents = limit!; delete l.cadastro!.reply;
          log(l, FINANCE_USER.name, `Cadastro aprovado · limite ${brl0(limit!)} · cliente ${c.code}`);
          notify({ link: { t: "lead", id: l.id }, kind: "financeiro", title: "Cliente novo aprovado", text: `${l.name} virou cliente (${c.code}) · limite ${brl0(limit!)}. Já pode tirar pedido.`, to: [`seller:${l.sellerId}`, ...MANAGERS_KEYS] });
        }, `${l.name} aprovado · cliente criado`);
        onDone();
      }}>Aprovar e criar cliente</button>
    </Sheet>
  );
}

// ---------------------------------------------------------------- vendedor
export function SellerProspect({ sellerId = CURRENT_SELLER.id }: { sellerId?: string }) {
  useStore();
  const [stage, setStage] = useState<LeadStage | "open" | "today">("open");
  const [open, setOpen] = useState<Lead | null>(null);
  const [form, setForm] = useState(false);
  const mine = LEADS.filter((l) => l.sellerId === sellerId);
  const today = mine.filter((l) => OPEN_STAGES.includes(l.stage) && l.nextAt && l.nextAt <= TODAY);
  const list = stage === "open" ? mine.filter((l) => OPEN_STAGES.includes(l.stage)) : stage === "today" ? today : mine.filter((l) => l.stage === stage);
  return (
    <>
      <button className="btn btn-primary btn-block mb" onClick={() => setForm(true)}><UserPlus size={17} /> Novo cliente (pré-cadastro)</button>
      <div className="chips mb">
        <Chip on={stage === "open"} onClick={() => setStage("open")}>Em andamento ({mine.filter((l) => OPEN_STAGES.includes(l.stage)).length})</Chip>
        <Chip on={stage === "today"} onClick={() => setStage("today")}>Para hoje ({today.length})</Chip>
        {STAGES.map((s) => <Chip key={s.id} on={stage === s.id} onClick={() => setStage(s.id)}>{s.label} ({mine.filter((l) => l.stage === s.id).length})</Chip>)}
      </div>
      <Card>
        <div className="list cols">
          <ColsHead left="Prospect" right="Etapa" />
          {list.map((l) => <LeadRow key={l.id} l={l} onClick={() => setOpen(l)} />)}
        </div>
        {!list.length && <Empty icon={<Filter />} text="Nenhum prospect nesta etapa." />}
      </Card>
      {form && <LeadForm sellerId={sellerId} onClose={() => setForm(false)} onSaved={(l) => setTimeout(() => setOpen(l), 50)} />}
      {open && <LeadSheet lead={open} viewer="seller" onClose={() => setOpen(null)} />}
    </>
  );
}

// ---------------------------------------------------------------- gerente
export function funnelStats(scope: string[]) {
  const all = leadsOf(scope);
  const won = all.filter((l) => l.stage === "cliente");
  const lost = all.filter((l) => l.stage === "perdido");
  const closed = won.length + lost.length;
  const days = won.map((l) => daysOpen(l));
  const reasons = new Map<string, number>();
  for (const l of lost) reasons.set(l.lostReason ?? "Outro", (reasons.get(l.lostReason ?? "Outro") ?? 0) + 1);
  return {
    all, won, lost, open: all.filter((l) => OPEN_STAGES.includes(l.stage)),
    conversionPct: closed ? (won.length / closed) * 100 : 0,
    avgDays: days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0,
    reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
    byStage: STAGES.map((s) => ({ ...s, n: all.filter((l) => l.stage === s.id).length })),
  };
}

export function ManagerProspect({ scope }: { scope: string[] }) {
  useStore();
  const f = funnelStats(scope);
  const [list, setList] = useState<{ title: string; items: Lead[] } | null>(null);
  const max = Math.max(1, ...f.byStage.map((s) => s.n));
  const sellers = SELLERS.filter((s) => scope.includes(s.id));
  return (
    <>
      <h2 style={{ margin: "6px 0 12px" }}>Prospecção</h2>
      <div className="grid g2 gd-4">
        <Kpi icon={<Filter size={17} />} label="Em andamento" value={f.open.length} foot="toque para ver" onClick={() => setList({ title: "Prospects em andamento", items: f.open })} />
        <Kpi icon={<CheckCircle2 size={17} />} tone="success" label="Viraram cliente" value={f.won.length} foot={`conversão ${pct(f.conversionPct)}`} onClick={() => setList({ title: "Viraram cliente", items: f.won })} />
        <Kpi icon={<Clock size={17} />} tone="info" label="Tempo médio até fechar" value={`${f.avgDays.toFixed(0)} dias`} foot="do pré-cadastro à aprovação" onClick={() => setList({ title: "Viraram cliente", items: f.won })} />
        <Kpi icon={<XCircle size={17} />} tone="gold" label="Perdidos" value={f.lost.length} foot="ver motivos" onClick={() => setList({ title: "Perdidos", items: f.lost })} />
      </div>
      <div className="grid gd gd-2">
        <Card title="Funil" icon={<Filter size={16} />} sub="toque na etapa">
          {f.byStage.map((s) => (
            <div key={s.id} className="row click" onClick={() => setList({ title: s.label, items: f.all.filter((l) => l.stage === s.id) })}>
              <div style={{ width: 110 }} className="small semi">{s.label}</div>
              <div className="grow"><Progress value={(s.n / max) * 100} color={s.id === "cliente" ? "green" : undefined} /></div>
              <div className="end"><b className="num">{s.n}</b></div>
            </div>
          ))}
        </Card>
        <Card title="Motivos de perda" icon={<XCircle size={16} />}>
          {f.reasons.map(([r, n]) => (
            <div key={r} className="row click" onClick={() => setList({ title: `Perdidos · ${r}`, items: f.lost.filter((l) => (l.lostReason ?? "Outro") === r) })}>
              <div className="grow small">{r}</div><div className="end"><b className="num">{n}</b></div>
            </div>
          ))}
          {!f.reasons.length && <Empty icon={<CheckCircle2 />} text="Nenhuma perda registrada." />}
        </Card>
      </div>
      <Card title="Por vendedor" icon={<Users size={16} />}>
        <div className="list cols">
          <ColsHead left="Vendedor" right="Abertos · clientes" />
          {sellers.map((s) => {
            const mine = f.all.filter((l) => l.sellerId === s.id);
            const op = mine.filter((l) => OPEN_STAGES.includes(l.stage)).length;
            const won = mine.filter((l) => l.stage === "cliente").length;
            return (
              <div key={s.id} className="row click" onClick={() => setList({ title: `Prospecção · ${s.name}`, items: mine })}>
                <div className="grow"><div className="title">{s.name}</div><div className="sub">{mine.length} no total · {mine.filter((l) => l.stage === "perdido").length} perdidos</div></div>
                <div className="end"><b className="num">{op} · {won}</b></div>
              </div>
            );
          })}
        </div>
      </Card>
      {list && <LeadListSheet title={list.title} items={list.items} viewer="manager" onClose={() => setList(null)} />}
    </>
  );
}

export function LeadListSheet({ title, items, viewer, onClose }: { title: string; items: Lead[]; viewer: Viewer; onClose: () => void }) {
  const [open, setOpen] = useState<Lead | null>(null);
  if (open) return <LeadSheet lead={open} viewer={viewer} onClose={() => setOpen(null)} />;
  return (
    <Sheet title={`${title} (${items.length})`} onClose={onClose} icon={<Filter size={18} />}>
      <div className="list">{items.map((l) => <LeadRow key={l.id} l={l} showSeller onClick={() => setOpen(l)} />)}</div>
      {!items.length && <Empty icon={<Filter />} text="Nenhum prospect aqui." />}
    </Sheet>
  );
}

// ---------------------------------------------------------------- financeiro
export function FinanceCadastros() {
  useStore();
  const [open, setOpen] = useState<Lead | null>(null);
  const list = pendingCadastros();
  return (
    <Card id="cadastros-novos" title={<>Cadastros novos {list.length > 0 && <Badge tone="warning">{list.length}</Badge>}</>} icon={<UserPlus size={16} />} sub="aprovar, recusar ou pedir correção">
      {list.map((l) => (
        <div key={l.id} className="row click" onClick={() => setOpen(l)}>
          <span className="ic-round"><Building2 size={16} /></span>
          <div className="grow"><div className="title small">{l.name}</div><div className="sub">{l.cadastro?.cnpj} · {sellerName(l.sellerId)} · enviado {fmtDateTime(l.cadastro!.sentAt!)}</div></div>
          <ChevronRight size={16} className="muted" />
        </div>
      ))}
      {!list.length && <Empty icon={<CheckCircle2 />} text="Nenhum cadastro aguardando." />}
      {open && <LeadSheet lead={open} viewer="finance" onClose={() => setOpen(null)} />}
    </Card>
  );
}

export const viewerFor = (role: Role | null): Viewer => role === "seller" ? "seller" : role === "finance" ? "finance" : "manager";
