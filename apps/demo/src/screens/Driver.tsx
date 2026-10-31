/** Perfil MOTORISTA — 3 áreas: Início, Histórico, Perfil. */
import { useState } from "react";
import {
  Home, History, UserRound, Play, Truck, Package, MapPin, ClipboardCheck, AlertTriangle, HardHat, CheckCircle2,
  XCircle, Camera, Flag, ChevronRight, Navigation,
} from "lucide-react";
import { DELIVERY_STATUS, EPI_STATUS } from "@galato/domain";
import {
  PARAMS, DELIVERY_ROUTES, CURRENT_DRIVER as ME, VEHICLES, CHECKLIST_ITEMS, EPI_REQUESTS, DRIVER_HISTORY,
  NONCONFORMITIES, INCIDENTS, customerById, NOW, TODAY, type Delivery,
} from "../data/mock";
import { routeProgress, dayLabel } from "../data/selectors";
import { commit, setState, useStore } from "../data/store";
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
  const s = useStore();
  const route = myRoute();
  const p = routeProgress(route);
  const vehicle = VEHICLES.find((v) => v.id === route.vehicleId)!;
  const [sheet, setSheet] = useState<null | "checklist" | "incident" | "epi" | "deliveries">(null);
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const resolved = route.deliveries.every((d) => d.status === "delivered" || d.status === "not_delivered");

  function startDay() {
    commit(() => {
      route.startedAt = NOW.toISOString();
      route.deliveries.forEach((d) => { if (d.status === "scheduled") d.status = "in_transit"; });
      setState({ driverDayStarted: true });
    }, "Dia iniciado · pedidos em trânsito · vendedores, gestão e logística avisados");
    setConfirmStart(false);
  }

  return (
    <>
      <Greeting icon={<Truck size={22} />} title={`Olá, ${ME.name.split(" ")[0]}!`} sub={`${route.code} · ${route.name} · ${dayLabel(TODAY)}`} />

      {!s.driverDayStarted ? (
        <div className="hero mb">
          <div className="small t2 mb">Veículo {vehicle.plate} · {route.deliveries.length} entregas · {route.deliveries.reduce((a, d) => a + d.volumes, 0)} volumes</div>
          {!s.driverChecklistDone && (
            <div className="small mb" style={{ color: "var(--warning)", fontWeight: 600 }}>⚠ Faça o checklist do veículo antes de sair.</div>
          )}
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
              <div className="xs muted mt">{s.driverDayFinished ? "Dia finalizado" : `Em rota desde ${new Date(route.startedAt!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: PARAMS.timezone })}`}</div>
            </div>
            <ChevronRight className="muted" />
          </div>
        </Card>
      )}

      <div className="grid g3">
        <Card className="kpi"><div className="kpi-head"><span className="kpi-ic"><Truck size={16} /></span>Entregas</div><div className="kpi-value num">{p.total}</div></Card>
        <Card className="kpi"><div className="kpi-head"><span className="kpi-ic gold"><Package size={16} /></span>Volumes</div><div className="kpi-value num">{route.deliveries.reduce((a, d) => a + d.volumes, 0)}</div></Card>
        <Card className="kpi"><div className="kpi-head"><span className="kpi-ic info"><MapPin size={16} /></span>Rota</div><div className="kpi-value num">{route.code}</div></Card>
      </div>

      <Card title="Checklist do veículo" icon={<ClipboardCheck size={17} />} link={s.driverChecklistDone ? "Ver" : "Fazer agora"} onLink={() => setSheet("checklist")} onClick={() => setSheet("checklist")}>
        <div className="progress-row"><Progress value={s.driverChecklistDone ? 100 : 0} color="green" /><span className="xs">{s.driverChecklistDone ? `${CHECKLIST_ITEMS.length} de ${CHECKLIST_ITEMS.length} itens` : "pendente"}</span></div>
      </Card>

      <div className="grid g2 mt">
        <button className="action-tile" onClick={() => setSheet("incident")}><span className="ic"><AlertTriangle size={20} /></span>Registrar ocorrência</button>
        <button className="action-tile gold" onClick={() => setSheet("epi")}><span className="ic"><HardHat size={20} /></span>Solicitar EPI</button>
      </div>

      {s.driverDayStarted && (
        <>
          <Card title="Próximas entregas" icon={<Navigation size={17} />} link="Todas" onLink={() => setSheet("deliveries")}>
            {route.deliveries.filter((d) => d.status === "in_transit").slice(0, 3).map((d) => <DeliveryRow key={d.id} d={d} onClick={() => setDelivery(d)} />)}
            {resolved && <div className="small green semi">Todas as entregas resolvidas.</div>}
          </Card>
          {!s.driverDayFinished && (
            <button className="btn btn-ghost btn-block mt" onClick={() => setConfirmFinish(true)}><Flag size={17} /> Finalizar o dia</button>
          )}
        </>
      )}

      {confirmStart && (
        <ConfirmModal title="Iniciar o dia?" confirmLabel="Iniciar" onClose={() => setConfirmStart(false)} onConfirm={startDay}
          text={<>Será registrado: horário, motorista <b>{ME.name}</b>, veículo <b>{vehicle.plate}</b> e rota <b>{route.name}</b>. As entregas passam para “Em trânsito” e vendedores, gestão comercial e logística são informados.</>} />
      )}
      {confirmFinish && (
        <ConfirmModal title="Finalizar o dia?" confirmLabel="Finalizar" danger disabled={!resolved} onClose={() => setConfirmFinish(false)}
          onConfirm={() => { commit(() => { route.finishedAt = NOW.toISOString(); setState({ driverDayFinished: true }); }, "Dia finalizado · resumo enviado à coordenação"); setConfirmFinish(false); }}
          text={resolved ? "Todas as entregas estão resolvidas. Confirma o encerramento?" : <><b className="red">{p.pending} entrega(s) ainda pendente(s).</b> Confirme a entrega ou informe o motivo de não entrega antes de finalizar.</>} />
      )}
      {sheet === "deliveries" && (
        <Sheet title={`Entregas · ${route.name}`} onClose={() => setSheet(null)}>
          {route.deliveries.map((d) => <DeliveryRow key={d.id} d={d} onClick={() => setDelivery(d)} />)}
        </Sheet>
      )}
      {sheet === "checklist" && <ChecklistSheet onClose={() => setSheet(null)} />}
      {sheet === "incident" && <IncidentSheet onClose={() => setSheet(null)} />}
      {sheet === "epi" && <EpiSheet onClose={() => setSheet(null)} />}
      {delivery && <DeliverySheet d={delivery} onClose={() => setDelivery(null)} />}
    </>
  );
}

