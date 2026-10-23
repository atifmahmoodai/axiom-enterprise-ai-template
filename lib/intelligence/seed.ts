import { createHash } from "node:crypto";

export const SEED_VERSION = "axiom-saas/2026-09-v1";
export const SEED_WORKSPACES = ["atlas", "helix", "meridian"] as const;
export const REGIONS = ["North America", "Europe", "Asia Pacific"] as const;
export const PLANS = ["Launch", "Scale", "Enterprise"] as const;
export const SEED_FROM = "2023-10-01";
export const SEED_TO = "2026-09-30";
export type SeedFact = {
  id: string;
  workspace_id: string;
  occurred_at: string;
  customer_id: string;
  plan: string;
  region: string;
  event_type: "invoice" | "subscription" | "usage" | "infrastructure";
  amount_cents: number;
  cost_cents: number;
  mrr_cents: number;
  quantity: number;
  dataset_version: string;
  data: Record<string, unknown>;
};
type Aggregate = {
  revenueCents: number;
  costCents: number;
  tokens: number;
  rows: number;
};
export type SeedManifest = {
  version: string;
  hash: string;
  workspaceId: string;
  from: string;
  to: string;
  rows: number;
  monthly: Record<string, Aggregate & { mrrCents: number; customers: number }>;
  byRegion: Record<string, Aggregate>;
  byPlan: Record<string, Aggregate>;
  snapshots: Record<
    string,
    Record<string, { mrrCents: number; plan: string; region: string }>
  >;
  anomalies: { month: string; kind: string; description: string }[];
};
const empty = (): Aggregate => ({
  revenueCents: 0,
  costCents: 0,
  tokens: 0,
  rows: 0,
});
const date = (month: number, day: number) =>
  new Date(Date.UTC(2023, 9 + month, day)).toISOString().slice(0, 10);
export const seedMonth = (month: number) => date(month, 1).slice(0, 7);
export const seedMonthEnd = (month: number) =>
  new Date(Date.UTC(2023, 10 + month, 0)).toISOString().slice(0, 10);

