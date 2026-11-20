"use client";

import { useSearchParams } from "next/navigation";

import { Orders } from "./orders";

export function OrderRoute() {
  const query = useSearchParams();
  const ids = query.getAll("ordem");
  const id = ids.length === 1 && /^[0-9a-f-]{36}$/.test(ids[0]) ? ids[0] : undefined;
  return (
    <Orders
      key={query.toString()}
      initialId={id}
      scope={query.get("scope")}
      period={query.toString()}
    />
  );
}
