"use client";

import { useState, type FormEvent, type ReactNode } from "react";

export function Field({
  name,
  label,
  type = "text",
  minLength,
  maxLength = 150,
  autoComplete,
  required = true,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string | number;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        minLength={minLength}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className="min-w-0 rounded-md border border-border bg-white px-3 py-2"
      />
    </label>
  );
}

export function ActionForm({
  children,
  action,
  label,
  done,
  className,
}: {
  children?: ReactNode;
  action: (data: Record<string, string>, raw: FormData) => Promise<unknown>;
  label: string;
  done?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string }>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = new FormData(form);
    const data = Object.fromEntries(Array.from(raw, ([key, value]) => [key, String(value)]));
    setBusy(true);
    setFeedback(undefined);
    try {
      await action(data, raw);
      form.reset();
      if (done) setFeedback({ error: false, message: done });
    } catch (error) {
      setFeedback({
        error: true,
        message: error instanceof Error ? error.message : "Operação indisponível.",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className={className}>
      <fieldset disabled={busy} className="grid min-w-0 gap-3">
        {children}
        <button
          type="submit"
          className="w-fit rounded-md bg-[var(--workspace-accent,#174877)] px-4 py-2 text-sm font-medium text-[var(--workspace-accent-text,#fff)] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Aguarde…" : label}
        </button>
      </fieldset>
      {feedback && (
        <p
          className={feedback.error ? "mt-2 text-sm text-red-700" : "mt-2 text-sm text-emerald-800"}
          role={feedback.error ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
    </form>
  );
}
