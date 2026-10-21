# Performance budgets and release measurements

## Interpret the target precisely

The requested sub-500 ms page experience is an aggressive target that depends on device, network, cache, geography, hosting, and route complexity. It is not a universal Core Web Vitals standard and has not been established by this package. Distinguish network response time, first contentful paint, largest contentful paint, and client-side navigation latency when reporting results.

For a nearby CDN with a warm cache and a capable desktop, target a fast document response and immediate static content. For realistic mobile users, use Core Web Vitals as release gates at the 75th percentile: LCP ≤ 2.5 seconds, INP ≤ 200 ms, and CLS ≤ 0.1. Set stricter internal budgets where deployment measurements support them. A static build completing successfully does not measure those metrics.

## Proposed budgets

These are engineering targets to measure and refine, not reported results.

| Measure | Initial target | Measurement context |
| --- | --- | --- |
| Cached HTML TTFB | ≤ 200 ms | Deployed CDN, declared region and network |
| Static first content paint | ≤ 500 ms stretch goal | Warm nearby CDN, fast connection, desktop; report cache state |
| Mobile LCP | ≤ 2.5 s | Deployed site, representative mobile device/network, p75 field data when available |
| Interaction latency / INP | ≤ 200 ms | p75 field data; separately trace workflow/chart interactions in the lab |
| Layout shift / CLS | ≤ 0.1; aim ≤ 0.02 | Complete journey, including hydration, dialogs, errors, and changed data |
| Route JS transfer | ≤ 200 KiB gzip starting budget | Route's required first-load scripts, including shared framework code |
| Route CSS transfer | ≤ 40 KiB gzip starting budget | Styles used by the initial route |
| Fonts | 0 external blocking requests | A self-hosted Inter variable WOFF2 subset loads with `font-display: swap`; no third-party font request |
| Long tasks after idle | No avoidable task > 50 ms | Midrange mobile CPU trace during node drag, chart navigation, and simulation |
| Ambient animation | Stay within frame budget and yield offscreen | Real target device, reduced motion, and hidden-tab behavior |
| Image / canvas stability | Dimensions reserved before load | Initial render and resize; include any future assets |

Framework and dependency costs may exceed an aspirational budget. Inspect the emitted artifacts and route waterfall before promising a payload. Do not remove labels, focus handling, validation, or other accessibility behavior to chase a benchmark.

## Current architectural choices

- Static export serves prebuilt markup without a request-time application server. Hosting still determines latency, caching, compression, and connection overhead.
- The reference self-hosts a subset of Inter Variable at `public/fonts/inter-latin.woff2` with `font-display: swap` and system fallbacks. The accompanying `OFL.txt` carries the font license. Measure font swap/layout impact on the target device; adding more scripts or brand faces changes the payload.
- React client boundaries provide local interaction. Keep static copy in server-rendered page components when practical; avoid making the entire app client-only to support one interactive panel.
- SVG charts expose exact data and avoid a general-purpose charting dependency. Keep point counts bounded; aggregate large telemetry series server-side before plotting.
- The workflow canvas uses bounded node/edge counts and domain validation. A large production graph needs viewport culling or virtualization and profiled edge updates.
- Framer Motion supports deliberate feedback. Animate transforms/opacity, avoid reflow-heavy properties, and honor reduced motion.
- No hero photo/video is required for the visual identity. Future visual assets must include dimensions, responsive variants, and a measured preload policy.

These choices support good performance; they do not prove it. Inspect implementation and traces after every major visual or interaction change.

## Build and serve a production artifact

```sh
npm ci
npm run typecheck
npm test
npm run build
python3 -m http.server 3000 --directory out
```

The Python server is a local preview only. It does not reproduce CDN compression, HTTP/2 or HTTP/3, production cache headers, TLS, or edge geography. Do not benchmark `next dev` as production: development adds compilation and debugging overhead.

For the deployed static host:

