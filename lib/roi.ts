/** Illustrative monthly costs in USD. Replace these with your own validated rates. */
export const defaultROIAssumptions: ROIAssumptions = {
  traditionalBase: 1200,
  traditionalPerGb: 0.16,
  traditionalPerAgent: 36,
  platformBase: 800,
  platformPerGb: 0.065,
  platformPerAgent: 14,
};

export interface ROIInputs {
  dataVolumeGb: number;
  agents: number;
}

export interface ROIAssumptions {
  traditionalBase: number;
  traditionalPerGb: number;
  traditionalPerAgent: number;
  platformBase: number;
  platformPerGb: number;
  platformPerAgent: number;
}

export const roiLimits = {
  dataVolumeGb: 1_000_000,
  agents: 10_000,
  rate: 1_000_000,
  migrationCost: 100_000_000,
};

export const roiWorkloads = [
  {
    id: "pilot",
    label: "Pilot",
    description: "Validate your first agents",
    dataVolumeGb: 2_000,
    agents: 8,
  },
  {
    id: "production",
    label: "Production",
    description: "Operate a growing AI platform",
    dataVolumeGb: 10_000,
    agents: 40,
  },
  {
    id: "enterprise",
    label: "Enterprise",
    description: "Scale an intelligence network",
    dataVolumeGb: 100_000,
    agents: 250,
  },
] as const;

export function clampFinite(
  value: number,
  min: number,
  max: number,
  fallback = min,
): number {
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function normalizeROIInputs(inputs: ROIInputs): ROIInputs {
  return {
    dataVolumeGb: Math.round(
      clampFinite(inputs.dataVolumeGb, 0, roiLimits.dataVolumeGb),
    ),
    agents: Math.round(clampFinite(inputs.agents, 0, roiLimits.agents)),
  };
}

export function normalizeROIAssumptions(
  assumptions: ROIAssumptions,
): ROIAssumptions {
  return Object.fromEntries(
    Object.entries(defaultROIAssumptions).map(([key, fallback]) => [
      key,
      clampFinite(
        assumptions[key as keyof ROIAssumptions],
        0,
        roiLimits.rate,
        fallback,
      ),
    ]),
  ) as unknown as ROIAssumptions;
}

/**
 * Round each monthly cost category to cents, then add integer cents. Annual
 * estimates are twelve identical months; discounts, taxes and growth are excluded.
 * Savings remain signed, and savings percentage is undefined for a zero baseline.
 */
export function calculateROI(
  inputs: ROIInputs,
  assumptions = defaultROIAssumptions,
) {
  const normalized = normalizeROIInputs(inputs);
  const rates = normalizeROIAssumptions(assumptions);
  const costs = (base: number, perGb: number, perAgent: number) => {
    const baseCents = Math.round(base * 100);
    const dataCents = Math.round(normalized.dataVolumeGb * perGb * 100);
    const agentCents = Math.round(normalized.agents * perAgent * 100);
    return {
      base: baseCents / 100,
      data: dataCents / 100,
      agents: agentCents / 100,
      totalCents: baseCents + dataCents + agentCents,
      total: (baseCents + dataCents + agentCents) / 100,
    };
  };
  const traditional = costs(
    rates.traditionalBase,
    rates.traditionalPerGb,
    rates.traditionalPerAgent,
  );
  const platform = costs(
    rates.platformBase,
    rates.platformPerGb,
    rates.platformPerAgent,
  );
  const savingsCents = traditional.totalCents - platform.totalCents;
  return {
    inputs: normalized,
    assumptions: rates,
    traditional,
    platform,
    monthlySavings: savingsCents / 100,
    annualSavings: (savingsCents * 12) / 100,
    savingsPercent:
      traditional.totalCents === 0
        ? null
        : (savingsCents / traditional.totalCents) * 100,
  };
}

export type ROIResult = ReturnType<typeof calculateROI>;

/** One-time investment is recovered only through positive monthly savings. */
export function calculateBusinessCase(
  result: ROIResult,
  migrationCost: number,
) {
  const investment =
    Math.round(clampFinite(migrationCost, 0, roiLimits.migrationCost) * 100) /
    100;
  return {
    migrationCost: investment,
    netFirstYearSavings:
      Math.round((result.annualSavings - investment) * 100) / 100,
    paybackMonths:
      result.monthlySavings > 0
        ? Math.ceil(investment / result.monthlySavings)
        : investment === 0 && result.monthlySavings === 0
          ? 0
          : null,
  };
}

/** Self-contained export includes every input needed to reproduce the estimate. */
export function exportROIAsCSV(result: ROIResult, migrationCost: number) {
  const businessCase = calculateBusinessCase(result, migrationCost);
  const rows: (string | number)[][] = [
    ["Axiom infrastructure scenario", "Value", "Unit"],
    ["Monthly data processed", result.inputs.dataVolumeGb, "GB"],
    ["Active agents", result.inputs.agents, "agents"],
    ["Current fixed cost", result.assumptions.traditionalBase, "USD/month"],
    ["Current data cost", result.assumptions.traditionalPerGb, "USD/GB"],
    [
      "Current agent cost",
      result.assumptions.traditionalPerAgent,
      "USD/agent/month",
    ],
    ["Axiom fixed cost", result.assumptions.platformBase, "USD/month"],
    ["Axiom data cost", result.assumptions.platformPerGb, "USD/GB"],
    [
      "Axiom agent cost",
      result.assumptions.platformPerAgent,
      "USD/agent/month",
    ],
    ["Current monthly total", result.traditional.total, "USD"],
    ["Axiom monthly total", result.platform.total, "USD"],
    ["Monthly savings", result.monthlySavings, "USD"],
    ["Annual operating savings", result.annualSavings, "USD"],
    ["One-time migration cost", businessCase.migrationCost, "USD"],
    ["Net first-year savings", businessCase.netFirstYearSavings, "USD"],
    ["Payback", businessCase.paybackMonths ?? "Not reached", "months"],
    [
      "Assumptions",
      "12 identical months; excludes tax, staffing, model fees, growth and discounts; illustrative rates; not a quote",
      "",
    ],
  ];
  return rows
    .map((row) =>
      row
        .map((value) =>
          typeof value === "number"
            ? String(value)
            : `"${value.replaceAll('"', '""')}"`,
        )
        .join(","),
    )
    .join("\r\n");
}
