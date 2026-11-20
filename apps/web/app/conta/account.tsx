"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Card, CardHeader, CardTitle } from "@flux/ui/card";
import { api, ApiError } from "./api";
import { ActionForm, Field } from "./forms";

type User = { id: string; name: string; email: string };
type Organization = { id: string; name: string; role: "OWNER" | "ADMIN" | "MANAGER" | "OPERATOR" };
type Session = { id: string; current: boolean; createdAt: string; expiresAt: string };
type Member = { user: User; role: Organization["role"] };

const roles = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  OPERATOR: "Operador",
};

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="mt-2 grid min-w-0 gap-4">{children}</div>
      </CardHeader>
    </Card>
  );
}

function OrganizationSettings({
  organization,
  updated,
}: {
  organization: Organization;
  updated: () => Promise<unknown>;
}) {
  const [members, setMembers] = useState<Member[]>();
  const path = `organizations/${organization.id}`;
  const load = async () => setMembers(await api<Member[]>(`${path}/members`));

  return (
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {organization.name} · {roles[organization.role]}
      </summary>
      {(organization.role === "OWNER" || organization.role === "ADMIN") && (
        <div className="mt-3 grid gap-4">
          <ActionForm
            label="Salvar razão social"
            done="Empresa atualizada."
            action={async (data) => {
              await api(path, "PATCH", data);
              await updated();
            }}
          >
            <Field name="name" label="Nome da empresa" minLength={2} />
          </ActionForm>
          <ActionForm
            label="Adicionar membro"
            done="Membro associado."
            action={async (data) => {
              await api(`${path}/members`, "POST", data);
              await load();
            }}
          >
            <Field
              name="userId"
              label="Identificador da conta do membro"
              minLength={36}
              maxLength={36}
            />
            <label className="grid gap-1 text-sm font-medium">
              Papel
              <select name="role" className="rounded-md border border-border bg-white px-3 py-2">
                <option value="OPERATOR">Operador</option>
                <option value="MANAGER">Gestor</option>
                {organization.role === "OWNER" && <option value="ADMIN">Administrador</option>}
              </select>
            </label>
          </ActionForm>
          <ActionForm label="Listar membros" action={load} />
          {members && (
            <ul className="grid gap-1 text-sm">
              {members.map(({ user, role }) => (
                <li key={user.id}>
                  {user.name} · {roles[role]}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </details>
  );
}

function PanelSignIn({ signedIn }: { signedIn: (user: User) => void }) {
  const [view, setView] = useState<"login" | "register" | "forgot">("login");
  const login = async ({ email, password }: Record<string, string>) => {
    await api("auth/login", "POST", { email, password }, false);
    signedIn(await api<User>("auth/me"));
  };
  const actions = {
    login,
    register: async (data: Record<string, string>) => {
      await api("auth/register", "POST", data, false);
      await login(data);
    },
    forgot: (data: Record<string, string>) => api("auth/forgot-password", "POST", data, false),
  };
  const titles = { login: "Entrar", register: "Criar conta", forgot: "Recuperar senha" };

  return (
    <Panel title={titles[view]}>
      <ActionForm
        key={view}
        action={actions[view]}
        label={view === "forgot" ? "Solicitar link" : titles[view]}
        done={
          view === "forgot"
            ? "Se a conta estiver cadastrada, enviaremos um link por e-mail."
            : undefined
        }
      >
        {view === "register" && (
          <Field name="name" label="Nome" minLength={2} autoComplete="name" />
        )}
        <Field name="email" label="E-mail" type="email" maxLength={254} autoComplete="email" />
        {view !== "forgot" && (
          <Field
            name="password"
            label="Senha"
            type="password"
            minLength={view === "register" ? 12 : 1}
            maxLength={128}
            autoComplete={view === "register" ? "new-password" : "current-password"}
          />
        )}
      </ActionForm>
      <div className="flex flex-wrap gap-4">
        {(["login", "register", "forgot"] as const)
          .filter((item) => item !== view)
          .map((item) => (
            <button
              key={item}
              type="button"
              className="text-sm text-sky-800 underline"
              onClick={() => setView(item)}
            >
              {titles[item]}
            </button>
          ))}
      </div>
    </Panel>
  );
}

function SignedIn({ user, setUser }: { user: User; setUser: (user: User | null) => void }) {
  const [companies, setCompanies] = useState<Organization[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadError, setLoadError] = useState(false);
  const loadCompanies = async () => setCompanies(await api<Organization[]>("organizations"));
  const loadSessions = async () => setSessions(await api<Session[]>("auth/sessions"));

  useEffect(() => {
    let mounted = true;
    Promise.all([api<Organization[]>("organizations"), api<Session[]>("auth/sessions")])
      .then(([orgs, sessions]) => {
        if (mounted) {
          setCompanies(orgs);
          setSessions(sessions);
        }
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        if (error instanceof ApiError && error.status === 401) setUser(null);
        else setLoadError(true);
      });
    return () => {
      mounted = false;
    };
  }, [setUser]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {loadError && (
        <p role="alert" className="text-red-700 lg:col-span-2">
          Não foi possível carregar empresas ou sessões.
        </p>
      )}
      <Panel title="Perfil">
        <p className="text-sm">
          {user.name} · {user.email}
        </p>
        <p className="break-all text-sm text-muted-foreground">
          Identificador da conta <code>{user.id}</code>
        </p>
        <ActionForm
          label="Atualizar nome"
          done="Perfil atualizado."
          action={async (data) => setUser(await api<User>("auth/me", "PATCH", data))}
        >
          <Field name="name" label="Novo nome" minLength={2} autoComplete="name" />
        </ActionForm>
      </Panel>
      <Panel title="Empresas">
        <ActionForm
          label="Cadastrar empresa"
          done="Empresa cadastrada."
          action={async (data) => {
            await api("organizations", "POST", data);
            await loadCompanies();
          }}
        >
          <Field name="name" label="Nome da empresa" minLength={2} />
        </ActionForm>
        {companies.map((company) => (
          <OrganizationSettings key={company.id} organization={company} updated={loadCompanies} />
        ))}
      </Panel>
      <Panel title="Segurança">
        <ActionForm
          label="Alterar senha"
          action={async (data) => {
            await api("auth/change-password", "POST", data);
            setUser(null);
          }}
        >
          <Field
            name="currentPassword"
            label="Senha atual"
            type="password"
            maxLength={128}
            autoComplete="current-password"
          />
          <Field
            name="password"
            label="Nova senha"
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
          />
        </ActionForm>
      </Panel>
      <Panel title="Sessões ativas">
        {sessions.map((session) => (
          <div key={session.id} className="grid gap-2 text-sm">
            {session.current
              ? "Sessão atual"
              : `Sessão iniciada em ${new Date(session.createdAt).toLocaleString("pt-BR")}`}
            {!session.current && (
              <ActionForm
                label="Revogar sessão"
                action={async () => {
                  await api(`auth/sessions/${session.id}/revoke`, "POST");
                  await loadSessions();
                }}
              />
            )}
          </div>
        ))}
        <ActionForm
          label="Sair"
          action={async () => {
            await api("auth/logout", "POST", undefined, false);
            setUser(null);
          }}
        />
      </Panel>
    </div>
  );
}

export function Account() {
  const [user, setUser] = useState<User | null>();
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    api<User>("auth/me")
      .then((user) => {
        if (mounted) setUser(user);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        if (error instanceof ApiError && error.status === 401) setUser(null);
        else setError(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Conta</h1>
      {error ? (
        <p role="alert">Não foi possível consultar a conta. Recarregue a página.</p>
      ) : user === undefined ? (
        <p role="status">Carregando…</p>
      ) : user === null ? (
        <div className="max-w-lg">
          <PanelSignIn signedIn={setUser} />
        </div>
      ) : (
        <SignedIn user={user} setUser={setUser} />
      )}
    </>
  );
}
