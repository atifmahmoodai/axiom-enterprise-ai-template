import test from "node:test";
import assert from "node:assert/strict";
import { exportSnapshot } from "../../lib/server/export";
import { AppError, getPool, workspaceQuery } from "../../lib/server/db";
import { demoLogin } from "../../lib/server/auth";
import { POST } from "../../app/api/v1/workspaces/[workspaceId]/[...path]/route";
import type { WorkspaceContext } from "../../lib/intelligence/contracts";
const analyst: WorkspaceContext = {
  userId: "demo-analyst",
  workspaceId: "atlas",
  role: "analyst",
};
const input = {
  rows: [{ text: '  =HYPERLINK("bad")', amount: -3 }],
  columns: ["text", "amount"],
  filename: "snapshot.csv",
  datasetVersion: "claimed-version",
};

test("snapshot exports neutralize spreadsheet formulas and audit only bounded metadata", async () => {
  const result = await exportSnapshot(analyst, input);
  assert.ok(result.csv.includes("'  =HYPERLINK"));
  assert.ok(result.csv.includes('"-3"'));
  const events = await workspaceQuery(
    analyst,
    "SELECT detail FROM audit_events WHERE workspace_id=$1 AND resource_id=$2 AND action='snapshot.exported'",
    [analyst.workspaceId, result.id],
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].detail.verifiedRecomputation, false);
  assert.equal(events[0].detail.claimedDatasetVersion, "claimed-version");
  assert.ok(!JSON.stringify(events).includes("HYPERLINK"));
  await assert.rejects(() =>
    exportSnapshot(analyst, {
      ...input,
      rows: Array.from({ length: 10001 }, () => ({})),
    }),
  );
  await assert.rejects(
    () =>
      exportSnapshot(analyst, {
        ...input,
        rows: [{ text: "x".repeat(2 * 1024 * 1024) }],
      }),
    (e: unknown) => e instanceof AppError && e.status === 413,
  );
});

test("export endpoint revalidates tenant, role and origin before generating a download", async () => {
  const origin = process.env.APP_URL || "http://localhost:3000";
  const cookieFor = async (userId: string) =>
    (
      await demoLogin(
        new Request(`${origin}/api/auth/demo/`, {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }),
      )
    ).headers
      .get("set-cookie")!
      .split(";")[0];
  const cookie = await cookieFor("demo-analyst");
  const request = (
    workspace: string,
    session = cookie,
    requestOrigin = origin,
  ) =>
    POST(
      new Request(`${origin}/api/v1/workspaces/${workspace}/exports/`, {
        method: "POST",
        headers: {
          Origin: requestOrigin,
          Cookie: session,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
      {
        params: Promise.resolve({ workspaceId: workspace, path: ["exports"] }),
      },
    );
  assert.equal((await request("helix")).status, 403);
  assert.equal(
    (await request("atlas", cookie, "https://invalid.example")).status,
    403,
  );
  assert.equal(
    (await request("atlas", await cookieFor("demo-viewer"))).status,
    403,
  );
  const allowed = await request("atlas");
  assert.equal(allowed.status, 200);
  assert.match(allowed.headers.get("content-type")!, /text\/csv/);
  assert.equal(
    allowed.headers.get("x-axiom-export-source"),
    "client-supplied-snapshot",
  );
  await assert.rejects(
    () =>
      exportSnapshot(
        { ...analyst, userId: "demo-viewer", role: "owner" },
        input,
      ),
    (e: unknown) => e instanceof AppError && e.status === 403,
  );
});
test.after(async () => {
  await getPool().end();
});
