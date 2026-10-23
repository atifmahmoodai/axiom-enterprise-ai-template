import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
if (existsSync(".env")) {
  console.log("Existing .env preserved.");
  process.exit(0);
}
const password = randomBytes(24).toString("hex");
const appPassword = randomBytes(24).toString("hex");
const jobPassword = randomBytes(24).toString("hex");
mkdirSync(".data", { recursive: true, mode: 0o700 });
writeFileSync(
  ".env",
  `APP_URL=http://localhost:3000\nAXIOM_MODE=demo\nAXIOM_DEMO_LOGIN=true\nPOSTGRES_PASSWORD=${password}\nAPP_DB_PASSWORD=${appPassword}\nJOB_DB_PASSWORD=${jobPassword}\nDATABASE_ADMIN_URL=postgresql://postgres:${password}@localhost:5436/axiom\nDATABASE_URL=postgresql://axiom_app:${appPassword}@localhost:5436/axiom\nJOB_DATABASE_URL=postgresql://axiom_jobs:${jobPassword}@localhost:5436/axiom\nAXIOM_STORAGE_DIR=.data\nPYTHON_BIN=${existsSync(".venv/bin/python") ? ".venv/bin/python" : "python3"}\nOIDC_ISSUER=http://localhost:8081/realms/axiom\nOIDC_CLIENT_ID=axiom\nAXIOM_ALLOW_INSECURE_OIDC=true\nKEYCLOAK_ADMIN_PASSWORD=${randomBytes(24).toString("hex")}\n`,
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Local .env created with generated credentials. Values are not printed or committed.",
);
