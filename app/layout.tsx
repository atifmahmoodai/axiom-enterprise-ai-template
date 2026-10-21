import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Axiom — Intelligence, under control.",
    template: "%s — Axiom",
  },
  description:
    "A premium enterprise AI operations template. Orchestrate agent networks, observe model performance, and build with confidence.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/inter-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <WorkspaceProvider>
          <SiteHeader />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </WorkspaceProvider>
      </body>
    </html>
  );
}
