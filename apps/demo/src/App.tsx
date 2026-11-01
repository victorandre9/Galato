import { useEffect } from "react";
import { UserRound, Crown, Users, Briefcase, Wallet, FileCheck2, Truck, Layers, Moon, Sun, Maximize, ChevronRight, FlaskConical, BarChart3, Landmark, Route as RouteIcon } from "lucide-react";
import { DemoDataPanel, toggleFullscreen, ThemePicker } from "./components/shell";
import { setState, toggleDark, useStore } from "./data/store";
import type { Role } from "./data/mock";
import { TODAY } from "./data/mock";
import { dayLabel } from "./data/selectors";
import { Toasts } from "./components/ui";
import { SellerApp } from "./screens/Seller";
import { ManagerApp } from "./screens/Manager";
import { DriverApp } from "./screens/Driver";
import { TransportApp, FinanceApp, BillingApp } from "./screens/Ops";

const GROUPS: { title: string; roles: { role: Role; label: string; desc: string; icon: React.ReactNode; device: string }[] }[] = [
  { title: "Comercial", roles: [
    { role: "seller", label: "Vendedor externo", desc: "Quanto vendi, quanto falta, quem visitar", icon: <UserRound />, device: "Celular" },
    { role: "sales_manager", label: "Gerente comercial", desc: "Equipe, metas, exceções", icon: <Users />, device: "Celular · desktop" },
    { role: "sales_coordinator", label: "Coordenador comercial", desc: "Carteiras, transferências, cobertura", icon: <Briefcase />, device: "Desktop" },
    { role: "general_manager", label: "Gerente geral", desc: "Visão executiva da operação", icon: <Crown />, device: "Desktop" },
  ]},
  { title: "Administrativo", roles: [
    { role: "finance", label: "Financeiro / Crédito", desc: "Comprovantes, SLA, liberação", icon: <Wallet />, device: "Desktop" },
    { role: "billing", label: "Faturamento", desc: "Pedidos liberados → NF", icon: <FileCheck2 />, device: "Desktop" },
  ]},
  { title: "Logística", roles: [
    { role: "driver", label: "Motorista", desc: "Rota, entregas, checklist", icon: <Truck />, device: "Celular" },
    { role: "transport_coordinator", label: "Coord. Transportes", desc: "Rotas, entregas, ocorrências", icon: <Layers />, device: "Desktop" },
  ]},
];

export default function App() {
  const s = useStore();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = s.theme === "dark" ? "dark" : "light";
    root.classList.toggle("ent", s.theme === "light");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", s.theme === "dark" ? "#1B0407" : s.theme === "light" ? "#F5F7FA" : "#F6F4F1");
  }, [s.theme]);
  return (
    <>
      <div className="app-bg" />
      <div className="statusbar-shield" aria-hidden="true" />
      <Toasts />
      {s.role === null && (s.theme === "light" ? <LoginEnterprise /> : <Login />)}
      {s.role === "seller" && <SellerApp />}
      {(s.role === "general_manager" || s.role === "sales_manager" || s.role === "sales_coordinator") && <ManagerApp key={s.role} role={s.role} />}
      {s.role === "driver" && <DriverApp />}
      {s.role === "transport_coordinator" && <TransportApp />}
      {s.role === "finance" && <FinanceApp />}
      {s.role === "billing" && <BillingApp />}
    </>
  );
}

