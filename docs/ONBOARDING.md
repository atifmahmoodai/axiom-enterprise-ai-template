# Onboarding: Intelligence OS

## Docker reference

Install Node.js 22 LTS and Docker Compose v2. Run `npm ci`, `npm run setup`, then `docker compose up --build -d`. The init service runs migration and seed jobs before web/worker start. Visit http://localhost:3000/login/.

The setup command preserves an existing `.env`. It generates database and Keycloak administration credentials without printing them. Do not commit `.env`, `.data`, `.venv`, database volumes or downloaded reports. To regenerate a development database use a separate Compose project/volume; do not remove an existing volume containing customer data.

Local demo accounts:

| Identity             | Membership                         |
| -------------------- | ---------------------------------- |
| Alex / demo-owner    | Owner in Atlas, Helix and Meridian |
| Sam / demo-analyst   | Analyst in Atlas                   |
| Taylor / demo-viewer | Viewer in Atlas                    |
| Jordan / demo-helix  | Analyst in Helix                   |

Selecting an account creates a real random, hashed server session. This is intentionally a local demonstration sign-in mechanism, not production identity proof. Set `AXIOM_DEMO_LOGIN=false` before exposing a deployment to customers.

## Native development

```sh
npm ci
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm run setup
docker compose up -d postgres keycloak
npm run db:migrate
npm run db:seed
npm run worker
# In another terminal:
npm run dev
```

If setup ran before the virtual environment existed, set `PYTHON_BIN=.venv/bin/python` in `.env`. The Python executable and bundled program are server configuration, never request values. Native scripts load `.env` through Node's `--env-file`; Next loads it automatically.

## First walkthrough

1. Sign in as Alex. Filter the dashboard, inspect a metric definition and save a view.
2. Import a CSV in Data Workbench. Wait for profiling, review issues, preview a transformation, then publish a new version.
3. Open AI Analyst. Choose the uploaded version; ask for a row count or a sum/average/minimum/maximum of a numeric field. Choose an optional grouping field. Inspect its query and source hash.
4. Choose reference facts to explore catalog-defined SaaS metrics. Follow up with an explicit period or segment. Save the analysis.
5. Open Analysis Lab with the full 2023-10-01 through 2026-09-30 history for forecast backtesting. Inspect method assumptions and uncertainty.
6. Run the deterministic evaluation. All cases have known expectations; absent model-cost evidence leaves the weighted score incomplete.
7. Inspect local report pages, saved work, jobs and audit history. Sign in as Taylor to verify restricted actions.

## OIDC identity

The optional Keycloak service imports an `axiom` realm and public PKCE client. Create your own test user in Keycloak administration using the locally generated admin password. Organizational sign-in uses `OIDC_ISSUER`, `OIDC_CLIENT_ID`, optional `OIDC_CLIENT_SECRET`, and callback `APP_URL/api/auth/callback`.

The browser issuer is http://localhost:8081/realms/axiom. Docker web resolves it internally through the narrowly scoped `OIDC_INTERNAL_ORIGIN=http://keycloak:8080` rewrite. Insecure HTTP is permitted only when `AXIOM_ALLOW_INSECURE_OIDC=true` in the local configuration. Production requires HTTPS and the flag disabled.

For Microsoft Entra, register the web callback, configure the tenant-specific OIDC issuer and client credential, and disable demo sign-in. On the first successful login the verified issuer+subject creates a user with **no membership**. A trusted provisioning operator must inspect that application user ID and grant the intended membership:

```sh
npm run member:add -- USER_ID atlas analyst
```

Membership is never inferred from an email address. The CLI requires the migration/provisioning database credential and is not exposed through the web API.

## Connected providers

Connected operational dashboards and the Analysis Lab require a canonical fact snapshot. After migrations, prepare the reviewed JSON described in [Connected data sources](DATA-SOURCES.md), then publish it from an isolated operator environment:

```sh
npm run facts:import -- WORKSPACE_ID VERIFIED_ACTOR_ID /secure/path/snapshot.json
```

The actor must be an existing administrator or owner of that workspace. The command uses `DATABASE_ADMIN_URL`, validates the source contract, creates an immutable version and activates it atomically. It does not perform vendor extraction or implicit currency/unit conversion. Historical versions remain available; the declared upstream refresh timestamp controls stale-data status.

Set `AXIOM_MODE=connected` and restart/recreate web and worker after configuring identity and the services you use. Select the supplied source name and a date range within its coverage. Operational requests fail clearly until a source is provisioned; ordinary uploaded files stay separate and do not automatically populate SaaS metrics. Production sign-in must use verified OIDC with demo login disabled.

For OpenAI, configure `OPENAI_API_KEY` and an explicit `OPENAI_MODEL` supporting strict structured output. Optional input/output rate variables and `OPENAI_PRICE_CARD_VERSION` produce estimated costs; missing rates yield null. Keep keys server-side.

Power BI setup is in POWER-BI.md. Configured application users and Microsoft service-principal credentials are independent identities. Selecting connected mode does not configure a provider automatically and does not make reference SaaS facts production data.

## Production operations

Use HTTPS, an external production OIDC provider or production Keycloak deployment, persistent encrypted storage, regular PostgreSQL and artifact backups, and a secret manager. The reference Keycloak `start-dev` service and local demo sign-in are development facilities.

Run migrations with a separate identity. Web/worker Compose environments deliberately exclude database administration credentials. Mount Power BI certificates read-only at the configured server path. Set `AXIOM_GIT_SHA` to the deployed commit for evaluation provenance.

Record tenant-denial, restore, cancellation, export, provider-error, screen-reader and performance checks against your actual deployment. The provided code is not a security or accessibility certification.

Operator membership and Power BI mapping commands record configuration audit events. Protect the isolated provisioning credential and retain your external operator identity logs; the application audit marks these actions as `operator:database-provisioning`. Power BI mapping publication is serialized to prevent concurrent cross-organization profile reuse.
