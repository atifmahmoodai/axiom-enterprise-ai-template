import { test, expect } from "@playwright/test";
import axe from "axe-core";
async function login(
  page: import("@playwright/test").Page,
  user = "demo-owner",
) {
  await page.goto("/login/");
  await page.getByLabel("Reference account").selectOption(user);
  await page
    .getByRole("button", { name: "Explore reference workspace" })
    .click();
  await page.waitForURL(/\/app\/[^/]+\/overview\/?$/);
  await page.getByText("The revenue picture").waitFor();
}
test("executive filters, metric definitions, saved views and keyboard navigation", async ({
  page,
}) => {
  await login(page);
  await page.locator(".ios-kpi").filter({ hasText: "Billed revenue" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("not GAAP");
  await page.getByRole("button", { name: "Close metric definition" }).click();
  await page.getByLabel("Region", { exact: true }).selectOption("Europe");
  await expect(page.getByText("The revenue picture")).toBeVisible();
  await page.getByText("Save view", { exact: true }).click();
  await page.getByLabel("Saved view name").fill("Europe executive view");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "View saved" }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const audit = await (
    await page.request.get("/api/v1/workspaces/atlas/audit/")
  ).json();
  expect(
    audit.some(
      (event: { action: string }) => event.action === "snapshot.exported",
    ),
  ).toBe(true);
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Search workspace destinations").fill("lineage");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/catalog/);
  await expect(page.getByText("The intelligence graph")).toBeVisible();
});
test("upload, review transformation, analyze selected data and save evidence", async ({
  page,
}) => {
  await login(page);
  await page.goto("/app/atlas/datasets/");
  const name = `browser-${Date.now()}.csv`;
  await page.getByLabel("Import dataset file").setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from("region,amount\nEurope,10\nEurope,20\nEurope,20\n"),
  });
  await expect(
    page.getByRole("heading", { name: "Review a transformation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect(page.getByText("Preview · not published")).toBeVisible();
  await page.getByRole("button", { name: "Publish new version" }).click();
  await expect(
    page.getByRole("heading", { name: "Review a transformation" }),
  ).toBeVisible();
  let dataset: { id: string } | undefined;
  await expect
    .poll(async () => {
      const list = await (
        await page.request.get("/api/v1/workspaces/atlas/datasets/")
      ).json();
      dataset = list.find(
        (d: { name: string; rows: number; state: string }) =>
          d.name === name && d.rows === 2 && d.state === "ready",
      );
      return dataset?.id;
    })
    .toBeTruthy();
  await page.goto("/app/atlas/analyst/");
  await page.getByLabel("Analyze", { exact: true }).selectOption(dataset!.id);
  await page
    .getByLabel("Ask your dataset a question")
    .fill("What is the sum of amount?");
  await page.getByRole("button", { name: "Ask Axiom" }).click();
  await expect(page.locator(".ios-answer")).toContainText(
    "calculated by the query engine",
  );
  await expect(page.locator(".ios-answer-facts")).toContainText("30");
  await page.getByRole("button", { name: "Save analysis" }).click();
  await expect(
    page.getByRole("button", { name: "Saved to workspace" }),
  ).toBeVisible();
});
test("forecast methods, report preview and governance remain usable", async ({
  page,
}) => {
  await login(page);
  await page.goto("/app/atlas/lab/");
  await expect(
    page.getByRole("heading", {
      name: "Revenue forecast with holdout evidence",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cohorts", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Paid-customer cohorts" }),
  ).toBeVisible();
  await page.goto("/app/atlas/reports/");
  await expect(page.getByText("Power BI not connected")).toBeVisible();
  await page
    .getByRole("button", { name: "Infrastructure Economics", exact: true })
    .click();
  await expect(page.locator(".ios-demo-report h3")).toHaveText(
    "Infrastructure Economics",
  );
  await page.goto("/app/atlas/governance/");
  await expect(
    page.getByRole("heading", { name: "Audit history" }),
  ).toBeVisible();
  await expect(page.getByLabel("Role for Sam Chen")).toHaveValue("analyst");
});
test("viewer cannot upload, question data or access another tenant", async ({
  page,
}) => {
  await login(page, "demo-viewer");
  await page.goto("/app/atlas/datasets/");
  await expect(
    page.getByRole("button", { name: "Import data", exact: true }),
  ).toBeDisabled();
  const cross = await page.request.get("/api/v1/workspaces/helix/overview/");
  expect(cross.status()).toBe(403);
  const denied = await page.request.post("/api/v1/workspaces/atlas/analyst/", {
    headers: { Origin: "http://localhost:3000" },
    data: { question: "show revenue" },
  });
  expect(denied.status()).toBe(403);
});
test("all application routes pass automated accessibility and contain their layouts", async ({
  page,
}) => {
  await login(page);
  const sections = [
    "overview",
    "datasets",
    "analyst",
    "lab",
    "catalog",
    "evaluations",
    "reports",
    "governance",
  ];
  for (const section of sections) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/app/atlas/${section}/`);
    await page
      .locator(".ios-loading")
      .waitFor({ state: "hidden", timeout: 30000 })
      .catch(() => {});
    await page.addScriptTag({ content: axe.source });
    const result = await page.evaluate(
      async () =>
        await (window as unknown as { axe: typeof axe }).axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
          },
        }),
    );
    expect(
      result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
      section,
    ).toEqual([]);
    for (const width of [320, 1440, 3840]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        `${section} at ${width}`,
      ).toBe(false);
    }
  }
});
