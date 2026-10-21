# Accessibility implementation and verification

## Standard and current evidence

The design target is WCAG 2.2 Level AA. This guide describes implementation intent and release checks; it is not a conformance certificate or a completed independent audit. Unit tests for math and graph rules do not verify browser semantics, contrast, screen-reader behavior, or keyboard usability. Record actual browser and assistive-technology results before claiming compliance.

The reference uses semantic navigation and forms, a skip link, visible labels, native dialogs, reduced-motion awareness, chart summaries/data tables, and keyboard controls for operational interactions. Verify these behaviors after changing content, components, routes, or CSS. Native HTML provides a foundation, but incorrect labels, duplicate IDs, hidden focus, and unsupported interaction patterns can still create barriers.

## Interaction specifications

| Surface | Keyboard contract | Nonvisual / semantic contract |
| --- | --- | --- |
| Shared navigation | Tab reaches links and controls in visual order; skip link moves to main content | Active route is identified; menu controls expose expanded state; links have clear purposes |
| Command palette | Cmd/Ctrl+K opens; Up/Down selects; Enter navigates; Escape closes and restores focus | Search input, result list, selection, empty state, and dialog title are named |
| Workspace selector | Selection works with keyboard and a visible focus state | Label identifies workspace; new context is clear without relying on color |
| Hero and ambient network | Main actions remain reachable independently of the graphic; motion can be paused where applicable | Decorative geometry stays out of the accessibility tree; textual status explains meaning |
| Lead capture | Enter submits; errors retain entered text; dialog closes with Escape; focus returns to opener | Every field has an associated label; invalid input describes the error; confirmation states that the brief is local |
| Native dialog | Focus enters a meaningful control, stays inside while open, and returns on close | Dialog has an accessible name; background is inert; close button has a specific name |
| Case studies | Button opens/closes details without pointer hover | Expanded state is exposed; example outcomes are identified as illustrative |
| Chart range controls | Button group is operable by Tab and Enter/Space | Selected range is communicated with `aria-pressed` or equivalent native selection |
| Telemetry chart | Focus enters the selected point; arrows, Home, End navigate the series | Point labels provide time, request count, and latency; the data table supplies exact values |
| Drift diagnostics | Model selection works without pointing at small dots | Model, drift, bias, units, and example threshold have text equivalents |
| Developer language controls | Keyboard selects each language; copied/run state is perceivable | Selected language is exposed; terminal is readable text; simulation is labeled |
| Key actions | Create/copy/revoke controls have clear names; confirmation is understandable | Credential lifecycle feedback does not expose real secrets in persistent announcements |
| Workflow nodes | Nodes can be selected/configured without dragging; provided arrows or controls move them | Node name, role, connections, and selection state are available outside decorative edges |
| Workflow connections | Explicit controls select source/target and create/remove edges | Invalid edges produce actionable text; drawing alone is not the only representation |
| Workflow run | Run feedback does not trap focus or force focus on every event | Status updates are summarized through a polite region; simulated execution is explicit |
| Pricing period | Monthly/annual choices work with keyboard and expose selection | Price and billing cadence change together; annual equivalent is explained |
| ROI controls | Number fields offer direct input in addition to sliders; keyboard increments work | Units, limits, assumptions, and signed results are readable; invalid input remains recoverable |
| SLA details | Trigger, close, and all content are keyboard reachable | Accessible title identifies the example terms; no signed agreement is implied |

Avoid adding `role="tab"` unless implementing the complete tab keyboard model, including arrow navigation, selected state, controlled panel IDs, and appropriate tab stops. A labeled group of native buttons with `aria-pressed` is often sufficient for a short filter. Every SVG element exposed as an interactive button must have a usable focus state and an activation contract.

## Visual requirements

- Text contrast: at least 4.5:1 for normal text and 3:1 for large text. Large means at least 24 CSS px regular or approximately 18.66 CSS px bold.
- Essential control boundaries, icons, selected states, and focus indicators: at least 3:1 against adjacent colors when required by WCAG non-text contrast criteria. Decorative hairlines are not essential state indicators.
- Status must use labels, icons, line patterns, or shapes in addition to hue. Mint/violet chart lines need legends and exact-value alternatives.
- Maintain visible keyboard focus and ensure sticky headers, dialogs, and overflow containers do not obscure the focused control.
- Target sizes should be at least 24 × 24 CSS px or satisfy WCAG's spacing/exception rules; prefer 44 × 44 px for primary touch controls.
- Reflow to 320 CSS px without page-level horizontal scrolling, except content that inherently requires two dimensions. Charts, tables, code, and a node graph may use clearly bounded internal scrolling.
- At 200% text zoom, labels, forms, navigation, and dialogs must stay usable. Test 400% page zoom on a 1280 px viewport for the equivalent 320 px reflow case.
- Do not use tiny uppercase text for essential instructions. Avoid truncating data without an accessible full value.

