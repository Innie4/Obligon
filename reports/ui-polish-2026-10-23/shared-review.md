# Independent shared and public UI review
23 October 2026. Bounded source and behavior review.

No remaining concrete correctness or accessibility regressions were found in the inspected increment. This is not a visual score or a production-readiness claim.

## Resolved findings

- `apps/web/components/site/SiteHeader.tsx:19`: Escape now returns focus to its own mobile-menu trigger before the focused menu content is removed.
- `apps/web/components/landing/Header.tsx:22`: The landing menu uses the same focus-restoration behavior. The current tests assert both closure and focus.
- The separate company/admin table follow-up adds named, keyboard-focusable overflow regions. Those source and test hashes are recorded in the company/admin receipt.

## Evidence and scope

- Current mobile-menu tests: 5 passed. Public controls: 12 passed.
- The prior AuthForms and AuthShell sources were reconstructed from the saved application snapshot, and their SHA-256 values were verified. AuthForms has only className attribute differences in this UI increment; removing those attributes gives equal normalized TypeScript syntax trees. Existing sign-in behavior was not re-audited.
- Reviewed the global palette/focus/mobile-input/reduced-motion rules, landing changes, public header and footer/input/intro callers, all three solution pages, auth shell/status changes, and shared loading, empty, error, dialog and toast changes.
- Shared errors keep their retry callbacks. A background refresh error displays the existing loaded data with an explicit warning while an initial error still renders the error state. Solution CTAs retain their existing destination behavior, and current solution module arrays are nonempty.

## Remaining acceptance

Root must complete the final build/full web suite and actual Chrome checks for responsive geometry, keyboard navigation, contrast, open dialogs, nested scrolling and all relevant states. Scrollbar hiding preserves overflow, so wheel, touch and keyboard access must be checked in the rendered app. No browser was controlled for this independent review.

Current source hashes and test logs are in `evidence/shared-review.json`.

## Client network feedback follow-up

`apps/web/lib/services/client.ts:364` now maps an un-aborted fetch TypeError to an actionable status-0 message. Existing timeout and cancellation paths remain separate. This branch neither retries the request nor changes session tokens. The normal refresh branch only runs after a received 401 response, so a network failure cannot enter it. No remaining findings. Fresh transport verification passed 10 tests, including one fetch and unchanged tokens for both GET and POST failures. Source hashes and evidence are in `evidence/round2-client-network-review.json`.
