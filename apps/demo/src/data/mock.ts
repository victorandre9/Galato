/**
 * DADOS FICTÍCIOS para demonstração. Nenhum dado real de cliente.
 * Gerador determinístico (seed fixa): mesmos números a cada carregamento.
 * Datas relativas ao "hoje" de demonstração (último dia útil).
 */
import {
  DEFAULT_PARAMETERS, addDays, classifyAbcd, isBusinessDay, isoDateInTimezone, monthBounds,
  businessDaysBetween, businessDaysInMonth, routeForDate, type AbcdClass, type IsoDate,
  type OrderStatus, type PaymentRequestStatus, type DeliveryStatus, type PlatformParameters,
  type PaymentMethod,
} from "@galato/domain";

// ---------------------------------------------------------------- parâmetros
export const PARAMS: PlatformParameters = {
  ...DEFAULT_PARAMETERS,
  workCalendar: {
    workWeekdays: [1, 2, 3, 4, 5],
    holidays: [
      "2026-01-01", "2026-04-03", "2026-04-21", "2026-05-01", "2026-09-07", "2026-10-12",
      "2026-11-02", "2026-11-20", "2026-12-25",
    ],
  },
};

function lastBusinessDay(d: IsoDate): IsoDate {
  let x = d;
  while (!isBusinessDay(x, PARAMS.workCalendar)) x = addDays(x, -1);
  return x;
}
export const TODAY: IsoDate = lastBusinessDay(isoDateInTimezone(new Date(), PARAMS.timezone));
/** "agora" de demonstração: hoje às 14:20 (BRT) */
export const NOW = new Date(`${TODAY}T17:20:00Z`);

// ---------------------------------------------------------------- PRNG
let seed = 20261031;
function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const round = (cents: number, step = 100) => Math.round(cents / step) * step;

// ---------------------------------------------------------------- pessoas
export type Role =
  | "seller" | "sales_manager" | "sales_coordinator" | "general_manager"
  | "finance" | "billing" | "driver" | "transport_coordinator";

export interface Person { id: string; name: string; role: Role; email: string }
export interface Seller extends Person {
  role: "seller"; managerId: string; region: string;
  monthlyGoalCents: number; monthAchievedCents: number; todayAchievedCents: number;
  ordersMonth: number; visitsPlannedToday: number; visitsDoneToday: number;
}

export const MANAGERS: Person[] = [
  { id: "m1", name: "Ana Paula Ribeiro", role: "sales_manager", email: "ana.ribeiro@demo.galato" },
  { id: "m2", name: "Marcelo Costa", role: "sales_manager", email: "marcelo.costa@demo.galato" },
  { id: "m3", name: "Fernanda Dias", role: "sales_manager", email: "fernanda.dias@demo.galato" },
];
export const COORDINATOR: Person = { id: "c1", name: "Ricardo Nunes", role: "sales_coordinator", email: "ricardo.nunes@demo.galato" };
export const GENERAL_MANAGER: Person = { id: "g1", name: "Paulo Henrique Lopes", role: "general_manager", email: "paulo.lopes@demo.galato" };
export const FINANCE_USER: Person = { id: "f1", name: "Luciana Moreira", role: "finance", email: "luciana.moreira@demo.galato" };
export const BILLING_USER: Person = { id: "b1", name: "Thiago Mendes", role: "billing", email: "thiago.mendes@demo.galato" };
export const TRANSPORT_COORD: Person = { id: "t1", name: "Sérgio Andrade", role: "transport_coordinator", email: "sergio.andrade@demo.galato" };

const BD_MONTH = businessDaysInMonth(TODAY, PARAMS.workCalendar);
const BD_ELAPSED_BEFORE_TODAY = businessDaysBetween(monthBounds(TODAY).first, addDays(TODAY, -1), PARAMS.workCalendar);

const sellerSeeds = [
  { id: "s1", name: "Diego Martins", managerId: "m1", region: "Belo Horizonte Centro-Sul", goal: 150_000, perf: 0.97, visits: [24, 20] },
  { id: "s2", name: "Carla Souza", managerId: "m1", region: "Contagem / Betim", goal: 130_000, perf: 1.06, visits: [22, 20] },
  { id: "s3", name: "Rafael Lima", managerId: "m2", region: "Belo Horizonte Norte", goal: 120_000, perf: 0.81, visits: [26, 17] },
  { id: "s4", name: "Juliana Rocha", managerId: "m2", region: "Nova Lima / Sabará", goal: 110_000, perf: 0.92, visits: [23, 19] },
  { id: "s5", name: "Bruno Alves", managerId: "m3", region: "Ribeirão das Neves / Santa Luzia", goal: 100_000, perf: 0.74, visits: [25, 14] },
] as const;

