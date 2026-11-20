"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@flux/ui/card";

import { api } from "../conta/api";
import { ActionForm, Field } from "../conta/forms";
import {
  inputClass,
  linkClass,
  Pager,
  Workspace,
  type Company,
  type PageResult,
} from "../workspace/workspace";
import {
  currency,
  directoryKinds,
  directoryPath,
  type Kind,
  type RecordItem,
} from "./directory-types";
import { RecordPicker } from "./record-picker";
import { RecordDocuments } from "./record-documents";

function Editor({
  companyId,
  kind,
  record,
  submit,
}: {
  companyId: string;
  kind: Kind;
  record?: RecordItem;
  submit: (data: object) => Promise<void>;
}) {
  const person = kind === "CUSTOMER" || kind === "CONTACT";
  const catalog = kind === "PRODUCT" || kind === "SERVICE";

  return (
    <ActionForm
      label={record ? "Salvar alterações" : "Cadastrar"}
      done="Cadastro salvo."
      action={async ({ price, ...data }) => {
        await submit({
          ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value || null])),
          ...(catalog ? { priceCents: Math.round(Number(price) * 100) } : {}),
        });
      }}
    >
      <Field name="name" label="Nome" minLength={2} defaultValue={record?.name} />
      {person && (
        <>
          <Field
            name="email"
            label="E-mail"
            required={false}
            type="email"
            maxLength={254}
            defaultValue={record?.email ?? ""}
          />
          <Field
            name="phone"
            label="Telefone"
            required={false}
            type="tel"
            maxLength={40}
            defaultValue={record?.phone ?? ""}
          />
        </>
      )}
      {catalog && (
        <>
          <Field
            name="code"
            label="Código"
            required={false}
            maxLength={80}
            defaultValue={record?.code ?? ""}
          />
          <label className="grid gap-1 text-sm font-medium">
            Preço (R$)
            <input
              name="price"
              type="number"
              required
              min="0"
              max="1000000"
              step="0.01"
              defaultValue={record?.priceCents == null ? "" : record.priceCents / 100}
              className={inputClass}
            />
          </label>
        </>
      )}
      {(kind === "CONTACT" || catalog) && (
        <RecordPicker
          companyId={companyId}
          kind={kind === "CONTACT" ? "CUSTOMER" : "CATEGORY"}
          label={kind === "CONTACT" ? "Cliente" : "Categoria"}
          name="parentId"
          required={kind === "CONTACT"}
          initial={record?.parentId}
        />
      )}
      <label className="grid gap-1 text-sm font-medium">
        Descrição
        <textarea
          name="description"
          maxLength={1500}
          rows={3}
          defaultValue={record?.description ?? ""}
          className={inputClass}
        />
      </label>
    </ActionForm>
  );
}

function Records({ company, kind }: { company: Company; kind: Kind }) {
  const [result, setResult] = useState<PageResult<RecordItem>>();
  const [filter, setFilter] = useState({ q: "", page: 1, revision: 0 });
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<RecordItem>();
  const [documents, setDocuments] = useState<RecordItem>();
  const path = directoryPath(company.id, kind);
  const writable = company.role !== "OPERATOR";

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ q: filter.q, page: String(filter.page) });
    api<PageResult<RecordItem>>(`${path}?${query}`)
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
  }, [filter, path]);

  const reload = () => setFilter((current) => ({ ...current, revision: current.revision + 1 }));

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader>
          <CardTitle>{directoryKinds[kind]}</CardTitle>
          <form
            className="mt-2 flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setFilter({
                q: String(new FormData(event.currentTarget).get("q") ?? ""),
                page: 1,
                revision: 0,
              });
            }}
          >
            <Field name="q" label="Buscar registros" required={false} maxLength={100} />
            <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">
              Buscar
            </button>
          </form>
          {error && (
            <p role="alert" className="text-red-700">
              Não foi possível carregar os registros.
            </p>
          )}
          {!error && !result && <p role="status">Carregando…</p>}
          {!error && result?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          )}
          {result && !error && (
            <>
              <ul className="divide-y divide-border">
                {result.items.map((item) => (
                  <li className="grid gap-2 py-3" key={item.id}>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {(item.code || item.email || item.priceCents != null) && (
                        <p className="break-words text-sm text-muted-foreground">
                          {[
                            item.code,
                            item.email,
                            item.priceCents != null && currency.format(item.priceCents / 100),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {writable && (
                        <button className={linkClass} onClick={() => setEditing(item)}>
                          Editar
                        </button>
                      )}
                      <button className={linkClass} onClick={() => setDocuments(item)}>
                        Observações e anexos
                      </button>
                    </div>
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
      {writable && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? `Editar ${editing.name}` : "Novo registro"}</CardTitle>
            <Editor
              key={editing?.id ?? "new"}
              companyId={company.id}
              kind={kind}
              record={editing}
              submit={async (data) => {
                await api(editing ? `${path}/${editing.id}` : path, editing ? "PUT" : "POST", data);
                if (editing) setEditing(undefined);
                reload();
              }}
            />
            {editing && (
              <>
                <button className={linkClass} onClick={() => setEditing(undefined)}>
                  Cancelar edição
                </button>
                <details>
                  <summary className="cursor-pointer text-sm text-red-700">
                    Arquivar registro
                  </summary>
                  <ActionForm
                    label="Confirmar arquivamento"
                    className="mt-2"
                    action={async () => {
                      await api(`${path}/${editing.id}`, "DELETE");
                      if (documents?.id === editing.id) setDocuments(undefined);
                      setEditing(undefined);
                      reload();
                    }}
                  />
                </details>
              </>
            )}
          </CardHeader>
        </Card>
      )}
      {documents && (
        <RecordDocuments
          key={documents.id}
          record={documents}
          base={`${path}/${documents.id}`}
          writable={writable}
          close={() => setDocuments(undefined)}
        />
      )}
    </div>
  );
}

function CompanyDirectory({ company }: { company: Company }) {
  const [kind, setKind] = useState<Kind>("CUSTOMER");
  return (
    <>
      <label className="mb-4 grid max-w-sm gap-1 text-sm font-medium">
        Tipo de cadastro
        <select
          className={inputClass}
          value={kind}
          onChange={(event) => setKind(event.target.value as Kind)}
        >
          {Object.entries(directoryKinds).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Records key={kind} company={company} kind={kind} />
    </>
  );
}

export function Directory() {
  return (
    <Workspace title="Cadastros" module="directoryEnabled">
      {(company) => <CompanyDirectory key={company.id} company={company} />}
    </Workspace>
  );
}
