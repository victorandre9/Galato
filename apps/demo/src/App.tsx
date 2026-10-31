import { useEffect } from "react";
import { UserRound, Crown, Users, Briefcase, Wallet, FileCheck2, Truck, Layers, Moon, Sun } from "lucide-react";
import { setState, setTheme, useStore } from "./data/store";
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
  useEffect(() => { document.documentElement.dataset.theme = s.theme; }, [s.theme]);
  return (
    <>
      <div className="app-bg" />
      <Toasts />
      {s.role === null && <Login />}
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
      <div style={{ alignSelf: "flex-end" }}>
        <button className="icon-btn" onClick={() => setTheme(s.theme === "light" ? "dark" : "light")} aria-label="Tema">{s.theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button>
      </div>
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
    </div>
  );
}