export const SELLERS: Seller[] = sellerSeeds.map((s) => {
  const goal = s.goal * 100;
  const daily = goal / BD_MONTH;
  const month = round(daily * BD_ELAPSED_BEFORE_TODAY * s.perf * (0.95 + rnd() * 0.1));
  const today = round(daily * (s.perf - 0.25 + rnd() * 0.3));
  return {
    id: s.id, name: s.name, role: "seller", email: `${s.name.split(" ")[0]!.toLowerCase()}@demo.galato`,
    managerId: s.managerId, region: s.region, monthlyGoalCents: goal,
    monthAchievedCents: month + today, todayAchievedCents: today,
    ordersMonth: between(70, 140), visitsPlannedToday: s.visits[0], visitsDoneToday: s.visits[1],
  };
});
export const CURRENT_SELLER = SELLERS[0]!;

// ---------------------------------------------------------------- produtos
export interface Product {
  id: string; code: string; category: string; commercialName: string; fiscalName: string;
  packaging: string; unit: string; priceCents: number; stock: number; active: boolean;
}
const productSeeds: [string, string, string, string, number, number][] = [
  ["Picolés", "Picolé Chocolate", "Gelado comestível sabor chocolate em palito", "Caixa c/ 30 un", 8990, 140],
  ["Picolés", "Picolé Morango", "Gelado comestível sabor morango em palito", "Caixa c/ 30 un", 8490, 96],
  ["Picolés", "Picolé Limão", "Gelado comestível de fruta sabor limão em palito", "Caixa c/ 30 un", 7490, 9],
  ["Picolés", "Picolé Coco Cremoso", "Gelado comestível cremoso sabor coco em palito", "Caixa c/ 30 un", 8990, 0],
  ["Potes", "Pote 2L Napolitano", "Sorvete de massa sabores sortidos embalagem 2 litros", "Caixa c/ 6 un", 15990, 64],
  ["Potes", "Pote 2L Flocos", "Sorvete de massa sabor flocos embalagem 2 litros", "Caixa c/ 6 un", 15990, 38],
  ["Potes", "Pote 1,5L Açaí", "Preparado gelado de açaí com guaraná 1,5 litro", "Caixa c/ 6 un", 17490, 22],
  ["Massa", "Massa 10L Creme", "Sorvete de massa sabor creme embalagem 10 litros", "Balde 10 L", 11990, 31],
  ["Massa", "Massa 10L Chocolate", "Sorvete de massa sabor chocolate embalagem 10 litros", "Balde 10 L", 11990, 4],
  ["Drinks", "Gelinho", "Mistura de produto gelado para drink", "Caixa c/ 50 un", 6490, 210],
  ["Drinks", "Gelinho Maracujá", "Mistura de produto gelado para drink sabor maracujá", "Caixa c/ 50 un", 6490, 0],
  ["Cones", "Cone Crocante Baunilha", "Sorvete em cone de biscoito sabor baunilha", "Caixa c/ 24 un", 10990, 57],
  ["Açaí", "Açaí na Tigela 300ml", "Preparado gelado de açaí 300 ml", "Caixa c/ 12 un", 9890, 44],
  ["Sundae", "Sundae Caramelo", "Sobremesa gelada sabor caramelo copo 180 ml", "Caixa c/ 12 un", 8790, 18],
];
export const PRODUCTS: Product[] = productSeeds.map(([category, commercialName, fiscalName, packaging, price, stock], i) => ({
  id: `p${i + 1}`, code: `GL-${String(1001 + i)}`, category, commercialName, fiscalName, packaging,
  unit: packaging.startsWith("Balde") ? "baldes" : "caixas", priceCents: price, stock, active: true,
}));

// ---------------------------------------------------------------- ativos
export const ASSET_TYPES = [
  { type: "Freezer horizontal 2 tampas 419 L", model: "FH-419", voltage: "220V", liters: 419, valueCents: 380_000 },
  { type: "Freezer vertical expositor 300 L", model: "FV-300", voltage: "127V", liters: 300, valueCents: 450_000 },
  { type: "Freezer ilha expositor 520 L", model: "FI-520", voltage: "220V", liters: 520, valueCents: 620_000 },
] as const;
export interface Asset {
  id: string; patrimony: string; type: string; model: string; voltage: string; liters: number;
  valueCents: number; status: "installed" | "stock" | "maintenance"; customerId: string | null;
}

// ---------------------------------------------------------------- clientes
export interface Receivable { id: string; doc: string; amountCents: number; openCents: number; dueDate: IsoDate; paidDate: IsoDate | null }
export interface Customer {
  id: string; code: string; legalName: string; tradeName: string; document: string;
  address: string; district: string; city: string; state: string; cep: string; region: string;
  sellerId: string; routeCode: string; buyerName: string; phone: string; whatsapp: string;
  monthlyHistoryCents: number[]; avgMonthlyCents: number; abcd: AbcdClass;
  lastPurchaseDate: IsoDate | null; lastPurchaseCents: number; assets: Asset[];
  receivables: Receivable[]; manualCreditBlock: boolean; notes: string;
}

