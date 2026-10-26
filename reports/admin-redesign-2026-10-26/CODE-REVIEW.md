# Independent admin redesign code review

26 October 2026. Reviewed against base `eeb38d1feeb9bb36c78600266e05860918b71215`. Final source and affected-flow review are complete.

## What this change does

The redesign gives existing admin workflows one visual language and opens record details in centered dialogs. Admin feedback opts into centered placement, and support records receive explicit requester-role and organization metadata so the interface can separate customer, partner and company requests.

## Review coverage

- Shared popup/toast providers and existing callers: center placement is explicit and defaults remain `corner`; existing deduplication, priority, dismissal and host selection are preserved.
- Dialog wrapper and existing focus helper: backdrop target checking, accessible title/description, Escape, nested focus and body-scroll behavior.
- Generic admin screens, tables, navigation, standalone login and specialist card/discount/benefit/intake/support/recovery consumers.
- Admin support list/detail metadata queries and source classification: roles/organization context are read from existing server records; names and message text do not establish a source. Existing admin authorization middleware and all mutation routes remain unchanged.
- Existing money amounts/units, contract/BVN gates, consequential confirmation messages, payloads and endpoints were compared with the base. This task does not establish real-provider payment or identity readiness.
- Changed tests retain the original workflow assertions and add modal containment, source separation and opt-in positioning coverage. Browser state evidence is kept under `evidence/states/`.

## Findings sent to implementers

| ID | Concrete case | Smallest correction | Status |
|---|---|---|---|
| C1 | Mutation feedback mounted outside a review dialog is visually centered over it but its dismiss/retry controls are outside the focus trap. | Host review-specific feedback inside the active dialog. | Fixed in source; current browser evidence records reachable dismiss/retry. |
| C2 | A dismissed success/error remounts when opening another record because feedback moves from page to dialog with unchanged message state and a new popup ID. | Clear completed feedback when entering a fresh review/workflow. | Fixed; regression and fresh-review browser cases pass. |
| C3 | Intake/support allow opening record B after closing A while A's mutation is pending. A's completion can close B or display A's error inside it. | Disable fresh review/publish triggers while busy, or bind outcomes to selected identity. Backdrop closure stays available. | Fixed; held-write browser cases prove fresh entries stay disabled and closed reviews stay closed. |
| C4 | After saving a generic admin record, closing and changing search while the save is pending can make the older captured `load()` run last and overwrite the current query results. | Reload through the latest callback, as intake already does. | Fixed in source with latest callback and focused regression. |
| C5 | Card/BVN actions call `load()`, which hides the row map and unmounts an open review/opener, then recreates it from unchanged `selectedId`. | Preserve the selected review/list while refreshing or close deliberately with stable focus restoration. | Fixed; browser proves same DOM instance during/after refresh, focus containment and original-opener restoration. |
| C6 | Client filters can show Partner 0/Company 0 when matching tickets exist outside the API's latest-200 window. | State the limit and make counts/empty copy refer to the loaded view. | Fixed; explicit 200-record/view copy preserves the existing API limit. |
| C7 | Recovery subsection feedback can remain on body while a support dialog is open, placing its controls outside the focus boundary and overlapping stacks. | Opt-in admin overlay host registry retargets all related feedback to the top review, retaining IDs and dismissal. | Fixed; nested-host unit test and concurrent browser case prove aggregation, keyboard dismissal and no replay. |
| C8 | Chrome can blur a newly disabled focused button to body without a focusin event, even while its review remains mounted. | Refocus the open admin dialog only when activeElement is body. | Fixed; current source hashes match the passing BVN lifecycle case. |
| C9 | A recovery failure shown over a support review says only Request failed (503), leaving the failed subsection and retry target unclear. | Prefix recovery issuance/refund errors with their context. | Fixed; final concurrent screenshot visibly names Card issuance records, and focused tests pass. |

## Evidence received so far

`evidence/states/interaction-results.json` contains 41 local fixture/synthetic scenarios, zero recorded failures, no false recorded checks, center deviation at most 0.0078125 CSS pixels and zero recorded axe violations. It proves baseline dialog positioning, inside clicks, backdrop/Escape close, focus return, tab containment, local source filters, popup positioning and in-dialog feedback access for its named scenarios.

`evidence/states/lifecycle-acceptance.json` adds eight affected-flow cases. It records no failures, false checks or page errors. Current SHA-256 hashes of `AdminDialog.tsx` and `CardApprovalQueue.tsx` match the successful final BVN lifecycle case. These checks distinguish actual mounted-node/focus behavior from unit fixtures.

The refreshed concurrency artifact includes hashes for `AdminDialog.tsx`, `CardApprovalQueue.tsx`, `RecoveryReview.tsx` and `OperationsInbox.tsx`; each matches the final reviewed source. Its final screenshot visibly identifies the failed card-issuance subsection while retaining the support conversation and an accessible retry.

Read final verification receipts: 733 web tests passed, zero failures/skips (`evidence/web-tests-final.tap`), and 55 API tests passed (`evidence/admin-api-tests.tap`). `verification.json` records the successful production build/typecheck and 28 focused tests after the last error-copy change. Lint has zero errors and 75 documented warnings. `git diff --check` is clean. These checks prove their named properties, not universal correctness or provider readiness.

Verdict: Ship this admin UI change within the existing authorized release process. No unresolved source blocker remains from this independent review. Deployment status must still be verified against the exact pushed revision by the releasing agent.

No production write, provider action, seed/reset script or real-money test was performed by this review.
