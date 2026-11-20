"use client";

import { useSearchParams } from "next/navigation";
import { Quotes } from "./quotes";

export function QuoteRoute() {
  const query = useSearchParams();
  return (
    <Quotes key={query.toString()} initialStatus={query.get("status")} period={query.toString()} />
  );
}
