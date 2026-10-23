import { Pool } from "pg";
const [userId, workspaceId, role] = process.argv.slice(2);
if (
  !userId ||
  !workspaceId ||
  !["viewer", "analyst", "administrator", "owner"].includes(role)
)
  throw new Error(
    "Usage: npm run member:add -- USER_ID WORKSPACE_ID ROLE. IDs must be verified by the operator.",
  );
if (!process.env.DATABASE_ADMIN_URL)
  throw new Error(
    "Run only in the provisioning environment with DATABASE_ADMIN_URL.",
  );
const db = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
try {
  await db.query(
    "INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role",
    [workspaceId, userId, role],
  );
  console.log(
    "Membership provisioned for the specified subject-linked application user.",
  );
} finally {
  await db.end();
}
