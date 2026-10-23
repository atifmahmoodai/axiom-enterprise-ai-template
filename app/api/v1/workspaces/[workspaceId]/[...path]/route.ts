import { randomUUID } from "node:crypto";
import { assertSameOrigin, requireWorkspace } from "@/lib/server/auth";
import {
  AppError,
  audit,
  getResource,
  listResources,
  putResource,
  deleteResource,
  withWorkspace,
  workspaceQuery,
} from "@/lib/server/db";
import {
  getOverview,
  runQuery,
  getCatalog,
  getLineage,
} from "@/lib/server/analytics";
import {
  datasetCatalog,
  datasetRows,
  getDataset,
  ingestFile,
  listDatasets,
  transformDataset,
} from "@/lib/server/datasets";
import { askAnalyst } from "@/lib/server/analyst";
import { listEvaluations } from "@/lib/server/evaluations";
import { runLab } from "@/lib/server/lab";
import { cancelJob, enqueueJob, getJob, listJobs } from "@/lib/server/jobs";
import {
  authorizeReportArtifact,
  type ReportArtifact,
  exportReport,
  getEmbedConfig,
  getReportStatus,
  listReports,
  refreshReport,
} from "@/lib/server/powerbi";
import { boundedBody, errorResponse, json, readBody } from "@/lib/server/http";
import { readObject } from "@/lib/server/storage";
import { exportSnapshot, EXPORT_REQUEST_BYTES } from "@/lib/server/export";
import type {
  AnalyticalPlan,
  Filters,
  Role,
} from "@/lib/intelligence/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ workspaceId: string; path: string[] }> };
async function dispatch(request: Request, context: Context) {
  try {
    const { workspaceId, path } = await context.params;
    const [resource, id, action] = path;
    const method = request.method;
    const write = method !== "GET";
    if (write) assertSameOrigin(request);
    const minimum: Role =
      resource === "memberships"
        ? "administrator"
        : resource === "reports" && action === "embed-config"
          ? "viewer"
          : write
            ? "analyst"
            : "viewer";
    const ctx = await requireWorkspace(request, workspaceId, minimum);
    const url = new URL(request.url);
    const filters: Filters = Object.fromEntries(
      ["from", "to", "region", "plan"].map((k) => [
        k,
        url.searchParams.get(k) || undefined,
      ]),
    );
    if (method === "GET") {
      if (resource === "overview") return json(await getOverview(ctx, filters));
      if (resource === "catalog")
        return json(
          url.searchParams.get("datasetId")
            ? await datasetCatalog(ctx, url.searchParams.get("datasetId")!)
            : getCatalog(),
        );
      if (resource === "lineage") return json(await getLineage(ctx));
      if (resource === "datasets") {
        if (id && action === "rows")
          return json(
            await datasetRows(
              ctx,
              id,
              Number(url.searchParams.get("offset") || 0),
              Number(url.searchParams.get("limit") || 100),
            ),
          );
        return json(id ? await getDataset(ctx, id) : await listDatasets(ctx));
      }
      if (resource === "lab") {
        const options: Record<string, unknown> = {};
        for (const k of ["growth", "costReduction", "horizon"])
          if (url.searchParams.has(k))
            options[k] = Number(url.searchParams.get(k));
        return json(
          await runLab(
            ctx,
            url.searchParams.get("kind") || "forecast",
            filters,
            options,
          ),
        );
      }
      if (resource === "analyses" || resource === "views")
        return json(
          await listResources(
            ctx,
            resource === "analyses" ? "analysis" : "view",
          ),
        );
      if (resource === "evaluations") return json(await listEvaluations(ctx));
      if (resource === "jobs")
        return json(id ? await getJob(ctx, id) : await listJobs(ctx));
      if (resource === "reports")
        return json(
          id && action === "status"
            ? await getReportStatus(ctx, id)
            : await listReports(ctx),
        );
      if (resource === "audit")
        return json(
          await workspaceQuery(
            ctx,
            'SELECT id,actor_id AS "actorId",action,resource_id AS "resourceId",detail,created_at AS "createdAt" FROM audit_events WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 200',
            [workspaceId],
          ),
        );
      if (resource === "memberships")
        return json(
          await workspaceQuery(
            ctx,
            'SELECT m.user_id AS "userId",m.role,u.name,u.email FROM memberships m JOIN app_users u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY u.name',
            [workspaceId],
            false,
          ),
        );
      if (resource === "artifacts" && id) {
        if (ctx.role === "viewer")
          throw new AppError(
            403,
            "export_denied",
            "An analyst role is required to download exports.",
          );
        const r = await getResource<ReportArtifact>(ctx, "artifact", id);
        if (!r)
          throw new AppError(
            404,
            "artifact_not_found",
            "This export is unavailable.",
          );
        await authorizeReportArtifact(ctx, r.data);
        await audit(ctx, "artifact.downloaded", id);
        return new Response(
          new Uint8Array(
            await readObject(workspaceId, r.data.key, 50 * 1024 * 1024),
          ),
          {
            headers: {
              "Content-Type": r.data.contentType,
              "Content-Disposition": `attachment; filename="${r.data.name.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
              "Cache-Control": "private, no-store",
            },
          },
        );
      }
    }
    if (method === "POST") {
      if (resource === "exports" && !id) {
        const result = await exportSnapshot(
          ctx,
          await readBody(request, EXPORT_REQUEST_BYTES),
        );
        return new Response(result.csv, {
          headers: {
            "Content-Type": "text/csv;charset=utf-8",
            "Content-Disposition": `attachment; filename="${result.filename}"`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Axiom-Export-Source": "client-supplied-snapshot",
            "X-Axiom-Export-Id": result.id,
          },
        });
      }
      if (resource === "datasets" && !id) {
        const bytes = await boundedBody(request, 52 * 1024 * 1024);
        const form = await new Response(bytes, {
          headers: {
            "Content-Type": request.headers.get("content-type") || "",
          },
        }).formData();
        const file = form.get("file");
        if (!(file instanceof File))
          throw new AppError(422, "file_required", "Choose a file to import.");
        return json(await ingestFile(ctx, file), 202);
      }
      const body = await readBody(request);
      if (resource === "datasets" && id && action === "transform")
        return json(
          await transformDataset(
            ctx,
            id,
            body.operations,
            body.preview === true,
          ),
          body.preview ? 200 : 202,
        );
      if (resource === "analytics")
        return json(await runQuery(ctx, body as AnalyticalPlan));
      if (resource === "analyst") return json(await askAnalyst(ctx, body));
      if (resource === "evaluations") {
        if (body.provider && !["demo", "openai"].includes(body.provider))
          throw new AppError(422, "invalid_provider", "Choose demo or openai.");
        return json(
          await enqueueJob(ctx, "evaluation.run", {
            provider: body.provider || "demo",
            trials: body.trials || 1,
          }),
          202,
        );
      }
      if (resource === "jobs" && id && action === "cancel")
        return json(await cancelJob(ctx, id));
      if (resource === "reports" && id) {
        if (action === "embed-config") {
          if (Object.keys(body).length)
            throw new AppError(
              422,
              "invalid_embed_request",
              "Report identifiers and identities are resolved on the server.",
            );
          return json(await getEmbedConfig(ctx, id));
        }
        if (action === "export")
          return json(await exportReport(ctx, id, body), 202);
        if (action === "refresh")
          return json(await refreshReport(ctx, id), 202);
      }
      if (resource === "analyses" || resource === "views") {
        if (
          typeof body.name !== "string" ||
          !body.name.trim() ||
          body.name.length > 180
        )
          throw new AppError(
            422,
            "name_required",
            "Use a name between 1 and 180 characters.",
          );
        return json(
          await putResource(
            ctx,
            resource === "analyses" ? "analysis" : "view",
            randomUUID(),
            {
              ...body,
              ownerId: ctx.userId,
              createdAt: new Date().toISOString(),
            },
          ),
          201,
        );
      }
      if (resource === "memberships") {
        const roles: Role[] = ["viewer", "analyst", "administrator", "owner"];
        if (typeof body.userId !== "string" || !roles.includes(body.role))
          throw new AppError(
            422,
            "invalid_membership",
            "Choose an existing user and a valid role.",
          );
        await withWorkspace(ctx, async (client) => {
          const current = await client.query(
            "SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE",
            [workspaceId, body.userId],
          );
          if (
            (body.role === "owner" || current.rows[0]?.role === "owner") &&
            ctx.role !== "owner"
          )
            throw new AppError(
              403,
              "owner_required",
              "Only an owner can change ownership.",
            );
          if (current.rows[0]?.role === "owner" && body.role !== "owner") {
            const owners = await client.query(
              "SELECT 1 FROM memberships WHERE workspace_id=$1 AND role='owner' FOR UPDATE",
              [workspaceId],
            );
            if (owners.rowCount === 1)
              throw new AppError(
                409,
                "last_owner",
                "Assign another owner before changing the last owner.",
              );
          }
          await client.query(
            "INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role",
            [workspaceId, body.userId, body.role],
          );
        });
        await audit(ctx, "membership.changed", body.userId, {
          role: body.role,
        });
        return json({ ok: true });
      }
    }
    if (
      (method === "DELETE" || method === "PUT") &&
      (resource === "analyses" || resource === "views") &&
      id
    ) {
      const kind = resource === "analyses" ? "analysis" : "view",
        r = await getResource(ctx, kind, id);
      if (!r)
        throw new AppError(
          404,
          "resource_not_found",
          "This saved item is unavailable.",
        );
      if (
        r.data.ownerId !== ctx.userId &&
        !["administrator", "owner"].includes(ctx.role)
      )
        throw new AppError(
          403,
          "resource_denied",
          "Only the author or an administrator can change this saved item.",
        );
      if (method === "DELETE") {
        await deleteResource(ctx, kind, id);
        return json({ ok: true });
      }
      const body = await readBody(request);
      return json(
        await putResource(
          ctx,
          kind,
          id,
          { ...r.data, ...body, ownerId: r.data.ownerId },
          Number(body.revision),
        ),
      );
    }
    throw new AppError(404, "not_found", "This operation does not exist.");
  } catch (error) {
    return errorResponse(error);
  }
}
export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const DELETE = dispatch;
