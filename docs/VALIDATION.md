# Validation record

The production static export was checked with the package lockfile and system Chromium. These results describe the supplied template, not a connected production service.

| Check | Result |
| --- | --- |
| TypeScript strict checking | Passed |
| Business-logic tests | 13 passed: cost arithmetic, negative/zero savings, bounds, payback, CSV assumptions, DAG cycles, dependency ordering, malformed imports, templates, disconnected paths |
| Next.js production export | Passed; all six product routes and fallback pages generated |
| Browser route checks | All six routes return HTTP 200, without page runtime errors |
| Responsive containment | No document overflow on six routes at 320px and 1440px; five product routes also checked at 3840px |
| Automated accessibility | axe-core WCAG 2 A/AA, 2.1 A/AA, and 2.2 AA tags: zero detected violations on six default routes |
| Dialog accessibility | Zero detected violations in command search, lead brief, SLA configurator, and demo-key creation dialogs at 390px |
| Production payload | Next.js reports 106–157 kB first-load JavaScript across the six product routes; static export is approximately 1.9 MB in total |

## Exercised browser journeys

- Invalid email feedback, valid lead-dialog submission, and local brief confirmation.
- Expandable industry scenarios and keyboard command-palette navigation.
- Workflow template selection, undo/redo, keyboard movement, pointer dragging, local save, ordered simulation, output inspection, and workspace partitioning.
- Monthly billing changes; ROI baseline save/restore, editable rates with negative savings, and the SLA availability calculation.
- Chart time ranges and arrow-key inspection; trace search, empty state, reset, and fallback filtering.
- Code-language keyboard tabs, simulated requests, demo-key creation/reveal/revocation, and key partitioning between workspaces.

## Limits

Automated accessibility checks do not establish full WCAG conformance. Complete manual screen-reader, zoom/reflow, pointer, and real-device testing with final content before a production release. No field Core Web Vitals, throttled mobile benchmark, security penetration test, real identity provider, production tenant-isolation test, or backend integration has been performed. Sub-500 ms loading remains an unverified target. Demo telemetry and responses remain synthetic.
