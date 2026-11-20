import type { Metadata } from "next";
import { Account } from "./account";

export const metadata: Metadata = { title: "Conta | Flux Core" };

export default function Page() {
  return <Account />;
}