const prefixes = ["Mercearia", "Padaria", "Lanchonete", "Bar", "Supermercado", "Mercadinho", "Sorveteria", "Restaurante", "Empório", "Conveniência", "Açaiteria", "Distribuidora"];
const cores = ["São Jorge", "Bom Preço", "Pão Dourado", "Boa Vista", "Central", "Dona Maria", "Do Zé", "Recanto", "Estrela", "Primavera", "Esquina", "Ouro Verde", "Sol Nascente", "Pampulha", "Serra", "Ipê Amarelo", "Real", "União", "Bela Vista", "Nova Era", "Família", "Avenida", "Aliança", "Vitória", "Do Bairro", "Mineiro", "Jardim", "Paraíso", "Santa Rita", "Sabor da Vila"];
const streets = ["Rua das Flores", "Av. Amazonas", "Rua Padre Eustáquio", "Av. João César de Oliveira", "Rua Itapecerica", "Av. Cristiano Machado", "Rua Pará de Minas", "Av. Portugal", "Rua Jacuí", "Av. Afonso Pena", "Rua Espírito Santo", "Av. Babita Camargos"];
const firstNames = ["José", "Maria", "Antônio", "Cláudia", "Roberto", "Patrícia", "Marcos", "Sandra", "Luiz", "Renata", "Wellington", "Simone", "Geraldo", "Aparecida", "Fábio"];
const lastNames = ["Silva", "Santos", "Oliveira", "Pereira", "Ferreira", "Gomes", "Ribeiro", "Carvalho", "Teixeira", "Almeida"];
const sellerCities: Record<string, [string, string][]> = {
  s1: [["Belo Horizonte", "Savassi"], ["Belo Horizonte", "Funcionários"], ["Belo Horizonte", "Santo Agostinho"], ["Belo Horizonte", "Lourdes"]],
  s2: [["Contagem", "Eldorado"], ["Contagem", "Industrial"], ["Betim", "Centro"], ["Betim", "Angola"]],
  s3: [["Belo Horizonte", "Venda Nova"], ["Belo Horizonte", "Planalto"], ["Belo Horizonte", "São Bernardo"]],
  s4: [["Nova Lima", "Centro"], ["Nova Lima", "Vila da Serra"], ["Sabará", "General Carneiro"]],
  s5: [["Ribeirão das Neves", "Justinópolis"], ["Santa Luzia", "São Benedito"], ["Santa Luzia", "Centro"]],
};

const usedNames = new Set<string>();
function companyName() {
  for (;;) {
    const n = `${pick(prefixes)} ${pick(cores)}`;
    if (!usedNames.has(n)) { usedNames.add(n); return n; }
    if (usedNames.size > 340) return `${n} ${usedNames.size}`;
  }
}
function cnpj() {
  const d = () => between(0, 9);
  return `${d()}${d()}.${d()}${d()}${d()}.${d()}${d()}${d()}/0001-${d()}${d()}`;
}
function phone() { return `(31) 9${between(8000, 9999)}-${between(1000, 9999)}`; }

export const CUSTOMERS: Customer[] = [];
export const ASSETS: Asset[] = [];
let assetSeq = 120;
let custSeq = 0;
const PER_ROUTE = 12;

