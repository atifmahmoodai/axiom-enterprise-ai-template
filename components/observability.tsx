"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Layers3,
  Radio,
  Search,
  ShieldCheck,
  Timer,
  Zap,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useWorkspace } from "@/components/workspace-provider";
import "./operations.css";

type Range = "24h" | "7d" | "30d";
type TelemetryPoint = {
  label: string;
  requests: number;
  latency: number;
  tokens: number;
};
const ranges: Range[] = ["24h", "7d", "30d"];
const wave = [44, 51, 48, 62, 56, 69, 63, 75, 71, 84, 78, 92];
const modelData = [
  { name: "Reasoning · v4", color: "#9df5ce", drift: 0.018, bias: 0.024 },
  { name: "Embedding · v3", color: "#b4a0ff", drift: 0.034, bias: 0.016 },
  { name: "Classifier · v2", color: "#87b4ff", drift: 0.047, bias: 0.038 },
];
type TraceStatus = "success" | "fallback";
type Trace = {
  id: string;
  service: string;
  task: string;
  model: string;
  status: TraceStatus;
  duration: number;
  input: number;
  output: number;
  region: string;
  route: string;
  time: string;
};
const traceSeeds: Omit<Trace, "id">[] = [
  {
    service: "Research agent",
    task: "Market intelligence synthesis",
    model: "Reasoning · v4",
    status: "success",
    duration: 342,
    input: 8420,
    output: 1286,
    region: "us-east-1",
    route:
      "Primary route selected. Context cache hit reduced input processing by 42%.",
    time: "14:32:18.421",
  },
  {
    service: "Document pipeline",
    task: "Quarterly report ingestion",
    model: "Embedding · v3",
    status: "success",
    duration: 128,
    input: 14200,
    output: 0,
    region: "eu-west-1",
    route:
      "Regional affinity preserved. Document fragments processed in one embedding batch.",
    time: "14:32:17.082",
  },
  {
    service: "Risk evaluator",
    task: "Transaction risk classification",
    model: "Classifier · v2",
    status: "fallback",
    duration: 487,
    input: 2160,
    output: 384,
    region: "us-east-1",
    route:
      "Primary exceeded the 250 ms budget. Secondary route completed; no request was dropped.",
    time: "14:32:16.903",
  },
  {
    service: "Research agent",
    task: "Cross-source entity resolution",
    model: "Reasoning · v4",
    status: "success",
    duration: 284,
    input: 5640,
    output: 912,
    region: "us-east-1",
    route:
      "Primary route selected. Three retrieval results passed the relevance threshold.",
    time: "14:32:15.617",
  },
  {
    service: "Risk evaluator",
    task: "Policy compliance assessment",
    model: "Classifier · v2",
    status: "success",
    duration: 96,
    input: 1840,
    output: 256,
    region: "eu-west-1",
    route:
      "Low-latency classifier selected. All policy gates passed before inference.",
    time: "14:32:14.212",
  },
];
const services = ["Research agent", "Document pipeline", "Risk evaluator"];

function traceCost(trace: Trace) {
  const inputRate = trace.model.startsWith("Embedding")
    ? 0.1
    : trace.model.startsWith("Classifier")
      ? 0.25
      : 2;
  const outputRate = trace.model.startsWith("Classifier") ? 1 : 8;
  return (trace.input * inputRate + trace.output * outputRate) / 1_000_000;
}

function makeTelemetry(range: Range, tenant: string): TelemetryPoint[] {
  const scale = tenant === "helix" ? 0.64 : 1;
  return wave.map((v, i) => ({
    label:
      range === "24h"
        ? `${String(i * 2).padStart(2, "0")}:00`
        : range === "7d"
          ? `Day ${((i * 6) / 11 + 1).toFixed(1)}`
          : `Day ${Math.round((i * 29) / 11 + 1)}`,
    requests: Math.round(
      (v * 860 + (i % 3) * 1700) *
        scale *
        (range === "24h" ? 1 : range === "7d" ? 7 : 30),
    ),
    latency: Math.round(38 + ((i * 13) % 21) + (tenant === "helix" ? 9 : 0)),
    tokens: Math.round((v * 145 + Math.floor(i / 3) * 2300) * scale),
  }));
}

