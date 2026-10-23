# Intelligence OS validation record

This record describes the **2026-10-23 local reference verification** of the Intelligence OS upgrade. It supersedes the v1 static-export validation. The application now needs a Next.js server, PostgreSQL, a worker and Python. Passing local checks does not establish production capacity, universal accessibility conformance or live-provider correctness.

## Acceptance criteria and evidence

| Acceptance criterion                                                                              | Local result                           | Evidence / scope                                                                                                                                        |
| ------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing template and new server code compile with strict types                                   | Passed                                 | `npm run typecheck`; Next.js 15.5.28 production build                                                                                                   |
| Financial and cohort calculations match independently accumulated truth                           | Passed                                 | Unit and PostgreSQL integration assertions; integer-cent fixtures independent of production SQL                                                         |
| Seeded data is reproducible and sufficiently large                                                | Passed                                 | 249,150 facts, three organizations, 36 months from October 2023 through September 2026; stable version/hash                                             |
| Generated plans cannot write, select arbitrary relations/functions or execute multiple statements | Passed for covered cases               | Compiler/AST rejection tests; application accepts catalog plans rather than raw model SQL                                                               |
| Membership, roles and tenant context are enforced on the server                                   | Passed for covered cases               | Forced database RLS, non-owner runtime role, forged-role rejection, pooled context reset, cross-workspace resource and API denials                      |
| Imports can be reviewed and reproduced without overwriting their source                           | Passed                                 | Actual queued CSV profile → preview → immutable transformation version → selected-dataset sum; Python round-trips CSV/XLSX/JSON/Parquet                 |
| Analyst facts come from calculations; unavailable providers fail clearly                          | Passed with mocked provider responses  | Strict structured-plan contract; invented model numbers are not published as facts; unconfigured connected AI fails closed                              |
| At least 30 evaluations execute against known expectations                                        | Passed: 32 cases                       | Deterministic pipeline baseline; all 32 case checks passed, weighted score remains **null/incomplete**, not a measured LLM score                        |
| Forecasts/cohorts/anomalies report methods and limitations                                        | Passed for supplied fixtures           | Seasonal forecast/history guard, zero-customer cohort, isolated spike, multiple-comparison adjustment, scenario arithmetic                              |
| Power BI tokens use authorized server-derived resources and identities                            | Passed with mocked Microsoft responses | Profile/report/model/RLS mapping contract and denial tests; creator-only export retrieval rechecks current mapping/identity; no fake token in demo mode |
| Users can complete essential workspace journeys                                                   | Passed: 5 browser tests                | Filters, definitions, saved views, command navigation, upload/review/publish/analyze/save, lab, report preview, governance, viewer restrictions         |
| Default workspace routes have no detected automated accessibility violations or page overflow     | Passed in tested states                | Eight routes; axe WCAG A/AA tags; containment at 320, 1440 and 3840 CSS px                                                                              |
| Real OIDC identity proof does not automatically grant workspace access                            | Passed against local Keycloak          | PKCE login, initially missing membership, explicit operator membership grant and subsequent authorized access                                           |
| Locked production dependencies have no currently reported high-severity audit findings            | Passed in local audit                  | `npm audit --omit=dev --audit-level=high` reported zero vulnerabilities at verification time; not a security certification                              |

## Recorded test totals

| Suite                                          | Result                         | What it covers                                                                                                          |
| ---------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                     | 23 passed                      | 13 retained template tests, 7 Intelligence OS tests and 3 canonical-import tests                                        |
| Python analytical tests                        | 8 passed                       | Four file formats, parser/quality edge cases, reviewed transforms, cohort/forecast/anomaly/comparison/scenario fixtures |
| `npm run test:integration`                     | 21 passed                      | PostgreSQL/auth/jobs/calculations, 32-case evaluation execution, provider contract mocks and scoped cache timing        |
| `npm run test:e2e` against a production server | 5 passed in approximately 60 s | `tests/e2e/workspace.spec.ts`; Chromium, one worker                                                                     |
| TypeScript and production build                | Passed                         | Dynamic workspace/API routes plus preserved public routes                                                               |

The 32 benchmark cases are executed inside an integration test; they are not 32 additional top-level test files. The local OIDC exercise is separate from the automated Playwright suite. Provider contract mocks verify application behavior, not Microsoft/OpenAI service availability.

## Reproduce

Follow [Onboarding](ONBOARDING.md) to provision the local database, dependencies and seeded data. Start the worker before integration or browser checks.

```sh
npm ci
npm run typecheck
npm test
.venv/bin/python python/test_analytics.py
npm run test:integration
npm run build
npm run start
# In another terminal, with the production server already running:
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

For container-only Python verification, use the worker image's `/opt/venv/bin/python`. The Playwright configuration reuses an existing server; if none is running it starts development mode. Start the production build explicitly when reproducing the production browser results. Install Playwright Chromium if system Chromium is absent.

The tests create local sessions, uploaded versions, views and analyses in the disposable reference workspace. Use a separate database/Compose project for verification, not a database containing customer work. Record the tested commit, lockfile, runtime versions and environment when comparing runs.

Connected operational metrics and the lab accept operator-provisioned canonical snapshots. The import, immutable version pinning, freshness and read-only runtime boundary are covered by three integration tests. Vendor-specific extraction/normalization and scheduled refresh remain deployment responsibilities; see [Data sources](DATA-SOURCES.md).

Both final Docker targets build successfully on Node 22. A separate Compose project initialized all five migrations and 249,150 facts on a fresh database; the smoke test passed sign-in, tenant denial, worker import, shared-volume storage and a computed sum of 30. The web container ran as non-root without database administration/bootstrap password variables. All eight Python tests also passed inside the worker image.

Machine-readable evidence: [validation record](reports/validation-2026-10-23.json) and [actual deterministic baseline](reports/deterministic-baseline.json). The baseline retains its original unrecorded build-revision field; the validation record identifies the source checkout.

## Still unverified or incomplete

- Live OpenAI answers, token/cost accounting and repeated model-version comparisons require configured credentials and an explicit supported model. No paid model benchmark has been executed.
- Microsoft service-principal authorization, capacity eligibility in a real tenant, effective-identity RLS outcomes, embedded report behavior, token renewal, report exports and refresh completion require provisioned Power BI resources. Export authorization fingerprints detect application mapping/identity changes, not remote semantic-model RLS changes that leave the mapping identical. See the [live acceptance checklist](POWER-BI.md).
- No production traffic/load study, million-row import stress test, browser/device matrix, independent penetration test, backup-restore exercise or field Core Web Vitals study has been completed.
- Automated accessibility checks cover loaded default application views. Manual screen-reader, zoom, touch, focus-restoration, complex error-state and live embedded-report verification remain open. See [Accessibility](ACCESSIBILITY.md).
- Revoking a job actor's membership blocks publication/access but can also prevent that actor from writing a terminal job status. Operations reconciliation remains necessary for this case.

The [feature-status matrix](FEATURE-STATUS.md) separates implemented calculations, labeled simulations, configuration blockers and unverified integration behavior.

Final Docker verification used a separate `axiom-verify` Compose project on local ports 3100/5437 with fresh PostgreSQL/artifact volumes, Node 22 and Python 3.11. Local native runtime used Node 24.19 / Python 3.12. The temporary verification containers were removed after checks; no customer database or original deployment was changed.

Operator CLI verification passed on temporary workspaces: membership and Power BI configuration changes write audit records atomically, and concurrent attempts to reuse one Microsoft workspace/profile across organizations allow only one mapping. These commands require the isolated provisioning credential; audit identifies its operator channel rather than claiming a human identity verified by the application.
