"use client";

import { Box, ClipboardList, FileText, LayoutDashboard, UserRound, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { demoChangeEvent, demoCompany, demoEnabled } from "../conta/demo-api";
import type { Settings } from "./workspace";

const navigation = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/cadastros", module: "directoryEnabled", label: "Cadastros", icon: Box },
  { href: "/orcamentos", module: "quotesEnabled", label: "Orçamentos", icon: FileText },
  { href: "/ordens", module: "ordersEnabled", label: "Ordens de serviço", icon: ClipboardList },
  { href: "/conta", label: "Conta", icon: UserRound },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const [settings, setSettings] = useState<Settings>();
  useEffect(() => {
    if (!demoEnabled) return;
    const sync = () => setSettings(demoCompany().settings);
    sync();
    window.addEventListener(demoChangeEvent, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(demoChangeEvent, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const brandName = settings?.displayName ?? "Flux Core";
  const current = navigation.find((item) => item.href === pathname)?.label ?? "Conta";

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/" className="app-brand">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="company-logo" />
          ) : (
            <span className="brand-mark">
              <Zap size={21} fill="currentColor" aria-hidden="true" />
            </span>
          )}
          {brandName === "Flux Core" || brandName === "Flux Demonstração" ? (
            <span>
              Flux<span className="brand-core"> Core</span>
            </span>
          ) : (
            <span className="company-wordmark">{brandName}</span>
          )}
        </Link>
        <nav aria-label="Menu principal" className="app-nav">
          {navigation
            .filter((item) => !("module" in item) || settings?.[item.module] !== false)
            .map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
                <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                {label}
              </Link>
            ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="app-topbar">
          <div className="topbar-path">
            <span className="min-w-0 break-words">{brandName}</span>
            <span aria-hidden="true">/</span>
            <strong>{current}</strong>
          </div>
          {demoEnabled && <span className="demo-tag">Modo demonstração</span>}
        </header>
        <main id="conteudo" className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}
