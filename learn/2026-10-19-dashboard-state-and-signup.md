# Reliable dashboard states and Company signup

> 2026-10-19 · Check all dashboards and rename the signup company category.

## In short
Admin screens now keep search controls available during requests and distinguish failed reads from empty results. Company invitations describe the delivery outcome accurately, and signup calls the account category Company.

## What changed
- `apps/web/components/auth/AuthForms.tsx` and `apps/web/tests/signup-report-regression.test.cjs`: replace Fleet Enterprise with Company while preserving the company role payload.
- `apps/web/components/admin-dashboard/AdminHeader.tsx` and `apps/web/tests/admin-navigation.test.cjs`: use each destination's unique URL as its search-result key.
- `apps/web/components/admin-dashboard/AdminScreen.tsx` and `apps/web/tests/admin-screen-loading.test.cjs`: keep filters mounted, separate list failures from action errors, and preserve valid data after failed downloads.
- `apps/web/components/admin-dashboard/CardApprovalQueue.tsx`, `DiscountApprovals.tsx`, `OperationsInbox.tsx`, and `apps/web/tests/admin-queue-states.test.cjs`: distinguish loading, failed, empty and populated queues, with retry controls.
- `apps/web/components/company-dashboard/CompanyModals.tsx`, `apps/web/lib/services/client.ts`, and `apps/web/tests/test-report-company.test.cjs`: carry `emailDelivered` through the client and use it in invitation messages.
- `apps/web/lib/mock/company-data.ts`: describe the Team controls that currently exist.
- `apps/api/tests/password-reset-claim.integration.test.mjs` and `apps/api/tests/timezone-windows.test.mjs`: make fixture time and invalid-zone inputs explicit without changing application authentication or time handling.

## How it works
1. Admin filters remain rendered while a request runs, so typing retains focus.
2. The existing sequence counter ignores older responses. A current read failure sets `loadFailed`; a failed download can show its error while retaining successfully loaded rows.
3. Queues display a loading status, a recoverable error, an empty result or records according to their actual state.
4. An invitation claims it was sent only when `emailDelivered` is true. Otherwise it explains that the invitation was saved and delivery was not confirmed.

## Why it's built this way
The changes reuse existing APIs, status patterns and request sequencing. Replacing dashboard architecture or adding permission controls would expand the task without proving these fixes. Authentication, approval decisions and financial operations stay with their existing server handlers.

## The concept worth knowing: separate outcomes
Saving a letter at a post office does not prove it reached the recipient. Similarly, saving an invitation and delivering its email are different outcomes. A successful list request and a failed PDF download are also independent: one error should not erase the other's valid result. Separate state represents those facts accurately.

## Watch out for
Forty-one dashboard destinations were checked against a disposable PostgreSQL database and synthetic accounts. Hosted company/admin acceptance and real provider operations remain unverified. Chrome produced warnings about injected body attributes; no other console errors were captured. The OTP fixture freezes only the authenticator's epoch; application and database clocks remain real for expiry tests.

## Check yourself
1. Why keep rows after a report download fails?
   <details><summary>Answer</summary>The rows came from a successful list request. A separate action failure does not invalidate them.</details>
2. What if an invitation is saved but email delivery is not confirmed?
   <details><summary>Answer</summary>Tell the user both facts and direct them to Support before inviting again. A blind retry could duplicate an already saved operation.</details>
3. Why leave `Date.now()` running in the OTP fixture?
   <details><summary>Answer</summary>Reset-code expiry and database lock tests still need real elapsed time. Only TOTP generation and verification need a shared fixture epoch.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
