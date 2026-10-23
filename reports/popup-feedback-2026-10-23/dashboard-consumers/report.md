# Dashboard floating feedback

Date: 2026-10-23. Scope: customer, partner, company and admin dashboard presentation. Production source was frozen before final evidence capture. The parent task owns the complete web suite, production build, browser checks, review, release and combined learning breakdown.

## Result

Temporary loading, failure, operation progress and short-lived action messages now use the shared `StatusPopup`. The first conversion covered 74 simple elements in 23 source files. A second pass converted 24 richer failure elements while retaining their existing retry actions. The progress pass covered 54 operations using their existing state flags, followed by targeted missing-state corrections.

This is a presentation change. The approved-source comparison found no change to its 74 critical inputs or to the compared web request expressions. These checks have defined scope; they are not a full proof of business correctness or production readiness.

## Page and dashboard coverage

| Dashboard | Pages or workflows | Feedback changed |
| --- | --- | --- |
| Customer | Main screen, My Card, subscription controls | Initial loading, error and retry feedback; subscription checkout progress; card identity and blocking progress |
| Customer | Wallet, funding, withdrawal and refund dialogs | Loading and failure popups; retained last-known-balance warning, timestamps and retry; separate withdrawal, refund and status-check progress; unknown amounts remain blank rather than displaying a false zero |
| Customer | Fuel checkout, service requests and roadside help | Submission, cancellation, failure and retry feedback; existing code, request-reference and cancellation behavior retained |
| Customer | Profile, push notifications, location and Support | Save, browser-contact and checking progress; GPS loading/errors; support delivery warning; successful location context remains visible |
| Company | Company context selection and return to primary account | Pending and failed context switch feedback |
| Company | Fleet, drivers, vehicles and invitations | Loading, operation progress and failure feedback; vehicle-unavailable warnings and disabled-save behavior retained |
| Company | Wallet funding/allocation, POS authorization and company cards | Pending, failure and retry feedback; the uncertain-allocation message is preserved verbatim and has no automatic retry |
| Company | Main dashboard and reporting | Screen loading and failure feedback; empty states and recorded business outcomes retained |
| Partner | Main dashboard and workshop dashboard | Screen/operation loading and failures; protected-content gate decisions unchanged |
| Partner | Subscription gate | Pending subscription checks, errors and retry feedback; protected children remain hidden while checking |
| Partner | API keys, station discounts and service requests | Loading/errors and original retry actions; existing disabled controls retained |
| Partner | Station profile and location selection | GPS, map and station loading/failures; initial instructions and selected-position information remain contextual |
| Partner | Verification and staff/settlement operations | Temporary verification notices, errors and progress; settlement-destination and staff-removal progress; missing-contact policy remains visible |
| Partner | POS | Station/price loading and failure feedback; original retry callback retained |
| Admin | Main screen and modals | Screen loading, operation progress, temporary notices and errors |
| Admin | Card approvals, discounts, intake, operations inbox and recovery review | Queue loading/errors and original retry controls; successful empty queues remain inline |

## Content intentionally retained in context

- Field-associated validation and its error descriptions, including company-funding validation.
- Empty states, missing-contact requirements, account/plan/contract access policy and persisted approval or rejection decisions.
- Refund records, authorization codes, request references and counts.
- Known balance amounts, last-known-balance context and successful location details.
- Existing pending button labels and disabled controls.

Retry buttons still run their original callbacks. No write receives an automatic retry. Dismissing a popup hides the message only; it does not cancel or settle the operation.

## Verification

The final focused receipt contains **24 test files and 361 individual cases: 361 passed, zero failed and zero skipped**. Each copied direct-node log was checked against its declared counts. See `test-counts.json` and `logs/`.

The new `dashboard-floating-feedback.test.cjs` covers three specific transitions: admin bank loading/failure versus a successful empty queue; the protected partner subscription check; and partner API loading/failure wording. Existing tests retain financial amount/unit, stale-response, GPS, action, retry, navigation and scoped-access assertions.

The isolated VM tests use `tests/helpers/status-popup.cjs` to render the popup's message and action without importing the production portal/provider. It supports `createElement`, the JSX runtime and the global React fixture. This helper does not prove real-browser portal placement; that remains the parent browser check.

The initial red log is preserved. It contains two intended presentation assertion failures and one missing-session fixture error. The fixture error is not claimed as a valid behavior reproduction. During integration, four isolated fixtures needed popup-aware VM setup. The final copied logs supersede those failed intermediate runs.

The fresh approved-source comparison returned:

```json
{
  "criticalInputs": 74,
  "criticalDrift": [],
  "changedWeb": 41,
  "requestDifferenceFiles": []
}
```

The baseline was `/tmp/obligon-approved-source23`, which covers the previously approved consequential source. HEAD was not used as the critical baseline because it predates that work. `source-hashes.json` records all 23 changed owned source files and 25 test/helper files at evidence capture.

## Limits and release handoff

This agent did not perform live-provider checks, browser checks, the complete web suite, the production build or deployment. The earlier standalone TypeScript run preceded final copy refinements and is not presented as final-source evidence. Final compile/build, real-browser popup placement and dismissal, cross-dashboard review and deployment verification belong to the parent task. No claim that every page or the whole project is perfect follows from this focused receipt.

No backend, monetary calculation, request expression or critical guard change was introduced within this task. Shared provider behavior is documented and verified separately by its owning agent. A combined review must include that provider and the dashboard consumers together.