function DeliveryRow({ d, onClick }: { d: Delivery; onClick: () => void }) {
  const c = customerById.get(d.customerId)!;
  const st = DELIVERY_STATUS[d.status];
  return (
    <div className="row click" onClick={onClick}>
      <span className="pos">{d.seq}</span>
      <div className="grow"><div className="title">{c.tradeName}</div><div className="sub">{c.address} · {d.invoiceNumber} · {d.volumes} vol.</div></div>
      <Badge tone={st.tone}>{st.label}</Badge>
    </div>
  );
}

function DeliverySheet({ d, onClose }: { d: Delivery; onClose: () => void }) {
  const c = customerById.get(d.customerId)!;
  const [mode, setMode] = useState<null | "fail">(null);
  const [proof, setProof] = useState(false);
  const [proofType, setProofType] = useState(PARAMS.catalogs.deliveryProofTypes[0]!);
  const [reason, setReason] = useState<string | null>(null);
  const done = d.status === "delivered" || d.status === "not_delivered";
  return (
    <Sheet title={`Entrega ${d.seq} · ${c.tradeName}`} onClose={onClose}>
      <Card>
        <dl className="kv">
          <dt>Endereço</dt><dd>{c.address}, {c.district}</dd><dt>Cidade</dt><dd>{c.city}</dd>
          <dt>Nota / pedido</dt><dd>{d.invoiceNumber} · {d.orderNumber}</dd><dt>Volumes</dt><dd>{d.volumes}</dd>
          <dt>Contato</dt><dd>{c.buyerName} · {c.phone}</dd>
        </dl>
      </Card>
      {done ? (
        <div className="mt"><Badge tone={DELIVERY_STATUS[d.status].tone}>{DELIVERY_STATUS[d.status].label}</Badge> {d.nonDeliveryReason && <span className="small">· {d.nonDeliveryReason}</span>} {d.proofName && <span className="small">· comprovante anexado</span>}</div>
      ) : mode === "fail" ? (
        <Card className="mt">
          <div className="semi mb">Motivo da não entrega (obrigatório)</div>
          <div className="chips">{PARAMS.catalogs.nonDeliveryReasons.map((r) => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}</div>
          <div className="grid g2 mt" style={{ marginBottom: 0 }}>
            <button className="btn btn-ghost" onClick={() => setMode(null)}>Voltar</button>
            <button className="btn btn-danger" disabled={!reason} onClick={() => { commit(() => { d.status = "not_delivered"; d.nonDeliveryReason = reason!; }, "Não entrega registrada · coordenação avisada"); onClose(); }}>Confirmar</button>
          </div>
        </Card>
      ) : (
        <>
          <div className="field mt"><label>Tipo de comprovante</label>
            <div className="chips">{PARAMS.catalogs.deliveryProofTypes.map((t) => <Chip key={t} on={proofType === t} onClick={() => setProofType(t)}>{t}</Chip>)}</div>
          </div>
          <div className={`upload ${proof ? "done" : ""}`} onClick={() => setProof(true)}>
            {proof ? `✓ ${proofType} fotografado` : <><Camera size={20} /><br />Fotografar comprovante assinado</>}
          </div>
          <button className="btn btn-primary btn-block mt" disabled={!proof} onClick={() => { commit(() => { d.status = "delivered"; d.deliveredAt = NOW.toISOString(); d.proofName = proofType; }, "Entrega confirmada · vendedor e cliente atualizados"); onClose(); }}><CheckCircle2 size={18} /> Confirmar entrega</button>
          <div className="grid g2 mt" style={{ marginBottom: 0 }}>
            <button className="btn btn-ghost" onClick={() => setMode("fail")}><XCircle size={16} /> Não entregue</button>
            <button className="btn btn-ghost" onClick={() => { commit(() => {}, "Ocorrência registrada"); }}><AlertTriangle size={16} /> Ocorrência</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function ChecklistSheet({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [vehicle, setVehicle] = useState(myRoute().vehicleId);
  const [state, setStateL] = useState<Record<string, "ok" | "nc" | undefined>>(() => s.driverChecklistDone ? Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i, "ok"])) : {});
  const all = CHECKLIST_ITEMS.every((i) => state[i]);
  const ncs = CHECKLIST_ITEMS.filter((i) => state[i] === "nc");
  return (
    <Sheet title="Checklist do veículo" onClose={onClose} icon={<ClipboardCheck size={18} />}>
      <div className="field"><label>Veículo utilizado hoje</label>
        <select className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>{VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.model}</option>)}</select>
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
          ncs.forEach((item) => NONCONFORMITIES.unshift({ id: `nc${Date.now()}${item}`, item, description: "Registrado no checklist do motorista.", vehicleId: vehicle, driverId: ME.id, severity: "medium", status: "open", createdAt: NOW.toISOString(), responsible: "Coord. transportes" }));
          setState({ driverChecklistDone: true });
        }, ncs.length ? `Checklist salvo · ${ncs.length} não conformidade(s) aberta(s)` : "Checklist concluído · veículo liberado");
        onClose();
      }}>Concluir checklist</button>
    </Sheet>
  );
}

