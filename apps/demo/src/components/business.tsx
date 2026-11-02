/** Componentes de negócio reutilizados por vários perfis. */
import { useMemo, useState } from "react";
import {
  MapPin, Phone, Snowflake, Receipt, ShoppingCart, FileText, Upload, LogIn, LogOut as LogOutIc, AlertTriangle,
  ArrowRightLeft, Send, Search, Plus, Minus, Trash2, Lock, QrCode, History, MessageCircle,
} from "lucide-react";
import {
  checkStock, decidePaymentTerm, orderSubmissionNotice, CREDIT_BLOCK_MESSAGE, ORDER_STATUS, QUOTE_STATUS,
  PAYMENT_REQUEST_STATUS, limitedCustomerView, type StatusDef,
} from "@galato/domain";
import {
  PARAMS, PRODUCTS, ORDERS, PAYMENT_REQUESTS, TODAY, NOW, nowStamp, sellerById, customerById, type Customer, type Order,
} from "../data/mock";
import { customerRow, financial } from "../data/selectors";
import { commit, toast } from "../data/store";
import { notify, MANAGERS_KEYS } from "../data/notify";
import { VisitHistoryCard } from "./visits";
import { matchCustomer } from "../data/search";
import { customerOrders, type HistOrder } from "../data/history";
import { OrderDetail } from "../screens/Reports";
import { statusLabel } from "../data/selectors";
import { TRANSFER_REQUESTS, SELLERS, TODAY_ROUTE, CHECKINS, FREEZER_OCCURRENCES, type FreezerOccurrence } from "../data/mock";
import { PhotoCapture } from "./photo";
import { newestFirst, applySalesDelta, logOrder, orderStatusText } from "../data/orders";
import { OrderOpen } from "./order-flow";
import { FirstVisitSheet, FreezerManager } from "./freezers";
import { FreezerOccurrenceSheet, OccurrenceDetail, OccurrenceRow } from "./freezer-occurrences";
import { CheckoutSheet, CheckinVideo } from "./checkout";
import { ProofView, BoletoView, AssetView } from "./details";
import { Video } from "lucide-react";
import type { Checkin, PaymentRequest, Receivable, Asset } from "../data/mock";
import { AlertOctagon } from "lucide-react";
import { Badge, Card, Curve, Sheet, brl, Chip, Progress, Stepper, ColsHead, SearchBox } from "./ui";

/** Prazos de pagamento oferecidos no pedido (0 = à vista/PIX). */
export const PAYMENT_TERM_OPTIONS = [0, 7, 14, 21];
export const termLabel = (d: number) => (d === 0 ? "À vista/PIX" : `${d} dias`);
export const termShort = (d: number) => (d === 0 ? "à vista" : `${d}d`);

/** "30/10/2026 às 17:42" no fuso da empresa */
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: PARAMS.timezone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " às");
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: PARAMS.timezone, hour: "2-digit", minute: "2-digit" });

const fmtDate = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");

export function creditBadge(c: Customer) {
  const f = financial(c);
  if (f.creditStatus === "blocked") return <Badge tone="danger">Bloqueado</Badge>;
  if (f.creditStatus === "attention") return <Badge tone="warning">Vencido</Badge>;
  return <Badge tone="success">Em dia</Badge>;
}

export function CustomerRowView({ c, onClick, extra, other }: { c: Customer; onClick?: () => void; extra?: React.ReactNode; other?: boolean }) {
  const r = customerRow(c);
  return (
    <div className={`row click ${other ? "row-other" : ""}`} onClick={onClick}>
      <Curve c={c.abcd} />
      <div className="grow">
        <div className="title">{c.tradeName}</div>
        <div className="sub">
          {c.code} · {c.district} · últ. compra {fmtDate(c.lastPurchaseDate)} {c.assets.length ? `· ${c.assets.length} freezer${c.assets.length > 1 ? "s" : ""}` : ""}
        </div>
      </div>
      <div className="end">
        {extra ?? (
          <>
            <div className={`bold num ${r.days !== null && r.days >= 28 ? "red" : ""}`}>{r.days === null ? "nunca" : `${r.days}d`}</div>
            <div>{creditBadge(c)}</div>
          </>
        )}
      </div>
    </div>
  );
}

