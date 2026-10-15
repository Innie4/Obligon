# Repair the dashboard UI audit

> 2026-10-13 · Fix all 38 customer, partner, company, admin and shared UI findings.

## In short
Controls use persisted records. Dialogs and receipts reflect actual data; filters and exports share selections.

## What changed
- `apps/api/src/lib/` — `flutterwave.js`, `payments.js`, `pdf.js`, `company-input.js`: Validate company limits/identity; configure selected funding methods; measure PDF rows.
- `apps/api/src/routes/` — `company.routes.js`, `customer.routes.js`, `partner.routes.js`: Persist scoped company actions; return recorded receipt and station data.
- `apps/api/tests/` — `history-settlement-and-scheduler.test.mjs`, `company-dashboard.integration.test.mjs`, `company-input.test.mjs`, `customer-audit.integration.test.mjs`, `customer-funding-methods.test.mjs`, `partner-pos-receipt.test.mjs`, `pdf-layout.test.mjs`: Cover persistence, ownership, concurrency, payment options, receipts and PDF layout.
- `apps/web/app/` — `layout.tsx`: Declare existing smooth scrolling.
- `apps/web/components/admin-dashboard/` — `AdminHeader.tsx`, `AdminShell.tsx`: Expose mobile logout and dialog keyboard behavior; describe section search.
- `apps/web/components/auth/` — `AuthShell.tsx`: Use role-aware notification links and inclusive signup copy.
- `apps/web/components/careers/` — `CareersPage.tsx`: Contain the rotated decoration.
- `apps/web/components/company-dashboard/` — `CompanyModals.tsx`, `CompanyScreen.tsx`, `CompanyShell.tsx`: Connect forms, filters, exports and operational pages to real APIs; retain empty-state actions.
- `apps/web/components/customer-dashboard/` — `CardRequestModals.tsx`, `CustomerModals.tsx`, `CustomerScreen.tsx`, `CustomerShell.tsx`: Expose mobile account actions; persist read status; use truthful receipts, balances and card states.
- `apps/web/components/dashboard/` — `DashboardScreen.tsx`, `PartnershipSidebar.tsx`: Fix partner POS labels, paid-order fields, receipts and responsive dialogs.
- `apps/web/components/landing/` — `Button.tsx`, `Footer.tsx`, `Header.tsx`: Correct About Us links and image sizing.
- `apps/web/components/legal/` — `LegalPage.tsx`: Contain tables and name cookie switches.
- `apps/web/components/shared/` — `Dialogs.tsx`, `SubscriptionPanel.tsx`, `useDialogFocus.ts`: Share dialog focus containment; align plan actions and clarify expiry dates.
- `apps/web/components/site/` — `CookieConsentBanner.tsx`, `SiteFooter.tsx`: Correct About Us links and keep cookie banners below dialogs.
- `apps/web/lib/mock/` — `company-data.ts`, `dashboard-data.ts`: Keep navigation destinations and section-search copy consistent.
- `apps/web/lib/services/` — `client.ts`, `types.ts`, `company.ts`: Define company calls and committed receipt types.
- `apps/web/lib/` — `company-input.ts`, `customer-presentation.ts`: Parse company inputs and present customer receipts/statuses.
- `apps/web/tests/` — `customer-my-card.test.cjs`, `company-empty-pages.test.cjs`, `company-input.test.cjs`, `customer-audit.test.cjs`, `dialog-focus.test.cjs`, `partner-audit-regression.test.cjs`: Cover keyboard dialogs, empty pages, inputs, receipt truthfulness and partner regressions.

## How it works
1. A page fetches scoped API records. Native buttons/selectors expose actions and filters.
2. A form validates amounts and selections; the API checks ownership and forwards required issuer details.
3. Successful writes refresh records. Notifications retain server read state after reload.
4. Receipts use committed metadata. List and export share period, vehicle and stable driver IDs.
5. `useDialogFocus` contains keyboard focus in the topmost dialog and restores its opener.

## Why it's built this way
Existing endpoints and styling remain. Stable IDs distinguish people with identical names. Organization-first database locks serialize simultaneous card assignments; older APIs block assignment saves with unknown selections.

## The concept worth knowing: one source of truth
Like a shop receipt printed from its till, the screen should describe the recorded sale. Precisely, server records determine read flags, assignments and receipts. Success follows a successful write.

## Watch out for
614 API tests and 90 web tests passed; the production build passed. Two environment credential scans skipped. All-role browser checks used isolated seeded data. Payment/card-provider requests were mocked; production provider execution still depends on deployed credentials. Test nested dialogs, issuer failures and simultaneous assignments when extending these flows.

## Check yourself
1. Why filter by driver ID?
<details><summary>Answer</summary>Two drivers may share a name; IDs preserve the same selection in the list and export.</details>

2. What if an issuer rejects a card request?
<details><summary>Answer</summary>The API returns failure without creating a fabricated active local card.</details>

3. Why lock the organization first?
<details><summary>Answer</summary>Concurrent vehicle swaps otherwise acquire conflicting locks and can deadlock or overwrite assignments.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
