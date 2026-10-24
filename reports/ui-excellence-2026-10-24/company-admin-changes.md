# Company and admin interface changes

24 October 2026. Presentation and navigation-control work within the existing dashboards. Backend, permission checks and financial handlers were preserved.

## Acceptance and changes

| Area | Before | After and acceptance |
| --- | --- | --- |
| Admin customer benefits | Funding input and action competed for one narrow flex row. Large balances could exceed tablet columns. | Funding label, input and action use full width on mobile, then a two-column form above the small breakpoint. Exact balances retain every digit and can wrap inside their column. Existing disabled and checkout conditions remain. |
| Admin intake | Eight queue buttons occupied several mobile rows. | A labelled mobile selector exposes all eight queues. Desktop buttons remain. Both controls preserve queue selection, selected-record reset, page reset and search reset. |
| Admin intake records | Long email, UUID and submitted title tokens could exceed card headers. | Queue and review headings wrap within their existing panels. No submitted value is shortened. |
| Admin operations | Support tickets had no visible or announced selected state. | The current conversation has a pale-green selection and `aria-pressed`. Selecting another conversation updates both indicators through the existing handler. Long subjects wrap. |
| Admin reports and metrics | Approved quantity units were displayed at the same large size as numbers and could wrap word by word. | Exact quantities remain unchanged. Approved unit phrases stay together at a quieter size; narrow-screen figures use a smaller type size. |
| Admin discount approvals | Empty results were a bare paragraph. Review reason was an inline field. | The existing shared empty state explains where requests will appear. Review reason has a full-width field and explicitly states when it is required. Existing pending-only visibility, rejection requirement and busy disabling remain. |
| Company tables | Every desktop table repeated a horizontal-scroll instruction band. | The permanent visual band is removed. Named, keyboard-focusable table scroll regions and labelled mobile record cards remain. |
| Company cards | Secondary actions wrapped into several rows and boxed metrics competed with records. | Mobile secondary actions use a compact two-column arrangement with the single-use code action spanning the row. Card metrics use a quiet, compact summary. All original actions, row targets and exact values remain. |
| Company navigation | Desktop selection used a strong solid fill; mobile selection was not indicated. | Desktop and mobile use a pale-green current-page treatment. Mobile links announce `aria-current`. Route and role visibility are unchanged. |

## Touched implementation files

- `apps/web/components/admin-dashboard/AdminBenefits.tsx`
- `apps/web/components/admin-dashboard/AdminScreen.tsx`
- `apps/web/components/admin-dashboard/DiscountApprovals.tsx`
- `apps/web/components/admin-dashboard/IntakeConsole.tsx`
- `apps/web/components/admin-dashboard/OperationsInbox.tsx`
- `apps/web/components/company-dashboard/CompanyScreen.tsx`
- `apps/web/components/company-dashboard/CompanyShell.tsx`

Focused tests changed in `apps/web/tests/company-admin-ui-polish.test.cjs`, `admin-screen-loading.test.cjs` and `admin-queue-states.test.cjs`.

## Fresh verification

The new checks failed against the unchanged implementation for the missing queue selector, support selection semantics and quantity-unit grouping. After implementation:

- `node tests/company-admin-ui-polish.test.cjs`: 15 passed, 0 failed. Includes all eight queue routes, support selection changes, scoped record actions, assignment labels, pagination, quantities and disabled review controls.
- `node tests/admin-screen-loading.test.cjs`: 6 passed, 0 failed. Includes superseded searches, failure recovery, reporting windows, export failure, exact metrics and unit grouping.
- `node tests/admin-queue-states.test.cjs`: 4 passed, 0 failed. Includes distinct loading, failed, retry and genuinely empty states for discount/card/replacement/operations queues.
- The initial `pnpm exec tsc --noEmit --incremental false` found one integration error outside these files at `components/dashboard/DashboardScreen.tsx:455`. The root agent subsequently corrected that integration and reported a clean full typecheck.

The queue-state fixture now renders the shared empty-state boundary rather than expecting all empty copy to be a direct child of the page.

Independent read-only agent review found no actionable regression in this bounded diff. A fresh independent combined run of the three focused test files passed. The reviewer checked queue routes and reset behavior, support selection requests, exact quantity text, unchanged funding gates/conversion/handlers, scoped card actions and current-page navigation.

## Round 3 company follow-up

Company Overview and Transactions now explain that purchases made with company cards populate their empty records, and offer the existing `/company/cards` destination through a "View cards" link. The filtered Transactions state still states that its current filters found no matching purchase and suggests changing the period or filters. No purchase, export, search, approval or access handler changed.

The existing company table accepts optional empty-state message/action props so this context stays within its shared empty presentation. A focused regression checks both pages' explanatory copy, existing cards destination and absence of fabricated table rows.

Fresh round 3 verification: `node --test-reporter=tap tests/company-admin-ui-polish.test.cjs` passed 16 tests with 0 failures. The scoped diff whitespace check passed.

The root agent owns final rendered captures across routes, widths and states, overall TypeScript/build checks, the consolidated learning note and release checks. Browser findings must be assessed against those final captures; these focused checks do not prove every rendered layout or production service.

## Preservation contract

Company organization context and access gates, scoped search, pagination, vehicle/card assignments, freeze/unfreeze, fuel authorization, approved station units, roadside cancellation, wallet funding/confirmation/allocation, exports, team actions, notification actions, support conversations, settings and maintenance actions remain connected to their existing handlers.

Admin review scopes, BVN/email/name/issuer prerequisites, station publication units, support attachments and replies, settlement/refund recovery, staff access controls, discount reasons, funding recovery/idempotency and generator quote/fund/start/complete/cancel stages were not changed.
