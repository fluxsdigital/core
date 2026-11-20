"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Card, CardHeader, CardTitle } from "@flux/ui/card";
import { RecordPicker } from "../cadastros/record-picker";
import { api, download } from "../conta/api";
import { demoEnabled } from "../conta/demo-api";
import { ActionForm, Field } from "../conta/forms";
import {
  demoPeriod,
  inputClass,
  linkClass,
  Pager,
  Workspace,
  type Company,
  type PageResult,
} from "../workspace/workspace";

const orderScopes = {
  open: "Abertas",
  completed: "Concluídas",
  overdue: "Em atraso",
  pending: "Com tarefas pendentes",
};
const priority = { LOW: "Baixa", NORMAL: "Normal", HIGH: "Alta", URGENT: "Urgente" };
export type Priority = keyof typeof priority;
export type Status = { key: string; label: string; terminal: boolean };
type Member = { user: { id: string; name: string } };
type Attachment = { id: string; name: string };
type Task = { id: string; label: string; done: boolean };
type History = {
  id: string;
  action: string;
  createdAt: string;
  details?: { from?: unknown; to?: unknown; task?: string; name?: string };
};
type Order = {
  id: string;
  title: string;
  status: Status;
  statusKey: string;
  priority: Priority;
  assignedUserId: string | null;
  dueAt: string | null;
  completionReport: string | null;
  completedAt: string | null;
  customer: { name: string };
  assignee?: { user: { name: string } } | null;
};
export type Detail = Order & {
  history: History[];
  attachments: Attachment[];
  tasks: Task[];
  quoteId: string | null;
};

const historyTitles: Record<string, string> = {
  "order.created": "Ordem criada",
  "order.updated": "Dados atualizados",
  "order.from_quote": "Criada a partir de orçamento",
  "order.status_changed": "Status alterado",
  "order.task_added": "Item adicionado",
  "order.task_checked": "Checklist atualizado",
  "order.attachment_added": "Anexo enviado",
};

const localDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function localInputDate(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {children}
      </CardHeader>
    </Card>
  );
}

