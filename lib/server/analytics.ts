import { randomUUID } from "node:crypto";
import type {
  AnalyticalPlan,
  AnalysisResult,
  Filters,
  Overview,
  Provenance,
  WorkspaceContext,
} from "@/lib/intelligence/contracts";
import {
  cohortMetrics,
  metricDefinitions,
  METRIC_VERSION,
  relativeChange,
} from "@/lib/intelligence/metrics";
import { compilePlan, normalizeFilters } from "@/lib/intelligence/query";
import { AppError, workspaceQuery } from "./db";
import { getFactSource, type FactSource } from "./fact-source";

export function getCatalog() {
  return metricDefinitions;
}
export async function provenance(
  ctx: WorkspaceContext,
  filters: Filters,
  query?: string,
  pinnedSource?: FactSource,
): Promise<Provenance> {
  const source = pinnedSource ?? (await getFactSource(ctx));
  if (source.workspaceId !== ctx.workspaceId)
    throw new AppError(
      403,
      "source_denied",
      "The source belongs to another workspace.",
    );
  return {
    datasetVersion: source.version,
    sourceRefreshedAt: source.refreshedAt,
    refreshIntervalHours: source.refreshIntervalHours,
    sourceState: source.stale ? "stale" : "ready",
    metricVersion: METRIC_VERSION,
    sources: [`fact_events · ${source.name}`],
    filters,
    generatedAt: new Date().toISOString(),
    query,
    warnings: [
      source.source === "seeded"
        ? "Reference SaaS data is seeded. Monetary values are USD; timestamps are UTC."
        : `Connected canonical snapshot. Monetary values are USD; dates are UTC; usage is in tokens. Source refreshed ${source.refreshedAt}; expected every ${source.refreshIntervalHours} hours.`,
      ...(source.stale
        ? [
            "Source freshness exceeds its declared refresh interval. Results describe the pinned historical snapshot, not current operations.",
          ]
        : []),
      "Infrastructure-adjusted margin excludes other operating costs.",
      ...((filters.from && filters.from < source.from) ||
      (filters.to && filters.to > source.to)
        ? [
            `Requested interval extends beyond source coverage (${source.from} through ${source.to}). Only observed records are included; absent periods are not zeros.`,
          ]
        : []),
    ],
  };
}
export async function runQuery(
  ctx: WorkspaceContext,
  plan: AnalyticalPlan,
  pinnedSource?: FactSource,
): Promise<AnalysisResult> {
  const start = performance.now();
  if (plan.datasetId) {
    const { queryDataset } = await import("./datasets");
    return queryDataset(ctx, plan);
  }
  const source = pinnedSource ?? (await getFactSource(ctx));
  if (source.workspaceId !== ctx.workspaceId)
    throw new AppError(
      403,
      "source_denied",
      "The source belongs to another workspace.",
    );
  let compiled: ReturnType<typeof compilePlan>;
  try {
    compiled = compilePlan(
      {
        ...plan,
        filters: {
          ...plan.filters,
          from: plan.filters?.from || source.from,
          to: plan.filters?.to || source.to,
        },
      },
      ctx.workspaceId,
      source.version,
    );
  } catch (error) {
    throw new AppError(
      422,
      "invalid_plan",
      error instanceof Error ? error.message : "Invalid analytical plan.",
    );
  }
  const raw = await workspaceQuery(ctx, compiled.sql, compiled.values);
  let rows: Record<string, unknown>[];
  let boundedResult = false;
  if (compiled.snapshot) {
    const snapshots = raw.map((r) => ({
      month: String(r.month),
      customer: String(r.customer_id),
      plan: String(r.plan),
      region: String(r.region),
      mrr: Number(r.mrr_cents),
    }));
    const months = [...new Set(snapshots.map((s) => s.month))].sort();
    const groups =
      compiled.groupBy === "month"
        ? months
        : compiled.groupBy
          ? [
              ...new Set(
                snapshots.map(
                  (s) =>
                    s[
                      compiled.groupBy === "customer"
                        ? "customer"
                        : (compiled.groupBy as "plan" | "region")
                    ],
                ),
              ),
            ].sort()
          : ["Total"];
    boundedResult = groups.length > compiled.limit || raw.length >= 100000;
    rows = groups.slice(0, compiled.limit).map((dimension) => {
      const subset =
        compiled.groupBy === "month"
          ? snapshots.filter((s) => s.month <= dimension)
          : compiled.groupBy
            ? snapshots.filter(
                (s) =>
                  s[
                    compiled.groupBy === "customer"
                      ? "customer"
                      : (compiled.groupBy as "plan" | "region")
                  ] === dimension,
              )
            : snapshots;
      const selectedMonths = [...new Set(subset.map((s) => s.month))].sort();
      const first = selectedMonths[0],
        last = selectedMonths.at(-1);
      const opening = Object.fromEntries(
        subset.filter((s) => s.month === first).map((s) => [s.customer, s.mrr]),
      );
      const closing = Object.fromEntries(
        subset.filter((s) => s.month === last).map((s) => [s.customer, s.mrr]),
      );
      const ratios = cohortMetrics(opening, closing);
      const value =
        compiled.metric === "mrr"
          ? Object.values(closing).reduce((a, b) => a + b, 0) / 100
          : compiled.metric === "customers"
            ? Object.values(closing).filter((v) => v > 0).length
            : ratios[compiled.metric as keyof typeof ratios];
      return {
        ...(compiled.groupBy ? { dimension } : {}),
        value: subset.length ? value : null,
      };
    });
  } else {
    rows = raw.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          key === "value" && value !== null ? Number(value) : value,
        ]),
      ),
    );
    // The SQL limit bounds returned groups. Reaching it does not prove there are
    // additional groups, so disclose possible truncation without inventing a count.
    boundedResult = Boolean(compiled.groupBy) && rows.length >= compiled.limit;
  }
  const p = await provenance(ctx, compiled.filters, compiled.sql, source);
  if (compiled.snapshot)
    p.warnings.push(
      "Retention uses the earliest observed snapshot in the selected period as its opening cohort; earlier history is not assumed.",
    );
  if (boundedResult)
    p.warnings.push(
      compiled.snapshot && raw.length >= 100000
        ? "The 100,000-row snapshot processing limit was reached. Calculations may omit later observations; narrow the requested interval or segment."
        : `The result limit of ${compiled.limit} groups was reached. Additional groups may be omitted; increase the limit or narrow the selection before interpreting totals.`,
    );
  return {
    id: randomUUID(),
    state: rows.some((r) => r.value !== null)
      ? p.warnings.some((w) => w.startsWith("Requested interval")) ||
        boundedResult
        ? "partial"
        : source.stale
          ? "stale"
          : "ready"
      : "unavailable",
    columns: compiled.groupBy ? ["dimension", "value"] : ["value"],
    rows,
    query: compiled.sql,
    provenance: p,
    durationMs: Math.round(performance.now() - start),
  };
}
const overviewCache = new Map<
  string,
  { until: number; value: Promise<Overview> }
