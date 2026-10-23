"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  ChevronDown,
  Database,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { Provenance } from "@/lib/intelligence/contracts";

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({
    error: { message: `Request failed (${response.status}).` },
  }));
  if (!response.ok)
    throw new Error(
      data.error?.message ||
        data.message ||
        `Request failed (${response.status}).`,
    );
  return data as T;
}
export function useResource<T>(url: string | null, refresh = 0) {
  const [state, setState] = useState<{
    data: T | null;
    error: string;
    loading: boolean;
  }>({ data: null, error: "", loading: !!url });
  useEffect(() => {
    if (!url) {
      setState({ data: null, error: "", loading: false });
      return;
    }
    const controller = new AbortController();
    setState({ data: null, error: "", loading: true });
    api<T>(url, { signal: controller.signal })
      .then((data) => setState({ data, error: "", loading: false }))
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ data: null, error: error.message, loading: false });
      });
    return () => controller.abort();
  }, [url, refresh]);
  return state;
}
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="ios-feedback ios-error" role="alert">
      <AlertCircle size={18} />
      <div>
        <strong>We couldn’t complete this request.</strong>
        <p>{message}</p>
        {onRetry && (
          <button className="ios-link" onClick={onRetry}>
            <RefreshCw size={13} />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Loading({
  label = "Retrieving workspace data",
}: {
  label?: string;
}) {
  return (
    <div className="ios-loading" role="status">
      <Loader2 size={22} className="ios-spin" />
      <span>
        {label}
        <small>Resolving your authorized data sources</small>
      </span>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ios-empty">
      <span className="ios-empty-icon">
        <Database size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ios-panel ${className}`}>
      {(title || action) && (
        <header className="ios-panel-heading">
          <div>
            {eyebrow && <span className="ios-eyebrow">{eyebrow}</span>}
            {title && <h2>{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "mint" | "violet" | "blue" | "amber" | "neutral" | "red";
}) {
  return <span className={`ios-badge ios-${tone}`}>{children}</span>;
}
export function format(value: unknown, unit?: string): string {
  if (value === null || value === undefined) return "Unavailable";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "Unavailable";
    if (unit === "USD")
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: value < 1000 ? 2 : 0,
      }).format(value);
    if (unit === "percent")
      return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
export function shortNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
export function when(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
export function DataTable({
  columns,
  rows,
  caption = "Analysis results",
  maxRows = 100,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  caption?: string;
  maxRows?: number;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows]);
  const pages = Math.max(1, Math.ceil(rows.length / maxRows));
  const visible = rows.slice(page * maxRows, (page + 1) * maxRows);
  return (
    <>
      <div
        className="ios-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={caption}
      >
        <table className="ios-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col">
                  {c.replaceAll("_", " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c} title={format(row[c])}>
                    {format(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="ios-table-empty">No rows match these filters.</p>
        )}
      </div>
      {pages > 1 && (
        <div className="ios-pagination">
          <span>
            {rows.length.toLocaleString()} rows · Page {page + 1} of {pages}
          </span>
          <div>
            <button
              className="ios-button small"
              disabled={page === 0}
              onClick={() => setPage((v) => v - 1)}
            >
              Previous
            </button>
            <button
              className="ios-button small"
              disabled={page === pages - 1}
              onClick={() => setPage((v) => v + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export function ProvenanceBlock({ value }: { value: Provenance }) {
  return (
    <details className="ios-provenance">
      <summary>
        <Database size={14} />
        <span>Source & calculation provenance</span>
        <Badge tone={value.sourceState === "stale" ? "amber" : "mint"}>
          {value.sourceState === "stale" ? "Stale source" : "Versioned"}
        </Badge>
        <ChevronDown size={14} />
      </summary>
      <div className="ios-provenance-body">
        <dl>
          <div>
            <dt>Dataset version</dt>
            <dd>{value.datasetVersion}</dd>
          </div>
          <div>
            <dt>Metric version</dt>
            <dd>{value.metricVersion}</dd>
          </div>
          <div>
            <dt>Calculated</dt>
            <dd>{when(value.generatedAt)}</dd>
          </div>
          {value.sourceRefreshedAt && (
            <div>
              <dt>Source refreshed</dt>
              <dd>
                {when(value.sourceRefreshedAt)}
                {value.sourceState === "stale" ? " · stale" : ""}
              </dd>
            </div>
          )}
          {value.refreshIntervalHours !== undefined && (
            <div>
              <dt>Refresh interval</dt>
              <dd>{value.refreshIntervalHours} hours</dd>
            </div>
          )}
          <div>
            <dt>Sources</dt>
            <dd>{value.sources.join(", ")}</dd>
          </div>
        </dl>
        <p>
          Filters:{" "}
          {Object.entries(value.filters)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ") || "All authorized records"}
        </p>
        {value.warnings.map((w, i) => (
          <p key={i} className="ios-warning">
            {w}
          </p>
        ))}
        {value.query && <pre className="ios-code">{value.query}</pre>}
      </div>
    </details>
  );
}
export function ExportButton({
  base,
  rows,
  columns,
  name = "axiom-analysis.csv",
  datasetVersion,
  disabled = false,
}: {
  base: string;
  rows: Record<string, unknown>[];
  columns: string[];
  name?: string;
  datasetVersion?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const download = async () => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${base}/exports`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, columns, filename: name, datasetVersion }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error?.message || `Export failed (${response.status}).`,
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download =
        response.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] || name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Snapshot downloaded; export recorded.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The export could not complete.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <span>
      <button
        className="ios-button small"
        onClick={() => void download()}
        disabled={disabled || busy || !rows.length}
        aria-busy={busy}
        title="Export the displayed snapshot; permission and audit are checked on the server."
      >
        {busy ? (
          <Loader2 size={14} className="ios-spin" />
        ) : (
          <ArrowDownToLine size={14} />
        )}
        {busy ? "Exporting…" : "Export CSV"}
      </button>
      {error && (
        <span className="ios-warning" role="alert">
          {error}
        </span>
      )}
      <span className="sr-only" role="status">
        {status}
      </span>
    </span>
  );
}
