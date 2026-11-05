/** Moto do vendedor: checklist e despesas (vendedor lança; supervisor e gerente geral acompanham e aprovam). */
import { useRef, useState } from "react";
import { Bike, ClipboardCheck, Fuel, Droplets, Receipt, Camera, CheckCircle2, XCircle, ChevronRight, AlertTriangle } from "lucide-react";
import { commit, toast, useStore } from "../data/store";
import { nowStamp, SELLERS, CURRENT_SELLER } from "../data/mock";
import { notify, MANAGERS_KEYS } from "../data/notify";
import { MOTO_ITEMS, MOTO_CHECKLISTS, MOTO_EXPENSES, MOTO_PLATES, EXPENSE_LABEL, type MotoChecklist, type MotoExpense, type ExpenseType, type MotoItemState } from "../data/moto";
import { Card, Sheet, Badge, Chip, Kpi, brl, Empty } from "./ui";

const fmtDT = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const ICON: Record<ExpenseType, React.ReactNode> = { oleo: <Droplets size={16} />, combustivel: <Fuel size={16} />, outras: <Receipt size={16} /> };

/** Reduz a foto do comprovante mantendo a proporção (até 1000 px). */
async function shrinkReceipt(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement("canvas"); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.8);
  } finally { URL.revokeObjectURL(url); }
}
function PhotoPick({ value, onChange, label }: { value?: string; onChange: (v: string) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="field"><label>{label}</label>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { onChange(await shrinkReceipt(f)); } catch { toast("Não foi possível ler a foto", "danger"); } } e.target.value = ""; }} />
      {value ? <div className="moto-photo" onClick={() => ref.current?.click()}><img src={value} alt="foto" /><span>Trocar foto</span></div>
        : <button type="button" className="btn btn-ghost btn-block" data-instant="" onClick={() => ref.current?.click()}><Camera size={16} /> Tirar foto / escolher da galeria</button>}
    </div>
  );
}

// ---------------------------------------------------------------- vendedor
export function MyMotoCard() {
  useStore();
  const me = CURRENT_SELLER.id;
  const [mode, setMode] = useState<null | "check" | "expense" | "list">(null);
  const checks = MOTO_CHECKLISTS.filter((c) => c.sellerId === me).sort((a, b) => b.at.localeCompare(a.at));
  const exps = MOTO_EXPENSES.filter((e) => e.sellerId === me).sort((a, b) => b.at.localeCompare(a.at));
  const month = new Date().toISOString().slice(0, 7);
  const monthTotal = exps.filter((e) => e.at.startsWith(month)).reduce((a, e) => a + e.valueCents, 0);
  const last = checks[0];
  const problems = last ? Object.values(last.items).filter((v) => v === "problema").length : 0;
  return (
    <Card title="Minha moto" icon={<Bike size={17} />} sub={`placa ${MOTO_PLATES[me]}`}>
      <div className="small mb">{last ? <>Último checklist: <b>{fmtDT(last.at)}</b> · {last.km.toLocaleString("pt-BR")} km {problems ? <Badge tone="danger">{problems} problema(s)</Badge> : <Badge tone="success">tudo ok</Badge>}</> : "Nenhum checklist ainda."}</div>
      <div className="grid g2" style={{ marginBottom: 8 }}>
        <button className="btn btn-primary" onClick={() => setMode("check")}><ClipboardCheck size={16} /> Fazer checklist</button>
        <button className="btn btn-gold" onClick={() => setMode("expense")}><Receipt size={16} /> Lançar despesa</button>
      </div>
      <div className="row click" onClick={() => setMode("list")}><div className="grow small">Despesas do mês: <b>{brl(monthTotal)}</b> · {exps.length} lançamentos</div><ChevronRight size={16} className="muted" /></div>
      {mode === "check" && <ChecklistForm sellerId={me} lastKm={last?.km} onClose={() => setMode(null)} />}
      {mode === "expense" && <ExpenseForm sellerId={me} onClose={() => setMode(null)} />}
      {mode === "list" && <ExpensesSheet title="Minhas despesas da moto" list={exps} onClose={() => setMode(null)} />}
    </Card>
  );
}