function Editor({
  order,
  company,
  members,
  save,
}: {
  order?: Order;
  company: Company;
  members: Member[];
  save: (data: object) => Promise<void>;
}) {
  return (
    <ActionForm
      label={order ? "Salvar ordem" : "Criar ordem"}
      action={async ({ dueAt, assignedUserId, ...data }) => {
        await save({
          ...data,
          assignedUserId: assignedUserId || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        });
      }}
    >
      <Field name="name" label="Título da ordem" defaultValue={order?.title} minLength={2} />
      {!order && (
        <RecordPicker
          companyId={company.id}
          kind="CUSTOMER"
          label="Cliente"
          name="customerId"
          required
        />
      )}
      <label className="grid gap-1 text-sm font-medium">
        Prioridade da ordem
        <select
          aria-label="Prioridade da ordem"
          name="priority"
          className={inputClass}
          defaultValue={order?.priority ?? "NORMAL"}
        >
          {Object.entries(priority).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Responsável
        <select
          aria-label="Responsável"
          name="assignedUserId"
          className={inputClass}
          defaultValue={order?.assignedUserId ?? ""}
        >
          <option value="">Sem responsável</option>
          {members.map(({ user }) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </label>
      <Field
        name="dueAt"
        label="Prazo"
        type="datetime-local"
        required={false}
        defaultValue={localInputDate(order?.dueAt)}
      />
    </ActionForm>
  );
}

function OrderDetails({
  order,
  path,
  company,
  statuses,
  members,
  ownId,
  reload,
  close,
}: {
  order: Detail;
  path: string;
  company: Company;
  statuses: Status[];
  members: Member[];
  ownId?: string;
  reload: () => Promise<void>;
  close: () => void;
}) {
  const [moveTo, setMoveTo] = useState("");
  const manager = company.role !== "OPERATOR";
  const writable = !order.status.terminal && manager;
  const canOperate = !order.status.terminal && (manager || order.assignedUserId === ownId);

  return (
    <Panel title={order.title}>
      <button className={linkClass} onClick={close}>
        Fechar ordem
      </button>
      <p className="text-sm text-muted-foreground">
        {order.customer.name} · {order.status.label} · {priority[order.priority]}
      </p>
      <p className="text-sm">
        Responsável {order.assignee?.user.name ?? "sem atribuição"}
        {order.dueAt ? ` · Prazo ${localDate(order.dueAt)}` : ""}
      </p>
      {writable && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-sky-800">
            Editar ordem
          </summary>
          <div className="mt-2">
            <Editor
              key={`${order.id}:${order.assignedUserId}:${order.title}:${order.priority}:${order.dueAt}`}
              order={order}
              company={company}
              members={members}
              save={async (data) => {
                await api(path, "PUT", data);
                await reload();
              }}
            />
          </div>
        </details>
      )}
      <section className="mt-2 grid gap-2">
        <h3 className="font-semibold">Checklist</h3>
        {order.tasks.length === 0 && <p className="text-sm text-muted-foreground">Sem itens.</p>}
        <ul className="grid gap-1">
          {order.tasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm"
            >
              <span>
                {task.label} · {task.done ? "Feito" : "Pendente"}
              </span>
              {canOperate && (
                <ActionForm
                  label={task.done ? "Reabrir item" : "Marcar como feito"}
                  action={async () => {
                    await api(`${path}/tasks/${task.id}`, "PATCH", { done: !task.done });
                    await reload();
                  }}
                />
              )}
            </li>
          ))}
        </ul>
        {writable && (
          <ActionForm
            label="Adicionar item ao checklist"
            action={async (data) => {
              await api(`${path}/tasks`, "POST", data);
              await reload();
            }}
          >
            <Field name="name" label="Tarefa" minLength={2} />
          </ActionForm>
        )}
      </section>

      {!demoEnabled && (
        <section className="mt-2 grid gap-2">
          <h3 className="font-semibold">Anexos</h3>
          {order.attachments.map((attachment) => (
            <ActionForm
              key={attachment.id}
              label={`Baixar ${attachment.name}`}
              action={() => download(`${path}/attachments/${attachment.id}`, attachment.name)}
            />
          ))}
          {canOperate && (
            <ActionForm
              label="Enviar anexo"
              action={async (_, data) => {
                await api(`${path}/attachments`, "POST", data);
                await reload();
              }}
            >
              <Field name="file" label="Arquivo (até 5 MB)" type="file" />
            </ActionForm>
          )}
        </section>
      )}

      {canOperate && (
        <ActionForm
          label="Atualizar status"
          className="my-2"
          action={async ({ status, report }) => {
            await api(`${path}/status`, "PATCH", { status, report: report || undefined });
            setMoveTo("");
            await reload();
          }}
        >
          <label className="grid gap-1 text-sm font-medium">
            Novo status
            <select
              aria-label="Novo status"
              name="status"
              required
              value={moveTo}
              className={inputClass}
              onChange={(event) => setMoveTo(event.target.value)}
            >
              <option value="">Selecione</option>
              {statuses
                .filter((status) => status.key !== order.statusKey)
                .map((status) => (
                  <option key={status.key} value={status.key}>
                    {status.label}
                  </option>
                ))}
            </select>
          </label>
          {statuses.find((status) => status.key === moveTo)?.terminal && (
            <label className="grid gap-1 text-sm font-medium">
              Relatório de conclusão
              <textarea name="report" rows={4} maxLength={6000} required className={inputClass} />
            </label>
          )}
        </ActionForm>
      )}

      {order.completedAt && (
        <section className="rounded-md bg-emerald-50 p-3">
          <h3 className="font-semibold">Relatório de conclusão</h3>
          <p className="text-sm text-muted-foreground">{localDate(order.completedAt)}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{order.completionReport}</p>
        </section>
      )}

      <details>
        <summary className="cursor-pointer text-sm font-medium text-sky-800">
          Histórico de alterações
        </summary>
        <ul className="mt-2 grid gap-2 text-sm">
          {order.history.map((entry) => (
            <li key={entry.id}>
              <p>
                {historyTitles[entry.action] ?? entry.action} · {localDate(entry.createdAt)}
              </p>
              {typeof entry.details?.from === "string" && typeof entry.details.to === "string" && (
                <p>
                  {entry.details.from} → {entry.details.to}
                </p>
              )}
              {entry.details?.task && <p>{entry.details.task}</p>}
              {entry.details?.name && <p>{entry.details.name}</p>}
            </li>
          ))}
        </ul>
      </details>
    </Panel>
  );
}

