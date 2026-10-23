import type { MetricDefinition } from "./contracts";

export const METRIC_VERSION = "axiom-metrics/2.0.0";
export const metricDefinitions: MetricDefinition[] = [
  {
    id: "risk",
    name: "Cost-threshold risk months",
    description:
      "Count of observed months where attributed infrastructure cost exceeds 35% of billed revenue. This transparent indicator is not a prediction of loss or fraud.",
    unit: "count",
    formula:
      "COUNT(months WHERE infrastructure cost / billed revenue > 0.35 AND revenue > 0)",
    owner: "Operations",
    version: METRIC_VERSION,
    source: "fact_events.invoice + fact_events.infrastructure",
  },
  {
    id: "revenue",
    name: "Billed revenue",
    description:
      "Invoice charges less credits, excluding tax. This is billed revenue, not GAAP-recognized revenue.",
    unit: "USD",
    formula: "SUM(invoice.amount_cents) / 100",
    owner: "Finance",
    version: METRIC_VERSION,
    source: "fact_events.invoice",
  },
  {
    id: "cost",
    name: "Infrastructure spend",
    description:
      "Attributed infrastructure costs, including an explicitly identified unallocated cost bucket.",
    unit: "USD",
    formula: "SUM(infrastructure.cost_cents) / 100",
    owner: "Infrastructure",
    version: METRIC_VERSION,
    source: "fact_events.infrastructure",
  },
  {
    id: "mrr",
    name: "Monthly recurring revenue",
    description:
      "Recurring contract value at the last available month-end snapshot in the selected period. One-time fees are excluded.",
    unit: "USD",
    formula: "SUM(month-end subscription.mrr_cents) / 100",
    owner: "Finance",
    version: METRIC_VERSION,
    source: "fact_events.subscription",
  },
  {
    id: "customers",
    name: "Active customers",
    description:
      "Customers with positive MRR in the last available month-end snapshot.",
    unit: "count",
    formula: "COUNT(DISTINCT customer_id WHERE month-end mrr_cents > 0)",
    owner: "Customer success",
    version: METRIC_VERSION,
    source: "fact_events.subscription",
  },
  {
    id: "usage",
    name: "Processed tokens",
    description:
      "Total billed or unbilled token usage events, in tokens. Usage is not inferred from invoice value.",
    unit: "count",
    formula: "SUM(usage.quantity)",
    owner: "Infrastructure",
    version: METRIC_VERSION,
    source: "fact_events.usage",
  },
  {
    id: "margin",
    name: "Infrastructure-adjusted margin",
    description:
      "Billed revenue minus infrastructure spend as a percentage of billed revenue. Other costs of goods sold are not represented.",
    unit: "percent",
    formula: "100 × (billed revenue − infrastructure cost) / billed revenue",
    owner: "Finance",
    version: METRIC_VERSION,
    source: "fact_events.invoice + fact_events.infrastructure",
  },
  {
    id: "retention",
    name: "Logo retention",
    description:
      "Starting-cohort customers still active at period end, excluding newly acquired customers. Segment membership is determined at the opening snapshot.",
    unit: "percent",
    formula: "100 × retained starting customers / starting customers",
    owner: "Customer success",
    version: METRIC_VERSION,
    source: "fact_events.subscription",
  },
  {
    id: "nrr",
    name: "Net revenue retention",
    description:
      "Ending MRR of the starting customer cohort divided by opening MRR. New customers are excluded; expansion and contraction are included.",
    unit: "percent",
    formula: "100 × ending MRR of opening cohort / opening MRR",
    owner: "Finance",
    version: METRIC_VERSION,
    source: "fact_events.subscription",
  },
  {
    id: "grr",
    name: "Gross revenue retention",
    description:
      "Ending MRR of the starting cohort capped at each customer’s opening MRR. New customers and expansion are excluded.",
    unit: "percent",
    formula: "100 × SUM(MIN(opening MRR, ending MRR)) / SUM(opening MRR)",
    owner: "Finance",
    version: METRIC_VERSION,
    source: "fact_events.subscription",
  },
];

const aliases: Record<string, string> = {
  billed_revenue: "revenue",
  infrastructure_spend: "cost",
  active_customers: "customers",
  tokens: "usage",
  logo_retention: "retention",
  net_revenue_retention: "nrr",
  gross_revenue_retention: "grr",
  infrastructure_adjusted_margin: "margin",
};
export function canonicalMetric(id: string): string {
  return aliases[id] ?? id;
}
export function metricDefinition(id: string): MetricDefinition | undefined {
  return metricDefinitions.find((metric) => metric.id === canonicalMetric(id));
}
export function percentage(
  numerator: number,
  denominator: number,
): number | null {
  return denominator === 0 ? null : (numerator / denominator) * 100;
}
export function relativeChange(
  value: number | null,
  previous: number | null,
): number | null {
  return value === null || previous === null || previous === 0
    ? null
    : ((value - previous) / Math.abs(previous)) * 100;
}
export function cohortMetrics(
  opening: Record<string, number>,
  closing: Record<string, number>,
) {
  const cohort = Object.entries(opening).filter(([, value]) => value > 0);
  const start = cohort.reduce((sum, [, value]) => sum + value, 0);
  return {
    retention: percentage(
      cohort.filter(([id]) => (closing[id] ?? 0) > 0).length,
      cohort.length,
    ),
    nrr: percentage(
      cohort.reduce((sum, [id]) => sum + Math.max(0, closing[id] ?? 0), 0),
      start,
    ),
    grr: percentage(
      cohort.reduce(
        (sum, [id, value]) =>
          sum + Math.min(value, Math.max(0, closing[id] ?? 0)),
        0,
      ),
      start,
    ),
  };
}
