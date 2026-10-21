# Product blueprint and UI specifications

## Product structure

Axiom has two connected journeys: an executive evaluating an AI infrastructure platform and an engineer exploring how it operates. Both share a dark shell, a restrained mint accent, and the same workspace context. An editorial homepage establishes the story; the operational pages demonstrate tangible product behavior.

| Route | Primary visitor question | Primary next action |
| --- | --- | --- |
| `/` | Can this platform support our AI systems? | Request a demo or explore the platform |
| `/observability/` | Can we inspect quality, latency, and usage? | Change the sample view and inspect a data point |
| `/developers/` | Can our team integrate it? | Choose an SDK, run a simulation, inspect demo keys |
| `/workflows/` | Can we express and configure agent execution? | Select, connect, configure, and save a workflow |
| `/pricing/` | What is the commercial fit? | Compare tiers, model costs, export enterprise requirements |
| `/docs/` | How do we customize and deploy it? | Follow the quick start and production integration map |

## Layout sequence

1. **Orient:** a release pill and compact navigation establish the product and route hierarchy. A clear primary action stays prominent without taking over the page.
2. **State the promise:** the homepage hero combines a large editorial headline, short supporting copy, a lead-capture action, and a spatial agent graph. The graph communicates coordinated systems at a glance.
3. **Substantiate:** a fictional enterprise logo strip and expandable example case studies show the intended proof pattern. Example results are labeled, not presented as real endorsements.
4. **Demonstrate:** a four-column bento presents infrastructure capabilities as miniature product surfaces. Each card has one message, a functional preview where appropriate, and a route to deeper exploration.
5. **Resolve objections:** operational pages provide details for practitioners; pricing and the ROI calculator support budget discussions.
6. **Convert:** a final editorial call to action returns visitors to a single next step. The lead modal validates locally and explicitly describes its demo behavior.

## Design system

The visual hierarchy uses cosmic black backgrounds, raised graphite panels, bright neutral text, and sparing accents. Decorative glows never carry semantic meaning alone. Numeric displays use tabular figures where alignment matters.

| Token role | Reference value | Use |
| --- | --- | --- |
| Canvas | `#08080C` | Page background and deep graph field |
| Elevated slate | `#1C1D24` | Panels and controls |
| Primary foreground | Near-white | Headlines, selected values, and essential labels |
| Muted foreground | Light slate | Secondary labels; maintain text contrast |
| Cyber mint | Mint-green accent | Primary actions and healthy operational status |
| Hyper blue | Blue accent | Throughput series and technical annotations |
| Liquid violet | Violet accent | Secondary series and agent groupings |
| Hairline border | Low-contrast neutral | Decorative separation; focus uses a stronger outline |
| Font family | Self-hosted Inter Variable, system fallbacks | WOFF2 subset with `font-display: swap`; license shipped in `public/fonts/` |
| Letter spacing | Tight on large display copy | Editorial emphasis; normal spacing on dense data |
| Corner radius | Small controls, larger panels | Consistent grouping without inflated padding |
| Motion | Short transitions; slow ambient graph motion | Feedback and atmosphere with reduced-motion support |

`app/globals.css` is the executable source of truth for the exact palette and dimensions. The table describes token intent so a new brand can retain hierarchy while changing colors. Use one accent as the primary transaction cue; secondary series must also use labels, symbols, or legends.

## Shared shell

**Anatomy:** skip link, brand link, desktop navigation, command palette trigger, mobile navigation, workspace selector where applicable, page content, footer. Constrain editorial content to a readable maximum width while allowing the hero graph and charts to use their allocated space.

**Interaction contract:** the active route is distinguishable from hover; every control is reachable by keyboard; compact navigation can be opened and closed without a pointer. Links navigate and buttons perform actions. Workspace selection changes the demo context and the storage partition used by operational tools.

**Command palette:** Cmd/Ctrl+K opens a native dialog. Search matches route names and descriptions; Up/Down selects a result, Enter navigates, and Escape closes. An empty result state retains the search input and offers clear feedback. The palette supports nine route/anchor destinations.

**Responsive contract:** navigation collapses before labels collide; controls wrap without overlap; input labels remain visible; page-level horizontal scrolling is avoided. Charts and graphs use a bounded internal viewport rather than expanding the document.

## Homepage blocks

