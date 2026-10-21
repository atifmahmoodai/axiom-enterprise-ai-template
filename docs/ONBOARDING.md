# Onboarding kit

## 1. Run the reference product

Use Node.js 22 LTS and a current npm release. Keep the supplied lockfile in source control for repeatable installs.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Visit all six routes, switch between Atlas and Helix, run a developer example, create a workflow connection, and change the ROI inputs. These interactions are available without credentials or paid services. Open the command palette with Cmd/Ctrl+K to move between routes.

A useful first walkthrough:

1. Select a hero network node, pause the animation, and generate/download a local workspace brief.
2. In Observability, change the time range, navigate chart points with arrow keys, filter execution traces, expand a trace, and export CSV.
3. In Developers, change model/prompt/temperature, switch snippet language, run the simulation, inspect its response and event log, and create/revoke a demo key.
4. In Workflows, choose one of three blueprints, configure a node, connect nodes, use undo/redo, export/import JSON, then inspect a simulated run and its output report.
5. In Pricing, select annual billing, configure/download SLA requirements, choose an ROI workload preset, edit rates and migration investment, save a comparison baseline, and export the scenario.
6. Open `/docs/` for the embedded onboarding surface. Browser state is local to this device; exports are local files.

Before making changes, establish your local baseline:

```sh
npm run typecheck
npm test
npm run build
```

## 2. Configure your product

| Change | Starting point | Decision to make |
| --- | --- | --- |
| Product identity | `lib/config.ts`, `app/layout.tsx` | Name, description, metadata, and navigation |
| Visual language | `app/globals.css`, component CSS, `public/fonts/` | Surface tokens, typography, spacing, and local font licensing |
| Global shortcuts | `components/command-palette.tsx` | Searchable route names, descriptions, and navigation anchors |
| Demo workspaces | `tenants` in `lib/config.ts` | Workspace labels and regions; these are UI fixtures |
| Commercial assumptions | `lib/roi.ts` and pricing components | Usage units, input bounds, currency, and rates |
| Agent templates | `lib/workflow.ts` and workflow components | Node types, allowed edges, and configuration fields |
| Product narratives | Homepage components | Headline, benefits, illustrative cases, and calls to action |
| Platform data | Operational page components | Replace fixtures through the adapter contracts in Architecture |

Retain visible labels identifying sample data until integrations supply real records. Replace fictional logos and outcomes with approved customer material before external marketing use. Prices and ROI assumptions are editable product copy, not contractual offers.

Keep content readable at 320 px and 200% zoom after changing labels. Check long tenant names, translated strings, and large numeric values: they affect layout more than the reference English copy.

## 3. Connect and release

Choose one deployment model:

- **Static demo or marketing site:** retain `output: 'export'`, build, and deploy `out/` to a CDN or static host. Point integrations at an authenticated external backend when needed. No secrets belong in the exported files.
- **Full SaaS application:** remove `output: 'export'` from `next.config.ts`, add server-only adapters and authenticated route handlers, then deploy to a Next.js runtime. Use `npx next start` after a production build when self-hosting. Add an appropriate `start` script for your deployment platform.

The static version cannot host request-dependent Next.js API endpoints, receive lead submissions, authenticate users, or enforce permissions. Statically generated GET route content is a different capability and does not provide an authenticated backend. For full SaaS, implement [the server boundary](ARCHITECTURE.md#production-tenant-boundary) before handling customer information.

Production integration sequence:

1. Establish identity, workspace membership, roles, and server-side workspace resolution.
2. Implement workspace-scoped repositories and database row policies; test cross-workspace denial.
3. Replace local workflow and API-key state with authenticated endpoints and validation.
4. Attach observability queries with cancellation, bounded time ranges, and an explicit stale-data state.
5. Connect the lead form to a validated server endpoint; disclose actual retention and consent behavior.
6. Connect billing only after confirming plan entitlements, currency, tax, and contract handling.
7. Complete accessibility, security, and performance checks in the deployment environment.

## Environment variables

The reference demo requires no environment variables. `.env.example` documents optional names for an integration implementation; the template does not read them automatically. Copy it to `.env.local` only when implementing those adapters.

`NEXT_PUBLIC_*` values are bundled into browser JavaScript. Keep service tokens, database URLs, signing secrets, and private API keys in server-only variables or the host's secret manager. Never put a real API key into the example code snippets.

## Working conventions

- Keep the layout shell stable; compose page-level feature components inside it.
- Start shared brand and workspace changes in `lib/config.ts`; also update existing display copy in `components/brand.tsx`, `components/site-shell.tsx`, marketing components, and route metadata. The current brand text is not completely driven by one configuration value.
- Keep business calculations in pure functions so tests cover inputs, caps, zero values, and rounding.
- Keep demo-state storage keys scoped by workspace. Treat localStorage failures as a recoverable browser condition.
- Carry loading, empty, validation, permission, and retry states into every real adapter.
- Use semantic controls and preserve keyboard alternatives when changing visual interactions.

## Handoff checklist

- [ ] Brand, navigation, metadata, and favicon match the client.
- [ ] Fixture data and fictional claims are replaced or clearly labeled.
- [ ] ROI assumptions have product and finance review.
- [ ] Tenant enforcement and endpoint permissions are verified outside the browser.
- [ ] Demo credentials are replaced with secure server-issued credentials.
- [ ] Production form submission, billing, and retry behavior work end to end.
- [ ] Automated checks pass; manual keyboard and screen-reader checks are recorded.
- [ ] Performance results include build commit, device, network, and hosting conditions.
- [ ] Monitoring, error reporting, database backups, and incident ownership are configured.

This checklist describes release work. Its presence does not mean these checks have been completed.
