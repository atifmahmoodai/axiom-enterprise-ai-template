import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import type {
  AnalyticalPlan,
  AnalysisResult,
  DatasetDetail,
  DatasetSummary,
  MetricDefinition,
  WorkspaceContext,
} from "@/lib/intelligence/contracts";
import { validateCompiledQuery } from "@/lib/intelligence/query";
import { METRIC_VERSION } from "@/lib/intelligence/metrics";
import { AppError, getResource, listResources, putResource } from "./db";
import { enqueueJob, type JobHandler } from "./jobs";
import { getFactSource } from "./fact-source";
import {
  MAX_UPLOAD_BYTES,
  reserveObject,
  runPython,
  storagePath,
  writeObject,
} from "./storage";

type StoredDataset = DatasetDetail & {
  canonicalKey?: string;
  originalKey?: string;
  extension?: string;
  ownerId: string;
  software?: unknown;
  parentDatasetId?: string;
};
type Profile = {
  rows: number;
  columns: number;
  fields: DatasetDetail["fields"];
  preview: DatasetDetail["preview"];
  warnings: string[];
  issues: number;
  hash: string;
  software: unknown;
};
function summary(d: StoredDataset): DatasetSummary {
  return {
    id: d.id,
    name: d.name,
    version: d.version,
    rows: d.rows,
    columns: d.columns,
    state: d.state,
    source: d.source,
    createdAt: d.createdAt,
    issues: d.issues,
  };
}
function detail(d: StoredDataset): DatasetDetail {
  return {
    ...summary(d),
    fields: d.fields,
    preview: d.preview,
    warnings: d.warnings,
    hash: d.hash,
    parentVersion: d.parentVersion,
    transformations: d.transformations,
  };
}
async function stored(ctx: WorkspaceContext, id: string) {
  const r = await getResource<StoredDataset>(ctx, "dataset", id);
  if (!r)
    throw new AppError(
      404,
      "dataset_not_found",
      "This dataset is not available in your workspace.",
    );
  return r.data;
}
export async function listDatasets(
  ctx: WorkspaceContext,
): Promise<DatasetSummary[]> {
  const all = (await listResources<StoredDataset>(ctx, "dataset")).map((r) =>
    summary(r.data),
  );
  const source = await getFactSource(ctx).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 503) return null;
    throw error;
  });
  if (source)
    all.push({
      id: "reference",
      name: source.name,
      version: source.version,
      rows: source.rows,
      columns: 14,
      state: source.stale ? "stale" : "ready",
      source: source.source,
      createdAt: source.refreshedAt,
      issues: source.stale ? 1 : 0,
    });
  return all;
}
export async function getDataset(
  ctx: WorkspaceContext,
  id: string,
): Promise<DatasetDetail> {
  if (id === "reference") {
    const source = await getFactSource(ctx);
    const { workspaceQuery } = await import("./db");
    const preview = await workspaceQuery(
      ctx,
      "SELECT occurred_at,customer_id,plan,region,event_type,amount_cents,cost_cents,mrr_cents,quantity FROM fact_events WHERE workspace_id=$1 AND dataset_version=$2 ORDER BY occurred_at,id LIMIT 30",
      [ctx.workspaceId, source.version],
    );
    return {
      id: "reference",
      name: source.name,
      version: source.version,
      rows: source.rows,
      columns: 14,
      state: source.stale ? "stale" : "ready",
      source: source.source,
      createdAt: source.refreshedAt,
      issues: source.stale ? 1 : 0,
      fields: Object.keys(preview[0] || {}).map((name) => ({
        name,
        type:
          name.endsWith("cents") || name === "quantity"
            ? "number"
            : name === "occurred_at"
              ? "date"
              : "text",
        missing: 0,
        unique: new Set(preview.map((r) => String(r[name]))).size,
        invalid: 0,
        examples: preview.slice(0, 3).map((r) => r[name]),
      })),
      preview,
      warnings: [
        "Field cardinalities describe this bounded preview, not the full canonical source.",
        source.source === "seeded"
          ? "Seeded reference data. UTC dates and USD integer-cent amounts."
          : `Connected canonical snapshot. USD integer cents, UTC dates and tokens. Last source refresh: ${source.refreshedAt}.`,
        ...(source.stale
          ? ["Source freshness exceeds its declared refresh interval."]
          : []),
      ],
      hash: source.hash,
      transformations: [],
    };
  }
  return detail(await stored(ctx, id));
}
export async function ingestFile(ctx: WorkspaceContext, file: File) {
  if (ctx.role === "viewer")
    throw new AppError(
      403,
      "upload_denied",
      "An analyst role is required to import data.",
    );
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (!extension || !["csv", "xlsx", "json", "parquet"].includes(extension))
    throw new AppError(
      422,
      "unsupported_format",
      "Choose CSV, XLSX, JSON or Parquet.",
    );
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES)
    throw new AppError(
      413,
      "upload_too_large",
      "Files must be between one byte and 50 MiB.",
    );
  const object = await writeObject(
    ctx.workspaceId,
    new Uint8Array(await file.arrayBuffer()),
  );
  const id = randomUUID();
  const data: StoredDataset = {
    id,
    name: file.name.slice(0, 180),
    version: "pending",
    rows: 0,
    columns: 0,
    state: "queued",
    source: "uploaded",
    createdAt: new Date().toISOString(),
    issues: 0,
    fields: [],
    preview: [],
    warnings: [],
    hash: object.hash,
    transformations: [],
    originalKey: object.key,
    extension,
    ownerId: ctx.userId,
  };
  await putResource(ctx, "dataset", id, data);
  try {
    return {
      dataset: summary(data),
      job: await enqueueJob(ctx, "dataset.ingest", { datasetId: id }),
    };
  } catch (error) {
    data.state = "failed";
    data.warnings = [
      "The import queue is unavailable. Retry when the worker is running.",
    ];
    await putResource(ctx, "dataset", id, data);
    throw error;
  }
}
const ingestHandler: JobHandler = async (ctx, payload, options) => {
  const d = await stored(ctx, String(payload.datasetId));
  if (d.state === "ready") return detail(d);
  const destination = await reserveObject(ctx.workspaceId, "parquet");
  await options.progress(10);
  try {
    const p = await runPython<Profile>(
      "profile",
      {
        path: storagePath(ctx.workspaceId, d.originalKey!),
        extension: d.extension,
        destination: destination.path,
      },
      { signal: options.signal },
    );
    await options.progress(85);
    const next: StoredDataset = {
      ...d,
      ...p,
      state: "ready",
      version: p.hash.slice(0, 16),
      canonicalKey: destination.key,
    };
    await putResource(ctx, "dataset", d.id, next);
    return detail(next);
  } catch (error) {
    await putResource(ctx, "dataset", d.id, {
      ...d,
      state: "failed",
      warnings: [error instanceof Error ? error.message : "Import failed."],
    });
    await unlink(destination.path).catch(() => {});
    throw error;
  }
};
export async function transformDataset(
  ctx: WorkspaceContext,
  id: string,
  operations: unknown[],
  preview: boolean,
) {
  const d = await stored(ctx, id);
  if (!d.canonicalKey || d.state !== "ready")
    throw new AppError(
      409,
      "dataset_not_ready",
      "Wait for this version to finish processing.",
    );
  if (
    !Array.isArray(operations) ||
    operations.length > 20 ||
    Buffer.byteLength(JSON.stringify(operations)) > 64000
  )
    throw new AppError(
      422,
      "invalid_recipe",
      "Use a recipe with at most 20 bounded transformations.",
    );
  if (preview) {
    const target = await reserveObject(ctx.workspaceId, "parquet");
    try {
      const p = await runPython<Profile>("transform", {
        path: storagePath(ctx.workspaceId, d.canonicalKey),
        destination: target.path,
        operations,
      });
      return {
        ...detail(d),
        ...p,
        version: p.hash.slice(0, 16),
        parentVersion: d.version,
        transformations: [...d.transformations, ...operations],
      };
    } finally {
      await unlink(target.path).catch(() => {});
    }
  }
  const nextId = randomUUID();
  const next: StoredDataset = {
    ...d,
    id: nextId,
    state: "queued",
    version: "pending",
    parentDatasetId: d.id,
    parentVersion: d.version,
    createdAt: new Date().toISOString(),
    ownerId: ctx.userId,
    transformations: [...d.transformations, ...operations],
  };
  await putResource(ctx, "dataset", nextId, next);
  return {
    dataset: summary(next),
    job: await enqueueJob(ctx, "dataset.transform", {
      datasetId: nextId,
      parentId: id,
      operations,
    }),
  };
}
const transformHandler: JobHandler = async (ctx, payload, options) => {
  const d = await stored(ctx, String(payload.datasetId)),
    parent = await stored(ctx, String(payload.parentId));
  if (d.state === "ready") return detail(d);
  const destination = await reserveObject(ctx.workspaceId, "parquet");
  try {
    await options.progress(10);
    const p = await runPython<Profile>(
      "transform",
      {
        path: storagePath(ctx.workspaceId, parent.canonicalKey!),
        destination: destination.path,
        operations: payload.operations,
      },
      { signal: options.signal },
    );
    await options.progress(85);
    const next: StoredDataset = {
      ...d,
      ...p,
      state: "ready",
      version: p.hash.slice(0, 16),
      canonicalKey: destination.key,
    };
    await putResource(ctx, "dataset", d.id, next);
    return detail(next);
  } catch (error) {
    await putResource(ctx, "dataset", d.id, {
      ...d,
      state: "failed",
      warnings: [
        error instanceof Error ? error.message : "Transformation failed.",
      ],
    });
    await unlink(destination.path).catch(() => {});
    throw error;
  }
};
export const datasetJobHandlers = {
  "dataset.ingest": ingestHandler,
  "dataset.transform": transformHandler,
};
export async function datasetRows(
  ctx: WorkspaceContext,
  id: string,
  offset = 0,
  limit = 100,
) {
  const d = await stored(ctx, id);
  if (!d.canonicalKey)
    throw new AppError(409, "dataset_not_ready", "Dataset is not ready.");
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 1000
  )
    throw new AppError(
      422,
      "invalid_page",
      "Use an offset >= 0 and a page size from 1 to 1,000.",
    );
  return runPython<{
    rows: Record<string, unknown>[];
    total: number;
    offset: number;
    limit: number;
  }>("rows", {
    path: storagePath(ctx.workspaceId, d.canonicalKey),
    offset,
    limit,
  });
}
export async function datasetCatalog(
  ctx: WorkspaceContext,
  id: string,
): Promise<MetricDefinition[]> {
  const d = await stored(ctx, id);
  return [
    {
      id: "count",
      name: "Row count",
      description: "Count of records in this dataset version.",
      unit: "count",
      formula: "COUNT(*)",
      owner: "Dataset owner",
      version: d.version,
      source: d.name,
    },
    ...d.fields
      .filter((f) => f.type === "number" && f.invalid === 0)
      .flatMap((f) =>
        ["sum", "average", "min", "max"].map((op) => ({
          id: `${op}:${f.name}`,
          name: `${op} of ${f.name}`,
          description: `${op} of nonmissing ${f.name} observations.`,
          unit: "count" as const,
          formula: `${op.toUpperCase()}(${f.name})`,
          owner: "Dataset owner",
          version: d.version,
          source: d.name,
        })),
      ),
  ];
}
export async function queryDataset(
  ctx: WorkspaceContext,
  plan: AnalyticalPlan,
): Promise<AnalysisResult> {
  const started = performance.now(),
    d = await stored(ctx, plan.datasetId!);
  if (!d.canonicalKey || d.state !== "ready")
    throw new AppError(
      409,
      "dataset_not_ready",
      "Publish a ready dataset version first.",
    );
  const catalog = await datasetCatalog(ctx, d.id);
  if (!catalog.some((m) => m.id === plan.metric))
    throw new AppError(
      422,
      "invalid_metric",
      "Choose a metric from this dataset’s catalog.",
    );
  const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
  const [op, ...parts] = plan.metric.split(":");
  const column = parts.join(":");
  const functions: Record<string, string> = {
    sum: "SUM",
    average: "AVG",
    min: "MIN",
    max: "MAX",
  };
  const dimension = plan.dimension;
  if (dimension && !d.fields.some((f) => f.name === dimension))
    throw new AppError(
      422,
      "invalid_dimension",
      "Choose a column from this dataset.",
    );
  const limit = plan.limit ?? 1000;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
    throw new AppError(
      422,
      "invalid_limit",
      "Results are bounded to 10,000 rows.",
    );
  const expression =
    op === "count"
      ? "COUNT(*)"
      : `${functions[op]}(CAST(${quote(column)} AS DOUBLE PRECISION))`;
  const sql = `SELECT ${dimension ? `${quote(dimension)} AS dimension,` : ""}${expression} AS value FROM selected_dataset${dimension ? ` GROUP BY ${quote(dimension)} ORDER BY ${quote(dimension)}` : ""} LIMIT ${limit}`;
  validateCompiledQuery(sql);
  const result = await runPython<{
    columns: string[];
    rows: Record<string, unknown>[];
  }>(
    "query",
    { path: storagePath(ctx.workspaceId, d.canonicalKey), sql, values: [] },
    { timeoutMs: 15000 },
  );
  return {
    id: randomUUID(),
    state: result.rows.length ? "ready" : "unavailable",
    ...result,
    query: sql,
    durationMs: Math.round(performance.now() - started),
    provenance: {
      datasetVersion: d.version,
      metricVersion: METRIC_VERSION,
      sources: [d.name],
      filters: {},
      generatedAt: new Date().toISOString(),
      query: sql,
      warnings: [
        ...d.warnings,
        "Uploaded-dataset queries use the selected immutable version. Global SaaS date/segment filters are not applied to arbitrary schemas.",
      ],
    },
  };
}
