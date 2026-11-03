/**
 * Índice da lupa: tudo o que cada perfil pode encontrar e abrir no app.
 * Telas, clientes (inclusive de outra carteira, com ficha limitada), pedidos e orçamentos,
 * comprovantes, prospects, vendedores, usuários, rotas, entregas, veículos, motoristas,
 * ocorrências, não conformidades, EPI, freezers, ocorrências de freezer, produtos e avisos.
 */
import {
  CUSTOMERS, ORDERS, PAYMENT_REQUESTS, SELLERS, DELIVERY_ROUTES, VEHICLES, DRIVERS, INCIDENTS, NONCONFORMITIES,
  EPI_REQUESTS, FREEZER_OCCURRENCES, PRODUCTS, CURRENT_SELLER, CURRENT_DRIVER, customerById,
  type NotifLink, type Role,
} from "./mock";
import { LEADS } from "./leads";
import { USERS, USER_ROLE_LABEL } from "./users";
import { notificationsFor } from "./notify";
import { statusLabel } from "./selectors";
import { hit, customerText } from "./search";

export type Grupo = "Telas" | "Clientes" | "Pedidos" | "Orçamentos" | "Comprovantes" | "Prospects" | "Equipe" | "Logística" | "Ocorrências" | "Freezers" | "Produtos" | "Avisos";
export interface Achado { id: string; grupo: Grupo; titulo: string; sub: string; abrir: { t: "tab"; tab: string } | { t: "link"; link: NotifLink } | null }

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nomeVend = (id: string) => SELLERS.find((s) => s.id === id)?.name ?? "";
const plate = (vid: string) => VEHICLES.find((v) => v.id === vid)?.plate ?? "";
const driverName = (did: string) => DRIVERS.find((d) => d.id === did)?.name ?? "";

const MGR: Role[] = ["sales_manager", "sales_coordinator", "general_manager"];
const LOG: Role[] = ["general_manager", "transport_coordinator"];