- Enable Brotli or gzip for HTML, CSS, JS, SVG, and JSON where appropriate.
- Serve hashed `/_next/static/` assets with long-lived immutable caching.
- Use shorter HTML caching with controlled invalidation so newly deployed pages reference matching assets.
- Retain assets needed by open sessions during a deployment to avoid stale HTML requesting deleted chunks.
- Configure directory-index routing for trailing-slash pages and a real 404 response for missing routes.
- Avoid public caching for any future personalized/API response; static public HTML cannot contain private tenant data.

## Measurement protocol

1. Build the exact release revision and record Node, npm, Next.js, browser, and dependency-lock versions.
2. Deploy to the intended hosting service. Record URL, region, CDN/cache configuration, and whether authentication changes the delivery path.
3. Run Lighthouse or equivalent lab tooling on `/`, `/observability/`, `/developers/`, `/workflows/`, `/pricing/`, and `/docs/`. Use at least three runs per route and report median plus variation.
4. Separate cold-cache, warm-cache, and client-navigation results. Name the device/CPU slowdown and network preset rather than describing them only as “mobile.”
5. Trace the homepage animation and the busiest operational interactions. Check JavaScript tasks, memory growth, event handlers, rendering/paint cost, and whether background animations pause appropriately.
6. Test at 320, 768, 1440, and 3840 CSS px. A large canvas can multiply pixel work; cap its backing resolution/device pixel ratio if profiling shows a bottleneck.
7. Measure with reduced motion and verify no essential content appears late or remains invisible.
8. After launch, collect real-user LCP, INP, and CLS without recording sensitive page content or prompts. Segment by route, device, network, geography, and app version when sample sizes are sufficient.

A single desktop score cannot establish the mobile experience. Lighthouse's lab interaction proxies do not substitute for field INP. Report laboratory and field evidence separately.

## Prevent layout shift

Reserve stable space for graph and chart surfaces, skeletons, logos, code panels, and any asynchronous media. Keep validation and status feedback from moving the primary action unpredictably. Use tabular numbers for aligned metrics and allow wider values to wrap or fit without clipping.

Do not render a large empty hero that becomes populated only after hydration. Maintain the same semantic shell in the initial HTML and client render. For a production session, resolve the workspace before rendering private data rather than briefly displaying one tenant and replacing it with another.

When changing languages, data ranges, billing periods, or selected nodes, preserve useful surface dimensions without fixing every mobile card to a desktop height. Internal scrolling is appropriate for code, tables, and graphs; page-level horizontal overflow is a defect.

## Practical optimization sequence

Optimize from evidence:

1. Remove accidental large client imports and repeated data payloads from the slow route.
2. Split expensive, nonessential interactive surfaces when they are below the fold, while preserving a stable meaningful fallback.
3. Reduce animation work: use refs for per-frame canvas state, cap density, avoid React renders per frame, and suspend offscreen/hidden activity.
4. Bound chart samples and graph node counts. Batch stream updates so a high-frequency event feed does not trigger a render for every token.
5. Cache public static assets and aggregate server queries; cancel obsolete requests on workspace/range changes.
6. Profile again under the same conditions and document the change. Do not repeatedly broaden testing after a passing focused change unless new evidence justifies it.

Memoization and code splitting add complexity and can hurt responsiveness if used indiscriminately. Apply them to measured work, not every component by default.

## Release evidence table

| Route / scenario | Device / network | Cache | TTFB | FCP | LCP | INP or lab interaction trace | CLS | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Homepage | Not measured | — | — | — | — | — | — | Record deployed build |
| Observability range + keyboard point | Not measured | — | — | — | — | — | — | Include export/table state |
| Workflow drag + connect + save | Not measured | — | — | — | — | — | — | Include largest supported graph |
| Developer language + simulation | Not measured | — | — | — | — | — | — | Include console updates |
| Pricing period + ROI input | Not measured | — | — | — | — | — | — | Include narrow viewport |
| Documentation | Not measured | — | — | — | — | — | — | Include navigation |

Update this table with actual results and retained reports. Until that happens, describe sub-500 ms delivery and WCAG compliance as targets rather than verified product claims.

## Primary references

[Next.js static export configuration and limitations](https://nextjs.org/docs/app/guides/static-exports), [Tailwind CSS installation for Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
