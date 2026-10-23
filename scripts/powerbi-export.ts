import { mkdir, writeFile } from "node:fs/promises";
import { generateSeed } from "../lib/intelligence/seed";
const workspace = process.argv[2] || "atlas";
const dir = `.data/powerbi-${workspace}`;
await mkdir(dir, { recursive: true, mode: 0o700 });
const { facts, manifest } = generateSeed(workspace);
const quote = (value: unknown) =>
  '"' + String(value ?? "").replaceAll('"', '""') + '"';
async function csv(name: string, rows: Record<string, unknown>[]) {
  const cols = Object.keys(rows[0] || {});
  await writeFile(
    `${dir}/${name}.csv`,
    [
      cols.map(quote).join(","),
      ...rows.map((r) => cols.map((c) => quote(r[c])).join(",")),
    ].join("\r\n"),
    { mode: 0o600 },
  );
}
for (const type of ["invoice", "subscription", "usage", "infrastructure"])
  await csv(
    `Fact_${type}`,
    facts
      .filter((f) => f.event_type === type)
      .map((f) => ({
        Date: f.occurred_at,
        CustomerId: f.customer_id,
        PlanName: f.plan,
        RegionName: f.region,
        Amount: f.amount_cents / 100,
        Cost: f.cost_cents / 100,
        MRR: f.mrr_cents / 100,
        Quantity: f.quantity,
      })),
  );
await csv("Customer", [
  ...new Map(
    facts.map((f) => [f.customer_id, { CustomerId: f.customer_id }]),
  ).values(),
]);
await csv(
  "Plan",
  [...new Set(facts.map((f) => f.plan))].map((Name) => ({ Name })),
);
await csv(
  "Region",
  [...new Set(facts.map((f) => f.region))].map((Name) => ({ Name })),
);
const dates: Record<string, unknown>[] = [];
for (
  let t = Date.parse(manifest.from);
  t <= Date.parse(manifest.to);
  t += 86400000
) {
  const DateValue = new Date(t).toISOString().slice(0, 10);
  dates.push({
    Date: DateValue,
    Year: Number(DateValue.slice(0, 4)),
    Month: DateValue.slice(0, 7),
  });
}
await csv("Date", dates);
console.log(
  `Exported ${workspace}-only reference tables to ${dir}. These files contain only that organization's seeded facts.`,
);