function ChecklistForm({ sellerId, lastKm, onClose }: { sellerId: string; lastKm?: number; onClose: () => void }) {
  const [items, setItems] = useState<Record<string, MotoItemState | undefined>>({});
  const [km, setKm] = useState(lastKm ? String(lastKm) : "");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const done = MOTO_ITEMS.every((it) => items[it]);
  const problems = MOTO_ITEMS.filter((it) => items[it] === "problema");
  const okKm = Number(km.replace(/\D/g, "")) > 0;
  return (
    <Sheet title="Checklist da moto" onClose={onClose} icon={<ClipboardCheck size={18} />}>
      <p className="small muted mb">Placa {MOTO_PLATES[sellerId]} · marque cada item antes de sair para a rota.</p>
      <div className="list">
        {MOTO_ITEMS.map((it) => (
          <div key={it} className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <div className="grow small semi">{it}</div>
            <Chip on={items[it] === "ok"} onClick={() => setItems({ ...items, [it]: "ok" })}>OK</Chip>
            <Chip on={items[it] === "problema"} onClick={() => setItems({ ...items, [it]: "problema" })}>Problema</Chip>
          </div>
        ))}
      </div>
      <div className="field mt"><label>Km atual</label><input id="moto-km" className="input" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} /></div>
      {problems.length > 0 && <div className="field"><label className="red">Descreva o problema</label><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>}
      <PhotoPick label="Foto da moto (opcional)" value={photo} onChange={setPhoto} />
      <button className="btn btn-primary btn-block" disabled={!done || !okKm || (problems.length > 0 && note.trim().length < 3)} onClick={() => {
        const rec: MotoChecklist = { id: `mc${Date.now().toString(36)}`, sellerId, at: nowStamp(), km: Number(km.replace(/\D/g, "")), plate: MOTO_PLATES[sellerId]!, items: items as Record<string, MotoItemState>, ...(note.trim() ? { note: note.trim() } : {}), ...(photo ? { photo } : {}) };
        commit(() => {
          MOTO_CHECKLISTS.unshift(rec);
          if (problems.length) notify({ kind: "alerta", priority: "high", title: "Moto com problema no checklist", text: `${SELLERS.find((s) => s.id === sellerId)?.name} · ${problems.join(", ")} · ${note.trim()}`, to: MANAGERS_KEYS, link: { t: "tab", tab: "motos" } });
        }, problems.length ? "Checklist salvo · gestão avisada do problema" : "Checklist salvo · moto ok");
        onClose();
      }}>Salvar checklist</button>
      {!done && <p className="xs muted mt">Marque todos os itens para salvar.</p>}
    </Sheet>
  );
}