/** Lista detalhada (seção 28): cliente, curva, última compra, dias, valor, média, freezers, financeiro, contato. */
export function CustomerTable({ list: all, onOpen }: { list: Customer[]; onOpen: (c: Customer) => void }) {
  const [q, setQ] = useState("");
  const list = all.filter((c) => matchCustomer(c, q));
  return (
    <>
      {all.length > 4 && <SearchBox value={q} onChange={setQ} />}
      <div className="only-mobile list cols">
        <ColsHead left="Cliente" right="Dias sem compra" />
        {list.map((c) => <CustomerRowView key={c.id} c={c} onClick={() => onOpen(c)} />)}
      </div>
      <div className="only-desktop table-wrap">
        <table className="t">
          <thead><tr><th>Cliente</th><th>Curva</th><th>Vendedor</th><th>Última compra</th><th className="r">Dias s/ compra</th><th className="r">Valor últ.</th><th className="r">Média mês</th><th className="r">Freezers</th><th>Financeiro</th><th>Contato</th></tr></thead>
          <tbody>
            {list.map((c) => {
              const r = customerRow(c);
              return (
                <tr key={c.id} className="click" onClick={() => onOpen(c)}>
                  <td><div className="semi">{c.tradeName}</div><div className="xs muted">{c.code} · {c.city}</div></td>
                  <td><Curve c={c.abcd} /></td>
                  <td className="small">{sellerById.get(c.sellerId)?.name.split(" ")[0]}</td>
                  <td>{fmtDate(c.lastPurchaseDate)}</td>
                  <td className={`r bold num ${r.days !== null && r.days >= 28 ? "red" : ""}`}>{r.days ?? "nunca"}</td>
                  <td className="r num">{brl(c.lastPurchaseCents)}</td>
                  <td className="r num">{brl(c.avgMonthlyCents)}</td>
                  <td className="r">{c.assets.length}</td>
                  <td>{creditBadge(c)}</td>
                  <td className="small">{c.whatsapp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ ficha / check-in
export function CustomerSheet({ c, viewerSellerId, onClose }: { c: Customer; viewerSellerId?: string; onClose: () => void }) {
  const own = !viewerSellerId || viewerSellerId === c.sellerId;
  const openCheckin = CHECKINS.find((k) => k.customerId === c.id && k.date === TODAY && !k.outAt);
  const doneToday = CHECKINS.filter((k) => k.customerId === c.id && k.date === TODAY && k.outAt);
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const [mode, setMode] = useState<null | "order" | "quote" | "proof" | "transfer" | "forward" | "firstvisit" | "freezers" | "occurrence" | "checkout">(null);
  const [playVideo, setPlayVideo] = useState<Checkin | null>(null);
  const doCheckin = () => commit(() => {
    CHECKINS.unshift({ id: `ck${Date.now()}`, customerId: c.id, sellerId: c.sellerId, inAt: nowStamp(), date: TODAY });
    const s = SELLERS.find((x) => x.id === c.sellerId);
    // a visita conta no check-in; repetir no mesmo cliente no mesmo dia não conta de novo
    if (s && !doneToday.length) s.visitsDoneToday += 1;
  }, doneToday.length ? "Novo check-in registrado (visita já contabilizada hoje)" : "Check-in registrado · visita contabilizada");
  const fin = financial(c);
  const r = customerRow(c);
  const history = ORDERS.filter((o) => o.customerId === c.id).sort(newestFirst<Order>((x) => x.createdAt));
  const requests = PAYMENT_REQUESTS.filter((p) => p.customerId === c.id);
  const pastOrders = customerOrders(c.id).filter((o) => !o.live);
  const [morePast, setMorePast] = useState(false);
  const [pastOpen, setPastOpen] = useState<HistOrder | null>(null);
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [detail, setDetail] = useState<{ kind: "proof"; p: PaymentRequest } | { kind: "boleto"; x: Receivable } | { kind: "asset"; a: Asset } | null>(null);
  const [openOcc, setOpenOcc] = useState<FreezerOccurrence | null>(null);
  const custOccs = FREEZER_OCCURRENCES.filter((o) => o.customerId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (!own) {
    const v = limitedCustomerView({ ...c, responsibleSellerId: c.sellerId, responsibleSellerName: sellerById.get(c.sellerId)!.name });
    return (
      <Sheet title={v.tradeName} onClose={onClose} icon={<Lock size={18} />}>
        <Card>
          <div className="flex mb"><Badge tone="warning">Cliente de outra carteira</Badge></div>
          <dl className="kv">
            <dt>CNPJ</dt><dd className="num">{c.document || "—"}</dd>
            <dt>Razão social</dt><dd>{c.legalName}</dd>
            <dt>Código</dt><dd>{v.code}</dd>
            <dt>Cidade</dt><dd>{v.city}/{v.state}</dd>
            <dt>Região</dt><dd>{v.region}</dd>
            <dt>Vendedor responsável</dt><dd>{v.responsibleSellerName}</dd>
          </dl>
          <p className="xs muted mt">Acesso limitado. Dados comerciais e financeiros visíveis apenas para o responsável e gestão.</p>
        </Card>
        {mode === "transfer" ? (
          <ReasonForm title="Solicitar transferência para minha carteira" placeholder="Justificativa (ex.: cliente atendido por mim há 3 meses em outra unidade)"
            cta="Enviar para aprovação do gestor" onCancel={() => setMode(null)}
            onSubmit={(reason) => {
              commit(() => {
                TRANSFER_REQUESTS.unshift({ id: `tr${Date.now()}`, customerId: c.id, fromSellerId: c.sellerId, toSellerId: viewerSellerId!, reason, createdAt: nowStamp(), status: "pending" });
                notify({ link: { t: "transfer", id: TRANSFER_REQUESTS[0]!.id }, kind: "comercial", title: "Pedido de transferência de carteira", text: `${sellerById.get(viewerSellerId!)?.name} pediu ${c.tradeName} (carteira de ${sellerById.get(c.sellerId)?.name}).`, to: ["sales_coordinator", "sales_manager", "general_manager"] });
              }, "Solicitação enviada ao gerente/coordenador. Transferência só ocorre após aprovação.");
              onClose();
            }} />
        ) : mode === "forward" ? (
          <ReasonForm title="Encaminhar oportunidade ao responsável" placeholder="Descreva a oportunidade (produto, volume, contato)"
            cta={`Encaminhar para ${v.responsibleSellerName.split(" ")[0]}`} onCancel={() => setMode(null)}
            onSubmit={(text) => {
              commit(() => notify({ link: { t: "customer", id: c.id }, kind: "comercial", title: "Oportunidade encaminhada", text: `${sellerById.get(viewerSellerId!)?.name} indicou ${c.tradeName}: ${text}`, to: [`seller:${c.sellerId}`] }),
                "Oportunidade encaminhada. Comissão por indicação: regra a definir pela empresa.");
              onClose();
            }} />
        ) : (
          <div className="grid g2 mt">
            <button className="btn btn-primary" onClick={() => setMode("transfer")}><ArrowRightLeft size={16} /> Solicitar transferência</button>
            <button className="btn btn-ghost" onClick={() => setMode("forward")}><Send size={16} /> Encaminhar oportunidade</button>
          </div>
        )}
      </Sheet>
    );
  }

  if (detail?.kind === "proof") return <ProofView p={detail.p} onClose={() => setDetail(null)} />;
  if (detail?.kind === "boleto") return <BoletoView c={c} x={detail.x} onClose={() => setDetail(null)} />;
  if (detail?.kind === "asset") return <AssetView c={c} a={detail.a} onClose={() => setDetail(null)} />;
 if (openOrder) return <OrderOpen order={openOrder} canEdit={!!viewerSellerId && viewerSellerId === openOrder.sellerId} onClose={() => setOpenOrder(null)} />;
  if (mode === "order" || mode === "quote")
    return <OrderBuilder c={c} kind={mode === "order" ? "ORDER" : "QUOTE"} onClose={() => setMode(null)} onDone={onClose} />;
  if (mode === "proof") return <PaymentProofSheet c={c} onClose={() => setMode(null)} />;
  if (mode === "firstvisit") return <FirstVisitSheet c={c} onClose={() => setMode(null)} onDone={() => { setMode(null); doCheckin(); }} />;
  if (mode === "freezers") return <FreezerManager c={c} onClose={() => setMode(null)} />;
  if (mode === "occurrence") return <FreezerOccurrenceSheet c={c} onClose={() => setMode(null)} />;
  if (mode === "checkout" && openCheckin) return <CheckoutSheet c={c} checkin={openCheckin} onClose={() => setMode(null)} />;
  if (pastOpen) return <OrderDetail o={pastOpen} onClose={() => setPastOpen(null)} />;
  if (playVideo) return <CheckinVideo checkin={playVideo} title={`Vídeo do freezer · ${c.tradeName}`} onClose={() => setPlayVideo(null)} />;
  if (openOcc) return <OccurrenceDetail occ={openOcc} viewer={viewerSellerId ? "seller" : "manager"} onClose={() => setOpenOcc(null)} />;

  return (
    <Sheet title={c.tradeName} onClose={onClose} wide>
      <div className="grid gd gd-21">
        <div className="stack">
          <Card>
            <div className="flex between wrap" style={{ gap: 6 }}>
              <div className="flex"><Curve c={c.abcd} /><span className="semi">{c.legalName}</span></div>
              {creditBadge(c)}
            </div>
            <div className="small t2 mt">{c.code} · CNPJ {c.document}</div>
            <div className="small t2 flex" style={{ marginTop: 4 }}><MapPin size={14} /> {c.address} — {c.district}, {c.city}/{c.state} · {c.cep}</div>
            <div className="small t2 flex" style={{ marginTop: 4 }}><Phone size={14} /> {c.buyerName} (comprador) · {c.phone}</div>
            <div className="divider" />
            <div className="grid g3" style={{ marginBottom: 0 }}>
              <div><div className="xs muted">Vendedor</div><div className="semi small">{sellerById.get(c.sellerId)?.name}</div></div>
              <div><div className="xs muted">Rota comercial</div><div className="semi small">{PARAMS.commercialRoutes.find((x) => x.code === c.routeCode)?.name}</div></div>
              <div><div className="xs muted">Última compra</div><div className="semi small">{fmtDate(c.lastPurchaseDate)} · {brl(c.lastPurchaseCents)}</div></div>
            </div>
            {c.notes && <div className="mt small" style={{ padding: 10, borderRadius: 12, background: "var(--gold-soft)" }}>📝 {c.notes}</div>}
          </Card>

          {fin.creditStatus === "blocked" && (
            <div className="card" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)" }}>
              <div className="flex semi red"><AlertTriangle size={18} /> Cliente com bloqueio financeiro</div>
              <div className="small mt">{CREDIT_BLOCK_MESSAGE}</div>
            </div>
          )}

          <div className="grid g2" style={{ marginBottom: 0 }}>
            {!openCheckin ? (
              <button className="btn btn-primary" onClick={() => (c.onboardedAt ? doCheckin() : setMode("firstvisit"))}>
                <LogIn size={17} /> Check-in
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={() => setMode("checkout")}>
                <LogOutIc size={17} /> Checkout <span className="xs muted">(desde {hhmm(openCheckin.inAt)})</span>
              </button>
            )}
            <button className="btn btn-gold" onClick={() => setMode("order")}><ShoppingCart size={17} /> Novo pedido</button>
            <button className="btn btn-ghost" onClick={() => setMode("quote")}><FileText size={17} /> Orçamento</button>
            <button className="btn btn-ghost" onClick={() => setMode("proof")}><Upload size={17} /> Enviar comprovante</button>
          </div>
          {openCheckin && (
            <button className="btn btn-danger btn-block occ-cta" onClick={() => setMode("occurrence")}>
              <AlertOctagon size={18} /> Ocorrência de freezer
              <span className="xs" style={{ opacity: .85, fontWeight: 500 }}>perda · defeito · outros produtos</span>
            </button>
          )}
          {custOccs.length > 0 && (
            <Card title={`Ocorrências de freezer (${custOccs.length})`} icon={<AlertOctagon size={17} />} sub="toque para acompanhar">
              <div className="list">{custOccs.map((o) => <OccurrenceRow key={o.id} o={o} onClick={() => setOpenOcc(o)} />)}</div>
            </Card>
          )}

          {(openCheckin || doneToday.length > 0) && (
            <div className="small" style={{ padding: 10, borderRadius: 12, background: openCheckin ? "var(--info-soft)" : "var(--success-soft)" }}>
              {openCheckin ? <>Visita em andamento desde <b>{hhmm(openCheckin.inAt)}</b> · faça o checkout ao sair.</>
                : <>Visita de hoje concluída: {doneToday.map((k) => `${hhmm(k.inAt)}–${hhmm(k.outAt!)}`).join(", ")}.</>}
            </div>
          )}
          <Card title={`Histórico de pedidos (${history.filter((o) => o.kind === "ORDER").length + pastOrders.length})`} icon={<History size={17} />} sub="toque no pedido para abrir">
            <div className="list">
              {history.filter((o) => o.kind === "ORDER").slice(0, 10).map((o) => <OrderRow key={o.id} o={o} onClick={() => setOpenOrder(o)} />)}
              {pastOrders.slice(0, morePast ? 60 : 6).map((o) => (
                <div key={o.id} className="row click" onClick={() => setPastOpen(o)}>
                  <div className="grow"><div className="title small">{o.number} · {fmtDate(o.date)}</div><div className="sub">{o.invoiceNumber ?? "sem NF"} · {o.items.length} itens · {termShort(o.paymentTermDays)}</div></div>
                  <div className="end"><div className="num semi small">{brl(o.totalCents)}</div><div className="xs muted">{statusLabel(o.status)}</div></div>
                </div>
              ))}
              {pastOrders.length > 6 && <button className="link" onClick={() => setMorePast(!morePast)}>{morePast ? "Ver menos" : `Ver todos (${pastOrders.length})`}</button>}
              {!history.some((o) => o.kind === "ORDER") && !pastOrders.length && <div className="small muted">Nenhum pedido ainda.</div>}
            </div>
            {history.some((o) => o.kind === "QUOTE") && (
              <>
                <div className="xs muted semi mt mb">Orçamentos</div>
                {history.filter((o) => o.kind === "QUOTE").slice(0, 4).map((o) => <OrderRow key={o.id} o={o} onClick={() => setOpenOrder(o)} />)}
              </>
            )}
            {requests.length > 0 && <div className="divider" />}
            {requests.map((p) => (
              <div key={p.id} className="row click" onClick={() => setDetail({ kind: "proof", p })}>
                <Receipt size={16} className="muted" />
                <div className="grow"><div className="title small">Comprovante {p.method} · {p.number}</div><div className="sub">{fmtDateTime(p.createdAt)}</div></div>
                <Badge tone={PAYMENT_REQUEST_STATUS[p.status].tone}>{PAYMENT_REQUEST_STATUS[p.status].label}</Badge>
              </div>
            ))}
          </Card>
          <VisitHistoryCard customerId={c.id} onVideo={(id) => { const k = CHECKINS.find((x) => x.id === id); if (k?.video) setPlayVideo(k); }} />
        </div>

        <div className="stack">
          <Card title="Situação financeira" icon={<Receipt size={17} />}>
            <dl className="kv">
              <dt>Em aberto</dt><dd className="num">{brl(fin.openCents)} ({fin.openCount})</dd>
              <dt>Vencido</dt><dd className={`num ${fin.overdueCents ? "red" : ""}`}>{brl(fin.overdueCents)} ({fin.overdueCount})</dd>
              <dt>Próx. vencimento</dt><dd>{fmtDate(fin.nextDueDate)}</dd>
              <dt>Média de atraso</dt><dd>{fin.averageDelayDays.toFixed(1)} dias</dd>
            </dl>
            <div className="divider" />
            {c.receivables.filter((x) => x.openCents > 0).map((x) => (
              <div key={x.id} className="row click" onClick={() => setDetail({ kind: "boleto", x })}>
                <div className="grow"><div className="title small">{x.doc}</div><div className="sub">vence {fmtDate(x.dueDate)}</div></div>
                <div className="end"><div className="num semi">{brl(x.openCents)}</div>{x.dueDate < TODAY ? <Badge tone="danger">Vencido</Badge> : <Badge tone="info">A vencer</Badge>}</div>
              </div>
            ))}
            {!c.receivables.some((x) => x.openCents > 0) && <div className="small green semi">Nenhum boleto em aberto.</div>}
          </Card>

          <Card title={`Freezers (${c.assets.length})`} icon={<Snowflake size={17} />} link="Gerenciar" onLink={() => setMode("freezers")}>
            {c.assets.map((a) => (
              <div key={a.id} className="row click" onClick={() => setDetail({ kind: "asset", a })}>
                <QrCode size={26} className="muted" />
                <div className="grow"><div className="title small">Patrimônio {a.patrimony}</div><div className="sub"><span className={`fmt-tag ${a.format ?? (/vertical/i.test(a.type) ? "vertical" : "horizontal")}`}>{(a.format ?? (/vertical/i.test(a.type) ? "vertical" : "horizontal")) === "vertical" ? "Vertical" : "Horizontal"}</span> {a.brand ?? "Gelopar"} · {a.liters} L · {a.voltage}{a.model ? ` · ${a.model}` : ""}</div></div>
                <div className="end num small">{brl(a.valueCents)}</div>
              </div>
            ))}
            {!c.onboardedAt && <div className="xs gold semi mt">Freezers ainda não conferidos: a conferência é pedida no 1º check-in.</div>}
            <button className="btn btn-ghost btn-sm btn-block mt" onClick={() => setMode("freezers")}><Snowflake size={14} /> Incluir, editar ou retirar freezer</button>
            {!c.assets.length && <div className="small muted">Nenhum freezer Galato neste cliente.</div>}
            {c.assets.length > 0 && r.days !== null && r.days >= PARAMS.inactivity.idleAssetThresholdDays && (
              <div className="mt"><Badge tone="danger">Ativo sem giro · {r.days} dias sem compra</Badge></div>
            )}
          </Card>

          <Card title="Dados editáveis" icon={<MessageCircle size={17} />}>
            <EditableContact c={c} />
          </Card>
        </div>
      </div>
    </Sheet>
  );
}

function EditableContact({ c }: { c: Customer }) {
  const [phone, setPhone] = useState(c.whatsapp);
  const [buyer, setBuyer] = useState(c.buyerName);
  const [route, setRoute] = useState(c.routeCode);
  return (
    <>
      <div className="field"><label>WhatsApp</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="field"><label>Comprador</label><input className="input" value={buyer} onChange={(e) => setBuyer(e.target.value)} /></div>
      <div className="field"><label>Rota comercial</label>
        <select className="input" value={route} onChange={(e) => setRoute(e.target.value)}>
          {PARAMS.commercialRoutes.map((r) => <option key={r.code} value={r.code}>{r.name} — {["dom", "segunda", "terça", "quarta", "quinta", "sexta", "sáb"][r.weekday]}</option>)}
        </select>
      </div>
      <p className="xs muted mb">Razão social, CNPJ e endereço fiscal não são editáveis pelo vendedor. Toda alteração gera log.</p>
      <button className="btn btn-soft btn-block btn-sm" onClick={() => commit(() => { c.whatsapp = phone; c.buyerName = buyer; c.routeCode = route; }, "Dados atualizados · alteração registrada no log")}>Salvar alterações</button>
    </>
  );
}

function ReasonForm({ title, placeholder, cta, onSubmit, onCancel }: { title: string; placeholder: string; cta: string; onSubmit: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  return (
    <Card className="mt">
      <div className="semi mb">{title}</div>
      <textarea className="input" rows={3} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="grid g2 mt" style={{ marginBottom: 0 }}>
        <button className="btn btn-ghost" onClick={onCancel}>Voltar</button>
        <button className="btn btn-primary" disabled={text.trim().length < 5} onClick={() => onSubmit(text.trim())}>{cta}</button>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ comprovante
export function PaymentProofSheet({ c, onClose }: { c: Customer; onClose: () => void }) {
  const open = c.receivables.filter((r) => r.openCents > 0);
  const [rec, setRec] = useState(open[0]?.id ?? "");
  const [method, setMethod] = useState<"PIX" | "BOLETO">("PIX");
  const [photo, setPhoto] = useState<string | null>(null);
  const target = open.find((r) => r.id === rec);
  return (
    <Sheet title="Enviar comprovante de pagamento" onClose={onClose} icon={<Upload size={18} />}>
      <div className="field"><label>Débito / boleto</label>
        <select className="input" value={rec} onChange={(e) => setRec(e.target.value)}>
          {open.map((r) => <option key={r.id} value={r.id}>{r.doc} · {brl(r.openCents)} · vence {fmtDate(r.dueDate)}</option>)}
          <option value="">Outro / não identificado</option>
        </select>
      </div>
      <div className="field"><label>Método</label>
        <div className="chips"><Chip on={method === "PIX"} onClick={() => setMethod("PIX")}>PIX (prioritário)</Chip><Chip on={method === "BOLETO"} onClick={() => setMethod("BOLETO")}>Boleto</Chip></div>
      </div>
      <PhotoCapture value={photo} onChange={setPhoto} label="Fotografar comprovante de pagamento" />
      <Card className="mt">
        <div className="xs muted mb">Associado automaticamente</div>
        <dl className="kv">
          <dt>Cliente</dt><dd>{c.code} · {c.tradeName}</dd>
          <dt>Vendedor</dt><dd>{sellerById.get(c.sellerId)?.name}</dd>
          <dt>Débito</dt><dd>{target ? `${target.doc} · ${brl(target.openCents)}` : "—"}</dd>
          <dt>Data</dt><dd>{fmtDate(TODAY)}</dd>
          <dt>SLA financeiro</dt><dd>{PARAMS.financialSla.responseHours}h</dd>
        </dl>
      </Card>
      <button className="btn btn-primary btn-block mt" disabled={!photo} onClick={() => {
        commit(() => {
          PAYMENT_REQUESTS.unshift({
            id: `pr-new-${Date.now()}`, number: `SQ-${7500 + PAYMENT_REQUESTS.length}`, customerId: c.id, sellerId: c.sellerId, method,
            amountCents: target?.openCents ?? 0, receivableDoc: target?.doc ?? "Não identificado", createdAt: nowStamp(),
            status: "pending", attachmentName: "comprovante-pagamento.jpg", attachmentDataUrl: photo!,
          });
          notify({ link: { t: "proof", id: PAYMENT_REQUESTS[0]!.id }, kind: "financeiro", title: `Novo comprovante ${method}`, text: `${c.tradeName} · ${target ? target.doc : "débito não identificado"} · ${brl(target?.openCents ?? 0)} · enviado por ${sellerById.get(c.sellerId)?.name}.`, to: ["finance", ...MANAGERS_KEYS] });
        }, "Comprovante enviado ao financeiro · acompanhe o status em Pendências");
        onClose();
      }}><Send size={16} /> Enviar ao financeiro</button>
    </Sheet>
  );
}

// ------------------------------------------------------------------ pedido / orçamento
export function OrderBuilder({ c, kind, onClose, onDone, editing, fromQuote }: { c: Customer; kind: "ORDER" | "QUOTE" | "SIMPLE_QUOTE"; onClose: () => void; onDone?: () => void; editing?: Order; fromQuote?: Order }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [items, setItems] = useState<{ productId: string; qty: number }[]>(() => (editing ?? fromQuote) ? (editing ?? fromQuote)!.items.map((it) => ({ productId: it.productId, qty: it.qty })) : []);
  const [term, setTerm] = useState<number | null>(editing ? editing.paymentTermDays : fromQuote ? fromQuote.paymentTermDays : null);
  const [fiscal, setFiscal] = useState<"com_nf" | "sem_nf" | null>(editing?.fiscalDoc ?? null);
  const fin = financial(c);
  const cats = [...new Set(PRODUCTS.map((p) => p.category))];
  const filtered = PRODUCTS.filter((p) => (!cat || p.category === cat) && (`${p.commercialName} ${p.code} ${p.category} ${p.fiscalName}`.toLowerCase().includes(q.toLowerCase())));
  const total = items.reduce((s, it) => s + it.qty * PRODUCTS.find((p) => p.id === it.productId)!.priceCents, 0);
  const stock = useMemo(() => checkStock(items.map((it) => {
    const p = PRODUCTS.find((x) => x.id === it.productId)!;
    return { productId: p.id, productName: p.commercialName, unit: p.unit, requestedQty: it.qty, availableQty: p.stock };
  }), PARAMS.orders.allowOversell), [items]);
  const decision = total > 0 ? decidePaymentTerm(total, term ?? 0, PARAMS.paymentTerms.rules) : null;
  const recommended = decision?.recommendedDays ?? 7;
  const granted = term ?? recommended;
  const notice = orderSubmissionNotice(fin.creditStatus);
  const setQty = (id: string, qty: number) => setItems((xs) => (qty <= 0 ? xs.filter((x) => x.productId !== id) : xs.map((x) => (x.productId === id ? { ...x, qty } : x))));
  const add = (id: string) => setItems((xs) => (xs.some((x) => x.productId === id) ? xs.map((x) => (x.productId === id ? { ...x, qty: x.qty + 1 } : x)) : [...xs, { productId: id, qty: 1 }]));
  const title = editing ? `Editar ${editing.number}` : fromQuote ? `Transformar ${fromQuote.number} em pedido` : kind === "ORDER" ? "Pedido direto" : kind === "QUOTE" ? "Orçamento completo" : "Orçamento simples";

  function save(status: string, message: string) {
    if (editing) {
      commit(() => {
        const before = { total: editing.totalCents, counted: !["draft", "cancelled"].includes(editing.status) };
        const oldTotal = editing.totalCents;
        editing.items = items.map((it) => ({ ...it, unitPriceCents: PRODUCTS.find((p) => p.id === it.productId)!.priceCents }));
        editing.totalCents = total; editing.paymentTermDays = granted; editing.recommendedTermDays = recommended;
        if (fiscal) editing.fiscalDoc = fiscal;
        editing.status = status; editing.editedAt = nowStamp(); editing.editCount = (editing.editCount ?? 0) + 1;
        logOrder(editing, sellerById.get(c.sellerId)?.name ?? "Vendedor", `Alterado pelo vendedor · ${brl(oldTotal)} → ${brl(total)} · volta para análise`);
        applySalesDelta(editing, before);
        if (status !== "draft") {
          c.lastPurchaseDate = TODAY; c.lastPurchaseCents = total;
          notify({ link: { t: "order", id: editing.id },
            kind: "financeiro", priority: "high", title: "Pedido alterado pelo vendedor",
            text: `${editing.number} · ${c.tradeName} · ${brl(oldTotal)} → ${brl(total)} · prazo ${termLabel(granted)} · volta para o financeiro.`,
            to: ["finance", ...MANAGERS_KEYS],
          });
        }
      }, message);
      (onDone ?? onClose)();
      return;
    }
    commit(() => {
      const o: Order = {
        id: `n${Date.now()}`, number: kind === "ORDER" ? `PV-${58500 + ORDERS.length}` : `ORC-${3200 + ORDERS.length}`, kind,
        customerId: c.id, sellerId: c.sellerId, status, createdAt: nowStamp(), totalCents: total,
        paymentTermDays: granted, recommendedTermDays: recommended, expectedDelivery: null,
        items: items.map((it) => ({ ...it, unitPriceCents: PRODUCTS.find((p) => p.id === it.productId)!.priceCents })),
        ...(kind === "ORDER" && fiscal ? { fiscalDoc: fiscal } : {}),
      };
      o.log = [{ at: o.createdAt, by: sellerById.get(c.sellerId)?.name ?? "Vendedor", text: status === "draft" ? "Rascunho salvo" : `${fromQuote ? `Orçamento ${fromQuote.number} transformado em pedido · ` : "Pedido emitido · "}${status === "blocked" ? "bloqueado pelo crédito" : "enviado ao crédito"}` }];
      if (kind === "QUOTE" || kind === "SIMPLE_QUOTE") o.log = [{ at: o.createdAt, by: sellerById.get(c.sellerId)?.name ?? "Vendedor", text: "Orçamento criado" }];
      ORDERS.unshift(o);
      if (fromQuote && kind === "ORDER" && status !== "draft") {
        fromQuote.status = "converted";
        logOrder(fromQuote, sellerById.get(c.sellerId)?.name ?? "Vendedor", `Transformado no pedido ${o.number}`);
      }
      if (kind === "ORDER" && status !== "draft") {
        const s = SELLERS.find((x) => x.id === c.sellerId);
        if (s) { s.todayAchievedCents += total; s.monthAchievedCents += total; s.ordersMonth += 1; s.ordersToday += 1; }
        c.lastPurchaseDate = TODAY; c.lastPurchaseCents = total;
        notify({ link: { t: "order", id: o.id },
          kind: "financeiro", priority: status === "blocked" ? "high" : "normal",
          title: status === "blocked" ? "Pedido bloqueado aguardando liberação" : "Novo pedido enviado ao crédito",
          text: `${o.number} · ${c.tradeName} · ${brl(total)} · ${fiscal === "sem_nf" ? "sem NF" : "com NF"} · prazo ${termLabel(granted)}${granted !== recommended ? ` (recomendado ${termLabel(recommended)})` : ""} · ${sellerById.get(c.sellerId)?.name}.`,
          to: ["finance", ...MANAGERS_KEYS],
        });
      }
    }, message);
    (onDone ?? onClose)();
  }

  return (
    <Sheet title={`${title} · ${c.tradeName}`} onClose={onClose} wide icon={<ShoppingCart size={18} />}>
      {notice && kind === "ORDER" && (
        <div className="card mb" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)" }}>
          <div className="flex semi red small"><Lock size={16} /> {notice}</div>
        </div>
      )}
      <div className="grid gd gd-2">
        <div>
          <div className="search mb"><Search size={17} /><input className="input" placeholder="Buscar por nome, categoria ou código" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="chips mb"><Chip on={!cat} onClick={() => setCat(null)}>Todos</Chip>{cats.map((x) => <Chip key={x} on={cat === x} onClick={() => setCat(x)}>{x}</Chip>)}</div>
          <div className="list">
            {filtered.map((p) => {
              const qty = items.find((x) => x.productId === p.id)?.qty ?? 0;
              const over = qty > 0 && !PARAMS.orders.allowOversell && qty > p.stock;
              return (
                <div key={p.id} className={`product-row ${qty ? "in-cart" : ""} ${over ? "over" : ""}`} onClick={() => { if (!qty) add(p.id); }}>
                  <div className="grow">
                    <div className="title flex" style={{ gap: 6 }}>{p.commercialName}{qty > 0 && <span key={qty} className="qty-badge">×{qty}</span>}</div>
                    <div className="sub">{p.code} · {p.packaging} · <span title={p.fiscalName}>fiscal: {p.fiscalName}</span></div>
                    <div className="flex wrap" style={{ gap: 8, marginTop: 4 }}>
                      <span className="num semi small">{brl(p.priceCents)}</span>
                      <span className={`xs ${p.stock === 0 ? "red semi" : p.stock < 10 ? "gold semi" : "muted"}`}>{p.stock === 0 ? "Sem estoque" : `Estoque ${p.stock}`}</span>
                    </div>
                    {qty > 0 && (
                      <div className={`xs semi ${over ? "red" : "green"}`} style={{ marginTop: 4 }}>
                        {qty} × {brl(p.priceCents)} = {brl(qty * p.priceCents)}{over ? ` · disponível ${p.stock}` : " · no pedido"}
                      </div>
                    )}
                  </div>
                  {qty === 0 ? (
                    <button className="step-btn plus add-first" onClick={(e) => { e.stopPropagation(); add(p.id); }} aria-label="Adicionar"><Plus size={18} /></button>
                  ) : (
                    <Stepper value={qty} onChange={(v) => setQty(p.id, v)} label={`Quantidade de ${p.commercialName}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="stack">
          <Card title={`Itens (${items.length})`}>
            {!items.length && <div className="small muted">Adicione produtos ao lado.</div>}
            {stock.items.map((it) => (
              <div key={it.productId} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div className="flex between">
                  <span className="semi small">{it.productName}</span>
                  <Stepper size="sm" value={it.requestedQty} onChange={(v) => setQty(it.productId, v)} label={`Quantidade de ${it.productName}`} />
                </div>
                {it.status !== "ok" && (
                  <div className="mt" style={{ padding: 10, borderRadius: 12, background: it.status === "out_of_stock" ? "var(--danger-soft)" : "var(--warning-soft)" }}>
                    <div className={`small semi ${it.status === "out_of_stock" ? "red" : "gold"}`}>{it.message}</div>
                    <div className="flex wrap mt" style={{ gap: 6 }}>
                      {it.actions.includes("use_available") && <button className="btn btn-ghost btn-sm" onClick={() => setQty(it.productId, it.availableQty)}>Usar {it.availableQty}</button>}
                      {it.actions.includes("change_item") && <button className="btn btn-ghost btn-sm" onClick={() => { setQty(it.productId, 0); setQ(""); }}>Alterar item</button>}
                      {it.actions.includes("substitute_or_complement") && <button className="btn btn-ghost btn-sm" onClick={() => { setQty(it.productId, it.availableQty); setCat(PRODUCTS.find((p) => p.id === it.productId)!.category); }}>Complementar c/ outro</button>}
                      <button className="btn btn-ghost btn-sm" onClick={() => setQty(it.productId, 0)}><Trash2 size={13} /> Excluir</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex between mt"><span className="t2">Total</span><b className="num" style={{ fontSize: 20 }}>{brl(total)}</b></div>
          </Card>
          {kind !== "SIMPLE_QUOTE" && (
            <Card title="Condição de pagamento">
              <div className="small t2 mb">Prazo recomendado para {brl(total)}: <b>{termLabel(recommended)}</b></div>
              <div className="chips">{PAYMENT_TERM_OPTIONS.map((d) => <Chip key={d} on={granted === d} onClick={() => setTerm(d)}>{termLabel(d)}</Chip>)}</div>
              {decision && granted !== recommended && (
                <div className="mt"><Badge tone={granted > recommended ? "warning" : "info"}>
                  Prazo {granted > recommended ? "maior" : "menor"} que o recomendado · será registrado no KPI de prazo
                </Badge></div>
              )}
            </Card>
          )}
          {kind === "ORDER" && (
            <Card title="Nota fiscal" sub="escolha antes de emitir" className={fiscal ? "" : "needs-answer"}>
              <div className="grid g2" style={{ marginBottom: 0 }}>
                <button className={`route-pick ${fiscal === "com_nf" ? "on" : ""}`} onClick={() => setFiscal("com_nf")}><b>Com nota</b><span className="xs">NF emitida no faturamento</span></button>
                <button className={`route-pick ${fiscal === "sem_nf" ? "on" : ""}`} onClick={() => setFiscal("sem_nf")}><b>Sem nota</b><span className="xs">pedido sem NF</span></button>
              </div>
            </Card>
          )}
          {kind === "ORDER" ? (
            <>
              <button className="btn btn-primary btn-block" disabled={!items.length || !stock.canIssue || !fiscal}
                onClick={() => save(fin.creditStatus === "blocked" ? "blocked" : "awaiting_credit_review", fin.creditStatus === "blocked" ? "Pedido salvo · bloqueado até liberação do financeiro" : "Pedido enviado ao crédito")}>
                {!stock.canIssue ? `Resolva ${stock.blockingCount} item(ns) sem estoque` : !fiscal ? "Escolha: com ou sem nota fiscal" : editing && editing.status !== "draft" ? "Salvar alterações · volta para análise" : "Emitir pedido"}
              </button>
              {(!editing || editing.status === "draft") && <button className="btn btn-ghost btn-block" disabled={!items.length} onClick={() => save("draft", "Rascunho salvo")}>Salvar rascunho</button>}
            </>
          ) : kind === "QUOTE" ? (
            <div className="grid g2" style={{ marginBottom: 0 }}>
              <button className="btn btn-ghost" disabled={!items.length} onClick={() => save("draft", "Orçamento salvo como rascunho")}>Rascunho</button>
              <button className="btn btn-primary" disabled={!items.length} onClick={() => save("sent", "Orçamento enviado · PDF gerado")}>Enviar + PDF</button>
            </div>
          ) : (
            <button className="btn btn-primary btn-block" disabled={!items.length} onClick={() => { toast("Orçamento simples gerado em PDF · registrado só no histórico", "info"); onClose(); }}>Gerar PDF rápido</button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export function OrderRow({ o, onClick }: { o: Order; onClick?: () => void }) {
  const st = (o.kind === "QUOTE" ? QUOTE_STATUS : ORDER_STATUS) as unknown as Record<string, StatusDef>;
  const c = customerById.get(o.customerId);
  return (
    <div className={`order-row ${onClick ? "click" : ""}`} onClick={onClick}>
      <div className="flex between" style={{ gap: 8 }}>
        <span className="semi flex" style={{ gap: 6 }}>{o.number}{o.fiscalDoc && <span className={`nf-tag ${o.fiscalDoc}`}>{o.fiscalDoc === "com_nf" ? "com NF" : "sem NF"}</span>}{o.editCount ? <span className="xs muted">alterado</span> : null}</span>
        <b className="num">{brl(o.totalCents)}</b>
      </div>
      <div className="flex" style={{ gap: 6, marginTop: 3 }}>
        {c && <Curve c={c.abcd} />}<span className="order-customer">{c?.tradeName ?? "—"}</span>
      </div>
      <div className="flex between wrap" style={{ gap: 6, marginTop: 5 }}>
        <span className="xs muted">{fmtDateTime(o.createdAt)} · {o.items.length} {o.items.length === 1 ? "item" : "itens"} · {termLabel(o.paymentTermDays)}{o.invoiceNumber ? ` · ${o.invoiceNumber}` : ""}</span>
        <Badge tone={st[o.status]?.tone}>{orderStatusText(o)}</Badge>
      </div>
    </div>
  );
}

export function CustomerName({ id }: { id: string }) {
  return <>{customerById.get(id)?.tradeName ?? "—"}</>;
}

export function MiniBar({ value, max }: { value: number; max: number }) {
  return <Progress rel thin value={max ? (value / max) * 100 : 0} />;
}
export { fmtDate };
