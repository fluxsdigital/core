"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@flux/ui/card";

import { currency } from "../cadastros/directory-types";
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

const statuses = { DRAFT: "Rascunho", SENT: "Enviado", APPROVED: "Aprovado", REJECTED: "Recusado" };
const statusColors = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-sky-100 text-sky-900",
  APPROVED: "bg-teal-100 text-teal-900",
  REJECTED: "bg-rose-100 text-rose-900",
};
export type Status = keyof typeof statuses;
type Summary = {
  id: string;
  title: string;
  status: Status;
  customerName: string;
  totalCents: number;
};
type Line = {
  position: number;
  kind: "PRODUCT" | "SERVICE";
  itemId: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  totalCents: number;
};
export type Quote = Summary & {
  customerId: string;
  revision: number;
  subtotalCents: number;
  discountCents: number;
  lines: Line[];
  order: { id: string } | null;
};
type Row = { key: number; kind: "PRODUCT" | "SERVICE"; line?: Line };

function EditQuote({
  company,
  quote,
  save,
}: {
  company: Company;
  quote?: Quote;
  save: (body: object) => Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>(
    () =>
      quote?.lines.map((line) => ({ key: line.position, kind: line.kind, line })) ?? [
        { key: 0, kind: "PRODUCT" },
      ],
  );
  return (
    <ActionForm
      className="mt-2"
      label={quote ? "Salvar rascunho" : "Criar orçamento"}
      done="Orçamento salvo."
      action={async (data) => {
        await save({
          name: data.name,
          customerId: data.customerId,
          lines: rows.map(({ key }) => ({
            itemId: data[`item-${key}`],
            quantity: Number(data[`quantity-${key}`]),
            discountCents: Math.round(Number(data[`discount-${key}`]) * 100),
          })),
          ...(quote ? { revision: quote.revision } : {}),
        });
      }}
    >
      <Field name="name" label="Título" minLength={2} defaultValue={quote?.title} />
      <RecordPicker
        companyId={company.id}
        kind="CUSTOMER"
        label="Cliente"
        name="customerId"
        initial={quote?.customerId}
        required
      />
      {rows.map(({ key, kind, line }, index) => (
        <fieldset key={key} className="grid gap-2 rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-semibold">
            Item {index + 1}
            {line && ` · ${line.label}`}
          </legend>
          <label className="grid gap-1 text-sm font-medium">
            Tipo do item
            <select
              className={inputClass}
              value={kind}
              onChange={(event) =>
                setRows((previous) =>
                  previous.map((row) =>
                    row.key === key ? { ...row, kind: event.target.value as Row["kind"] } : row,
                  ),
                )
              }
            >
              <option value="PRODUCT">Produto</option>
              <option value="SERVICE">Serviço</option>
            </select>
          </label>
          <RecordPicker
            key={kind}
            companyId={company.id}
            kind={kind}
            label="Item do catálogo"
            name={`item-${key}`}
            initial={line?.itemId}
            required
          />
          <label className="grid gap-1 text-sm font-medium">
            Quantidade
            <input
              name={`quantity-${key}`}
              type="number"
              min="1"
              max="1000"
              required
              defaultValue={line?.quantity ?? 1}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Desconto (R$)
            <input
              name={`discount-${key}`}
              type="number"
              min="0"
              max="20000000"
              step="0.01"
              required
              defaultValue={(line?.discountCents ?? 0) / 100}
              className={inputClass}
            />
          </label>
          {rows.length > 1 && (
            <button
              type="button"
              className={linkClass}
              onClick={() => setRows((previous) => previous.filter((row) => row.key !== key))}
            >
              Remover item
            </button>
          )}
        </fieldset>
      ))}
      {rows.length < 100 && (
        <button
          type="button"
          className={linkClass}
          onClick={() =>
            setRows((previous) => [
              ...previous,
              { key: Math.max(...previous.map((row) => row.key)) + 1, kind: "PRODUCT" },
            ])
          }
        >
          Adicionar item
        </button>
      )}
    </ActionForm>
  );
}

function Details({
  quote,
  company,
  path,
  refresh,
  close,
}: {
  quote: Quote;
  company: Company;
  path: string;
  refresh: () => Promise<void>;
  close: () => void;
}) {
  const writable = company.role !== "OPERATOR";
  const update = async (status: Status) => {
    await api(`${path}/status`, "PATCH", { status });
    await refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{quote.title}</CardTitle>
          <button className={linkClass} onClick={close}>
            Fechar orçamento
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {quote.customerName} · {statuses[quote.status]}
        </p>
        <ul className="divide-y divide-border">
          {quote.lines.map((line) => (
            <li key={line.position} className="grid gap-1 py-2 text-sm">
              <p className="font-medium">{line.label}</p>
              <p>
                {line.quantity} × {currency.format(line.unitPriceCents / 100)} · Desconto{" "}
                {currency.format(line.discountCents / 100)} ·{" "}
                {currency.format(line.totalCents / 100)}
              </p>
            </li>
          ))}
        </ul>
        <p className="font-semibold">Total {currency.format(quote.totalCents / 100)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {!demoEnabled && (
            <ActionForm
              label="Baixar PDF"
              action={() => download(`${path}/pdf`, `orcamento-${quote.id}.pdf`)}
            />
          )}
          {writable && quote.status === "DRAFT" && (
            <ActionForm label="Marcar como enviado" action={() => update("SENT")} />
          )}
          {writable && quote.status === "SENT" && (
            <>
              <ActionForm label="Aprovar orçamento" action={() => update("APPROVED")} />
              <ActionForm label="Recusar orçamento" action={() => update("REJECTED")} />
            </>
          )}
          {writable &&
            company.settings.ordersEnabled &&
            quote.status === "APPROVED" &&
            !quote.order && (
              <ActionForm
                label="Gerar ordem de serviço"
                action={async () => {
                  await api(`${path}/convert`, "POST");
                  await refresh();
                }}
              />
            )}
        </div>
        {quote.order && (
          <p role="status" className="break-all text-sm">
            Ordem de serviço criada ·{" "}
            {company.settings.ordersEnabled && (
              <Link className={linkClass} href={`/ordens?ordem=${quote.order.id}`}>
                Abrir ordem
              </Link>
            )}
          </p>
        )}
        {writable && quote.status === "DRAFT" && (
          <details>
            <summary className="cursor-pointer text-sm text-sky-800">Editar rascunho</summary>
            <EditQuote
              key={quote.revision}
              company={company}
              quote={quote}
              save={async (body) => {
                await api(path, "PUT", body);
                await refresh();
              }}
            />
          </details>
        )}
      </CardHeader>
    </Card>
  );
}

function CompanyQuotes({
  company,
  initialStatus,
  period,
}: {
  company: Company;
  initialStatus: string;
  period: string;
}) {
  const base = `organizations/${company.id}/quotes`;
  const [filter, setFilter] = useState({ q: "", status: initialStatus, page: 1, revision: 0 });
  const [result, setResult] = useState<PageResult<Summary>>();
  const [detail, setDetail] = useState<Quote>();
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activePeriod, setActivePeriod] = useState(period);

  useEffect(() => {
    let active = true;
    const query = demoEnabled ? demoPeriod(activePeriod) : new URLSearchParams();
    query.set("q", filter.q);
    query.set("page", String(filter.page));
    if (filter.status) query.set("status", filter.status);
    api<PageResult<Summary>>(`${base}?${query}`)
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

  const reload = () => setFilter((current) => ({ ...current, revision: current.revision + 1 }));
  const loadDetail = async (id: string) => setDetail(await api<Quote>(`${base}/${id}`));
  return (
    <div
      className={
        creating ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]" : "grid gap-4"
      }
    >
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Lista de orçamentos</CardTitle>
              {company.role !== "OPERATOR" && !creating && (
                <button className="module-action" onClick={() => setCreating(true)}>
                  Novo orçamento
                </button>
              )}
            </div>
            <form
              className="module-filters"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setFilter({
                  q: String(data.get("q") ?? ""),
                  status: String(data.get("status") ?? ""),
                  page: 1,
                  revision: 0,
                });
              }}
            >
              <Field name="q" label="Título ou cliente" maxLength={100} required={false} />
              <label className="grid gap-1 text-sm font-medium">
                Status
                <select name="status" className={inputClass} defaultValue={initialStatus}>
                  <option value="">Todos</option>
                  {Object.entries(statuses).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
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
              <p role="alert" className="text-red-700">
                Não foi possível carregar os orçamentos.
              </p>
            )}
            {!error && !result && <p role="status">Carregando…</p>}
            {!error && result?.items.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum orçamento encontrado.</p>
            )}
            {result && !error && (
              <>
                <ul className="module-list">
                  {result.items.map((quote) => (
                    <li className="module-row" key={quote.id}>
                      <div className="min-w-0">
                        <p className="break-words font-semibold">{quote.title}</p>
                        <p className="text-sm text-muted-foreground">{quote.customerName}</p>
                      </div>
                      <div className="module-row-data">
                        <span className={`status-pill ${statusColors[quote.status]}`}>
                          {statuses[quote.status]}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {currency.format(quote.totalCents / 100)}
                        </span>
                      </div>
                      <ActionForm label="Abrir orçamento" action={() => loadDetail(quote.id)} />
                    </li>
                  ))}
                </ul>
                <Pager
                  result={result}
                  change={(page) => setFilter((current) => ({ ...current, page }))}
                />
              </>
            )}
          </CardHeader>
        </Card>
        {detail && (
          <Details
            key={detail.id}
            company={company}
            quote={detail}
            path={`${base}/${detail.id}`}
            close={() => setDetail(undefined)}
            refresh={async () => {
              await loadDetail(detail.id);
              reload();
            }}
          />
        )}
      </div>
      {company.role !== "OPERATOR" && creating && (
        <Card className="order-first xl:order-none">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Novo orçamento</CardTitle>
              <button className={linkClass} onClick={() => setCreating(false)}>
                Cancelar
              </button>
            </div>
            <EditQuote
              company={company}
              save={async (data) => {
                const created = await api<Quote>(base, "POST", data);
                setDetail(created);
                setCreating(false);
                reload();
              }}
            />
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

export function Quotes({
  initialStatus,
  period,
}: {
  initialStatus: string | null;
  period: string;
}) {
  const status = initialStatus && Object.hasOwn(statuses, initialStatus) ? initialStatus : "";
  return (
    <Workspace title="Orçamentos" module="quotesEnabled">
      {(company) => (
        <CompanyQuotes key={company.id} company={company} initialStatus={status} period={period} />
      )}
    </Workspace>
  );
}
