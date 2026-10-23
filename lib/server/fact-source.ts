import type { Pool } from "pg";
import type { WorkspaceContext } from "@/lib/intelligence/contracts";
import type { SeedManifest } from "@/lib/intelligence/seed";
import {
  normalizeFactSnapshot,
  parseFactSnapshot,
} from "@/lib/intelligence/fact-import";
import { AppError, getResource } from "./db";

export type FactSource = {
  version: string;
  hash: string;
  workspaceId: string;
  from: string;
  to: string;
  rows: number;
  source: "seeded" | "connected";
  name: string;
  refreshedAt: string;
  refreshIntervalHours: number | null;
  stale: boolean;
};
export async function getFactSource(
  ctx: WorkspaceContext,
  pinnedVersion?: string,
): Promise<FactSource> {
  if (process.env.AXIOM_MODE !== "connected") {
    const seed = await getResource<SeedManifest>(
      ctx,
      "seed-manifest",
      "reference",
    );
    if (!seed || (pinnedVersion && pinnedVersion !== seed.data.version))
      throw new AppError(
        503,
        "dataset_unavailable",
        "The requested reference fact version is not available.",
      );
    return {
      ...seed.data,
      source: "seeded",
      name: "SaaS intelligence · reference facts",
      refreshedAt: seed.updatedAt,
      refreshIntervalHours: null,
      stale: false,
    };
  }
  let version = pinnedVersion;
  if (!version) {
    const active = await getResource<{ version: string }>(
      ctx,
      "operational-source",
      "active",
    );
    version = active?.data.version;
  }
  if (!version || !/^operational\/[a-f0-9]{64}$/.test(version))
    throw new AppError(
      503,
      "operational_dataset_unconfigured",
      "Provision a canonical SaaS snapshot with facts:import. No reference records were substituted.",
    );
  const snapshot = await getResource<Omit<FactSource, "stale">>(
    ctx,
    "operational-snapshot",
    version,
  );
  if (
    !snapshot ||
    snapshot.data.workspaceId !== ctx.workspaceId ||
    snapshot.data.source !== "connected"
  )
    throw new AppError(
      503,
      "operational_dataset_unavailable",
      "The selected operational snapshot is unavailable in this workspace.",
    );
  return {
    ...snapshot.data,
    stale:
      Date.now() - Date.parse(snapshot.data.refreshedAt) >
      (snapshot.data.refreshIntervalHours ?? 24) * 3600000,
  };
}

/** Operator-only: never invoked by a web route; the caller supplies the isolated migration pool. */
export async function provisionFactSnapshot(
  pool: Pool,
  workspaceId: string,
  actorId: string,
  input: string | unknown,
): Promise<FactSource> {
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(workspaceId) ||
    !actorId ||
    actorId.length > 180
  )
    throw new Error(
      "Specify valid workspace and verified application actor IDs.",
    );
  const snapshot = parseFactSnapshot(input);
  const normalized = normalizeFactSnapshot(workspaceId, snapshot);
  const source: Omit<FactSource, "stale"> = {
    version: normalized.version,
    hash: normalized.hash,
    workspaceId,
    from: snapshot.coverage_from,
    to: snapshot.coverage_to,
    rows: normalized.facts.length,
    source: "connected",
    name: snapshot.name,
    refreshedAt: snapshot.refreshed_at,
    refreshIntervalHours: snapshot.refresh_interval_hours,
  };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='120s'");
    // Serialize activation and membership changes for this workspace during publication.
    const workspace = await client.query(
      "SELECT id FROM workspaces WHERE id=$1 FOR UPDATE",
      [workspaceId],
    );
    if (!workspace.rowCount)
      throw new Error("The selected workspace does not exist.");
    const member = await client.query(
      "SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2 FOR SHARE",
      [workspaceId, actorId],
    );
    if (!member.rows.some((r) => ["owner", "administrator"].includes(r.role)))
      throw new Error(
        "The import actor must be a verified administrator or owner of this workspace.",
      );
    const existing = await client.query(
      "SELECT data FROM resources WHERE workspace_id=$1 AND kind='operational-snapshot' AND id=$2",
      [workspaceId, source.version],
    );
    if (!existing.rowCount) {
      for (let offset = 0; offset < normalized.facts.length; offset += 1000) {
        await client.query(
          "INSERT INTO fact_events SELECT * FROM jsonb_populate_recordset(NULL::fact_events,$1::jsonb)",
          [JSON.stringify(normalized.facts.slice(offset, offset + 1000))],
        );
      }
      await client.query(
        "INSERT INTO resources(workspace_id,kind,id,data) VALUES($1,'operational-snapshot',$2,$3)",
        [workspaceId, source.version, JSON.stringify(source)],
      );
    } else if (
      JSON.stringify(existing.rows[0].data.hash) !== JSON.stringify(source.hash)
    )
      throw new Error("Immutable snapshot identity mismatch.");
    await client.query(
      "INSERT INTO resources(workspace_id,kind,id,data) VALUES($1,'operational-source','active',$2) ON CONFLICT(workspace_id,kind,id) DO UPDATE SET data=EXCLUDED.data,revision=resources.revision+1,updated_at=now()",
      [workspaceId, JSON.stringify({ version: source.version })],
    );
    await client.query(
      "INSERT INTO audit_events(workspace_id,actor_id,action,resource_id,detail) VALUES($1,$2,'operational-source.activated',$3,$4)",
      [
        workspaceId,
        actorId,
        source.version,
        JSON.stringify({
          rows: source.rows,
          source: source.name,
          hash: source.hash,
          idempotent: Boolean(existing.rowCount),
        }),
      ],
    );
    await client.query("COMMIT");
    return {
      ...source,
      stale:
        Date.now() - Date.parse(source.refreshedAt) >
        (source.refreshIntervalHours ?? 24) * 3600000,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