Measure the final composited colors, including opacity, gradients, and disabled states. Passing the nominal text token against the nominal background is insufficient if the actual component adds transparency. A stronger border on hover does not replace a visible keyboard focus indicator.

## Motion and live updates

Respect `prefers-reduced-motion` in CSS and in Framer Motion. Reduced motion should remove ambient rotation, looping translations, spatial parallax, and nonessential entrance transitions while preserving functional feedback. Do not make text or essential controls depend on an animation completing.

Automatically moving content that lasts more than five seconds needs a pause, stop, or hide mechanism when WCAG 2.2.2 applies; reduced-motion support alone is not a universal substitute. Verify ticker and network controls separately. Avoid flashing content. Pause expensive animation when its surface is offscreen and when the document is hidden as a performance improvement.

Use `role="status"` or `aria-live="polite"` for discrete events such as save/copy completion. Avoid announcing every animation frame or rapidly changing telemetry point. Use `role="alert"` only for errors that need immediate attention. Keep prior results visible when a request fails and clearly mark stale data in a real integration.

## Manual verification script

Run against the production build in Chromium and Firefox, plus Safari where the intended audience uses it. Use an actual screen reader: NVDA with Firefox or Chrome, and VoiceOver with Safari. Browser accessibility-tree inspection does not replace listening to the experience.

1. **Page structure:** inspect each route for one clear H1, ordered section headings, named landmarks, page title, and a unique main target. Reach main content through the skip link.
2. **Keyboard-only tour:** unplug the mouse or avoid it. Traverse all controls with Tab/Shift+Tab. Activate links and buttons. Check that focus is visible, orderly, and not trapped outside a modal.
3. **Lead journey:** enter an invalid email, correct it, open the dialog, complete required fields, generate a local brief, close, and reopen. Verify error associations, dialog name, focus return, unique IDs, and no stale success state.
4. **Observability:** change the range; navigate chart points with arrows/Home/End; read the accessible data table; switch drift models; export the sample CSV. Confirm axes, units, and the selected workspace are understandable.
5. **Developer tools:** choose every language, read and copy the snippet, run the simulation, create a demo key, revoke it, and switch workspaces. Ensure feedback is announced without reading the full terminal repeatedly.
6. **Workflow authoring:** select each blueprint; add/select/configure a node; reposition it without dragging; connect two nodes; attempt a cycle; remove a connection; undo/redo; export/import a valid definition; reject malformed input; save, reload, and simulate/stop a run. Reach a valid outcome using the keyboard alone.
7. **Pricing and ROI:** switch billing periods; navigate the comparison; configure/download SLA requirements; select presets; save a scenario baseline; export CSV; input zero, the maximum, an empty field, a negative number, and a large value; review a scenario with negative savings if using custom rates.
8. **Responsive/reflow:** test 320, 375, 768, 1280, and 1920 CSS px, then 200% and 400% zoom. Check nested scroll areas can be reached and used by keyboard. Test landscape mobile and large text settings.
9. **Preferences:** enable reduced motion, forced colors/high contrast, and browser text spacing overrides. Confirm status and focus remain perceivable.
10. **Content stress:** use long workspace names, long code lines, translated navigation labels, large currency values, missing data, and backend errors after integration.

## Automated checks

Run the repository checks first:

```sh
npm run typecheck
npm test
npm run build
```

For accessibility, run an axe-based browser audit against every route and important open state: mobile menu, lead dialog, pricing terms, expanded case study, workflow inspector, and accessible chart table. The package does not include an automated accessibility suite by default; install your chosen tooling in the downstream project and record its version. Automated tools detect only a subset of accessibility issues and cannot establish full WCAG conformance.

Check duplicate IDs, accessible names, invalid ARIA, focus visibility, contrast, and document structure. Review rather than blindly dismiss rules involving SVG graphics, canvas, or color contrast. Every exception needs a human rationale and equivalent user access.

## Evidence record

Maintain a release record with the following fields:

| Field | Record |
| --- | --- |
| Commit / build | Exact revision and build command |
| Date / reviewer | Named reviewer and UTC date |
| Routes and states | Include dialogs, expanded content, error states, and narrow layouts |
| Browser / OS / AT | Versions and relevant settings |
| Automated tooling | Tool/version, result, retained report |
| Manual checks | Passed, failed, or not tested per scenario |
| Findings | User impact, criterion, reproduction, remediation owner |
| Retest | Fixed revision and verification result |

Do not publish “WCAG 2.2 AA compliant” solely because these guidelines exist or an automated report has zero findings. Verify the complete user journeys and document remaining limitations.

## Standard reference

Use the [W3C WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/) to map observed behavior to the applicable success criteria. The implementation and this guide do not replace a conformance evaluation.
