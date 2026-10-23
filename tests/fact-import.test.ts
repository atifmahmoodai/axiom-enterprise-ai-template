import test from "node:test";
import assert from "node:assert/strict";
import {
  parseFactSnapshot,
  normalizeFactSnapshot,
} from "../lib/intelligence/fact-import";
const fixture = () => ({
  name: "Verified billing export",
  currency: "USD",
  timezone: "UTC",
  usage_unit: "tokens",
  refreshed_at: "2025-03-01T00:00:00Z",
  refresh_interval_hours: 24,
  coverage_from: "2025-01-01",
  coverage_to: "2025-02-28",
  facts: [
    {
      record_id: "invoice-1",
      occurred_at: "2025-01-20",
      customer_id: "customer-1",
      plan: "Enterprise",
      region: "Europe",
      event_type: "invoice",
      amount_cents: 10000,
    },
  ],
});
test("canonical fact validation rejects tenant/version injection and incompatible units", () => {
  for (const extra of [
    { workspace_id: "helix" },
    { dataset_version: "forged" },
    { currency: "EUR" },
    { timezone: "America/New_York" },
    { usage_unit: "requests" },
  ])
    assert.throws(() => parseFactSnapshot({ ...fixture(), ...extra }));
  for (const extra of [
    { workspace_id: "helix" },
    { occurred_at: "01/02/2025" },
    { occurred_at: "2025-02-30" },
    { amount_cents: 0.1 },
    { amount_cents: Infinity },
    { quantity: 10 },
  ]) {
    const input = fixture();
    assert.throws(() =>
      parseFactSnapshot({ ...input, facts: [{ ...input.facts[0], ...extra }] }),
    );
  }
});
test("canonical fact validation rejects duplicate grain and out-of-coverage records", () => {
  const input = fixture();
  assert.throws(
    () =>
      parseFactSnapshot({ ...input, facts: [input.facts[0], input.facts[0]] }),
    /Duplicate/,
  );
  const subscription = {
    ...input.facts[0],
    event_type: "subscription",
    amount_cents: 0,
    mrr_cents: 5000,
    occurred_at: "2025-01-31",
  };
  assert.throws(
    () =>
      parseFactSnapshot({
        ...input,
        facts: [subscription, { ...subscription, record_id: "other" }],
      }),
    /month-end/,
  );
  assert.throws(
    () =>
      parseFactSnapshot({
        ...input,
        facts: [{ ...subscription, occurred_at: "2025-01-30" }],
      }),
    /month-end/,
  );
  assert.throws(
    () => parseFactSnapshot({ ...input, coverage_to: "2025-01-01" }),
    /coverage/,
  );
});
test("canonical snapshots have order-independent hashes and tenant-specific record IDs", () => {
  const input = fixture();
  const rows = [
    input.facts[0],
    { ...input.facts[0], record_id: "invoice-2", amount_cents: -100 },
  ];
  const a = normalizeFactSnapshot(
    "atlas",
    parseFactSnapshot({ ...input, facts: rows }),
  );
  const b = normalizeFactSnapshot(
    "atlas",
    parseFactSnapshot({ ...input, facts: [...rows].reverse() }),
  );
  const c = normalizeFactSnapshot(
    "helix",
    parseFactSnapshot({ ...input, facts: rows }),
  );
  assert.equal(a.hash, b.hash);
  assert.deepEqual(a.facts, b.facts);
  assert.equal(a.hash, c.hash);
  assert.notEqual(a.facts[0].id, c.facts[0].id);
  assert.equal(a.facts[0].workspace_id, "atlas");
});
