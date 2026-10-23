# Payments and partner access

> 2026-10-23 · Review payment flows and restrict workshop/gas partner access.

## In short

Company card retries now share one durable issuing operation. Workshop accounts receive relevant screens, and gas purchases keep the station's approved unit through pricing, payment and receipts.

## What changed

- API: current authorization, exact prices, durable payment effects and unit-aware records: `apps/api/src/lib/company-card-issuance.js`, `apps/api/src/lib/descope-verification.js`, `apps/api/src/lib/discounts.js`, `apps/api/src/lib/flutterwave.js`, `apps/api/src/lib/fuel-checkout.js`, `apps/api/src/lib/fuel-quantity.js`, `apps/api/src/lib/fuel-sale.js`, `apps/api/src/lib/http.js`, `apps/api/src/lib/payments.js`, `apps/api/src/lib/paystack.js`, `apps/api/src/lib/pdf.js`, `apps/api/src/lib/scheduler.js`, `apps/api/src/lib/settlements.js`, `apps/api/src/lib/sse.js`, `apps/api/src/lib/station-approval.js`, `apps/api/src/lib/station-prices.js`, `apps/api/src/lib/subscriptions.js`, `apps/api/src/lib/sudo.js`, `apps/api/src/lib/transfer-recovery.js`, `apps/api/src/middleware/auth.js`, `apps/api/src/routes/admin.routes.js`, `apps/api/src/routes/auth.routes.js`, `apps/api/src/routes/company-card-issuances-admin.routes.js`, `apps/api/src/routes/company.routes.js`, `apps/api/src/routes/customer.routes.js`, `apps/api/src/routes/fuel-checkout.routes.js`, `apps/api/src/routes/intake-admin.routes.js`, `apps/api/src/routes/partner.routes.js`, `apps/api/src/routes/webhooks.routes.js`.
- Migrations: additive subtype/unit data, durable issuing and fair reconciliation claims: `apps/api/src/migrations/035_partner_scope_and_units.sql`, `apps/api/src/migrations/036_company_card_issuances.sql`, `apps/api/src/migrations/037_payout_reconciliation_claims.sql`, `apps/api/src/migrations/038_resupply_selling_unit.sql`.
- API tests: real PostgreSQL/HTTP regression cases and fixtures aligned with the current contracts: `apps/api/tests/admin-support.integration.test.mjs`, `apps/api/tests/company-card-issuance.integration.test.mjs`, `apps/api/tests/company-dashboard.integration.test.mjs`, `apps/api/tests/customer-audit.integration.test.mjs`, `apps/api/tests/database-private-access.integration.test.mjs`, `apps/api/tests/flutterwave-processor.test.mjs`, `apps/api/tests/flutterwave-units.test.mjs`, `apps/api/tests/fuel-checkout.integration.test.mjs`, `apps/api/tests/fuel-quantity.test.mjs`, `apps/api/tests/fuel-sale.integration.test.mjs`, `apps/api/tests/fuel-unit-projections.integration.test.mjs`, `apps/api/tests/history-settlement-and-scheduler.test.mjs`, `apps/api/tests/legacy-payout-accounting.integration.test.mjs`, `apps/api/tests/nearest-stations.integration.test.mjs`, `apps/api/tests/partner-dashboard-wiring.test.mjs`, `apps/api/tests/partner-production-readiness.test.mjs`, `apps/api/tests/partner-scope-policy.test.mjs`, `apps/api/tests/partner-scope.integration.test.mjs`, `apps/api/tests/partner-staff-atomic-access.integration.test.mjs`, `apps/api/tests/provider-response-lifetime.test.mjs`, `apps/api/tests/reconciliation-fallback.integration.test.mjs`, `apps/api/tests/refund-recovery.integration.test.mjs`, `apps/api/tests/settlement-accounting.integration.test.mjs`, `apps/api/tests/station-approval.test.mjs`.
- Web: workshop screens, unit-aware checkout/forms and explicit recovery controls: `apps/web/app/admin/operations/page.tsx`, `apps/web/app/dashboard/workshop/page.tsx`, `apps/web/app/mechanic/page.tsx`, `apps/web/components/admin-dashboard/AdminScreen.tsx`, `apps/web/components/admin-dashboard/IntakeConsole.tsx`, `apps/web/components/admin-dashboard/RecoveryReview.tsx`, `apps/web/components/auth/AuthForms.tsx`, `apps/web/components/company-dashboard/CompanyModals.tsx`, `apps/web/components/company-dashboard/CompanyScreen.tsx`, `apps/web/components/customer-dashboard/CustomerFuelCheckout.tsx`, `apps/web/components/customer-dashboard/CustomerScreen.tsx`, `apps/web/components/dashboard/DashboardHeader.tsx`, `apps/web/components/dashboard/DashboardScreen.tsx`, `apps/web/components/dashboard/MobileDashboardNav.tsx`, `apps/web/components/dashboard/PartnerSubscriptionGate.tsx`, `apps/web/components/dashboard/PartnershipShell.tsx`, `apps/web/components/dashboard/PartnershipSidebar.tsx`, `apps/web/components/dashboard/StationDiscounts.tsx`, `apps/web/components/dashboard/StationProfileFields.tsx`, `apps/web/components/dashboard/StationProfileForm.tsx`, `apps/web/components/dashboard/WorkshopDashboard.tsx`, `apps/web/lib/customer-presentation.ts`, `apps/web/lib/mock/dashboard-data.ts`, `apps/web/lib/partner-selling-unit.ts`, `apps/web/lib/partner-workshop.ts`, `apps/web/lib/services/client.ts`, `apps/web/lib/services/company.ts`, `apps/web/lib/services/types.ts`, `apps/web/lib/station-profile.ts`.
- Web tests: subtype navigation, forms, units and recovery states: `apps/web/tests/company-empty-pages.test.cjs`, `apps/web/tests/customer-audit.test.cjs`, `apps/web/tests/customer-my-card.test.cjs`, `apps/web/tests/partner-audit-regression.test.cjs`, `apps/web/tests/partner-mobile-navigation.test.cjs`, `apps/web/tests/partner-subtype-workshop.test.cjs`, `apps/web/tests/production-auth-navigation.test.cjs`, `apps/web/tests/production-company-invitations.test.cjs`, `apps/web/tests/production-customer-controls.test.cjs`, `apps/web/tests/production-partner-staff.test.cjs`, `apps/web/tests/signup-report-regression.test.cjs`, `apps/web/tests/station-profile-fields.test.cjs`, `apps/web/tests/station-profile-form.test.cjs`.
- Shared policy: canonical partner types, products, units and allowed routes: `packages/shared/partner-access.d.mts`, `packages/shared/partner-access.mjs`.
- Dependency resolution: patched Next.js and matching ESLint tooling: `apps/web/package.json`, `pnpm-lock.yaml`.