export function Observability() {
  const { tenantId } = useWorkspace();
  const [range, setRange] = useState<Range>("24h");
  const [active, setActive] = useState(9);
  const [selectedModel, setSelectedModel] = useState(0);
  const [exported, setExported] = useState(false);
  const reduceMotion = useReducedMotion();
  const data = useMemo(() => makeTelemetry(range, tenantId), [range, tenantId]);
  const maxRequests = Math.max(...data.map((d) => d.requests)) * 1.15;
  const width = 880;
  const top = 26;
  const bottom = 246;
  const x = (i: number) => 48 + (i * (width - 72)) / 11;
  const requestY = (v: number) => bottom - (v / maxRequests) * (bottom - top);
  const latencyY = (v: number) => bottom - (v / 100) * (bottom - top);
  const line = data.map((d, i) => `${x(i)},${requestY(d.requests)}`).join(" ");
  const latencyLine = data
    .map((d, i) => `${x(i)},${latencyY(d.latency)}`)
    .join(" ");
  const point = data[active];
  const totalRequests = data.reduce((sum, d) => sum + d.requests, 0);
  const sortedLatencies = data.map((d) => d.latency).sort((a, b) => a - b);
  const medianLatency = (sortedLatencies[5] + sortedLatencies[6]) / 2;
  const model = modelData[selectedModel];
  const tenantScale = tenantId === "helix" ? 1.2 : 1;
  const drift = model.drift * tenantScale;
  const bias = model.bias * tenantScale;

  function exportReport() {
    const csv = [
      "tenant,period,interval,requests,latency_ms,tokens_per_minute",
      ...data.map(
        (row) =>
          `${tenantId},${range},${row.label},${row.requests},${row.latency},${row.tokens}`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `axiom-${tenantId}-${range}-demo-telemetry.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExported(true);
    window.setTimeout(() => setExported(false), 2500);
  }

  return (
    <div className="page-container ops-page">
      <div className="ops-breadcrumb">
        WORKSPACE <span>/</span> OBSERVABILITY
      </div>
      <div className="ops-page-heading">
        <div>
          <div className="eyebrow ops-eyebrow">
            <span className="ops-status-dot" /> SYSTEM INTELLIGENCE
          </div>
          <h1>
            Clarity at every layer<span>.</span>
          </h1>
          <p className="muted">
            From the first token to the last decision. See the whole system.
          </p>
        </div>
        <button className="button button-secondary" onClick={exportReport}>
          {exported ? <Check size={16} /> : <Download size={16} />}{" "}
          {exported ? "Report exported" : "Export report"}
        </button>
      </div>
      <div className="ops-toolbar">
        <div className="ops-demo-badge">
          <Radio size={13} /> SIMULATED TELEMETRY <span>·</span>{" "}
          {tenantId === "atlas" ? "Atlas" : "Helix"} workspace
        </div>
        <div
          className="ops-range"
          role="group"
          aria-label="Telemetry time range"
        >
          {ranges.map((value) => (
            <button
              key={value}
              aria-pressed={range === value}
              className={range === value ? "is-active" : ""}
              onClick={() => {
                setRange(value);
                setActive(9);
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="ops-stat-grid">
        <Stat
          label="Total requests"
          value={Intl.NumberFormat("en-US", {
            notation: "compact",
            maximumFractionDigits: 2,
          }).format(totalRequests)}
          change="18.6%"
          detail="vs. previous demo period"
          icon={<Activity size={16} />}
        />
        <Stat
          label="Median interval latency"
          value={String(medianLatency)}
          unit="ms"
          change="12.4%"
          detail="faster in this scenario"
          down
          icon={<Timer size={16} />}
        />
        <Stat
          label="Success rate"
          value="99.98"
          unit="%"
          change="0.03%"
          detail="vs. previous demo period"
          icon={<Check size={16} />}
        />
        <Stat
          label="Active agents"
          value={tenantId === "atlas" ? "128" : "82"}
          change={tenantId === "atlas" ? "+12" : "+8"}
          detail="in this demo workspace"
          icon={<Layers3 size={16} />}
        />
      </div>
      <motion.section
        className="panel ops-main-chart"
        initial={reduceMotion ? false : { opacity: 1, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        aria-labelledby="traffic-title"
      >
        <div className="ops-panel-header">
          <div>
            <h2 id="traffic-title">A little more signal. A lot less noise.</h2>
            <p>Request volume & response latency</p>
          </div>
          <div className="ops-chart-legend">
            <span>
              <i /> Requests
            </span>
            <span>
              <i className="violet" /> Latency
            </span>
          </div>
        </div>
        <div className="ops-chart-callout" aria-live="polite">
          <span>{point.label}</span>
          <strong>
            {point.requests.toLocaleString()} <small>requests</small>
          </strong>
          <strong>
            {point.latency} <small>ms latency</small>
          </strong>
        </div>
        <div className="ops-chart-scroll">
          <svg
            viewBox={`0 0 ${width} 290`}
            className="ops-traffic-svg"
            role="group"
            aria-label="Request volume and latency. Focus a point, or use arrow keys, to inspect an interval."
          >
            <defs>
              <linearGradient id="ops-request-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#9df5ce" stopOpacity=".19" />
                <stop offset="100%" stopColor="#9df5ce" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <line
                  x1="48"
                  x2="856"
                  y1={top + i * 55}
                  y2={top + i * 55}
                  stroke="#26282e"
                  strokeDasharray="3 6"
                />
                <text
                  x="36"
                  y={top + i * 55 + 4}
                  textAnchor="end"
                  fill="#a3a5ae"
                  fontSize="10"
                >
                  {Intl.NumberFormat("en", {
                    notation: "compact",
                    maximumFractionDigits: 0,
                  }).format(maxRequests * (1 - i / 4))}
                </text>
                <text
                  x="872"
                  y={top + i * 55 + 4}
                  textAnchor="end"
                  fill="#a3a5ae"
                  fontSize="9"
                >
                  {100 - i * 25}
                </text>
              </g>
            ))}
            <polygon
              points={`48,${bottom} ${line} 856,${bottom}`}
              fill="url(#ops-request-fill)"
            />
            <polyline
              points={line}
              fill="none"
              stroke="#9df5ce"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <polyline
              points={latencyLine}
              fill="none"
              stroke="#b4a0ff"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeDasharray="5 4"
            />
            <line
              x1={x(active)}
              x2={x(active)}
              y1={top}
              y2={bottom}
              stroke="#d8dce4"
              strokeOpacity=".35"
              strokeDasharray="3 4"
            />
            {data.map((d, i) => (
              <g key={d.label}>
                <circle
                  cx={x(i)}
                  cy={requestY(d.requests)}
                  r={active === i ? 5 : 4}
                  fill={active === i ? "#9df5ce" : "#101115"}
                  stroke="#9df5ce"
                  strokeWidth="2"
                />
                <circle
                  className="ops-chart-point"
                  cx={x(i)}
                  cy={requestY(d.requests)}
                  r="13"
                  fill="transparent"
                  tabIndex={i === active ? 0 : -1}
                  role="button"
                  aria-label={`${d.label}: ${d.requests.toLocaleString()} requests, ${d.latency} milliseconds latency`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActive(i);
                    }
                    if (
                      ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        event.key,
                      )
                    ) {
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? 11
                            : Math.max(
                                0,
                                Math.min(
                                  11,
                                  i + (event.key === "ArrowRight" ? 1 : -1),
                                ),
                              );
                      setActive(next);
                      const points = event.currentTarget
                        .closest("svg")
                        ?.querySelectorAll<SVGCircleElement>(
                          ".ops-chart-point",
                        );
                      points?.[next]?.focus();
                    }
                  }}
                />
                {i % 2 === 0 || i === 11 ? (
                  <text
                    x={x(i)}
                    y="278"
                    fill="#a3a5ae"
                    textAnchor="middle"
                    fontSize="11"
                  >
                    {d.label}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
        </div>
        <div className="ops-chart-footer">
          <span>
            <span className="ops-status-dot" /> All demo systems operational
          </span>
          <span>
            Left axis: requests <span className="ops-divider">/</span> Right
            axis: milliseconds
          </span>
        </div>
        <details className="ops-data-details">
          <summary>
            View accessible data table <ChevronDown size={13} />
          </summary>
          <div className="ops-table-wrap">
            <table>
              <caption>
                Illustrative {range} telemetry for {tenantId}. These values are
                simulated.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Interval</th>
                  <th scope="col">Requests</th>
                  <th scope="col">Latency (ms)</th>
                  <th scope="col">Tokens / minute</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.label}>
                    <th scope="row">{d.label}</th>
                    <td>{d.requests.toLocaleString()}</td>
                    <td>{d.latency}</td>
                    <td>{d.tokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </motion.section>
      <div className="ops-lower-grid">
        <section
          className="panel ops-small-panel"
          aria-labelledby="throughput-title"
        >
          <div className="ops-panel-header">
            <div>
              <div className="ops-small-label">
                <Zap size={14} /> INFERENCE PERFORMANCE
              </div>
              <h2 id="throughput-title">Every token, accounted for.</h2>
            </div>
          </div>
          <div className="ops-small-metric">
            {Intl.NumberFormat("en", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(data[data.length - 1].tokens)}{" "}
            <span>tokens / min</span>
          </div>
          <svg
            viewBox="0 0 420 155"
            role="img"
            aria-label={`Token throughput increases from ${data[0].tokens} to ${data[11].tokens} tokens per minute. All interval values are available in the table above.`}
            className="ops-step-svg"
          >
            {[25, 65, 105, 145].map((v) => (
              <line
                key={v}
                x1="0"
                x2="420"
                y1={v}
                y2={v}
                stroke="#27282e"
                strokeDasharray="3 6"
              />
            ))}
            <path
              d={data
                .map(
                  (d, i) =>
                    `${i === 0 ? "M" : "H"} ${i * 38} ${i === 0 ? 145 - d.tokens / 160 : `V ${145 - d.tokens / 160}`}`,
                )
                .join(" ")}
              stroke="#b4a0ff"
              strokeWidth="2.5"
              fill="none"
            />
            <path
              d={`M 0 155 ${data.map((d, i) => `H ${i * 38} V ${145 - d.tokens / 160}`).join(" ")} L 418 155 Z`}
              fill="#b4a0ff"
              opacity=".06"
            />
          </svg>
          <div className="ops-small-bottom">
            <span>{data[0].label}</span>
            <span>{data[11].label}</span>
          </div>
          <p className="ops-footnote">
            Batched inference · illustrative time series
          </p>
        </section>
        <section
          className="panel ops-small-panel"
          aria-labelledby="drift-title"
        >
          <div className="ops-panel-header">
            <div>
              <div className="ops-small-label">
                <Activity size={14} /> MODEL HEALTH
              </div>
              <h2 id="drift-title">Confidence, continuously.</h2>
            </div>
          </div>
          <div
            className="ops-model-tabs"
            role="group"
            aria-label="Select model for drift and bias analysis"
          >
            {modelData.map((item, i) => (
              <button
                key={item.name}
                className={selectedModel === i ? "is-active" : ""}
                aria-pressed={selectedModel === i}
                onClick={() => setSelectedModel(i)}
              >
                <i style={{ background: item.color }} />
                {item.name}
              </button>
            ))}
          </div>
          <svg
            className="ops-scatter-svg"
            viewBox="0 0 420 160"
            role="img"
            aria-label={`${model.name}: drift score ${drift.toFixed(3)}, bias score ${bias.toFixed(3)}. Scores are illustrative, not an evaluation of a real model.`}
          >
            <rect
              x="35"
              y="10"
              width="350"
              height="120"
              rx="3"
              fill="#9df5ce"
              opacity=".025"
            />
            {[35, 105, 175, 245, 315, 385].map((v) => (
              <line
                key={v}
                x1={v}
                x2={v}
                y1="10"
                y2="130"
                stroke="#27282e"
                strokeDasharray="3 5"
              />
            ))}
            {[10, 50, 90, 130].map((v) => (
              <line
                key={v}
                x1="35"
                x2="385"
                y1={v}
                y2={v}
                stroke="#27282e"
                strokeDasharray="3 5"
              />
            ))}
            {Array.from({ length: 36 }, (_, i) => (
              <circle
                key={i}
                cx={35 + drift * 3300 + ((i * 37) % 125)}
                cy={130 - bias * 1300 - ((i * 19) % 63)}
                r={i % 5 === 0 ? 4 : 2.5}
                fill={model.color}
                opacity={0.35 + (i % 5) * 0.12}
              />
            ))}
            <text
              x="210"
              y="155"
              textAnchor="middle"
              fill="#a3a5ae"
              fontSize="10"
            >
              Distribution drift →
            </text>
            <text
              x="13"
              y="72"
              textAnchor="middle"
              fill="#a3a5ae"
              fontSize="10"
              transform="rotate(-90 13 72)"
            >
              Bias score →
            </text>
          </svg>
          <div className="ops-drift-readout" aria-live="polite">
            <span>
              Drift <strong>{drift.toFixed(3)}</strong>
            </span>
            <span>
              Bias <strong>{bias.toFixed(3)}</strong>
            </span>
            <span className="ops-healthy">
              <Check size={12} /> Within demo threshold
            </span>
          </div>
          <p className="ops-footnote">
            Illustrative scores · demo threshold: drift & bias &lt; 0.06
          </p>
        </section>
      </div>
      <ExecutionIntelligence key={tenantId} tenantId={tenantId} />
      <p className="ops-page-note">
        A working interface with deterministic sample data. Connect your
        telemetry provider to monitor production infrastructure.
      </p>
    </div>
  );
}

function ExecutionIntelligence({ tenantId }: { tenantId: string }) {
  const [query, setQuery] = useState("");
  const [service, setService] = useState("all");
  const [status, setStatus] = useState<"all" | TraceStatus>("all");
  const [expanded, setExpanded] = useState<string | null>(`${tenantId}-8f3a21`);
  const traces = useMemo<Trace[]>(
    () =>
      traceSeeds.map((trace, index) => ({
        ...trace,
        id: `${tenantId}-${["8f3a21", "7d12b0", "6c9e42", "5a2f18", "4b8d03"][index]}`,
        input: Math.round(trace.input * (tenantId === "helix" ? 0.72 : 1)),
        duration: trace.duration + (tenantId === "helix" ? 18 : 0),
      })),
    [tenantId],
  );
  const visible = traces.filter(
    (trace) =>
      (service === "all" || trace.service === service) &&
      (status === "all" || trace.status === status) &&
      `${trace.id} ${trace.service} ${trace.task} ${trace.model}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const money = (value: number) => `$${value.toFixed(4)}`;

  return (
    <section className="panel ops-execution" aria-labelledby="execution-title">
      <div className="ops-panel-header">
        <div>
          <div className="ops-small-label">
            <Layers3 size={14} /> EXECUTION INTELLIGENCE
          </div>
          <h2 id="execution-title">Behind every answer, a clear trail.</h2>
          <p>Service health, routing decisions, and trace-level economics.</p>
        </div>
        <span className="ops-demo-badge">
          <span className="ops-status-dot" /> DEMO SNAPSHOT
        </span>
      </div>
      <div
        className="ops-service-grid"
        aria-label="Demo service routing health"
      >
        {services.map((name, index) => {
          const records = traces.filter((trace) => trace.service === name);
          const recovered = records.some(
            (trace) => trace.status === "fallback",
          );
          return (
            <div className="ops-service-card" key={name}>
              <div className="ops-service-top">
                <span
                  className={`ops-service-symbol${recovered ? " is-warning" : ""}`}
                >
                  {index === 0 ? (
                    <Layers3 size={16} />
                  ) : index === 1 ? (
                    <Zap size={16} />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                </span>
                <span
                  className={recovered ? "ops-route-recovered" : "ops-healthy"}
                >
                  {recovered ? "Fallback recovered" : "Healthy"}
                </span>
              </div>
              <h3>{name}</h3>
              <p>{modelData[index].name}</p>
              <div className="ops-service-bottom">
                <span>
                  {Math.round(
                    records.reduce((sum, trace) => sum + trace.duration, 0) /
                      records.length,
                  )}
                  <small> ms mean</small>
                </span>
                <span>
                  {records.length}
                  <small> traces</small>
                </span>
              </div>
              <div
                className="ops-route-meter"
                role="img"
                aria-label={`${name}: ${records.length} of ${records.length} sampled requests completed`}
              >
                <span
                  style={{
                    width: "100%",
                    background: recovered ? "#f2ce8a" : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="ops-trace-toolbar">
        <div className="ops-trace-search">
          <Search size={15} aria-hidden="true" />
          <label className="sr-only" htmlFor="trace-search">
            Search trace IDs, tasks, services, or models
          </label>
          <input
            id="trace-search"
            type="search"
            placeholder="Search traces, agents, models…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="ops-trace-select">
          <label className="sr-only" htmlFor="trace-service">
            Filter traces by service
          </label>
          <select
            id="trace-service"
            value={service}
            onChange={(event) => setService(event.target.value)}
          >
            <option value="all">All services</option>
            {services.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
        <div
          className="ops-range"
          role="group"
          aria-label="Filter trace status"
        >
          {(
            [
              ["all", "All"],
              ["success", "Primary"],
              ["fallback", "Fallback"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={status === value ? "is-active" : ""}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="ops-trace-count" role="status">
        {visible.length} of {traces.length} sample traces{" "}
        <span>Snapshot · 14:32 UTC</span>
      </div>
      <div className="ops-table-wrap">
        <table className="ops-trace-table">
          <caption className="sr-only">
            Simulated agent execution traces. Expand a trace to inspect its
            routing, token costs, and timing spans.
          </caption>
          <thead>
            <tr>
              <th scope="col">Execution / trace ID</th>
              <th scope="col">Model / region</th>
              <th scope="col">Route</th>
              <th scope="col">Latency</th>
              <th scope="col">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((trace) => {
              const isExpanded = expanded === trace.id;
              return (
                <Fragment key={trace.id}>
                  <tr className={isExpanded ? "is-expanded" : ""}>
                    <th scope="row">
                      <button
                        className="ops-trace-trigger"
                        aria-expanded={isExpanded}
                        aria-controls={`detail-${trace.id}`}
                        onClick={() =>
                          setExpanded(isExpanded ? null : trace.id)
                        }
                      >
                        <ChevronRight
                          size={14}
                          className={isExpanded ? "is-open" : ""}
                        />
                        <span>
                          <strong>{trace.service}</strong>
                          <small>
                            {trace.id} <span>· {trace.time}</span>
                          </small>
                        </span>
                        <span className="sr-only">
                          {" "}
                          Inspect execution trace
                        </span>
                      </button>
                    </th>
                    <td>
                      <span className="ops-trace-model">{trace.model}</span>
                      <small className="ops-trace-region">{trace.region}</small>
                    </td>
                    <td>
                      <span
                        className={`ops-trace-status ${trace.status === "fallback" ? "is-warning" : ""}`}
                      >
                        <span />
                        {trace.status === "fallback" ? "Fallback" : "Primary"}
                      </span>
                    </td>
                    <td className="ops-mono">
                      {trace.duration}
                      <span className="muted"> ms</span>
                    </td>
                    <td className="ops-mono">{money(traceCost(trace))}</td>
                  </tr>
                  <tr className="ops-trace-detail-row" hidden={!isExpanded}>
                    <td colSpan={5}>
                      <div
                        id={`detail-${trace.id}`}
                        className="ops-trace-detail"
                        role="region"
                        aria-label={`Execution detail for ${trace.id}`}
                      >
                        <div className="ops-trace-detail-heading">
                          <div>
                            <span className="ops-small-label">
                              TRACE DETAIL
                            </span>
                            <h3>{trace.task}</h3>
                          </div>
                          <span className="ops-healthy">
                            <Check size={13} /> Completed
                          </span>
                        </div>
                        <div className="ops-trace-detail-grid">
                          <div>
                            <p className="ops-route-reason">{trace.route}</p>
                            <div className="ops-token-breakdown">
                              <div>
                                <span>Input tokens</span>
                                <strong>{trace.input.toLocaleString()}</strong>
                              </div>
                              <div>
                                <span>Output tokens</span>
                                <strong>{trace.output.toLocaleString()}</strong>
                              </div>
                              <div>
                                <span>Estimated cost</span>
                                <strong>{money(traceCost(trace))}</strong>
                              </div>
                            </div>
                            <p className="ops-footnote">
                              Demo pricing / 1M tokens: Reasoning $2 in, $8 out;
                              Embedding $0.10 in; Classifier $0.25 in, $1 out.
                            </p>
                          </div>
                          <div
                            className="ops-span-list"
                            aria-label="Sequential execution timing spans"
                          >
                            {[
                              "Policy gate",
                              "Context retrieval",
                              trace.status === "fallback"
                                ? "Inference + failover"
                                : "Model inference",
                              "Output validation",
                            ].map((name, index) => {
                              const boundaries = [0, 0.08, 0.24, 0.92, 1];
                              const start = Math.round(
                                trace.duration * boundaries[index],
                              );
                              const end = Math.round(
                                trace.duration * boundaries[index + 1],
                              );
                              return (
                                <div className="ops-span-row" key={name}>
                                  <span>{name}</span>
                                  <div
                                    className="ops-span-track"
                                    aria-hidden="true"
                                  >
                                    <i
                                      style={{
                                        marginLeft: `${boundaries[index] * 100}%`,
                                        width: `${(boundaries[index + 1] - boundaries[index]) * 100}%`,
                                        background:
                                          index === 2 ? "#b4a0ff" : "#9df5ce",
                                      }}
                                    />
                                  </div>
                                  <span>{end - start} ms</span>
                                </div>
                              );
                            })}
                            <div className="ops-span-axis">
                              <span>0 ms</span>
                              <span>{trace.duration} ms total</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="ops-trace-empty">
                    <Search size={22} />
                    <strong>No matching traces</strong>
                    <p>Try a different model, service, or trace ID.</p>
                    <button
                      className="button button-secondary"
                      onClick={() => {
                        setQuery("");
                        setService("all");
                        setStatus("all");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="ops-chart-footer">
        <span>
          <ShieldCheck size={13} /> All five sample executions completed
        </span>
        <span>Token-based estimates · excludes infrastructure costs</span>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  change,
  detail,
  down,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  change: string;
  detail: string;
  down?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <section className="panel ops-stat">
      <div className="ops-stat-label">
        <h2>{label}</h2>
        {icon}
      </div>
      <p className="ops-stat-value">
        {value}
        <span>{unit}</span>
      </p>
      <p className="ops-stat-trend">
        <span>
          {down ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
          {change}
        </span>
        <small>{detail}</small>
      </p>
    </section>
  );
}
