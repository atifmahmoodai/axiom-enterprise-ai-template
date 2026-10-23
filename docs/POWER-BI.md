# Power BI Embedded connection guide

## Delivered boundary

The application implements app-owns-data embedding with MSAL service credentials, a profile/workspace per Axiom organization, server-derived report/model mappings and effective identities, short-lived embed configuration, manual token renewal, report page/bookmark/filter APIs, export jobs and refresh submission/history. Demo mode contains a local report preview without a fake Microsoft token.

No Microsoft tenant, capacity, report or identity is provisioned by the repository. Live embedding, actual RLS behavior, file export, refresh and licensing remain unverified until your Microsoft environment is configured. Mocked contract tests are not a replacement for these live checks.

## 1. Capacity and service identity

Use production capacity supporting app-owns-data embedding: an appropriate Azure A or Fabric F capacity, or a supported existing EM/P capacity. PPU alone is not production embedding capacity and does not support exportToFile. Select a SKU after measuring concurrency, refresh load and export behavior; no paid resource is created by this package.

Register a Microsoft Entra application/service principal. Restrict Power BI service-principal tenant settings to an approved Entra security group. Authorize that identity to the required workspace/profile estate. Service-principal Power BI authorization comes from tenant/workspace configuration; adding delegated API permissions is not a substitute.

Configure server-only POWERBI_TENANT_ID and POWERBI_CLIENT_ID. Prefer a read-only mounted private-key PEM plus POWERBI_CERTIFICATE_PATH and POWERBI_CERTIFICATE_THUMBPRINT (SHA-256). A development client secret is also supported. Never use NEXT_PUBLIC_ variables for credentials or return an Entra access token to a browser.

Official references: [service-principal setup](https://learn.microsoft.com/en-us/power-bi/developer/embedded/embed-service-principal), [capacity requirements](https://learn.microsoft.com/en-us/power-bi/developer/embedded/embedded-capacity), [multitenancy profiles](https://learn.microsoft.com/en-us/power-bi/developer/embedded/embed-multi-tenancy).

## 2. Customer isolation and report model

Create one service-principal profile and one Power BI workspace for each Axiom organization. A customer's imported semantic model must contain only that customer's data. Apply additional region/user RLS inside that boundary. Do not point two customer mappings to the same workspace/profile.

Generate reproducible, organization-specific source tables:

```sh
npm run powerbi:export -- atlas
```

The ignored `.data/powerbi-atlas/` directory contains four fact CSVs and Customer, Date, Plan and Region dimensions. Import them in Power BI Desktop. Set Date columns to date, CustomerId/Name columns to text, monetary columns to fixed decimal, and Quantity to whole number. Disable auto-detected fact-to-fact relationships. Follow `powerbi/model.md` and `powerbi/measures.dax`.

Create four pages: Executive Overview (revenue/cost/MRR and trends), Retention & Cohorts (logo retention/NRR/GRR and starting cohort), Infrastructure Economics (cost, contribution margin and segment comparisons), Data Quality (source version, row counts and freshness). Configure report-native drill-through on approved customer/region fields. Add named bookmarks and test them before mapping them in the application.

Mark Date as the date table. Use single-direction dimension-to-fact relationships. Create the RegionScope dynamic RLS role and a RegionAccess lookup of approved usernames/regions. Test identities in Desktop and with an actual generated embed token; do not assume service-principal authentication automatically enforces user RLS.

Publish the report to that customer's capacity-backed workspace. Record canonical report/model IDs. This delivery includes precise authoring source/instructions, not a claimed validated PBIX/PBIP artifact.

## 3. Trusted mapping installation

Copy `powerbi/mapping.example.json` to an ignored local file under `.runtime/`. Replace every Microsoft ID and application user identity. `identities` keys are verified Axiom application user IDs, not arbitrary browser-provided usernames. Each mapping supplies the effective username and approved role names.

```sh
npm run powerbi:configure -- atlas .runtime/atlas-powerbi.json
```

Run this only in a trusted provisioning environment with DATABASE_ADMIN_URL. The web API exposes no generic Power BI mapping writer. Set AXIOM_MODE=connected and restart web/worker after service configuration.

The embed endpoint rejects request fields: report, model, profile, username and role come from the approved mapping. It verifies report metadata matches the approved model, issues a report/model-scoped V2 token and returns only embedUrl/reportId/embedToken/expiresAt/capabilities. RLS reports require an explicitly configured user identity.

[Microsoft embed-token and RLS guidance](https://learn.microsoft.com/en-us/power-bi/developer/embedded/generate-embed-token).

## 4. Renewal and interaction

The browser requests a new embed token before expiration, rechecks on visibility resume and calls report.setAccessToken. Membership is revalidated on each renewal. Microsoft accessTokenProvider automatic renewal is for user-owns-data, so this app does not use it for app-owns-data.

Application Date/Date, Region/Name and Plan/Name filters apply through SDK APIs. 'Use report filters' copies recognized date and single-region/plan selections back into the application. Visual-only or multi-value filters stay inside Power BI. Filters improve exploration; RLS remains the security boundary.

[Token renewal documentation](https://learn.microsoft.com/en-us/javascript/api/overview/powerbi/refresh-token).

## 5. Exports and refresh

Enable export/refresh capabilities only for supported reports and reviewed source connections. Export supports PDF, PPTX and PNG through asynchronous Microsoft operations, preserves the effective identity and approved application filters, polls completion, then stores an authorized artifact. Retrieval rechecks current workspace membership and analyst permissions.

Power BI capacity and tenant settings must support exportToFile. PPU is unsupported. Sensitivity labels and service-principal restrictions may prevent some PDF/PPTX exports. The app returns a clear failure instead of weakening security. [Export requirements and restrictions](https://learn.microsoft.com/en-us/power-bi/developer/embedded/export-to).

CSV-import reference models require manual republishing unless a refreshable source is configured. For scheduled/on-demand refresh against self-hosted PostgreSQL, configure the supported PostgreSQL connector, credentials and an on-premises gateway reachable from the Power BI service. Never expose the local database publicly just to refresh a sample report.

Refresh jobs submit an import-model refresh and report the request ID; history distinguishes submitted/in-progress/completed/failed. A submitted request is not a completed refresh. Provision/validate gateway data-source bindings in Microsoft before enabling refresh in the mapping.

## Troubleshooting and live acceptance

- 401/403: check service-principal security group, profile access, workspace role and mapping.
- Mapping changed: verify the report's canonical semantic-model ID.
- Missing identity: configure the app user and an RLS role supported by the published model.
- Expired token: verify server clock, membership, token renewal and inactive-tab recovery.
- Export failure: review capacity, tenant setting, sensitivity label and report support.
- Refresh failure: inspect gateway health, credentials, throttling and Microsoft refresh history.

Before customer use test Atlas-to-Helix denial, restricted/unrestricted region identities, no identity supplied, arbitrary report IDs, revoked membership during token renewal/export, filter synchronization, bookmarks, drill-through, export content and refresh completion. Record the actual capacity and Microsoft tenant settings used.
