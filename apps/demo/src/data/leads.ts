/**
 * Prospecção (pipeline): pré-cadastro → 1º contato → qualificação → proposta → negociação → cadastro → cliente (ou perdido).
 * Dados fictícios para a demonstração.
 */
import { classifyAbcd, addDays, type AbcdClass } from "@galato/domain";
import { PARAMS, SELLERS, TODAY, NOW, CUSTOMERS, customerById, type Customer } from "./mock";

export type LeadStage = "lead" | "contato" | "qualificacao" | "proposta" | "negociacao" | "cadastro" | "cliente" | "perdido";
export const STAGES: { id: LeadStage; label: string; next: string; tone: "neutral" | "info" | "warning" | "success" | "danger" | "brand" }[] = [
  { id: "lead", label: "Pré-cadastro", next: "Fazer o 1º contato", tone: "neutral" },
  { id: "contato", label: "1º contato", next: "Qualificar: marca, freezer e volume", tone: "info" },
  { id: "qualificacao", label: "Qualificação", next: "Montar a proposta", tone: "info" },
  { id: "proposta", label: "Proposta", next: "Aguardar a resposta do cliente", tone: "warning" },
  { id: "negociacao", label: "Negociação", next: "Fechar as condições", tone: "warning" },
  { id: "cadastro", label: "Cadastro", next: "Aguardando aprovação do financeiro", tone: "brand" },
  { id: "cliente", label: "Virou cliente", next: "Primeiro pedido liberado", tone: "success" },
  { id: "perdido", label: "Perdido", next: "Tentar de novo na data marcada", tone: "danger" },
];
export const OPEN_STAGES: LeadStage[] = ["lead", "contato", "qualificacao", "proposta", "negociacao", "cadastro"];
export const stageOf = (id: LeadStage) => STAGES.find((s) => s.id === id)!;

export const BUSINESS_TYPES = ["Padaria", "Bar", "Mercearia", "Sorveteria", "Restaurante", "Supermercado", "Lanchonete", "Conveniência", "Açaiteria"];
export const BRANDS = ["Kibon", "Nestlé", "Frutos de Goiás", "Marca regional", "Nenhuma", "Outra"];
export const PRODUCT_MIX = ["Picolé", "Pote", "Massa", "Açaí", "Cone"];
export const SWITCH_REASONS = ["Preço", "Prazo de pagamento", "Freezer em comodato", "Entrega/frequência", "Mix de produtos", "Atendimento"];
export const LOST_REASONS = ["Preço", "Contrato com concorrente", "Sem espaço para freezer", "Não vende sorvete", "Cliente fechou", "Sem interesse", "Outro"];
export const CONTACT_RESULTS = ["Falou com o dono", "Falou com funcionário", "Pediu para voltar outro dia", "Não estava aberto", "Por telefone/WhatsApp"];

export type DocKey = "cartao_cnpj" | "doc_responsavel" | "comprovante_comercial" | "comprovante_responsavel" | "contrato_social";
export interface LeadDoc { name: string; dataUrl: string; at: string }
export const DOCS: { key: DocKey; label: string; why: string; onlyPartner?: boolean }[] = [
  { key: "cartao_cnpj", label: "Cartão CNPJ", why: "comprova que a empresa existe e está ativa" },
  { key: "doc_responsavel", label: "Documento de identificação do responsável (RG/CNH)", why: "identifica o proprietário/responsável pelo CNPJ" },
  { key: "comprovante_comercial", label: "Comprovante de endereço comercial", why: "confirma o endereço do estabelecimento para entrega e cobrança" },
  { key: "comprovante_responsavel", label: "Comprovante de residência do responsável", why: "exigido pelo financeiro para liberar crédito" },
  { key: "contrato_social", label: "Contrato social", why: "obrigatório quando a empresa tem sócio", onlyPartner: true },
];
export const requiredDocs = (hasPartner?: boolean) => DOCS.filter((d) => !d.onlyPartner || hasPartner);

