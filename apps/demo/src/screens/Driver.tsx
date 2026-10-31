/** Perfil MOTORISTA — 3 áreas: Início, Histórico, Perfil. */
import { useState } from "react";
import {
  Home, History, UserRound, Play, Truck, Package, MapPin, ClipboardCheck, AlertTriangle, HardHat, CheckCircle2,
  XCircle, Camera, Flag, ChevronRight, Navigation,
} from "lucide-react";
import { DELIVERY_STATUS, EPI_STATUS } from "@galato/domain";
import {
  PARAMS, DELIVERY_ROUTES, CURRENT_DRIVER as ME, VEHICLES, CHECKLIST_ITEMS, EPI_REQUESTS, DRIVER_HISTORY,
  NONCONFORMITIES, INCIDENTS, customerById, TODAY, ORDERS, PROOFS, type Delivery,
} from "../data/mock";
import { notify, MANAGERS_KEYS } from "../data/notify";
import { PhotoCapture } from "../components/photo";
import { routeProgress, dayLabel } from "../data/selectors";
import { commit, useStore } from "../data/store";
import { Shell, Greeting, ProfilePanel } from "../components/shell";
import { Card, Sheet, ConfirmModal, Badge, Progress, Ring, Chip, pct } from "../components/ui";
import { fmtDate } from "../components/business";

const myRoute = () => DELIVERY_ROUTES.find((r) => r.driverId === ME.id)!;

export function DriverApp() {
  const [tab, setTab] = useState("home");
  useStore();
  const tabs = [
    { id: "home", label: "Início", icon: <Home size={20} /> },
    { id: "history", label: "Histórico", icon: <History size={20} /> },
    { id: "profile", label: "Perfil", icon: <UserRound size={20} /> },
  ];
  return (
    <Shell tabs={tabs} tab={tab} onTab={setTab} roleLabel="Motorista" userName={ME.name} narrow>
      {tab === "home" && <DriverHome />}
      {tab === "history" && <DriverHistory />}
      {tab === "profile" && <ProfilePanel name={ME.name} role={`Motorista · CNH ${ME.cnh}`} extra={
        <Card><dl className="kv"><dt>Telefone</dt><dd>{ME.phone}</dd><dt>Veículo habitual</dt><dd>{VEHICLES[0]!.plate}</dd><dt>Rota de hoje</dt><dd>{myRoute().name}</dd></dl></Card>
      } />}
    </Shell>
  );
}