for (const s of SELLERS) {
  for (const route of PARAMS.commercialRoutes) {
    for (let k = 0; k < PER_ROUTE; k++) {
      custSeq++;
      const id = `c${custSeq}`;
      const tier = rnd();
      const base = tier < 0.18 ? between(3200, 7500) : tier < 0.45 ? between(1650, 2900) : tier < 0.75 ? between(820, 1550) : between(150, 780);
      const history = Array.from({ length: 6 }, () => round(base * 100 * (0.6 + rnd() * 0.8)));
      const avg = Math.round(history.slice(-PARAMS.abcd.averageWindowMonths).reduce((a, b) => a + b, 0) / PARAMS.abcd.averageWindowMonths);
      const r = rnd();
      const daysAgo = r < 0.5 ? between(0, 6) : r < 0.68 ? between(7, 13) : r < 0.8 ? between(14, 20) : r < 0.88 ? between(21, 27) : r < 0.97 ? between(28, 75) : -1;
      const lastPurchaseDate = daysAgo < 0 ? null : addDays(TODAY, -daysAgo);
      const [city, district] = pick(sellerCities[s.id]!);
      const nm = companyName();
      const freezerCount = rnd() < 0.55 ? (rnd() < 0.7 ? 1 : rnd() < 0.7 ? 2 : 3) : 0;
      const assets: Asset[] = Array.from({ length: freezerCount }, () => {
        const t = pick(ASSET_TYPES);
        const a: Asset = {
          id: `a${++assetSeq}`, patrimony: String(assetSeq).padStart(6, "0"), type: t.type, model: t.model,
          voltage: t.voltage, liters: t.liters, valueCents: t.valueCents, status: "installed", customerId: id,
        };
        ASSETS.push(a);
        return a;
      });
      const receivables: Receivable[] = [];
      const nRec = between(0, 3);
      for (let j = 0; j < nRec; j++) {
        const amount = round(between(300, 2400) * 100, 1);
        const due = addDays(TODAY, between(-25, 21));
        const overdue = due < TODAY;
        const paidLate = overdue && rnd() < 0.55;
        receivables.push({
          id: `${id}-r${j}`, doc: `BOL ${between(40000, 49999)}`, amountCents: amount,
          openCents: paidLate ? 0 : amount, dueDate: due, paidDate: paidLate ? addDays(due, between(1, 9)) : null,
        });
      }
      const fn = pick(firstNames), ln = pick(lastNames);
      CUSTOMERS.push({
        id, code: String(10000 + custSeq), legalName: `${nm} ${pick(["Ltda", "ME", "EIRELI", "Comércio Ltda"])}`.toUpperCase(),
        tradeName: nm, document: cnpj(), address: `${pick(streets)}, ${between(10, 2900)}`, district, city, state: "MG",
        cep: `3${between(0, 4)}${between(100, 999)}-${between(100, 999)}`, region: s.region, sellerId: s.id,
        routeCode: route.code, buyerName: `${fn} ${ln}`, phone: phone(), whatsapp: phone(),
        monthlyHistoryCents: history, avgMonthlyCents: avg, abcd: classifyAbcd(avg, PARAMS.abcd.rules),
        lastPurchaseDate, lastPurchaseCents: lastPurchaseDate ? round(avg * (0.3 + rnd() * 0.5)) : 0,
        assets, receivables, manualCreditBlock: rnd() < 0.03,
        notes: rnd() < 0.3 ? pick(["Prefere entrega pela manhã.", "Comprador só atende após 14h.", "Pede sempre Gelinho para o fim de semana.", "Freezer próximo ao caixa."]) : "",
      });
    }
  }
}
// estoque de freezers ainda não instalados
for (let i = 0; i < 14; i++) {
  const t = pick(ASSET_TYPES);
  ASSETS.push({ id: `a${++assetSeq}`, patrimony: String(assetSeq).padStart(6, "0"), type: t.type, model: t.model, voltage: t.voltage, liters: t.liters, valueCents: t.valueCents, status: i < 3 ? "maintenance" : "stock", customerId: null });
}

export const customerById = new Map(CUSTOMERS.map((c) => [c.id, c]));
export const sellerById = new Map(SELLERS.map((s) => [s.id, s]));
export const TODAY_ROUTE = routeForDate(TODAY, PARAMS.commercialRoutes);

// ---------------------------------------------------------------- pedidos / orçamentos
export interface OrderItem { productId: string; qty: number; unitPriceCents: number }
export interface Order {
  id: string; number: string; kind: "ORDER" | "QUOTE" | "SIMPLE_QUOTE"; customerId: string; sellerId: string;
  status: string; createdAt: string; totalCents: number; paymentTermDays: number; recommendedTermDays: number;
  expectedDelivery: IsoDate | null; items: OrderItem[]; invoiceNumber?: string; billingError?: string;
}
const orderStatusPool: OrderStatus[] = [
  "awaiting_credit_review", "awaiting_credit_review", "in_approval", "credit_approved", "scheduled_for_billing",
  "sent_to_billing", "billing_in_progress", "invoiced", "invoiced", "in_delivery_route", "in_transit", "in_transit",
  "delivered", "completed", "completed", "completed", "blocked", "billing_error", "cancelled",
];
export const ORDERS: Order[] = [];
let orderSeq = 58210;
for (let i = 0; i < 140; i++) {
  const c = pick(CUSTOMERS);
  const items: OrderItem[] = Array.from({ length: between(1, 4) }, () => {
    const p = pick(PRODUCTS);
    return { productId: p.id, qty: between(1, 8), unitPriceCents: p.priceCents };
  });
  const total = items.reduce((s, it) => s + it.qty * it.unitPriceCents, 0);
  const ageDays = between(0, 6);
  const status = c.manualCreditBlock ? "blocked" : pick(orderStatusPool);
  const created = addDays(TODAY, -ageDays);
  const recommended = total <= 50_000 ? 7 : total <= 150_000 ? 14 : 21;
  ORDERS.push({
    id: `o${i}`, number: `PV-${++orderSeq}`, kind: "ORDER", customerId: c.id, sellerId: c.sellerId, status,
    createdAt: `${created}T${String(between(11, 20)).padStart(2, "0")}:${String(between(0, 59)).padStart(2, "0")}:00Z`,
    totalCents: total, paymentTermDays: rnd() < 0.8 ? recommended : recommended + 7, recommendedTermDays: recommended,
    expectedDelivery: addDays(created, between(1, 3)), items,
    invoiceNumber: ["invoiced", "in_delivery_route", "in_transit", "delivered", "completed"].includes(status) ? `NF ${between(120000, 129999)}` : undefined,
    billingError: status === "billing_error" ? pick(["Rejeição SEFAZ 539: duplicidade de NF-e", "CFOP incompatível com UF do destinatário", "Cadastro do cliente com IE inválida"]) : undefined,
  });
}
const quoteStatusPool = ["draft", "ready", "sent", "awaiting_customer", "negotiation", "approved", "rejected", "expired", "converted"];
let quoteSeq = 3100;
for (let i = 0; i < 40; i++) {
  const c = pick(CUSTOMERS.filter((x) => x.sellerId === (i < 22 ? "s1" : pick(SELLERS).id)));
  const items: OrderItem[] = Array.from({ length: between(1, 3) }, () => {
    const p = pick(PRODUCTS);
    return { productId: p.id, qty: between(2, 10), unitPriceCents: p.priceCents };
  });
  const total = items.reduce((s, it) => s + it.qty * it.unitPriceCents, 0);
  ORDERS.push({
    id: `q${i}`, number: `ORC-${++quoteSeq}`, kind: "QUOTE", customerId: c.id, sellerId: c.sellerId,
    status: pick(quoteStatusPool), createdAt: `${addDays(TODAY, -between(0, 12))}T14:00:00Z`, totalCents: total,
    paymentTermDays: 14, recommendedTermDays: 14, expectedDelivery: null, items,
  });
}