>();
export async function getOverview(
  ctx: WorkspaceContext,
  input: Filters = {},
): Promise<Overview> {
  // Revalidate membership before cache access; pin one immutable source for this request.
  const source = await getFactSource(ctx);
  const filters = normalizeFilters({
    ...input,
    from: input.from || source.from,
    to: input.to || source.to,
  });
  const key = JSON.stringify([
    ctx.userId,
    ctx.workspaceId,
    source.hash,
    source.stale,
    filters,
  ]);
  const cached = overviewCache.get(key);
  if (cached && cached.until > Date.now()) return cached.value;
  if (overviewCache.size >= 100)
    overviewCache.delete(overviewCache.keys().next().value!);
  const value = calculateOverview(ctx, filters, source).catch((error) => {
    overviewCache.delete(key);
    throw error;
  });
  overviewCache.set(key, { until: Date.now() + 30000, value });
  return value;
}
async function calculateOverview(
  ctx: WorkspaceContext,
  input: Filters,
  source: FactSource,
): Promise<Overview> {
  const filters = normalizeFilters(input);
  const plans = [
    "revenue",
    "cost",
    "mrr",
    "customers",
    "retention",
    "nrr",
    "margin",
    "usage",
    "risk",
  ];
  const results = await Promise.all(
    plans.map((metric) => runQuery(ctx, { metric, filters }, source)),
  );
  const series = await workspaceQuery(
    ctx,
    `SELECT to_char(occurred_at,'YYYY-MM') AS month, sum(CASE WHEN event_type='invoice' THEN amount_cents ELSE 0 END)/100.0 AS revenue,sum(CASE WHEN event_type='infrastructure' THEN cost_cents ELSE 0 END)/100.0 AS cost,sum(CASE WHEN event_type='subscription' THEN mrr_cents ELSE 0 END)/100.0 AS mrr,count(DISTINCT CASE WHEN event_type='subscription' AND mrr_cents>0 THEN customer_id END) AS customers FROM fact_events WHERE workspace_id=$1 AND dataset_version=$2 AND occurred_at BETWEEN $3::date AND $4::date AND ($5::text IS NULL OR region=$5) AND ($6::text IS NULL OR plan=$6) GROUP BY 1 ORDER BY 1`,
    [
      ctx.workspaceId,
      source.version,
      filters.from,
      filters.to,
      filters.region ?? null,
      filters.plan ?? null,
    ],
  );
  const segments = await workspaceQuery(
    ctx,
    `SELECT region AS name,sum(CASE WHEN event_type='invoice' THEN amount_cents ELSE 0 END)/100.0 AS revenue,count(DISTINCT CASE WHEN event_type='subscription' AND mrr_cents>0 THEN customer_id END) AS customers FROM fact_events WHERE workspace_id=$1 AND dataset_version=$2 AND occurred_at BETWEEN $3::date AND $4::date AND ($5::text IS NULL OR region=$5) AND ($6::text IS NULL OR plan=$6) GROUP BY region ORDER BY revenue DESC`,
    [
      ctx.workspaceId,
      source.version,
      filters.from,
      filters.to,
      filters.region ?? null,
      filters.plan ?? null,
    ],
  );
  const count = await workspaceQuery(
    ctx,
    "SELECT count(*) AS count FROM fact_events WHERE workspace_id=$1 AND dataset_version=$2",
    [ctx.workspaceId, source.version],
  );
  const duration = Date.parse(filters.to) - Date.parse(filters.from) + 86400000;
  const previousFilters = {
    ...filters,
    from: new Date(Date.parse(filters.from) - duration)
      .toISOString()
      .slice(0, 10),
    to: new Date(Date.parse(filters.from) - 86400000)
      .toISOString()
      .slice(0, 10),
  };
  const previous = await Promise.all(
    plans.map((metric) =>
      runQuery(ctx, { metric, filters: previousFilters }, source),
    ),
  );
  return {
    metrics: results.map((r, i) => {
      const value = (r.rows[0]?.value as number | null) ?? null;
      const prior = (previous[i].rows[0]?.value as number | null) ?? null;
      const def = metricDefinitions.find((m) => m.id === plans[i])!;
      return {
        id: plans[i],
        label: def.name,
        value,
        previous: prior,
        change: relativeChange(value, prior),
        unit: def.unit,
        state: value === null ? "unavailable" : r.state,
      };
    }),
    series: series.map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
      cost: Number(r.cost),
      mrr: Number(r.mrr),
      customers: Number(r.customers),
    })),
    segments: segments.map((r) => ({
      name: r.name,
      revenue: Number(r.revenue),
      customers: Number(r.customers),
    })),
    provenance: await provenance(ctx, filters, undefined, source),
    rowCount: Number(count[0]?.count ?? 0),
  };
}
export async function getLineage(ctx: WorkspaceContext) {
  const { listResources } = await import("./db");
  const datasets = await listResources(ctx, "dataset");
  const analyses = await listResources(ctx, "analysis");
  const source = await getFactSource(ctx).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 503) return null;
    throw error;
  });
  const nodes = [
    {
      id: "source",
      label: source?.name ?? "Operational source not configured",
      kind: source ? "source" : "unavailable",
      version: source?.version ?? "unconfigured",
    },
    ...metricDefinitions.map((m) => ({
      id: m.id,
      label: m.name,
      kind: "metric",
      version: m.version,
    })),
    ...datasets.flatMap((d) => [
      {
        id: d.id,
        label: String(d.data.name),
        kind: "dataset",
        version: String(d.data.version),
      },
      ...(d.data.parentDatasetId
        ? [
            {
              id: `transform-${d.id}`,
              label: "Reviewed transformation recipe",
              kind: "transformation",
              version: String(d.data.version),
            },
          ]
        : []),
    ]),
    ...analyses.map((a) => ({
      id: a.id,
      label: String(a.data.name || a.data.question || "Saved analysis"),
      kind: "analysis",
      version: String(
        (a.data.result as AnalysisResult | undefined)?.provenance
          .datasetVersion || "unrecorded",
      ),
    })),
    {
      id: "executive",
      label: "Executive overview",
      kind: "dashboard",
      version: METRIC_VERSION,
    },
  ];
  const versionSource = (a: (typeof analyses)[number]) => {
    const result = a.data.result as AnalysisResult | undefined;
    return String(
      (a.data.datasetId === "reference" ? "source" : a.data.datasetId) ||
        datasets.find(
          (d) => d.data.version === result?.provenance.datasetVersion,
        )?.id ||
        "source",
    );
  };
  const edges = [
    ...metricDefinitions.map((m) => ({ from: "source", to: m.id })),
    ...metricDefinitions.map((m) => ({ from: m.id, to: "executive" })),
    ...datasets.flatMap((d) =>
      d.data.parentDatasetId
        ? [
            { from: String(d.data.parentDatasetId), to: `transform-${d.id}` },
            { from: `transform-${d.id}`, to: d.id },
          ]
        : [],
    ),
    ...analyses.map((a) => ({ from: versionSource(a), to: a.id })),
  ];
  const nodeIds = new Set(nodes.map((node) => node.id));
  // Preserve a missing dependency as an explicit unavailable source. Never
  // relabel a deleted upload as the reference data or return a dangling edge.
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) {
      nodes.push({
        id: edge.from,
        label: "Unavailable dataset reference",
        kind: "unavailable",
        version: "Unresolved; inspect the saved analysis provenance",
      });
      nodeIds.add(edge.from);
    }
  }
  return {
    nodes,
    edges,
    note: "Changing a definition creates a new version. Saved analyses retain their original dataset and metric versions.",
  };
}
