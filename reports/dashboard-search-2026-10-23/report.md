# Dashboard search

23 October 2026. Implemented in the uncommitted release based on `a27caac35d740a2dd4b8c53ea83c948a3163a400`.

The customer, partner, company and admin headers now search permitted pages and real records exposed by their existing APIs. A selected result opens its page and applies the relevant visible filter. Search is available in a labelled mobile dialog and a desktop field, with loading, no-results, partial-failure and retry feedback.

## Scope and behavior

| Area | Result and destination |
| --- | --- |
| Customer | Transactions and stations open their filtered destinations; navigation retains Wallet and My Card. |
| Partner | Transactions, staff and disputes use existing authorized data. Workshop search excludes fuel features. |
| Company | Vehicle, card and transaction results use existing fleet APIs. Pending approval continues to restrict operational routes. |
| Admin | Company results use `/admin?search=...`; queues and permitted administration pages retain their own controls. |

`DashboardSearch.tsx` provides the shared controls, keyboard selection and mobile dialog. `dashboard-search.ts` loads bounded authorized records. `DashboardSearchQuery.tsx` transfers a selected result into the destination's filter without resetting ordinary manual edits. Existing role headers and destination screens consume those components. There is no new unrestricted backend search endpoint.

Requests are debounced; one-character input does not trigger record requests. Stale query/account responses cannot replace the current context. Available results remain usable when one lookup fails. Modifier-click behavior and actual navigation links are preserved.

## Verification

The focused implementation receipts and independent source review are in `evidence/`. The final combined web suite and production build are recorded in the UI report's final-verification receipt.

Actual Chrome keyboard acceptance used isolated synthetic accounts and records:

| Role | Query | Verified destination |
| --- | --- | --- |
| Admin | Fleet | `/admin?search=Fleet+UI+Fixture` |
| Company | SEARCH-234 | `/company/vehicles?search=SEARCH-234` |
| Customer | SEARCH-CUSTOMER-23 | `/customer/transactions?search=SEARCH-CUSTOMER-23` |
| Gas partner | SEARCH-FLEET-23 | `/dashboard/transactions?search=SEARCH-FLEET-23` |

ArrowDown/Enter selected results and the destination filter was visibly applied. The customer result also opened a receipt with its preserved signed amount and approved CNG unit. Responsive screenshots and observations are saved under `../ui-polish-2026-10-23/evidence/`.

## Limits

Header search covers selected pages and bounded recent record classes returned by current endpoints. It is not a full historical search index. Destination tables may search a wider server dataset. Company CSV export retains its separately stated period/fleet scope. Browser checks used a disposable local API with external provider calls blocked; hosted data and role permissions still require deployment smoke checks.

This work remains unreleased until the combined exact payment/authentication patch receives qualified human approval required by AGENTS.md.
