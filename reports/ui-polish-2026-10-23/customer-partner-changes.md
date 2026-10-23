# Customer, partner and workshop UI increment

23 October 2026. Scope: existing customer, fuel/gas partner and mechanic interfaces. This document records source coverage and focused checks. Root owns the final browser captures, visual scores, complete build and release decision.

## Design and implementation

The implementation keeps Obligon’s existing green/navy identity, Inter/Plus Jakarta fonts, routes and product decisions. The ten-source UI catalog informed selection; the local Corporate Trust reference informed restrained tables and readable metadata, and Better Design’s Stripe table source informed spacing and table anatomy. App Designer’s existing-content, hierarchy and critique guidance was applied to this web application. No native Apple-font or device verification is claimed.

- Customer navigation now uses light active rows, white headers, a smaller active-tab marker, safe-area spacing and a scrollable sidebar with reachable account actions. Mobile Account supports Escape, outside pointer, focus departure, route changes and desktop resize; Escape restores trigger focus.
- Customer/partner content has a bounded width, consistent responsive spacing, quieter border tokens and less heavy panel/button shadows. Sub-12px text in the owned content was raised, and short actions were increased to 44px.
- Customer Overview balance type and My Card’s masked-number layout fit narrow screens. Action descriptions wrap. Station result lists use natural page scrolling on phones.
- Vehicle, transaction, wallet, partner-record and station-discount tables expose named, keyboard-focusable scroll regions. Read-only partner tables omit an empty Action column; actionable rows preserve the actual callback and matching header/cell counts.
- Workshop editor fields use a two-column desktop layout with full-width description/services and clear selected services. Existing viewer restrictions and all workshop save behavior remain intact.
- Partner Support/API settings and station discounts distinguish initial loading, real empty data, load failure/retry and successful writes. Failed old support-thread requests cannot replace the selected thread’s state.
- Subscription checking now has an announced loading state and an accessible failure/retry panel. Active, inactive and exempt-route behavior is preserved.
- Customer Support now exposes included-service load failures through the shared retry boundary, ticket-list retry, message loading/retry/empty states, a responsive chat panel and persistent send errors. A successful message write followed by a failed refresh is described as sent with refresh unavailable, avoiding a false instruction to resend.
- Card-plan loading now distinguishes loading, failed fetch/retry, genuinely empty plans and selectable plans. Phone Wallet funding rows use the same loaded wallet records as the balance/desktop history, removing an independent fetch that could leave the phone list blank.

No API endpoint, selling-unit decision, amount/rounding rule or server authorization boundary was changed in this UI increment. No dependency was added.

## Route and state inventory

“Present” here means the source path and applicable state handlers were inspected. It does not mean every listed state has been triggered in the live production browser.

| Page/route | State coverage and changes |
|---|---|
| `/customer` | Overview/vehicle/activity loading, error/retry and empty boundaries remain; balance/type/grid hierarchy and table access improved. Card status explicitly distinguishes loading/unavailable/unissued. |
| `/customer/card` | Existing card/request/payment/refund/verification/frozen/blocked states retained; card layout improved. Plan loading/error/retry/empty states added. Budget and fuel sections stay here. |
| `/customer/transactions`, `/customer/transaction-detail` | Loading/error/retry/empty/search/filter/receipt states retained; table region, pagination target sizing and modal presentation improved. |
| `/customer/wallet` | Existing balance unavailable/stale/error/retry and funding boundaries retained. Phone funding records now share the authoritative loaded wallet response. |
| `/customer/stations` | Existing fetch/error/retry/empty/search/GPS/map paths retained. Result actions are larger; nested result scrolling removed on phones. |
| `/customer/support`, `/customer/report-problem` | Included-service loading/error/retry/empty/success states; ticket/message loading/error/retry/empty; saved-message refresh failure accurately distinguished. Existing dispute modal retained. |
| `/customer/profile` | Existing profile loading/error/retry/save, push permissions/error, password/PIN/MFA dialogs retained; hierarchy and control presentation improved. |
| `/customer/notifications` | Loading/error/retry/empty and real persisted read states retained; metadata and mark-all target improved. |
| `/customer/subscription`, `/customer/fuel-checkout` | Existing redirects into My Card retained, including return parameters. No separate customer subscription/checkout page was added. |
| `/dashboard` | Fuel/gas overview loading/error/retry, metric and authorization tables retained; shared hierarchy/table work applies. Mechanic/unknown-specialization branches remain scoped. |
| `/dashboard/fuel-pricing` | Existing approved-fuel/price loading/error/publish paths retained. Scheduled discounts now have loading/error/retry/empty/submitting/success states and accessible table scrolling. Approval/revenue copy and payload preserved. |
| `/dashboard/card-verification` | Existing POS request/loading/declined/confirmed/payment-type states and unit-aware values retained; panels and targets refined. |
| `/dashboard/settlements` | Existing load/retry/empty, bank validation, payout/recovery and request-feedback paths retained. Table/panel/button improvements apply. |
| `/dashboard/disputes` | Existing load/retry/empty and dispute-detail/update feedback retained; table/actions refined. |
| `/dashboard/station-profile` | Existing station-list failure/retry, station loading, missing station, create/edit/save/review-note states retained. GPS/map/tiles/fuel/hour/location validation paths retained; controls/tokens refined. |
| `/dashboard/transactions` | Existing loading/error/retry/empty/search/export/pagination retained; accessible table and larger actions. |
| `/dashboard/reports` | Existing range/loading/error/retry/export paths retained; metric/table improvements apply. |
| `/dashboard/notifications` | Existing loading/error/retry/empty/read/save-failure paths retained; title/time wrapping improved. |
| `/dashboard/staff` | Existing loading/error/retry/empty/add/edit/validation feedback retained, including backend-driven failures. Shared table/actions refined. |
| `/dashboard/settings` | Existing organization save feedback retained. Partner Support and API settings now have explicit loader/retry/empty feedback; thread request races guarded. |
| `/dashboard/verify` | Existing contact sending/verifying/success/failure/optional-contact/cooldown states retained. Type, borders and button shadows refined. |
| `/dashboard/billing` | Existing shared SubscriptionPanel retained. Root owns its visual/state implementation; partner gate status presentation improved here. |
| `/mechanic`, `/dashboard/workshop` | Workshop overview/profile loading/error/retry, missing services/address, viewer-disabled editor, saving/error/saved paths retained. Responsive editor and overview hierarchy improved. |

