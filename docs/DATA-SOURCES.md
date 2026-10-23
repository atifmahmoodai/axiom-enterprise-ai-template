# Connected operational data

Axiom accepts a canonical SaaS fact snapshot from a trusted provisioning operator. The connected Executive overview, catalog queries, Analyst and Analysis Lab read this versioned source. Vendor-specific extraction, currency conversion and business mapping belong in your upstream data pipeline; the supplied adapter validates and publishes its normalized output.

Ordinary CSV/XLSX/JSON/Parquet uploads remain separate datasets. They support profiling, reviewed cleaning and bounded Analyst aggregations. Uploading a column named `revenue` does not automatically make it the operational revenue source.

## Provision a workspace

1. Apply all migrations with `npm run db:migrate` in an isolated operator environment containing `DATABASE_ADMIN_URL`. Migration 005 removes runtime fact writes and protects operational source manifests from runtime mutation.
2. Identify the existing workspace and the verified application user ID of an administrator or owner in that workspace. The importer checks current membership; an email address or an arbitrary actor name is insufficient.
3. Export a complete snapshot using the schema below. Review its coverage, deduplication, monetary conversion and subscription snapshot semantics before publication. Keep customer data outside the repository.
4. Publish the reviewed file:

   ```sh
   npm run facts:import -- WORKSPACE_ID VERIFIED_ACTOR_ID /secure/path/snapshot.json
   ```

   The command prints only workspace, content-derived version, row count and staleness. It inserts facts and activates the source in one transaction, recording an `operational-source.activated` audit event. A validation or database failure rolls back publication.

5. Set `AXIOM_MODE=connected`, configure production identity, and restart/recreate web and worker with that configuration. Disable demo login. Select the source by its supplied name in Data Workbench or Analyst; choose dates within its declared coverage in the dashboard. OpenAI credentials are required for connected natural-language planning, but deterministic dashboard and Lab calculations do not call OpenAI.

For the Docker reference, the operator-only `init` image has the provisioning scripts and database administration configuration. Mount an immutable input file read-only and override its default command:

```sh
docker compose run --rm --no-deps \
  -v /absolute/path/snapshot.json:/imports/snapshot.json:ro \
  init npx tsx scripts/facts-import.ts WORKSPACE_ID VERIFIED_ACTOR_ID /imports/snapshot.json
```

PostgreSQL must already be running and migrated. Keep the administration credential in the operator environment; web and worker do not receive it. Re-run the import from a scheduler in that environment when a reviewed source refresh is ready. The app does not fetch a billing vendor or schedule upstream extraction automatically.

## Input example

This is a small schema example, not a forecasting fixture. Replace its business values, dates and identity fields with reviewed source data. `refreshed_at` records when the upstream snapshot was produced, not when this command ran; the historical timestamp deliberately becomes stale.

```json
{
  "name": "Finance warehouse · SaaS snapshot",
  "currency": "USD",
  "timezone": "UTC",
  "usage_unit": "tokens",
  "refreshed_at": "2026-10-01T01:00:00Z",
  "refresh_interval_hours": 24,
  "coverage_from": "2026-09-01",
  "coverage_to": "2026-09-30",
  "facts": [
    {
      "record_id": "invoice-1001",
      "occurred_at": "2026-09-15",
      "customer_id": "customer-001",
      "plan": "Enterprise",
      "region": "Europe",
      "event_type": "invoice",
      "amount_cents": 100000
    },
    {
      "record_id": "usage-1001",
      "occurred_at": "2026-09-15",
      "customer_id": "customer-001",
      "plan": "Enterprise",
      "region": "Europe",
      "event_type": "usage",
      "quantity": 250000
    },
    {
      "record_id": "infrastructure-1001",
      "occurred_at": "2026-09-30",
      "customer_id": "customer-001",
      "plan": "Enterprise",
      "region": "Europe",
      "event_type": "infrastructure",
      "cost_cents": 20000
    },
    {
      "record_id": "subscription-1001-2026-09",
      "occurred_at": "2026-09-30",
      "customer_id": "customer-001",
      "plan": "Enterprise",
      "region": "Europe",
      "event_type": "subscription",
      "mrr_cents": 100000
    }
  ]
}
```

The schema is strict: extra fields, including client-supplied workspace IDs and dataset versions, are rejected. The operator command supplies the workspace; the importer generates fact IDs and versions.