function IncidentSheet({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState(false);
  return (
    <Sheet title="Registrar ocorrência" onClose={onClose} icon={<AlertTriangle size={18} />}>
      <div className="field"><label>Categoria</label><div className="chips">{PARAMS.catalogs.incidentTypes.map((t) => <Chip key={t} on={type === t} onClick={() => setType(t)}>{t}</Chip>)}</div></div>
      <div className="field"><label>Cliente relacionado (opcional)</label>
        <select className="input"><option>—</option>{myRoute().deliveries.map((d) => <option key={d.id}>{customerById.get(d.customerId)?.tradeName} · {d.invoiceNumber}</option>)}</select>
      </div>
      <div className="field"><label>Descrição</label><textarea className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className={`upload ${photo ? "done" : ""}`} onClick={() => setPhoto(true)}>{photo ? "✓ 2 fotos anexadas" : "Adicionar fotos"}</div>
      <p className="xs muted mt">Horário, motorista, veículo, rota e localização (se permitido) são registrados automaticamente.</p>
      <button className="btn btn-primary btn-block mt" disabled={!type || desc.length < 5} onClick={() => {
        commit(() => INCIDENTS.unshift({ id: `i${Date.now()}`, type: type!, description: desc, routeId: myRoute().id, driverId: ME.id, createdAt: NOW.toISOString(), status: "open" }), "Ocorrência registrada · coordenação de transportes avisada");
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
      <div className="field"><label>Tipo de EPI</label><div className="chips">{PARAMS.catalogs.epiTypes.map((t) => <Chip key={t} on={type === t} onClick={() => setType(t)}>{t}</Chip>)}</div></div>
      <div className="grid g2" style={{ marginBottom: 0 }}>
        <div className="field"><label>Quantidade</label><input className="input" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
        <div className="field"><label>Motivo</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Desgaste, perda…" /></div>
      </div>
      <button className="btn btn-gold btn-block" disabled={!type || !reason} onClick={() => {
        commit(() => EPI_REQUESTS.unshift({ id: `e${Date.now()}`, type: type!, qty, reason, status: "requested", createdAt: NOW.toISOString(), driverId: ME.id }), "Solicitação de EPI enviada");
        onClose();
      }}>Solicitar</button>
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
