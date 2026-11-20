"use client";

import Link from "next/link";
import { CalendarDays, ClipboardList, FileText } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Card, CardHeader, CardTitle } from "@flux/ui/card";

import { currency } from "../cadastros/directory-types";
import { api } from "../conta/api";
import { demoEnabled, resetDemo } from "../conta/demo-api";
import { ActionForm, Field } from "../conta/forms";
import {
  inputClass,
  linkClass,
  Workspace,
  type Company,
  type Settings,
} from "../workspace/workspace";

const labels = {
  DRAFT: "Rascunhos",
  SENT: "Enviados",
  APPROVED: "Aprovados",
  REJECTED: "Recusados",
};
const quoteColors = {
  DRAFT: "bg-slate-400",
  SENT: "bg-sky-500",
  APPROVED: "bg-teal-600",
  REJECTED: "bg-rose-500",
};
const priorities = { LOW: "Baixa", NORMAL: "Normal", HIGH: "Alta", URGENT: "Urgente" };
type Metrics = {
  quotes: { status: keyof typeof labels; count: number; totalCents: number }[] | null;
  orders: {
    open: number;
    completed: number;
    overdue: number;
    pendingTasks: number;
    deadlines: {
      id: string;
      title: string;
      dueAt: string;
      priority: keyof typeof priorities;
      status: { label: string };
      _count: { tasks: number };
    }[];
  } | null;
};

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {children}
      </CardHeader>
    </Card>
  );
}

function readLogo(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 256 * 1024) {
    throw new Error("Escolha um logo PNG, JPEG ou WebP de até 256 KB.");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o logo."));
    reader.readAsDataURL(file);
  });
}

function ResetDemo() {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {confirming ? (
        <div className="grid gap-3">
          <p className="text-sm">
            Restaurar substitui os registros e a identidade visual salvos neste navegador pelos
            dados de exemplo.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ActionForm
              label="Restaurar dados de exemplo"
              action={async () => {
                await resetDemo();
                window.location.reload();
              }}
            />
            <button className={linkClass} onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button className={linkClass} onClick={() => setConfirming(true)}>
          Restaurar demonstração
        </button>
      )}
    </div>
  );
}

function SettingsEditor({
  company,
  update,
}: {
  company: Company;
  update: (settings: Settings) => void;
}) {
  const settings = company.settings;
  return (
    <details className="rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold">Personalizar empresa</summary>
      <ActionForm
        key={JSON.stringify(settings)}
        className="mt-3 max-w-lg"
        label="Salvar personalização"
        action={async (data, raw) => {
          let logoUrl = settings.logoUrl ?? null;
          if (demoEnabled) {
            const file = raw.get("logo");
            if (data.removeLogo) logoUrl = null;
            else if (file instanceof File && file.size) logoUrl = await readLogo(file);
          }
          const next = await api<Settings>(`organizations/${company.id}/settings`, "PUT", {
            displayName: data.displayName || null,
            ...(demoEnabled && { logoUrl }),
            accentColor: data.accentColor,
            directoryEnabled: Boolean(data.directoryEnabled),
            quotesEnabled: Boolean(data.quotesEnabled),
            ordersEnabled: Boolean(data.ordersEnabled),
          });
          update(next);
        }}
      >
        <Field
          name="displayName"
          label="Nome de exibição"
          required={false}
          minLength={2}
          defaultValue={settings.displayName ?? ""}
        />
        <Field
          name="accentColor"
          label="Cor de destaque"
          type="color"
          defaultValue={settings.accentColor}
        />
        {demoEnabled && (
          <>
            <label className="grid gap-1 text-sm font-medium">
              Logo da empresa
              <input
                className={inputClass}
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
              />
              <span className="text-muted-foreground">PNG, JPEG ou WebP, até 256 KB.</span>
            </label>
            {settings.logoUrl && (
              <label className="flex gap-2 text-sm">
                <input type="checkbox" name="removeLogo" /> Remover logo atual
              </label>
            )}
          </>
        )}
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Módulos habilitados</legend>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              name="directoryEnabled"
              defaultChecked={settings.directoryEnabled}
            />{" "}
            Cadastros
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="quotesEnabled" defaultChecked={settings.quotesEnabled} />{" "}
            Orçamentos
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="ordersEnabled" defaultChecked={settings.ordersEnabled} />{" "}
            Ordens de serviço
          </label>
        </fieldset>
      </ActionForm>
    </details>
  );
}

