import { useEffect } from "react";
import { UserRound, Crown, Users, Briefcase, Wallet, FileCheck2, Truck, Layers, Maximize, ChevronRight, BarChart3, Landmark, Route as RouteIcon } from "lucide-react";
import { DemoDataPanel, toggleFullscreen, ThemeSwitch, PresentExit } from "./components/shell";
import { setState, useStore, getState, toast } from "./data/store";
import { registerRoot, registerBackNotice } from "./components/back";
import type { Role } from "./data/mock";
import { TODAY } from "./data/mock";
import { dayLabel } from "./data/selectors";
import { Toasts, scrollPageTop } from "./components/ui";
import { SellerApp } from "./screens/Seller";
import { ManagerApp } from "./screens/Manager";
import { DriverApp } from "./screens/Driver";
import { TransportApp, FinanceApp, BillingApp } from "./screens/Ops";

const GROUPS: { title: string; roles: { role: Role; label: string; desc: string; icon: React.ReactNode; device: string }[] }[] = [
  { title: "Comercial", roles: [
    { role: "seller", label: "Vendedor externo", desc: "Quanto vendi, quanto falta, quem visitar", icon: <UserRound />, device: "Celular" },
    { role: "sales_coordinator", label: "Supervisor comercial", desc: "Equipe, metas, carteiras e aprovações", icon: <Briefcase />, device: "Celular · desktop" },
    { role: "general_manager", label: "Gerente geral", desc: "Tudo do supervisor + logística, relatórios e liberações", icon: <Crown />, device: "Celular · desktop" },
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

// voltar do celular: da tela inicial do perfil volta para a escolha de perfil; na escolha, avisa antes de sair
registerRoot({ has: () => getState().role !== null, back: () => setState({ role: null }) });
registerBackNotice((text) => toast(text, "info", 2500));

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
      <PresentExit />
      {s.role === null && <LoginEnterprise />}
      {s.role === "seller" && <SellerApp />}
      {(s.role === "general_manager" || s.role === "sales_manager" || s.role === "sales_coordinator") && <ManagerApp key={s.role} role={s.role} />}
      {s.role === "driver" && <DriverApp />}
      {s.role === "transport_coordinator" && <TransportApp />}
      {s.role === "finance" && <FinanceApp />}
      {s.role === "billing" && <BillingApp />}
    </>
  );
}


/** Descrições da tela de entrada nova (Empresarial). */
const ENT_DESC: Partial<Record<Role, string>> = {
  seller: "Vendas, metas, carteira e visitas",
  sales_manager: "Desempenho da equipe e acompanhamento de metas",
  sales_coordinator: "Equipe, metas, carteiras e aprovações",
  general_manager: "Comercial + logística, relatórios e liberações",
  finance: "Comprovantes, crédito e prazos",
  billing: "Pedidos liberados e notas fiscais",
  driver: "Rota, checklist e entregas",
  transport_coordinator: "Rotas, entregas e frota",
};
const ENT_GROUP_ICON: Record<string, React.ReactNode> = { Comercial: <BarChart3 size={18} />, Administrativo: <Landmark size={18} />, Logística: <RouteIcon size={18} /> };

function LoginEnterprise() {
  const s = useStore();
  const enter = (role: Role) => { setState({ role }); scrollPageTop(); };
  return (
    <div className="login ent-login">
      <div className="ent-head">
        <div className="ent-tools">
          <button className="icon-btn" onClick={toggleFullscreen} aria-label="Tela cheia" title="Tela cheia"><Maximize size={17} /></button>
          <ThemeSwitch />
        </div>
        <img className="logo-big" src="./galato-logo.png" alt="Galato Sorvetes" />
        <h1 className="ent-title">Plataforma Galato</h1>
        <p className="lead">Comercial, financeiro, faturamento e logística integrados. Demonstração com dados fictícios · {dayLabel(TODAY)} · Escolha um perfil.</p>
      </div>
      <main className="ent-body">
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
          <DemoDataPanel />
        </div>
      </main>
    </div>
  );
}
