# Changed source files

Base: `a27caac35d740a2dd4b8c53ea83c948a3163a400`. Source patch SHA-256: `dbdee29aa4124bafcb3d18be635ff9707e5639ca1bd1eae0863414a05559b625`.

| File | Area |
| --- | --- |
| [apps/api/src/lib/company-card-issuance.js](../../apps/api/src/lib/company-card-issuance.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/descope-verification.js](../../apps/api/src/lib/descope-verification.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/discounts.js](../../apps/api/src/lib/discounts.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/flutterwave.js](../../apps/api/src/lib/flutterwave.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/fuel-checkout.js](../../apps/api/src/lib/fuel-checkout.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/fuel-quantity.js](../../apps/api/src/lib/fuel-quantity.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/fuel-sale.js](../../apps/api/src/lib/fuel-sale.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/http.js](../../apps/api/src/lib/http.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/payments.js](../../apps/api/src/lib/payments.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/paystack.js](../../apps/api/src/lib/paystack.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/pdf.js](../../apps/api/src/lib/pdf.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/scheduler.js](../../apps/api/src/lib/scheduler.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/settlements.js](../../apps/api/src/lib/settlements.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/sse.js](../../apps/api/src/lib/sse.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/station-approval.js](../../apps/api/src/lib/station-approval.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/station-prices.js](../../apps/api/src/lib/station-prices.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/subscriptions.js](../../apps/api/src/lib/subscriptions.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/sudo.js](../../apps/api/src/lib/sudo.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/transfer-recovery.js](../../apps/api/src/lib/transfer-recovery.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/middleware/auth.js](../../apps/api/src/middleware/auth.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/migrations/035_partner_scope_and_units.sql](../../apps/api/src/migrations/035_partner_scope_and_units.sql) | Database schema and durable claims |
| [apps/api/src/migrations/036_company_card_issuances.sql](../../apps/api/src/migrations/036_company_card_issuances.sql) | Database schema and durable claims |
| [apps/api/src/migrations/037_payout_reconciliation_claims.sql](../../apps/api/src/migrations/037_payout_reconciliation_claims.sql) | Database schema and durable claims |
| [apps/api/src/migrations/038_resupply_selling_unit.sql](../../apps/api/src/migrations/038_resupply_selling_unit.sql) | Database schema and durable claims |
| [apps/api/src/routes/admin.routes.js](../../apps/api/src/routes/admin.routes.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/auth.routes.js](../../apps/api/src/routes/auth.routes.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/company-card-issuances-admin.routes.js](../../apps/api/src/routes/company-card-issuances-admin.routes.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/company.routes.js](../../apps/api/src/routes/company.routes.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/customer.routes.js](../../apps/api/src/routes/customer.routes.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/fuel-checkout.routes.js](../../apps/api/src/routes/fuel-checkout.routes.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/intake-admin.routes.js](../../apps/api/src/routes/intake-admin.routes.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/partner.routes.js](../../apps/api/src/routes/partner.routes.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/webhooks.routes.js](../../apps/api/src/routes/webhooks.routes.js) | API authorization, money effects and recorded-unit projections |
| [apps/api/tests/admin-support.integration.test.mjs](../../apps/api/tests/admin-support.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/company-card-issuance.integration.test.mjs](../../apps/api/tests/company-card-issuance.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/company-dashboard.integration.test.mjs](../../apps/api/tests/company-dashboard.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/customer-audit.integration.test.mjs](../../apps/api/tests/customer-audit.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/database-private-access.integration.test.mjs](../../apps/api/tests/database-private-access.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/flutterwave-processor.test.mjs](../../apps/api/tests/flutterwave-processor.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/flutterwave-units.test.mjs](../../apps/api/tests/flutterwave-units.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/fuel-checkout.integration.test.mjs](../../apps/api/tests/fuel-checkout.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/fuel-quantity.test.mjs](../../apps/api/tests/fuel-quantity.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/fuel-sale.integration.test.mjs](../../apps/api/tests/fuel-sale.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/fuel-unit-projections.integration.test.mjs](../../apps/api/tests/fuel-unit-projections.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/history-settlement-and-scheduler.test.mjs](../../apps/api/tests/history-settlement-and-scheduler.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/legacy-payout-accounting.integration.test.mjs](../../apps/api/tests/legacy-payout-accounting.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/nearest-stations.integration.test.mjs](../../apps/api/tests/nearest-stations.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/partner-dashboard-wiring.test.mjs](../../apps/api/tests/partner-dashboard-wiring.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/partner-production-readiness.test.mjs](../../apps/api/tests/partner-production-readiness.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/partner-scope-policy.test.mjs](../../apps/api/tests/partner-scope-policy.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/partner-scope.integration.test.mjs](../../apps/api/tests/partner-scope.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/partner-staff-atomic-access.integration.test.mjs](../../apps/api/tests/partner-staff-atomic-access.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/provider-response-lifetime.test.mjs](../../apps/api/tests/provider-response-lifetime.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/reconciliation-fallback.integration.test.mjs](../../apps/api/tests/reconciliation-fallback.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/refund-recovery.integration.test.mjs](../../apps/api/tests/refund-recovery.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/settlement-accounting.integration.test.mjs](../../apps/api/tests/settlement-accounting.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/station-approval.test.mjs](../../apps/api/tests/station-approval.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/web/app/admin/operations/page.tsx](../../apps/web/app/admin/operations/page.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/app/dashboard/workshop/page.tsx](../../apps/web/app/dashboard/workshop/page.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/app/mechanic/page.tsx](../../apps/web/app/mechanic/page.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/AdminScreen.tsx](../../apps/web/components/admin-dashboard/AdminScreen.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/IntakeConsole.tsx](../../apps/web/components/admin-dashboard/IntakeConsole.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/RecoveryReview.tsx](../../apps/web/components/admin-dashboard/RecoveryReview.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/AuthForms.tsx](../../apps/web/components/auth/AuthForms.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/company-dashboard/CompanyModals.tsx](../../apps/web/components/company-dashboard/CompanyModals.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/company-dashboard/CompanyScreen.tsx](../../apps/web/components/company-dashboard/CompanyScreen.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/customer-dashboard/CustomerFuelCheckout.tsx](../../apps/web/components/customer-dashboard/CustomerFuelCheckout.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/customer-dashboard/CustomerScreen.tsx](../../apps/web/components/customer-dashboard/CustomerScreen.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/DashboardHeader.tsx](../../apps/web/components/dashboard/DashboardHeader.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/DashboardScreen.tsx](../../apps/web/components/dashboard/DashboardScreen.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/MobileDashboardNav.tsx](../../apps/web/components/dashboard/MobileDashboardNav.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/PartnerSubscriptionGate.tsx](../../apps/web/components/dashboard/PartnerSubscriptionGate.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/PartnershipShell.tsx](../../apps/web/components/dashboard/PartnershipShell.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/PartnershipSidebar.tsx](../../apps/web/components/dashboard/PartnershipSidebar.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/StationDiscounts.tsx](../../apps/web/components/dashboard/StationDiscounts.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/StationProfileFields.tsx](../../apps/web/components/dashboard/StationProfileFields.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/StationProfileForm.tsx](../../apps/web/components/dashboard/StationProfileForm.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/WorkshopDashboard.tsx](../../apps/web/components/dashboard/WorkshopDashboard.tsx) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/lib/customer-presentation.ts](../../apps/web/lib/customer-presentation.ts) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/lib/mock/dashboard-data.ts](../../apps/web/lib/mock/dashboard-data.ts) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/lib/partner-selling-unit.ts](../../apps/web/lib/partner-selling-unit.ts) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/lib/partner-workshop.ts](../../apps/web/lib/partner-workshop.ts) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/lib/services/client.ts](../../apps/web/lib/services/client.ts) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/lib/services/company.ts](../../apps/web/lib/services/company.ts) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/lib/services/types.ts](../../apps/web/lib/services/types.ts) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/lib/station-profile.ts](../../apps/web/lib/station-profile.ts) | Dashboard forms, navigation, recovery and recorded-unit presentation |
| [apps/web/package.json](../../apps/web/package.json) | Dependency patch |
| [apps/web/tests/company-empty-pages.test.cjs](../../apps/web/tests/company-empty-pages.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/customer-audit.test.cjs](../../apps/web/tests/customer-audit.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/customer-my-card.test.cjs](../../apps/web/tests/customer-my-card.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/partner-audit-regression.test.cjs](../../apps/web/tests/partner-audit-regression.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/partner-mobile-navigation.test.cjs](../../apps/web/tests/partner-mobile-navigation.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/partner-subtype-workshop.test.cjs](../../apps/web/tests/partner-subtype-workshop.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/production-auth-navigation.test.cjs](../../apps/web/tests/production-auth-navigation.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/production-company-invitations.test.cjs](../../apps/web/tests/production-company-invitations.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/production-customer-controls.test.cjs](../../apps/web/tests/production-customer-controls.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/production-partner-staff.test.cjs](../../apps/web/tests/production-partner-staff.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/signup-report-regression.test.cjs](../../apps/web/tests/signup-report-regression.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/station-profile-fields.test.cjs](../../apps/web/tests/station-profile-fields.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/station-profile-form.test.cjs](../../apps/web/tests/station-profile-form.test.cjs) | Regression coverage and schema/provider fixtures |
| [packages/shared/partner-access.d.mts](../../packages/shared/partner-access.d.mts) | Shared partner subtype, route, product and unit policy |
| [packages/shared/partner-access.mjs](../../packages/shared/partner-access.mjs) | Shared partner subtype, route, product and unit policy |
| [pnpm-lock.yaml](../../pnpm-lock.yaml) | Dependency patch |
