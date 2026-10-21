"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Cpu,
  Download,
  GitCompareArrows,
  Globe2,
  Layers3,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { LeadDialog } from "@/components/lead-dialog";
import {
  calculateBusinessCase,
  calculateROI,
  clampFinite,
  defaultROIAssumptions,
  exportROIAsCSV,
  roiLimits,
  roiWorkloads,
  type ROIAssumptions,
  type ROIResult,
} from "@/lib/roi";
import "./pricing.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const preciseCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integer = new Intl.NumberFormat("en-US");

function downloadLocalFile(contents: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const plans = [
  {
    name: "Launch",
    tagline: "From first idea to first deployment.",
    monthly: 250,
    annual: 200,
    icon: Layers3,
    features: [
      "5 active agents",
      "1M tokens / month",
      "Shared compute infrastructure",
      "7-day observability retention",
      "Community support",
    ],
    cta: "Start building",
  },
  {
    name: "Scale",
    tagline: "For the systems you can’t switch off.",
    monthly: 800,
    annual: 640,
    icon: Cpu,
    features: [
      "50 active agents",
      "10M tokens / month",
      "Autoscaling dedicated compute",
      "30-day observability retention",
      "Priority developer support",
    ],
    cta: "Choose Scale",
  },
  {
    name: "Enterprise",
    tagline: "Your ambition. Your architecture.",
    monthly: null,
    annual: null,
    icon: ShieldCheck,
    features: [
      "Custom agent & token capacity",
      "Private cloud or on-prem deployment",
      "SSO, SCIM & role-based access",
      "Custom retention & audit exports",
      "Dedicated solutions architect",
    ],
    cta: "Design your deployment",
  },
];

const comparison = [
  ["Active agents", "5", "50", "Custom"],
  ["Included tokens / month", "1 million", "10 million", "Custom"],
  ["Deployment", "Shared cloud", "Dedicated compute", "Private / on-prem"],
  ["Data retention", "7 days", "30 days", "Custom"],
  ["Role-based access", "Basic roles", "Granular roles", "Custom policies"],
  ["SSO & SCIM", "—", "—", "Included"],
  ["Service agreement", "Standard terms", "Standard terms", "Custom SLA"],
  ["Support", "Community", "Priority", "Dedicated architect"],
];

function SLADialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [region, setRegion] = useState("United States");
  const [availability, setAvailability] = useState("99.95");
  const [response, setResponse] = useState("30 minutes");
  const [exported, setExported] = useState(false);
  const downtime = ((1 - Number(availability) / 100) * 30 * 24 * 60).toFixed(2);
  function exportRequirements() {
    downloadLocalFile(
      JSON.stringify(
        {
          mode: "illustrative-requirements",
          dataResidency: region,
          availabilityTarget: `${availability}%`,
          severityOneResponse: response,
          thirtyDayDowntimeBudgetMinutes: Number(downtime),
          disclaimer:
            "Planning requirements only. No service agreement is created.",
        },
        null,
        2,
      ),
      "axiom-sla-requirements.json",
      "application/json",
    );
    setExported(true);
  }
  return (
    <>
      <button
        type="button"
        className="pricing-text-button"
        onClick={() => dialog.current?.showModal()}
      >
        Explore enterprise SLAs <ArrowUpRight size={14} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        className="pricing-sla-dialog"
        aria-labelledby="sla-title"
        onClose={() => setExported(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="pricing-sla-inner">
          <button
            type="button"
            className="pricing-dialog-close"
            aria-label="Close SLA overview"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <span className="eyebrow">Enterprise assurance</span>
          <h2 id="sla-title">Define your operating standard.</h2>
          <p>
            Shape a deployment brief with the availability, residency, and
            response targets your team needs.
          </p>
          <div className="sla-configurator">
            <label htmlFor="sla-region">
              <span>
                <Globe2 size={14} aria-hidden="true" /> Data residency
              </span>
              <select
                id="sla-region"
                value={region}
                onChange={(event) => {
                  setRegion(event.target.value);
                  setExported(false);
                }}
              >
                <option>United States</option>
                <option>European Union</option>
                <option>United Kingdom</option>
                <option>Asia Pacific</option>
                <option>Private environment</option>
              </select>
            </label>
            <div className="sla-select-row">
              <label htmlFor="sla-availability">
                <span>Availability target</span>
                <select
                  id="sla-availability"
                  value={availability}
                  onChange={(event) => {
                    setAvailability(event.target.value);
                    setExported(false);
                  }}
                >
                  <option value="99.9">99.9%</option>
                  <option value="99.95">99.95%</option>
                  <option value="99.99">99.99%</option>
                </select>
              </label>
              <label htmlFor="sla-response">
                <span>Severity 1 response</span>
                <select
                  id="sla-response"
                  value={response}
                  onChange={(event) => {
                    setResponse(event.target.value);
                    setExported(false);
                  }}
                >
                  <option>15 minutes</option>
                  <option>30 minutes</option>
                  <option>1 hour</option>
                </select>
              </label>
            </div>
            <div className="sla-budget" aria-live="polite">
              <span>30-day downtime budget</span>
              <strong>
                {downtime}
                <small>minutes</small>
              </strong>
              <span>At your selected availability target</span>
            </div>
          </div>
          <dl className="pricing-sla-terms">
            <div>
              <dt>Solution design review</dt>
              <dd>
                Validate regional availability, subprocessors, coverage hours,
                and severity definitions with your team.
              </dd>
            </div>
            <div>
              <dt>Service credits & exclusions</dt>
              <dd>
                Define the measurement window, exclusions, credits, and remedies
                in the final agreement.
              </dd>
            </div>
          </dl>
          <p className="pricing-demo-note">
            Template preview. These are discussion points, not contractual
            commitments or a claim of certification.
          </p>
          <button
            type="button"
            className="button button-primary sla-export"
            onClick={exportRequirements}
          >
            <Download size={15} aria-hidden="true" /> Download requirements
          </button>
          <p className="sla-export-status" role="status">
            {exported
              ? "Requirements exported. No agreement has been created."
              : "Download a local JSON brief to share with your team."}
          </p>
        </div>
      </dialog>
    </>
  );
}

function VolumeControl({
  id,
  label,
  value,
  max,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="roi-control">
      <div className="roi-control-heading">
        <label htmlFor={`${id}-number`}>{label}</label>
        <div className="roi-number-wrap">
          <input
            id={`${id}-number`}
            type="number"
            min={0}
            max={max}
            step={1}
            value={value}
            onChange={(event) =>
              onChange(
                Math.round(
                  clampFinite(event.currentTarget.valueAsNumber, 0, max),
                ),
              )
            }
          />
          <span>{unit}</span>
        </div>
      </div>
      <input
        className="roi-range"
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        aria-label={label}
        aria-valuetext={`${integer.format(value)} ${unit}`}
        style={
          { "--range-fill": `${(value / max) * 100}%` } as React.CSSProperties
        }
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="roi-range-labels" aria-hidden="true">
        <span>0 {unit}</span>
        <span>
          {integer.format(max)} {unit}
        </span>
      </div>
    </div>
  );
}

const assumptionFields: {
  key: keyof ROIAssumptions;
  label: string;
  step: string;
}[] = [
  { key: "traditionalBase", label: "Current fixed cost / month", step: "1" },
  { key: "platformBase", label: "Axiom fixed cost / month", step: "1" },
  { key: "traditionalPerGb", label: "Current cost / GB", step: "0.001" },
  { key: "platformPerGb", label: "Axiom cost / GB", step: "0.001" },
  { key: "traditionalPerAgent", label: "Current cost / agent", step: "1" },
  { key: "platformPerAgent", label: "Axiom cost / agent", step: "1" },
];

export function ROICalculator() {
  const [dataVolumeGb, setDataVolumeGb] = useState(10_000);
  const [agents, setAgents] = useState(40);
  const [assumptions, setAssumptions] = useState<ROIAssumptions>({
    ...defaultROIAssumptions,
  });
  const [migrationCost, setMigrationCost] = useState(6_000);
  const [baseline, setBaseline] = useState<{
    result: ROIResult;
    migrationCost: number;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const result = useMemo(
    () => calculateROI({ dataVolumeGb, agents }, assumptions),
    [dataVolumeGb, agents, assumptions],
  );
  const businessCase = calculateBusinessCase(result, migrationCost);
  const activeWorkload = roiWorkloads.find(
    (workload) =>
      workload.dataVolumeGb === dataVolumeGb && workload.agents === agents,
  );
  const baselineSavings = baseline
    ? calculateBusinessCase(baseline.result, baseline.migrationCost)
        .netFirstYearSavings
    : null;
  const comparisonDelta =
    baselineSavings === null
      ? 0
      : businessCase.netFirstYearSavings - baselineSavings;
  function restoreBaseline() {
    if (!baseline) return;
    setDataVolumeGb(baseline.result.inputs.dataVolumeGb);
    setAgents(baseline.result.inputs.agents);
    setAssumptions({ ...baseline.result.assumptions });
    setMigrationCost(baseline.migrationCost);
    setAnnouncement(
      "Saved baseline restored, including workload, rates, and migration investment.",
    );
  }
  const maxCost = Math.max(result.traditional.total, result.platform.total, 1);
  const positive = result.monthlySavings >= 0;
  const barParts = (costs: typeof result.traditional) => (
    <>
      <span
        className="roi-segment-fixed"
        style={{ width: `${(costs.base / maxCost) * 100}%` }}
      />
      <span
        className="roi-segment-data"
        style={{ width: `${(costs.data / maxCost) * 100}%` }}
      />
      <span
        className="roi-segment-agents"
        style={{ width: `${(costs.agents / maxCost) * 100}%` }}
      />
    </>
  );
  return (
    <section className="roi-section" id="roi" aria-labelledby="roi-heading">
      <div className="pricing-section-heading">
        <div>
          <span className="eyebrow">THE ECONOMICS OF INTELLIGENCE</span>
          <h2 id="roi-heading">
            More intelligence.
            <br />
            <span>Less infrastructure overhead.</span>
          </h2>
        </div>
        <p>
          Build your own business case.
          <br />
          Real arithmetic. Transparent assumptions.
        </p>
      </div>
      <div className="roi-layout panel">
        <div className="roi-inputs">
          <div className="roi-label">
            <span className="pricing-step-number">01</span>Model your workload
          </div>
          <div
            className="roi-presets"
            role="group"
            aria-label="Sample workload scenarios"
          >
            {roiWorkloads.map((workload) => (
              <button
                type="button"
                key={workload.id}
                aria-pressed={activeWorkload?.id === workload.id}
                title={workload.description}
                onClick={() => {
                  setDataVolumeGb(workload.dataVolumeGb);
                  setAgents(workload.agents);
                  setAnnouncement(
                    `${workload.label} workload applied. Your cost assumptions are unchanged.`,
                  );
                }}
              >
                {workload.label}
              </button>
            ))}
          </div>
          <div className="roi-scenario-caption">
            <span className="pricing-live-dot" />
            {activeWorkload
              ? `${activeWorkload.label} workload`
              : "Custom workload"}
            <span>EDITABLE SCENARIO</span>
          </div>
          <VolumeControl
            id="roi-volume"
            label="Monthly data processed"
            value={dataVolumeGb}
            max={roiLimits.dataVolumeGb}
            unit="GB"
            onChange={setDataVolumeGb}
          />
          <VolumeControl
            id="roi-agents"
            label="Active agents"
            value={agents}
            max={roiLimits.agents}
            unit="agents"
            onChange={setAgents}
          />
          <label className="roi-investment" htmlFor="roi-migration">
            <span>
              One-time migration investment
              <small>Included in first-year return and payback</small>
            </span>
            <div className="roi-rate-field">
              <span aria-hidden="true">$</span>
              <input
                id="roi-migration"
                type="number"
                min={0}
                max={roiLimits.migrationCost}
                step={100}
                value={migrationCost}
                onChange={(event) =>
                  setMigrationCost(
                    clampFinite(
                      event.currentTarget.valueAsNumber,
                      0,
                      roiLimits.migrationCost,
                    ),
                  )
                }
              />
            </div>
          </label>
          <details className="roi-assumptions">
            <summary>
              <span>
                <CircleHelp size={15} aria-hidden="true" />
                View & edit assumptions
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <p>
              Illustrative USD rates. Enter your actual costs for a useful
              comparison. The pricing switch above does not change these inputs.
            </p>
            <div className="roi-assumptions-grid">
              {assumptionFields.map(({ key, label, step }) => (
                <label key={key} htmlFor={`rate-${key}`}>
                  <span>{label}</span>
                  <div className="roi-rate-field">
                    <span aria-hidden="true">$</span>
                    <input
                      id={`rate-${key}`}
                      type="number"
                      min={0}
                      max={roiLimits.rate}
                      step={step}
                      value={assumptions[key]}
                      onChange={(event) => {
                        const value = clampFinite(
                          event.currentTarget.valueAsNumber,
                          0,
                          roiLimits.rate,
                        );
                        setAssumptions((current) => ({
                          ...current,
                          [key]: value,
                        }));
                      }}
                    />
                  </div>
                </label>
              ))}
            </div>
            <button
              className="pricing-text-button"
              type="button"
              onClick={() => setAssumptions({ ...defaultROIAssumptions })}
            >
              Reset sample rates
            </button>
          </details>
          <div className="roi-scenario-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setBaseline({ result, migrationCost });
                setAnnouncement(
                  "Baseline saved for comparison during this session.",
                );
              }}
            >
              <GitCompareArrows size={14} aria-hidden="true" />
              {baseline ? "Update baseline" : "Save baseline"}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                downloadLocalFile(
                  exportROIAsCSV(result, migrationCost),
                  "axiom-roi-scenario.csv",
                  "text/csv;charset=utf-8",
                );
                setAnnouncement(
                  "Scenario CSV exported with all inputs, assumptions, and calculated results.",
                );
              }}
            >
              <Download size={14} aria-hidden="true" />
              Export CSV
            </button>
          </div>
          <p className="roi-input-note">
            <LockKeyhole size={13} aria-hidden="true" /> Calculated locally. A
            saved baseline lasts for this session.
          </p>
          <p className="pricing-sr-only" role="status">
            {announcement}
          </p>
        </div>
        <div
          className={`roi-results ${positive ? "" : "roi-results-negative"}`}
        >
          <div className="roi-label">
            <span className="pricing-step-number">02</span>Your estimated impact
          </div>
          <div className="roi-big-number" aria-live="polite" aria-atomic="true">
            <span>
              Projected annual operating{" "}
              {positive ? "savings" : "additional cost"}
            </span>
            <strong>
              {currency.format(Math.abs(result.annualSavings))}
              <span>/ year</span>
            </strong>
            <div className="roi-savings-pill">
              {positive ? (
                <ArrowDownRight size={15} aria-hidden="true" />
              ) : (
                <ArrowUpRight size={15} aria-hidden="true" />
              )}
              {result.savingsPercent === null
                ? "Percentage unavailable: current cost is $0"
                : `${Math.abs(result.savingsPercent).toFixed(1)}% ${positive ? "lower" : "higher"} monthly cost`}
            </div>
          </div>
          <div
            className="roi-bars"
            role="img"
            aria-label={`Estimated monthly cost: current infrastructure ${preciseCurrency.format(result.traditional.total)}; Axiom ${preciseCurrency.format(result.platform.total)}.`}
          >
            <div className="roi-bar-label">
              <span>Current infrastructure</span>
              <strong>
                {preciseCurrency.format(result.traditional.total)}
                <small> / mo</small>
              </strong>
            </div>
            <div className="roi-bar roi-bar-current">
              {barParts(result.traditional)}
            </div>
            <div className="roi-bar-label">
              <span>
                <span className="roi-axiom-dot" />
                With Axiom
              </span>
              <strong>
                {preciseCurrency.format(result.platform.total)}
                <small> / mo</small>
              </strong>
            </div>
            <div className="roi-bar">{barParts(result.platform)}</div>
          </div>
          <div className="roi-chart-legend">
            <span>
              <i className="roi-segment-fixed" />
              Fixed costs
            </span>
            <span>
              <i className="roi-segment-data" />
              Data
            </span>
            <span>
              <i className="roi-segment-agents" />
              Agents
            </span>
          </div>
          <div className="roi-business-case">
            <div>
              <span>
                Net first-year{" "}
                {businessCase.netFirstYearSavings >= 0
                  ? "savings"
                  : "additional cost"}
              </span>
              <strong
                className={
                  businessCase.netFirstYearSavings < 0
                    ? "roi-negative-value"
                    : ""
                }
              >
                {currency.format(Math.abs(businessCase.netFirstYearSavings))}
              </strong>
              <small>
                After {currency.format(businessCase.migrationCost)} migration
              </small>
            </div>
            <div>
              <span>Investment payback</span>
              <strong>
                {businessCase.paybackMonths === null
                  ? "Not reached"
                  : businessCase.paybackMonths === 0
                    ? "Immediate"
                    : `${integer.format(businessCase.paybackMonths)} mo`}
              </strong>
              <small>
                {businessCase.paybackMonths === null
                  ? "No positive monthly savings"
                  : "At constant monthly savings"}
              </small>
            </div>
          </div>
          {baseline && (
            <div className="roi-baseline-panel">
              <div>
                <span>
                  <GitCompareArrows size={13} aria-hidden="true" /> Versus saved
                  baseline
                </span>
                <button
                  type="button"
                  className="pricing-text-button"
                  onClick={restoreBaseline}
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  Restore
                </button>
              </div>
              <p>
                <strong>{currency.format(Math.abs(comparisonDelta))}</strong>{" "}
                {comparisonDelta === 0
                  ? "change in first-year savings"
                  : `${comparisonDelta > 0 ? "more" : "less"} first-year savings`}
              </p>
              <small>
                Baseline: {integer.format(baseline.result.inputs.dataVolumeGb)}{" "}
                GB · {integer.format(baseline.result.inputs.agents)} agents
              </small>
            </div>
          )}
          <p className="roi-result-note">
            Estimate only. Annual operating figures assume 12 identical months.
            First-year return deducts your migration investment. Excludes taxes,
            staffing, model-provider fees, growth and discounts. No savings are
            guaranteed.
          </p>
        </div>
      </div>
    </section>
  );
}

