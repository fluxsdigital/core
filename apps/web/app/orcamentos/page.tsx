import type { Metadata } from "next";
import { Suspense } from "react";
import { QuoteRoute } from "./quote-route";

export const metadata: Metadata = { title: "Orçamentos | Flux Core" };

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Carregando orçamentos…</p>}>
      <QuoteRoute />
    </Suspense>
  );
}
