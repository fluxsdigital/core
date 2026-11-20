"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@flux/ui/card";

import { api, download } from "../conta/api";
import { demoEnabled } from "../conta/demo-api";
import { ActionForm, Field } from "../conta/forms";
import { inputClass, linkClass, Pager, type PageResult } from "../workspace/workspace";
import type { RecordItem } from "./directory-types";

type Document = { id: string; name?: string; content?: string; size?: number };

function DocumentList({
  endpoint,
  writable,
  notes,
}: {
  endpoint: string;
  writable: boolean;
  notes: boolean;
}) {
  const [result, setResult] = useState<PageResult<Document>>();
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState({ q: "", page: 1, revision: 0 });

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ q: filter.q, page: String(filter.page), size: "10" });
    api<PageResult<Document>>(`${endpoint}?${query}`)
      .then((value) => {
        if (!active) return;
        setResult(value);
        setError(false);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [endpoint, filter]);

  const reload = () => setFilter((current) => ({ ...current, revision: current.revision + 1 }));

  return (
    <section className="grid min-w-0 gap-2">
      <h3 className="text-sm font-semibold">{notes ? "Observações" : "Anexos"}</h3>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter({
            q: String(new FormData(event.currentTarget).get("q") ?? ""),
            page: 1,
            revision: 0,
          });
        }}
      >
        <Field
          name="q"
          label={notes ? "Buscar observações" : "Buscar anexos"}
          required={false}
          maxLength={100}
        />
        <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">
          Buscar
        </button>
      </form>
      {writable && (
        <ActionForm
          label={notes ? "Adicionar observação" : "Enviar anexo"}
          className="my-2"
          action={async (data, raw) => {
            await api(endpoint, "POST", notes ? data : raw);
            reload();
          }}
        >
          {notes ? (
            <label className="grid gap-1 text-sm font-medium">
              Observação
              <textarea className={inputClass} name="content" required maxLength={3000} />
            </label>
          ) : (
            <Field name="file" label="Arquivo (até 5 MB)" type="file" />
          )}
        </ActionForm>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          Não foi possível carregar os dados.
        </p>
      )}
      {!error && !result && (
        <p role="status" className="text-sm">
          Carregando…
        </p>
      )}
      {!error && result?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">Sem registros.</p>
      )}
      {result && !error && (
        <>
          <ul className="divide-y divide-border">
            {result.items.map((item) => (
              <li key={item.id} className="grid gap-2 py-3">
                <p className="whitespace-pre-wrap break-words text-sm">
                  {notes ? item.content : `${item.name} · ${Math.ceil((item.size ?? 0) / 1024)} KB`}
                </p>
                {!notes && (
                  <ActionForm
                    label="Baixar anexo"
                    action={() => download(`${endpoint}/${item.id}`, item.name ?? "anexo")}
                  />
                )}
                {writable && (
                  <details>
                    <summary className="cursor-pointer text-sm text-sky-800">
                      Editar ou arquivar
                    </summary>
                    <ActionForm
                      className="my-2"
                      label="Salvar"
                      action={async (data) => {
                        await api(`${endpoint}/${item.id}`, "PUT", data);
                        reload();
                      }}
                    >
                      {notes ? (
                        <label className="grid gap-1 text-sm font-medium">
                          Texto da observação
                          <textarea
                            className={inputClass}
                            name="content"
                            required
                            maxLength={3000}
                            defaultValue={item.content}
                          />
                        </label>
                      ) : (
                        <Field
                          name="name"
                          label="Nome do anexo"
                          minLength={2}
                          defaultValue={item.name}
                        />
                      )}
                    </ActionForm>
                    <ActionForm
                      label="Confirmar arquivamento"
                      action={async () => {
                        await api(`${endpoint}/${item.id}`, "DELETE");
                        reload();
                      }}
                    />
                  </details>
                )}
              </li>
            ))}
          </ul>
          <Pager
            result={result}
            change={(page) => setFilter((current) => ({ ...current, page }))}
          />
        </>
      )}
    </section>
  );
}

export function RecordDocuments({
  base,
  record,
  writable,
  close,
}: {
  base: string;
  record: RecordItem;
  writable: boolean;
  close: () => void;
}) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{record.name}</CardTitle>
          <button className={linkClass} onClick={close}>
            Fechar observações e anexos
          </button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {!demoEnabled && <DocumentList endpoint={`${base}/notes`} writable={writable} notes />}
          {!demoEnabled && (
            <DocumentList endpoint={`${base}/attachments`} writable={writable} notes={false} />
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
