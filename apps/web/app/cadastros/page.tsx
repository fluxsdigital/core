import type { Metadata } from "next";
import { Directory } from "./directory";

export const metadata: Metadata = { title: "Cadastros | Flux Core" };

export default function Page() {
  return <Directory />;
}
