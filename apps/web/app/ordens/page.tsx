import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderRoute } from "./order-route";

export const metadata: Metadata = { title: "Ordens de serviço | Flux Core" };

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Carregando ordens de serviço…</p>}>
      <OrderRoute />
    </Suspense>
  );
}