All owned customer/partner source components and route entry points were inventoried. Shared calendars, maps, subscription panel, global scroll rules and root-owned partner navigation remain root’s integration responsibility.

## Source files changed by this increment

Under `apps/web/components/customer-dashboard/`: `CustomerShell.tsx`, `CustomerScreen.tsx`, `CustomerModals.tsx`, `CardRequestModals.tsx`, `CustomerFuelCheckout.tsx`.

Under `apps/web/components/dashboard/`: `DashboardScreen.tsx`, `WorkshopDashboard.tsx`, `PartnerApiKeys.tsx`, `PartnerServiceRequests.tsx`, `PartnerSubscriptionGate.tsx`, `PartnerVerification.tsx`, `StationDiscounts.tsx`, `StationProfileForm.tsx`, `StationProfileFields.tsx`, `StationLocationPicker.tsx`.

Tests: `apps/web/tests/ui-dashboard-polish.test.cjs` and the updated extracted-component fixture in `apps/web/tests/customer-audit.test.cjs`.

The working tree also contains earlier payment/auth/search work and root/other-agent design work. This list identifies this bounded increment rather than taking ownership of the full repository diff.

## Focused verification

- `node tests/ui-dashboard-polish.test.cjs`: 21 passed, zero failed/skipped. Tests execute actual component hooks and loader outcomes rather than only comparing class strings.
- `node tests/customer-audit.test.cjs`: 9 passed after fixing its fixture to render the extracted MobileCustomerAccount. Wallet/profile/sign-out assertions remain.
- `node tests/dashboard-search-ui.test.cjs`: 15 passed after Account extraction, including customer desktop/phone search entries.
- Earlier coherent styling increment: 11 relevant customer/card/control, partner/access/staff/verification/mobile and station-profile test files passed, and `pnpm exec tsc --noEmit --incremental false` exited 0.
- Final affected regression run: `node --test tests/customer-my-card.test.cjs tests/production-customer-controls.test.cjs tests/customer-audit.test.cjs tests/dashboard-search-ui.test.cjs tests/partner-subtype-workshop.test.cjs tests/partner-audit-regression.test.cjs tests/station-profile-form.test.cjs` passed all seven files. The current Node 24 reporter aggregates file results in this mode; no invented assertion count is assigned to that run.
- Fresh final `pnpm exec tsc --noEmit --incremental false` exited 0. The independent state reviewer caught a comparison with an impossible `idle` status; it was removed to match useAsync’s actual type, and this fresh TypeScript run confirms the correction.
- Final source/test freeze is recorded in `evidence/customer-partner-source.json` (17 files). Root’s complete web suite/build and browser captures must follow this freeze.

## Independent root integration review

Two concrete issues were reported to root: mobile 16px font rules lost to `.text-sm` specificity, and bottom-positioned toasts could cover mobile navigation. Root owns those fixes and their final computed-style/browser verification. Shared dialog focus containment, reduced-motion fallback and search keyboard navigation were also inspected; no additional concrete defect was identified in that bounded source review.

This increment does not establish a 5/5 score or complete production readiness. Final visual checks, hosted/provider checks and exact-patch release review are recorded by root separately.

## Independent review of this increment

The read-only `support_state_review23` agent reviewed the current Support, plan-modal, Wallet, discounts, partner support/API and subscription-gate state handling, their callers and focused tests. Its sole confirmed finding was the impossible `idle` status comparison described above; that finding was corrected. It found no additional concrete defect in the bounded paths. Browser, backend and production-build verification were outside that review.