| Field                                | Contract                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `name`                               | Nonempty source label, at most 180 characters                                                               |
| `currency`, `timezone`, `usage_unit` | Exactly `USD`, `UTC`, `tokens`; no implicit conversion                                                      |
| `refreshed_at`                       | UTC ISO datetime ending in `Z`; at most five minutes ahead of the server clock                              |
| `refresh_interval_hours`             | Integer from 1 to 2,160; expected upstream refresh interval                                                 |
| `coverage_from`, `coverage_to`       | Valid ordered `YYYY-MM-DD` dates, spanning at most ten years; every fact must fall within them              |
| `record_id`                          | Nonempty unique source-record identifier, at most 180 characters                                            |
| `customer_id`                        | Nonempty stable customer key, at most 180 characters; use `unallocated` for unassigned infrastructure costs |
| `plan`                               | `Launch`, `Scale`, `Enterprise`, or `Unallocated`                                                           |
| `region`                             | `North America`, `Europe`, `Asia Pacific`, or `Unallocated`                                                 |
| `event_type`                         | `invoice`, `usage`, `infrastructure`, or `subscription`                                                     |
| `amount_cents`                       | Exact integer USD cents on invoice rows; negatives can represent credits                                    |
| `cost_cents`                         | Nonnegative exact integer USD cents on infrastructure rows                                                  |
| `mrr_cents`                          | Nonnegative exact integer USD cents on subscription rows                                                    |
| `quantity`                           | Nonnegative exact integer token count on usage rows                                                         |

Numeric fields default to zero. Only the numeric field associated with a row's event type may be nonzero. The importer rejects nonfinite values, unsafe integers, invalid calendar dates, duplicate record IDs and aggregate absolute integer totals exceeding JavaScript's exact integer range. It does not silently clean or convert bad input.

## Grain and business definitions

Invoice, infrastructure and usage rows have independent source-event grains. Do not join them into a multiplied invoice-by-usage table before import. Catalog calculations aggregate these grains independently. Billed revenue is invoice value; it is not recognized GAAP revenue. Infrastructure-adjusted margin excludes costs outside the supplied infrastructure rows.

Subscription rows are **month-end customer snapshots**, not lifecycle event logs. Supply at most one row per customer per month, dated on the final UTC calendar day. Include explicit zero-MRR snapshots for known churned customers. Missing observations do not establish churn or zero revenue; the application cannot infer completeness from a file alone. Retention uses the earliest and latest observed snapshots in the requested interval, and reports its assumptions.

The operator declares source coverage. It should reflect a complete reviewed extract for those dates; the parser checks date boundaries but cannot verify upstream completeness. Forecasts require sufficient observed monthly history and appropriate seasonality; the one-month example above is deliberately insufficient.

The fixed plan/region catalog makes mappings explicit. Map source labels upstream or extend the domain catalog, query validation, UI filters and Power BI dimensions together. Do not relabel a different currency or unit merely to satisfy the schema.

## Versions, freshness and recovery

Publication sorts records by source ID and hashes the normalized snapshot, including its metadata. Its version is `operational/<sha256>`. Reordering otherwise identical rows preserves the version; changing values, coverage, label or freshness metadata creates a new version. Re-importing exactly the same snapshot is idempotent and does not duplicate facts.

Each workspace has an active source pointer and immutable historical manifests. Activation affects new analyses. An overview request and its Lab calculations use one pinned version throughout; Analyst follow-ups retain the conversation's recorded version. Provenance exposes the version, filters, source refresh timestamp and calculation timestamp. The same content hash in another workspace conveys no access: membership and database RLS are still checked.

A source becomes stale after `refreshed_at + refresh_interval_hours`. Stale data remains inspectable with explicit status and warnings; no invented fresh values are substituted. Queries outside declared coverage disclose partial coverage. If connected mode has no valid source, operational APIs return an unavailable/configuration error and do not read reference seed data. Uploaded datasets remain separately available.

To return to a previous snapshot, re-import its original reviewed file. Historical fact versions are retained; no automatic retention/deletion policy is supplied. Back up both PostgreSQL and the original upstream extracts. Correct data by publishing a new reviewed snapshot rather than editing historical facts.

## Processing and security limits

- Input is a regular JSON file from 1 byte to 50 MiB, containing at most 250,000 facts. The importer reads it into bounded memory; it is not a streaming or distributed ETL engine.
- Facts are inserted in batches of 1,000 within one publication transaction. Database statements have a 120-second timeout; this is not an end-to-end throughput guarantee.
- Operational queries retain the standard read-only query role, result limits, timeouts and tenant restrictions. Snapshot-based metric processing has a 100,000-row limit and discloses partial calculations when reached; narrow the interval or segment when necessary.
- Runtime users cannot insert fact rows or change/delete operational source manifests. Provisioning requires the separate administration connection plus verified administrator/owner membership for the supplied actor.
- Source text is data. It is not SQL, Python or model instructions. The pipeline does not execute expressions from the snapshot.

See [Validation](VALIDATION.md) for recorded tests and [Performance](PERFORMANCE.md) for measured conditions. Schema limits alone do not establish maximum-size import performance or production capacity.
