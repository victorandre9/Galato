/** Abre um pedido: detalhe com linha do tempo e, para o vendedor, editar/cancelar. */
import { useState } from "react";
import { Pencil, XCircle, Lock, ArrowRightCircle } from "lucide-react";
import { customerById, ORDERS, type Order } from "../data/mock";
import { liveToHist } from "../data/history";
import { isOrderEditable, cancelOrder } from "../data/orders";
import { commit, useStore } from "../data/store";
import { ConfirmModal } from "./ui";
import { OrderBuilder } from "./business";
import { OrderDetail } from "../screens/Reports";

export function OrderOpen({ order, canEdit, onClose }: { order: Order; canEdit: boolean; onClose: () => void }) {
  useStore();
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const o = ORDERS.find((x) => x.id === order.id) ?? order;
  if (converting)
    return <OrderBuilder c={customerById.get(o.customerId)!} kind="ORDER" fromQuote={o} onClose={() => setConverting(false)} onDone={onClose} />;
  if (editing)
    return <OrderBuilder c={customerById.get(o.customerId)!} kind="ORDER" editing={o} onClose={() => setEditing(false)} onDone={() => setEditing(false)} />;
  return (
    <OrderDetail o={liveToHist(o)} onClose={onClose}
      actions={canEdit ? (o.kind === "ORDER" ? <OrderActions o={o} onEdit={() => setEditing(true)} onDone={onClose} /> : <QuoteActions o={o} onConvert={() => setConverting(true)} />) : undefined} />
  );
}

const OPEN_QUOTE_STATUSES = ["draft", "ready", "sent", "awaiting_customer", "negotiation", "approved"];
function QuoteActions({ o, onConvert }: { o: Order; onConvert: () => void }) {
  if (o.status === "converted") return <div className="small t2 mt" style={{ padding: 10, borderRadius: 12, background: "var(--neutral-soft)" }}>Este orçamento já virou pedido (veja a linha do tempo).</div>;
  if (!OPEN_QUOTE_STATUSES.includes(o.status)) return null;
  return (
    <button className="btn btn-primary btn-block mt" onClick={onConvert}><ArrowRightCircle size={16} /> Transformar em pedido</button>
  );
}

function OrderActions({ o, onEdit, onDone }: { o: Order; onEdit: () => void; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("Cliente desistiu");
  if (o.kind !== "ORDER") return null;
  if (!isOrderEditable(o))
    return o.status === "cancelled" ? null : (
      <div className="small t2 mt" style={{ padding: 10, borderRadius: 12, background: "var(--neutral-soft)" }}>
        <Lock size={14} /> Pedido já liberado pelo crédito: não pode mais ser alterado pelo vendedor. Para mudar, fale com o financeiro/faturamento.
      </div>
    );
  return (
    <>
      <div className="small mt" style={{ padding: 10, borderRadius: 12, background: "var(--info-soft)" }}>
        Ainda em {o.status === "draft" ? "rascunho" : "análise do financeiro"}: você pode alterar itens, quantidades e prazo{o.editCount ? ` · alterado ${o.editCount}x` : ""}.
      </div>
      <div className="grid g2 mt" style={{ marginBottom: 0 }}>
        <button className="btn btn-primary" onClick={onEdit}><Pencil size={16} /> Editar pedido</button>
        <button className="btn btn-ghost" onClick={() => setConfirm(true)}><XCircle size={16} /> Cancelar pedido</button>
      </div>
      {confirm && (
        <ConfirmModal title={`Cancelar ${o.number}?`} confirmLabel="Cancelar pedido" danger onClose={() => setConfirm(false)}
          onConfirm={() => { commit(() => cancelOrder(o, reason), `${o.number} cancelado · financeiro e gestão avisados`); setConfirm(false); onDone(); }}
          text="O valor sai da sua venda do dia e do mês. O financeiro e a gestão são avisados.">
          <div className="field"><label>Motivo</label>
            <select id="cancel-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option>Cliente desistiu</option><option>Pedido duplicado</option><option>Erro de digitação</option><option>Outro</option>
            </select>
          </div>
        </ConfirmModal>
      )}
    </>
  );
}
