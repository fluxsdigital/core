"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@flux/ui/card";

import { api } from "../conta/api";
import { ActionForm, Field } from "../conta/forms";

export default function Page() {
  const [updated, setUpdated] = useState(false);
  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Redefinir senha</h1>
      <Card className="max-w-lg">
        <CardHeader>
          {updated ? (
            <p role="status">
              Senha redefinida.{" "}
              <Link href="/conta" className="text-sky-800 underline">
                Entre novamente.
              </Link>
            </p>
          ) : (
            <ActionForm
              label="Redefinir senha"
              action={async (data) => {
                const token = window.location.hash.slice(1);
                await api("auth/reset-password", "POST", { ...data, token }, false);
                history.replaceState(null, "", window.location.pathname);
                setUpdated(true);
              }}
            >
              <Field
                name="password"
                label="Nova senha"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </ActionForm>
          )}
        </CardHeader>
      </Card>
    </>
  );
}
