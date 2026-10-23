import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
if (!process.env.DATABASE_ADMIN_URL)
  throw new Error("DATABASE_ADMIN_URL is required for migration only.");
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of (await readdir("migrations"))
      .filter((v) => v.endsWith(".sql"))
      .sort()) {
      if (
        (
          await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [
            name,
          ])
        ).rowCount
      )
        continue;
      await client.query(await readFile(`migrations/${name}`, "utf8"));
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
        name,
      ]);
      console.log(`Applied ${name}`);
    }
    for (const [role, variable] of [
      ["axiom_app", "APP_DB_PASSWORD"],
      ["axiom_jobs", "JOB_DB_PASSWORD"],
    ]) {
      const password = process.env[variable];
      if (!password || !/^[a-f0-9]{48}$/.test(password))
        throw new Error(`Run npm run setup to configure ${variable}.`);
      await client.query(`ALTER ROLE ${role} PASSWORD '${password}'`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
