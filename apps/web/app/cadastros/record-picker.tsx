"use client";

import { useEffect, useState } from "react";
import { api } from "../conta/api";
import { inputClass, type PageResult } from "../workspace/workspace";
import { directoryPath, type Kind, type RecordItem } from "./directory-types";

export function RecordPicker({
  companyId,
  kind,
  label,
  name,
  required,
  initial,
}: {
  companyId: string;
  kind: Kind;
  label: string;
  name: string;
  required?: boolean;
  initial?: string | null;
}) {
  const [q, setQ] = useState("");
  const [value, setValue] = useState(initial ?? "");
  const [result, setResult] = useState<PageResult<RecordItem>>();
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<{ id: string; name: string }>();
  const missing = value && !result?.items.some((item) => item.id === value);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api<PageResult<RecordItem>>(
        `${directoryPath(companyId, kind)}?size=30&q=${encodeURIComponent(q)}`,
      )
        .then((response) => {
          if (!active) return;
          setResult(response);
          setFailed(false);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [companyId, kind, q]);

  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm font-medium">
        Buscar {label.toLowerCase()}
        <input
          className={inputClass}
          value={q}
          maxLength={100}
          onChange={(event) => setQ(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {label}
        <select
          className={inputClass}
          value={value}
          name={name}
          aria-label={label}
          required={required}
          onChange={(event) => {
            setValue(event.target.value);
            setSelected(result?.items.find((item) => item.id === event.target.value));
          }}
        >
          <option value="">Selecione</option>
          {missing && <option value={value}>{selected?.name ?? "Vínculo atual"}</option>}
          {result?.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {failed && (
        <p role="alert" className="text-sm text-red-700">
          Não foi possível buscar registros.
        </p>
      )}
      {result && result.total > result.size && (
        <p className="text-sm text-muted-foreground">
          Refine a busca para encontrar mais registros.
        </p>
      )}
    </div>
  );
}
