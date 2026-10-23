"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  Command,
  Database,
  Download,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Table2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import type {
  AnalystAnswer,
  DatasetDetail,
  DatasetSummary,
  EvaluationRun,
  Filters,
  JobRecord,
  LabResult,
  MetricDefinition,
  Mode,
  Overview,
  Role,
} from "@/lib/intelligence/contracts";
import {
  Badge,
  DataTable,
  Empty,
  ErrorState,
  ExportButton,
  Loading,
  Panel,
  ProvenanceBlock,
  api,
  format,
  shortNumber,
  useResource,
  when,
} from "./ui";
import { PowerBIView } from "./powerbi-view";
import "./intelligence.css";

const sections = [
  { id: "overview", label: "Executive overview", icon: LayoutDashboard },
  { id: "datasets", label: "Data workbench", icon: Database },
  { id: "analyst", label: "AI analyst", icon: Sparkles },
  { id: "lab", label: "Analysis lab", icon: FlaskConical },
  { id: "reports", label: "Power BI reports", icon: BarChart3 },
  { id: "catalog", label: "Metrics & lineage", icon: GitBranch },
  { id: "evaluations", label: "Evaluation center", icon: Activity },
  { id: "governance", label: "Governance", icon: ShieldCheck },
];
const descriptions: Record<string, [string, string]> = {
  overview: [
    "Your business, in focus.",
    "The metrics that matter. The evidence behind every move.",
  ],
  datasets: [
    "Good decisions start here.",
    "Understand, refine, and version the data behind your analysis.",
  ],
  analyst: [
    "Ask a better question.",
    "Follow the answer all the way back to its source.",
  ],
  lab: [
    "Go beyond the headline.",
    "Explore patterns, test assumptions, and make uncertainty visible.",
  ],
  reports: [
    "Your intelligence, connected.",
    "Bring Power BI into the same decision-making workspace.",
  ],
  catalog: [
    "Every metric has a story.",
    "Explore its definition, ownership, and downstream impact.",
  ],
  evaluations: [
    "Evidence over impressions.",
    "Measure correctness, grounding, and safety against known answers.",
  ],
  governance: [
    "Trust is part of the system.",
    "Workspace access, background operations, and a traceable history.",
  ],
};
type Props = {
  workspaceId: string;
  section: string;
  user: { id: string; name: string; role: Role };
  workspaces: { id: string; name: string; role: Role }[];
  mode: Mode;
};
type Saved = {
  id: string;
  data: Record<string, unknown>;
  revision: number;
  updatedAt: string;
};
function query(filters: Filters) {
  return new URLSearchParams(
    Object.entries(filters).filter(([, v]) => !!v) as [string, string][],
  ).toString();
}
export function IntelligenceWorkspace({
  workspaceId,
  section,
  user,
  workspaces,
  mode,
}: Props) {
  const router = useRouter(),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(""),
    [active, setActive] = useState(0),
    [filters, setFilters] = useState<Filters>(
      mode === "connected"
        ? {}
        : {
            from: section === "lab" ? "2023-10-01" : "2026-01-01",
            to: "2026-09-30",
          },
    );
  const command = useRef<HTMLDialogElement>(null);
  const base = `/api/v1/workspaces/${workspaceId}`;
  const canWrite = user.role !== "viewer";
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        command.current?.showModal();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const options = sections.filter((s) =>
    s.label.toLowerCase().includes(search.toLowerCase()),
  );
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    location.href = "/login";
  };
  return (
    <div className="ios-app">
      <a href="#workspace-content" className="ios-skip">
        Skip to workspace
      </a>
      <aside className={`ios-sidebar ${mobile ? "is-open" : ""}`}>
        <Link href="/app" className="ios-brand">
          <span className="ios-brand-mark">
            <Command size={19} />
          </span>
          axiom<span className="ios-brand-os">INTELLIGENCE OS</span>
        </Link>
        <button
          className="ios-mobile-close ios-icon-button"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <label className="ios-workspace-label">
          WORKSPACE
          <select
            aria-label="Switch authorized workspace"
            value={workspaceId}
            onChange={(e) => router.push(`/app/${e.target.value}/${section}`)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="ios-search-button"
          onClick={() => command.current?.showModal()}
        >
          <Search size={15} />
          Find anything<kbd>⌘ K</kbd>
        </button>
        <span className="ios-nav-label">INTELLIGENCE</span>
        <nav aria-label="Intelligence workspace">
          {sections.map((s) => (
            <Link
              key={s.id}
              href={`/app/${workspaceId}/${s.id}`}
              aria-current={section === s.id ? "page" : undefined}
              onClick={() => setMobile(false)}
            >
              <s.icon size={17} />
              <span>{s.label}</span>
              {s.id === "analyst" && <span className="ios-nav-new">AI</span>}
            </Link>
          ))}
        </nav>
        <div className="ios-sidebar-bottom">
          <div className="ios-engine-status">
            <span />
            <div>
              Workspace secured<small>Server-enforced permissions</small>
            </div>
            <ShieldCheck size={16} />
          </div>
          <Link className="ios-doc-link" href="/docs">
            <BookOpen size={15} />
            Platform documentation
            <ArrowUpRight size={14} />
          </Link>
          <div className="ios-user">
            <span className="ios-avatar">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
            <button
              className="ios-icon-button"
              aria-label="Sign out"
              onClick={() => void logout()}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="ios-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="ios-main">
        <header className="ios-topbar">
          <div>
            <button
              className="ios-mobile-menu ios-icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span className="ios-breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>{sections.find((s) => s.id === section)?.label}</strong>
            </span>
          </div>
          <div className="ios-topbar-right">
            <Badge tone={mode === "demo" ? "amber" : "mint"}>
              {mode === "demo"
                ? "Reference environment"
                : "Connected environment"}
            </Badge>
            <span className="ios-topbar-divider" />
            <button
              className="ios-icon-button"
              aria-label="Open command search"
              onClick={() => command.current?.showModal()}
            >
              <Command size={17} />
            </button>
            <span className="ios-avatar small">{user.name[0]}</span>
          </div>
        </header>
        <div className="ios-content" id="workspace-content" tabIndex={-1}>
          <div className="ios-page-heading">
            <div>
              <div className="ios-page-eyebrow">
                <span className="ios-live-dot" />
                {workspaces
                  .find((w) => w.id === workspaceId)
                  ?.name.toUpperCase()}
                <span> / </span>INTELLIGENCE OS
              </div>
              <h1>{descriptions[section][0]}</h1>
              <p>{descriptions[section][1]}</p>
            </div>
            {section === "overview" && (
              <Link
                href={`/app/${workspaceId}/analyst`}
                className="ios-button primary"
              >
                <Sparkles size={15} />
                Ask your data
                <ArrowRight size={15} />
              </Link>
            )}
            {section === "datasets" && (
              <Badge tone="blue">4 formats · Versioned imports</Badge>
            )}
          </div>
          {["overview", "lab", "reports"].includes(section) && (
            <div className="ios-filterbar">
              <div className="ios-filter-group">
                <label>
                  From
                  <input
                    type="date"
                    aria-label="Period start"
                    value={filters.from || ""}
                    title="Leave blank to use the source coverage start"
                    onChange={(e) =>
                      setFilters((v) => ({ ...v, from: e.target.value }))
                    }
                  />
                </label>
                <span className="ios-date-arrow">→</span>
                <label>
                  To
                  <input
                    type="date"
                    aria-label="Period end"
                    value={filters.to || ""}
                    title="Leave blank to use the source coverage end"
                    onChange={(e) =>
                      setFilters((v) => ({ ...v, to: e.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="ios-filter-selects">
                <label className="sr-only" htmlFor="region">
                  Region
                </label>
                <select
                  id="region"
                  value={filters.region || ""}
                  onChange={(e) =>
                    setFilters((v) => ({ ...v, region: e.target.value }))
                  }
                >
                  <option value="">All regions</option>
                  <option>North America</option>
                  <option>Europe</option>
                  <option>Asia Pacific</option>
                </select>
                <label className="sr-only" htmlFor="plan">
                  Plan
                </label>
                <select
                  id="plan"
                  value={filters.plan || ""}
                  onChange={(e) =>
                    setFilters((v) => ({ ...v, plan: e.target.value }))
                  }
                >
                  <option value="">All plans</option>
                  <option>Launch</option>
                  <option>Scale</option>
                  <option>Enterprise</option>
                </select>
              </div>
              <span className="ios-filter-timezone">
                UTC <span>·</span> USD
              </span>
            </div>
          )}
          {section === "overview" && (
            <OverviewSection
              base={base}
              filters={filters}
              setFilters={setFilters}
              canWrite={canWrite}
            />
          )}
          {section === "datasets" && (
            <DatasetsSection base={base} canWrite={canWrite} />
          )}
          {section === "analyst" && (
            <AnalystSection base={base} canWrite={canWrite} />
          )}
          {section === "lab" && <LabSection base={base} filters={filters} />}
          {section === "catalog" && <CatalogSection base={base} />}
          {section === "evaluations" && (
            <EvaluationSection base={base} canWrite={canWrite} />
          )}
          {section === "reports" && (
            <ReportsSection
              base={base}
              workspaceId={workspaceId}
              filters={filters}
            />
          )}
          {section === "governance" && (
            <GovernanceSection base={base} role={user.role} userId={user.id} />
          )}
          <footer className="ios-workspace-footer">
            <span>
              <span className="ios-live-dot" />
              All results scoped to your workspace
            </span>
            <span>
              Axiom Intelligence OS <span>2.0</span>
            </span>
          </footer>
        </div>
      </div>
      <dialog
        ref={command}
        className="ios-dialog ios-command"
        onClick={(e) => {
          if (e.target === e.currentTarget) command.current?.close();
        }}
      >
        <div className="ios-command-input">
          <Search size={20} />
          <input
            aria-label="Search workspace destinations"
            placeholder="Where would you like to go?"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((v) => (v + 1) % Math.max(1, options.length));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive(
                  (v) => (v + options.length - 1) % Math.max(1, options.length),
                );
              }
              if (e.key === "Enter" && options[active]) {
                command.current?.close();
                router.push(`/app/${workspaceId}/${options[active].id}`);
              }
            }}
          />
          <button
            className="ios-icon-button"
            aria-label="Close search"
            onClick={() => command.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <h2 className="sr-only">Workspace command search</h2>
        <div className="ios-command-results">
          {options.map((s, i) => (
            <button
              key={s.id}
              className={i === active ? "active" : ""}
              onClick={() => {
                command.current?.close();
                router.push(`/app/${workspaceId}/${s.id}`);
              }}
            >
              <s.icon size={17} />
              {s.label}
              <ArrowRight size={15} />
            </button>
          ))}
          {!options.length && <p>No destinations match your search.</p>}
        </div>
        <div className="ios-command-footer">
          ↑ ↓ to navigate <span>Enter to open · Esc to close</span>
        </div>
      </dialog>
    </div>
  );
}

function TrendChart({ data }: { data: Overview["series"] }) {
  const [index, setIndex] = useState<number | null>(null),
    [visible, setVisible] = useState({ revenue: true, cost: true, mrr: false }),
    [table, setTable] = useState(false);
  const w = 860,
    h = 270,
    pad = { left: 65, right: 20, top: 20, bottom: 36 };
  const selected = index === null ? data.at(-1) : data[index];
  const colors = { revenue: "#75e2bd", cost: "#a991ff", mrr: "#6d96ff" };
  const keys = (["revenue", "cost", "mrr"] as const).filter((k) => visible[k]);
  const max = Math.max(1, ...data.flatMap((d) => keys.map((k) => d[k]))) * 1.15;
  const x = (i: number) =>
      pad.left +
      (i * (w - pad.left - pad.right)) / Math.max(1, data.length - 1),
    y = (v: number) => h - pad.bottom - (v / max) * (h - pad.top - pad.bottom);
  useEffect(() => setIndex(null), [data]);
  return (
    <>
      <div className="ios-chart-toolbar">
        <div className="ios-legend">
          {(["revenue", "cost", "mrr"] as const).map((k) => (
            <button
              key={k}
              aria-pressed={visible[k]}
              onClick={() => setVisible((v) => ({ ...v, [k]: !v[k] }))}
            >
              <span
                style={{
                  background: colors[k],
                  opacity: visible[k] ? 1 : 0.25,
                }}
              />
              {k === "mrr"
                ? "MRR"
                : k === "cost"
                  ? "Infrastructure cost"
                  : "Billed revenue"}
            </button>
          ))}
        </div>
        <button
          className="ios-icon-button"
          onClick={() => setTable((v) => !v)}
          aria-label={table ? "Show chart" : "Show data table"}
        >
          {table ? <BarChart3 size={17} /> : <Table2 size={17} />}
        </button>
      </div>
      {table ? (
        <DataTable
          columns={["month", "revenue", "cost", "mrr", "customers"]}
          rows={data}
        />
      ) : (
        <div
          className="ios-chart"
          tabIndex={0}
          role="group"
          aria-label={`Revenue and cost chart, ${data.length} monthly observations. Use arrow keys to inspect points.`}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              setIndex((v) =>
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? data.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          data.length - 1,
                          (v ?? data.length - 1) +
                            (e.key === "ArrowRight" ? 1 : -1),
                        ),
                      ),
              );
            }
          }}
          onMouseLeave={() => setIndex(null)}
        >
          <svg
            viewBox={`0 0 ${w} ${h}`}
            aria-hidden="true"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setIndex(
                Math.max(
                  0,
                  Math.min(
                    data.length - 1,
                    Math.round(
                      ((((e.clientX - rect.left) / rect.width) * w - pad.left) /
                        (w - pad.left - pad.right)) *
                        (data.length - 1),
                    ),
                  ),
                ),
              );
            }}
          >
            <defs>
              <linearGradient id="ios-area" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#75e2bd" stopOpacity=".14" />
                <stop offset="1" stopColor="#75e2bd" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line
                  x1={pad.left}
                  x2={w - pad.right}
                  y1={y(max * t)}
                  y2={y(max * t)}
                  stroke="#252a31"
                  strokeDasharray="3 5"
                />
                <text
                  x={pad.left - 12}
                  y={y(max * t) + 4}
                  textAnchor="end"
                  fill="#858c98"
                  fontSize="11"
                >
                  ${shortNumber(max * t)}
                </text>
              </g>
            ))}
            {data
              .filter(
                (_, i) =>
                  i === 0 ||
                  i === data.length - 1 ||
                  i % Math.ceil(data.length / 7) === 0,
              )
              .map((d) => (
                <text
                  key={d.month}
                  x={x(data.indexOf(d))}
                  y={h - 9}
                  textAnchor="middle"
                  fill="#858c98"
                  fontSize="11"
                >
                  {new Date(d.month + "-01T00:00:00Z").toLocaleDateString(
                    "en-US",
                    { month: "short", year: "2-digit", timeZone: "UTC" },
                  )}
                </text>
              ))}
            {visible.revenue && data.length > 0 && (
              <path
                d={`M ${x(0)},${y(0)} ${data.map((d, i) => `L ${x(i)},${y(d.revenue)}`).join(" ")} L ${x(data.length - 1)},${y(0)} Z`}
                fill="url(#ios-area)"
              />
            )}
            {keys.map((k) => (
              <path
                key={k}
                d={data
                  .map((d, i) => `${i ? "L" : "M"} ${x(i)},${y(d[k])}`)
                  .join(" ")}
                fill="none"
                stroke={colors[k]}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            ))}
            {index !== null && data[index] && (
              <g>
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1={pad.top}
                  y2={h - pad.bottom}
                  stroke="#747e8f"
                  strokeDasharray="4 4"
                />
                {keys.map((k) => (
                  <circle
                    key={k}
                    cx={x(index)}
                    cy={y(data[index][k])}
                    r="4"
                    fill={colors[k]}
                    stroke="#111418"
                    strokeWidth="2"
                  />
                ))}
              </g>
            )}
          </svg>
          <div className="ios-chart-readout" aria-live="polite">
            <span>{selected?.month || "No observations"}</span>
            {selected &&
              keys.map((k) => (
                <span key={k}>
                  <i style={{ background: colors[k] }} />
                  {k === "mrr" ? "MRR" : k}:{" "}
                  <strong>{format(selected[k], "USD")}</strong>
                </span>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
function OverviewSection({
  base,
  filters,
  setFilters,
  canWrite,
}: {
  base: string;
  filters: Filters;
  setFilters: (f: Filters) => void;
  canWrite: boolean;
}) {
  const resource = useResource<Overview>(`${base}/overview?${query(filters)}`),
    catalog = useResource<MetricDefinition[]>(`${base}/catalog`),
    [refresh, setRefresh] = useState(0),
    views = useResource<Saved[]>(`${base}/views`, refresh),
    [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [width, setWidth] = useState(68),
    [definition, setDefinition] = useState<MetricDefinition | null>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  if (resource.loading) return <Loading />;
  if (resource.error) return <ErrorState message={resource.error} />;
  const data = resource.data!;
  const save = async () => {
    try {
      await api(`${base}/views`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || "Executive view",
          filters,
        }),
      });
      setRefresh((v) => v + 1);
      setName("");
      setMessage("View saved to this workspace.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <>
      <div className="ios-section-actions">
        <span>
          <span className="ios-live-dot" />
          {data.rowCount.toLocaleString()} versioned facts{" "}
          <span className="ios-dot-separator">·</span> Calculated{" "}
          {when(data.provenance.generatedAt)}
          {data.provenance.sourceRefreshedAt && (
            <>
              <span className="ios-dot-separator"> · </span>Source refreshed{" "}
              {when(data.provenance.sourceRefreshedAt)}
              {data.provenance.sourceState === "stale" && (
                <>
                  {" "}
                  · <Badge tone="amber">Stale</Badge>
                </>
              )}
            </>
          )}
        </span>
        <div>
          <label className="sr-only" htmlFor="saved-view">
            Saved view
          </label>
          <select
            id="saved-view"
            value=""
            onChange={(e) => {
              const view = views.data?.find((v) => v.id === e.target.value);
              if (view) setFilters(view.data.filters as Filters);
            }}
          >
            <option value="">Saved views</option>
            {views.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {String(v.data.name)}
              </option>
            ))}
          </select>
          <details className="ios-save-view">
            <summary className="ios-button small">
              <Plus size={14} />
              Save view
            </summary>
            <div>
              <input
                aria-label="Saved view name"
                placeholder="Name this view"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="ios-button primary small"
                disabled={!canWrite}
                onClick={() => void save()}
              >
                Save
              </button>
            </div>
          </details>
          <ExportButton
            base={base}
            rows={data.series}
            columns={["month", "revenue", "cost", "mrr", "customers"]}
            datasetVersion={data.provenance.datasetVersion}
            disabled={!canWrite}
          />
        </div>
      </div>
      {message && (
        <p className="ios-inline-message" role="status">
          {message}
        </p>
      )}
      <div className="ios-kpi-grid">
        {data.metrics.slice(0, 4).map((m, i) => (
          <button
            className="ios-kpi"
            key={m.id}
            aria-haspopup="dialog"
            onClick={() => {
              setDefinition(catalog.data?.find((d) => d.id === m.id) || null);
              drawer.current?.showModal();
            }}
          >
            <span className="ios-kpi-label">
              {m.label}
              <MoreHorizontal size={16} />
            </span>
            <strong>{format(m.value, m.unit)}</strong>
            <span className="ios-kpi-bottom">
              {m.change === null ? (
                <span className="ios-muted">No comparable baseline</span>
              ) : (
                <span
                  className={`ios-change ${m.change * (i === 1 ? -1 : 1) >= 0 ? "positive" : "negative"}`}
                >
                  {m.change >= 0 ? (
                    <ArrowUpRight size={14} />
                  ) : (
                    <ArrowDownRight size={14} />
                  )}{" "}
                  {Math.abs(m.change).toFixed(1)}%
                </span>
              )}
              <span>vs. previous period</span>
              <svg viewBox="0 0 80 24" aria-hidden="true">
                <path
                  d={data.series
                    .slice(-12)
                    .map(
                      (d, j, a) =>
                        `${j ? "L" : "M"} ${(j * 80) / Math.max(1, a.length - 1)},${22 - ((i === 1 ? d.cost : d.revenue) / Math.max(1, ...a.map((v) => (i === 1 ? v.cost : v.revenue)))) * 20}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke={i === 1 ? "#a991ff" : "#75e2bd"}
                  strokeWidth="1.6"
                />
              </svg>
            </span>
          </button>
        ))}
      </div>
      <div
        className="ios-overview-grid"
        style={{
          gridTemplateColumns: `minmax(0,${width}fr) minmax(0,${100 - width}fr)`,
        }}
      >
        <Panel
          title="The revenue picture"
          eyebrow="PERFORMANCE OVER TIME"
          action={
            <details className="ios-layout-controls">
              <summary
                className="ios-icon-button"
                aria-label="Adjust chart panel width"
              >
                <Settings2 size={16} />
              </summary>
              <label>
                Chart panel width
                <input
                  type="range"
                  min="50"
                  max="80"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
              </label>
            </details>
          }
        >
          <div className="ios-chart-headline">
            <strong>
              {format(
                data.metrics.find((m) => m.id === "revenue")?.value,
                "USD",
              )}
            </strong>
            <span>Revenue across selected period</span>
          </div>
          <TrendChart data={data.series} />
        </Panel>
        <Panel title="Where growth comes from" eyebrow="REGIONAL CONTRIBUTION">
          <div className="ios-segment-total">
            <span>3 active regions</span>
            <Badge tone="violet">Billed revenue</Badge>
          </div>
          <div className="ios-segments">
            {data.segments
              .filter((s) => s.name !== "Unallocated")
              .map((s, i) => (
                <button
                  key={s.name}
                  onClick={() => setFilters({ ...filters, region: s.name })}
                  title={`Filter to ${s.name}`}
                >
                  <div>
                    <span>
                      <i
                        style={{
                          background: ["#75e2bd", "#a991ff", "#7197ff"][i],
                        }}
                      />
                      {s.name}
                    </span>
                    <strong>{format(s.revenue, "USD")}</strong>
                  </div>
                  <div className="ios-progress-track">
                    <span
                      style={{
                        width: `${(s.revenue / Math.max(1, ...data.segments.map((v) => v.revenue))) * 100}%`,
                        background: ["#75e2bd", "#a991ff", "#7197ff"][i],
                      }}
                    />
                  </div>
                  <small>
                    {s.customers} observed customers <ArrowRight size={12} />
                  </small>
                </button>
              ))}
          </div>
          <div className="ios-insight-callout">
            <Sparkles size={17} />
            <div>
              <strong>Start with a segment.</strong>
              <p>
                Select a region to inspect its contribution across your
                workspace.
              </p>
            </div>
          </div>
        </Panel>
      </div>
      <div className="ios-secondary-metrics">
        {data.metrics.slice(4).map((m) => (
          <div key={m.id}>
            <span>{m.label}</span>
            <strong>{format(m.value, m.unit)}</strong>
            <small>
              {m.id === "retention"
                ? "Starting customer cohort"
                : m.id === "nrr"
                  ? "Expansion and contraction included"
                  : m.id === "usage"
                    ? "Recorded tokens"
                    : m.id === "risk"
                      ? "Cost / revenue exceeds 35%"
                      : "Infrastructure cost basis"}
            </small>
          </div>
        ))}
      </div>
      <ProvenanceBlock value={data.provenance} />
      <dialog ref={drawer} className="ios-dialog ios-metric-dialog">
        <button
          className="ios-dialog-close ios-icon-button"
          onClick={() => drawer.current?.close()}
          aria-label="Close metric definition"
        >
          <X size={18} />
        </button>
        <span className="ios-eyebrow">METRIC DEFINITION</span>
        <h2>{definition?.name}</h2>
        <p>{definition?.description}</p>
        <pre className="ios-code">{definition?.formula}</pre>
        <dl className="ios-definition-list">
          <div>
            <dt>Owner</dt>
            <dd>{definition?.owner}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{definition?.version}</dd>
          </div>
          <div>
            <dt>Unit</dt>
            <dd>{definition?.unit}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{definition?.source}</dd>
          </div>
        </dl>
      </dialog>
    </>
  );
}

function DatasetsSection({
  base,
  canWrite,
}: {
  base: string;
  canWrite: boolean;
}) {
  const [refresh, setRefresh] = useState(0),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [op, setOp] = useState("drop_duplicates"),
    [column, setColumn] = useState(""),
    [target, setTarget] = useState("number"),
    [value, setValue] = useState(""),
    [preview, setPreview] = useState<DatasetDetail | null>(null);
  const list = useResource<DatasetSummary[]>(`${base}/datasets`, refresh),
    details = useResource<DatasetDetail>(
      selected ? `${base}/datasets/${selected}` : null,
      refresh,
    );
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (list.data?.some((d) => ["queued", "running"].includes(d.state))) {
      const timer = setInterval(() => setRefresh((v) => v + 1), 2500);
      return () => clearInterval(timer);
    }
  }, [list.data]);
  useEffect(() => {
    setPreview(null);
    setColumn("");
  }, [selected]);
  useEffect(() => setPreview(null), [op, column, target, value]);
  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ dataset: DatasetSummary }>(`${base}/datasets`, {
        method: "POST",
        body: (() => {
          const f = new FormData();
          f.set("file", file);
          return f;
        })(),
      });
      setSelected(r.dataset.id);
      setMessage(
        "Import queued. Profiling and validation run in the background.",
      );
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const operations = [
    {
      type: op,
      ...(op === "drop_duplicates" ? {} : { column }),
      ...(op === "cast"
        ? {
            to: target,
            invalid: "null",
            format: target === "date" ? "iso" : undefined,
          }
        : {}),
      ...(op === "fill_missing" ? { value } : {}),
      ...(op === "rename" ? { name: value } : {}),
    },
  ];
  const transform = async (isPreview: boolean) => {
    setBusy(true);
    setError("");
    try {
      const r = await api<DatasetDetail | { dataset: DatasetSummary }>(
        `${base}/datasets/${selected}/transform`,
        {
          method: "POST",
          body: JSON.stringify({ operations, preview: isPreview }),
        },
      );
      if (isPreview) setPreview(r as DatasetDetail);
      else {
        setSelected((r as { dataset: DatasetSummary }).dataset.id);
        setRefresh((v) => v + 1);
        setMessage(
          "New immutable version queued. The original version is preserved.",
        );
        setPreview(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="ios-dataset-grid">
        <Panel
          title="Your data assets"
          eyebrow="WORKSPACE CATALOG"
          action={
            <button
              className="ios-button primary small"
              disabled={!canWrite || busy}
              onClick={() => input.current?.click()}
            >
              <Upload size={14} />
              {busy ? "Processing…" : "Import data"}
            </button>
          }
        >
          <input
            ref={input}
            type="file"
            disabled={!canWrite || busy}
            className="sr-only"
            aria-label="Import dataset file"
            accept=".csv,.xlsx,.json,.parquet"
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
            }}
          />
          {list.loading ? (
            <Loading label="Loading datasets" />
          ) : list.error ? (
            <ErrorState message={list.error} />
          ) : (
            <div className="ios-assets">
              {list.data?.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelected(d.id)}
                  className={selected === d.id ? "selected" : ""}
                >
                  <span className="ios-asset-icon">
                    <Database size={18} />
                  </span>
                  <div>
                    <strong>{d.name}</strong>
                    <span>
                      {d.rows.toLocaleString()} rows <i>·</i> {d.columns} fields{" "}
                      <i>·</i> {d.source}
                    </span>
                  </div>
                  <Badge
                    tone={
                      d.state === "ready"
                        ? "mint"
                        : d.state === "failed"
                          ? "red"
                          : "amber"
                    }
                  >
                    {d.state}
                  </Badge>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          )}
          <div className="ios-upload-hint">
            <Upload size={15} />
            <span>
              CSV, XLSX, JSON & Parquet{" "}
              <strong>Up to 50 MiB · One million rows</strong>
            </span>
          </div>
        </Panel>
        <Panel
          title="A traceable data lifecycle"
          eyebrow="IMPORT → UNDERSTAND → REFINE"
        >
          <div className="ios-pipeline">
            {[
              [
                "01",
                "Profile",
                "Inspect missing values, duplicates, and inferred types.",
              ],
              [
                "02",
                "Review",
                "Preview every cleaning recipe before publishing.",
              ],
              [
                "03",
                "Version",
                "Keep the original file and an immutable transformation history.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <strong>{t}</strong>
                  <p>{d}</p>
                </div>
                <Check size={15} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      {message && (
        <p className="ios-inline-message" role="status">
          {message}
        </p>
      )}
      {error && <ErrorState message={error} />}
      <div className="ios-detail-area">
        {!selected ? (
          <Empty
            title="Get to know your data"
            description="Choose an asset to inspect its schema, quality profile, and records."
          />
        ) : details.loading ? (
          <Loading label="Inspecting dataset version" />
        ) : details.error ? (
          <ErrorState message={details.error} />
        ) : (
          details.data && (
            <>
              <Panel
                title={details.data.name}
                eyebrow={`DATASET VERSION ${details.data.version}`}
                action={<Badge tone="mint">{details.data.source}</Badge>}
              >
                <div className="ios-profile-stats">
                  <div>
                    <span>Rows</span>
                    <strong>{details.data.rows.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Fields</span>
                    <strong>{details.data.columns}</strong>
                  </div>
                  <div>
                    <span>Quality observations</span>
                    <strong>{details.data.issues.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Published</span>
                    <strong className="ios-profile-date">
                      {when(details.data.createdAt)}
                    </strong>
                  </div>
                </div>
                {details.data.warnings.map((w, i) => (
                  <p key={i} className="ios-warning">
                    {w}
                  </p>
                ))}
                <DataTable
                  columns={[
                    "name",
                    "type",
                    "missing",
                    "unique",
                    "invalid",
                    "examples",
                  ]}
                  rows={details.data.fields}
                />
              </Panel>
              {selected !== "reference" && details.data.state === "ready" && (
                <Panel
                  title="Review a transformation"
                  eyebrow="NEW VERSION · ORIGINAL PRESERVED"
                >
                  <div className="ios-transform-controls">
                    <label className="ios-field">
                      Operation
                      <select
                        value={op}
                        onChange={(e) => setOp(e.target.value)}
                      >
                        <option value="drop_duplicates">
                          Remove duplicate rows
                        </option>
                        <option value="trim">Trim whitespace</option>
                        <option value="drop_missing">
                          Remove missing rows
                        </option>
                        <option value="fill_missing">
                          Fill missing values
                        </option>
                        <option value="cast">Correct field type</option>
                        <option value="rename">Rename field</option>
                      </select>
                    </label>
                    {op !== "drop_duplicates" && (
                      <label className="ios-field">
                        Field
                        <select
                          value={column}
                          onChange={(e) => setColumn(e.target.value)}
                        >
                          <option value="">Choose field</option>
                          {details.data.fields.map((f) => (
                            <option key={f.name}>{f.name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {op === "cast" && (
                      <label className="ios-field">
                        Target type
                        <select
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                        >
                          <option>number</option>
                          <option>text</option>
                          <option>date</option>
                          <option>boolean</option>
                        </select>
                      </label>
                    )}
                    {["fill_missing", "rename"].includes(op) && (
                      <label className="ios-field">
                        {op === "rename" ? "New field name" : "Replacement"}
                        <input
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                        />
                      </label>
                    )}
                    <button
                      className="ios-button"
                      disabled={
                        !canWrite ||
                        busy ||
                        (op !== "drop_duplicates" && !column)
                      }
                      onClick={() => void transform(true)}
                    >
                      Preview changes
                    </button>
                    <button
                      className="ios-button primary"
                      disabled={!canWrite || busy || !preview}
                      onClick={() => void transform(false)}
                    >
                      Publish new version
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  {op === "cast" && (
                    <p className="ios-muted">
                      ISO dates only in this quick editor. Failed conversions
                      become null explicitly; review the preview before
                      publishing.
                    </p>
                  )}
                  {preview && (
                    <div className="ios-transform-preview">
                      <Badge tone="blue">Preview · not published</Badge>
                      <p>
                        {details.data.rows.toLocaleString()} →{" "}
                        {preview.rows.toLocaleString()} rows · {preview.issues}{" "}
                        quality observations
                      </p>
                      <DataTable
                        columns={preview.fields.map((f) => f.name)}
                        rows={preview.preview}
                      />
                    </div>
                  )}
                </Panel>
              )}
              <Panel
                title="Record preview"
                eyebrow="FIRST 50 RECORDS"
                action={
                  <ExportButton
                    base={base}
                    rows={details.data.preview}
                    columns={details.data.fields.map((f) => f.name)}
                    name="axiom-dataset-preview.csv"
                    datasetVersion={details.data.version}
                    disabled={!canWrite}
                  />
                }
              >
                <DataTable
                  columns={Object.keys(details.data.preview[0] || {})}
                  rows={details.data.preview}
                />
                <details className="ios-source-hash">
                  <summary>Version integrity & transformation history</summary>
                  <p>
                    SHA-256: <code>{details.data.hash}</code>
                  </p>
                  <p>
                    Parent version:{" "}
                    {details.data.parentVersion || "Original import"}
                  </p>
                  <pre className="ios-code">
                    {JSON.stringify(details.data.transformations, null, 2)}
                  </pre>
                </details>
              </Panel>
            </>
          )
        )}
      </div>
    </>
  );
}

function AnalystSection({
  base,
  canWrite,
}: {
  base: string;
  canWrite: boolean;
}) {
  const datasets = useResource<DatasetSummary[]>(`${base}/datasets`),
    [dataset, setDataset] = useState("reference"),
    [question, setQuestion] = useState(""),
    [answers, setAnswers] = useState<
      { question: string; answer: AnalystAnswer }[]
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dimension, setDimension] = useState(""),
    [saved, setSaved] = useState("");
  const messages = useRef<HTMLDivElement>(null);
  const detail = useResource<DatasetDetail>(
      dataset !== "reference" ? `${base}/datasets/${dataset}` : null,
    ),
    catalog = useResource<MetricDefinition[]>(
      `${base}/catalog${dataset === "reference" ? "" : `?datasetId=${dataset}`}`,
    );
  useEffect(() => {
    if (datasets.data && !datasets.data.some((d) => d.id === dataset))
      setDataset(datasets.data.find((d) => d.state === "ready")?.id || "");
  }, [datasets.data, dataset]);
  const ask = async (q = question) => {
    if (!q.trim() || busy || !dataset) return;
    setBusy(true);
    setError("");
    try {
      const last = answers.at(-1)?.answer;
      const a = await api<AnalystAnswer>(`${base}/analyst`, {
        method: "POST",
        body: JSON.stringify({
          question: q,
          conversationId: last?.conversationId,
          datasetVersion: last?.result?.provenance.datasetVersion,
          ...(dataset !== "reference"
            ? { datasetId: dataset, dimension: dimension || undefined }
            : {}),
        }),
      });
      setAnswers((v) => [...v, { question: q, answer: a }]);
      setQuestion("");
      setTimeout(
        () =>
          messages.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          }),
        100,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = async (item: { question: string; answer: AnalystAnswer }) => {
    try {
      await api(`${base}/analyses`, {
        method: "POST",
        body: JSON.stringify({
          name: item.question.slice(0, 120),
          ...item.answer,
        }),
      });
      setSaved(item.answer.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="ios-analyst-layout">
      <div className="ios-analyst-main">
        <div className="ios-analyst-source">
          <Database size={16} />
          <label htmlFor="analyst-dataset">Analyze</label>
          <select
            id="analyst-dataset"
            value={dataset}
            onChange={(e) => {
              setDataset(e.target.value);
              setAnswers([]);
              setDimension("");
            }}
          >
            {datasets.data
              ?.filter((d) => ["ready", "stale"].includes(d.state))
              .map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
          <Badge tone="mint">Grounded queries</Badge>
        </div>
        {!answers.length && (
          <div className="ios-analyst-welcome">
            <span className="ios-analyst-orb">
              <Sparkles size={30} />
            </span>
            <span className="ios-eyebrow">
              YOUR DATA. A CLEARER PERSPECTIVE.
            </span>
            <h2>
              What would you like
              <br />
              to understand?
            </h2>
            <p>
              Explore a metric, compare a segment, or follow a pattern. Every
              answer comes with its evidence.
            </p>
            <div className="ios-question-grid">
              {(dataset === "reference"
                ? [
                    "Show billed revenue by month",
                    "What is net revenue retention for this period?",
                    "Show infrastructure cost by region",
                    "What is infrastructure-adjusted margin?",
                  ]
                : [
                    "How many rows are in this dataset?",
                    ...(catalog.data
                      ?.filter((m) => m.id.startsWith("sum:"))
                      .slice(0, 3)
                      .map((m) => `What is the sum of ${m.id.slice(4)}?`) ||
                      []),
                  ]
              ).map((q) => (
                <button
                  key={q}
                  disabled={!canWrite || busy}
                  onClick={() => void ask(q)}
                >
                  <Sparkles size={14} />
                  {q}
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          </div>
        )}
        {answers.map((item, i) => (
          <div className="ios-conversation-turn" key={item.answer.id}>
            <div className="ios-user-question">
              <span>YOU</span>
              <p>{item.question}</p>
            </div>
            <div className="ios-answer">
              <div className="ios-answer-heading">
                <span className="ios-small-orb">
                  <Sparkles size={16} />
                </span>
                <strong>Axiom Analyst</strong>
                <Badge
                  tone={item.answer.provider === "demo" ? "amber" : "violet"}
                >
                  {item.answer.provider === "demo"
                    ? "Deterministic planner"
                    : item.answer.model || "OpenAI"}
                </Badge>
                <span>{String(i + 1).padStart(2, "0")}</span>
              </div>
              <p>{item.answer.answer}</p>
              {item.answer.facts.length > 0 && (
                <div className="ios-answer-facts">
                  {item.answer.facts.slice(0, 6).map((f, j) => (
                    <div key={j}>
                      <span>{f.label}</span>
                      <strong>{f.value}</strong>
                      <small>{f.source}</small>
                    </div>
                  ))}
                </div>
              )}
              {item.answer.result && (
                <>
                  <DataTable
                    columns={item.answer.result.columns}
                    rows={item.answer.result.rows}
                  />
                  <ProvenanceBlock value={item.answer.result.provenance} />
                </>
              )}
              <details className="ios-answer-limits">
                <summary>Assumptions & limitations</summary>
                {item.answer.limitations.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </details>
              <div className="ios-answer-actions">
                <button
                  className="ios-button small"
                  disabled={!canWrite}
                  onClick={() => void save(item)}
                >
                  {saved === item.answer.id ? (
                    <Check size={13} />
                  ) : (
                    <Plus size={13} />
                  )}{" "}
                  {saved === item.answer.id
                    ? "Saved to workspace"
                    : "Save analysis"}
                </button>
                {item.answer.result && (
                  <ExportButton
                    base={base}
                    rows={item.answer.result.rows}
                    columns={item.answer.result.columns}
                    datasetVersion={
                      item.answer.result.provenance.datasetVersion
                    }
                    disabled={!canWrite}
                  />
                )}
                <span>
                  {item.answer.result?.durationMs ?? 0} ms
                  {item.answer.usage
                    ? ` · ${item.answer.usage.input + item.answer.usage.output} tokens`
                    : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
        <div ref={messages} />
        {error && <ErrorState message={error} />}
        <div className="ios-question-composer">
          {dataset !== "reference" && detail.data && (
            <label className="ios-dimension-label">
              Group by
              <select
                value={dimension}
                onChange={(e) => setDimension(e.target.value)}
              >
                <option value="">No grouping</option>
                {detail.data.fields.map((f) => (
                  <option key={f.name}>{f.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="sr-only" htmlFor="analyst-question">
            Ask your dataset a question
          </label>
          <textarea
            id="analyst-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your data…"
            maxLength={4000}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
          />
          <div>
            <span>
              <ShieldCheck size={12} />
              Scoped to your authorized dataset
            </span>
            <button
              className="ios-button primary small"
              onClick={() => void ask()}
              disabled={!canWrite || busy || !question.trim() || !dataset}
            >
              {busy ? "Analyzing…" : "Ask Axiom"}
              <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
        <p className="ios-composer-note">
          Calculations run in the query engine. Explanations do not establish
          causation.
        </p>
      </div>
      <aside className="ios-analyst-context">
        <Panel title="Your analytical context" eyebrow="IN THE KNOW">
          <div className="ios-context-item">
            <Database size={16} />
            <div>
              <span>Selected dataset</span>
              <strong>
                {datasets.data?.find((d) => d.id === dataset)?.name ||
                  "Choose a dataset"}
              </strong>
            </div>
          </div>
          <div className="ios-context-item">
            <GitBranch size={16} />
            <div>
              <span>Available definitions</span>
              <strong>{catalog.data?.length ?? 0} catalog metrics</strong>
            </div>
          </div>
          <div className="ios-context-divider" />
          <h3 className="ios-small-title">EXPLORE A DEFINITION</h3>
          <div className="ios-context-metrics">
            {catalog.data?.slice(0, 12).map((m) => (
              <details key={m.id}>
                <summary>
                  {m.name}
                  <ChevronDown size={12} />
                </summary>
                <p>{m.description}</p>
                <code>{m.formula}</code>
              </details>
            ))}
          </div>
          <div className="ios-insight-callout">
            <ShieldCheck size={16} />
            <p>
              Every query is validated and executed within your workspace
              permissions.
            </p>
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function LabSection({ base, filters }: { base: string; filters: Filters }) {
  const [kind, setKind] = useState("forecast"),
    [growth, setGrowth] = useState(10),
    [reduction, setReduction] = useState(15),
    [scenario, setScenario] = useState({ growth: 10, costReduction: 15 });
  const params = new URLSearchParams({
    ...(Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v),
    ) as Record<string, string>),
    kind,
    ...(kind === "scenario"
      ? {
          growth: String(scenario.growth),
          costReduction: String(scenario.costReduction),
        }
      : {}),
  });
  const r = useResource<LabResult>(`${base}/lab?${params}`);
  const kinds = [
    ["forecast", "Forecasting"],
    ["anomalies", "Anomalies"],
    ["cohorts", "Cohorts"],
    ["funnel", "Funnels"],
    ["segments", "Contribution"],
    ["comparison", "Comparisons"],
    ["scenario", "Scenarios"],
  ];
  return (
    <>
      <div className="ios-tabs" role="group" aria-label="Analysis method">
        {kinds.map(([id, label]) => (
          <button
            key={id}
            aria-pressed={kind === id}
            className={kind === id ? "active" : ""}
            onClick={() => setKind(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === "scenario" && (
        <Panel title="Make your assumptions explicit">
          <div className="ios-transform-controls">
            <label className="ios-field">
              Revenue growth (%)
              <input
                type="number"
                min="-90"
                max="200"
                value={growth}
                onChange={(e) => setGrowth(Number(e.target.value))}
              />
            </label>
            <label className="ios-field">
              Infrastructure cost reduction (%)
              <input
                type="number"
                min="-100"
                max="100"
                value={reduction}
                onChange={(e) => setReduction(Number(e.target.value))}
              />
            </label>
            <button
              className="ios-button primary"
              onClick={() => setScenario({ growth, costReduction: reduction })}
            >
              <Play size={14} />
              Calculate scenario
            </button>
          </div>
        </Panel>
      )}
      {r.loading ? (
        <Loading label={`Running ${kind} analysis`} />
      ) : r.error ? (
        <ErrorState message={r.error} />
      ) : (
        r.data && (
          <>
            <Panel
              title={r.data.title}
              eyebrow="REPRODUCIBLE ANALYSIS"
              action={
                <ExportButton
                  base={base}
                  rows={r.data.rows}
                  columns={r.data.columns}
                  datasetVersion={r.data.provenance.datasetVersion}
                />
              }
            >
              <p className="ios-panel-description">{r.data.description}</p>
              <div className="ios-lab-statistics">
                {Object.entries(r.data.statistics).map(([key, value]) => (
                  <div key={key}>
                    <span>{key.replace(/([A-Z])/g, " $1")}</span>
                    <strong>{format(value)}</strong>
                  </div>
                ))}
              </div>
              {kind === "forecast" && r.data.rows.length > 0 && (
                <div className="ios-forecast-cards">
                  {r.data.rows.map((row, i) => (
                    <div key={i}>
                      <span>{String(row.month)}</span>
                      <strong>{format(row.forecast, "USD")}</strong>
                      <small>95% interval</small>
                      <span>
                        {format(row.lower, "USD")} – {format(row.upper, "USD")}
                      </span>
                      <div className="ios-interval">
                        <i style={{ left: "15%", right: "15%" }} />
                        <b />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <DataTable columns={r.data.columns} rows={r.data.rows} />
              {r.data.warnings.map((w) => (
                <p key={w} className="ios-warning">
                  {w}
                </p>
              ))}
            </Panel>
            <ProvenanceBlock value={r.data.provenance} />
          </>
        )
      )}
    </>
  );
}
function CatalogSection({ base }: { base: string }) {
  const metrics = useResource<MetricDefinition[]>(`${base}/catalog`),
    lineage = useResource<{
      nodes: { id: string; label: string; kind: string; version: string }[];
      edges: { from: string; to: string }[];
      note: string;
    }>(`${base}/lineage`),
    [search, setSearch] = useState("");
  return (
    <>
      <Panel
        title="The intelligence graph"
        eyebrow="SOURCE → DEFINITION → DECISION"
        action={<Badge tone="violet">Versioned lineage</Badge>}
      >
        {lineage.loading ? (
          <Loading />
        ) : lineage.error ? (
          <ErrorState message={lineage.error} />
        ) : (
          <>
            <div className="ios-lineage">
              <div className="ios-lineage-source">
                <Database size={22} />
                <strong>Fact events</strong>
                <small>
                  Invoices · Usage · Costs
                  <br />
                  Subscription snapshots
                </small>
                <Badge tone="mint">Immutable source</Badge>
              </div>
              <div className="ios-lineage-connector" aria-hidden="true">
                →
              </div>
              <div className="ios-lineage-metrics">
                {metrics.data?.map((m) => (
                  <div key={m.id}>
                    <GitBranch size={13} />
                    {m.name}
                  </div>
                ))}
              </div>
              <div className="ios-lineage-connector" aria-hidden="true">
                →
              </div>
              <div className="ios-lineage-destination">
                <LayoutDashboard size={23} />
                <strong>Executive overview</strong>
                <small>
                  Saved views · Analyses
                  <br />
                  Configured report mappings
                </small>
                <Badge tone="blue">Authorized consumers</Badge>
              </div>
            </div>
            <p className="ios-panel-description">{lineage.data?.note}</p>
            <details className="ios-source-hash">
              <summary>Inspect lineage edges and dataset nodes</summary>
              <pre className="ios-code">
                {JSON.stringify(lineage.data, null, 2)}
              </pre>
            </details>
          </>
        )}
      </Panel>
      <div className="ios-section-title">
        <div>
          <span className="ios-eyebrow">A SHARED LANGUAGE</span>
          <h2>Metric catalog</h2>
        </div>
        <label className="ios-search-field">
          <Search size={16} />
          <input
            aria-label="Search metric definitions"
            placeholder="Find a metric…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {metrics.error ? (
        <ErrorState message={metrics.error} />
      ) : (
        <div className="ios-metric-catalog">
          {metrics.data
            ?.filter((m) =>
              (m.name + " " + m.description)
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((m) => (
              <article className="ios-panel ios-metric-definition" key={m.id}>
                <div>
                  <span className="ios-metric-icon">
                    <Activity size={18} />
                  </span>
                  <Badge>{m.unit}</Badge>
                </div>
                <h3>{m.name}</h3>
                <p>{m.description}</p>
                <code>{m.formula}</code>
                <footer>
                  <span>{m.owner}</span>
                  <span>{m.version}</span>
                </footer>
              </article>
            ))}
        </div>
      )}
    </>
  );
}

function EvaluationSection({
  base,
  canWrite,
}: {
  base: string;
  canWrite: boolean;
}) {
  const [refresh, setRefresh] = useState(0),
    [provider, setProvider] = useState("demo"),
    [job, setJob] = useState<JobRecord | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [category, setCategory] = useState(""),
    [compare, setCompare] = useState("");
  const runs = useResource<EvaluationRun[]>(`${base}/evaluations`, refresh),
    session = useResource<{ connections: { openai: string } }>("/api/session");
  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;
    const timer = setInterval(() => {
      api<JobRecord>(`${base}/jobs/${job.id}`)
        .then((j) => {
          setJob(j);
          if (j.status === "completed") {
            setRefresh((v) => v + 1);
            setSelected((j.result as EvaluationRun)?.id || "");
          }
          if (j.status === "failed") setError(j.error || "Evaluation failed.");
        })
        .catch((e) => setError(e.message));
    }, 1500);
    return () => clearInterval(timer);
  }, [job, base]);
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const j = await api<JobRecord>(`${base}/evaluations`, {
        method: "POST",
        body: JSON.stringify({ provider, trials: 1 }),
      });
      setJob(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const run = runs.data?.find((r) => r.id === selected) || runs.data?.[0],
    other = runs.data?.find((r) => r.id === compare);
  const passed = run?.cases.filter((c) => c.passed).length || 0;
  return (
    <>
      <div className="ios-evaluation-intro">
        <div>
          <span className="ios-eyebrow">A REPRODUCIBLE STANDARD</span>
          <h2>
            Known data.
            <br />
            <em>Measurable answers.</em>
          </h2>
          <p>
            32 cases test calculations, provenance, statistical methods,
            ambiguity, and security boundaries against independent reference
            results.
          </p>
          <div className="ios-eval-chips">
            <Badge tone="mint">200k+ reference facts</Badge>
            <Badge tone="blue">36 months</Badge>
            <Badge tone="violet">3 isolated organizations</Badge>
          </div>
        </div>
        <div className="ios-eval-runner">
          <span className="ios-eyebrow">RUN AN EVALUATION</span>
          <label className="ios-field">
            Provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="demo">Deterministic pipeline baseline</option>
              <option
                value="openai"
                disabled={session.data?.connections.openai !== "configured"}
              >
                Connected OpenAI model
                {session.data?.connections.openai !== "configured"
                  ? " · Not configured"
                  : ""}
              </option>
            </select>
          </label>
          <button
            className="ios-button primary"
            disabled={
              !canWrite ||
              busy ||
              (!!job && ["queued", "running"].includes(job.status))
            }
            onClick={() => void start()}
          >
            <Play size={15} />
            {job && ["queued", "running"].includes(job.status)
              ? `Running · ${job.progress}%`
              : "Run benchmark suite"}
            <ArrowRight size={15} />
          </button>
          <small>
            {provider === "demo"
              ? "The baseline tests the analytical pipeline. It is not an AI model capability score."
              : "Runs use the configured model and incur provider charges. Results record actual usage."}
          </small>
          {job && (
            <div className="ios-job-progress">
              <div className="ios-progress-track">
                <span style={{ width: `${job.progress}%` }} />
              </div>
              <span>
                {job.status} · {job.progress}%
              </span>
            </div>
          )}
        </div>
      </div>
      {error && <ErrorState message={error} />}
      <div className="ios-section-title">
        <div>
          <span className="ios-eyebrow">MEASURE, INSPECT, COMPARE</span>
          <h2>Evaluation results</h2>
        </div>
        <div>
          <select
            aria-label="Choose evaluation run"
            value={run?.id || ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setCategory("");
            }}
          >
            {runs.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {when(r.createdAt)} · {r.provider}
              </option>
            ))}
          </select>
          <select
            aria-label="Compare evaluation run"
            value={compare}
            onChange={(e) => setCompare(e.target.value)}
          >
            <option value="">Compare with…</option>
            {runs.data
              ?.filter((r) => r.id !== run?.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {when(r.createdAt)} · {r.provider}
                </option>
              ))}
          </select>
        </div>
      </div>
      {runs.loading ? (
        <Loading />
      ) : runs.error ? (
        <ErrorState message={runs.error} />
      ) : !run ? (
        <Empty
          title="Your first benchmark starts here"
          description="Run the reference suite to inspect numerical correctness, provenance, and security behavior."
        />
      ) : (
        <>
          <div className="ios-eval-summary">
            <div className="ios-eval-score">
              <span className="ios-eyebrow">
                {run.provider === "demo"
                  ? "PIPELINE BASELINE"
                  : "CONNECTED MODEL"}
              </span>
              <strong>
                {passed}
                <span>/{run.cases.length}</span>
              </strong>
              <span>cases passed</span>
              <Badge
                tone={
                  run.status === "security-failed" || run.status === "failed"
                    ? "red"
                    : run.status === "incomplete"
                      ? "amber"
                      : "mint"
                }
              >
                {run.status}
              </Badge>
            </div>
            <div className="ios-eval-breakdown">
              <div>
                <strong>{run.label}</strong>
                <span>{run.model}</span>
              </div>
              {run.categories.map((c) => (
                <div className="ios-category-bar" key={c.name}>
                  <span>
                    {c.name}
                    <small>{c.weight}% weight</small>
                  </span>
                  <div className="ios-progress-track">
                    <span
                      style={{
                        width: `${c.score ?? 0}%`,
                        background:
                          c.score === null
                            ? "#454c58"
                            : c.score < 100
                              ? "#e9b26b"
                              : "#75e2bd",
                      }}
                    />
                  </div>
                  <strong>
                    {c.score === null ? "Unscored" : `${c.score.toFixed(0)}%`}
                    {other && (
                      <small>
                        {" "}
                        /{" "}
                        {other.categories
                          .find((v) => v.name === c.name)
                          ?.score?.toFixed(0) ?? "—"}
                        %
                      </small>
                    )}
                  </strong>
                </div>
              ))}
              <p className="ios-muted">
                Weighted score:{" "}
                {run.score === null
                  ? "Incomplete — unavailable evidence receives no assumed credit."
                  : `${run.score.toFixed(1)} / 100`}
                . A critical security failure overrides the score.
              </p>
            </div>
          </div>
          <div className="ios-eval-metadata">
            <span>{run.datasetVersion}</span>
            <span>Prompt: {run.promptVersion}</span>
            <span>{(run.durationMs / 1000).toFixed(1)} s</span>
            <span>
              {run.usage
                ? `${run.usage.input + run.usage.output} provider tokens`
                : "Usage unrecorded"}
            </span>
            <span>
              Cost:{" "}
              {run.usage?.estimatedCost == null
                ? "Not available"
                : format(run.usage.estimatedCost, "USD")}
            </span>
          </div>
          <Panel
            title="Inspect every answer"
            action={
              <select
                aria-label="Filter benchmark category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {[...new Set(run.cases.map((c) => c.category))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            }
          >
            <div className="ios-benchmark-cases">
              {run.cases
                .filter((c) => !category || c.category === category)
                .map((c) => (
                  <details key={c.id}>
                    <summary>
                      <span
                        className={`ios-case-result ${c.passed ? "passed" : "failed"}`}
                      >
                        {c.passed ? <Check size={14} /> : <X size={14} />}
                      </span>
                      <div>
                        <strong>{c.question}</strong>
                        <small>
                          {c.category}
                          {c.critical ? " · Critical safety control" : ""}
                        </small>
                      </div>
                      <span>{c.durationMs} ms</span>
                      <ChevronDown size={14} />
                    </summary>
                    <div className="ios-case-detail">
                      <p>{c.explanation}</p>
                      <div>
                        <section>
                          <strong>Expected</strong>
                          <pre>{JSON.stringify(c.expected, null, 2)}</pre>
                        </section>
                        <section>
                          <strong>Observed</strong>
                          <pre>{JSON.stringify(c.actual, null, 2)}</pre>
                        </section>
                      </div>
                    </div>
                  </details>
                ))}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
function ReportsSection({
  base,
  workspaceId,
  filters,
}: {
  base: string;
  workspaceId: string;
  filters: Filters;
}) {
  const reports = useResource<
      {
        key: string;
        name: string;
        description: string;
        state: string;
        pages: string[];
      }[]
    >(`${base}/reports`),
    [selected, setSelected] = useState("");
  return (
    <>
      {reports.loading ? (
        <Loading />
      ) : reports.error ? (
        <ErrorState message={reports.error} />
      ) : reports.data?.length ? (
        <>
          <div className="ios-report-picker">
            {reports.data.map((r) => (
              <button
                key={r.key}
                className={
                  (selected || reports.data![0].key) === r.key ? "active" : ""
                }
                onClick={() => setSelected(r.key)}
              >
                <BarChart3 size={20} />
                <div>
                  <strong>{r.name}</strong>
                  <span>
                    {r.pages.length} report pages · {r.state}
                  </span>
                </div>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
          <PowerBIView
            workspaceId={workspaceId}
            reportKey={selected || reports.data[0].key}
            filters={filters}
          />
        </>
      ) : (
        <Empty
          title="No reports are assigned"
          description="Your administrator can assign a Power BI report to this workspace."
        />
      )}
    </>
  );
}
function GovernanceSection({
  base,
  role,
  userId,
}: {
  base: string;
  role: Role;
  userId: string;
}) {
  const [refresh, setRefresh] = useState(0),
    [error, setError] = useState("");
  const audit = useResource<Record<string, unknown>[]>(
      `${base}/audit`,
      refresh,
    ),
    jobs = useResource<JobRecord[]>(`${base}/jobs`, refresh),
    members = useResource<
      { userId: string; role: Role; name: string; email: string }[]
    >(
      ["administrator", "owner"].includes(role) ? `${base}/memberships` : null,
      refresh,
    ),
    saved = useResource<Saved[]>(`${base}/analyses`, refresh);
  useEffect(() => {
    if (jobs.data?.some((j) => ["queued", "running"].includes(j.status))) {
      const timer = setInterval(() => setRefresh((v) => v + 1), 2000);
      return () => clearInterval(timer);
    }
  }, [jobs.data]);
  const cancel = async (id: string) => {
    try {
      await api(`${base}/jobs/${id}/cancel`, { method: "POST", body: "{}" });
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const update = async (id: string, next: string) => {
    try {
      await api(`${base}/memberships`, {
        method: "POST",
        body: JSON.stringify({ userId: id, role: next }),
      });
      setRefresh((v) => v + 1);
      if (id === userId) location.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      {error && <ErrorState message={error} />}
      <div className="ios-governance-top">
        <Panel title="Workspace permissions" eyebrow="SERVER-ENFORCED ACCESS">
          <div className="ios-permission-profile">
            <ShieldCheck size={26} />
            <div>
              <strong>Your role: {role}</strong>
              <p>
                Membership is checked on every request and background operation.
              </p>
            </div>
            <Badge tone="mint">Active</Badge>
          </div>
          {members.data && (
            <div className="ios-members">
              {members.data.map((m) => (
                <div key={m.userId}>
                  <span className="ios-avatar small">{m.name[0]}</span>
                  <div>
                    <strong>{m.name}</strong>
                    <small>{m.email}</small>
                  </div>
                  <select
                    aria-label={`Role for ${m.name}`}
                    value={m.role}
                    disabled={m.role === "owner" && role !== "owner"}
                    onChange={(e) => void update(m.userId, e.target.value)}
                  >
                    {[
                      "viewer",
                      "analyst",
                      "administrator",
                      ...(role === "owner" ? ["owner"] : []),
                    ].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
          {members.error && <ErrorState message={members.error} />}
          <p className="ios-panel-description">
            Viewers read. Analysts import and analyze. Administrators manage
            integrations and members. Owners control workspace ownership.
          </p>
        </Panel>
        <Panel
          title="Background operations"
          eyebrow="DURABLE JOB QUEUE"
          action={
            <button
              className="ios-button small"
              onClick={() => setRefresh((v) => v + 1)}
            >
              Refresh
            </button>
          }
        >
          {jobs.error ? (
            <ErrorState message={jobs.error} />
          ) : !jobs.data?.length ? (
            <Empty
              title="All clear"
              description="Imports, evaluations, and report operations appear here."
            />
          ) : (
            <div className="ios-job-list">
              {jobs.data.slice(0, 8).map((j) => (
                <div key={j.id}>
                  <div>
                    <strong>{j.kind}</strong>
                    <small>{when(j.createdAt)}</small>
                    {j.error && <p className="ios-warning">{j.error}</p>}
                  </div>
                  <Badge
                    tone={
                      j.status === "failed"
                        ? "red"
                        : j.status === "completed"
                          ? "mint"
                          : "amber"
                    }
                  >
                    {j.status} {j.progress}%
                  </Badge>
                  {role !== "viewer" &&
                    ["queued", "running"].includes(j.status) && (
                      <button
                        className="ios-icon-button"
                        aria-label={`Cancel ${j.kind}`}
                        onClick={() => void cancel(j.id)}
                      >
                        <X size={14} />
                      </button>
                    )}
                  {j.status === "completed" &&
                    !!(j.result as { downloadUrl?: string })?.downloadUrl && (
                      <a
                        className="ios-button small"
                        href={(j.result as { downloadUrl: string }).downloadUrl}
                      >
                        <Download size={13} />
                        Download
                      </a>
                    )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Shared analytical work" eyebrow="SAVED TO THIS WORKSPACE">
        {saved.data?.length ? (
          <div className="ios-saved-analyses">
            {saved.data.map((a) => (
              <details key={a.id}>
                <summary>
                  <MessageSquare size={16} />
                  <strong>
                    {String(a.data.name || a.data.question || "Saved analysis")}
                  </strong>
                  <small>{when(a.updatedAt)}</small>
                  <ChevronDown size={14} />
                </summary>
                <div>
                  <p>{String(a.data.answer || "")}</p>
                  <pre className="ios-code">
                    {JSON.stringify(a.data.result || a.data, null, 2)}
                  </pre>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="ios-panel-description">
            Save an answer from the AI Analyst to share its query and evidence
            with workspace members.
          </p>
        )}
      </Panel>
      <Panel title="Audit history" eyebrow="A TRACEABLE RECORD">
        {audit.loading ? (
          <Loading />
        ) : audit.error ? (
          <ErrorState message={audit.error} />
        ) : (
          <DataTable
            columns={["createdAt", "actorId", "action", "resourceId", "detail"]}
            rows={audit.data || []}
          />
        )}
      </Panel>
    </>
  );
}
