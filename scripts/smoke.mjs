import assert from "node:assert/strict";

// Run only against an explicitly enabled demo environment. No provider credentials are used.
const origin = new URL(process.env.APP_URL || "http://localhost:3000").origin;
let cookie = "";
async function request(path, options = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...options,
    headers: { Origin: origin, Cookie: cookie, ...options.headers },
    signal: AbortSignal.timeout(30000),
  });
  assert.ok(
    response.ok,
    `${options.method || "GET"} ${path}: ${response.status}`,
  );
  return response;
}
const login = await request("/api/auth/demo/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: "demo-analyst" }),
});
cookie = login.headers.get("set-cookie")?.split(";")[0] || "";
assert.ok(cookie, "Server session cookie is required");
const base = "/api/v1/workspaces/atlas";
const overview = await (await request(`${base}/overview/`)).json();
assert.equal(overview.rowCount, 83050);
assert.ok(overview.metrics.find((m) => m.id === "revenue").value > 0);
const denied = await fetch(`${origin}/api/v1/workspaces/helix/overview/`, {
  headers: { Cookie: cookie },
});
assert.equal(
  denied.status,
  403,
  "A single-workspace analyst must be denied other tenants",
);
const upload = new FormData();
upload.set(
  "file",
  new File(["region,amount\nEurope,10\nEurope,20\n"], "smoke.csv", {
    type: "text/csv",
  }),
);
const ingestion = await (
  await request(`${base}/datasets/`, { method: "POST", body: upload })
).json();
const jobId = ingestion.job?.id || ingestion.id;
assert.ok(jobId, "Ingestion must return a durable job");
let job;
const deadline = Date.now() + 90000;
while (Date.now() < deadline) {
  job = await (await request(`${base}/jobs/${jobId}/`)).json();
  if (["completed", "failed", "cancelled"].includes(job.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
assert.equal(job?.status, "completed", "Background profiling must complete");
const datasets = await (await request(`${base}/datasets/`)).json();
const dataset = datasets.find(
  (item) =>
    item.name === "smoke.csv" && item.rows === 2 && item.state === "ready",
);
assert.ok(dataset, "Profiled dataset must be available");
const answer = await (
  await request(`${base}/analyst/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      datasetId: dataset.id,
      question: "What is the sum of amount?",
    }),
  })
).json();
assert.equal(answer.result.rows[0].value, 30);
assert.ok(answer.result.provenance.datasetVersion);
console.log(
  "Smoke PASS: session, 83,050 tenant facts, cross-tenant denial, worker import, Python query, sum=30 and provenance.",
);