/** Generates data and independently accumulates integer-cents reference values. No SQL/compiler/metric functions are used. */
export function generateSeed(workspaceId: string): {
  facts: SeedFact[];
  manifest: SeedManifest;
} {
  const org = SEED_WORKSPACES.indexOf(
    workspaceId as (typeof SEED_WORKSPACES)[number],
  );
  if (org < 0) throw new Error("Unknown reference workspace.");
  const facts: SeedFact[] = [];
  const manifest: SeedManifest = {
    version: SEED_VERSION,
    hash: "",
    workspaceId,
    from: SEED_FROM,
    to: SEED_TO,
    rows: 0,
    monthly: {},
    byRegion: {},
    byPlan: {},
    snapshots: {},
    anomalies: [
      {
        month: "2026-04",
        kind: "cost_spike",
        description:
          "A documented infrastructure incident increases monthly cost by 85%.",
      },
      {
        month: "2026-07",
        kind: "enterprise_contraction",
        description:
          "A seeded enterprise contraction reduces selected recurring contracts; this is fixture ground truth, not an inferred causal claim.",
      },
    ],
  };
  const add = (
    row: Omit<SeedFact, "id" | "workspace_id" | "dataset_version">,
  ) => {
    const fact: SeedFact = {
      ...row,
      id: `${workspaceId}-${facts.length.toString().padStart(7, "0")}`,
      workspace_id: workspaceId,
      dataset_version: SEED_VERSION,
    };
    facts.push(fact);
    const month = row.occurred_at.slice(0, 7);
    const monthly = (manifest.monthly[month] ??= {
      ...empty(),
      mrrCents: 0,
      customers: 0,
    });
    const region = (manifest.byRegion[row.region] ??= empty());
    const plan = (manifest.byPlan[row.plan] ??= empty());
    for (const aggregate of [monthly, region, plan]) {
      aggregate.rows++;
      if (row.event_type === "invoice")
        aggregate.revenueCents += row.amount_cents;
      if (row.event_type === "infrastructure")
        aggregate.costCents += row.cost_cents;
      if (row.event_type === "usage") aggregate.tokens += row.quantity;
    }
    if (row.event_type === "subscription") {
      monthly.mrrCents += row.mrr_cents;
      if (row.mrr_cents > 0) monthly.customers++;
      (manifest.snapshots[month] ??= {})[row.customer_id] = {
        mrrCents: row.mrr_cents,
        plan: row.plan,
        region: row.region,
      };
    }
  };
  for (let month = 0; month < 36; month++) {
    for (let customer = 0; customer < 160; customer++) {
      const customerId = `${workspaceId}-c${String(customer + 1).padStart(3, "0")}`;
      const plan = PLANS[(customer + org) % 3];
      const region = REGIONS[(Math.floor(customer / 3) + org) % 3];
      const joined = customer < 70 ? 0 : Math.floor((customer - 70) / 4) + 1;
      const churned =
        customer % 19 === 0 &&
        month >= Math.max(joined + 8, 18 + (customer % 10));
      const active = month >= joined && !churned;
      const base =
        [29000, 99000, 420000][(customer + org) % 3] + (customer % 9) * 1700;
      const expansion = month >= joined + 12 ? 1.12 : 1;
      const contraction =
        plan === "Enterprise" && month >= 33 && customer % 4 === 0 ? 0.72 : 1;
      const mrr = active
        ? Math.round(base * expansion * contraction * (1 + org * 0.08))
        : 0;
      const common = {
        customer_id: customerId,
        plan,
        region,
        amount_cents: 0,
        cost_cents: 0,
        mrr_cents: 0,
        quantity: 0,
        data: { currency: "USD", joinedMonth: seedMonth(joined) },
      };
      if (month >= joined)
        add({
          ...common,
          occurred_at: seedMonthEnd(month),
          event_type: "subscription",
          mrr_cents: mrr,
        });
      if (active) {
        const credit =
          customer % 23 === 0 && month % 6 === 0 ? Math.round(mrr * 0.15) : 0;
        add({
          ...common,
          occurred_at: date(month, 3 + (customer % 12)),
          event_type: "invoice",
          amount_cents: mrr - credit,
          data: { ...common.data, taxExcluded: true, creditCents: credit },
        });
        const cost = Math.round(
          mrr * (0.18 + (customer % 7) * 0.012) * (month === 30 ? 1.85 : 1),
        );
        add({
          ...common,
          occurred_at: seedMonthEnd(month),
          event_type: "infrastructure",
          cost_cents: cost,
        });
      }
      // Twelve daily usage partitions per customer and month keep the dataset comfortably above 200k rows.
      for (let part = 0; part < 12; part++) {
        const quantity = active
          ? Math.round(
              (1600 + customer * 31 + part * 127) *
                (1 + month * 0.018) *
                (1 + org * 0.05),
            )
          : 0;
        add({
          ...common,
          occurred_at: date(month, 1 + part * 2),
          event_type: "usage",
          quantity,
        });
      }
    }
    add({
      occurred_at: seedMonthEnd(month),
      customer_id: "unallocated",
      plan: "Unallocated",
      region: "Unallocated",
      event_type: "infrastructure",
      amount_cents: 0,
      cost_cents: 42000 + org * 3000 + month * 550,
      mrr_cents: 0,
      quantity: 0,
      data: { currency: "USD", allocation: "unallocated" },
    });
  }
  manifest.rows = facts.length;
  manifest.hash = createHash("sha256")
    .update(JSON.stringify(facts))
    .digest("hex");
  return { facts, manifest };
}

export function referenceTotals(
  manifest: SeedManifest,
  from: string,
  to: string,
  region?: string,
  plan?: string,
) {
  // This exact reference path intentionally iterates seed rows, independent of production SQL and metric implementations.
  const { facts } = generateSeed(manifest.workspaceId);
  return facts
    .filter(
      (f) =>
        f.occurred_at >= from &&
        f.occurred_at <= to &&
        (!region || f.region === region) &&
        (!plan || f.plan === plan),
    )
    .reduce((a, f) => {
      a.rows++;
      if (f.event_type === "invoice") a.revenueCents += f.amount_cents;
      if (f.event_type === "infrastructure") a.costCents += f.cost_cents;
      if (f.event_type === "usage") a.tokens += f.quantity;
      return a;
    }, empty());
}
