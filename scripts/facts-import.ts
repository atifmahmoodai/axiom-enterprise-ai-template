import { open } from "node:fs/promises";
import { Pool } from "pg";
import { MAX_FACT_IMPORT_BYTES } from "../lib/intelligence/fact-import";
import { provisionFactSnapshot } from "../lib/server/fact-source";
const [workspace, actor, file] = process.argv.slice(2);
if (!workspace || !actor || !file || !process.env.DATABASE_ADMIN_URL)
  throw new Error(
    "Usage: npm run facts:import -- WORKSPACE_ID VERIFIED_ACTOR_ID SNAPSHOT_JSON (isolated operator environment only).",
  );
const handle = await open(file, "r");
let input: string;
try {
  const stat = await handle.stat();
  if (!stat.isFile() || stat.size < 1 || stat.size > MAX_FACT_IMPORT_BYTES)
    throw new Error(
      "Snapshot must be a regular file between 1 byte and 50 MiB.",
    );
  const buffer = Buffer.alloc(stat.size + 1);
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesRead } = await handle.read(
      buffer,
      offset,
      buffer.length - offset,
      null,
    );
    if (!bytesRead) break;
    offset += bytesRead;
  }
  if (offset !== stat.size)
    throw new Error(
      "Snapshot changed while reading. Retry with an immutable input file.",
    );
  input = buffer.subarray(0, offset).toString("utf8");
} finally {
  await handle.close();
}
const pool = new Pool({
  connectionString: process.env.DATABASE_ADMIN_URL,
  max: 1,
});
try {
  const source = await provisionFactSnapshot(pool, workspace, actor, input);
  console.log(
    JSON.stringify({
      workspaceId: source.workspaceId,
      version: source.version,
      rows: source.rows,
      stale: source.stale,
    }),
  );
} finally {
  await pool.end();
}