| Block | Structure and sizing | Behavior and states |
| --- | --- | --- |
| Announcement | Compact release pill above the hero title with a short product note and arrow affordance | Keep readable at 320 px; link target must be explicit |
| Hero copy | Eyebrow → large H1 → one-paragraph value proposition → primary CTA → trust annotation | Text appears immediately; motion must not hide the promise or delay navigation |
| Hero network | Reserved-height canvas with perspective projection, node links, and status labels | Pointer movement subtly changes the view; four node buttons expose simulated latency; pause, reset, and expanded-view controls retain keyboard access |
| Lead capture | Labeled work-email input and concise submission action in an accessible dialog | Validate format; associate errors with the field; show a local confirmation and download the session brief as JSON; do not imply delivery to sales |
| Social ticker | Fictional brand wordmarks in a continuously moving strip | Pause/play controls and reduced motion keep content usable without animation; duplicate items are hidden from screen readers |
| Case studies | Compact story cards with sector, challenge, example outcome, and expansion control | Expansion is explicit and keyboard-operable; examples are labeled; expanded copy does not trigger navigation |
| Product bento | Four-column, four-track composition on desktop; larger graph/chart surfaces anchor the grid | Two side-by-side card columns occupy the four underlying tracks on wide screens; one card column on narrow screens; card content determines mobile height |
| Closing CTA | Short statement, one supporting sentence, and action | Reuse the same conversion flow rather than creating divergent forms |
| Footer | Brand, product links, and fixture/demo context | Keep link labels descriptive and focus visible |

### Bento geometry and content contract

The 4×4 specification describes a modular four-column, four-track composition, not sixteen independent competing messages. Large cards span cells to give meaningful data room to breathe. Preserve DOM reading order when adapting spans to a new brand.

| Region | Desktop emphasis | Contents | Interaction |
| --- | --- | --- | --- |
| Agent orchestration | Large multi-cell anchor | Graph miniature, active nodes, status | Explore the workflow workspace |
| Observability | Wide chart surface | Latency or throughput trend, legend, summary | Switch 24-hour/7-day latency previews or open observability |
| Developer experience | Wide code surface | Dark code snippet and execution signal | Switch Python/Node.js preview snippets or open the complete developer playground |
| Ingestion | Compact supporting surface | Pipeline stages, source-to-index progress | Select Connect, Transform, Validate, or Deploy to inspect stage copy |
| Governance | Compact supporting surface | Policy/status summary | Open the relevant platform detail |
| Scale and economics | Separate editorial band below the bento | Architecture and ownership narrative | Continue to pricing and ROI |

Cards share a one-pixel border, restrained background glow, top-aligned labels, and consistent internal spacing. Hover can increase border contrast; it cannot be required to read the content or reach a link. Use a minimum height on chart and code panels to prevent layout shifts when interaction changes values.

## Observability workspace

**Hierarchy:** workspace context → page title and data-range controls → KPI cards → area chart → throughput and drift diagnostics → service-health cards → searchable execution traces → interpretive annotations.

| Block | Data contract | Interaction and interpretation |
| --- | --- | --- |
| KPI row | Requests, latency, token usage, and quality/health values | Units and sample context remain visible; status is not color alone |
| Multi-series area chart | Ordered time buckets with named series | Hover/focus reveals a labeled sample; range/filter controls update the view; preserve a textual summary |
| Token step chart | Time buckets and count/rate values | Steps represent bucket transitions rather than interpolated measurements; show the unit and window |
| Drift scatter | Model-specific deterministic sample coordinates | Switch models; show drift/bias readout and the demo threshold alongside axes |
| Execution intelligence | Five tenant-prefixed trace fixtures across three services | Filter by text, service, and status; expand a trace to inspect input/output tokens, cost estimate, routing decision, and a stage waterfall |
| Export | Current tenant/range with all displayed intervals | Download a local CSV; show export completion feedback |

The supplied visualizations use sample data. A production adapter must distinguish loading, no events in the selected interval, stale data, partial series, access denied, and service failure. A zero is a valid measurement; absence should be represented as absent rather than fabricated as zero.

## Developer workspace

**Hierarchy:** title and environment context → model/request configuration → language switcher and code panel → run action → response/event console → API-key management.

| Block | Specification |
| --- | --- |
| Language tabs | Python, cURL, Go, Node.js; clear selected state; code changes without shifting the panel unpredictably |
| Request configuration | Model selection, editable prompt, and temperature update all generated snippets; examples target a reserved example endpoint and use an environment-variable placeholder |
| Terminal | Monospace text, visible language, readable horizontal overflow inside the panel, copy feedback where available |
| Run control | Executes the local simulation; expose progress/completion feedback and prevent accidental duplicate runs |
| Console | Switch Response/Event log views, inspect JSON, copy results, and see estimated token/cost usage; label simulation explicitly |
| Demo keys | Browser-local credential examples; name and scope a key, reveal/hide/copy it, then confirm revocation; maximum ten active keys per workspace; no key grants service access |

In production, issue keys only on the server, reveal a new secret once, store only a cryptographic hash, audit creation/revocation, and check permission on each operation. A hidden text field is not secure secret storage.

## Agentic workflow matrix

**Hierarchy:** three starter blueprints → workflow identity and history/import/export/save/run actions → node palette → graph viewport → selected-node inspector → save/status feedback → test input and simulation inspector.

Nodes present a name, role/type, and connection affordance. Selection opens editable configuration. Dragging repositions a node within a bounded graph; connecting controls create meaningful edges rather than decorative lines. Browser-local persistence is partitioned by demo workspace.

