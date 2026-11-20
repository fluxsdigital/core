"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { api, ApiError } from "../conta/api";

export type Settings = {
  displayName: string | null;
  logoUrl?: string | null;
  accentColor: string;
  directoryEnabled: boolean;
  quotesEnabled: boolean;
  ordersEnabled: boolean;
};

type ModuleKey = "directoryEnabled" | "quotesEnabled" | "ordersEnabled";

export type Company = {
  id: string;
  name: string;
  settings: Settings;
  role: "OWNER" | "ADMIN" | "MANAGER" | "OPERATOR";
};

export function Workspace({
  title,
  children,
  module,
  heading,
}: {
  title: string;
  children: (company: Company, update: (settings: Settings) => void) => ReactNode;
  module?: ModuleKey;
  heading?: (company: Company | undefined) => ReactNode;
}) {
  const [orgs, setOrgs] = useState<Company[]>();
  const [id, setId] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    api<Company[]>("organizations")
      .then((companies) => {
        if (!active) return;
        setId(localStorage.getItem("flux-active-company") ?? "");
        setOrgs(companies);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setError(
          error instanceof ApiError && error.status === 401
            ? "Entre na sua conta para continuar."
            : "Não foi possível carregar as empresas.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  const company = orgs?.find((item) => item.id === id) ?? orgs?.[0];

  function update(settings: Settings) {
    setOrgs((items) =>
      items?.map((item) => (item.id === company?.id ? { ...item, settings } : item)),
    );
  }

  return (
    <>
      {heading?.(company) ?? (
        <h1 className="mb-5 text-3xl font-semibold tracking-tight">{title}</h1>
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <Link href="/conta" className="text-sky-800 underline">
            Ir para Conta
          </Link>
        </p>
      )}
      {!orgs && !error && <p role="status">Carregando…</p>}
      {orgs && !company && (
        <p>
          <Link href="/conta" className="text-sky-800 underline">
            Cadastre uma empresa
          </Link>{" "}
          para começar.
        </p>
      )}
      {company && (
        <>
          <label
            className={
              heading
                ? "my-5 grid max-w-sm gap-1 text-sm font-medium"
                : "mb-6 grid max-w-sm gap-1 text-sm font-medium"
            }
          >
            Empresa
            <select
              value={company.id}
              className={inputClass}
              onChange={(event) => {
                setId(event.target.value);
                localStorage.setItem("flux-active-company", event.target.value);
              }}
            >
              {orgs?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.settings.displayName ?? item.name}
                </option>
              ))}
            </select>
          </label>
          <div
            style={
              {
                "--workspace-accent": company.settings.accentColor,
                "--workspace-accent-text": colorText(company.settings.accentColor),
              } as CSSProperties
            }
          >
            {module && !company.settings[module] ? (
              <p role="status">Este módulo está desabilitado para a empresa selecionada.</p>
            ) : (
              children(company, update)
            )}
          </div>
        </>
      )}
    </>
  );
}

function colorText(hex: string) {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((value) => {
    const sRGB = parseInt(value, 16) / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance >= 0.179 ? "#000000" : "#ffffff";
}

export const inputClass = "min-w-0 rounded-md border border-border bg-white px-3 py-2";
export const linkClass = "w-fit text-sm font-medium text-sky-800 underline";
export type PageResult<T> = { items: T[]; page: number; size: number; total: number };

export function Pager({
  result,
  change,
}: {
  result: PageResult<unknown>;
  change: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(result.total / result.size));
  if (pages === 1 && result.page === 1) return null;
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center gap-3 text-sm">
      <button
        className="rounded-md border border-border px-3 py-1 disabled:opacity-50"
        disabled={result.page <= 1}
        onClick={() => change(result.page - 1)}
      >
        Anterior
      </button>
      <p>
        Página {result.page} de {pages}
      </p>
      <button
        className="rounded-md border border-border px-3 py-1 disabled:opacity-50"
        disabled={result.page >= pages}
        onClick={() => change(result.page + 1)}
      >
        Próxima
      </button>
    </nav>
  );
}

export function demoPeriod(search: string) {
  const params = new URLSearchParams(search);
  const period = new URLSearchParams();
  for (const key of ["from", "to"]) {
    const date = params.get(key);
    if (date && Number.isFinite(Date.parse(date))) period.set(key, new Date(date).toISOString());
  }
  return period;
}