function CompanyDashboard({
  company,
  update,
}: {
  company: Company;
  update: (settings: Settings) => void;
}) {
  const [metrics, setMetrics] = useState<Metrics>();
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    api<Metrics>(`organizations/${company.id}/dashboard?${filter}`)
      .then((response) => {
        if (!active) return;
        setMetrics(response);
        setError("");
      })
      .catch((error: unknown) => {
        if (active)
          setError(
            error instanceof Error ? error.message : "Não foi possível carregar os indicadores.",
          );
      });
    return () => {
      active = false;
    };
  }, [company.id, company.settings, filter]);

  function listHref(path: string, key: string, value: string) {
    const params = new URLSearchParams(demoEnabled ? filter : "");
    params.set(key, value);
    return `${path}?${params}`;
  }

  const awaiting = metrics?.quotes?.find((entry) => entry.status === "SENT")?.count;
  const totalQuotes = metrics?.quotes?.reduce((sum, row) => sum + row.count, 0) ?? 0;

  return (
    <div className="grid gap-4">
      {saved && (
        <p role="status" className="text-sm text-emerald-800">
          Personalização salva.
        </p>
      )}
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const from = String(data.get("from") ?? "");
          const to = String(data.get("to") ?? "");
          if (from && to && from > to) {
            setError("A data final deve ser igual ou posterior à inicial.");
            return;
          }
          const next = new URLSearchParams();
          if (from) next.set("from", new Date(`${from}T00:00:00`).toISOString());
          if (to) {
            const date = new Date(`${to}T00:00:00`);
            date.setDate(date.getDate() + 1);
            next.set("to", date.toISOString());
          }
          setError("");
          setFilter(next.toString());
        }}
      >
        <span className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-700">
          <CalendarDays size={17} aria-hidden="true" /> Período
        </span>
        <label className="grid gap-1 text-sm font-medium">
          De <input name="from" type="date" className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Até <input name="to" type="date" className={inputClass} />
        </label>
        <button
          type="submit"
          className="rounded-md bg-[#21384d] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#16293b]"
        >
          Filtrar período
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : (
        !metrics && <p role="status">Carregando…</p>
      )}
      {metrics && !error && (
        <>
          {((demoEnabled && metrics.orders) || awaiting !== undefined) && (
            <section
              aria-labelledby="attention-title"
              className="rounded-xl border border-border bg-white p-4 sm:p-5"
            >
              <h2 id="attention-title" className="mb-3 font-semibold">
                Requer atenção
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {demoEnabled && metrics.orders && (
                  <Link href={listHref("/ordens", "scope", "overdue")} className="attention-link">
                    <span className="attention-count bg-rose-100 text-rose-900">
                      {metrics.orders.overdue}
                    </span>
                    <span>Ordens em atraso</span>
                  </Link>
                )}
                {awaiting !== undefined && (
                  <Link href={listHref("/orcamentos", "status", "SENT")} className="attention-link">
                    <span className="attention-count bg-sky-100 text-sky-900">{awaiting}</span>
                    <span>Orçamentos aguardando aprovação</span>
                  </Link>
                )}
              </div>
            </section>
          )}
          {company.settings.ordersEnabled && metrics.orders && (
            <dl
              aria-label="Indicadores de ordens de serviço"
              className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4"
            >
              {[
                {
                  label: "Ordens abertas",
                  scope: "open",
                  value: metrics.orders.open,
                  color: "bg-sky-50 text-sky-800",
                },
                {
                  label: "Ordens concluídas",
                  scope: "completed",
                  value: metrics.orders.completed,
                  color: "bg-teal-50 text-teal-800",
                },
                {
                  label: "Ordens em atraso",
                  scope: "overdue",
                  value: metrics.orders.overdue,
                  color: "bg-rose-50 text-rose-800",
                },
                {
                  label: "Tarefas pendentes",
                  scope: "pending",
                  value: metrics.orders.pendingTasks,
                  color: "bg-amber-50 text-amber-900",
                },
              ].map(({ label, value, color, scope }) => (
                <div
                  key={label}
                  className="relative rounded-xl border border-border bg-card p-4 sm:p-5"
                >
                  <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-md ${color}`}>
                      <ClipboardList size={16} aria-hidden="true" />
                    </span>
                    {demoEnabled ? (
                      <Link
                        className="hover:underline after:absolute after:inset-0"
                        href={listHref("/ordens", "scope", scope)}
                      >
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                  </dt>
                  <dd className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {company.settings.quotesEnabled && metrics.quotes && (
              <ChartCard title="Orçamentos por status">
                <dl className="mt-2 grid gap-3">
                  {metrics.quotes.map((row) => (
                    <div
                      key={row.status}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-sm"
                    >
                      <dt>
                        <Link
                          className="text-slate-700 hover:underline"
                          href={listHref("/orcamentos", "status", row.status)}
                        >
                          {labels[row.status]}
                        </Link>
                      </dt>
                      <dd className="contents font-medium tabular-nums">
                        <span>
                          {row.count} · {currency.format(row.totalCents / 100)}
                        </span>
                        <span
                          aria-hidden="true"
                          className="col-span-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
                        >
                          <span
                            className={`block h-full rounded-full ${quoteColors[row.status]}`}
                            style={{
                              width: `${totalQuotes ? (row.count / totalQuotes) * 100 : 0}%`,
                            }}
                          />
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </ChartCard>
            )}
            {company.settings.ordersEnabled && metrics.orders && (
              <ChartCard title="Prazos das ordens abertas">
                {metrics.orders.deadlines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem prazos no período.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {metrics.orders.deadlines.map((entry) => (
                      <li key={entry.id} className="grid gap-1 py-3">
                        <Link href={`/ordens?ordem=${entry.id}`} className={linkClass}>
                          {entry.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {new Date(entry.dueAt).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}{" "}
                          · {entry.status.label} · {priorities[entry.priority]} ·{" "}
                          {entry._count.tasks} pendente(s)
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </ChartCard>
            )}
          </div>
          {!company.settings.quotesEnabled && !company.settings.ordersEnabled && (
            <p className="text-sm text-muted-foreground">
              Habilite Orçamentos ou Ordens de serviço para acompanhar indicadores.
            </p>
          )}
        </>
      )}
      {(company.role === "OWNER" || company.role === "ADMIN") && (
        <SettingsEditor
          company={company}
          update={(settings) => {
            update(settings);
            setSaved(true);
          }}
        />
      )}
      {demoEnabled && <ResetDemo />}
    </div>
  );
}

export function Dashboard() {
  return (
    <Workspace
      title="Visão geral"
      heading={(company) => (
        <section className="dashboard-hero">
          <p className="hero-kicker">Painel de operações</p>
          <h1>Visão geral</h1>
          <p>Acompanhe seus orçamentos, ordens de serviço e prazos em um só lugar.</p>
          {demoEnabled && (
            <p className="mt-2 text-sm">Dados fictícios. Alterações salvas neste navegador.</p>
          )}
          {company?.settings.quotesEnabled && (
            <Link href="/orcamentos" className="hero-action">
              <FileText size={17} aria-hidden="true" /> Explorar orçamentos
            </Link>
          )}
        </section>
      )}
    >
      {(company, update) => <CompanyDashboard key={company.id} company={company} update={update} />}
    </Workspace>
  );
}
