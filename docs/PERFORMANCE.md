# Intelligence OS performance and resource limits

The upgrade uses request-time authentication and database queries. Static-export timings from the original template do not characterize the protected workspace. **Sub-500 ms page loading has not been demonstrated.** A warm function-call measurement is not document TTFB, LCP, INP or a mobile page-load result.

## Recorded local evidence: 2026-10-23

| Measurement                                  | Result                                            | Conditions and limits                                                                                                  |
| -------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Protected workspace first-load JavaScript    | 129 kB, including 103 kB shared                   | Next.js 15.5.28 production build estimate; not a measured compressed network waterfall                                 |
| Login first-load JavaScript                  | 111 kB                                            | Same build; dynamic authentication entry                                                                               |
| Public route first-load JavaScript           | 107–157 kB                                        | Retained template plus documentation routes                                                                            |
| Five concurrent warm dashboard service calls | 36, 36, 50, 50, 101 ms                            | Direct server-function timing, same process, cache primed, local PostgreSQL; excludes HTTP, browser work and TLS       |
| Earlier uncached dashboard service calls     | Approximately 847–1,292 ms                        | Local reference session; not a controlled cold/warm comparison; concurrent build activity increased some observations  |
| Production browser suite                     | Approximately 60 s for five tests                 | Chromium on the local production server; functional-test duration during Docker build activity, not a page-speed score |
| Horizontal containment                       | No document overflow at 320, 1440 and 3840 CSS px | Eight loaded workspace routes; not a CLS measurement                                                                   |

Reference workload: 249,150 facts across three organizations, with 83,050 facts in the queried workspace and 36 months of history. The recorded warm timing used January–September 2026 and five concurrent calls. The host provided approximately three vCPUs and 10 GiB RAM; Node 24.19 executed the native checks, PostgreSQL 16 ran locally in Docker, and no WAN latency or CPU/network throttling was applied. The deployment reference targets Node 22 LTS. These measurements do not establish hosted capacity or service-level commitments.

## Bounded processing

| Boundary                  | Implemented control                                                                                  | Practical limit                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Upload                    | 50 MiB file cap                                                                                      | Request parsing still consumes memory; put a matching request-size cap on the production proxy      |
| Decoded table             | 1,000,000 rows, 128 columns, 200 MiB estimated decoded data; 64 KiB text cells                       | Some parsers allocate before final frame validation; this is not an operating-system memory sandbox |
| XLSX                      | ZIP expanded-size/member limits, first worksheet, no macro payloads                                  | Formula-like content is preserved as text; formulas are never calculated                            |
| Preview                   | Paginated rows, at most 1,000 per request                                                            | Full source is not sent to the browser                                                              |
| Analytical result         | Up to 10,000 rows per validated plan                                                                 | Bounds returned data; does not by itself bound scanned source bytes                                 |
| PostgreSQL transaction    | 15 s statement timeout, 3 s lock timeout, 16 MiB work memory                                         | Work memory is per operation; total process memory can exceed it                                    |
| Read-only analytical role | 128 MiB temporary-file limit and forced RLS                                                          | No scanned-byte counter or planner-estimate budget is implemented                                   |
| Uploaded aggregate query  | DuckDB external access disabled, one thread, 256 MiB memory setting, 15 s subprocess deadline        | Python/pandas memory lies outside DuckDB's internal memory setting                                  |
| Python process            | Fixed trusted program, no shell execution, sanitized environment, 16 MiB JSON input and 8 MiB output | Normal deadline 60 s; timeout/cancellation terminates its process group                             |
| Background work           | Durable pg-boss queue, cancellation polling, bounded retries/deadlines                               | Long-running work still needs capacity planning; cancellation is cooperative between checks         |
| Stored resource           | 8 MiB JSON resource limit                                                                            | Original/canonical files are separate tenant-scoped artifacts                                       |
| Dashboard cache           | 30 s TTL, at most 100 entries, concurrent request coalescing                                         | Membership is revalidated before hits; keys include user, workspace, source hash and filters        |

Reference artifact storage is a shared local volume. Scale-out deployment requires a durable object-store adapter and coordination across web/worker instances. Do not claim distributed object storage, streaming imports or unlimited data-lake scans from this implementation.

## Browser delivery choices

- Next.js standalone output supplies public prerendered routes and protected server routes. Private API responses are not publicly cacheable.
- Charts receive aggregated bounded series and expose an exact-value table. The workspace does not render every fact row.
- The Microsoft client is loaded for report embedding; initial analytics navigation does not require an active Power BI session.
- Inter is self-hosted with `font-display: swap`. Chart surfaces and responsive panels reserve their layout; real CLS still requires measurement.
- Reduced-motion CSS and restrained transitions support readable analytical content. Keep new effects out of the critical data-reading path.

## Deployment acceptance targets

These are targets, not measured results: field p75 LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1, segmented by route/device and sufficient sample size. Establish API latency/error objectives from the deployed database, workspace size, geography and expected concurrency. The integration test's five-second dashboard ceiling is a regression guard, not a production SLA.

For a repeatable study:

1. Record the exact commit/lockfile, Node/Python/PostgreSQL/browser versions, host CPU/RAM, region, proxy/TLS settings and dataset versions.
2. Build and run production (`npm run build`, `npm run start`), or use the release containers. Do not benchmark `next dev`.
3. Separate cold process/cache, warm cache, authenticated page navigation and direct API results. Use at least three browser lab runs per scenario and report spread.
4. Exercise overview, import/profile/versioning, uploaded Analyst query, forecast, evaluation and Power BI independently. Record rows/bytes, concurrency, latency distribution, failures, peak memory and cancellation behavior.
5. Test representative mobile CPU/network throttling and 320–3840 px viewports. Capture a full journey for layout shift, including errors and dialogs.
6. Test configured limits with oversized/malformed files and a range of permitted dataset sizes in a disposable environment. Reject bounded work explicitly; never silently replace it with sample data.
7. After deployment, measure field Core Web Vitals and server percentiles without recording sensitive rows, prompts or tokens.

No hosted TTFB/FCP/LCP/INP/CLS, sustained-concurrency limit or maximum supported import throughput is claimed by the current evidence. See [Validation](VALIDATION.md) for the actual checks.

Compose resource ceilings: web 2 GiB / 1.5 CPUs / 128 processes; worker 1.5 GiB / 1 CPU / 128 processes; PostgreSQL 1 GiB / 1 CPU. These are configuration limits, not measured peak usage. Canonical snapshots are bounded to 50 MiB and 250,000 facts; browser snapshot CSV exports are bounded to 2 MiB, 10,000 rows and 128 columns.
