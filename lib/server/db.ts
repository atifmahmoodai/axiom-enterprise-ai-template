import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { WorkspaceContext } from "@/lib/intelligence/contracts";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
const globalPool = globalThis as unknown as { axiomPool?: Pool };
export function getPool(): Pool {
  if (!process.env.DATABASE_URL)
    throw new AppError(
      503,
      "database_unconfigured",
      "Database is not configured. Run the documented local setup.",
    );
  return (globalPool.axiomPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 12,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "axiom-web",
  }));
}
export async function withWorkspace<T>(
  ctx: WorkspaceContext,
  fn: (client: PoolClient) => Promise<T>,
  readOnly = false,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query(readOnly ? "BEGIN READ ONLY" : "BEGIN");
    await client.query(
      "SELECT set_config('app.user_id',$1,true),set_config('app.workspace_id',$2,true),set_config('app.role','',true)",
      [ctx.userId, ctx.workspaceId],
    );
    const membership = await client.query<{ role: string }>(
      "SELECT role FROM memberships WHERE user_id=$1 AND workspace_id=$2",
      [ctx.userId, ctx.workspaceId],
    );
    if (!membership.rowCount)
      throw new AppError(
        403,
        "workspace_denied",
        "You do not have access to this workspace.",
      );
    await client.query(
      "SELECT set_config('app.role',$1,true),set_config('statement_timeout','15000',true),set_config('lock_timeout','3000',true),set_config('work_mem','16MB',true)",
      [membership.rows[0].role],
    );
    if (readOnly) await client.query("SET LOCAL ROLE axiom_reader");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
export async function workspaceQuery<T extends QueryResultRow = QueryResultRow>(
  ctx: WorkspaceContext,
  sql: string,
  values: unknown[] = [],
  readOnly = true,
): Promise<T[]> {
  return withWorkspace(
    ctx,
    async (client) => (await client.query<T>(sql, values)).rows,
    readOnly,
  );
}
export type Resource<T = Record<string, unknown>> = {
  id: string;
  kind: string;
  data: T;
  createdAt: string;
  updatedAt: string;
  revision: number;
};
const resourceColumns =
  'id,kind,data,created_at AS "createdAt",updated_at AS "updatedAt",revision';
export async function listResources<T = Record<string, unknown>>(
  ctx: WorkspaceContext,
  kind: string,
): Promise<Resource<T>[]> {
  return workspaceQuery(
    ctx,
    `SELECT ${resourceColumns} FROM resources WHERE workspace_id=$1 AND kind=$2 ORDER BY updated_at DESC LIMIT 1000`,
    [ctx.workspaceId, kind],
  ) as Promise<Resource<T>[]>;
}
export async function getResource<T = Record<string, unknown>>(
  ctx: WorkspaceContext,
  kind: string,
  id: string,
): Promise<Resource<T> | null> {
  const rows = await workspaceQuery(
    ctx,
    `SELECT ${resourceColumns} FROM resources WHERE workspace_id=$1 AND kind=$2 AND id=$3`,
    [ctx.workspaceId, kind, id],
  );
  return (rows[0] as Resource<T> | undefined) ?? null;
}
export async function putResource<T>(
  ctx: WorkspaceContext,
  kind: string,
  id: string,
  data: T,
  expectedRevision?: number,
): Promise<Resource<T>> {
  if (!/^[a-z][a-z0-9_-]{0,63}$/i.test(kind) || !id || id.length > 180)
    throw new AppError(422, "invalid_resource", "Invalid resource identifier.");
  return withWorkspace(ctx, async (client) => {
    const body = JSON.stringify(data);
    if (Buffer.byteLength(body) > 8 * 1024 * 1024)
      throw new AppError(413, "resource_too_large", "Resource exceeds 8 MiB.");
    const result =
      expectedRevision === undefined
        ? await client.query(
            `INSERT INTO resources(workspace_id,kind,id,data) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,kind,id) DO UPDATE SET data=EXCLUDED.data,revision=resources.revision+1,updated_at=now() RETURNING ${resourceColumns}`,
            [ctx.workspaceId, kind, id, body],
          )
        : await client.query(
            `UPDATE resources SET data=$4,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND kind=$2 AND id=$3 AND revision=$5 RETURNING ${resourceColumns}`,
            [ctx.workspaceId, kind, id, body, expectedRevision],
          );
    if (!result.rowCount)
      throw new AppError(
        409,
        "revision_conflict",
        "This resource changed. Reload before saving.",
      );
    await client.query(
      "INSERT INTO audit_events(workspace_id,actor_id,action,resource_id,detail) VALUES($1,$2,$3,$4,$5)",
      [
        ctx.workspaceId,
        ctx.userId,
        `${kind}.saved`,
        id,
        JSON.stringify({ revision: result.rows[0].revision }),
      ],
    );
    return result.rows[0] as Resource<T>;
  });
}
export async function deleteResource(
  ctx: WorkspaceContext,
  kind: string,
  id: string,
): Promise<void> {
  await withWorkspace(ctx, async (client) => {
    const deleted = await client.query(
      "DELETE FROM resources WHERE workspace_id=$1 AND kind=$2 AND id=$3",
      [ctx.workspaceId, kind, id],
    );
    if (!deleted.rowCount)
      throw new AppError(
        403,
        "resource_delete_denied",
        "The resource is unavailable or your membership does not permit deletion.",
      );
    await client.query(
      "INSERT INTO audit_events(workspace_id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [ctx.workspaceId, ctx.userId, `${kind}.deleted`, id],
    );
  });
}
export async function audit(
  ctx: WorkspaceContext,
  action: string,
  resourceId?: string,
  detail: Record<string, unknown> = {},
) {
  await withWorkspace(ctx, async (client) => {
    await client.query(
      "INSERT INTO audit_events(workspace_id,actor_id,action,resource_id,detail) VALUES($1,$2,$3,$4,$5)",
      [
        ctx.workspaceId,
        ctx.userId,
        action,
        resourceId ?? null,
        JSON.stringify(detail),
      ],
    );
  });
}
