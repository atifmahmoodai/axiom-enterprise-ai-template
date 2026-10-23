# Intelligence OS accessibility

WCAG 2.2 Level AA is the design target. This implementation has passed the automated checks described below; **it is not a WCAG certification or a completed manual accessibility audit**. The checks apply to the tested application states, not every report a customer may embed.

## Recorded evidence: 2026-10-23

The production Playwright suite passed five tests using local Chromium. Its accessibility test loaded all eight protected workspace sections: overview, datasets, analyst, lab, catalog, evaluations, reports and governance. axe-core reported **zero detected violations** using `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` tags at 1440 × 1000 CSS px.

The same eight routes had no document-level horizontal overflow at 320, 1440 and 3840 CSS px. A browser journey exercised Ctrl+K, search input and Enter navigation. Other journeys opened a metric definition, used labeled filters, completed an upload/transformation/analysis flow, and confirmed disabled viewer actions. These checks do not establish complete keyboard navigation, zoom/reflow, screen-reader or live Power BI report accessibility.

## Implemented interaction contracts

| Surface              | Keyboard and semantic behavior                                                                                    | Verification boundary                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Workspace shell      | Labeled navigation, current-route state, labeled workspace selector, visible focus styling                        | Default routes scanned; exhaustive focus order and mobile navigation require manual review                      |
| Command search       | Cmd/Ctrl+K opens a native dialog; input supports Up/Down and Enter; Escape closes                                 | Ctrl+K/search/Enter exercised; screen-reader selection announcements and focus restoration remain manual checks |
| Date/segment filters | Labeled native inputs/selects                                                                                     | Used in browser journeys; invalid-date and error feedback need assistive-technology review                      |
| Metric definitions   | Keyboard-operable metric button opens a native dialog with definition, units and limitations                      | Open/close journey exercised; every definition's spoken experience remains unverified                           |
| Revenue chart        | Focusable chart group; Left/Right/Home/End point inspection; exact values in a polite readout; chart/table toggle | Default state scanned; complete keyboard/chart-table parity needs manual checking                               |
| Chart legends        | Named native buttons expose selection through `aria-pressed`                                                      | Color is supplemented by names and exact-value tables                                                           |
| Panel width          | Native range input provides a keyboard alternative to pointer adjustment                                          | Manual touch/keyboard sizing and focus visibility remain to check                                               |
| Data workbench       | Labeled file input, transformation review and explicit publication action; bounded table previews                 | Upload/review/publish journey passed; complex parser-error states need review                                   |
| Analyst              | Labeled question/dataset inputs; textual answer facts, query and provenance; saved-analysis feedback              | Tested with an uploaded dataset; long responses and service-error announcements need review                     |
| Analysis lab         | Native method buttons expose selection; tables accompany statistical output and limitations                       | Forecast/cohort views exercised; all method-specific results need manual review                                 |
| Evaluations          | Labeled run/comparison/category selectors; pass/fail/incomplete labels accompany colors                           | Default view scanned; no claim about every possible failure combination                                         |
| Governance           | Named role and cancellation controls; viewer actions disabled; textual audit/job state                            | Default route and viewer restrictions exercised                                                                 |
| Power BI             | Labeled local preview and SDK host with connection/error states                                                   | Only the local preview was scanned; live report visuals, focus and export behavior remain unverified            |

The original public template retains its keyboard workflow controls, pricing calculator, developer examples and reduced-motion behavior. Previous v1 checks do not replace a new manual regression pass after customizing those surfaces.

## Visual and motion requirements

Maintain at least 4.5:1 text contrast for ordinary text and 3:1 for large text, and applicable 3:1 non-text contrast for essential controls and focus indicators. Measure final composited colors, including opacity and gradients; a nominal token pairing is not enough. Keep status labels and numerical alternatives so color is never the only source of meaning.

Visible focus must remain unobscured by sticky headers, dialogs or internal scrolling. Aim for 44 × 44 CSS px touch controls; verify the WCAG 2.2 target-size minimum/spacing rules where smaller targets are necessary. Tables, code and charts can have bounded internal horizontal scrolling, while navigation/forms should reflow to 320 CSS px.

Honor `prefers-reduced-motion` in CSS and motion components. Essential content must not depend on animation completing. Verify any retained continuously moving public-template content has the required pause/stop/hide behavior; reduced-motion support alone is not a substitute for every motion criterion.

Use polite live regions for discrete completion/status updates, and avoid announcing every chart frame or refresh. Errors should retain entered data and explain a recovery action. A screen reader must be able to distinguish unavailable values, zero, partial results and source freshness without interpreting color.

## Manual release checklist

Run against the production build, with representative data and user roles:

1. Complete sign-in, navigation, filtering, metric inspection, upload/review, analysis/save, evaluation and sign-out using only a keyboard. Check skip navigation, visible focus, Escape behavior and return focus after each dialog.
2. Repeat with NVDA plus Firefox/Chrome and VoiceOver plus Safari. Listen to page/section names, control labels, table headers, status/error announcements and selected states. Browser accessibility-tree inspection is not equivalent to this check.
3. Test 200% text zoom and 400% page zoom, long dataset/metric names, large/negative/missing numbers, long error messages and narrow viewports.
4. Inspect reduced motion, forced-colors/high-contrast mode, keyboard chart reading and chart-to-table parity. Ensure legends and status do not require hue perception.
5. Exercise empty, loading, permission-denied, partial, stale and failed-service states. Confirm no unexpected focus movement or content loss.
6. Test small-target controls and internal table scrolling on actual touch devices. Verify usable touch targets and that focused content is not hidden.
7. With provisioned Power BI, test report page/bookmark/slicer interactions, focus entry/exit, keyboard drill-through, token renewal and error recovery. Review the report author's own tab order, visual titles, alt text and color choices.
8. Record browser/assistive-technology versions, viewport, role, scenario, expected behavior, actual result and remediation. Retest affected journeys after changes.

## Reproduce automated checks

With the seeded database, worker and production server running, run `npm run test:e2e`. The suite uses system Chromium if available, otherwise the installed Playwright browser. See `tests/e2e/workspace.spec.ts` for exact selectors and the tested state. A zero-violation result means no issues were detected by those rules in those states; it does not cover every WCAG success criterion.
