/** Janelas de detalhe reutilizadas: comprovante, boleto, freezer. */
import { Fragment } from "react";
import { Receipt, Snowflake, MessageCircle } from "lucide-react";
import { PAYMENT_REQUEST_STATUS, daysBetween } from "@galato/domain";
import { customerById, sellerById, TODAY, type PaymentRequest, type Receivable, type Customer, type Asset } from "../data/mock";
import { toast } from "../data/store";
import { Badge, Card, Sheet, brl } from "./ui";
import { PatrimonyHistory } from "./freezer-occurrences";

const fmtD = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "—");

export function ProofView({ p, onClose }: { p: PaymentRequest; onClose: () => void }) {
  const c = customerById.get(p.customerId)!;
  const st = PAYMENT_REQUEST_STATUS[p.status];
  return (
    <Sheet title={`Comprovante ${p.number}`} onClose={onClose} icon={<Receipt size={18} />}>
      <Card>
        <dl className="kv">
          <dt>Cliente</dt><dd>{c.code} · {c.tradeName}</dd><dt>Vendedor</dt><dd>{sellerById.get(p.sellerId)?.name}</dd>
          <dt>Método</dt><dd>{p.method}</dd><dt>Débito</dt><dd>{p.receivableDoc}</dd><dt>Valor</dt><dd className="num">{brl(p.amountCents)}</dd>
          <dt>Enviado</dt><dd>{new Date(p.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</dd>
          <dt>Situação</dt><dd><Badge tone={st.tone}>{st.label}</Badge></dd>
          {p.response && <><dt>Resposta</dt><dd>{p.response}</dd></>}
        </dl>
      </Card>
      <div className="mt">
        {p.attachmentDataUrl ? <div className="photo-preview"><img src={p.attachmentDataUrl} alt="Comprovante" /></div>
          : <div className="upload done" style={{ padding: 24 }}>📎 {p.attachmentName}</div>}
      </div>
      <p className="xs muted mt">A resposta é do financeiro.</p>
    </Sheet>
  );
}

export function BoletoView({ c, x, onClose }: { c: Customer; x: Receivable; onClose: () => void }) {
  const late = x.dueDate < TODAY ? daysBetween(x.dueDate, TODAY) : 0;
  return (
    <Sheet title={`Boleto ${x.doc}`} onClose={onClose} icon={<Receipt size={18} />}>
      <Card>
        <dl className="kv">
          <dt>Cliente</dt><dd>{c.code} · {c.tradeName}</dd>
          <dt>Valor original</dt><dd className="num">{brl(x.amountCents)}</dd>
          <dt>Em aberto</dt><dd className="num semi">{brl(x.openCents)}</dd>
          <dt>Vencimento</dt><dd>{fmtD(x.dueDate)}</dd>
          <dt>Situação</dt><dd>{late ? <Badge tone="danger">Vencido há {late} dia(s)</Badge> : <Badge tone="info">A vencer · {daysBetween(TODAY, x.dueDate)} dia(s)</Badge>}</dd>
          <dt>Contato</dt><dd>{c.buyerName} · {c.whatsapp}</dd>
        </dl>
      </Card>
      <button className="btn btn-primary btn-block mt" onClick={() => { toast(`2ª via de ${x.doc} enviada para ${c.whatsapp}`, "success"); onClose(); }}>
        <MessageCircle size={16} /> Enviar 2ª via por WhatsApp
      </button>
    </Sheet>
  );
}

export function AssetView({ c, a, onClose }: { c: Customer; a: Asset; onClose: () => void }) {
  const fmt = a.format ?? (/vertical/i.test(a.type) ? "vertical" : "horizontal");
  return (
    <Sheet title={`Freezer · patrimônio ${a.patrimony}`} onClose={onClose} icon={<Snowflake size={18} />}>
      <Card>
        <dl className="kv">
          <dt>Cliente</dt><dd>{c.tradeName}</dd>
          <dt>Formato</dt><dd>{fmt === "vertical" ? "Vertical" : "Horizontal"}</dd>
          <dt>Marca</dt><dd>{a.brand ?? "Gelopar"}{a.model ? ` · ${a.model}` : ""}</dd>
          <dt>Litragem</dt><dd>{a.liters} L</dd>
          <dt>Voltagem</dt><dd>{a.voltage}</dd>
          <dt>Valor</dt><dd className="num">{brl(a.valueCents)}</dd>
        </dl>
      </Card>
      <PatrimonyHistory patrimony={a.patrimony} />
    </Sheet>
  );
}

/** Detalhe simples em lista (rótulo → valor). */
export function InfoSheet({ title, rows, onClose }: { title: string; rows: [string, React.ReactNode][]; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <Card><dl className="kv">{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl></Card>
    </Sheet>
  );
}
