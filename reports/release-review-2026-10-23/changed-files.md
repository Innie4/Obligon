# Combined release source files

Base: `a27caac35d740a2dd4b8c53ea83c948a3163a400`. Source patch SHA-256: `fc0eb77d2c2093eaac0f2e741c55f999df0bb0fcdda3ec5c2df342ca52dfbfb5`.

| File | Area |
| --- | --- |
| [apps/api/.env.example](../../apps/api/.env.example) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/package.json](../../apps/api/package.json) | Dependency patch |
| [apps/api/src/config/env.js](../../apps/api/src/config/env.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/auth-method-proof.js](../../apps/api/src/lib/auth-method-proof.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/company-card-issuance.js](../../apps/api/src/lib/company-card-issuance.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/descope-verification.js](../../apps/api/src/lib/descope-verification.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/discounts.js](../../apps/api/src/lib/discounts.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/flutterwave.js](../../apps/api/src/lib/flutterwave.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/fuel-checkout.js](../../apps/api/src/lib/fuel-checkout.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/fuel-quantity.js](../../apps/api/src/lib/fuel-quantity.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/fuel-sale.js](../../apps/api/src/lib/fuel-sale.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/google-identity.js](../../apps/api/src/lib/google-identity.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/http.js](../../apps/api/src/lib/http.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/passkeys.js](../../apps/api/src/lib/passkeys.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/payments.js](../../apps/api/src/lib/payments.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/paystack.js](../../apps/api/src/lib/paystack.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/pdf.js](../../apps/api/src/lib/pdf.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/scheduler.js](../../apps/api/src/lib/scheduler.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/settlements.js](../../apps/api/src/lib/settlements.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/sse.js](../../apps/api/src/lib/sse.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/station-approval.js](../../apps/api/src/lib/station-approval.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/station-prices.js](../../apps/api/src/lib/station-prices.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/subscriptions.js](../../apps/api/src/lib/subscriptions.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/sudo.js](../../apps/api/src/lib/sudo.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/lib/transfer-recovery.js](../../apps/api/src/lib/transfer-recovery.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/middleware/auth.js](../../apps/api/src/middleware/auth.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/migrations/035_partner_scope_and_units.sql](../../apps/api/src/migrations/035_partner_scope_and_units.sql) | Database schema and durable claims |
| [apps/api/src/migrations/036_company_card_issuances.sql](../../apps/api/src/migrations/036_company_card_issuances.sql) | Database schema and durable claims |
| [apps/api/src/migrations/037_payout_reconciliation_claims.sql](../../apps/api/src/migrations/037_payout_reconciliation_claims.sql) | Database schema and durable claims |
| [apps/api/src/migrations/038_resupply_selling_unit.sql](../../apps/api/src/migrations/038_resupply_selling_unit.sql) | Database schema and durable claims |
| [apps/api/src/migrations/039_account_signin_methods.sql](../../apps/api/src/migrations/039_account_signin_methods.sql) | Database schema and durable claims |
| [apps/api/src/routes/admin.routes.js](../../apps/api/src/routes/admin.routes.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/auth-methods.routes.js](../../apps/api/src/routes/auth-methods.routes.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/auth.routes.js](../../apps/api/src/routes/auth.routes.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/company-card-issuances-admin.routes.js](../../apps/api/src/routes/company-card-issuances-admin.routes.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/company.routes.js](../../apps/api/src/routes/company.routes.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/customer.routes.js](../../apps/api/src/routes/customer.routes.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/fuel-checkout.routes.js](../../apps/api/src/routes/fuel-checkout.routes.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/intake-admin.routes.js](../../apps/api/src/routes/intake-admin.routes.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/partner.routes.js](../../apps/api/src/routes/partner.routes.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/src/routes/webhooks.routes.js](../../apps/api/src/routes/webhooks.routes.js) | API identity, authorization, money effects and recorded-unit projections |
| [apps/api/tests/admin-support.integration.test.mjs](../../apps/api/tests/admin-support.integration.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/auth-method-settings.test.mjs](../../apps/api/tests/auth-method-settings.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/auth-methods.integration.test.mjs](../../apps/api/tests/auth-methods.integration.test.mjs) | Regression coverage and schema/provider fixtures |
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
| [apps/api/tests/google-identity.test.mjs](../../apps/api/tests/google-identity.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/helpers/software-passkey.mjs](../../apps/api/tests/helpers/software-passkey.mjs) | Regression coverage and schema/provider fixtures |
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
| [apps/api/tests/software-passkey.test.mjs](../../apps/api/tests/software-passkey.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/api/tests/station-approval.test.mjs](../../apps/api/tests/station-approval.test.mjs) | Regression coverage and schema/provider fixtures |
| [apps/web/app/admin/login/page.tsx](../../apps/web/app/admin/login/page.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/app/admin/operations/page.tsx](../../apps/web/app/admin/operations/page.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/app/auth/session-expired/page.tsx](../../apps/web/app/auth/session-expired/page.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/app/auth/sign-in-options/page.tsx](../../apps/web/app/auth/sign-in-options/page.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/app/dashboard/workshop/page.tsx](../../apps/web/app/dashboard/workshop/page.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/app/forgot-password/page.tsx](../../apps/web/app/forgot-password/page.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/app/globals.css](../../apps/web/app/globals.css) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/app/mechanic/page.tsx](../../apps/web/app/mechanic/page.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/app/reset-password/page.tsx](../../apps/web/app/reset-password/page.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/app/support/page.tsx](../../apps/web/app/support/page.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/AdminHeader.tsx](../../apps/web/components/admin-dashboard/AdminHeader.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/AdminModals.tsx](../../apps/web/components/admin-dashboard/AdminModals.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/AdminRecords.tsx](../../apps/web/components/admin-dashboard/AdminRecords.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/AdminScreen.tsx](../../apps/web/components/admin-dashboard/AdminScreen.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/AdminShell.tsx](../../apps/web/components/admin-dashboard/AdminShell.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/AdminSidebar.tsx](../../apps/web/components/admin-dashboard/AdminSidebar.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/CardApprovalQueue.tsx](../../apps/web/components/admin-dashboard/CardApprovalQueue.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/DiscountApprovals.tsx](../../apps/web/components/admin-dashboard/DiscountApprovals.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/IntakeConsole.tsx](../../apps/web/components/admin-dashboard/IntakeConsole.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/OperationsInbox.tsx](../../apps/web/components/admin-dashboard/OperationsInbox.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/admin-dashboard/RecoveryReview.tsx](../../apps/web/components/admin-dashboard/RecoveryReview.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/AdditionalSignInMethods.tsx](../../apps/web/components/auth/AdditionalSignInMethods.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/AuthForms.tsx](../../apps/web/components/auth/AuthForms.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/AuthGuard.tsx](../../apps/web/components/auth/AuthGuard.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/AuthShell.tsx](../../apps/web/components/auth/AuthShell.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/AuthStatus.tsx](../../apps/web/components/auth/AuthStatus.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/CompanyInvitation.tsx](../../apps/web/components/auth/CompanyInvitation.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/DemoAccountPanel.tsx](../../apps/web/components/auth/DemoAccountPanel.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/GoogleIdentityButton.tsx](../../apps/web/components/auth/GoogleIdentityButton.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/LogoutButton.tsx](../../apps/web/components/auth/LogoutButton.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/MFAUI.tsx](../../apps/web/components/auth/MFAUI.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/SignInOptions.tsx](../../apps/web/components/auth/SignInOptions.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/SuccessAutoRedirect.tsx](../../apps/web/components/auth/SuccessAutoRedirect.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/SuccessHonesty.tsx](../../apps/web/components/auth/SuccessHonesty.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/auth/VerificationUI.tsx](../../apps/web/components/auth/VerificationUI.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/careers/CareersPage.tsx](../../apps/web/components/careers/CareersPage.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/company-dashboard/CompanyContextSelector.tsx](../../apps/web/components/company-dashboard/CompanyContextSelector.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/company-dashboard/CompanyModals.tsx](../../apps/web/components/company-dashboard/CompanyModals.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/company-dashboard/CompanyScreen.tsx](../../apps/web/components/company-dashboard/CompanyScreen.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/company-dashboard/CompanyShell.tsx](../../apps/web/components/company-dashboard/CompanyShell.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/customer-dashboard/CardRequestModals.tsx](../../apps/web/components/customer-dashboard/CardRequestModals.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/customer-dashboard/CustomerFuelCheckout.tsx](../../apps/web/components/customer-dashboard/CustomerFuelCheckout.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/customer-dashboard/CustomerModals.tsx](../../apps/web/components/customer-dashboard/CustomerModals.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/customer-dashboard/CustomerScreen.tsx](../../apps/web/components/customer-dashboard/CustomerScreen.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/customer-dashboard/CustomerShell.tsx](../../apps/web/components/customer-dashboard/CustomerShell.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/DashboardHeader.tsx](../../apps/web/components/dashboard/DashboardHeader.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/DashboardScreen.tsx](../../apps/web/components/dashboard/DashboardScreen.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/MobileDashboardNav.tsx](../../apps/web/components/dashboard/MobileDashboardNav.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/PartnerApiKeys.tsx](../../apps/web/components/dashboard/PartnerApiKeys.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/PartnerServiceRequests.tsx](../../apps/web/components/dashboard/PartnerServiceRequests.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/PartnerSubscriptionGate.tsx](../../apps/web/components/dashboard/PartnerSubscriptionGate.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/PartnerVerification.tsx](../../apps/web/components/dashboard/PartnerVerification.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/PartnershipShell.tsx](../../apps/web/components/dashboard/PartnershipShell.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/PartnershipSidebar.tsx](../../apps/web/components/dashboard/PartnershipSidebar.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/StationDiscounts.tsx](../../apps/web/components/dashboard/StationDiscounts.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/StationLocationPicker.tsx](../../apps/web/components/dashboard/StationLocationPicker.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/StationProfileFields.tsx](../../apps/web/components/dashboard/StationProfileFields.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/StationProfileForm.tsx](../../apps/web/components/dashboard/StationProfileForm.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/dashboard/WorkshopDashboard.tsx](../../apps/web/components/dashboard/WorkshopDashboard.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/landing/Button.tsx](../../apps/web/components/landing/Button.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/landing/ClosingCta.tsx](../../apps/web/components/landing/ClosingCta.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/landing/Footer.tsx](../../apps/web/components/landing/Footer.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/landing/Header.tsx](../../apps/web/components/landing/Header.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/landing/Hero.tsx](../../apps/web/components/landing/Hero.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/landing/Pricing.tsx](../../apps/web/components/landing/Pricing.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/landing/Story.tsx](../../apps/web/components/landing/Story.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/shared/AuthContext.tsx](../../apps/web/components/shared/AuthContext.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/shared/DashboardSearch.tsx](../../apps/web/components/shared/DashboardSearch.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/shared/DashboardSearchQuery.tsx](../../apps/web/components/shared/DashboardSearchQuery.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/shared/Dialogs.tsx](../../apps/web/components/shared/Dialogs.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/shared/ErrorBoundary.tsx](../../apps/web/components/shared/ErrorBoundary.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/shared/Providers.tsx](../../apps/web/components/shared/Providers.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/shared/States.tsx](../../apps/web/components/shared/States.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/shared/StationMap.tsx](../../apps/web/components/shared/StationMap.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/shared/StatusPopup.tsx](../../apps/web/components/shared/StatusPopup.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/shared/Toast.tsx](../../apps/web/components/shared/Toast.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/site/CookieConsentBanner.tsx](../../apps/web/components/site/CookieConsentBanner.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/site/Input.tsx](../../apps/web/components/site/Input.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/site/PageIntro.tsx](../../apps/web/components/site/PageIntro.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/site/SiteFooter.tsx](../../apps/web/components/site/SiteFooter.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/site/SiteHeader.tsx](../../apps/web/components/site/SiteHeader.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/site/routes.ts](../../apps/web/components/site/routes.ts) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/components/solutions/SolutionPage.tsx](../../apps/web/components/solutions/SolutionPage.tsx) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/lib/auth-methods.ts](../../apps/web/lib/auth-methods.ts) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/lib/customer-presentation.ts](../../apps/web/lib/customer-presentation.ts) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/lib/dashboard-search.ts](../../apps/web/lib/dashboard-search.ts) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/lib/mock/dashboard-data.ts](../../apps/web/lib/mock/dashboard-data.ts) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/lib/partner-selling-unit.ts](../../apps/web/lib/partner-selling-unit.ts) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/lib/partner-workshop.ts](../../apps/web/lib/partner-workshop.ts) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/lib/services/client.ts](../../apps/web/lib/services/client.ts) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/lib/services/company.ts](../../apps/web/lib/services/company.ts) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/lib/services/types.ts](../../apps/web/lib/services/types.ts) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/lib/station-profile.ts](../../apps/web/lib/station-profile.ts) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/package.json](../../apps/web/package.json) | Dependency patch |
| [apps/web/tailwind.config.js](../../apps/web/tailwind.config.js) | Login, sign-in methods, dashboard navigation, recovery and recorded-unit presentation |
| [apps/web/tests/additional-auth-methods.test.cjs](../../apps/web/tests/additional-auth-methods.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/admin-company-approval.test.cjs](../../apps/web/tests/admin-company-approval.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/admin-navigation.test.cjs](../../apps/web/tests/admin-navigation.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/admin-queue-states.test.cjs](../../apps/web/tests/admin-queue-states.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/admin-screen-loading.test.cjs](../../apps/web/tests/admin-screen-loading.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/auth-method-ui.test.cjs](../../apps/web/tests/auth-method-ui.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/company-admin-ui-polish.test.cjs](../../apps/web/tests/company-admin-ui-polish.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/company-empty-pages.test.cjs](../../apps/web/tests/company-empty-pages.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/customer-audit.test.cjs](../../apps/web/tests/customer-audit.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/customer-my-card.test.cjs](../../apps/web/tests/customer-my-card.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/dashboard-floating-feedback.test.cjs](../../apps/web/tests/dashboard-floating-feedback.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/dashboard-search-destinations.test.cjs](../../apps/web/tests/dashboard-search-destinations.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/dashboard-search-loader.test.cjs](../../apps/web/tests/dashboard-search-loader.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/dashboard-search-ui.test.cjs](../../apps/web/tests/dashboard-search-ui.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/helpers/status-popup.cjs](../../apps/web/tests/helpers/status-popup.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/landing-mobile-menu.test.cjs](../../apps/web/tests/landing-mobile-menu.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/mfa-password-proof.test.cjs](../../apps/web/tests/mfa-password-proof.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/partner-audit-regression.test.cjs](../../apps/web/tests/partner-audit-regression.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/partner-mobile-navigation.test.cjs](../../apps/web/tests/partner-mobile-navigation.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/partner-subtype-workshop.test.cjs](../../apps/web/tests/partner-subtype-workshop.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/partner-verification.test.cjs](../../apps/web/tests/partner-verification.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/production-auth-navigation.test.cjs](../../apps/web/tests/production-auth-navigation.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/production-company-invitations.test.cjs](../../apps/web/tests/production-company-invitations.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/production-company-workflows.test.cjs](../../apps/web/tests/production-company-workflows.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/production-customer-controls.test.cjs](../../apps/web/tests/production-customer-controls.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/production-partner-staff.test.cjs](../../apps/web/tests/production-partner-staff.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/production-public-controls.test.cjs](../../apps/web/tests/production-public-controls.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/production-shared-state.test.cjs](../../apps/web/tests/production-shared-state.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/signup-report-regression.test.cjs](../../apps/web/tests/signup-report-regression.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/station-location-picker.test.cjs](../../apps/web/tests/station-location-picker.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/station-map-states.test.cjs](../../apps/web/tests/station-map-states.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/station-profile-fields.test.cjs](../../apps/web/tests/station-profile-fields.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/station-profile-form.test.cjs](../../apps/web/tests/station-profile-form.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/status-popup.test.cjs](../../apps/web/tests/status-popup.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/success-honesty.test.cjs](../../apps/web/tests/success-honesty.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/test-report-company.test.cjs](../../apps/web/tests/test-report-company.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/transport-regression.test.cjs](../../apps/web/tests/transport-regression.test.cjs) | Regression coverage and schema/provider fixtures |
| [apps/web/tests/ui-dashboard-polish.test.cjs](../../apps/web/tests/ui-dashboard-polish.test.cjs) | Regression coverage and schema/provider fixtures |
| [packages/shared/partner-access.d.mts](../../packages/shared/partner-access.d.mts) | Shared partner subtype, route, product and unit policy |
| [packages/shared/partner-access.mjs](../../packages/shared/partner-access.mjs) | Shared partner subtype, route, product and unit policy |
| [pnpm-lock.yaml](../../pnpm-lock.yaml) | Dependency patch |
