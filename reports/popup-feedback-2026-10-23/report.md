# Popup operation feedback

23 October 2026. Implementation and local verification complete, including the final shared-search follow-up. Release results are recorded in [the combined release report](../release-review-2026-10-23/report.md).

Temporary loading, pending, error and action-result messages now appear in floating popup cards across customer, partner, company, admin and public/account flows. Field validation, saved transaction/approval statuses, access requirements, empty records and reference codes remain beside their relevant controls.

## What changed

- Shared `StatusPopup`, `Toast`, `States`, `Dialogs`, `ErrorBoundary` and provider wiring handle status cards, progress aggregation, dismissal, retry and lifecycle cleanup. Popup controls inside a dialog use that dialog's portal host. They do not take focus automatically.
- Errors persist until dismissed or their owning state changes. Retry invokes the existing recovery callback without hiding an unresolved failure. No automatic retry was added to money-moving requests.
- Notifications clear on account, role or company-context changes. Captured callbacks from the previous context cannot publish into the new one.
- Customer card, wallet, checkout, request and account operations; partner workshop/station/POS/team/verification/billing flows; company invitations, vehicles, cards and wallet flows; and admin queues, records and review operations use the shared feedback. GPS/map, authentication, verification, support and public forms use it too.

See the [dashboard page/workflow matrix](dashboard-consumers/report.md), [auth/public matrix](auth-public.md), [independent consumer review](dashboard-independent-review.md) and [foundation review](independent-review.md).

## Verification

- Complete web suite: **642 tests passed**, zero failures/skips. The earlier failed run used an obsolete vehicle-warning fixture; the final suite retains its disabled-save and no-write assertions.
- Production web build passed, including TypeScript and lint. Existing unused-variable and local workspace-root warnings remain.
- Independent review found and closed three popup defects: unresolved errors disappearing on retry, stale account-context notifications, and unstable portal keys. The focused foundation suite passes all 11 cases.
- The approved-source comparison confirms **74 backend/shared/dependency inputs unchanged** and zero differences in compared service/login call expressions. This is a bounded contract check, not a proof of every control-flow property.
- Chrome exercised sign-in pending feedback, admin loading and network failure/recovery, and a synthetic admin action success/failure. Input values remained present after the failed action. The generic admin editor is an inline form, so its popup correctly belongs to the page. Its screenshot is not evidence of dialog focus trapping. Dialog portal identity and lifecycle have structural test coverage; complete browser/screen-reader dialog acceptance remains unverified.
- Evidence includes mobile feedback at 390px, with no measured page overflow in the captured states. Device/network overrides were removed. The recovered screenshot named `admin-recovered-desktop.png` is a desktop capture.
- Fresh Trivy source-secret scan found zero matches within its recorded app-source scope. It excludes dependencies, build output and real environment files.

The unchanged API acceptance evidence remains **1,251 passed, 13 explicitly opt-in live smoke checks skipped**, and migrations 001–039 plus an idempotent rerun passed in the isolated database. Payment-provider, physical passkey, Nigerian SMS and operational launch limits remain in the combined release report. This work does not establish flawless or complete production readiness.

## Review and authorization

The user confirmed qualified review of original patch `446d9a44acc544b22b271caefa7cd15bd06f234f3ab818e3bb339baa0be7a775` and authorized push/deployment. Subsequent popup changes are user-authorized presentation work. Original approval and source hashes are preserved separately from the final combined manifest.

The complete source patch contains 206 files and has SHA-256 `fc0eb77d2c2093eaac0f2e741c55f999df0bb0fcdda3ec5c2df342ca52dfbfb5`. Supporting reports, screenshots and learning notes are outside that application-patch identity.

## Final shared-search acceptance

The final follow-up also converts search progress/errors, preserves result counts and authorized destinations, and provides desktop keyboard access to the popup retry. Its loading popup is non-dismissible and settles automatically. Independent review and real Chrome Tab/Enter recovery checks pass. The final complete web suite has **646 passing tests**, and the fresh API suite has **1,251 passed / 13 opt-in skipped / zero failed**. See the [follow-up release record](../release-review-2026-10-23/zod-advisory-followup.md) and [search report](dashboard-search/report.md). Earlier counts/hashes in this report describe the initial popup freeze.