function ExpenseForm({ sellerId, onClose }: { sellerId: string; onClose: () => void }) {
  const [type, setType] = useState<ExpenseType | null>(null);
  const [desc, setDesc] = useState("");
  const [value, setValue] = useState("");
  const [km, setKm] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const cents = Math.round(Number(value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")) * 100);
  const ok = type && cents > 0 && (type !== "outras" || desc.trim().length > 2) && photo;
  return (
    <Sheet title="Lançar despesa da moto" onClose={onClose} icon={<Receipt size={18} />}>
      <div className="field"><label>Tipo</label>
        <div className="moto-types">
          {(Object.keys(EXPENSE_LABEL) as ExpenseType[]).map((t) => (
            <button key={t} type="button" className={`btn ${type === t ? "btn-primary" : "btn-ghost"}`} onClick={() => { setType(t); if (!desc && t !== "outras") setDesc(EXPENSE_LABEL[t]); }}>{ICON[t]} {EXPENSE_LABEL[t]}</button>
          ))}
        </div>
      </div>
      <div className="field"><label>Descrição{type === "outras" ? "" : " (opcional)"}</label><input id="moto-desc" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={type === "outras" ? "Ex.: troca de pneu, lavagem, estacionamento" : "Ex.: posto da rota, óleo 10W30"} /></div>
      <div className="grid g2" style={{ marginBottom: 0 }}>
        <div className="field"><label>Valor (R$)</label><input id="moto-valor" className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" /></div>
        <div className="field"><label>Km (opcional)</label><input className="input" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} /></div>
      </div>
      <PhotoPick label="Foto do comprovante / nota" value={photo} onChange={setPhoto} />
      <button className="btn btn-primary btn-block" disabled={!ok} onClick={() => {
        commit(() => {
          MOTO_EXPENSES.unshift({ id: `me${Date.now().toString(36)}`, sellerId, at: nowStamp(), type: type!, description: desc.trim() || EXPENSE_LABEL[type!], valueCents: cents, ...(km ? { km: Number(km.replace(/\D/g, "")) } : {}), ...(photo ? { photo } : {}), status: "enviada" });
          notify({ kind: "financeiro", title: "Despesa de moto lançada", text: `${SELLERS.find((s) => s.id === sellerId)?.name} · ${EXPENSE_LABEL[type!]} · ${brl(cents)}`, to: MANAGERS_KEYS, link: { t: "tab", tab: "motos" } });
        }, `Despesa de ${brl(cents)} enviada para a gestão`);
        onClose();
      }}>Enviar despesa</button>
      {!photo && <p className="xs muted mt">A foto do comprovante é obrigatória.</p>}
    </Sheet>
  );
}

function ExpensesSheet({ title, list, onClose, canDecide }: { title: string; list: MotoExpense[]; onClose: () => void; canDecide?: boolean }) {
  useStore();
  const [open, setOpen] = useState<MotoExpense | null>(null);
  if (open) return <ExpenseDetail e={open} canDecide={canDecide} onClose={() => setOpen(null)} />;
  return (
    <Sheet title={title} onClose={onClose} icon={<Receipt size={18} />}>
      <div className="list">
        {list.map((e) => (
          <div key={e.id} className="row click" onClick={() => setOpen(e)}>
            <span className="ic-round">{ICON[e.type]}</span>
            <div className="grow"><div className="title small">{e.description}</div><div className="sub">{EXPENSE_LABEL[e.type]} · {fmtDT(e.at)}{canDecide ? ` · ${SELLERS.find((s) => s.id === e.sellerId)?.name.split(" ")[0]}` : ""}</div></div>
            <div className="end"><b className="num">{brl(e.valueCents)}</b><Badge tone={e.status === "aprovada" ? "success" : e.status === "recusada" ? "danger" : "warning"}>{e.status}</Badge></div>
          </div>
        ))}
      </div>
      {!list.length && <Empty icon={<Receipt />} text="Nenhuma despesa lançada." />}
    </Sheet>
  );
}

function ExpenseDetail({ e, canDecide, onClose }: { e: MotoExpense; canDecide?: boolean; onClose: () => void }) {
  const rec = MOTO_EXPENSES.find((x) => x.id === e.id) ?? e;
  return (
    <Sheet title={`${EXPENSE_LABEL[rec.type]} · ${brl(rec.valueCents)}`} onClose={onClose} icon={ICON[rec.type]}>
      <div className="card"><dl className="kv">
        <dt>Vendedor</dt><dd>{SELLERS.find((s) => s.id === rec.sellerId)?.name}</dd><dt>Placa</dt><dd>{MOTO_PLATES[rec.sellerId]}</dd>
        <dt>Descrição</dt><dd>{rec.description}</dd><dt>Data</dt><dd>{fmtDT(rec.at)}</dd>{rec.km ? <><dt>Km</dt><dd>{rec.km.toLocaleString("pt-BR")}</dd></> : null}
        <dt>Situação</dt><dd>{rec.status}</dd>
      </dl></div>
      {rec.photo ? <div className="moto-photo mt"><img src={rec.photo} alt="comprovante" /></div> : <p className="small muted mt">Comprovante de demonstração (sem foto).</p>}
      {canDecide && rec.status === "enviada" && (
        <div className="grid g2 mt" style={{ marginBottom: 0 }}>
          <button className="btn btn-ghost" onClick={() => { commit(() => { rec.status = "recusada"; notify({ kind: "financeiro", title: "Despesa de moto recusada", text: `${rec.description} · ${brl(rec.valueCents)}`, to: [`seller:${rec.sellerId}`] }); }, "Despesa recusada · vendedor avisado"); onClose(); }}><XCircle size={15} /> Recusar</button>
          <button className="btn btn-primary" onClick={() => { commit(() => { rec.status = "aprovada"; notify({ kind: "financeiro", title: "Despesa de moto aprovada", text: `${rec.description} · ${brl(rec.valueCents)}`, to: [`seller:${rec.sellerId}`] }); }, "Despesa aprovada · vendedor avisado"); onClose(); }}><CheckCircle2 size={15} /> Aprovar</button>
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- gestão
export function MotosView({ scope }: { scope: string[] }) {
  useStore();
  const [exp, setExp] = useState<{ title: string; list: MotoExpense[] } | null>(null);
  const [check, setCheck] = useState<MotoChecklist | null>(null);
  const sellers = SELLERS.filter((s) => scope.includes(s.id));
  const all = MOTO_EXPENSES.filter((e) => scope.includes(e.sellerId)).sort((a, b) => b.at.localeCompare(a.at));
  const pend = all.filter((e) => e.status === "enviada");
  const month = new Date().toISOString().slice(0, 7);
  const lastOf = (id: string) => MOTO_CHECKLISTS.filter((c) => c.sellerId === id).sort((a, b) => b.at.localeCompare(a.at))[0];
  return (
    <>
      <h2 style={{ margin: "6px 0 12px" }}>Motos dos vendedores</h2>
      <div className="grid g2 gd-4">
        <Kpi icon={<Receipt size={17} />} tone="gold" label="Despesas do mês" value={brl(all.filter((e) => e.at.startsWith(month)).reduce((a, e) => a + e.valueCents, 0))} onClick={() => setExp({ title: "Despesas de moto", list: all })} />
        <Kpi icon={<AlertTriangle size={17} />} tone="red" label="Para aprovar" value={pend.length} foot="toque para aprovar" onClick={() => setExp({ title: "Despesas para aprovar", list: pend })} />
        <Kpi icon={<Fuel size={17} />} tone="info" label="Combustível no mês" value={brl(all.filter((e) => e.type === "combustivel" && e.at.startsWith(month)).reduce((a, e) => a + e.valueCents, 0))} onClick={() => setExp({ title: "Combustível", list: all.filter((e) => e.type === "combustivel") })} />
        <Kpi icon={<Droplets size={17} />} tone="success" label="Trocas de óleo" value={all.filter((e) => e.type === "oleo").length} onClick={() => setExp({ title: "Trocas de óleo", list: all.filter((e) => e.type === "oleo") })} />
      </div>
      <Card title="Por vendedor" icon={<Bike size={17} />}>
        <div className="list">
          {sellers.map((s) => {
            const c = lastOf(s.id); const probs = c ? Object.entries(c.items).filter(([, v]) => v === "problema").map(([k]) => k) : [];
            const mine = all.filter((e) => e.sellerId === s.id);
            return (
              <div key={s.id} className="row" style={{ flexWrap: "wrap" }}>
                <div className="grow" style={{ minWidth: 200 }}>
                  <div className="title small">{s.name} · {MOTO_PLATES[s.id]}</div>
                  <div className="sub">{c ? <>checklist {fmtDT(c.at)} · {c.km.toLocaleString("pt-BR")} km {probs.length ? <span className="red semi">· {probs.join(", ")}</span> : <span className="green semi">· ok</span>}</> : "sem checklist"}</div>
                </div>
                {c && <button className="btn btn-ghost btn-sm" onClick={() => setCheck(c)}>Checklist</button>}
                <button className="btn btn-soft btn-sm" onClick={() => setExp({ title: `Despesas · ${s.name}`, list: mine })}>Despesas · {brl(mine.reduce((a, e) => a + e.valueCents, 0))}</button>
              </div>
            );
          })}
        </div>
      </Card>
      {exp && <ExpensesSheet title={exp.title} list={exp.list} canDecide onClose={() => setExp(null)} />}
      {check && (
        <Sheet title={`Checklist · ${SELLERS.find((s) => s.id === check.sellerId)?.name}`} onClose={() => setCheck(null)} icon={<ClipboardCheck size={18} />}>
          <p className="small muted mb">{fmtDT(check.at)} · {check.km.toLocaleString("pt-BR")} km · placa {check.plate}</p>
          <div className="list">{Object.entries(check.items).map(([k, v]) => <div key={k} className="row"><div className="grow small">{k}</div><Badge tone={v === "ok" ? "success" : "danger"}>{v === "ok" ? "OK" : "Problema"}</Badge></div>)}</div>
          {check.note && <p className="small mt red">{check.note}</p>}
          {check.photo && <div className="moto-photo mt"><img src={check.photo} alt="moto" /></div>}
        </Sheet>
      )}
    </>
  );
}