function Login() {
  const s = useStore();
  return (
    <div className="login">
      <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
        <button className="icon-btn" onClick={toggleFullscreen} aria-label="Tela cheia" title="Tela cheia"><Maximize size={18} /></button>
        <button className="icon-btn" onClick={() => toggleDark(s.theme)} aria-label="Tema">{s.theme !== "dark" ? <Moon size={18} /> : <Sun size={18} />}</button>
      </div>
      <div className="theme-top"><ThemePicker /></div>
      <img className="logo-big" src="./galato-logo.png" alt="Galato Sorvetes" />
      <h1>Plataforma Galato</h1>
      <p className="lead">Comercial, financeiro, faturamento e logística integrados. Demonstração com dados fictícios · {dayLabel(TODAY)}. Escolha um perfil.</p>
      {GROUPS.map((g) => (
        <div key={g.title} style={{ width: "100%", display: "contents" }}>
          <div className="role-group">{g.title}</div>
          <div className="roles">
            {g.roles.map((r) => (
              <button key={r.role} className="card click role-card" onClick={() => { setState({ role: r.role }); window.scrollTo({ top: 0 }); }}>
                <span className="ic">{r.icon}</span>
                <div><b>{r.label}</b><span>{r.desc}</span><div className="xs muted" style={{ marginTop: 4 }}>{r.device}</div></div>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="card" style={{ width: "100%", maxWidth: 520, marginTop: 26 }}><div className="card-title">Aparência</div><ThemePicker /></div>
      <div style={{ width: "100%", maxWidth: 520, marginTop: 14 }}><DemoDataPanel /></div>
    </div>
  );
}

/** Descrições da tela de entrada nova (Empresarial). */
const ENT_DESC: Partial<Record<Role, string>> = {
  seller: "Vendas, metas, carteira e visitas",
  sales_manager: "Desempenho da equipe e acompanhamento de metas",
  sales_coordinator: "Gestão de carteiras, territórios e transferências",
  general_manager: "Visão consolidada da operação",
  finance: "Comprovantes, crédito e prazos",
  billing: "Pedidos liberados e notas fiscais",
  driver: "Rota, checklist e entregas",
  transport_coordinator: "Rotas, entregas e frota",
};
const ENT_GROUP_ICON: Record<string, React.ReactNode> = { Comercial: <BarChart3 size={18} />, Administrativo: <Landmark size={18} />, Logística: <RouteIcon size={18} /> };

function LoginEnterprise() {
  const s = useStore();
  const enter = (role: Role) => { setState({ role }); window.scrollTo({ top: 0 }); };
  return (
    <div className="login ent-login">
      <div className="ent-head">
        <div className="ent-tools">
          <button className="icon-btn" onClick={toggleFullscreen} aria-label="Tela cheia" title="Tela cheia"><Maximize size={17} /></button>
          <button className="icon-btn" onClick={() => toggleDark(s.theme)} aria-label="Modo escuro" title="Modo escuro"><Moon size={17} /></button>
        </div>
        <img className="logo-big" src="./galato-logo.png" alt="Galato Sorvetes" />
        <h1 className="ent-title">Plataforma Galato</h1>
        <span className="ent-demo"><FlaskConical size={15} /> Ambiente de demonstração</span>
      </div>
      <main className="ent-body">
        <div className="ent-hero">
          <h1>Acesse seu ambiente de trabalho</h1>
          <p className="lead">Selecione seu perfil para acessar as ferramentas e os indicadores da sua operação.</p>
          <p className="ent-note">Dados fictícios de demonstração · {dayLabel(TODAY)}</p>
        </div>
        {GROUPS.filter((g) => g.title === "Comercial").map((g) => (
          <section key={g.title} className="ent-group" aria-label={g.title}>
            <h2 className="ent-group-title">{ENT_GROUP_ICON[g.title]} {g.title}</h2>
            <div className="ent-list">
              {g.roles.map((r) => (
                <button key={r.role} className="ent-role" onClick={() => enter(r.role)}>
                  <span className="ent-ic">{r.icon}</span>
                  <span className="ent-txt"><b>{r.label}</b><span>{ENT_DESC[r.role] ?? r.desc}</span></span>
                  <span className="ent-dev">{r.device}</span>
                  <ChevronRight size={18} className="ent-chev" />
                </button>
              ))}
            </div>
          </section>
        ))}
        <div className="ent-areas">
          {GROUPS.filter((g) => g.title !== "Comercial").map((g) => (
            <section key={g.title} className="ent-group" aria-label={g.title}>
              <h2 className="ent-group-title">{ENT_GROUP_ICON[g.title]} {g.title}</h2>
              <div className="ent-tiles">
                {g.roles.map((r) => (
                  <button key={r.role} className={`ent-tile ${r.role === "finance" || r.role === "transport_coordinator" ? "acc" : ""}`} onClick={() => enter(r.role)}>
                    <span className="ent-ic">{r.icon}</span>
                    <span className="ent-txt"><b>{r.label}</b><span>{ENT_DESC[r.role] ?? r.desc}</span></span>
                    <ChevronRight size={16} className="ent-chev" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="ent-foot">
          <div className="card"><div className="card-title">Aparência</div><ThemePicker /></div>
          <DemoDataPanel />
        </div>
      </main>
    </div>
  );
}
