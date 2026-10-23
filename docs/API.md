# API contracts

All workspace APIs are under `/api/v1/workspaces/:workspaceId`. The path is a selector, not authorization; every call checks a session and membership. Success returns the JSON resource directly. Errors use `{error:{code,message},requestId}`. Responses are private/no-store. Mutations require the application Origin.

| Method/path                          | Result / minimum role                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| GET overview?from&to&region&plan     | KPI values, prior comparisons, monthly series, segments, provenance / viewer                                                  |
| GET catalog[?datasetId]              | Metric definitions or selected uploaded-dataset aggregations / viewer                                                         |
| GET lineage                          | Versioned nodes and declared edges / viewer                                                                                   |
| POST analytics                       | `{metric,groupBy?,filters?,limit?,datasetId?,dimension?}` -> result rows, query, source versions / analyst                    |
| POST analyst                         | `{question,conversationId?,datasetId?,datasetVersion?,dimension?,filters?}` -> answer, facts, query and limitations / analyst |
| GET datasets                         | Dataset summaries / viewer                                                                                                    |
| POST datasets                        | Multipart `file` -> dataset + queued job / analyst                                                                            |
| GET datasets/:id                     | Public schema, profile, preview and hash (no private storage path) / viewer                                                   |
| GET datasets/:id/rows?offset&limit   | Authorized paginated uploaded rows, max 1000 per page / viewer                                                                |
| POST datasets/:id/transform          | `{operations,preview}` -> preview or new dataset + job / analyst                                                              |
| GET lab?kind&filters                 | Statistical result, assumptions, uncertainty, provenance / viewer                                                             |
| GET/POST views or analyses           | List workspace saved work / viewer; create `{name,...}` / analyst                                                             |
| PUT/DELETE views/:id or analyses/:id | Author or administrator, with revision on update                                                                              |
| GET evaluations                      | Persisted evidence / viewer                                                                                                   |
| POST evaluations                     | `{provider:'demo' or 'openai',trials:1..3}` -> queued job / analyst                                                           |
| GET jobs[/:id]                       | Status/progress/results / viewer                                                                                              |
| POST jobs/:id/cancel                 | Original submitter or administrator / analyst                                                                                 |
| GET reports                          | Approved report catalog / viewer                                                                                              |
| POST reports/:key/embed-config       | Empty object only; returns scoped embed token/configuration / viewer                                                          |
| GET reports/:key/status              | Model refresh history / viewer                                                                                                |
| POST reports/:key/export             | `{format:'PDF' or 'PPTX' or 'PNG',filters?}` -> job / analyst                                                                 |
| POST reports/:key/refresh            | Queue refresh submission / administrator                                                                                      |
| GET artifacts/:id                    | Creator-only export download with current report/RLS authorization recheck / analyst                                          |
| GET audit                            | Recent immutable application audit events / viewer                                                                            |
| GET/POST memberships                 | List members or set `{userId,role}` / administrator; owner transitions require owner                                          |

Global routes: GET `/api/session`, GET `/api/health`, GET `/api/auth/login`, GET `/api/auth/callback`, POST `/api/auth/logout`, and explicitly enabled local POST `/api/auth/demo`.

Resource states distinguish ready/partial/stale/unavailable/failed. Numeric null is not zero. Jobs distinguish queued/running/completed/failed/cancelled; a submitted Microsoft refresh is not a completed dataset refresh.

Supported transformation recipes: drop_duplicates, trim, drop_missing, fill_missing, rename, select_columns and cast. Casts require an approved type; ambiguous dates require an explicit supported format. The quick UI offers ISO conversion and explicitly nulls invalid values only after preview. There are no executable expression transformations.

Uploaded metric IDs are `count`, or `sum:FIELD`, `average:FIELD`, `min:FIELD`, `max:FIELD` from numeric, valid fields. `dimension` must be an existing field. SaaS global date/region/plan filters do not apply to arbitrary uploaded schemas.

`POST exports` accepts `{rows,columns,filename?,datasetVersion?}` for a displayed client snapshot and returns CSV. It revalidates membership/analyst permission and Origin, neutralizes spreadsheet formulas, and enforces 2 MiB input/output, 10,000 rows and 128 columns. An audit event records counts and a claimed version without recording row values. The snapshot is client supplied, not an authoritative server recomputation; the response and audit metadata identify that distinction.

Connected operational sources use the operator-only `facts:import` CLI, not a browser configuration API. Blank dates default to the active source coverage. Provenance includes the pinned immutable version, source refresh time, declared refresh interval, stale state and calculation time.