export interface Lead {
  id: string; sellerId: string; createdAt: string; stage: LeadStage;
  name: string; contact: string; phone: string; address: string; district: string; type: string; notes?: string;
  nextAt?: string; nextStep?: string;
  quali?: { brand: string; freezer: "proprio" | "concorrente" | "nao"; freezers: number; liters?: number; monthlyCents: number; freq: string; mix: string[]; switchReason: string[] };
  score?: AbcdClass;
  quote?: { items: { productId: string; qty: number }[]; totalCents: number };
  proposal?: { valueCents: number; comodato: boolean; termDays: number; note?: string };
  cadastro?: { cnpj: string; legalName: string; ie: string; cep: string; deliveryAddress: string; routeCode: string; sentAt?: string; status?: "pendente" | "aprovado" | "recusado" | "correcao"; reply?: string; limitCents?: number;
    /** documentos obrigatórios (fotos/arquivos), guardados com o cadastro e vistos pelo financeiro */
    docs?: Partial<Record<DocKey, LeadDoc>>; hasPartner?: boolean; ownerName?: string };
  /** origem: prospecção ativa ou receptivo (cliente veio até a Galato / pedido já fechado) */
  origin?: "ativo" | "receptivo";
  lostReason?: string; retryAt?: string; customerId?: string;
  log: { at: string; by: string; text: string }[];
}

const iso = (minAgo: number) => new Date(NOW.getTime() - minAgo * 60_000).toISOString();
const seed: [string, string, LeadStage, string, string, number][] = [
  // vendedor, nome, etapa, tipo, bairro, dias atrás
  ["s1", "Padaria Pão Quente", "lead", "Padaria", "Savassi", 0],
  ["s1", "Bar do Tião", "contato", "Bar", "Funcionários", 3],
  ["s1", "Mercearia Santa Luzia", "qualificacao", "Mercearia", "Lourdes", 6],
  ["s1", "Conveniência Posto Avenida", "proposta", "Conveniência", "Santo Agostinho", 9],
  ["s1", "Restaurante Sabor Mineiro", "negociacao", "Restaurante", "Savassi", 12],
  ["s1", "Açaí da Praça", "cadastro", "Açaiteria", "Funcionários", 15],
  ["s1", "Lanchonete Ponto Certo", "perdido", "Lanchonete", "Lourdes", 20],
  ["s2", "Supermercado Família Contagem", "qualificacao", "Supermercado", "Eldorado", 5],
  ["s2", "Padaria Doce Pão", "proposta", "Padaria", "Riacho", 8],
  ["s2", "Sorveteria Gelato Fino", "cliente", "Sorveteria", "Eldorado", 25],
  ["s3", "Bar Esquina Norte", "contato", "Bar", "Venda Nova", 2],
  ["s3", "Mercadinho Vila Clóris", "lead", "Mercearia", "Planalto", 1],
  ["s4", "Empório Serra Verde", "negociacao", "Mercearia", "Nova Lima", 10],
  ["s4", "Restaurante Lagoa", "perdido", "Restaurante", "Sabará", 18],
  ["s5", "Conveniência Neves", "proposta", "Conveniência", "Justinópolis", 7],
  ["s5", "Padaria São Benedito", "cadastro", "Padaria", "Santa Luzia", 14],
];
const contacts = ["Carlos Ramos", "Juliana Prado", "Seu Antônio", "Dona Lúcia", "Ricardo Melo", "Fernanda Costa", "Paulo Henrique", "Márcia Lopes"];
const order: LeadStage[] = ["lead", "contato", "qualificacao", "proposta", "negociacao", "cadastro", "cliente"];