export function PricingPage() {
  const [annual, setAnnual] = useState(true);
  return (
    <div className="pricing-page page-container">
      <section className="pricing-hero" aria-labelledby="pricing-title">
        <span className="eyebrow">
          <span className="pricing-live-dot" /> BUILT FOR WHAT COMES NEXT
        </span>
        <h1 id="pricing-title">
          Ambitious systems.
          <br />
          <span>Predictable pricing.</span>
        </h1>
        <p>
          From your first agent to a global intelligence network.
          <br className="pricing-desktop-break" /> Infrastructure that grows at
          the speed of your ideas.
        </p>
        <div
          className="pricing-period"
          role="group"
          aria-label="Billing period"
        >
          <button
            type="button"
            aria-pressed={!annual}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={annual}
            onClick={() => setAnnual(true)}
          >
            Annually <span>Save 20%</span>
          </button>
        </div>
        <span className="pricing-preview-caption">
          Illustrative template pricing · USD
        </span>
      </section>

      <section className="pricing-cards" aria-label="Choose your plan">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const price = annual ? plan.annual : plan.monthly;
          const enterprise = plan.name === "Enterprise";
          return (
            <article
              className={`pricing-card ${enterprise ? "pricing-card-enterprise" : ""}`}
              key={plan.name}
            >
              {enterprise && (
                <div className="pricing-enterprise-ribbon">
                  <Sparkles size={12} aria-hidden="true" /> BUILT AROUND YOU
                </div>
              )}
              <div className="pricing-card-heading">
                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  {enterprise
                    ? "MISSION-CRITICAL"
                    : plan.name === "Scale"
                      ? "GROWING TEAMS"
                      : "EARLY BUILDERS"}
                </span>
              </div>
              <h2>{plan.name}</h2>
              <p className="pricing-plan-tagline">{plan.tagline}</p>
              <div className="pricing-price" aria-live="polite">
                <strong>
                  {price === null ? "Let’s talk" : currency.format(price)}
                </strong>
                {price !== null && <span>/ month</span>}
              </div>
              <p className="pricing-billing-note">
                {price === null
                  ? "A tailored plan for your next chapter."
                  : annual
                    ? `${currency.format(price * 12)} billed annually`
                    : "Billed monthly. Change plans anytime."}
              </p>
              <LeadDialog
                triggerLabel={plan.cta}
                intent={`${plan.name} plan${enterprise ? "" : ` · ${annual ? "annual" : "monthly"} billing`}`}
                className={`button ${enterprise ? "button-primary" : "button-secondary"} pricing-plan-cta`}
              />
              <div className="pricing-card-divider" />
              <p className="pricing-included-label">
                {enterprise
                  ? "Everything in Scale, plus"
                  : "Your foundation includes"}
              </p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={15} strokeWidth={1.7} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              {enterprise && <SLADialog />}
            </article>
          );
        })}
      </section>
      <div className="pricing-footnote">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>
          All plans include encrypted transport and workspace access controls in
          the intended production architecture. This preview uses simulated
          data.
        </span>
      </div>

      <ROICalculator />

      <section
        className="pricing-comparison"
        aria-labelledby="comparison-title"
      >
        <div className="pricing-section-heading">
          <div>
            <span className="eyebrow">THE DETAILS MAKE THE DIFFERENCE</span>
            <h2 id="comparison-title">
              Every capability. <span>At a glance.</span>
            </h2>
          </div>
          <p>A clear view of what’s included.</p>
        </div>
        <div
          className="pricing-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Plan comparison table. Scroll horizontally on small screens."
        >
          <table>
            <caption className="pricing-sr-only">
              Illustrative plan feature comparison
            </caption>
            <thead>
              <tr>
                <th scope="col">Platform capabilities</th>
                <th scope="col">Launch</th>
                <th scope="col">Scale</th>
                <th scope="col">
                  Enterprise <span>✦</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map(([feature, ...values]) => (
                <tr
                  key={feature}
                  tabIndex={0}
                  aria-label={`${feature}: Launch ${values[0]}, Scale ${values[1]}, Enterprise ${values[2]}`}
                >
                  <th scope="row">{feature}</th>
                  {values.map((value, index) => (
                    <td key={index}>
                      {value === "—" ? (
                        <span aria-label="Not included">—</span>
                      ) : (
                        value
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pricing-comparison-note">
          Usage beyond included capacity requires a plan change or a custom
          agreement. Exact usage limits and commercial terms must be configured
          before launch.
        </p>
      </section>

      <section className="pricing-faq" aria-labelledby="faq-title">
        <div>
          <span className="eyebrow">A FEW THINGS TO KNOW</span>
          <h2 id="faq-title">
            Good questions.
            <br />
            <span>Clear answers.</span>
          </h2>
          <a className="pricing-text-button" href="#roi">
            Explore your potential ROI{" "}
            <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
        <div className="pricing-faq-list">
          <details>
            <summary>
              What counts as an active agent?
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <p>
              In this template, an active agent is a configured autonomous
              workflow enabled in your workspace during the billing month. Your
              production metering system should define its own exact counting
              rules.
            </p>
          </details>
          <details>
            <summary>
              Can I deploy in my own environment?
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <p>
              The Enterprise plan is designed to support a private cloud or
              on-premises deployment path. Availability, supported providers,
              data residency and implementation scope are agreed during solution
              design.
            </p>
          </details>
          <details>
            <summary>
              How is the ROI estimate calculated?
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <p>
              Each monthly estimate adds a fixed cost, data volume multiplied by
              cost per GB, and agent count multiplied by cost per agent. Annual
              savings equal the monthly difference multiplied by 12. Edit all
              six rates to reflect your infrastructure. Savings may be negative.
            </p>
          </details>
          <details>
            <summary>
              Will choosing a plan charge me?
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <p>
              No. This is a template preview with a local demonstration form. It
              does not process payments, create an account, or send your details
              to a sales team.
            </p>
          </details>
        </div>
      </section>
      <section className="pricing-bottom-cta panel">
        <span className="pricing-bottom-mark" aria-hidden="true">
          ✳
        </span>
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2>Build something extraordinary.</h2>
          <p>
            Bring your most ambitious architecture. We’ll help you shape it.
          </p>
        </div>
        <LeadDialog
          triggerLabel="Talk to an architect"
          intent="Enterprise architecture consultation"
          className="button button-primary"
        />
      </section>
    </div>
  );
}