## How it works

1. The API loads the current organization subtype and membership. Shared policy controls navigation; server checks enforce access, including before realtime delivery.
2. An admin approves a station's products and units. Pricing and checkout must agree with that approval. Each order stores its unit so later edits cannot reinterpret a paid purchase.
3. Company issuing saves a caller-and-payload-bound operation before contacting Sudo. A saved receipt finishes locally; an uncertain response requires review.
4. Reconciliation workers claim different rows, rotate unresolved work and reject stale results. Provider deadlines cover the whole response.
5. Reports group physical quantities separately. Customer histories also separate personal and company activity.

## Why it's built this way

A hidden menu cannot prevent an API call. Current server authorization therefore remains the authority. Durable database records also survive worker restarts, unlike an in-memory lock. Gas units require explicit approval because kilograms and litres cannot safely share a label or an assumed conversion.

## The concept worth knowing

Idempotency resembles a numbered collection ticket: presenting the same ticket again retrieves the existing result. Precisely, the database binds a stable request key to its caller and normalized payload, locks the operation, and records progress before external effects. It does not promise exactly-once network delivery.

## Watch out for

The full API acceptance run passed 1,200 cases with 13 live-service cases skipped. Mocked issuer responses do not prove Sudo sandbox acceptance. Unknown provider outcomes, deleted assignments, hosted scheduling and bank/provider/books reconciliation still require operational review. Qualified human approval is required before releasing this financial/authorization patch. See `reports/payments-partner-access-2026-10-23/report.md` for evidence and limitations.

## Check yourself

1. Why must the request payload be bound to its key?
<details><summary>Answer</summary>Otherwise a key could silently reuse an old result for a different card request.</details>

2. What if a gas station changes its unit after payment?
<details><summary>Answer</summary>The purchase keeps its original unit and enters review if current approval prevents fulfilment. The system must not reinterpret the quantity.</details>

3. Why recheck membership after a slow provider call?
<details><summary>Answer</summary>The actor may have been suspended or lost permission while the request was waiting.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
