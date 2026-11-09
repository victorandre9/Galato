/** Usuários (só o gerente geral): cadastrar, editar, desativar e excluir, dentro do limite do plano. */
import { useState } from "react";
import { UserPlus, Pencil, Trash2, Crown, ShieldCheck } from "lucide-react";
import { commit, useStore } from "../data/store";
import { USERS, USER_LIMIT, USER_ROLE_LABEL, photoKeyOf, applyUserName, type AppUser, type UserRole } from "../data/users";
import { matchRecord } from "../data/search";
import { Card, Sheet, Badge, Progress, ConfirmModal, SearchBox, Chip, Faltando } from "./ui";
import { UserPhoto } from "./userphoto";

const ROLES: UserRole[] = ["sales_coordinator", "seller", "finance", "billing", "transport_coordinator", "driver"];

export function UsersView() {
  useStore();
  const [edit, setEdit] = useState<AppUser | "new" | null>(null);
  const [del, setDel] = useState<AppUser | null>(null);
  const [q, setQ] = useState("");
  const used = USERS.length;
  const full = used >= USER_LIMIT;
  const list = USERS.filter((u) => matchRecord({ extra: `${u.name} ${u.email} ${u.phone} ${USER_ROLE_LABEL[u.role]}` }, q));
  return (
    <>
      <h2 style={{ margin: "6px 0 4px" }}>Usuários</h2>
      <p className="small muted mb">Só o gerente geral (master) cadastra, edita e exclui. O limite de usuários é o do plano contratado.</p>
      <Card className="mb">
        <div className="flex between" style={{ alignItems: "center", gap: 8 }}>
          <div><b className="num" style={{ fontSize: 22 }}>{used}</b> <span className="muted">de {USER_LIMIT} usuários do plano</span></div>
          <button className="btn btn-primary btn-sm" disabled={full} onClick={() => setEdit("new")}><UserPlus size={15} /> Novo usuário</button>
        </div>
        <div className="mt"><Progress rel value={(used / USER_LIMIT) * 100} /></div>
        {full && <div className="xs red mt">Limite do plano atingido. Para cadastrar mais, exclua um usuário ou fale com o suporte para ampliar o plano.</div>}
      </Card>
      <SearchBox value={q} onChange={setQ} placeholder="Nome, função, e-mail ou telefone" />
      <Card>
        <div className="list">
          {list.map((u) => (
            <div key={u.id} className="row" style={{ opacity: u.active ? 1 : 0.55 }}>
              <UserPhoto name={u.name} size={40} userKey={photoKeyOf(u)} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="title small">{u.name} {u.master && <Badge tone="brand"><Crown size={11} /> master</Badge>} {!u.active && <Badge tone="neutral">inativo</Badge>}</div>
                <div className="sub">{USER_ROLE_LABEL[u.role]} · {u.email}</div>
              </div>
              <button className="icon-btn" aria-label={`Editar ${u.name}`} onClick={() => setEdit(u)}><Pencil size={15} /></button>
              {!u.master && <button className="icon-btn" aria-label={`Excluir ${u.name}`} onClick={() => setDel(u)}><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>
      </Card>
      {edit && <UserForm user={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {del && (
        <ConfirmModal title="Excluir usuário" danger confirmLabel="Excluir" onClose={() => setDel(null)}
          text={<>Excluir <b>{del.name}</b> ({USER_ROLE_LABEL[del.role]})? Ele perde o acesso ao app. O histórico de pedidos e visitas continua guardado.</>}
          onConfirm={() => { commit(() => { const i = USERS.findIndex((x) => x.id === del.id); if (i >= 0) USERS.splice(i, 1); }, `${del.name} excluído · vaga liberada no plano`); setDel(null); }} />
      )}
    </>
  );
}

function UserForm({ user, onClose }: { user: AppUser | null; onClose: () => void }) {
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? "seller");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [active, setActive] = useState(user?.active ?? true);
  const ok = name.trim().length > 2 && /.+@.+\..+/.test(email);
  return (
    <Sheet title={user ? `Editar · ${user.name}` : "Novo usuário"} onClose={onClose} icon={<ShieldCheck size={18} />}>
      <div className="field"><label>Nome completo</label><input id="usr-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      {!user?.master && (
        <div className="field"><label>Função (o que ele vê no app)</label>
          <div className="chips">{ROLES.map((r) => <Chip key={r} on={role === r} onClick={() => setRole(r)}>{USER_ROLE_LABEL[r]}</Chip>)}</div>
        </div>
      )}
      <div className="field"><label>E-mail (login)</label><input id="usr-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@galato.com.br" /></div>
      <div className="field"><label>Telefone / WhatsApp</label><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      {!user?.master && (
        <div className="field"><label>Acesso</label>
          <div className="chips"><Chip on={active} onClick={() => setActive(true)}>Ativo</Chip><Chip on={!active} onClick={() => setActive(false)}>Inativo (bloqueado)</Chip></div>
        </div>
      )}
      <button className="btn btn-primary btn-block" disabled={!ok} onClick={() => {
        commit(() => {
          if (user) { Object.assign(user, { name: name.trim(), role: user.master ? user.role : role, email: email.trim(), phone, active: user.master ? true : active }); applyUserName(user); }
          else USERS.push({ id: `u${Date.now().toString(36)}`, name: name.trim(), role, email: email.trim(), phone, active: true });
        }, user ? "Usuário atualizado" : `${name.trim()} cadastrado · convite de acesso enviado por e-mail`);
        onClose();
      }}>{user ? "Salvar alterações" : "Cadastrar usuário"}</button>
      <Faltando itens={[name.trim().length <= 2 && ["Nome completo", "aparece em todas as telas e relatórios"], !/.+@.+\..+/.test(email) && ["E-mail válido", "é o login do usuário e por onde ele recebe o convite"]]} />
    </Sheet>
  );
}
