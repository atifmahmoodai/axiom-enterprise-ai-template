import { createHash } from "node:crypto";
import { z } from "zod";
import { PLANS, REGIONS, type SeedFact } from "./seed";

export const MAX_FACT_IMPORT_BYTES = 50 * 1024 * 1024;
export const MAX_FACT_IMPORT_ROWS = 250_000;
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Use an actual ISO calendar date.",
  );
const integer = z.number().int().safe();
const fact = z
  .object({
    record_id: z.string().min(1).max(180),
    occurred_at: isoDate,
    customer_id: z.string().min(1).max(180),
    plan: z.enum([...PLANS, "Unallocated"]),
    region: z.enum([...REGIONS, "Unallocated"]),
    event_type: z.enum(["invoice", "subscription", "usage", "infrastructure"]),
    amount_cents: integer.default(0),
    cost_cents: integer.nonnegative().default(0),
    mrr_cents: integer.nonnegative().default(0),
    quantity: integer.nonnegative().default(0),
  })
  .strict()
  .superRefine((r, ctx) => {
    for (const [field, type] of [
      ["amount_cents", "invoice"],
      ["cost_cents", "infrastructure"],
      ["mrr_cents", "subscription"],
      ["quantity", "usage"],
    ] as const) {
      if (r.event_type !== type && r[field] !== 0)
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${field} must be zero on ${r.event_type} records.`,
        });
    }
    if (r.event_type === "subscription") {
      const next = new Date(Date.parse(r.occurred_at) + 86400000);
      if (next.getUTCDate() !== 1)
        ctx.addIssue({
          code: "custom",
          path: ["occurred_at"],
          message: "Subscription records must be month-end snapshots.",
        });
    }
  });
const snapshotSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    currency: z.literal("USD"),
    timezone: z.literal("UTC"),
    usage_unit: z.literal("tokens"),
    refreshed_at: z.iso.datetime({ offset: false }),
    refresh_interval_hours: integer.min(1).max(2160),
    coverage_from: isoDate,
    coverage_to: isoDate,
    facts: z.array(fact).min(1).max(MAX_FACT_IMPORT_ROWS),
  })
  .strict();
export type CanonicalSnapshot = z.infer<typeof snapshotSchema>;
export function parseFactSnapshot(input: string | unknown): CanonicalSnapshot {
  if (
    typeof input === "string" &&
    Buffer.byteLength(input) > MAX_FACT_IMPORT_BYTES
  )
    throw new Error("Fact import exceeds 50 MiB.");
  const snapshot = snapshotSchema.parse(
    typeof input === "string" ? JSON.parse(input) : input,
  );
  if (
    snapshot.coverage_from > snapshot.coverage_to ||
    Date.parse(snapshot.coverage_to) - Date.parse(snapshot.coverage_from) >
      366 * 10 * 86400000
  )
    throw new Error(
      "Coverage must be ordered and span no more than ten years.",
    );
  if (Date.parse(snapshot.refreshed_at) > Date.now() + 5 * 60000)
    throw new Error("Source freshness cannot be in the future.");
  const identifiers = new Set<string>(),
    snapshots = new Set<string>();
  const totals = { amount_cents: 0, cost_cents: 0, mrr_cents: 0, quantity: 0 };
  for (const row of snapshot.facts) {
    if (
      row.occurred_at < snapshot.coverage_from ||
      row.occurred_at > snapshot.coverage_to
    )
      throw new Error("A fact falls outside declared source coverage.");
    if (identifiers.has(row.record_id))
      throw new Error(
        "Duplicate source record_id; review deduplication before publication.",
      );
    identifiers.add(row.record_id);
    if (row.event_type === "subscription") {
      const key = JSON.stringify([
        row.customer_id,
        row.occurred_at.slice(0, 7),
      ]);
      if (snapshots.has(key))
        throw new Error(
          "Only one month-end subscription snapshot per customer is allowed.",
        );
      snapshots.add(key);
    }
    for (const field of Object.keys(totals) as (keyof typeof totals)[]) {
      totals[field] += Math.abs(row[field]);
      if (!Number.isSafeInteger(totals[field]))
        throw new Error(
          "Aggregate values exceed the exact integer calculation budget.",
        );
    }
  }
  return snapshot;
}
export function normalizeFactSnapshot(
  workspaceId: string,
  snapshot: CanonicalSnapshot,
) {
  // Stable source record order makes retries idempotent even if transport order changes.
  const sorted = [...snapshot.facts].sort((a, b) =>
    a.record_id < b.record_id ? -1 : a.record_id > b.record_id ? 1 : 0,
  );
  const hash = createHash("sha256")
    .update(JSON.stringify({ ...snapshot, facts: sorted }))
    .digest("hex");
  const version = `operational/${hash}`;
  const facts: SeedFact[] = sorted.map(({ record_id, ...row }, index) => ({
    ...row,
    id: `${workspaceId}:${hash}:${index}`,
    workspace_id: workspaceId,
    dataset_version: version,
    data: { source_record_id: record_id },
  }));
  return { hash, version, facts };
}