export function buscarTudo(q: string, role: Role, tabs: { id: string; label: string }[]): Achado[] {
  const termo = q.trim();
  if (termo.length < 1) return tabs.filter((t) => t.id !== "more").slice(0, 8).map((t) => ({ id: `tab:${t.id}`, grupo: "Telas", titulo: t.label, sub: "Ir para a tela", abrir: { t: "tab", tab: t.id } }));
  const out: Achado[] = [];
  const add = (a: Achado) => out.push(a);
  const isMgr = MGR.includes(role), isSeller = role === "seller", isFin = role === "finance", isBill = role === "billing", isDriver = role === "driver";
  const seesLog = LOG.includes(role);

  // telas do perfil
  for (const t of tabs) if (t.id !== "more" && hit(t.label, "", termo)) add({ id: `tab:${t.id}`, grupo: "Telas", titulo: t.label, sub: "Ir para a tela", abrir: { t: "tab", tab: t.id } });

  // clientes
  if (!isDriver && termo.length >= 2) {
    const routeCustomers = role === "transport_coordinator" ? new Set(DELIVERY_ROUTES.flatMap((r) => r.deliveries.map((d) => d.customerId))) : null;
    for (const c of CUSTOMERS) {
      if (routeCustomers && !routeCustomers.has(c.id)) continue;
      if (!hit(customerText(c), `${c.document} ${c.code} ${c.phone}`, termo)) continue;
      const outra = isSeller && c.sellerId !== CURRENT_SELLER.id;
      add({ id: `c:${c.id}`, grupo: "Clientes", titulo: c.tradeName, sub: `${c.document} · ${c.district}, ${c.city} · ${outra ? `carteira de ${nomeVend(c.sellerId).split(" ")[0]}` : nomeVend(c.sellerId)}`,
        abrir: routeCustomers ? null : { t: "link", link: { t: "customer", id: c.id } } });
    }
  }

  // pedidos e orçamentos
  if ((isSeller || isMgr || isFin || isBill) && termo.length >= 2) {
    for (const o of ORDERS) {
      if (isSeller && o.sellerId !== CURRENT_SELLER.id) continue;
      if ((isFin || isBill) && o.kind !== "ORDER") continue;
      const c = customerById.get(o.customerId);
      if (!hit(`${o.number} ${o.invoiceNumber ?? ""} ${statusLabel(o.status)} ${customerText(c)}`, `${o.number} ${o.invoiceNumber ?? ""} ${c?.document ?? ""}`, termo)) continue;
      add({ id: `o:${o.id}`, grupo: o.kind === "ORDER" ? "Pedidos" : "Orçamentos", titulo: `${o.number} · ${c?.tradeName ?? ""}`, sub: `${brl(o.totalCents)} · ${statusLabel(o.status)}${o.invoiceNumber ? ` · ${o.invoiceNumber}` : ""}`, abrir: { t: "link", link: { t: "order", id: o.id } } });
    }
  }

  // comprovantes
  if ((isSeller || isMgr || isFin) && termo.length >= 2) {
    for (const p of PAYMENT_REQUESTS) {
      if (isSeller && p.sellerId !== CURRENT_SELLER.id) continue;
      const c = customerById.get(p.customerId);
      if (!hit(`${p.number} ${p.method} ${p.receivableDoc} ${customerText(c)}`, `${p.number} ${c?.document ?? ""}`, termo)) continue;
      add({ id: `p:${p.id}`, grupo: "Comprovantes", titulo: `${p.number} · ${c?.tradeName ?? ""}`, sub: `${p.method} · ${brl(p.amountCents)} · ${p.receivableDoc}`, abrir: { t: "link", link: { t: "proof", id: p.id } } });
    }
  }

  // prospects
  if ((isSeller || isMgr || isFin) && termo.length >= 2) {
    for (const l of LEADS) {
      if (isSeller && l.sellerId !== CURRENT_SELLER.id) continue;
      if (isFin && l.stage !== "cadastro") continue;
      if (!hit(`${l.name} ${l.contact} ${l.phone} ${l.address} ${l.district} ${l.type} ${l.cadastro?.cnpj ?? ""} ${l.cadastro?.legalName ?? ""} ${nomeVend(l.sellerId)}`, `${l.phone} ${l.cadastro?.cnpj ?? ""}`, termo)) continue;
      add({ id: `l:${l.id}`, grupo: "Prospects", titulo: l.name, sub: `${l.type} · ${l.district} · ${nomeVend(l.sellerId).split(" ")[0]}`, abrir: { t: "link", link: { t: "lead", id: l.id } } });
    }
  }

  // equipe
  if (isMgr && termo.length >= 2)
    for (const s of SELLERS) if (hit(`${s.name} ${s.region} vendedor`, "", termo)) add({ id: `s:${s.id}`, grupo: "Equipe", titulo: s.name, sub: `Vendedor · ${s.region}`, abrir: { t: "link", link: { t: "seller", id: s.id } } });
  if (role === "general_manager" && termo.length >= 2)
    for (const u of USERS) if (!SELLERS.some((s) => s.id === u.refId && u.role === "seller") && hit(`${u.name} ${u.email} ${u.phone} ${USER_ROLE_LABEL[u.role]}`, u.phone, termo))
      add({ id: `u:${u.id}`, grupo: "Equipe", titulo: u.name, sub: `${USER_ROLE_LABEL[u.role]} · ${u.email}`, abrir: { t: "tab", tab: "users" } });

  // logística: rotas, entregas, veículos, motoristas
  if ((seesLog || isDriver) && termo.length >= 2) {
    for (const r of DELIVERY_ROUTES) {
      if (isDriver && r.driverId !== CURRENT_DRIVER.id) continue;
      const vp = plate(r.vehicleId), dn = driverName(r.driverId);
      if (hit(`${r.name} ${r.code} ${vp} ${dn} rota`, `${vp} ${r.code}`, termo))
        add({ id: `r:${r.id}`, grupo: "Logística", titulo: `Rota ${r.name}`, sub: `${r.code} · ${vp} · ${dn} · ${r.deliveries.length} entregas`, abrir: { t: "link", link: { t: "route", id: r.id } } });
      for (const d of r.deliveries) {
        const c = customerById.get(d.customerId);
        if (!hit(`${d.invoiceNumber} ${d.orderNumber} ${customerText(c)}`, `${d.invoiceNumber} ${d.orderNumber} ${c?.document ?? ""}`, termo)) continue;
        add({ id: `d:${r.id}:${d.id}`, grupo: "Logística", titulo: `Entrega ${d.invoiceNumber} · ${c?.tradeName ?? ""}`, sub: `Rota ${r.name} · ${d.orderNumber} · ${c?.district ?? ""}`, abrir: { t: "link", link: { t: "route", id: r.id } } });
      }
    }
    if (seesLog) {
      for (const v of VEHICLES) if (hit(`${v.plate} ${v.model} veiculo caminhao`, v.plate, termo)) {
        const r = DELIVERY_ROUTES.find((x) => x.vehicleId === v.id);
        add({ id: `v:${v.id}`, grupo: "Logística", titulo: `Veículo ${v.plate}`, sub: `${v.model}${r ? ` · rota ${r.name}` : ""}`, abrir: r ? { t: "link", link: { t: "route", id: r.id } } : { t: "tab", tab: role === "transport_coordinator" ? "fleet" : "lfleet" } });
      }
      for (const d of DRIVERS) if (hit(`${d.name} motorista ${d.phone}`, d.phone, termo)) {
        const r = DELIVERY_ROUTES.find((x) => x.driverId === d.id);
        add({ id: `dr:${d.id}`, grupo: "Equipe", titulo: d.name, sub: `Motorista · CNH ${d.cnh}${r ? ` · rota ${r.name}` : ""}`, abrir: r ? { t: "link", link: { t: "route", id: r.id } } : { t: "tab", tab: role === "transport_coordinator" ? "fleet" : "lfleet" } });
      }
    }
  }

  // ocorrências, não conformidades, EPI
  if ((seesLog || isDriver) && termo.length >= 2) {
    for (const i of INCIDENTS) {
      if (isDriver && i.driverId !== CURRENT_DRIVER.id) continue;
      const c = i.customerId ? customerById.get(i.customerId) : undefined;
      if (hit(`${i.type} ${i.description} ocorrencia ${driverName(i.driverId)} ${customerText(c)}`, "", termo))
        add({ id: `i:${i.id}`, grupo: "Ocorrências", titulo: i.type, sub: `${i.description}${c ? ` · ${c.tradeName}` : ""}`, abrir: { t: "link", link: { t: "incident", id: i.id } } });
    }
    for (const n of NONCONFORMITIES) {
      if (isDriver && n.driverId !== CURRENT_DRIVER.id) continue;
      if (hit(`${n.item} ${n.description} nao conformidade ${plate(n.vehicleId)}`, plate(n.vehicleId), termo))
        add({ id: `n:${n.id}`, grupo: "Ocorrências", titulo: `Não conformidade · ${n.item}`, sub: `${plate(n.vehicleId)} · ${n.description}`, abrir: { t: "link", link: { t: "nc", id: n.id } } });
    }
    for (const e of EPI_REQUESTS) {
      if (isDriver && e.driverId !== CURRENT_DRIVER.id) continue;
      if (hit(`${e.type} ${e.reason} epi ${driverName(e.driverId)}`, "", termo))
        add({ id: `e:${e.id}`, grupo: "Ocorrências", titulo: `EPI · ${e.type}`, sub: `${e.qty} un. · ${driverName(e.driverId)} · ${e.reason}`, abrir: { t: "link", link: { t: "epi", id: e.id } } });
    }
  }

  // freezers e ocorrências de freezer
  if ((isSeller || isMgr) && termo.length >= 2) {
    for (const c of CUSTOMERS) {
      if (isSeller && c.sellerId !== CURRENT_SELLER.id) continue;
      for (const a of c.assets) if (hit(`${a.patrimony} ${a.model} ${a.brand ?? ""} freezer ${c.tradeName}`, a.patrimony, termo))
        add({ id: `a:${a.id}`, grupo: "Freezers", titulo: `Freezer ${a.patrimony} · ${c.tradeName}`, sub: `${a.brand ?? "Gelopar"} ${a.liters} L · ${a.voltage} · ${c.district}`, abrir: { t: "link", link: { t: "customer", id: c.id } } });
    }
    for (const o of FREEZER_OCCURRENCES) {
      if (isSeller && o.sellerId !== CURRENT_SELLER.id) continue;
      const c = customerById.get(o.customerId);
      if (hit(`${o.number} ${o.patrimony} ocorrencia freezer ${customerText(c)}`, `${o.number} ${o.patrimony}`, termo))
        add({ id: `fo:${o.id}`, grupo: "Freezers", titulo: `Ocorrência ${o.number} · ${c?.tradeName ?? ""}`, sub: `Patrimônio ${o.patrimony}`, abrir: { t: "link", link: { t: "occ", id: o.id } } });
    }
  }

  // produtos (vendedor, gestão, faturamento)
  if ((isSeller || isMgr || isBill || isFin) && termo.length >= 2)
    for (const p of PRODUCTS) if (hit(`${p.commercialName} ${p.fiscalName} ${p.code} ${p.category}`, p.code, termo))
      add({ id: `pr:${p.id}`, grupo: "Produtos", titulo: p.commercialName, sub: `${p.code} · ${p.packaging} · ${brl(p.priceCents)} · estoque ${p.stock} ${p.unit}`, abrir: null });

  // avisos (notificações do perfil)
  if (termo.length >= 2)
    for (const n of notificationsFor(role)) if (hit(`${n.title} ${n.text}`, "", termo))
      add({ id: `nt:${n.id}`, grupo: "Avisos", titulo: n.title, sub: n.text, abrir: n.link ? { t: "link", link: n.link } : null });

  return out;
}
