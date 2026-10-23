"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "./site-shell";
export function PublicChrome({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/app") || path === "/login")
    return (
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    );
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
