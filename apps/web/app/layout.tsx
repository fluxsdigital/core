import type { Metadata } from "next";

import { Shell } from "./workspace/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flux Core",
  description: "Painel de gestão de clientes, orçamentos e ordens de serviço.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-white focus:p-3"
        >
          Ir para o conteúdo
        </a>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