function DriverHome() {
  useStore();
  const route = myRoute();
  const p = routeProgress(route);
  const vehicle = VEHICLES.find((v) => v.id === (route.checklistVehicleId ?? route.vehicleId))!;
  const started = !!route.startedAt;
  const finished = !!route.finishedAt;
  const [sheet, setSheet] = useState<null | "checklist" | "incident" | "epi" | "deliveries">(null);
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [incidentFor, setIncidentFor] = useState<Delivery | null>(null);
  const resolved = route.deliveries.every((d) => d.status === "delivered" || d.status === "not_delivered");
  const myEpi = EPI_REQUESTS.filter((e) => e.driverId === ME.id && !["delivered", "rejected"].includes(e.status));

  function startDay() {
    commit(() => {
      route.startedAt = new Date().toISOString();
      route.deliveries.forEach((d) => {
        if (d.status === "scheduled") d.status = "in_transit";
        const o = d.orderId ? ORDERS.find((x) => x.id === d.orderId) : undefined;
        if (o) o.status = "in_transit";
      });
      const bySeller = new Map<string, number>();
      route.deliveries.forEach((d) => { const sid = customerById.get(d.customerId)?.sellerId; if (sid) bySeller.set(sid, (bySeller.get(sid) ?? 0) + 1); });
      bySeller.forEach((n, sid) => notify({ kind: "logistica", title: "Entregas a caminho", text: `${ME.name} iniciou a rota ${route.name} com ${n} entrega(s) de clientes seus.`, to: [`seller:${sid}`] }));
      notify({ kind: "logistica", title: "Motorista iniciou o dia", text: `${ME.name} · ${vehicle.plate} · rota ${route.name} · ${route.deliveries.length} entregas.`, to: ["transport_coordinator", ...MANAGERS_KEYS] });
    }, "Dia iniciado · entregas em trânsito · vendedores, gestão e logística avisados");
    setConfirmStart(false);
  }

  return (
    <>
      <Greeting icon={<Truck size={22} />} title={`Olá, ${ME.name.split(" ")[0]}!`} sub={`${route.code} · ${route.name} · ${dayLabel(TODAY)}`} />

      {!started ? (
        <div className="hero mb">
          <div className="small t2 mb">Veículo {vehicle.plate} · {route.deliveries.length} entregas · {route.deliveries.reduce((a, d) => a + d.volumes, 0)} volumes</div>
          {!route.checklistDone && <div className="small mb" style={{ color: "var(--warning)", fontWeight: 600 }}>⚠ Faça o checklist do veículo antes de sair.</div>}
          <button className="btn btn-primary btn-lg" onClick={() => setConfirmStart(true)}><Play size={22} fill="currentColor" /> Iniciar o dia</button>
        </div>
      ) : (
        <Card className="mb" onClick={() => setSheet("deliveries")}>
          <div className="flex" style={{ gap: 16 }}>
            <Ring value={p.pct} size={104} stroke={11} label={`${p.delivered}/${p.total}`} sub="entregues" />
            <div style={{ flex: 1 }}>
              <div className="semi" style={{ fontSize: 16 }}>Entregas do dia</div>
              <div className="small t2">{p.pending} pendentes · {p.failed} não realizadas</div>
              <div className="mt"><Progress value={p.pct} color="green" /></div>
              <div className="xs muted mt">{finished ? "Dia finalizado" : `Em rota desde ${new Date(route.startedAt!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}</div>
            </div>
            <ChevronRight className="muted" />
          </div>
        </Card>
      )}

      {started && (
        <Card title="Minhas entregas" icon={<Navigation size={17} />} sub="toque para baixar">
          {route.deliveries.map((d) => <DeliveryRow key={d.id} d={d} onClick={() => setDelivery(d)} />)}
        </Card>
      )}

      <div className="grid g3 mt">
        <Card className="kpi"><div className="kpi-head"><span className="kpi-ic"><Truck size={16} /></span>Entregas</div><div className="kpi-value num">{p.total}</div></Card>
        <Card className="kpi"><div className="kpi-head"><span className="kpi-ic gold"><Package size={16} /></span>Volumes</div><div className="kpi-value num">{route.deliveries.reduce((a, d) => a + d.volumes, 0)}</div></Card>
        <Card className="kpi"><div className="kpi-head"><span className="kpi-ic info"><MapPin size={16} /></span>Rota</div><div className="kpi-value num">{route.code}</div></Card>
      </div>

      <Card title="Checklist do veículo" icon={<ClipboardCheck size={17} />} link={route.checklistDone ? "Ver" : "Fazer agora"} onLink={() => setSheet("checklist")} onClick={() => setSheet("checklist")}>
        <div className="progress-row"><Progress value={route.checklistDone ? 100 : 0} color="green" /><span className="xs">{route.checklistDone ? `${CHECKLIST_ITEMS.length} de ${CHECKLIST_ITEMS.length} itens` : "pendente"}</span></div>
      </Card>

      <div className="grid g2 mt">
        <button className="action-tile" onClick={() => setSheet("incident")}><span className="ic"><AlertTriangle size={20} /></span>Registrar ocorrência</button>
        <button className="action-tile gold" onClick={() => setSheet("epi")}><span className="ic"><HardHat size={20} /></span>Solicitar EPI{myEpi.length > 0 && <span className="xs muted">{myEpi.length} em andamento</span>}</button>
      </div>

      {started && !finished && (
        <button className="btn btn-ghost btn-block mt" onClick={() => setConfirmFinish(true)}><Flag size={17} /> Finalizar o dia</button>
      )}

      {confirmStart && (
        <ConfirmModal title="Iniciar o dia?" confirmLabel="Iniciar" onClose={() => setConfirmStart(false)} onConfirm={startDay}
          text={<>Será registrado: horário, motorista <b>{ME.name}</b>, veículo <b>{vehicle.plate}</b> e rota <b>{route.name}</b>. As entregas passam para “Em trânsito” e vendedores, gestão comercial e logística são informados.</>} />
      )}
      {confirmFinish && (
        <ConfirmModal title="Finalizar o dia?" confirmLabel="Finalizar" danger disabled={!resolved} onClose={() => setConfirmFinish(false)}
          onConfirm={() => {
            commit(() => {
              route.finishedAt = new Date().toISOString();
              notify({ kind: "logistica", title: "Motorista finalizou o dia", text: `${ME.name} · ${route.name}: ${p.delivered} entregues, ${p.failed} não entregues.`, to: ["transport_coordinator"] });
            }, "Dia finalizado · resumo enviado à coordenação");
            setConfirmFinish(false);
          }}
          text={resolved ? "Todas as entregas estão resolvidas. Confirma o encerramento?" : <><b className="red">{p.pending} entrega(s) ainda pendente(s).</b> Baixe a entrega ou informe o motivo de não entrega antes de finalizar.</>} />
      )}
      {sheet === "deliveries" && (
        <Sheet title={`Entregas · ${route.name}`} onClose={() => setSheet(null)}>
          {route.deliveries.map((d) => <DeliveryRow key={d.id} d={d} onClick={() => { setSheet(null); setDelivery(d); }} />)}
        </Sheet>
      )}
      {sheet === "checklist" && <ChecklistSheet onClose={() => setSheet(null)} />}
      {(sheet === "incident" || incidentFor) && <IncidentSheet forDelivery={incidentFor} onClose={() => { setSheet(null); setIncidentFor(null); }} />}
      {sheet === "epi" && <EpiSheet onClose={() => setSheet(null)} />}
      {delivery && <DeliverySheet d={delivery} onClose={() => setDelivery(null)} onIncident={() => { setIncidentFor(delivery); setDelivery(null); }} />}
    </>
  );
}

function DeliveryRow({ d, onClick }: { d: Delivery; onClick: () => void }) {
  const c = customerById.get(d.customerId)!;
  const st = DELIVERY_STATUS[d.status];
  const open = d.status === "in_transit";
  return (
    <div className="row click" onClick={onClick}>
      <span className="pos">{d.seq}</span>
      <div className="grow"><div className="title">{c.tradeName}</div><div className="sub">{c.address} · {d.invoiceNumber} · {d.volumes} vol.</div></div>
      {open ? <button className="btn btn-primary btn-sm">Baixar</button> : <Badge tone={st.tone}>{st.label}</Badge>}
    </div>
  );
}

function DeliverySheet({ d, onClose, onIncident }: { d: Delivery; onClose: () => void; onIncident: () => void }) {
  const c = customerById.get(d.customerId)!;
  const route = myRoute();
  const [step, setStep] = useState<"detail" | "proof" | "fail">("detail");
  const [photo, setPhoto] = useState<string | null>(null);
  const [proofType, setProofType] = useState(PARAMS.catalogs.deliveryProofTypes[0]!);
  const [reason, setReason] = useState<string | null>(null);
  const done = d.status === "delivered" || d.status === "not_delivered";
  const proof = PROOFS.find((x) => x.deliveryId === d.id);
  const order = d.orderId ? ORDERS.find((o) => o.id === d.orderId) : undefined;

  function confirmDelivery() {
    commit(() => {
      d.status = "delivered"; d.deliveredAt = new Date().toISOString(); d.proofName = proofType;
      PROOFS.unshift({ id: `pf-${d.id}`, deliveryId: d.id, routeId: route.id, type: proofType, dataUrl: photo!, at: new Date().toISOString(), driverId: ME.id });
      if (order) order.status = "delivered";
      notify({ kind: "logistica", title: "Entrega realizada", text: `${c.tradeName} · ${d.invoiceNumber} entregue por ${ME.name.split(" ")[0]} · comprovante ${proofType}.`, to: [`seller:${c.sellerId}`, "transport_coordinator", "general_manager"] });
    }, "Entrega baixada · comprovante enviado");
    onClose();
  }

  return (
    <Sheet title={step === "proof" ? "Baixar entrega" : step === "fail" ? "Não entrega" : `Entrega ${d.seq} · ${c.tradeName}`} onClose={onClose} icon={step === "proof" ? <Camera size={18} /> : undefined}>
      {step === "detail" && (
        <>
          <Card>
            <dl className="kv">
              <dt>Cliente</dt><dd>{c.tradeName}</dd><dt>Endereço</dt><dd>{c.address}, {c.district}</dd><dt>Cidade</dt><dd>{c.city}</dd>
              <dt>Nota / pedido</dt><dd>{d.invoiceNumber} · {d.orderNumber}</dd><dt>Volumes</dt><dd>{d.volumes}</dd>
              <dt>Contato</dt><dd>{c.buyerName} · {c.phone}</dd>
            </dl>
          </Card>
          {done ? (
            <div className="mt stack">
              <div><Badge tone={DELIVERY_STATUS[d.status].tone}>{DELIVERY_STATUS[d.status].label}</Badge> {d.nonDeliveryReason && <span className="small">· {d.nonDeliveryReason}</span>}</div>
              {proof && <div className="photo-preview"><img src={proof.dataUrl} alt="Comprovante" /><span className="xs muted">{proof.type} · {new Date(proof.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>}
              {!proof && d.proofName && <div className="small muted">Comprovante: {d.proofName}</div>}
            </div>
          ) : d.status !== "in_transit" ? (
            <div className="small muted mt">Inicie o dia para baixar esta entrega.</div>
          ) : (
            <>
              <button className="btn btn-primary btn-lg mt" onClick={() => setStep("proof")}><CheckCircle2 size={20} /> Baixar entrega</button>
              <div className="grid g2 mt" style={{ marginBottom: 0 }}>
                <button className="btn btn-ghost" onClick={() => setStep("fail")}><XCircle size={16} /> Não entregue</button>
                <button className="btn btn-ghost" onClick={onIncident}><AlertTriangle size={16} /> Ocorrência</button>
              </div>
            </>
          )}
        </>
      )}

      {step === "proof" && (
        <>
          <div className="step"><b>{c.tradeName}</b> · {d.invoiceNumber} · {d.volumes} volumes</div>
          <div className="field"><label>Tipo de comprovante</label>
            <div className="chips">{PARAMS.catalogs.deliveryProofTypes.map((t) => <Chip key={t} on={proofType === t} onClick={() => setProofType(t)}>{t}</Chip>)}</div>
          </div>
          <PhotoCapture value={photo} onChange={setPhoto} label="Fotografar comprovante assinado" />
          <div className="xs muted mt">Registrado junto: data, horário, motorista, cliente, nota e entrega.</div>
          <button className="btn btn-primary btn-block mt" disabled={!photo} onClick={confirmDelivery}><CheckCircle2 size={18} /> Confirmar entrega</button>
          <button className="btn btn-ghost btn-block mt" onClick={() => setStep("detail")}>Voltar</button>
        </>
      )}

      {step === "fail" && (
        <Card>
          <div className="semi mb">Motivo da não entrega (obrigatório)</div>
          <div className="chips">{PARAMS.catalogs.nonDeliveryReasons.map((r) => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}</div>
          <div className="grid g2 mt" style={{ marginBottom: 0 }}>
            <button className="btn btn-ghost" onClick={() => setStep("detail")}>Voltar</button>
            <button className="btn btn-danger" disabled={!reason} onClick={() => {
              commit(() => {
                d.status = "not_delivered"; d.nonDeliveryReason = reason!;
                if (order) order.status = "invoiced";
                notify({ kind: "alerta", priority: "high", title: "Entrega não realizada", text: `${c.tradeName} · ${d.invoiceNumber}: ${reason}.`, to: ["transport_coordinator", `seller:${c.sellerId}`] });
              }, "Não entrega registrada · coordenação e vendedor avisados");
              onClose();
            }}>Confirmar</button>
          </div>
        </Card>
      )}
    </Sheet>
  );
}

function ChecklistSheet({ onClose }: { onClose: () => void }) {
  const route = myRoute();
  const [vehicle, setVehicle] = useState(route.checklistVehicleId ?? route.vehicleId);
  const [state, setStateL] = useState<Record<string, "ok" | "nc" | undefined>>(() => route.checklistDone ? Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i, "ok"])) : {});
  const all = CHECKLIST_ITEMS.every((i) => state[i]);
  const ncs = CHECKLIST_ITEMS.filter((i) => state[i] === "nc");
  const plate = VEHICLES.find((v) => v.id === vehicle)?.plate;
  return (
    <Sheet title="Checklist do veículo" onClose={onClose} icon={<ClipboardCheck size={18} />}>
      <div className="field"><label>Veículo utilizado hoje</label>
        <select id="checklist-vehicle" className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>{VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.model}</option>)}</select>
      </div>
      {CHECKLIST_ITEMS.map((i) => (
        <div key={i} className="row">
          <span className="grow semi small">{i}</span>
          <Chip on={state[i] === "ok"} onClick={() => setStateL({ ...state, [i]: "ok" })}>OK</Chip>
          <Chip on={state[i] === "nc"} onClick={() => setStateL({ ...state, [i]: "nc" })}>Problema</Chip>
        </div>
      ))}
      {ncs.length > 0 && <div className="small mt" style={{ padding: 10, borderRadius: 12, background: "var(--warning-soft)" }}>{ncs.length} problema(s) vão gerar <b>não conformidade</b> para a coordenação (foto {PARAMS.catalogs.nonconformityPhotoRequired ? "obrigatória" : "opcional"}).</div>}
      <button className="btn btn-primary btn-block mt" disabled={!all} onClick={() => {
        commit(() => {
          ncs.forEach((item, k) => NONCONFORMITIES.unshift({ id: `nc${Date.now()}${k}`, item, description: "Registrado no checklist do motorista.", vehicleId: vehicle, driverId: ME.id, severity: "medium", status: "open", createdAt: new Date().toISOString(), responsible: "Coord. transportes" }));
          route.checklistDone = true; route.checklistVehicleId = vehicle; route.checklistAt = new Date().toISOString(); route.checklistNcs = ncs;
          notify({ kind: "logistica", priority: ncs.length ? "high" : "normal", title: ncs.length ? "Checklist com não conformidade" : "Checklist concluído", text: `${ME.name} · ${plate}${ncs.length ? ` · problemas: ${ncs.join(", ")}` : " · sem problemas"}.`, to: ["transport_coordinator", ...MANAGERS_KEYS] });
        }, ncs.length ? `Checklist salvo · ${ncs.length} não conformidade(s) aberta(s)` : "Checklist concluído · veículo liberado");
        onClose();
      }}>Concluir checklist</button>
    </Sheet>
  );
}

function IncidentSheet({ onClose, forDelivery }: { onClose: () => void; forDelivery: Delivery | null }) {
  const route = myRoute();
  const [type, setType] = useState<string | null>(forDelivery ? "Ocorrência no cliente" : null);
  const [desc, setDesc] = useState("");
  const [cust, setCust] = useState(forDelivery?.customerId ?? "");
  const [photo, setPhoto] = useState<string | null>(null);
  return (
    <Sheet title="Registrar ocorrência" onClose={onClose} icon={<AlertTriangle size={18} />}>
      <div className="field"><label>Categoria</label><div className="chips">{PARAMS.catalogs.incidentTypes.map((t) => <Chip key={t} on={type === t} onClick={() => setType(t)}>{t}</Chip>)}</div></div>
      <div className="field"><label>Cliente relacionado (opcional)</label>
        <select id="incident-customer" className="input" value={cust} onChange={(e) => setCust(e.target.value)}><option value="">—</option>{route.deliveries.map((d) => <option key={d.id} value={d.customerId}>{customerById.get(d.customerId)?.tradeName} · {d.invoiceNumber}</option>)}</select>
      </div>
      <div className="field"><label>Descrição</label><textarea id="incident-desc" className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <PhotoCapture value={photo} onChange={setPhoto} label="Adicionar foto (opcional)" />
      <p className="xs muted mt">Horário, motorista, veículo e rota são registrados automaticamente.</p>
      <button className="btn btn-primary btn-block mt" disabled={!type || desc.trim().length < 5} onClick={() => {
        commit(() => {
          INCIDENTS.unshift({ id: `i${Date.now()}`, type: type!, description: desc, routeId: route.id, driverId: ME.id, customerId: cust || undefined, createdAt: new Date().toISOString(), status: "open" });
          notify({ kind: "alerta", priority: "high", title: `Ocorrência: ${type}`, text: `${ME.name.split(" ")[0]} · ${route.name}${cust ? ` · ${customerById.get(cust)?.tradeName}` : ""}: ${desc}`, to: ["transport_coordinator"] });
        }, "Ocorrência registrada · coordenação de transportes avisada");
        onClose();
      }}>Enviar ocorrência</button>
    </Sheet>
  );
}

function EpiSheet({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const mine = EPI_REQUESTS.filter((e) => e.driverId === ME.id);
  return (
    <Sheet title="Solicitar EPI" onClose={onClose} icon={<HardHat size={18} />}>
      <div className="field"><label>Tipo de EPI</label>
        <div className="grid g2" style={{ marginBottom: 0 }}>
          {PARAMS.catalogs.epiTypes.map((t) => (
            <button key={t} className={`action-tile ${type === t ? "" : ""}`} style={type === t ? { borderColor: "var(--brand)", boxShadow: "0 0 0 2px var(--brand-soft)" } : undefined} onClick={() => setType(t)}>
              <span className="ic"><HardHat size={18} /></span>{t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid g2" style={{ marginBottom: 0 }}>
        <div className="field"><label>Quantidade</label><input id="epi-qty" className="input" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} /></div>
        <div className="field"><label>Motivo</label><input id="epi-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Desgaste, perda…" /></div>
      </div>
      <button className="btn btn-gold btn-block" disabled={!type || !reason.trim()} onClick={() => {
        commit(() => {
          EPI_REQUESTS.unshift({ id: `e${Date.now()}`, type: type!, qty, reason, status: "requested", createdAt: new Date().toISOString(), driverId: ME.id });
          notify({ kind: "operacional", title: "Nova solicitação de EPI", text: `${ME.name} pediu ${qty}× ${type} (${reason}).`, to: ["transport_coordinator"] });
        }, "Solicitação de EPI enviada à coordenação");
        onClose();
      }}>Enviar solicitação</button>
      <div className="section-title">Minhas solicitações</div>
      {mine.map((e) => (
        <div key={e.id} className="row"><div className="grow"><div className="title small">{e.type} · {e.qty} un.</div><div className="sub">{fmtDate(e.createdAt)} · {e.reason}</div></div>
          <Badge tone={EPI_STATUS[e.status as keyof typeof EPI_STATUS].tone}>{EPI_STATUS[e.status as keyof typeof EPI_STATUS].label}</Badge></div>
      ))}
    </Sheet>
  );
}

function DriverHistory() {
  return (
    <>
      <h2 style={{ margin: "6px 0 12px" }}>Histórico operacional</h2>
      <Card title="Dias anteriores">
        {DRIVER_HISTORY.map((h) => (
          <div key={h.date} className="row">
            <div className="grow"><div className="title">{dayLabel(h.date)} · {h.route}</div><div className="sub">Checklist {h.checklist} · {h.incidents} ocorrência(s)</div></div>
            <div className="end"><div className="semi green">{h.delivered} entregues</div>{h.notDelivered > 0 && <div className="xs red">{h.notDelivered} não entregue</div>}</div>
          </div>
        ))}
      </Card>
      <Card title="Ocorrências e não conformidades" className="mt">
        {[...INCIDENTS.filter((i) => i.driverId === ME.id), ...NONCONFORMITIES.filter((n) => n.driverId === ME.id)].map((x) => (
          <div key={x.id} className="row"><div className="grow"><div className="title small">{"type" in x ? x.type : `NC · ${x.item}`}</div><div className="sub">{x.description}</div></div><Badge tone="warning">{x.status === "open" ? "Aberta" : "Em tratamento"}</Badge></div>
        ))}
        {![...INCIDENTS, ...NONCONFORMITIES].some((x) => x.driverId === ME.id) && <div className="small muted">Nenhum registro.</div>}
      </Card>
      <Card title="Solicitações de EPI" className="mt">
        {EPI_REQUESTS.filter((e) => e.driverId === ME.id).map((e) => (
          <div key={e.id} className="row"><span className="grow small semi">{e.type} · {e.qty} un.</span><Badge tone={EPI_STATUS[e.status as keyof typeof EPI_STATUS].tone}>{EPI_STATUS[e.status as keyof typeof EPI_STATUS].label}</Badge></div>
        ))}
      </Card>
    </>
  );
}