// ---------------------------------------------------------------- solicitações financeiras
export interface PaymentRequest {
  id: string; number: string; customerId: string; sellerId: string; method: PaymentMethod; amountCents: number;
  receivableDoc: string; createdAt: string; status: PaymentRequestStatus; response?: string; respondedAt?: string;
  attachmentName: string;
}
export const PAYMENT_REQUESTS: PaymentRequest[] = [];
const prSpecs: [number, PaymentMethod, PaymentRequestStatus][] = [
  [30, "BOLETO", "pending"], [27, "PIX", "in_analysis"], [26, "BOLETO", "pending"], [22, "PIX", "pending"],
  [6, "PIX", "pending"], [5, "BOLETO", "pending"], [4, "PIX", "pending"], [3, "PIX", "pending"], [2.5, "BOLETO", "pending"],
  [1.5, "PIX", "pending"], [1, "BOLETO", "pending"], [0.5, "PIX", "pending"],
  [40, "PIX", "confirmed"], [52, "BOLETO", "confirmed"], [70, "PIX", "not_identified"], [75, "BOLETO", "incorrect_receipt"], [90, "PIX", "confirmed"],
];
prSpecs.forEach(([hoursAgo, method, status], i) => {
  const c = i < 5 ? pick(CUSTOMERS.filter((x) => x.sellerId === "s1")) : pick(CUSTOMERS);
  const created = new Date(NOW.getTime() - hoursAgo * 3_600_000);
  PAYMENT_REQUESTS.push({
    id: `pr${i}`, number: `SQ-${7400 + i}`, customerId: c.id, sellerId: c.sellerId, method,
    amountCents: round(between(280, 3200) * 100, 1), receivableDoc: `BOL ${between(40000, 49999)}`,
    createdAt: created.toISOString(), status, attachmentName: method === "PIX" ? "comprovante-pix.jpg" : "comprovante-boleto.pdf",
    response: ["confirmed", "not_identified", "incorrect_receipt"].includes(status) ? undefined : undefined,
    respondedAt: ["confirmed", "not_identified", "incorrect_receipt"].includes(status) ? new Date(created.getTime() + 5 * 3_600_000).toISOString() : undefined,
  });
});

// ---------------------------------------------------------------- logística
export interface Driver { id: string; name: string; cnh: string; phone: string }
export interface Vehicle { id: string; plate: string; model: string; refrigerated: boolean }
export const DRIVERS: Driver[] = [
  { id: "d1", name: "Marcos Vinícius Pereira", cnh: "D", phone: phone() },
  { id: "d2", name: "Anderson Soares", cnh: "D", phone: phone() },
  { id: "d3", name: "Cleber Fonseca", cnh: "D", phone: phone() },
  { id: "d4", name: "Wagner Cardoso", cnh: "C", phone: phone() },
  { id: "d5", name: "Edson Ramos", cnh: "D", phone: phone() },
  { id: "d6", name: "Gilberto Nascimento", cnh: "C", phone: phone() },
];
export const VEHICLES: Vehicle[] = [
  { id: "v1", plate: "QWE-4F21", model: "VW Delivery 9.170 refrigerado", refrigerated: true },
  { id: "v2", plate: "RTY-7B83", model: "Mercedes Accelo 1016 refrigerado", refrigerated: true },
  { id: "v3", plate: "PLM-2C45", model: "Iveco Daily 35-150 refrigerado", refrigerated: true },
  { id: "v4", plate: "HJK-9D10", model: "VW Delivery 11.180 refrigerado", refrigerated: true },
  { id: "v5", plate: "GTR-3E67", model: "Hyundai HR refrigerado", refrigerated: true },
  { id: "v6", plate: "BNM-5A92", model: "Fiat Ducato refrigerado", refrigerated: true },
];

