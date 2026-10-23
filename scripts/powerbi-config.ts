import { readFile } from "node:fs/promises";
import { Pool } from "pg";
const [workspace, file] = process.argv.slice(2);
if (!workspace || !file || !process.env.DATABASE_ADMIN_URL)
  throw new Error(
    "Usage: npm run powerbi:configure -- WORKSPACE_ID MAPPING_JSON (operator environment only).",
  );
const mapping = JSON.parse(await readFile(file, "utf8"));
const uuid = /^[0-9a-f-]{36}$/i;
if (
  !uuid.test(mapping.workspaceId) ||
  !uuid.test(mapping.profileId) ||
  !Array.isArray(mapping.reports) ||
  !mapping.reports.length
)
  throw new Error(
    "Provide valid Microsoft workspace/profile IDs and approved report mappings.",
  );
const db = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const client = await db.connect();
try {
  await client.query("BEGIN");
  // Serialize mappings so concurrent operator commands cannot reuse a profile across tenants.
  await client.query("SELECT pg_advisory_xact_lock(418092701)");
  const used = await client.query(
    "SELECT workspace_id FROM resources WHERE kind='powerbi-config' AND id='default' AND workspace_id<>$1 AND (data->>'workspaceId'=$2 OR data->>'profileId'=$3)",
    [workspace, mapping.workspaceId, mapping.profileId],
  );
  if (used.rowCount)
    throw new Error(
      "A Microsoft workspace/profile must not be reused across Axiom organizations.",
    );
  await client.query(
    "INSERT INTO resources(workspace_id,kind,id,data) VALUES($1,'powerbi-config','default',$2) ON CONFLICT(workspace_id,kind,id) DO UPDATE SET data=EXCLUDED.data,revision=resources.revision+1,updated_at=now()",
    [workspace, JSON.stringify(mapping)],
  );
  await client.query(
    "INSERT INTO audit_events(workspace_id,actor_id,action,resource_id,detail) VALUES($1,'operator:database-provisioning','powerbi.configured','default',$2)",
    [
      workspace,
      JSON.stringify({
        reports: mapping.reports.length,
        channel: "operator-cli",
      }),
    ],
  );
  await client.query("COMMIT");
  console.log(
    "Power BI workspace mapping installed. Credentials remain in the server secret configuration.",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await db.end();
}
