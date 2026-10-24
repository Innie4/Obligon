# Customer and partner interface changes

24 October 2026. Implementation note for the root-owned Service-lane direction. This note describes my changes and verification; it is not an independent review or a rendered design score.

## Scope and references

The existing React/Next.js stack, bundled brand fonts, green/navy identity, financial values, routes and server permissions are preserved. I read the complete ten-source catalog and relevant App Designer structure, small-phone layout, copy and critique guidance. Better Design button/focus patterns, Motion Primitives dialog structure and Design Taste accessibility guidance informed the bounded changes. No reference code was copied, dependency added, hosted generation invoked or production/browser state changed by this subtask.

Root completed the full baseline capture before authorizing these source changes. The changes improve task navigation, recoverable empty results, phone records and member-specific affordances. They do not remove functionality or make new server-side access decisions.

## Changes by route

| Route | Change |
| --- | --- |
| `/customer` | Main title is an h1 on phone and desktop. Quantity and transaction summaries share a compact phone row; security status spans the next row. Balance, wallet/card actions, spend tracking, vehicles, activity and benefits are preserved. |
| `/customer/card` | Main title is now My Card. A wrapping, touch-sized section navigation exposes Status, Plans, Budget, Pay and Orders when the relevant paid sections exist. Native hash links preserve the existing query string and payment-return parameters. Existing `subscription`, `fuel-budget` and `fuel` targets are preserved; `card-status` and `fuel-orders` targets were added. Payment/identity dialogs, verification, refund states, manual budget editing and first-card/renewal decisions are unchanged. |
| `/customer/transactions`, `/customer/transaction-detail` | Search, filters and the primary heading stay outside the result boundary. Phone records show the exact signed amount, balance after, timestamp, reference, activity and existing receipt action without requiring a horizontal swipe. The desktop table remains a named, keyboard-focusable scroll region. Permanent scrolling instructions were removed. An empty filtered result displays a starting count of zero. Existing pagination, receipt data/download and deep-link handling are preserved. |
| `/customer/wallet` | Primary title is an h1. Funding, stale-balance warnings and existing phone funding records are unchanged. |
| `/customer/stations` | Search and fuel controls remain available while results are loading, failed or empty. Filtered-empty results offer a working Clear filters action; an empty network has separate copy. Filter chips have touch-sized targets and the search container has a focus indicator. The real list remains ahead of the optional map. Fuel-filter, detail and directions dialogs remain mounted independently of result emptiness. Decorative emoji were removed from directions copy. GPS consent, nearest-station retrieval, prices, approved units and map behavior are unchanged. |
| `/customer/support`, `/customer/report-problem` | Primary title uses h1 semantics. Tickets, messages, assisted services, repairs and the report dialog are unchanged. |
| `/customer/profile`, `/customer/notifications` | Primary titles use h1 semantics. Theme, sign-in options, notification preferences, security and read-state flows are unchanged. |
| `/customer/subscription`, `/customer/fuel-checkout` | Existing redirects into My Card and their return parameters remain unchanged. |
| `/dashboard`, `/dashboard/transactions`, `/dashboard/reports`, `/dashboard/disputes`, `/dashboard/staff`, `/dashboard/settlements` | Shared phone records expose all existing fields, amounts, status and working row actions as readable records. The original desktop tables, columns and named keyboard scroll regions remain. Permanent instruction bars were removed. Transactions uses an inclusive heading for both personal and fleet activity. |
| `/dashboard/settings` | Organization editing and API-key management are shown only to existing owner/admin members. Other members see the registered details and clear read-only guidance, avoiding an automatic forbidden API-key request. Security links and support remain available. |
| `/dashboard/staff` | Owner/admin members retain invitation and edit actions. Other members can read the team list without controls that the server would reject. |
| `/dashboard/station-profile` | Adding stations and editing/saving their profile follow the existing owner/admin rule. Other members retain profile visibility with disabled fields and read-only guidance. GPS, city/fuel/hour controls cannot be invoked from the read-only form. Equipment and dispensing information remain available. |
| `/dashboard/fuel-pricing` | Price and scheduled-discount editing follow the existing manager/admin/owner rule. Other members retain price/discount visibility, disabled controls and explanatory copy. Existing payloads, approved units, validation and success/failure handling are unchanged. |
| `/dashboard/settlements` | Bank nominations/default/removal controls follow the existing owner/admin rule. Other members retain bank and settlement information. Payout behavior, provider calls, amounts and manual-payout restrictions are unchanged. |
| `/dashboard/billing`, `/dashboard/card-verification`, `/dashboard/verify`, `/dashboard/workshop`, `/mechanic` | Existing functionality is preserved. Root owns shared billing presentation. Verification, station POS, workshop permissions and specialization boundaries were not rewritten by this subtask. |

The desktop customer chrome now renders its repeated page label as text, leaving the main task title as the page heading. No global stylesheet was changed here.

## Verification