export interface Delivery {
  id: string; seq: number; customerId: string; invoiceNumber: string; orderNumber: string; volumes: number;
  status: DeliveryStatus; deliveredAt?: string; nonDeliveryReason?: string; proofName?: string; orderId?: string;
}
export interface DeliveryRoute {
  id: string; code: string; name: string; date: IsoDate; source: "system" | "manual_pdf" | "manual";
  driverId: string; vehicleId: string; startedAt: string | null; finishedAt: string | null;
  expectedEnd: string; deliveries: Delivery[]; checklistDone?: boolean; checklistVehicleId?: string;
}
const routeSpecs: { name: string; driver: string; vehicle: string; n: number; start: string | null; done: number; failed: number; source: DeliveryRoute["source"] }[] = [
  { name: "Contagem / Betim", driver: "d2", vehicle: "v2", n: 12, start: "07:12", done: 10, failed: 0, source: "system" },
  { name: "Belo Horizonte 1", driver: "d1", vehicle: "v1", n: 11, start: null, done: 0, failed: 0, source: "system" },
  { name: "Belo Horizonte 3", driver: "d3", vehicle: "v3", n: 10, start: "07:05", done: 8, failed: 1, source: "system" },
  { name: "Nova Lima / Sabará", driver: "d4", vehicle: "v4", n: 9, start: "07:40", done: 3, failed: 1, source: "manual_pdf" },
  { name: "Neves / Santa Luzia", driver: "d5", vehicle: "v5", n: 10, start: "06:58", done: 9, failed: 0, source: "system" },
  { name: "Venda Nova / Pampulha", driver: "d6", vehicle: "v6", n: 8, start: "07:30", done: 6, failed: 0, source: "manual" },
];
let invSeq = 125400;
export const DELIVERY_ROUTES: DeliveryRoute[] = routeSpecs.map((r, i) => {
  const deliveries: Delivery[] = Array.from({ length: r.n }, (_, k) => {
    const c = pick(CUSTOMERS);
    const status: DeliveryStatus = k < r.done ? "delivered" : k < r.done + r.failed ? "not_delivered" : r.start ? "in_transit" : "scheduled";
    const t = 8 * 60 + 25 + k * 34;
    return {
      id: `dl${i}-${k}`, seq: k + 1, customerId: c.id, invoiceNumber: `NF ${++invSeq}`, orderNumber: `PV-${between(58100, 58300)}`,
      volumes: between(6, 48), status,
      deliveredAt: status === "delivered" ? `${TODAY}T${String(Math.floor(t / 60) + 3).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}:00Z` : undefined,
      nonDeliveryReason: status === "not_delivered" ? pick(["Cliente fechado", "Cliente recusou", "Divergência"]) : undefined,
      proofName: status === "delivered" ? "canhoto.jpg" : undefined,
    };
  });
  return {
    id: `rt${i + 1}`, code: `R${String(i + 1).padStart(2, "0")}`, name: r.name, date: TODAY, source: r.source,
    driverId: r.driver, vehicleId: r.vehicle,
    startedAt: r.start ? `${TODAY}T${String(Number(r.start.slice(0, 2)) + 3).padStart(2, "0")}:${r.start.slice(3)}:00Z` : null,
    finishedAt: null, expectedEnd: "17:00", deliveries,
  };
});
export const CURRENT_DRIVER = DRIVERS[0]!;

