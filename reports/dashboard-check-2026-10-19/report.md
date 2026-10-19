# Company, admin and cross-dashboard verification

19 October 2026, Africa/Lagos. Starting revision: `762c01f671b316719ceb68a9ea808095c701fbaf`.

## Changes

| Area | Page or component | Result |
| --- | --- | --- |
| Signup | Account category | “Fleet Enterprise” is now “Company”. The company role, submitted company name and existing validation are preserved. |
| Company | Team invitation | The UI reads the existing API's `emailDelivered` value. It claims email delivery only when confirmed; otherwise it explains that the invitation was saved and directs the user to Support before retrying. |
| Company | Team description | Describes inviting members and viewing existing access, matching the current interface. No permission-management feature was added. |
| Admin | Header search | Destinations use unique route keys, including sections sharing the applications category. Regression checks cover query changes, labels, links and selection reset. |
| Admin | Company oversight, reports, staff and other shared lists | Search and reporting controls remain mounted during reads. The existing sequence guard rejects stale responses. Read failure differs from an empty result. Action failures, such as a PDF download failure, preserve valid rows and metrics. |
| Admin | Discount, card and replacement approval queues | Clear loading and failure states replace premature empty messages. Existing action handlers and approval boundaries are preserved. Refresh is available for recovery. |
| Admin | Support and settlement operations | Failed reads display an error with Refresh instead of showing empty or incomplete queues as a successful result. |
| API tests | MFA/reset fixture | Pins only the authenticator epoch per test and restores its options afterward. Real application and database clocks continue running. No authentication implementation changed. |
| API tests | Timezone fallback | Supplies an actually invalid timezone and restores configuration, rather than assuming the developer's configured timezone is UTC. |

## Fresh verification

- **1,070 API tests passed, zero final failures, zero skips**, across 79 test files. PostgreSQL 18 was created solely for these checks; all 33 existing migrations applied. All 13 HTTP smoke tests ran against the actual local API. External financial provider effects in the integration suites use controlled fixtures.
- **431 web tests passed, zero failures, zero skips**, across 40 files. This includes company workflows and invitation outcomes, admin loading/error/retry states, request ordering, failed downloads, navigation keys, signup validation, and customer/partner regressions.
- The production build completed with the public deployment API URL and mock mode disabled. The development server was stopped before building.
- Independent review checked the connected callers and API contract. A review finding about action errors hiding valid admin data was reproduced, corrected and covered by a failed-download regression. Final review reported no remaining findings in the change set.
- `git diff --check` passed. No dependency, schema, authentication, tenant-boundary or financial-handler implementation changed.

The first broad API run exposed two existing fixture problems. One MFA session returned 401 and passed unchanged on isolation; a deterministic check demonstrated how TOTP generation before a 30-second boundary can expire before server verification. The original log lacks timestamps proving that specific failure's boundary. The fixture now uses a stable authenticator epoch, without freezing expiry clocks. The timezone test incorrectly expected UTC under a configured Africa/Lagos environment; it now explicitly tests an invalid zone. Both final corrected suites passed, and earlier passing suites were retained without redundant reruns. Failed-attempt logs are preserved locally and identified in the verification receipt.

## Browser results

Chrome used the actual local frontend/API and disposable seeded accounts, with mock mode disabled:

| Dashboard | Destinations checked | Observed result |
| --- | --- | --- |
| Company | All 13: Overview, Vehicles, Cards, Transactions, Reports, Station Locator, Roadside, Billing, Team, Notifications, Support, Settings, Maintenance | Each reached its expected heading and completed observed loading states. No page overflow or nonempty error alerts were observed. A local invitation was saved and acknowledged through the configured local email delivery path. This does not prove hosted email delivery. |
| Admin | All 8 navigation destinations: Dashboard, Discount Approvals, Partner Applications, Support & Settlements, Requests & Activity, Platform Reports, Dispute Resolution, Staff & Access | Each loaded without observed page overflow or error alerts. Search retained the full “Haul” input and physical focus during a 400 ms network delay and after completion. Temporary throttling was reset. |
| Customer | All 7: Overview, My Card, History, Stations, Support, Notifications, Profile | Each rendered its expected screen without observed page overflow or error alerts. |
| Partner | All 13 destinations, including both Operations and Support & Alerts groups | Each rendered its expected screen without observed page overflow or error alerts. No card authorization, financial transaction or station update was submitted. |

At a 390 px viewport, admin and company menus exposed their navigation options, reached a selected destination and closed correctly. Neither inspected mobile page overflowed. The temporary viewport override was reset.

Chrome recorded 40 hydration warnings whose differences were injected `__processed_...` body attributes. No other console errors were captured. The application was not changed to suppress those warnings. The DevTools response buffer truncated older entries, so the saved response-status sample is explicitly partial; it is not evidence for every page request. The full API integration and smoke results provide separate HTTP verification.

[Browser receipt](evidence/browser.json) lists all 41 paths, headings and observations. Screenshots remain local review artifacts. [Verification receipt](evidence/verification.json) records totals, log hashes and limits; [source hashes](evidence/source-hashes.json) identify the tested application/test changes.

## Checks still blocked or limited

- No hosted company/admin test credentials were provided, so their authenticated production workflows were not accepted live. Local fixtures do not prove production data, roles or grants.
- Sudo access remains blocked as previously requested. Real card issuance, identity review, merchant/provider settlement, external email/SMS/push delivery and financial recovery require provider and operational acceptance.
- Scheduled recovery remains disabled. Hosted database grants, backup restoration, alerts, financial accounting/counterparty review, commercial/legal obligations, load tests, physical phones and screen readers remain outside this verification.
- Company Team currently supports invitation and viewing members; role editing/removal controls were not added. The copy accurately states that scope.

See the [existing production operations requirements](../production-readiness-2026-10-18/operations.md). These results establish the stated fixes and checks, not a claim that every possible account, provider or production condition is flawless.
