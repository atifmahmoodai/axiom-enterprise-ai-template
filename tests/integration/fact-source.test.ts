import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  getFactSource,
  provisionFactSnapshot,
} from "../../lib/server/fact-source";
import { getOverview, runQuery } from "../../lib/server/analytics";
import { executeAnalyst } from "../../lib/server/analyst";
import { getDataset, listDatasets } from "../../lib/server/datasets";
import {
  AppError,
  getPool,
  putResource,
  deleteResource,
  withWorkspace,
} from "../../lib/server/db";
import type { WorkspaceContext } from "../../lib/intelligence/contracts";
const workspace = `source-${randomUUID()}`;
const owner: WorkspaceContext = {
  userId: "demo-owner",
  workspaceId: workspace,
  role: "owner",
};
const admin = new Pool({
  connectionString: process.env.DATABASE_ADMIN_URL,
  max: 1,
});
const originalMode = process.env.AXIOM_MODE;
const fixture = () => ({
  name: "Connected verification snapshot",
  currency: "USD",
  timezone: "UTC",
  usage_unit: "tokens",
  refreshed_at: new Date().toISOString(),
  refresh_interval_hours: 24,
  coverage_from: "2025-01-01",
  coverage_to: "2025-02-28",
  facts: [
    {
      record_id: "jan-invoice",
      occurred_at: "2025-01-20",
      customer_id: "c1",
      plan: "Enterprise",
      region: "Europe",
      event_type: "invoice",
      amount_cents: 10000,
    },
    {
      record_id: "feb-invoice",
      occurred_at: "2025-02-20",
      customer_id: "c1",
      plan: "Enterprise",
      region: "Europe",
      event_type: "invoice",
      amount_cents: 20000,
    },
    {
      record_id: "jan-cost",
      occurred_at: "2025-01-31",
      customer_id: "c1",
      plan: "Enterprise",
      region: "Europe",
      event_type: "infrastructure",
      cost_cents: 2500,
    },
    {
      record_id: "feb-cost",
      occurred_at: "2025-02-28",
      customer_id: "c1",
      plan: "Enterprise",
      region: "Europe",
      event_type: "infrastructure",
      cost_cents: 5000,
    },
    {
      record_id: "jan-snapshot",
      occurred_at: "2025-01-31",
      customer_id: "c1",
      plan: "Enterprise",
      region: "Europe",
      event_type: "subscription",
      mrr_cents: 5000,
    },
    {
      record_id: "feb-snapshot",
      occurred_at: "2025-02-28",
      customer_id: "c1",
      plan: "Enterprise",
      region: "Europe",
      event_type: "subscription",
      mrr_cents: 0,
    },
    {
      record_id: "jan-usage",
      occurred_at: "2025-01-10",
      customer_id: "c1",
      plan: "Enterprise",
      region: "Europe",
      event_type: "usage",
      quantity: 50,
    },
  ],
});
test.before(async () => {
  process.env.AXIOM_MODE = "connected";
  await admin.query(
    "INSERT INTO workspaces(id,name) VALUES($1,'Temporary source verification')",
    [workspace],
  );
  await admin.query(
    "INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,'demo-owner','owner'),($1,'demo-analyst','viewer')",
    [workspace],
  );
});
test("connected source fails closed before provisioning and forbids runtime activation", async () => {
  await assert.rejects(
    () => getFactSource(owner),
    (e: unknown) =>
      e instanceof AppError && e.code === "operational_dataset_unconfigured",
  );
  await assert.rejects(() =>
    putResource(owner, "operational-source", "active", { version: "forged" }),
  );
  await assert.rejects(
    () => provisionFactSnapshot(admin, workspace, "demo-analyst", fixture()),
    /administrator or owner/,
  );
  await assert.rejects(
    () => getFactSource({ ...owner, userId: "demo-helix" }),
    (e: unknown) => e instanceof AppError && e.status === 403,
  );
});
test("canonical publication drives real metrics and retains immutable historical versions", async () => {
  const input = fixture();
  const first = await provisionFactSnapshot(
    admin,
    workspace,
    owner.userId,
    input,
  );
  const retry = await provisionFactSnapshot(
    admin,
    workspace,
    owner.userId,
    input,
  );
  assert.equal(first.version, retry.version);
  const overview = await getOverview(owner, { from: undefined, to: undefined });
  assert.equal(overview.rowCount, 7);
  assert.equal(overview.metrics.find((m) => m.id === "revenue")?.value, 300);
  assert.equal(overview.metrics.find((m) => m.id === "cost")?.value, 75);
  assert.equal(overview.metrics.find((m) => m.id === "margin")?.value, 75);
  assert.equal(overview.metrics.find((m) => m.id === "retention")?.value, 0);
  assert.equal(overview.provenance.datasetVersion, first.version);
  assert.ok(overview.provenance.sources.some((s) => s.includes(input.name)));
  const active = (await listDatasets(owner)).find((d) => d.id === "reference")!;
  assert.equal(active.source, "connected");
  assert.equal((await getDataset(owner, "reference")).rows, 7);
  const secondInput = {
    ...input,
    name: "Second snapshot",
    facts: input.facts.map((r) =>
      r.record_id === "feb-invoice" ? { ...r, amount_cents: 40000 } : r,
    ),
  };
  const second = await provisionFactSnapshot(
    admin,
    workspace,
    owner.userId,
    secondInput,
  );
  assert.notEqual(first.version, second.version);
  assert.equal(
    (await runQuery(owner, { metric: "revenue" })).rows[0].value,
    500,
  );
  const pinned = await getFactSource(owner, first.version);
  const followUp = await executeAnalyst(
    owner,
    { question: "Show total billed revenue", datasetVersion: first.version },
    { provider: "demo", persist: false },
  );
  assert.equal(followUp.result?.rows[0].value, 300);
  assert.equal(followUp.result?.provenance.datasetVersion, first.version);
  assert.equal(
    (await runQuery(owner, { metric: "revenue" }, pinned)).rows[0].value,
    300,
  );
  assert.equal((await getOverview(owner)).rowCount, 7);
  await assert.rejects(() =>
    deleteResource(owner, "operational-snapshot", first.version),
  );
  await assert.rejects(() =>
    withWorkspace(owner, (db) =>
      db.query("INSERT INTO fact_events SELECT * FROM fact_events LIMIT 1"),
    ),
  );
  await assert.rejects(
    () => getFactSource({ ...owner, workspaceId: "helix" }, first.version),
    (e: unknown) =>
      e instanceof AppError && e.code === "operational_dataset_unavailable",
  );
});
test("source staleness is explicit and runtime calculations preserve the pinned source", async () => {
  const stale = await provisionFactSnapshot(admin, workspace, owner.userId, {
    ...fixture(),
    name: "Stale snapshot",
    refreshed_at: "2025-03-01T00:00:00Z",
  });
  assert.equal(stale.stale, true);
  const result = await runQuery(owner, { metric: "revenue" });
  assert.equal(result.state, "stale");
  assert.equal(result.rows[0].value, 300);
  assert.ok(
    result.provenance.warnings.some((w) => w.includes("freshness exceeds")),
  );
  assert.equal(
    (await listDatasets(owner)).find((d) => d.id === "reference")?.state,
    "stale",
  );
});
test.after(async () => {
  if (originalMode === undefined) delete process.env.AXIOM_MODE;
  else process.env.AXIOM_MODE = originalMode;
  for (const table of [
    "fact_events",
    "resources",
    "audit_events",
    "memberships",
  ])
    await admin.query(`DELETE FROM ${table} WHERE workspace_id=$1`, [
      workspace,
    ]);
  await admin.query("DELETE FROM workspaces WHERE id=$1", [workspace]);
  await admin.end();
  await getPool().end();
});