export interface Incident { id: string; type: string; description: string; routeId: string; driverId: string; customerId?: string; createdAt: string; status: "open" | "in_treatment" | "resolved" }
export const INCIDENTS: Incident[] = [
  { id: "i1", type: "Avaria de mercadoria", description: "2 caixas de Picolé Morango amassadas na descarga.", routeId: "rt3", driverId: "d3", customerId: DELIVERY_ROUTES[2]!.deliveries[8]!.customerId, createdAt: `${TODAY}T14:10:00Z`, status: "open" },
  { id: "i2", type: "Ocorrência no cliente", description: "Cliente recusou receber por divergência de preço.", routeId: "rt4", driverId: "d4", customerId: DELIVERY_ROUTES[3]!.deliveries[3]!.customerId, createdAt: `${TODAY}T13:35:00Z`, status: "in_treatment" },
  { id: "i3", type: "Acidente de trânsito", description: "Batida leve no retrovisor, sem feridos. Veículo segue rota.", routeId: "rt1", driverId: "d2", createdAt: `${addDays(TODAY, -1)}T18:20:00Z`, status: "open" },
];
export interface Nonconformity { id: string; item: string; description: string; vehicleId: string; driverId: string; severity: "low" | "medium" | "critical"; status: "open" | "in_treatment" | "resolved"; createdAt: string; responsible: string }
export const NONCONFORMITIES: Nonconformity[] = [
  { id: "nc1", item: "Refrigeração", description: "Baú marcando -12 °C (esperado -18 °C).", vehicleId: "v4", driverId: "d4", severity: "critical", status: "open", createdAt: `${TODAY}T10:35:00Z`, responsible: "Manutenção frota" },
  { id: "nc2", item: "Lanternas", description: "Lanterna traseira esquerda queimada.", vehicleId: "v3", driverId: "d3", severity: "medium", status: "in_treatment", createdAt: `${TODAY}T10:02:00Z`, responsible: "Manutenção frota" },
];
export interface EpiRequest { id: string; type: string; qty: number; reason: string; status: string; createdAt: string; driverId: string }
export const EPI_REQUESTS: EpiRequest[] = [
  { id: "e1", type: "Luva térmica", qty: 2, reason: "Desgaste", status: "awaiting_purchase", createdAt: `${addDays(TODAY, -3)}T12:00:00Z`, driverId: "d1" },
  { id: "e2", type: "Bota de segurança", qty: 1, reason: "Solado danificado", status: "approved", createdAt: `${addDays(TODAY, -6)}T12:00:00Z`, driverId: "d1" },
];

export const CHECKLIST_ITEMS = [
  "Faróis", "Lanternas", "Pneus e estepe", "Documentação (CRLV, CNH, seguro)", "Limpeza do baú",
  "Refrigeração (temperatura)", "Equipamentos (carrinho, cintas)", "Extintor",
];

export const DRIVER_HISTORY = [
  { date: addDays(TODAY, -1), route: "Belo Horizonte 1", delivered: 12, notDelivered: 0, checklist: "8/8 ok", incidents: 0 },
  { date: addDays(TODAY, -2), route: "Belo Horizonte 1", delivered: 12, notDelivered: 0, checklist: "7/8 · 1 NC", incidents: 1 },
  { date: addDays(TODAY, -3), route: "Contagem / Betim", delivered: 10, notDelivered: 0, checklist: "8/8 ok", incidents: 0 },
  { date: addDays(TODAY, -6), route: "Belo Horizonte 1", delivered: 13, notDelivered: 1, checklist: "8/8 ok", incidents: 0 },
];

// ---------------------------------------------------------------- carteira
export interface TransferRequest {
  id: string; customerId: string; fromSellerId: string; toSellerId: string; reason: string; createdAt: string;
  status: "pending" | "approved" | "rejected"; decidedBy?: string; decidedAt?: string;
}
export const TRANSFER_REQUESTS: TransferRequest[] = [
  { id: "tr1", customerId: CUSTOMERS[70]!.id, fromSellerId: CUSTOMERS[70]!.sellerId, toSellerId: "s1", reason: "Cliente vizinho da minha rota de terça, já pediu atendimento comigo.", createdAt: new Date(NOW.getTime() - 3 * 3_600_000).toISOString(), status: "pending" },
  { id: "tr2", customerId: CUSTOMERS[200]!.id, fromSellerId: CUSTOMERS[200]!.sellerId, toSellerId: "s4", reason: "Cliente mudou de endereço para Sabará.", createdAt: new Date(NOW.getTime() - 26 * 3_600_000).toISOString(), status: "pending" },
];
export interface TempAccess { id: string; holderSellerId: string; substituteSellerId: string; from: IsoDate; to: IsoDate; reason: string; createdAt: string }
export const TEMP_ACCESS: TempAccess[] = [];

// ---------------------------------------------------------------- notificações
export type NotifKind = "operacional" | "alerta" | "financeiro" | "comercial" | "logistica" | "sistema";
export interface Notification {
  id: string; at: string; kind: NotifKind; priority: "normal" | "high"; title: string; text: string;
  /** destinatários: papel ("finance") ou pessoa ("seller:s1", "driver:d1") */
  to: string[]; readBy: string[];
}
export const NOTIFICATIONS: Notification[] = [
  { id: "n1", at: new Date(NOW.getTime() - 50 * 60_000).toISOString(), kind: "financeiro", priority: "high", title: "Solicitações sem resposta há +24h", text: "3 comprovantes aguardam o financeiro além do SLA.", to: ["finance", "sales_manager", "sales_coordinator", "general_manager"], readBy: [] },
  { id: "n2", at: new Date(NOW.getTime() - 95 * 60_000).toISOString(), kind: "logistica", priority: "high", title: "Não conformidade crítica", text: "Refrigeração do veículo HJK-9D10 marcando -12 °C.", to: ["transport_coordinator", "general_manager"], readBy: [] },
  { id: "n3", at: new Date(NOW.getTime() - 3 * 3_600_000).toISOString(), kind: "comercial", priority: "normal", title: "Clientes da rota sem compra", text: "2 clientes da rota de hoje estão há mais de 28 dias sem comprar.", to: ["seller:s1"], readBy: [] },
];

