/**
 * PDF do pedido/orçamento com a marca Galato (logo, moldura vermelha e amarela), para o vendedor
 * compartilhar com o cliente (WhatsApp, e-mail) ou baixar.
 */
import { jsPDF } from "jspdf";
import { PRODUCTS, customerById, sellerById, PARAMS } from "../data/mock";
import type { HistOrder } from "../data/history";
import { statusLabel } from "../data/selectors";

const RED: [number, number, number] = [200, 16, 46];
const YELLOW: [number, number, number] = [245, 168, 0];
const DARK: [number, number, number] = [35, 30, 30];
const GRAY: [number, number, number] = [120, 112, 110];
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const termo = (d: number) => (d === 0 ? "À vista / PIX" : `${d} dias`);

let logoCache: string | null = null;
async function logo(): Promise<string | null> {
  if (logoCache) return logoCache;
  try {
    const r = await fetch("./galato-logo.png");
    const b = await r.blob();
    logoCache = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); });
    return logoCache;
  } catch { return null; }
}

export async function gerarPdfPedido(o: HistOrder & { kind?: string }): Promise<{ blob: Blob; nome: string }> {
  const c = customerById.get(o.customerId)!;
  const s = sellerById.get(o.sellerId);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;
  const quote = o.kind && o.kind !== "ORDER";

  // moldura: faixa vermelha externa + filete amarelo + cantos arredondados
  doc.setDrawColor(...RED); doc.setLineWidth(2.2); doc.roundedRect(7, 7, W - 14, H - 14, 6, 6);
  doc.setDrawColor(...YELLOW); doc.setLineWidth(0.9); doc.roundedRect(10.5, 10.5, W - 21, H - 21, 4.5, 4.5);

  // cabeçalho
  doc.setFillColor(...RED); doc.roundedRect(14, 14, W - 28, 34, 4, 4, "F");
  doc.setFillColor(...YELLOW); doc.rect(14, 44, W - 28, 4, "F");
  const lg = await logo();
  if (lg) { doc.setFillColor(255, 255, 255); doc.circle(32, 31, 13.5, "F"); doc.addImage(lg, "PNG", 19.5, 18.5, 25, 25); }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("Galato Sorvetes", 50, 28);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(quote ? "Orçamento" : "Pedido de venda", 50, 35);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(o.number, W - 20, 28, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  const quando = o.createdAt ? new Date(o.createdAt).toLocaleString("pt-BR", { timeZone: PARAMS.timezone, day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : new Date(`${o.date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" });
  doc.text(quando, W - 20, 35, { align: "right" });
  if (o.invoiceNumber) doc.text(o.invoiceNumber, W - 20, 41, { align: "right" });

  // bloco cliente
  let y = 58;
  const bloco = (titulo: string, linhas: string[], x: number, w: number) => {
    doc.setDrawColor(235, 225, 215); doc.setLineWidth(0.4); doc.setFillColor(252, 249, 245);
    doc.roundedRect(x, y, w, 8 + linhas.length * 5.4, 3, 3, "FD");
    doc.setTextColor(...RED); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.text(titulo.toUpperCase(), x + 4, y + 5.5);
    doc.setTextColor(...DARK); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    linhas.forEach((l, i) => doc.text(doc.splitTextToSize(l, w - 8)[0] as string, x + 4, y + 11 + i * 5.4));
  };
  bloco("Cliente", [c.tradeName, c.legalName, `CNPJ ${c.document} · cód. ${c.code}`, `${c.address} · ${c.district}`, `${c.city}/${c.state} · ${c.buyerName} · ${c.phone}`], 14, 112);
  bloco("Condições", [`Vendedor: ${s?.name ?? "—"}`, `Pagamento: ${termo(o.paymentTermDays)}`, `Nota fiscal: ${o.fiscalDoc === "sem_nf" ? "sem NF" : "com NF"}`, `Situação: ${statusLabel(o.status)}`], 130, W - 144);
  y += 8 + 5 * 5.4 + 8;

  // itens
  const cols = [14, 100, 128, 156];
  doc.setFillColor(...RED); doc.roundedRect(14, y, W - 28, 9, 2, 2, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Produto", cols[0]! + 3, y + 6); doc.text("Qtd.", cols[1]! + 12, y + 6, { align: "right" }); doc.text("Preço unit.", cols[2]! + 24, y + 6, { align: "right" }); doc.text("Total", W - 17, y + 6, { align: "right" });
  y += 9;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  o.items.forEach((it, i) => {
    if (y > H - 60) { doc.addPage(); doc.setDrawColor(...RED); doc.setLineWidth(2.2); doc.roundedRect(7, 7, W - 14, H - 14, 6, 6); y = 20; }
    const p = PRODUCTS.find((x) => x.id === it.productId);
    if (i % 2 === 1) { doc.setFillColor(253, 246, 232); doc.rect(14, y, W - 28, 8, "F"); }
    doc.setTextColor(...DARK);
    doc.text(doc.splitTextToSize(`${p?.commercialName ?? it.productId}${p ? ` · ${p.packaging}` : ""}`, 84)[0] as string, cols[0]! + 3, y + 5.5);
    doc.text(`${it.qty} ${p?.unit ?? ""}`.trim(), cols[1]! + 12, y + 5.5, { align: "right" });
    doc.text(brl(it.unitPriceCents), cols[2]! + 24, y + 5.5, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.text(brl(it.qty * it.unitPriceCents), W - 17, y + 5.5, { align: "right" }); doc.setFont("helvetica", "normal");
    y += 8;
  });
  doc.setDrawColor(...YELLOW); doc.setLineWidth(0.8); doc.line(14, y + 1, W - 14, y + 1);

  // total
  y += 6;
  doc.setFillColor(...YELLOW); doc.roundedRect(W - 88, y, 74, 16, 3, 3, "F");
  doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("TOTAL", W - 84, y + 10);
  doc.setFontSize(15); doc.text(brl(o.totalCents), W - 18, y + 10.5, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
  doc.text(`${o.items.length} ${o.items.length === 1 ? "item" : "itens"} · ${o.items.reduce((a, i) => a + i.qty, 0)} volumes`, 14, y + 10);

  // rodapé
  doc.setFontSize(8.5); doc.setTextColor(...GRAY);
  doc.text(quote ? "Orçamento sujeito a confirmação de estoque e aprovação de crédito." : "Pedido sujeito à análise de crédito e confirmação de estoque.", W / 2, H - 22, { align: "center" });
  doc.setTextColor(...RED); doc.setFont("helvetica", "bold"); doc.text("Galato Sorvetes · Plataforma integrada", W / 2, H - 17, { align: "center" });

  const nome = `${quote ? "Orcamento" : "Pedido"}-${o.number}-${c.tradeName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-")}.pdf`;
  return { blob: doc.output("blob"), nome };
}

/** Compartilha (celular: WhatsApp, e-mail…) ou baixa o PDF. */
export async function compartilharPdf(o: HistOrder & { kind?: string }, modo: "share" | "download" = "share") {
  const { blob, nome } = await gerarPdfPedido(o);
  const file = new File([blob], nome, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (modo === "share" && nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: nome.replace(".pdf", ""), text: `Pedido ${o.number} · Galato Sorvetes` }); return "shared"; }
    catch (e) { if ((e as Error).name === "AbortError") return "cancelled"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
