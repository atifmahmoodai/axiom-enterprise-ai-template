import { Pool } from "pg";
import { generateSeed, SEED_WORKSPACES } from "../lib/intelligence/seed";
const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
if (!process.env.DATABASE_ADMIN_URL)
  throw new Error("DATABASE_ADMIN_URL is required for the reference seed.");
try {
  for (const workspace of SEED_WORKSPACES) {
    const { facts, manifest } = generateSeed(workspace);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM fact_events WHERE workspace_id=$1 AND dataset_version=$2",
        [workspace, manifest.version],
      );
      for (let offset = 0; offset < facts.length; offset += 1000) {
        await client.query(
          `INSERT INTO fact_events SELECT * FROM jsonb_populate_recordset(NULL::fact_events,$1::jsonb)`,
          [JSON.stringify(facts.slice(offset, offset + 1000))],
        );
      }
      await client.query(
        `INSERT INTO resources(workspace_id,kind,id,data) VALUES($1,'seed-manifest','reference',$2) ON CONFLICT(workspace_id,kind,id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,
        [workspace, JSON.stringify(manifest)],
      );
      await client.query("COMMIT");
      console.log(
        `${workspace}: ${facts.length.toLocaleString()} facts, ${Object.keys(manifest.monthly).length} months, ${manifest.hash.slice(0, 12)}`,
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
