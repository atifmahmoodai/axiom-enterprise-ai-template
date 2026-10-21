import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBusinessCase,
  calculateROI,
  exportROIAsCSV,
  defaultROIAssumptions,
  normalizeROIInputs,
  roiLimits,
} from "../lib/roi";

test("uses disclosed monthly rates and twelve identical months for annual estimates", () => {
  const result = calculateROI({ dataVolumeGb: 10_000, agents: 40 });
  assert.equal(result.traditional.total, 4240);
  assert.equal(result.platform.total, 2010);
  assert.equal(result.monthlySavings, 2230);
  assert.equal(result.annualSavings, 26760);
  assert.ok(Math.abs(result.savingsPercent! - 52.594339622641506) < 0.000001);
});

test("preserves negative savings when the proposed platform costs more", () => {
  const result = calculateROI(
    { dataVolumeGb: 0, agents: 0 },
    { ...defaultROIAssumptions, traditionalBase: 100, platformBase: 200 },
  );
  assert.equal(result.monthlySavings, -100);
  assert.equal(result.annualSavings, -1200);
  assert.equal(result.savingsPercent, -100);
});

test("handles zero baseline without producing an infinite percentage", () => {
  const result = calculateROI(
    { dataVolumeGb: 0, agents: 0 },
    { ...defaultROIAssumptions, traditionalBase: 0, platformBase: 0 },
  );
  assert.equal(result.monthlySavings, 0);
  assert.equal(result.savingsPercent, null);
});

test("bounds volumes and agent counts, rejects nonfinite values and rounds whole units", () => {
  assert.deepEqual(
    normalizeROIInputs({ dataVolumeGb: -10, agents: Infinity }),
    { dataVolumeGb: 0, agents: 0 },
  );
  assert.deepEqual(
    normalizeROIInputs({ dataVolumeGb: 2_000_000, agents: 20_000 }),
    { dataVolumeGb: roiLimits.dataVolumeGb, agents: roiLimits.agents },
  );
  assert.deepEqual(normalizeROIInputs({ dataVolumeGb: 10.4, agents: 4.8 }), {
    dataVolumeGb: 10,
    agents: 5,
  });
  assert.ok(
    Number.isFinite(
      calculateROI({ dataVolumeGb: NaN, agents: Infinity }).annualSavings,
    ),
  );
});

test("rounds cost categories to cents before aggregation", () => {
  const result = calculateROI(
    { dataVolumeGb: 1, agents: 1 },
    {
      traditionalBase: 0.1,
      traditionalPerGb: 0.2,
      traditionalPerAgent: 0.3,
      platformBase: 0.1,
      platformPerGb: 0.065,
      platformPerAgent: 0.3,
    },
  );
  assert.equal(result.traditional.total, 0.6);
  assert.equal(result.platform.total, 0.47);
  assert.equal(result.monthlySavings, 0.13);
  assert.equal(result.annualSavings, 1.56);
});

test("normalizes invalid rates to safe finite values", () => {
  const result = calculateROI(
    { dataVolumeGb: 10_000, agents: 40 },
    {
      ...defaultROIAssumptions,
      traditionalBase: NaN,
      platformBase: -100,
      platformPerGb: Infinity,
      platformPerAgent: 2_000_000,
    },
  );
  assert.equal(
    result.assumptions.traditionalBase,
    defaultROIAssumptions.traditionalBase,
  );
  assert.equal(result.assumptions.platformBase, 0);
  assert.equal(
    result.assumptions.platformPerGb,
    defaultROIAssumptions.platformPerGb,
  );
  assert.equal(result.assumptions.platformPerAgent, roiLimits.rate);
  assert.ok(Number.isFinite(result.annualSavings));
});

test("migration payback rounds up and does not conceal an unrecoverable investment", () => {
  const result = calculateROI({ dataVolumeGb: 10_000, agents: 40 });
  const businessCase = calculateBusinessCase(result, 6000);
  assert.equal(businessCase.paybackMonths, 3);
  assert.equal(businessCase.netFirstYearSavings, 20760);
  const expensive = calculateROI(
    { dataVolumeGb: 0, agents: 0 },
    { ...defaultROIAssumptions, traditionalBase: 0, platformBase: 100 },
  );
  assert.equal(calculateBusinessCase(expensive, 100).paybackMonths, null);
  assert.equal(
    calculateBusinessCase(expensive, 100).netFirstYearSavings,
    -1300,
  );
});

test("CSV export includes assumptions and migration cost needed to reproduce a scenario", () => {
  const csv = exportROIAsCSV(
    calculateROI({ dataVolumeGb: 10_000, agents: 40 }),
    6000,
  );
  assert.match(csv, /10000/);
  assert.match(csv, /6000/);
  assert.match(csv, /26760/);
  assert.match(csv, /0\.065/);
});
