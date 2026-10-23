import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { executeAnalyst } from "../../lib/server/analyst";
import { getPool, AppError } from "../../lib/server/db";
const context = {
  userId: "demo-owner",
  workspaceId: "atlas",
  role: "owner" as const,
};
test("OpenAI adapter uses schema-constrained plans and server-calculated facts", async () => {
  const key = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = "unit-test-only";
  process.env.OPENAI_MODEL = "unit-test-model";
  let body: Record<string, unknown> | undefined;
  mock.method(
    globalThis,
    "fetch",
    async (_input: URL | RequestInfo, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return Response.json({
        id: "resp_unit",
        object: "response",
        status: "completed",
        model: "unit-test-model",
        output: [
          {
            id: "msg_unit",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  status: "answered",
                  explanation:
                    "Invented number 999999999 must not become a fact",
                  metric: "revenue",
                  groupBy: null,
                  filters: {
                    from: "2026-09-01",
                    to: "2026-09-30",
                    region: null,
                    plan: null,
                  },
                }),
                annotations: [],
              },
            ],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 30, total_tokens: 130 },
      });
    },
  );
  try {
    const result = await executeAnalyst(
      context,
      { question: "Show billed revenue in September 2026" },
      { provider: "openai", persist: false },
    );
    assert.equal(result.provider, "openai");
    assert.equal(result.usage?.input, 100);
    assert.equal(result.usage?.estimatedCost, null);
    assert.ok(Number(result.result?.rows[0].value) > 0);
    assert.ok(!result.answer.includes("999999999"));
    assert.equal(body?.store, false);
    assert.ok(JSON.stringify(body?.text).includes("json_schema"));
    assert.match(result.result!.query, /workspace_id=\$1/);
  } finally {
    mock.restoreAll();
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
    if (model === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = model;
  }
});
test("unconfigured connected AI fails without returning a demo answer", async () => {
  const key = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      () =>
        executeAnalyst(
          context,
          { question: "Show billed revenue" },
          { provider: "openai", persist: false },
        ),
      (error: unknown) =>
        error instanceof AppError && error.code === "openai_unconfigured",
    );
  } finally {
    if (key !== undefined) process.env.OPENAI_API_KEY = key;
  }
});
test.after(async () => {
  await getPool().end();
});
