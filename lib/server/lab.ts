import type {
  Filters,
  LabResult,
  WorkspaceContext,
} from "@/lib/intelligence/contracts";
import { normalizeFilters } from "@/lib/intelligence/query";
import { getOverview } from "./analytics";
import { AppError, workspaceQuery } from "./db";
import { runPython } from "./storage";
export async function runLab(
  ctx: WorkspaceContext,
  kind: string,
  input: Filters = {},
  options: Record<string, unknown> = {},
): Promise<LabResult> {
  if (
    ![
      "forecast",
      "anomalies",
      "cohorts",
      "comparison",
      "segments",
      "scenario",
      "funnel",
    ].includes(kind)
  )
    throw new AppError(422, "invalid_analysis", "Choose a supported analysis.");
  const overview = await getOverview(ctx, input);
  const filters = normalizeFilters(overview.provenance.filters);
  const payload: Record<string, unknown> = {
    kind,
    series: overview.series,
    segments: overview.segments,
    options,
  };
  const values = [
    ctx.workspaceId,
    overview.provenance.datasetVersion,
    filters.from,
    filters.to,
    filters.region ?? null,
    filters.plan ?? null,
  ];
  const where =
    "workspace_id=$1 AND dataset_version=$2 AND occurred_at BETWEEN $3::date AND $4::date AND ($5::text IS NULL OR region=$5) AND ($6::text IS NULL OR plan=$6)";
  if (kind === "cohorts")
    payload.snapshots = await workspaceQuery(
      ctx,
      `SELECT to_char(occurred_at,'YYYY-MM') AS month,customer_id,mrr_cents/100.0 AS mrr FROM fact_events WHERE ${where} AND event_type='subscription' ORDER BY occurred_at,customer_id`,
      values,
    );
  if (kind === "comparison")
    payload.customers = (
      await workspaceQuery(
        ctx,
        `SELECT customer_id,region,sum(amount_cents)/100.0 AS revenue FROM fact_events WHERE ${where} AND event_type='invoice' GROUP BY customer_id,region`,
        values,
      )
    ).map((r) => ({ ...r, revenue: Number(r.revenue) }));
  if (kind === "funnel") {
    const facts = await workspaceQuery(
      ctx,
      `SELECT customer_id,event_type,occurred_at::text AS day,quantity,amount_cents FROM fact_events WHERE ${where} AND customer_id<>'unallocated' ORDER BY customer_id,occurred_at`,
      values,
    );
    const customers = new Map<string, typeof facts>();
    for (const r of facts) {
      const bucket = customers.get(r.customer_id) || [];
      bucket.push(r);
      customers.set(r.customer_id, bucket);
    }
    let activated = 0,
      paid = 0;
    for (const rows of customers.values()) {
      const first = rows[0].day;
      const usage = rows.find(
        (r) =>
          r.event_type === "usage" &&
          Number(r.quantity) > 0 &&
          Date.parse(r.day) - Date.parse(first) <= 90 * 86400000,
      );
      if (usage) {
        activated++;
        if (
          rows.some(
            (r) =>
              r.event_type === "invoice" &&
              Number(r.amount_cents) > 0 &&
              r.day >= usage.day &&
              Date.parse(r.day) - Date.parse(first) <= 90 * 86400000,
          )
        )
          paid++;
      }
    }
    payload.funnel = [
      { stage: "Observed customers", customers: customers.size },
      { stage: "Positive usage within 90 days", customers: activated },
      { stage: "Later paid invoice within 90 days", customers: paid },
    ];
  }
  const result = await runPython<Omit<LabResult, "provenance">>("lab", payload);
  return { ...result, provenance: overview.provenance };
}
