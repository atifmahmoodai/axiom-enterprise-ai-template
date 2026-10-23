import { parse } from "pgsql-ast-parser";
import type { AnalyticalPlan, Filters } from "./contracts";
import { canonicalMetric, metricDefinition } from "./metrics";
import { PLANS, REGIONS, SEED_FROM, SEED_TO, SEED_VERSION } from "./seed";

export function normalizeFilters(
  input: Filters = {},
): Required<Pick<Filters, "from" | "to">> & Filters {
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  const from = input.from || SEED_FROM,
    to = input.to || SEED_TO;
  if (
    !validDate(from) ||
    !validDate(to) ||
    from > to ||
    Date.parse(to) - Date.parse(from) > 366 * 10 * 86400000
  )
    throw new Error(
      "Choose valid ISO dates in order, spanning at most ten years.",
    );
  const regionAliases: Record<string, string> = {
    US: "North America",
    EU: "Europe",
    APAC: "Asia Pacific",
  };
  const region = input.region
    ? regionAliases[input.region] ||
      REGIONS.find((r) => r.toLowerCase() === input.region!.toLowerCase()) ||
      input.region
    : undefined;
  const plan = input.plan
    ? PLANS.find((p) => p.toLowerCase() === input.plan!.toLowerCase()) ||
      input.plan
    : undefined;
  if (region && ![...REGIONS, "Unallocated"].includes(region))
    throw new Error("Choose a catalogued region.");
  if (plan && ![...PLANS, "Unallocated"].includes(plan))
    throw new Error("Choose a catalogued plan.");
  return { from, to, ...(region ? { region } : {}), ...(plan ? { plan } : {}) };
}
export function validateCompiledQuery(sql: string): void {
  const statements = parse(sql);
  if (
    statements.length !== 1 ||
    !["select", "with"].includes(statements[0].type)
  )
    throw new Error("Only a single analytical SELECT is allowed.");
  if (
    /\b(?:pg_|information_schema|set_config|current_setting|sleep|dblink|lo_import|copy|insert|update|delete|drop|alter|create|union|intersect|except)\b/i.test(
      sql,
    )
  )
    throw new Error("The query contains a forbidden operation.");
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "table") {
      const name = n.name as { name?: string; schema?: string };
      if (
        name.schema ||
        !["fact_events", "selected_dataset"].includes(name.name || "")
      )
        throw new Error("The query references an unauthorized relation.");
    }
    if (n.type === "call") {
      const fn = n.function as { name?: string; schema?: string };
      if (
        fn.schema ||
        ![
          "sum",
          "count",
          "avg",
          "min",
          "max",
          "coalesce",
          "nullif",
          "date_trunc",
          "to_char",
          "round",
        ].includes(fn.name?.toLowerCase() || "")
      )
        throw new Error("The query uses an unauthorized function.");
    }
    for (const child of Object.values(n))
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === "object") walk(child);
  };
  statements.forEach(walk);
}
export function compilePlan(
  raw: AnalyticalPlan,
  workspaceId: string,
  version = SEED_VERSION,
) {
  if (!raw || typeof raw.metric !== "string" || !metricDefinition(raw.metric))
    throw new Error("Choose a defined catalog metric.");
  const metric = canonicalMetric(raw.metric),
    filters = normalizeFilters(raw.filters);
  if (
    raw.groupBy &&
    !["month", "region", "plan", "customer"].includes(raw.groupBy)
  )
    throw new Error("Unsupported grouping.");
  const limit = raw.limit ?? 1000;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
    throw new Error("Result limit must be between 1 and 10,000.");
  const values: unknown[] = [workspaceId, version, filters.from, filters.to];
  let where =
    "workspace_id=$1 AND dataset_version=$2 AND occurred_at >= $3::date AND occurred_at <= $4::date";
  if (filters.region) {
    values.push(filters.region);
    where += ` AND region=$${values.length}`;
  }
  if (filters.plan) {
    values.push(filters.plan);
    where += ` AND plan=$${values.length}`;
  }
  const group =
    raw.groupBy === "month"
      ? `to_char(occurred_at,'YYYY-MM')`
      : raw.groupBy === "customer"
        ? "customer_id"
        : raw.groupBy;
  const snapshot = ["mrr", "customers", "retention", "nrr", "grr"].includes(
    metric,
  );
  let sql: string;
  if (metric === "risk") {
    sql = `SELECT ${group ? "dimension," : ""}sum(CASE WHEN revenue>0 AND cost/revenue>0.35 THEN 1 ELSE 0 END) AS value FROM (SELECT date_trunc('month',occurred_at) AS bucket,${group ? `${group} AS dimension,` : ""}sum(CASE WHEN event_type='invoice' THEN amount_cents ELSE 0 END)/100.0 AS revenue,sum(CASE WHEN event_type='infrastructure' THEN cost_cents ELSE 0 END)/100.0 AS cost FROM fact_events WHERE ${where} GROUP BY date_trunc('month',occurred_at)${group ? `,${group}` : ""}) AS monthly${group ? " GROUP BY dimension ORDER BY dimension" : ""} LIMIT ${limit}`;
  } else if (snapshot) {
    // Return typed snapshots and calculate cohort-safe ratios from original customer grains.
    sql = `SELECT to_char(occurred_at,'YYYY-MM') AS month,customer_id,plan,region,mrr_cents FROM fact_events WHERE ${where} AND event_type='subscription' ORDER BY occurred_at,customer_id LIMIT 100000`;
  } else {
    const expression =
      metric === "revenue"
        ? `sum(CASE WHEN event_type='invoice' THEN amount_cents ELSE 0 END)/100.0`
        : metric === "cost"
          ? `sum(CASE WHEN event_type='infrastructure' THEN cost_cents ELSE 0 END)/100.0`
          : metric === "usage"
            ? `sum(CASE WHEN event_type='usage' THEN quantity ELSE 0 END)`
            : `100.0*(sum(CASE WHEN event_type='invoice' THEN amount_cents ELSE 0 END)-sum(CASE WHEN event_type='infrastructure' THEN cost_cents ELSE 0 END))/nullif(sum(CASE WHEN event_type='invoice' THEN amount_cents ELSE 0 END),0)`;
    sql = `SELECT ${group ? `${group} AS dimension,` : ""} ${expression} AS value FROM fact_events WHERE ${where}${group ? ` GROUP BY ${group} ORDER BY ${group}` : ""} LIMIT ${limit}`;
  }
  validateCompiledQuery(sql);
  return {
    sql,
    values,
    metric,
    filters,
    groupBy: raw.groupBy,
    limit,
    snapshot,
  };
}
