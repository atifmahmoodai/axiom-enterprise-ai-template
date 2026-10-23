import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { PublicChrome } from "@/components/public-chrome";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Axiom Intelligence OS — Evidence in every decision.",
    template: "%s — Axiom",
  },
  description:
    "An AI analytics workspace with versioned data, reproducible analysis, evaluation benchmarks, and Power BI integration.",
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
          <PublicChrome>{children}</PublicChrome>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
