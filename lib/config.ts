export const siteConfig = {
  name: "Axiom",
  description: "The control plane for intelligent systems.",
  demoMode: true,
  navigation: [
    { href: "/", label: "Platform" },
    { href: "/observability/", label: "Observability" },
    { href: "/workflows/", label: "Workflows" },
    { href: "/developers/", label: "Developers" },
    { href: "/pricing/", label: "Pricing" },
  ],
} as const;
export type TenantId = "atlas" | "helix";
export const tenants: { id: TenantId; name: string; region: string }[] = [
  { id: "atlas", name: "Atlas workspace", region: "US East" },
  { id: "helix", name: "Helix workspace", region: "EU West" },
];