export const LEADS: Lead[] = seed.map(([sellerId, name, stage, type, district, days], i) => {
  const seller = SELLERS.find((s) => s.id === sellerId)!;
  const start = days * 24 * 60 + 300;
  const l: Lead = {
    id: `ld${i + 1}`, sellerId, createdAt: iso(start), stage, name, type, district,
    contact: contacts[i % contacts.length]!, phone: `(31) 9${8000 + i * 37}-${1000 + i * 91}`.slice(0, 15),
    address: `Rua ${["das Acácias", "Itaú", "Pernambuco", "Bahia", "Ceará", "Tupis"][i % 6]}, ${100 + i * 23}`,
    log: [{ at: iso(start), by: seller.name, text: "Pré-cadastro criado" }],
  };
  const idx = order.indexOf(stage === "perdido" ? "proposta" : stage);
  if (idx >= 1) l.log.push({ at: iso(start - 600), by: seller.name, text: `1º contato · ${CONTACT_RESULTS[i % 3]}` });
  if (idx >= 2) {
    const monthly = [420_000, 210_000, 120_000, 60_000][i % 4]!;
    const fz = (["concorrente", "proprio", "nao"] as const)[i % 3]!;
    l.quali = { brand: BRANDS[i % 4]!, freezer: fz, freezers: (i % 3) + 1, liters: 311, monthlyCents: monthly, freq: ["Semanal", "Quinzenal"][i % 2]!, mix: ["Picolé", "Pote"], switchReason: [SWITCH_REASONS[i % SWITCH_REASONS.length]!] };
    l.score = classifyAbcd(monthly, PARAMS.abcd.rules);
    l.log.push({ at: iso(start - 1400), by: seller.name, text: `Qualificado · trabalha com ${l.quali!.brand} · potencial ${l.score}` });
  }
  if (idx >= 3) { l.proposal = { valueCents: Math.round((l.quali?.monthlyCents ?? 100_000) * 0.6), comodato: i % 2 === 0, termDays: 14 }; l.log.push({ at: iso(start - 2400), by: seller.name, text: "Proposta enviada" }); }
  if (idx >= 4) l.log.push({ at: iso(start - 3200), by: seller.name, text: "Em negociação · cliente pediu prazo maior" });
  if (idx >= 5) {
    l.cadastro = { cnpj: `${10 + i}.${300 + i}.${400 + i}/0001-${10 + i}`, legalName: `${name.toUpperCase()} LTDA`, ie: `${100000 + i * 7}`, cep: "30140-000", deliveryAddress: l.address, routeCode: PARAMS.commercialRoutes[i % PARAMS.commercialRoutes.length]!.code, sentAt: iso(start - 4000), status: stage === "cliente" ? "aprovado" : "pendente" };
    l.log.push({ at: iso(start - 4000), by: seller.name, text: "Cadastro completo enviado ao financeiro" });
  }
  if (stage === "perdido") { l.lostReason = LOST_REASONS[i % LOST_REASONS.length]; l.retryAt = addDays(TODAY, 60); l.log.push({ at: iso(start - 4200), by: seller.name, text: `Perdido · ${l.lostReason}` }); }
  if (stage === "lead") { l.nextAt = TODAY; }
  if (stage === "contato") { l.nextAt = addDays(TODAY, 1); }
  return l;
});

/** Cria o cliente quando o cadastro é aprovado. */
export function leadToCustomer(l: Lead, limitCents: number): Customer {
  const seller = SELLERS.find((s) => s.id === l.sellerId)!;
  const avg = l.quali?.monthlyCents ?? 0;
  const c: Customer = {
    id: `c-${l.id}`, code: String(20000 + CUSTOMERS.length), legalName: l.cadastro?.legalName ?? l.name.toUpperCase(), tradeName: l.name,
    document: l.cadastro?.cnpj ?? "", address: l.cadastro?.deliveryAddress || l.address, district: l.district, city: "Belo Horizonte", state: "MG",
    cep: l.cadastro?.cep ?? "", region: seller.region, sellerId: l.sellerId, routeCode: l.cadastro?.routeCode ?? PARAMS.commercialRoutes[0]!.code,
    buyerName: l.contact || "—", phone: l.phone, whatsapp: l.phone,
    monthlyHistoryCents: Array(12).fill(0), avgMonthlyCents: avg, abcd: classifyAbcd(avg, PARAMS.abcd.rules),
    lastPurchaseDate: null, lastPurchaseCents: 0, assets: [], receivables: [], manualCreditBlock: false,
    notes: `Cliente vindo da prospecção · limite inicial ${Math.round(limitCents / 100)} reais.`,
  };
  CUSTOMERS.unshift(c);
  customerById.set(c.id, c);
  return c;
}
