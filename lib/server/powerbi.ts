import { ConfidentialClientApplication } from "@azure/msal-node";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type {
  EmbedConfiguration,
  Filters,
  ReportSummary,
  WorkspaceContext,
} from "@/lib/intelligence/contracts";
import { AppError, audit, getResource, putResource } from "./db";
import { enqueueJob, type JobHandler } from "./jobs";
import { normalizeFilters } from "@/lib/intelligence/query";
import { writeObject } from "./storage";

type Identity = { username: string; roles: string[] };
export type BIReport = {
  key: string;
  name: string;
  description: string;
  reportId: string;
  datasetId: string;
  pages: string[];
  export: boolean;
  refresh: boolean;
  rlsRequired: boolean;
  identities: Record<string, Identity>;
};
export type BIConfig = {
  workspaceId: string;
  profileId: string;
  reports: BIReport[];
};
export type ReportArtifact = {
  key: string;
  name: string;
  contentType: string;
  ownerId: string;
  authorization: { reportKey: string; fingerprint: string };
};
const uuid =
  /^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
function isDemo() {
  return process.env.AXIOM_MODE !== "connected";
}
function requireAnalyst(ctx: WorkspaceContext) {
  if (ctx.role === "viewer")
    throw new AppError(403, "export_denied", "An analyst role is required.");
}
function requireAdmin(ctx: WorkspaceContext) {
  if (!["administrator", "owner"].includes(ctx.role))
    throw new AppError(
      403,
      "refresh_denied",
      "An administrator role is required to refresh semantic models.",
    );
}
export async function reportConfiguration(ctx: WorkspaceContext, key?: string) {
  const resource = await getResource<BIConfig>(
    ctx,
    "powerbi-config",
    "default",
  );
  if (!resource)
    throw new AppError(
      503,
      "powerbi_unconfigured",
      "Power BI is not configured for this workspace. Configure capacity, profile, workspace and approved reports. No demo report was substituted.",
    );
  const config = resource.data;
  if (
    !uuid.test(config.workspaceId) ||
    !uuid.test(config.profileId) ||
    !Array.isArray(config.reports)
  )
    throw new AppError(
      503,
      "powerbi_invalid_config",
      "The server-side Power BI mapping is invalid.",
    );
  const report = key ? config.reports.find((r) => r.key === key) : undefined;
  if (
    key &&
    (!report || !uuid.test(report.reportId) || !uuid.test(report.datasetId))
  )
    throw new AppError(
      404,
      "report_not_found",
      "This report is not approved in your workspace.",
    );
  if (report?.rlsRequired && !report.identities?.[ctx.userId])
    throw new AppError(
      403,
      "report_identity_denied",
      "No approved report identity is configured for this user.",
    );
  return { config, report };
}
let application: ConfidentialClientApplication | undefined;
async function accessToken() {
  const {
    POWERBI_TENANT_ID: tenant,
    POWERBI_CLIENT_ID: client,
    POWERBI_CLIENT_SECRET: secret,
    POWERBI_CERTIFICATE_PATH: certificate,
    POWERBI_CERTIFICATE_THUMBPRINT: thumbprint,
  } = process.env;
  if (!tenant || !client || (!secret && !certificate))
    throw new AppError(
      503,
      "powerbi_identity_unconfigured",
      "Configure the server-side Microsoft Entra service principal.",
    );
  if (!uuid.test(tenant) || !uuid.test(client))
    throw new AppError(
      503,
      "powerbi_identity_invalid",
      "Microsoft identity configuration is invalid.",
    );
  if (!application) {
    if (certificate && !thumbprint)
      throw new AppError(
        503,
        "certificate_invalid",
        "A SHA-256 certificate thumbprint is required.",
      );
    const auth = {
      clientId: client,
      authority: `https://login.microsoftonline.com/${tenant}`,
      ...(certificate
        ? {
            clientCertificate: {
              thumbprintSha256: thumbprint!,
              privateKey: await readFile(certificate, "utf8"),
            },
          }
        : { clientSecret: secret! }),
    };
    application = new ConfidentialClientApplication({ auth });
  }
  const token = await application.acquireTokenByClientCredential({
    scopes: ["https://analysis.windows.net/powerbi/api/.default"],
  });
  if (!token?.accessToken)
    throw new AppError(
      502,
      "powerbi_auth_failed",
      "Microsoft did not return a valid service token.",
    );
  return token.accessToken;
}
async function bi(config: BIConfig, path: string, options: RequestInit = {}) {
  const response = await fetch(`https://api.powerbi.com/v1.0/myorg${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "X-PowerBI-Profile-Id": config.profileId,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: options.signal ?? AbortSignal.timeout(30000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new AppError(
      response.status === 429 ? 429 : 502,
      "powerbi_service_error",
      `Power BI returned ${response.status}. Check workspace access, RLS, capacity, tenant settings and service status.`,
    );
  return response;
}
function identity(report: BIReport, ctx: WorkspaceContext) {
  const id = report.identities?.[ctx.userId];
  return id
    ? { username: id.username, roles: id.roles, datasets: [report.datasetId] }
    : undefined;
}
function exportAuthorization(
  config: BIConfig,
  report: BIReport,
  ctx: WorkspaceContext,
) {
  const effective = identity(report, ctx);
  return createHash("sha256")
    .update(
      JSON.stringify({
        tenant: process.env.POWERBI_TENANT_ID,
        client: process.env.POWERBI_CLIENT_ID,
        workspace: ctx.workspaceId,
        user: ctx.userId,
        microsoftWorkspace: config.workspaceId,
        profile: config.profileId,
        report: report.reportId,
        dataset: report.datasetId,
        rlsRequired: report.rlsRequired,
        identity: effective
          ? { ...effective, roles: [...effective.roles].sort() }
          : null,
      }),
    )
    .digest("hex");
}
export async function authorizeReportArtifact(
  ctx: WorkspaceContext,
  artifact: ReportArtifact,
): Promise<void> {
  requireAnalyst(ctx);
  // Exported files contain a snapshot of the creator's RLS-visible data. A
  // workspace role, including owner, does not confer another user's RLS scope.
  if (artifact.ownerId !== ctx.userId || !artifact.authorization || isDemo())
    throw new AppError(
      403,
      "artifact_denied",
      "Only the creator can download this connected report export.",
    );
  const { config, report } = await reportConfiguration(
    ctx,
    artifact.authorization.reportKey,
  );
  if (
    !report?.export ||
    exportAuthorization(config, report, ctx) !==
      artifact.authorization.fingerprint
  )
    throw new AppError(
      403,
      "artifact_authorization_changed",
      "Report authorization changed. Create a new export with your current access.",
    );
}
export async function listReports(
  ctx: WorkspaceContext,
): Promise<ReportSummary[]> {
  if (isDemo())
    return [
      {
        key: "executive",
        name: "Executive intelligence",
        description:
          "Local report preview. Connect Power BI to load an embedded Microsoft report.",
        state: "demo",
        pages: [
          "Executive Overview",
          "Retention & Cohorts",
          "Infrastructure Economics",
          "Data Quality",
        ],
        capabilities: { export: false, refresh: false },
      },
    ];
  const { config } = await reportConfiguration(ctx);
  return config.reports
    .filter((r) => !r.rlsRequired || !!r.identities?.[ctx.userId])
    .map((r) => ({
      key: r.key,
      name: r.name,
      description: r.description,
      state: "connected",
      pages: r.pages,
      capabilities: {
        export: r.export && ctx.role !== "viewer",
        refresh: r.refresh && ["administrator", "owner"].includes(ctx.role),
      },
    }));
}
export async function getEmbedConfig(
  ctx: WorkspaceContext,
  key: string,
): Promise<EmbedConfiguration> {
  if (isDemo()) {
    if (key !== "executive")
      throw new AppError(404, "report_not_found", "Unknown report.");
    return {
      mode: "demo",
      capabilities: { export: false, refresh: false },
      message:
        "Local preview: no Microsoft report or embed token is simulated. Connect a licensed Power BI workspace to enable embedding.",
    };
  }
  const { config, report } = await reportConfiguration(ctx, key);
  const r = report!;
  const metadata = await (
    await bi(config, `/groups/${config.workspaceId}/reports/${r.reportId}`)
  ).json();
  if (
    metadata.datasetId !== r.datasetId ||
    typeof metadata.embedUrl !== "string" ||
    !metadata.embedUrl.startsWith("https://app.powerbi.com/")
  )
    throw new AppError(
      502,
      "report_mapping_changed",
      "Report metadata differs from the approved mapping. Ask an administrator to review it.",
    );
  const effective = identity(r, ctx);
  const token = await (
    await bi(config, "/GenerateToken", {
      method: "POST",
      body: JSON.stringify({
        datasets: [{ id: r.datasetId }],
        reports: [{ id: r.reportId, allowEdit: false }],
        ...(effective ? { identities: [effective] } : {}),
      }),
    })
  ).json();
  if (
    !token.token ||
    !Number.isFinite(Date.parse(token.expiration)) ||
    Date.parse(token.expiration) <= Date.now()
  )
    throw new AppError(
      502,
      "embed_token_invalid",
      "Power BI returned an invalid or expired embed token.",
    );
  await audit(ctx, "powerbi.embed", key);
  return {
    mode: "connected",
    reportId: r.reportId,
    embedUrl: metadata.embedUrl,
    embedToken: token.token,
    expiresAt: token.expiration,
    capabilities: {
      export: r.export && ctx.role !== "viewer",
      refresh: r.refresh && ["administrator", "owner"].includes(ctx.role),
    },
  };
}
export async function getReportStatus(ctx: WorkspaceContext, key: string) {
  if (isDemo())
    return {
      state: "demo",
      refreshes: [],
      message: "Refresh requires a connected import semantic model.",
    };
  const { config, report } = await reportConfiguration(ctx, key);
  return (
    await bi(
      config,
      `/groups/${config.workspaceId}/datasets/${report!.datasetId}/refreshes?$top=5`,
    )
  ).json();
}
export async function exportReport(
  ctx: WorkspaceContext,
  key: string,
  input: { format?: string; filters?: Filters } = {},
) {
  requireAnalyst(ctx);
  if (isDemo())
    throw new AppError(
      409,
      "demo_export_unavailable",
      "Microsoft file exports require a connected report and eligible capacity.",
    );
  const { report } = await reportConfiguration(ctx, key);
  if (!report!.export)
    throw new AppError(
      403,
      "report_export_disabled",
      "Export is not enabled for this report.",
    );
  if (!["PDF", "PPTX", "PNG"].includes(input.format ?? "PDF"))
    throw new AppError(422, "invalid_export", "Choose PDF, PPTX or PNG.");
  const filters = normalizeFilters(input.filters);
  return enqueueJob(ctx, "powerbi.export", {
    key,
    format: input.format ?? "PDF",
    filters,
  });
}
export async function refreshReport(ctx: WorkspaceContext, key: string) {
  requireAdmin(ctx);
  if (isDemo())
    throw new AppError(
      409,
      "demo_refresh_unavailable",
      "Connect a refreshable import semantic model first.",
    );
  const { report } = await reportConfiguration(ctx, key);
  if (!report!.refresh)
    throw new AppError(
      403,
      "refresh_disabled",
      "Refresh is not enabled for this model.",
    );
  return enqueueJob(ctx, "powerbi.refresh", { key });
}
const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const done = () => {
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
const exportHandler: JobHandler = async (ctx, payload, options) => {
  requireAnalyst(ctx);
  const { config, report } = await reportConfiguration(
    ctx,
    String(payload.key),
  );
  const r = report!;
  if (!r.export)
    throw new AppError(
      403,
      "report_export_disabled",
      "Export permission changed.",
    );
  const fingerprint = exportAuthorization(config, r, ctx);
  const prior = await getResource<{ remoteId: string; fingerprint: string }>(
    ctx,
    "bi-export",
    options.jobId,
  );
  if (prior && prior.data.fingerprint !== fingerprint)
    throw new AppError(
      403,
      "artifact_authorization_changed",
      "Report authorization changed. Start a new export instead of resuming the previous identity's snapshot.",
    );
  let remoteId = prior?.data.remoteId;
  if (!remoteId) {
    const f = normalizeFilters(payload.filters as Filters);
    const escape = (v: string) => v.replaceAll("'", "''");
    const predicates = [
      `Date/Date ge ${f.from}T00:00:00Z`,
      `Date/Date le ${f.to}T23:59:59Z`,
      ...(f.region ? [`Region/Name eq '${escape(f.region)}'`] : []),
      ...(f.plan ? [`Plan/Name eq '${escape(f.plan)}'`] : []),
    ];
    const effective = identity(r, ctx);
    const start = await (
      await bi(
        config,
        `/groups/${config.workspaceId}/reports/${r.reportId}/ExportTo`,
        {
          method: "POST",
          body: JSON.stringify({
            format: payload.format,
            powerBIReportConfiguration: {
              ...(effective ? { identities: [effective] } : {}),
              reportLevelFilters: [{ filter: predicates.join(" and ") }],
            },
          }),
        },
      )
    ).json();
    remoteId = start.id;
    await putResource(ctx, "bi-export", options.jobId, {
      remoteId,
      fingerprint,
    });
  }
  for (let attempt = 0; attempt < 25; attempt++) {
    options.signal.throwIfAborted();
    const status = await (
      await bi(
        config,
        `/groups/${config.workspaceId}/reports/${r.reportId}/exports/${encodeURIComponent(remoteId!)}`,
        { signal: options.signal },
      )
    ).json();
    await options.progress(
      Math.min(90, Number(status.percentComplete) || attempt * 3),
    );
    if (status.status === "Failed")
      throw new AppError(
        502,
        "export_failed",
        "Microsoft could not export this report. Review capacity, sensitivity labels and export settings.",
      );
    if (status.status === "Succeeded") {
      const file = await bi(
        config,
        `/groups/${config.workspaceId}/reports/${r.reportId}/exports/${encodeURIComponent(remoteId!)}/file`,
        { signal: options.signal },
      );
      const size = Number(file.headers.get("content-length") ?? 0);
      if (size > 50 * 1024 * 1024)
        throw new AppError(413, "export_too_large", "Export exceeds 50 MiB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length > 50 * 1024 * 1024)
        throw new AppError(413, "export_too_large", "Export exceeds 50 MiB.");
      const object = await writeObject(ctx.workspaceId, bytes);
      await putResource(ctx, "artifact", options.jobId, {
        key: object.key,
        name: `axiom-${payload.key}.${String(payload.format).toLowerCase()}`,
        ownerId: ctx.userId,
        authorization: {
          reportKey: r.key,
          fingerprint,
        },
        contentType:
          file.headers.get("content-type") || "application/octet-stream",
      });
      return {
        downloadUrl: `/api/v1/workspaces/${ctx.workspaceId}/artifacts/${options.jobId}`,
      };
    }
    await pause(2000, options.signal);
  }
  throw new AppError(
    504,
    "export_timeout",
    "Export is still running in Microsoft. Retry this job to resume polling.",
  );
};
const refreshHandler: JobHandler = async (ctx, payload, options) => {
  requireAdmin(ctx);
  const { config, report } = await reportConfiguration(
    ctx,
    String(payload.key),
  );
  if (!report!.refresh)
    throw new AppError(403, "refresh_disabled", "Refresh permission changed.");
  await options.progress(20);
  const response = await bi(
    config,
    `/groups/${config.workspaceId}/datasets/${report!.datasetId}/refreshes`,
    {
      method: "POST",
      body: JSON.stringify({ notifyOption: "NoNotification" }),
      signal: options.signal,
    },
  );
  await audit(ctx, "powerbi.refresh", String(payload.key));
  return {
    state: "submitted",
    requestId: response.headers.get("requestid"),
    message:
      "Refresh submitted to Microsoft. Inspect refresh history for completion; submission is not completion.",
  };
};
export const powerBIJobHandlers = {
  "powerbi.export": exportHandler,
  "powerbi.refresh": refreshHandler,
};