The included blueprints are Customer intelligence, Document operations, and Risk intelligence. They share the same five-node foundation with different names/instructions. The editor allows up to twelve nodes, keeps bounded undo/redo history, imports validated JSON definitions, exports portable definitions, and saves per-workspace drafts locally. Invalid JSON, cycles, missing endpoints, duplicate identifiers, and out-of-bounds coordinates are rejected during restoration. Run validation additionally requires input/output nodes and every branch to reach an output.

Test input is retained in the session. Simulations follow dependency order, can be stopped, and produce an execution trace plus a downloadable JSON report of the request/configuration/dependency path. They do not call a model or interpret the instructions as an actual agent executor.

The keyboard path must support selecting a node, inspecting/updating its configuration, moving it through provided controls or arrow keys, connecting through explicit controls, and saving without dragging. Graph structure is understandable from node/connection labels outside the canvas drawing.

Production graph rules belong in the shared domain layer and must be revalidated on the server: unique node IDs, valid endpoints, allowed node types, duplicate/self-edge policy, coordinate bounds, node-count limits, configuration schema, and cycle policy. A saved graph is a definition, not evidence that agents executed.

## Pricing and ROI

**Hierarchy:** pricing promise → monthly/annual switch → tier cards with enterprise SLA trigger → ROI calculator → feature comparison → closing conversion action.

- Tier cards show a consistent billing unit and inclusion period. The enterprise column receives visual emphasis and a custom-contract action.
- The billing switch updates displayed prices and labels together; annual prices must state whether they are monthly equivalents billed annually.
- Comparison rows support hover/focus highlighting while preserving complete text without hover.
- SLA interaction configures data-residency region, availability target, and severity-one response target. It calculates the 30-day downtime budget and downloads a requirements JSON. It does not create a signed agreement or an uptime guarantee.
- ROI inputs accept data volume and agent scale. Show traditional cost, platform cost, and projected savings using the pure model in `lib/roi.ts`. Explain the assumed rates, period, and excluded costs beside the output.
- Workload presets are Pilot, Production, and Enterprise. Six editable monthly cost assumptions remain independent of the plan billing switch. A one-time migration investment affects net first-year savings and payback. A saved in-session baseline supports scenario comparison; CSV export includes every assumption needed to reproduce the estimate.
- Reject or normalize invalid numeric values consistently. Do not display `NaN`, infinite values, or mathematically misleading positive savings when the modeled result is negative.

## End-to-end journeys

| Journey | Steps | Success state | Failure / alternative state |
| --- | --- | --- | --- |
| Executive evaluation | Homepage → example case → pricing → ROI → demo request | Locally validated demo confirmation | Invalid email keeps the form open with an associated message |
| Developer evaluation | Developers → select language → run example → inspect console | Completed simulated response | Retryable adapter error in a production integration; no real request in the demo |
| Operator investigation | Observability → change range → inspect series → review drift | Understand a labeled sample and its units | No-data / partial-data states required when using live adapters |
| Workflow authoring | Workflows → add/select node → configure → connect → save → reload | Definition restored in the selected demo workspace | Invalid edge/configuration is rejected; storage failure must remain recoverable |
| Workspace separation | Save in Atlas → switch to Helix → inspect state → return | Each demo workspace retains its own local definition | Unknown/corrupt saved state falls back safely; browser partitioning is not authorization |
| Enterprise negotiation | Pricing → feature comparison → SLA configuration → download requirements → request brief | Download local planning requirements and a local contact brief | Real contact delivery and executed terms require backend integration |
| Scenario planning | Pricing → workload preset → edit rates/investment → save baseline → change workload → export CSV | Compare modeled first-year economics and retain inputs | Negative savings stay negative; nonpositive savings do not fabricate payback |
| Keyboard navigation | Cmd/Ctrl+K → search → arrows → Enter | Navigate to a selected route/anchor | Empty searches show a clear no-results state |

## Production state model

Use a consistent request state union for real integrations:

```ts
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading'; previous?: T }
  | { status: 'ready'; data: T; receivedAt: string }
  | { status: 'empty'; message: string }
  | { status: 'error'; code: 'unauthorized' | 'forbidden' | 'unavailable'; retryable: boolean };
```

Loading preserves the panel's dimensions. Empty states explain the current filter and offer one useful next action. Errors keep prior data only when visibly marked stale. Form validation should retain the user's input and move focus only when necessary to resolve an error.

## Embedded documentation page

`/docs/` presents a sticky section index on wide screens and a horizontally scrollable section index on narrow screens. Content progresses through Quick start, Platform guide, Configuration, Production architecture, Quality & accessibility, and Source & deployment. Code blocks scroll internally, module tables use semantic headers, and four guide cards return directly to the operational modules. The page explains the browser-only boundary alongside the relevant integration steps.