function StatusSettings({
  base,
  statuses,
  reload,
}: {
  base: string;
  statuses: Status[];
  reload: () => Promise<void>;
}) {
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-sky-800">
        Configurar status
      </summary>
      <ActionForm
        label="Adicionar status"
        className="my-2"
        done="Status criado."
        action={async ({ name, terminal }) => {
          await api(`${base}/statuses`, "POST", { name, terminal: Boolean(terminal) });
          await reload();
        }}
      >
        <Field name="name" label="Nome do novo status" minLength={2} />
        <label className="flex gap-2 text-sm font-medium">
          <input name="terminal" type="checkbox" /> Status de conclusão
        </label>
      </ActionForm>
      {statuses.map((status) => (
        <details key={status.key} className="p-2">
          <summary className="cursor-pointer text-sm">{status.label}</summary>
          <ActionForm
            label="Renomear status"
            className="mt-2"
            action={async (data) => {
              await api(`${base}/statuses/${status.key}`, "PUT", data);
              await reload();
            }}
          >
            <Field name="name" label="Nome exibido" minLength={2} defaultValue={status.label} />
          </ActionForm>
        </details>
      ))}
    </details>
  );
}

function CompanyOrders({
  company,
  initialId,
  scope,
  period,
}: {
  company: Company;
  initialId?: string;
  scope: string;
  period: string;
}) {
  const base = `organizations/${company.id}/orders`;
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ownId, setOwnId] = useState<string>();
  const [result, setResult] = useState<PageResult<Order>>();
  const [detail, setDetail] = useState<Detail>();
  const [filter, setFilter] = useState({
    q: "",
    status: "",
    priority: "",
    scope,
    page: 1,
    revision: 0,
  });
  const [error, setError] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activePeriod, setActivePeriod] = useState(period);
  const manager = company.role !== "OPERATOR";

  useEffect(() => {
    let active = true;
    Promise.all([
      api<Status[]>(`${base}/statuses`),
      manager ? api<Member[]>(`organizations/${company.id}/members`) : Promise.resolve([]),
      api<{ id: string }>("auth/me"),
    ])
      .then(([statuses, members, user]) => {
        if (!active) return;
        setStatuses(statuses);
        setMembers(members);
        setOwnId(user.id);
      })
      .catch(() => {
        if (active) setSettingsError(true);
      });
    if (initialId)
      api<Detail>(`${base}/${initialId}`)
        .then((detail) => {
          if (active) setDetail(detail);
        })
        .catch(() => {
          if (active) setSettingsError(true);
        });
    return () => {
      active = false;
    };
  }, [base, company.id, initialId, manager]);

  useEffect(() => {
    let active = true;
    const query = demoEnabled ? demoPeriod(activePeriod) : new URLSearchParams();
    query.set("q", filter.q);
    query.set("page", String(filter.page));
    if (demoEnabled && filter.scope) query.set("scope", filter.scope);
    if (filter.priority) query.set("priority", filter.priority);
    if (filter.status) query.set("status", filter.status);
    api<PageResult<Order>>(`${base}?${query}`)
      .then((response) => {
        if (!active) return;
        setResult(response);
        setError(false);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [base, filter, activePeriod]);

  const reloadList = () => setFilter((current) => ({ ...current, revision: current.revision + 1 }));
  const load = async (id: string) => setDetail(await api<Detail>(`${base}/${id}`));

  return (
    <div
      className={
        creating ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_350px]" : "grid gap-4"
      }
    >
      <div className="grid gap-4">
        {settingsError && (
          <p role="alert" className="text-sm text-red-700">
            Não foi possível carregar as configurações ou a ordem selecionada.
          </p>
        )}
        <Panel title="Lista de ordens">
          {manager && !creating && (
            <button className="module-action" onClick={() => setCreating(true)}>
              Nova ordem
            </button>
          )}
          <form
            className="module-filters"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setFilter({
                q: String(data.get("q") ?? ""),
                status: String(data.get("status") ?? ""),
                priority: String(data.get("priority") ?? ""),
                scope: String(data.get("scope") ?? ""),
                page: 1,
                revision: 0,
              });
            }}
          >
            <Field name="q" label="Título ou cliente" required={false} maxLength={100} />
            <label className="grid gap-1 text-sm font-medium">
              Status
              <select aria-label="Filtrar status" name="status" className={inputClass}>
                <option value="">Todos</option>
                {statuses.map((status) => (
                  <option value={status.key} key={status.key}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Prioridade
              <select aria-label="Filtrar prioridade" name="priority" className={inputClass}>
                <option value="">Todas</option>
                {Object.entries(priority).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {demoEnabled && (
              <label className="grid gap-1 text-sm font-medium">
                Visão
                <select name="scope" className={inputClass} defaultValue={scope}>
                  <option value="">Todas</option>
                  {Object.entries(orderScopes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">
              Filtrar
            </button>
          </form>
          {demoEnabled && demoPeriod(activePeriod).size > 0 && (
            <button className={linkClass} onClick={() => setActivePeriod("")}>
              Limpar filtro de período
            </button>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              Não foi possível carregar as ordens.
            </p>
          )}
          {!result && !error && (
            <p role="status" className="text-sm">
              Carregando…
            </p>
          )}
          {result && !error && (
            <>
              {result.items.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma ordem registrada.</p>
              )}
              <ul className="module-list">
                {result.items.map((order) => (
                  <li key={order.id} className="module-row">
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{order.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.customer.name} · {priority[order.priority]}
                      </p>
                    </div>
                    <div className="module-row-data">
                      <span
                        className={`status-pill ${order.status.terminal ? "bg-teal-100 text-teal-900" : "bg-sky-100 text-sky-900"}`}
                      >
                        {order.status.label}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {order.dueAt ? localDate(order.dueAt) : "Sem prazo"}
                      </span>
                    </div>
                    <ActionForm label="Abrir ordem" action={() => load(order.id)} />
                  </li>
                ))}
              </ul>
              <Pager
                result={result}
                change={(page) => setFilter((current) => ({ ...current, page }))}
              />
            </>
          )}
        </Panel>
        {detail && (
          <OrderDetails
            key={detail.id}
            order={detail}
            path={`${base}/${detail.id}`}
            company={company}
            statuses={statuses}
            members={members}
            ownId={ownId}
            close={() => setDetail(undefined)}
            reload={async () => {
              await load(detail.id);
              reloadList();
            }}
          />
        )}
      </div>
      {manager && creating && (
        <div className="order-first xl:order-none">
          <Panel title="Nova ordem de serviço">
            <button className={linkClass} onClick={() => setCreating(false)}>
              Cancelar
            </button>
            <Editor
              company={company}
              members={members}
              save={async (data) => {
                const order = await api<{ id: string }>(base, "POST", data);
                await load(order.id);
                setCreating(false);
                reloadList();
              }}
            />
          </Panel>
        </div>
      )}
      {(company.role === "OWNER" || company.role === "ADMIN") && (
        <div className="xl:col-span-full">
          <Panel title="Configurações">
            <StatusSettings
              base={base}
              statuses={statuses}
              reload={async () => {
                setStatuses(await api<Status[]>(`${base}/statuses`));
                if (detail) await load(detail.id);
                reloadList();
              }}
            />
          </Panel>
        </div>
      )}
    </div>
  );
}

export function Orders({
  initialId,
  scope,
  period,
}: {
  initialId?: string;
  scope: string | null;
  period: string;
}) {
  const initialScope = demoEnabled && scope && Object.hasOwn(orderScopes, scope) ? scope : "";
  return (
    <Workspace title="Ordens de serviço" module="ordersEnabled">
      {(company) => (
        <CompanyOrders
          key={company.id}
          company={company}
          initialId={initialId}
          scope={initialScope}
          period={period}
        />
      )}
    </Workspace>
  );
}
