import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { generateSeed } from "../../lib/intelligence/seed";
import { independentValue, runEvaluation } from "../../lib/server/evaluations";
import { runQuery, getOverview, getLineage } from "../../lib/server/analytics";
import {
  AppError,
  getPool,
  withWorkspace,
  putResource,
  getResource,
  deleteResource,
} from "../../lib/server/db";
import { assertSameOrigin, demoLogin, getSession } from "../../lib/server/auth";
import {
  ingestFile,
  getDataset,
  transformDataset,
  queryDataset,
} from "../../lib/server/datasets";
import { getJob, cancelJob } from "../../lib/server/jobs";
import type { WorkspaceContext } from "../../lib/intelligence/contracts";
const owner: WorkspaceContext = {
    userId: "demo-owner",
    workspaceId: "atlas",
    role: "owner",
  },
  analyst: WorkspaceContext = {
    userId: "demo-analyst",
    workspaceId: "atlas",
    role: "analyst",
  },
  viewer: WorkspaceContext = {
    userId: "demo-viewer",
    workspaceId: "atlas",
    role: "viewer",
  };
test("database role is nonowner, RLS is forced, pooled tenant settings reset", async () => {
  const { getPool } = await import("../../lib/server/db");
  const role = await getPool().query(
    "SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
  );
  assert.equal(role.rows[0].current_user, "axiom_app");
  assert.equal(role.rows[0].rolsuper, false);
  assert.equal(role.rows[0].rolbypassrls, false);
  for (let i = 0; i < 6; i++) {
    const c = { ...owner, workspaceId: i % 2 ? "helix" : "atlas" };
    await withWorkspace(
      c,
      async (db) => {
        const r = await db.query(
          "SELECT DISTINCT workspace_id FROM fact_events",
        );
        assert.deepEqual(
          r.rows.map((x) => x.workspace_id),
          [c.workspaceId],
        );
      },
      true,
    );
  }
  const unscoped = await getPool().query("SELECT count(*) FROM fact_events");
  assert.equal(Number(unscoped.rows[0].count), 0);
});
test("forged role hints and cross-tenant resource IDs cannot grant access", async () => {
  await assert.rejects(
    () =>
      runQuery(
        { ...analyst, workspaceId: "helix", role: "owner" },
        { metric: "revenue" },
      ),
    (e: unknown) => e instanceof AppError && e.status === 403,
  );
  const id = randomUUID();
  await putResource(owner, "view", id, { name: "Private workspace view" });
  assert.equal(
    await getResource({ ...owner, workspaceId: "helix" }, "view", id),
    null,
  );
  await assert.rejects(() =>
    putResource({ ...viewer, role: "owner" }, "view", randomUUID(), {
      name: "forged owner",
    }),
  );
  await assert.rejects(() => deleteResource(viewer, "view", id));
  assert.ok(await getResource(owner, "view", id));
});
test("session creation uses origin validation, hashed persistent tokens and server memberships", async () => {
  assert.throws(() =>
    assertSameOrigin(
      new Request("http://localhost:3000", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    ),
  );
  const response = await demoLogin(
    new Request("http://localhost:3000/api/auth/demo", {
      method: "POST",
      headers: {
        origin: process.env.APP_URL || "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: "demo-analyst" }),
    }),
  );
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const session = await getSession(
    new Request("http://localhost:3000", { headers: { cookie } }),
  );
  assert.deepEqual(
    session?.workspaces.map((w) => w.id),
    ["atlas"],
  );
  assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
});
test("metrics match independent integer-cent ground truth and empty data remains null", async () => {
  const { facts } = generateSeed("atlas");
  for (const metric of [
    "revenue",
    "cost",
    "mrr",
    "retention",
    "nrr",
    "grr",
    "margin",
    "customers",
    "usage",
  ]) {
    const filters = { from: "2026-01-01", to: "2026-09-30" };
    const result = await runQuery(owner, { metric, filters });
    const expected = independentValue(facts, metric, filters);
    assert.ok(
      expected === null
        ? result.rows[0].value === null
        : Math.abs(Number(result.rows[0].value) - expected) < 0.001,
      metric,
    );
  }
  assert.equal(
    (
      await runQuery(owner, {
        metric: "revenue",
        filters: { from: "2035-01-01", to: "2035-12-31" },
      })
    ).rows[0].value,
    null,
  );
});
test("source coverage is disclosed while observed zero remains distinct from missing data", async () => {
  const covered = await runQuery(owner, {
    metric: "revenue",
    filters: { from: "2023-10-01", to: "2026-09-30" },
  });
  const beyondCoverage = await runQuery(owner, {
    metric: "revenue",
    filters: { from: "2023-01-01", to: "2027-01-31" },
  });
  assert.equal(covered.state, "ready");
  assert.equal(beyondCoverage.state, "partial");
  assert.equal(beyondCoverage.rows[0].value, covered.rows[0].value);
  assert.ok(
    beyondCoverage.provenance.warnings.some((warning) =>
      warning.includes("absent periods are not zeros"),
    ),
  );
  const zero = await runQuery(owner, {
    metric: "revenue",
    filters: { from: "2026-01-01", to: "2026-09-30", region: "Unallocated" },
  });
  assert.equal(zero.rows[0].value, 0);
  assert.equal(zero.state, "ready");
  const missing = await runQuery(owner, {
    metric: "revenue",
    filters: { from: "2030-01-01", to: "2030-12-31" },
  });
  assert.equal(missing.rows[0].value, null);
  assert.equal(missing.state, "unavailable");
});
test("bounded grouped results explain possible omissions without marking scalar aggregates partial", async () => {
  const limited = await runQuery(owner, {
    metric: "revenue",
    groupBy: "month",
    limit: 2,
  });
  assert.equal(limited.rows.length, 2);
  assert.equal(limited.state, "partial");
  assert.ok(
    limited.provenance.warnings.some((warning) =>
      warning.includes("Additional groups may be omitted"),
    ),
  );
  const scalar = await runQuery(owner, { metric: "revenue", limit: 1 });
  assert.equal(scalar.rows.length, 1);
  assert.equal(scalar.state, "ready");
  const snapshot = await runQuery(owner, {
    metric: "mrr",
    groupBy: "region",
    limit: 10,
  });
  assert.equal(snapshot.state, "ready");
});
test("lineage resolves reference analyses, transformations and unavailable dependencies to graph nodes", async () => {
  const datasetId = randomUUID();
  const missingParentId = randomUUID();
  const analysisId = randomUUID();
  const referenceAnalysisId = randomUUID();
  try {
    await putResource(owner, "dataset", datasetId, {
      name: "Lineage integration fixture",
      version: "lineage-fixture-v2",
      parentDatasetId: missingParentId,
      parentVersion: "lineage-fixture-v1",
    });
    await putResource(owner, "analysis", analysisId, {
      name: "Uploaded fixture analysis",
      datasetId,
      result: { provenance: { datasetVersion: "lineage-fixture-v2" } },
    });
    await putResource(owner, "analysis", referenceAnalysisId, {
      name: "Reference fixture analysis",
      datasetId: "reference",
    });
    const lineage = await getLineage(owner);
    const ids = new Set(lineage.nodes.map((node) => node.id));
    for (const edge of lineage.edges) {
      assert.ok(ids.has(edge.from), `Missing source node: ${edge.from}`);
      assert.ok(ids.has(edge.to), `Missing destination node: ${edge.to}`);
    }
    assert.ok(
      lineage.edges.some(
        (edge) => edge.from === "source" && edge.to === referenceAnalysisId,
      ),
    );
    assert.ok(
      lineage.edges.some(
        (edge) => edge.from === datasetId && edge.to === analysisId,
      ),
    );
    assert.ok(
      lineage.edges.some(
        (edge) =>
          edge.from === missingParentId && edge.to === `transform-${datasetId}`,
      ),
    );
    assert.equal(
      lineage.nodes.find((node) => node.id === missingParentId)?.kind,
      "unavailable",
    );
  } finally {
    await deleteResource(owner, "analysis", analysisId);
    await deleteResource(owner, "analysis", referenceAnalysisId);
    await deleteResource(owner, "dataset", datasetId);
  }
});
async function waitJob(id: string) {
  for (let i = 0; i < 80; i++) {
    const job = await getJob(analyst, id);
    if (job.status === "failed") throw new Error(job.error);
    if (job.status === "completed") return job;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Worker did not complete the job. Start npm run worker.");
}
test("real CSV import profiles errors, previews corrections and publishes immutable versions", async () => {
  const file = new File(
    [
      "region,amount,date,currency\nEurope,10,01/02/2026,USD\nEurope,20,01/02/2026,EUR\nEurope,20,01/02/2026,EUR\nAsia Pacific,,2026-03-01,USD\n",
    ],
    `test-${randomUUID()}.csv`,
  );
  const queued = await ingestFile(analyst, file);
  await waitJob(queued.job.id);
  const original = await getDataset(analyst, queued.dataset.id);
  assert.equal(original.rows, 4);
  assert.ok(original.warnings.some((w) => w.includes("ambiguous")));
  assert.ok(original.warnings.some((w) => w.includes("Mixed currencies")));
  const preview = await transformDataset(
    analyst,
    original.id,
    [{ type: "drop_duplicates" }],
    true,
  );
  assert.equal((preview as { rows: number }).rows, 3);
  assert.equal((await getDataset(analyst, original.id)).rows, 4);
  const next = (await transformDataset(
    analyst,
    original.id,
    [
      { type: "drop_duplicates" },
      { type: "cast", column: "amount", to: "number", invalid: "null" },
    ],
    false,
  )) as { dataset: { id: string }; job: { id: string } };
  await waitJob(next.job.id);
  const published = await getDataset(analyst, next.dataset.id);
  assert.equal(published.rows, 3);
  assert.equal(published.parentVersion, original.version);
  const r = await queryDataset(analyst, {
    datasetId: published.id,
    metric: "sum:amount",
  });
  assert.equal(r.rows[0].value, 30);
  await assert.rejects(() =>
    getDataset({ ...analyst, workspaceId: "helix" }, published.id),
  );
});
test("queued job cancellation persists without exposing another workspace", async () => {
  const id = randomUUID();
  await withWorkspace(analyst, async (db) => {
    await db.query(
      "INSERT INTO jobs(id,workspace_id,user_id,kind) VALUES($1,'atlas','demo-analyst','test.cancel')",
      [id],
    );
  });
  assert.equal((await cancelJob(analyst, id)).status, "cancelled");
  await assert.rejects(() => getJob({ ...owner, workspaceId: "helix" }, id));
});
test("the 32-case baseline passes all deterministic checks without claiming an LLM score", async () => {
  const r = await runEvaluation(owner);
  assert.equal(r.cases.length, 32);
  assert.deepEqual(
    r.cases
      .filter((c) => !c.passed)
      .map((c) => ({ id: c.id, actual: c.actual })),
    [],
  );
  assert.equal(r.score, null);
  assert.equal(r.status, "incomplete");
  assert.match(r.label, /not an AI model score/);
});
test("dashboard performance snapshot uses scoped server aggregation", async () => {
  const timings: number[] = [];
  await getOverview(owner, { from: "2026-01-01", to: "2026-09-30" });
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      const start = performance.now();
      const data = await getOverview(owner, {
        from: "2026-01-01",
        to: "2026-09-30",
      });
      timings.push(performance.now() - start);
      assert.equal(data.series.length, 9);
    }),
  );
  console.log(
    "Five concurrent warm dashboard requests (ms):",
    timings.map((v) => Math.round(v)),
  );
  assert.ok(
    Math.max(...timings) < 5000,
    "Reference API should remain responsive under five concurrent requests.",
  );
});
test.after(async () => {
  await (
    await import("../../lib/server/jobs")
  )
    .getBoss()
    .then((b) => b.stop({ graceful: true, timeout: 5000 }));
  await getPool().end();
});
