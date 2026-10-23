import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ConfidentialClientApplication } from "@azure/msal-node";
import {
  getEmbedConfig,
  listReports,
  type BIConfig,
  exportReport,
  refreshReport,
  powerBIJobHandlers,
} from "../../lib/server/powerbi";
import {
  AppError,
  getPool,
  putResource,
  deleteResource,
} from "../../lib/server/db";
import type { WorkspaceContext } from "../../lib/intelligence/contracts";
import { demoLogin } from "../../lib/server/auth";
import { GET } from "../../app/api/v1/workspaces/[workspaceId]/[...path]/route";
const owner: WorkspaceContext = {
  userId: "demo-owner",
  workspaceId: "atlas",
  role: "owner",
};
const original = {
  mode: process.env.AXIOM_MODE,
  tenant: process.env.POWERBI_TENANT_ID,
  client: process.env.POWERBI_CLIENT_ID,
  secret: process.env.POWERBI_CLIENT_SECRET,
};
const mapping: BIConfig = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  profileId: "22222222-2222-4222-8222-222222222222",
  reports: [
    {
      key: "executive",
      name: "Unit test report",
      description: "Mocked Microsoft contract",
      reportId: "33333333-3333-4333-8333-333333333333",
      datasetId: "44444444-4444-4444-8444-444444444444",
      pages: ["Overview"],
      export: true,
      refresh: true,
      rlsRequired: true,
      identities: {
        "demo-owner": { username: "atlas-owner", roles: ["RegionScope"] },
      },
    },
  ],
};
test("Power BI contract scopes profile, reports, model and effective identity on the server", async () => {
  process.env.AXIOM_MODE = "connected";
  process.env.POWERBI_TENANT_ID = "55555555-5555-4555-8555-555555555555";
  process.env.POWERBI_CLIENT_ID = "66666666-6666-4666-8666-666666666666";
  process.env.POWERBI_CLIENT_SECRET = "unit-test-only";
  await putResource(owner, "powerbi-config", "default", mapping);
  mock.method(
    ConfidentialClientApplication.prototype,
    "acquireTokenByClientCredential",
    async () => ({ accessToken: "unit-test-entra-token" }),
  );
  const requests: { url: string; headers: Headers; body: unknown }[] = [];
  mock.method(
    globalThis,
    "fetch",
    async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      requests.push({
        url,
        headers: new Headers(init?.headers),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return Response.json(
        url.endsWith("/GenerateToken")
          ? {
              token: "unit-test-embed-token",
              expiration: new Date(Date.now() + 3600000).toISOString(),
            }
          : {
              datasetId: mapping.reports[0].datasetId,
              embedUrl: "https://app.powerbi.com/reportEmbed?reportId=approved",
            },
      );
    },
  );
  const config = await getEmbedConfig(owner, "executive");
  assert.equal(config.mode, "connected");
  assert.equal(config.embedToken, "unit-test-embed-token");
  assert.ok(!JSON.stringify(config).includes("unit-test-entra-token"));
  assert.ok(
    requests.every(
      (r) => r.headers.get("X-PowerBI-Profile-Id") === mapping.profileId,
    ),
  );
  const body = requests.find((r) => r.url.endsWith("/GenerateToken"))!.body as {
    reports: { id: string }[];
    datasets: { id: string }[];
    identities: { username: string; roles: string[] }[];
  };
  assert.equal(body.reports[0].id, mapping.reports[0].reportId);
  assert.equal(body.datasets[0].id, mapping.reports[0].datasetId);
  assert.equal(body.identities[0].username, "atlas-owner");
  assert.deepEqual(body.identities[0].roles, ["RegionScope"]);
  await assert.rejects(
    () => getEmbedConfig(owner, "arbitrary-microsoft-report-id"),
    (e: unknown) => e instanceof AppError && e.status === 404,
  );
  await assert.rejects(
    () =>
      getEmbedConfig(
        { ...owner, userId: "demo-viewer", role: "viewer" },
        "executive",
      ),
    (e: unknown) => e instanceof AppError && e.status === 403,
  );
  assert.deepEqual(
    await listReports({ ...owner, userId: "demo-viewer", role: "viewer" }),
    [],
  );
  await assert.rejects(
    () => getEmbedConfig({ ...owner, workspaceId: "helix" }, "executive"),
    (e: unknown) => e instanceof AppError && e.code === "powerbi_unconfigured",
  );
  await assert.rejects(
    () => exportReport({ ...owner, role: "viewer" }, "executive"),
    (e: unknown) => e instanceof AppError && e.status === 403,
  );
  await assert.rejects(
    () => refreshReport({ ...owner, role: "analyst" }, "executive"),
    (e: unknown) => e instanceof AppError && e.status === 403,
  );
  mock.restoreAll();
  await deleteResource(owner, "powerbi-config", "default");
});
test("missing live configuration fails closed while demo returns no fake token", async () => {
  process.env.AXIOM_MODE = "connected";
  await assert.rejects(
    () => getEmbedConfig(owner, "executive"),
    (e: unknown) => e instanceof AppError && e.code === "powerbi_unconfigured",
  );
  process.env.AXIOM_MODE = "demo";
  const demo = await getEmbedConfig(owner, "executive");
  assert.equal(demo.mode, "demo");
  assert.equal(demo.embedToken, undefined);
  assert.equal(demo.capabilities.export, false);
});
test("report exports enforce creator-only downloads and reject changed RLS scope on download or retry", async () => {
  process.env.AXIOM_MODE = "demo";
  const session = async (userId: string) => {
    const result = await demoLogin(
      new Request("http://localhost:3000/api/auth/demo", {
        method: "POST",
        headers: {
          origin: process.env.APP_URL || "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      }),
    );
    return result.headers.get("set-cookie")!.split(";")[0];
  };
  const ownerCookie = await session("demo-owner");
  const analystCookie = await session("demo-analyst");
  const outsiderCookie = await session("demo-helix");
  process.env.AXIOM_MODE = "connected";
  const scopedMapping = structuredClone(mapping);
  scopedMapping.reports[0].identities["demo-analyst"] = {
    username: "atlas-limited-region",
    roles: ["RegionScope"],
  };
  await putResource(owner, "powerbi-config", "default", scopedMapping);
  mock.method(
    ConfidentialClientApplication.prototype,
    "acquireTokenByClientCredential",
    async () => ({ accessToken: "unit-test-entra-token" }),
  );
  let requests = 0;
  mock.method(globalThis, "fetch", async (input: URL | RequestInfo) => {
    requests++;
    const url = String(input);
    if (url.endsWith("/ExportTo")) return Response.json({ id: "export-test" });
    if (url.endsWith("/file"))
      return new Response("Creator's RLS-scoped PDF evidence", {
        headers: { "Content-Type": "application/pdf" },
      });
    return Response.json({ status: "Succeeded", percentComplete: 100 });
  });
  const jobId = randomUUID();
  const retryId = randomUUID();
  const options = {
    signal: new AbortController().signal,
    progress: async () => {},
    jobId,
  };
  const download = (cookie: string, workspaceId = "atlas") =>
    GET(
      new Request(
        `http://localhost:3000/api/v1/workspaces/${workspaceId}/artifacts/${jobId}`,
        {
          headers: { cookie },
        },
      ),
      { params: Promise.resolve({ workspaceId, path: ["artifacts", jobId] }) },
    );
  try {
    await powerBIJobHandlers["powerbi.export"](
      owner,
      { key: "executive", format: "PDF" },
      options,
    );
    const permitted = await download(ownerCookie);
    assert.equal(permitted.status, 200);
    assert.equal(await permitted.text(), "Creator's RLS-scoped PDF evidence");
    assert.equal((await download(analystCookie)).status, 403);
    assert.equal((await download(outsiderCookie)).status, 403);
    assert.equal((await download(ownerCookie, "helix")).status, 404);

    const changed = structuredClone(scopedMapping);
    changed.reports[0].identities[owner.userId].username =
      "atlas-restricted-owner";
    await putResource(owner, "powerbi-config", "default", changed);
    const stale = await download(ownerCookie);
    assert.equal(stale.status, 403);
    assert.equal(
      (await stale.json()).error.code,
      "artifact_authorization_changed",
    );

    // A retry must not relabel an export created under the old effective identity.
    await putResource(owner, "bi-export", retryId, {
      remoteId: "previous-scope-export",
      fingerprint: "old-identity-fingerprint",
    });
    const beforeRetry = requests;
    await assert.rejects(
      () =>
        powerBIJobHandlers["powerbi.export"](
          owner,
          { key: "executive", format: "PDF" },
          { ...options, jobId: retryId },
        ),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === "artifact_authorization_changed",
    );
    assert.equal(requests, beforeRetry);

    scopedMapping.reports[0].export = false;
    await putResource(owner, "powerbi-config", "default", scopedMapping);
    assert.equal((await download(ownerCookie)).status, 403);
  } finally {
    mock.restoreAll();
    for (const [kind, id] of [
      ["artifact", jobId],
      ["bi-export", jobId],
      ["bi-export", retryId],
      ["powerbi-config", "default"],
    ])
      await deleteResource(owner, kind, id).catch(() => {});
  }
});
test.after(async () => {
  mock.restoreAll();
  for (const [k, v] of Object.entries({
    AXIOM_MODE: original.mode,
    POWERBI_TENANT_ID: original.tenant,
    POWERBI_CLIENT_ID: original.client,
    POWERBI_CLIENT_SECRET: original.secret,
  })) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  await getPool().end();
});
