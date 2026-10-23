"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Report, Embed } from "powerbi-client";
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  Database,
  Download,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type {
  EmbedConfiguration,
  Filters,
  JobRecord,
  Overview,
} from "@/lib/intelligence/contracts";
import {
  Badge,
  DataTable,
  ErrorState,
  Loading,
  Panel,
  api,
  format,
} from "./ui";
const Embedded = dynamic(
  () => import("powerbi-client-react").then((m) => m.PowerBIEmbed),
  {
    ssr: false,
    loading: () => <Loading label="Loading Microsoft report SDK" />,
  },
);
type Props = {
  workspaceId: string;
  reportKey: string;
  filters?: Filters;
  onFiltersChange?: (filters: Filters) => void;
};
export function PowerBIView({
  workspaceId,
  reportKey,
  filters = {},
  onFiltersChange,
}: Props) {
  const base = `/api/v1/workspaces/${workspaceId}/reports/${reportKey}`;
  const [config, setConfig] = useState<EmbedConfiguration | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pages, setPages] = useState<
      { name: string; displayName: string; isActive: boolean }[]
    >([]),
    [bookmarks, setBookmarks] = useState<
      { name: string; displayName: string }[]
    >([]),
    [ready, setReady] = useState(false),
    [sdkReady, setSdkReady] = useState(false),
    [status, setStatus] = useState<unknown>(null);
  const report = useRef<Report | null>(null),
    renewing = useRef<Promise<void> | null>(null),
    expiration = useRef("");
  useEffect(() => {
    void import("powerbi-client").then(() => setSdkReady(true));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setConfig(null);
    setError("");
    setReady(false);
    report.current = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const renew = () => {
      if (renewing.current) return renewing.current;
      renewing.current = (async () => {
        try {
          const next = await api<EmbedConfiguration>(`${base}/embed-config`, {
            method: "POST",
            body: "{}",
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          if (next.mode === "connected" && report.current && next.embedToken)
            await report.current.setAccessToken(next.embedToken);
          expiration.current = next.expiresAt || "";
          setConfig(next);
          if (next.expiresAt)
            timer = setTimeout(
              () => void renew(),
              Math.max(10000, Date.parse(next.expiresAt) - Date.now() - 90000),
            );
        } catch (e) {
          if (!controller.signal.aborted) setError((e as Error).message);
        } finally {
          renewing.current = null;
        }
      })();
      return renewing.current;
    };
    void renew();
    const visible = () => {
      if (
        document.visibilityState === "visible" &&
        expiration.current &&
        Date.parse(expiration.current) - Date.now() < 120000
      ) {
        if (timer) clearTimeout(timer);
        void renew();
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
      renewing.current = null;
    };
  }, [base]);
  const sync = useCallback(async () => {
    if (!report.current || !ready) return;
    try {
      const sdk = await import("powerbi-client");
      const result: import("powerbi-models").IFilter[] = [];
      if (filters.from || filters.to)
        result.push({
          $schema: "http://powerbi.com/product/schema#advanced",
          target: { table: "Date", column: "Date" },
          filterType: sdk.models.FilterType.Advanced,
          logicalOperator: "And",
          conditions: [
            ...(filters.from
              ? [
                  {
                    operator: "GreaterThanOrEqual" as const,
                    value: filters.from + "T00:00:00Z",
                  },
                ]
              : []),
            ...(filters.to
              ? [
                  {
                    operator: "LessThanOrEqual" as const,
                    value: filters.to + "T23:59:59Z",
                  },
                ]
              : []),
          ],
        } as import("powerbi-models").IAdvancedFilter);
      for (const [key, table] of [
        ["region", "Region"],
        ["plan", "Plan"],
      ] as const)
        if (filters[key])
          result.push({
            $schema: "http://powerbi.com/product/schema#basic",
            target: { table, column: "Name" },
            operator: "In",
            values: [filters[key]!],
            filterType: sdk.models.FilterType.Basic,
          } as import("powerbi-models").IBasicFilter);
      await report.current.updateFilters(
        sdk.models.FiltersOperations.ReplaceAll,
        result,
      );
      setMessage("Application filters synchronized with the report.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Report filters could not be applied.",
      );
    }
  }, [filters.from, filters.to, filters.region, filters.plan, ready]);
  useEffect(() => {
    if (ready) void sync();
  }, [sync, ready]);
  const capture = async () => {
    if (!report.current || !onFiltersChange) return;
    try {
      const values = await report.current.getFilters();
      const next: Filters = {};
      for (const raw of values) {
        const f = raw as unknown as {
          target: { table?: string; column?: string };
          values?: string[];
          conditions?: { operator: string; value: string }[];
        };
        if (f.target.table === "Date")
          for (const c of f.conditions || []) {
            if (c.operator === "GreaterThanOrEqual")
              next.from = String(c.value).slice(0, 10);
            if (c.operator === "LessThanOrEqual")
              next.to = String(c.value).slice(0, 10);
          }
        if (f.values?.length === 1 && f.target.column === "Name") {
          if (f.target.table === "Region") next.region = String(f.values[0]);
          if (f.target.table === "Plan") next.plan = String(f.values[0]);
        }
      }
      onFiltersChange({ ...filters, ...next });
      setMessage(
        "Recognized date and single-segment filters copied to the application. Other visual filters stay in Power BI.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const operation = async (action: "export" | "refresh") => {
    setError("");
    try {
      const job = await api<JobRecord>(`${base}/${action}`, {
        method: "POST",
        body: JSON.stringify(
          action === "export" ? { format: "PDF", filters } : {},
        ),
      });
      setMessage(
        `${action === "export" ? "Export" : "Refresh"} queued (${job.id.slice(0, 8)}). Track progress in Governance.`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (error && !config) return <ErrorState message={error} />;
  if (!config) return <Loading label="Authorizing report access" />;
  if (config.mode === "demo")
    return (
      <DemoReport
        workspaceId={workspaceId}
        filters={filters}
        message={config.message || ""}
      />
    );
  return (
    <Panel
      title="Power BI workspace report"
      eyebrow="MICROSOFT POWER BI EMBEDDED"
      action={<Badge tone="mint">Server-authorized access</Badge>}
    >
      <div className="ios-bi-toolbar">
        <select
          aria-label="Report page"
          disabled={!ready}
          onChange={(e) => void report.current?.setPage(e.target.value)}
          defaultValue=""
        >
          <option value="" disabled>
            Report page
          </option>
          {pages.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName}
            </option>
          ))}
        </select>
        <select
          aria-label="Report bookmark"
          disabled={!ready}
          defaultValue=""
          onChange={(e) =>
            void report.current?.bookmarksManager.apply(e.target.value)
          }
        >
          <option value="" disabled>
            Bookmarks
          </option>
          {bookmarks.map((b) => (
            <option key={b.name} value={b.name}>
              {b.displayName}
            </option>
          ))}
        </select>
        <button
          className="ios-button small"
          disabled={!ready}
          onClick={() => void capture()}
        >
          Use report filters
        </button>
        <button
          className="ios-button small"
          disabled={!ready || !config.capabilities.export}
          onClick={() => void operation("export")}
        >
          <Download size={14} />
          Export PDF
        </button>
        <button
          className="ios-button small"
          disabled={!ready || !config.capabilities.refresh}
          onClick={() => void operation("refresh")}
        >
          <RefreshCw size={14} />
          Refresh model
        </button>
        <button
          className="ios-button small"
          onClick={() =>
            void api(`${base}/status`)
              .then(setStatus)
              .catch((e) => setError(e.message))
          }
        >
          Refresh history
        </button>
      </div>
      {error && <ErrorState message={error} />}
      <div className="ios-bi-frame">
        {sdkReady && (
          <Embedded
            embedConfig={{
              type: "report",
              id: config.reportId,
              embedUrl: config.embedUrl,
              accessToken: config.embedToken,
              tokenType: 1,
              permissions: 0,
              settings: {
                panes: {
                  filters: { visible: true },
                  pageNavigation: { visible: false },
                },
                background: 1,
              },
            }}
            cssClassName="ios-embedded-report"
            getEmbeddedComponent={(component: Embed) => {
              report.current = component as Report;
            }}
            eventHandlers={
              new Map([
                [
                  "loaded",
                  async () => {
                    setReady(true);
                    if (report.current) {
                      setPages(await report.current.getPages());
                      setBookmarks(
                        await report.current.bookmarksManager.getBookmarks(),
                      );
                    }
                  },
                ],
                [
                  "error",
                  (event?: { detail?: unknown }) => {
                    setError(
                      String(
                        (event?.detail as { message?: string })?.message ||
                          "Microsoft report could not load.",
                      ),
                    );
                  },
                ],
              ])
            }
          />
        )}
      </div>
      {message && (
        <p className="ios-inline-message" role="status">
          {message}
        </p>
      )}
      {!!status && (
        <pre className="ios-code">{JSON.stringify(status, null, 2)}</pre>
      )}
      <p className="ios-muted">
        <ShieldCheck size={13} />
        Embed tokens renew through the authenticated server. Row-level security
        is independent of browser filters.
      </p>
    </Panel>
  );
}
function DemoReport({
  workspaceId,
  filters,
  message,
}: {
  workspaceId: string;
  filters: Filters;
  message: string;
}) {
  const [page, setPage] = useState("Executive Overview"),
    [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<Overview>(
      `/api/v1/workspaces/${workspaceId}/overview?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][])}`,
      { signal: controller.signal },
    )
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [workspaceId, filters.from, filters.to, filters.region, filters.plan]);
  return (
    <Panel
      title="Executive intelligence report"
      eyebrow="LOCAL REPORT PREVIEW"
      action={<Badge tone="amber">Power BI not connected</Badge>}
    >
      <p className="ios-panel-description">{message}</p>
      <div className="ios-tabs" role="group" aria-label="Preview report page">
        {[
          "Executive Overview",
          "Retention & Cohorts",
          "Infrastructure Economics",
          "Data Quality",
        ].map((p) => (
          <button
            key={p}
            className={page === p ? "active" : ""}
            aria-pressed={page === p}
            onClick={() => setPage(p)}
          >
            {p}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="ios-demo-report">
          <div className="ios-demo-report-title">
            <span>
              <BarChart3 size={20} />
              AXIOM <small>BUSINESS INTELLIGENCE</small>
            </span>
            <Badge tone="mint">Calculated reference data</Badge>
          </div>
          <h3>{page}</h3>
          <div className="ios-report-kpis">
            {data.metrics
              .filter((m) =>
                page.startsWith("Retention")
                  ? ["retention", "nrr", "customers"].includes(m.id)
                  : page.startsWith("Infrastructure")
                    ? ["cost", "margin", "usage"].includes(m.id)
                    : ["revenue", "mrr", "customers"].includes(m.id),
              )
              .map((m) => (
                <div key={m.id}>
                  <span>{m.label}</span>
                  <strong>{format(m.value, m.unit)}</strong>
                </div>
              ))}
          </div>
          {page === "Data Quality" ? (
            <div className="ios-report-quality">
              <Database size={28} />
              <strong>
                {data.rowCount.toLocaleString()} scoped reference facts
              </strong>
              <p>Immutable version: {data.provenance.datasetVersion}</p>
              <p>
                Seeded facts use a validated fixed schema. Imported data is
                profiled separately in the Data Workbench.
              </p>
            </div>
          ) : (
            <DataTable
              columns={
                page === "Infrastructure Economics"
                  ? ["month", "cost", "revenue"]
                  : ["month", "revenue", "mrr", "customers"]
              }
              rows={data.series}
            />
          )}
          <footer>
            <ShieldCheck size={13} />
            This preview uses Axiom calculations. A Microsoft report is loaded
            only in connected mode.
          </footer>
        </div>
      )}
      <div className="ios-bi-setup">
        <span>
          <Bookmark size={16} />
          Ready for your report estate
        </span>
        <a
          href="https://learn.microsoft.com/en-us/power-bi/developer/embedded/embed-service-principal"
          target="_blank"
          rel="noreferrer"
        >
          Power BI connection prerequisites
          <ArrowRight size={14} />
        </a>
      </div>
    </Panel>
  );
}