Before changing source, focused regressions recorded four real failures: hidden station search after an empty server result, missing main h1, admin-only Settings controls shown to a viewer, and no readable phone transaction records. The owner/admin preservation check passed. A separate test demonstrated the missing My Card section navigation. These are preserved in `evidence/customer-partner-before.tap` and `evidence/my-card-nav-before.tap`.

Final focused run: **186 passed, 0 failed, 0 skipped**, covering:

```text
tests/ui-dashboard-polish.test.cjs
tests/customer-my-card.test.cjs
tests/partner-audit-regression.test.cjs
tests/station-profile-form.test.cjs
tests/station-profile-fields.test.cjs
tests/station-location-picker.test.cjs
tests/production-customer-controls.test.cjs
tests/customer-theme.test.cjs
tests/customer-access-location.test.cjs
```

Run with `node --test --test-reporter=tap` from `apps/web`. Evidence: `evidence/customer-partner-focused.tap`.

The new station test renders the real AsyncBoundary before examining visible controls, preventing hidden child elements in a test tree from producing a false pass. Role tests exercise ordinary members, existing manager thresholds and owner/admin preservation. Read-only station/discount submissions make no request, even when their handlers are invoked directly in the tests. Phone records preserve exact values and use the existing row-action callback. My Card tests verify section destinations and preserved processor-return parameters. Existing theme, GPS and paid-access suites pass.

Fresh `tsc --noEmit --incremental false` passed after the final source changes. Scoped `git diff --check` passed. The parent owns the final complete suite, production build, rendered viewport/state checks and independent critique. No 5/5 score or deployment result is claimed here.

## Files

Source: `CustomerScreen.tsx`, `CustomerShell.tsx`, `CustomerFuelCheckout.tsx`, `CustomerTheme.tsx`, `DashboardScreen.tsx`, `StationDiscounts.tsx`, `StationProfileForm.tsx`, `WorkshopDashboard.tsx`.

Tests: `ui-dashboard-polish.test.cjs`, `customer-my-card.test.cjs`, `partner-audit-regression.test.cjs`, `station-profile-form.test.cjs`, `partner-subtype-workshop.test.cjs`, `production-customer-controls.test.cjs`. Fixture role updates describe the existing owner/admin actions under test; their original behavior and payload assertions remain.

An integrated-suite follow-up corrected two additional fixture assumptions in `partner-subtype-workshop.test.cjs`. Gas price publishing now has an explicit manager membership. The admin station-unit test locates the decision selector inside the selected review form, instead of accidentally changing the new mobile queue selector. It also verifies that the station queue stays selected. Exact approved-unit, fuel, POST destination and status assertions are preserved. That complete file passed **13/13 with no skips**; evidence is `evidence/partner-subtype-final.tap`. This follow-up changed tests only; no application source changed.

The root task owns the consolidated learning note and final source manifest. External payment/identity/provider limits recorded by preceding tasks are not resolved or re-certified by these presentation changes.

## Round 3: remaining concrete critic asks

After root supplied the completed round-2 critique, a further bounded increment addressed these findings:

- `/dashboard`: today's three metrics now use a compact two-column phone arrangement, with the third spanning the row; all four secondary totals form a two-by-two phone grid. Every label/value is preserved. Money and selling-unit strings can wrap instead of colliding. The empty recent-authorization panel explains which recorded station activity creates its entries and offers the existing transaction-history destination when the established specialization helper allows it. No POS capability is inferred from a generic membership role.
- `/dashboard/station-profile`: Details, Fuels & units, Hours and Location links jump to focusable, visibly outlined section targets. An authorized member can submit from the top of the same form as well as its existing bottom action. Both use the unchanged custom validation and submission handler. The existing read-only, busy and approval caveats remain; no floating control can cover the bottom navigation or focused field.
- `/dashboard/workshop`: Details, About and Services links and a top Save use the same existing form. Required fields, native browser validation, busy guard, owner/admin rule, error preservation and bottom Save remain.
- `/customer/profile`: compact Details, Appearance, Sign-in, Notifications and Security links appear near the introduction. Their native fragment targets accept focus without adding extra tab stops. Password, PIN and two-factor handlers, light/dark theme, sign-in options, alerts, notification and device-push preferences are preserved.
- `/customer/card`: the empty fuel-orders paragraph uses `text-slate-600` after root's axe check identified the previous `text-slate-500` contrast as 4.47:1. Existing dark-theme mapping covers the replacement class.

Four focused checks failed before these source changes. The final affected suites (`ui-dashboard-polish`, `station-profile-form`, `partner-subtype-workshop`, `production-customer-controls`, `customer-theme`) then passed **119/119 with no skips**. Tests check all seven partner metric values, legitimate empty-state destination, focusable section targets, both form submit affordances sharing one handler, and the unchanged password action. Evidence: `evidence/customer-partner-round3-before.tap` and `evidence/customer-partner-round3-final.tap`. Fresh TypeScript checking and scoped whitespace checking passed. Root owns the subsequent rendered and axe confirmation; these code checks do not establish the rendered scores.
