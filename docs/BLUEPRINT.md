# Product blueprint: Axiom Intelligence OS

## Information architecture

Public routes retain the original product narrative, workflow editor, API playground and pricing calculator. The protected application has a persistent sidebar, authorized workspace selector, command search, identity/role display and connection-mode status.

Application routes are `/app/:workspaceId/overview`, `/datasets`, `/analyst`, `/lab`, `/reports`, `/catalog`, `/evaluations`, and `/governance`. Each route has one clear title, a contextual explanation, usable loading/error/empty states and source-aware actions.

## Layout blocks

- Executive: date/segment controls; saved views/export; four primary KPI cards; keyboard-inspectable revenue/cost chart; regional contribution filters; four secondary metrics; expandable provenance; metric-definition dialog.
- Workbench: dataset catalog; ingestion lifecycle explanation; profile totals; typed-field table; reviewed transformation controls; preview/publish distinction; record preview; integrity hash and recipe history.
- Analyst: selected dataset; optional grouping field; contextual metric catalog; suggested questions; follow-up conversation; calculated facts/results; SQL/source drawer; limitations; save/export actions.
- Lab: method selector; full date/segment controls; explicit scenario inputs; method evidence/statistics; forecast intervals; tabular results; warnings and provenance.
- Reports: approved report picker; Power BI loading/auth/error states; report pages/bookmarks; application/report filter synchronization; permission-aware export/refresh; local preview when explicitly in demo mode.
- Catalog: source-to-definition-to-consumer graph; inspectable nodes/edges; searchable metric cards with owner, formula, version and unit.
- Evaluations: provider selection; durable run progress; run comparison; case completion; weighted category evidence; missing-evidence disclosure; expandable expected/observed cases.
- Governance: actual membership/role management; job progress/cancellation; saved workspace analyses; append-only application audit history.

## Primary journeys

Executive: sign in -> choose workspace -> compare period/region -> inspect metric definition -> inspect evidence -> save view/export.

Analyst: import -> inspect quality -> preview recipe -> publish immutable version -> select it in Analyst -> execute a supported question -> inspect query/facts -> save analysis.

Evaluator: select deterministic baseline or configured provider -> start run -> inspect progress -> compare actual and expected cases -> examine critical failures and missing evidence -> compare model/prompt runs.

Administrator: verify identity membership -> install an approved integration mapping through provisioning -> test restricted report identity -> inspect export/refresh jobs and audit history.

## Design system

Cosmic/slate surfaces, mint primary actions, restrained violet/blue data accents, self-hosted Inter typography and deliberate whitespace. Colors encode meaning with text/icons as a second channel. Charts expose legends, honest axes, keyboard inspection and data-table alternatives. Motion is restrained and disabled through reduced-motion preferences.

Layouts stack at small widths, keep tables inside bounded horizontal regions and provide mobile navigation. The overview chart panel has a range-input layout control as a keyboard alternative to pointer resizing.
