"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Menu, X, ChevronDown, ShieldCheck } from "lucide-react";
import { BrandMark } from "./brand";
import { CommandPalette } from "./command-palette";
import { siteConfig, tenants, type TenantId } from "@/lib/config";
import { useWorkspace } from "./workspace-provider";
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { tenantId, setTenantId } = useWorkspace();
  const operational = ["/observability", "/developers", "/workflows"].some(
    (x) => pathname.startsWith(x),
  );
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="Axiom home">
            <BrandMark />
            <span>
              axiom<span className="brand-dot">.</span>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {siteConfig.navigation.map((item) => (
              <Link
                href={item.href}
                key={item.href}
                aria-current={
                  pathname === item.href || pathname + "/" === item.href
                    ? "page"
                    : undefined
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <CommandPalette />
          <Link href="/observability/" className="header-cta">
            Open console <ArrowUpRight size={14} />
          </Link>
          <button
            className="menu-toggle"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav
            id="mobile-nav"
            className="mobile-nav"
            aria-label="Mobile navigation"
          >
            {siteConfig.navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </nav>
        )}
      </header>
      {operational && (
        <div className="workspace-bar">
          <div className="page-container workspace-inner">
            <div>
              <span className="workspace-avatar">A</span>
              <label className="sr-only" htmlFor="workspace">
                Workspace
              </label>
              <select
                id="workspace"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value as TenantId)}
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
            <span className="demo-badge">
              <span className="status-dot" /> Interactive demo
            </span>
          </div>
        </div>
      )}
    </>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer page-container">
      <div className="footer-top">
        <Link href="/" className="brand">
          <BrandMark size={24} />
          <span>axiom.</span>
        </Link>
        <p>Infrastructure for what comes next.</p>
        <div className="footer-status">
          <span className="status-dot" /> Demo systems operational
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Axiom. Enterprise AI template.</span>
        <div>
          <Link href="/docs/">
            Documentation <ArrowUpRight size={12} />
          </Link>
          <Link href="/docs/#production">
            <ShieldCheck size={13} /> Deployment guide
          </Link>
          <span>Designed for possibility.</span>
        </div>
      </div>
    </footer>
  );
}
