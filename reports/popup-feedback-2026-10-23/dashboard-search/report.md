# Dashboard search popup completion

Date: 2026-10-23. This increment finishes transient record-search feedback in `apps/web/components/shared/DashboardSearch.tsx`. The component is shared by customer, partner, company and admin headers.

## Change and scope

- `Searching records...` now appears in `StatusPopup`, while matching permitted pages and the result list remain available. This short-lived progress card has no Dismiss control, avoiding a focus transfer that would close its search owner; settlement clears it, and normal Escape/outside closure remains available.
- Record-search failures, including partial failures, now float with the existing Retry search action. A failed search no longer renders an inline empty/retry message that could suggest a complete search.
- Result counts, combobox/listbox IDs, active-result navigation and allowed destinations remain. The list reports `aria-busy` during loading.
- The retry action prevents pointer-driven focus loss before click and returns focus to the active desktop/mobile input. Desktop Tab from Clear explicitly reaches the owned portal Retry; ShiftTab returns to Clear or the input. Desktop focus tracking recognizes both the search container and its error popup, including Dismiss, while actual outside focus closes the dropdown. Mobile popup anchors stay inside the existing modal, so shared nearest-dialog placement applies.
- `select()`, route handling, remote request effects, debounce, stale-response rejection, account/organization matching and authorization gates were not changed.

Only the shared search source and its existing `dashboard-search-ui.test.cjs` were changed as implementation. The single popup learning note was extended to list this shared consumer. No backend, package, browser or git mutation was performed by this worker.

## Verification

The latest focused results are **48 individual cases passed, zero failures/skips**. The UI file was rerun after the keyboard correction; unchanged loader/destination inputs retain their preceding passing results:

| Existing test file | Passing cases |
| --- | ---: |
| dashboard-search-ui.test.cjs | 19 |
| dashboard-search-loader.test.cjs | 17 |
| dashboard-search-destinations.test.cjs | 12 |

The new UI cases verify popup loading with available navigation/counts, pointer retry ownership, focus restoration, ordinary outside-blur closure, and mobile dialog ownership. A separate default-order simulation starts with input, Clear, unrelated header, portal Retry and Dismiss; it proves the forward/reverse bridge, continued access to Dismiss and portal-to-outside closure. Existing cases retain partial-hit, stale-response, context-change, role/subtype, contract-gate and navigation checks. Test mocks establish source/event behavior, not actual browser focus or portal geometry.

The initial red log contains four expected presentation failures. One intermediate green attempt exposed only whitespace inserted by the isolated element-text harness; the assertion now allows that whitespace. Independent review then found that body-portal Retry was unreachable through ordinary Tab before the unrelated header control. A dedicated red test reproduced that failure; the local keyboard bridge and document focus tracking made it pass. Review also identified that the loading card's Dismiss could blur and close its owner; the consumer now disables that control and the test checks its prop. Final and historical focused logs are preserved beside this report.

The loader initially encountered sandbox `EPERM` binding its fixture-only loopback HTTP server. A permitted rerun outside that restriction passed all 17 cases. It made no real provider request.

The global comparison found `requestDifferenceFiles: []` for the 42 changed web files. It also detected unrelated shipping changes in API package/test files and the lockfile relative to the earlier approved snapshot. That global receipt therefore does not pass as a whole; the parent task must reconcile those newer shipping changes. No claim of zero global critical drift is made for this increment.

## Handoff and limits

Source/test hashes are recorded in `receipt.json`. The independent shared-popup reviewer rechecked the final frozen source and reran all 19 UI cases successfully. Both reported desktop focus issues are resolved in that bounded source review; no additional source blocker was found. This is not a live-browser focus result. The parent task owns the final combined review, complete suite, production build, browser checks and deployment.

The earlier 361-case dashboard-consumer receipt remains historical evidence for its captured revision. This increment supersedes that receipt's `dashboard-search-ui.test.cjs` hash and adds four cases; it does not imply the other files were rerun here. Live pointer navigation was reported to the parent as an observation and was deliberately not rewritten without a deterministic failing reproduction.
