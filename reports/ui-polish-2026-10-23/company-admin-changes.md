# Company and admin UI polish
23 October 2026. Source is ready for root browser acceptance.

The work keeps the existing green and navy brand and uses light workspaces, restrained panels and consistent controls. Mobile records now show field labels and the same row actions as desktop. Desktop tables remain available for comparison.

## Changes

- Company: shared page and metric hierarchy, clearer panels, responsive record cards, readable notification states, complete sidebar scrolling, active navigation semantics and dialog headers that stay visible while scrolling.
- Admin: shared mobile record cards and desktop tables, clear empty results, consistent page/metric/review layout, reachable desktop navigation, quieter mobile navigation, readable approval, intake, support and recovery surfaces.
- Financial, authentication, access and search requests and their conditions were preserved. Review actions still select the original scoped row.

## Route coverage

| Role | Route | Surface and states |
|---|---|---|
| Company | `/company` | Metric hierarchy; responsive recent transactions; export action |
| Company | `/company/vehicles` | Search; pagination; Add/Edit/Driver/Assignment/Export actions; responsive vehicle records |
| Company | `/company/cards` | Search; pagination; card actions; responsive card records; issuer-unavailable dialog state |
| Company | `/company/transactions` | Existing URL/manual search and filters; modern date field preserved; responsive transaction records |
| Company | `/company/reports` | Metrics; responsive spend rows; station usage list; export action |
| Company | `/company/stations` | Search, fuel price cards, directions; server station query preserved |
| Company | `/company/roadside` | Active request cards, pending/cancelling state, responsive request history |
| Company | `/company/billing` | Wallet panel, pending confirmation, funding/allocation dialogs, contract details, responsive invoices |
| Company | `/company/team` | Search and responsive member records; invitation dialog |
| Company | `/company/notifications` | Read/unread states retain text contrast; mark-all busy state; empty/error state |
| Company | `/company/support` | FAQ and responsive ticket records; conversation dialog and reply state |
| Company | `/company/settings` | Profile form, saving state, account status, safe narrow grid tracks |
| Company | `/company/maintenance` | Metrics and responsive schedule rows; existing calendar, scheduling and status dialogs |
| Admin | `/admin` | Metrics, search, responsive records, creation/review form, customer card approvals and issuer recovery states |
| Admin | `/admin/companies` | Alias unchanged; canonical record search destination is /admin |
| Admin | `/admin/partner-applications` | Metrics, search, responsive records, inline review decision form |
| Admin | `/admin/reports` | Metrics, range selection, responsive report records, PDF busy/error state |
| Admin | `/admin/disputes` | Metrics, search, responsive records, inline dispute review form |
| Admin | `/admin/staff` | Metrics, search, responsive records, creation/review form |
| Admin | `/admin/discount-approvals` | Pending/approved/rejected/empty/loading/error states; consistent reason field and44px controls |
| Admin | `/admin/intake` | Review queue tabs, list/detail layout, metadata expansion, approval forms, loading/error/empty and pagination |
| Admin | `/admin/operations` | Support, attachments, replies, paid/settlement exceptions, bank verification, interrupted issuance, refunds and reconciliation states |
| Admin | `/admin/login` | No changes by this agent; root shared auth polish and browser coverage required |

Loading, error, empty, populated and relevant expanded, submitting or disabled paths reuse the existing state logic. State descriptions above are source coverage, not a claim that every state has been visually inspected.

## Verification

- 131 focused tests passed across 9 suites. The six new runtime checks cover mobile labels, row actions, read-only reports, empty states and long text.
- Admin approval and loading fixtures now render the actual extracted record component. All original contract and stale-response checks remain.
- TypeScript completed with no errors. Logs and source hashes are in `company-admin-verification.json`.

## Remaining acceptance

Root must confirm the production build and actual Chrome layouts at 320, 390, 768 and 1440px, including a short desktop height, mobile navigation, populated/empty/error states and open dialogs. This subagent browser inventory failed before tab access with a request-header-policy error; no alternate browser-control route was used.

No perfect or 5/5 score is claimed from source inspection. The root visual review must record any remaining findings and scores.

References consulted: UI Reference Guide ten-source catalog; corporate-trust with the existing brand colors preserved; Taste Accessibility; Better Design Stripe table/input references. No library or external design service was added.

## Design critic follow-up, Round 2

Phone summaries now use compact two-column metric groups with explicit labels and values. Pagination has a clear disabled surface. Partner bank verification explains loading, failed loading and a successful empty result. Discount review input appears only after pending requests load and becomes disabled while a decision is saving. Existing actions, request flags, page conditions and payment decisions remain in place.

Fresh follow-up verification passed 46 focused tests across 5 suites and a no-emit TypeScript check. Two new state tests reproduced the previous gaps before the fixes. The independent network-feedback review passed its 10 transport tests, including single-request GET/POST failures. Current follow-up source hashes are in `company-admin-round2-verification.json`; the previous receipt records the earlier visual round. Root still owns the rendered recheck and final critic scores.

## Company design critic Round 3

Clarified that card driver and vehicle assignments are separate. The card list now names both fields explicitly without changing stored assignments, raw API records, IDs, search input or action targets. It also keeps approved quantity unit phrases together, makes three- and four-metric summaries compact at tablet widths, fills the third summary across the phone row, and aligns the settings account-status panel to the start.

Fresh verification: 12 company/admin UI cases, 13 company empty-page cases, and 12 dashboard search destination cases passed; TypeScript no-emit passed. The original two failing reproduction cases are preserved with the green output in `company-admin-round3-verification.json`. Browser and visual acceptance remain with the root agent. No flawless or production-readiness claim is made from these tests.