// ---------------------------------------------------------------- comprovantes (foto)
export interface DeliveryProof { id: string; deliveryId: string; routeId: string; type: string; dataUrl: string; at: string; driverId: string }
export const PROOFS: DeliveryProof[] = [];

// ---------------------------------------------------------------- dia anterior (fechamento)
function previousBusinessDay(d: IsoDate): IsoDate {
  let x = addDays(d, -1);
  while (!isBusinessDay(x, PARAMS.workCalendar)) x = addDays(x, -1);
  return x;
}
export const YESTERDAY: IsoDate = previousBusinessDay(TODAY);
export const YESTERDAY_ROUTE = routeForDate(YESTERDAY, PARAMS.commercialRoutes);

export interface YesterdaySeller {
  sellerId: string; salesCents: number; orders: number; visitsPlanned: number; visitsDone: number;
  /** clientes planejados e não visitados */
  missedCustomerIds: string[];
}
const ydPerf: Record<string, [number, number]> = { s1: [1.08, 0], s2: [0.96, 1], s3: [0.71, 4], s4: [1.02, 0], s5: [0.58, 6] };
export const YESTERDAY_SELLERS: YesterdaySeller[] = SELLERS.map((s) => {
  const [perf, missed] = ydPerf[s.id] ?? [0.9, 1];
  const planned = CUSTOMERS.filter((c) => c.sellerId === s.id && c.routeCode === YESTERDAY_ROUTE?.code);
  const daily = s.monthlyGoalCents / BD_MONTH;
  return {
    sellerId: s.id, salesCents: round(daily * perf), orders: between(5, 11), visitsPlanned: planned.length,
    visitsDone: planned.length - missed, missedCustomerIds: planned.slice(-missed || planned.length).slice(0, missed).map((c) => c.id),
  };
});

export interface YesterdayDelivery {
  id: string; routeName: string; driverId: string; vehicleId: string; customerId: string; invoiceNumber: string;
  status: "delivered" | "not_delivered" | "no_record"; reason?: string; rescheduledTo?: string;
}
const ydRoutes: [string, string, string, number, [string, "not_delivered" | "no_record"][]][] = [
  ["Contagem / Betim", "d2", "v2", 12, [["Cliente fechado", "not_delivered"]]],
  ["Belo Horizonte 1", "d1", "v1", 12, []],
  ["Belo Horizonte 3", "d3", "v3", 10, [["Cliente recusou", "not_delivered"], ["", "no_record"]]],
  ["Nova Lima / Sabará", "d4", "v4", 9, [["Problema no veículo", "not_delivered"], ["Problema no veículo", "not_delivered"]]],
  ["Neves / Santa Luzia", "d5", "v5", 10, []],
  ["Venda Nova / Pampulha", "d6", "v6", 8, [["Endereço incorreto", "not_delivered"]]],
];
export const YESTERDAY_DELIVERIES: YesterdayDelivery[] = ydRoutes.flatMap(([routeName, driverId, vehicleId, n, fails], ri) =>
  Array.from({ length: n }, (_, k) => {
    const f = fails[k - (n - fails.length)];
    const c = pick(CUSTOMERS);
    return {
      id: `yd${ri}-${k}`, routeName, driverId, vehicleId, customerId: c.id, invoiceNumber: `NF ${124800 + ri * 20 + k}`,
      status: f ? f[1] : "delivered", reason: f && f[0] ? f[0] : undefined,
    } as YesterdayDelivery;
  }),
);

export interface YesterdayRoute { routeName: string; driverId: string; vehicleId: string; startedAt: string; finishedAt: string | null; note?: string }
/** fechamento das rotas de ontem: quem finalizou o dia no app */
export const YESTERDAY_ROUTES: YesterdayRoute[] = ydRoutes.map(([routeName, driverId, vehicleId], i) => {
  const notFinished: Record<string, string> = {
    "Belo Horizonte 3": "Não finalizou o dia no app · 1 entrega sem baixa",
    "Nova Lima / Sabará": "Não finalizou · veículo parado por problema mecânico",
  };
  const end = 15 * 60 + 40 + i * 17;
  return {
    routeName, driverId, vehicleId,
    startedAt: `${YESTERDAY}T${String(10 + (i % 2)).padStart(2, "0")}:${String(5 + i * 6).padStart(2, "0")}:00Z`,
    finishedAt: notFinished[routeName] ? null : `${YESTERDAY}T${String(Math.floor(end / 60) + 3).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}:00Z`,
    note: notFinished[routeName],
  };
});
