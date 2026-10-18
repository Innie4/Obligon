# Changed application and test files

18 October 2026. Environment files and earlier untracked artifacts are excluded.

| File | Purpose |
| --- | --- |
| [apps/api/src/config/env.js](../../apps/api/src/config/env.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/index.js](../../apps/api/src/index.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/lib/mailer.js](../../apps/api/src/lib/mailer.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/lib/notify.js](../../apps/api/src/lib/notify.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/lib/pdf.js](../../apps/api/src/lib/pdf.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/lib/sms.js](../../apps/api/src/lib/sms.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/routes/admin.routes.js](../../apps/api/src/routes/admin.routes.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/routes/auth.routes.js](../../apps/api/src/routes/auth.routes.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/routes/company.routes.js](../../apps/api/src/routes/company.routes.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/routes/customer.routes.js](../../apps/api/src/routes/customer.routes.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/routes/intake-admin.routes.js](../../apps/api/src/routes/intake-admin.routes.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/routes/partner.routes.js](../../apps/api/src/routes/partner.routes.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/routes/public.routes.js](../../apps/api/src/routes/public.routes.js) | Public: reject empty careers email before writes; clarify presentation copy. |
| [apps/api/src/routes/subscription.routes.js](../../apps/api/src/routes/subscription.routes.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/routes/support-admin.routes.js](../../apps/api/src/routes/support-admin.routes.js) | Backend presentation: replace static em dashes while preserving business and authorization rules. |
| [apps/api/src/scripts/seed.js](../../apps/api/src/scripts/seed.js) | Development: repair the exact partner fixture subscription without extending existing access. |
| [apps/api/tests/admin-support.integration.test.mjs](../../apps/api/tests/admin-support.integration.test.mjs) | Focused regression or fixture update for the changes described in the area reports. |
| [apps/api/tests/backend-copy.test.mjs](../../apps/api/tests/backend-copy.test.mjs) | Focused regression or fixture update for the changes described in the area reports. |
| [apps/api/tests/partner-dashboard-wiring.test.mjs](../../apps/api/tests/partner-dashboard-wiring.test.mjs) | Focused regression or fixture update for the changes described in the area reports. |
| [apps/api/tests/partner-production-readiness.test.mjs](../../apps/api/tests/partner-production-readiness.test.mjs) | Focused regression or fixture update for the changes described in the area reports. |
| [apps/api/tests/seed-subscription.integration.test.mjs](../../apps/api/tests/seed-subscription.integration.test.mjs) | Focused regression or fixture update for the changes described in the area reports. |
| [apps/web/app/layout.tsx](../../apps/web/app/layout.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/app/privacy-policy/page.tsx](../../apps/web/app/privacy-policy/page.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/app/solutions/energyvista/page.tsx](../../apps/web/app/solutions/energyvista/page.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/app/solutions/fuelvista/page.tsx](../../apps/web/app/solutions/fuelvista/page.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/app/solutions/genvista/page.tsx](../../apps/web/app/solutions/genvista/page.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/app/support/page.tsx](../../apps/web/app/support/page.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/components/admin-dashboard/DiscountApprovals.tsx](../../apps/web/components/admin-dashboard/DiscountApprovals.tsx) | Dashboard/auth presentation: replace static em dashes and missing-value labels without changing access rules. |
| [apps/web/components/auth/DemoAccountPanel.tsx](../../apps/web/components/auth/DemoAccountPanel.tsx) | Dashboard/auth presentation: replace static em dashes and missing-value labels without changing access rules. |
| [apps/web/components/auth/LogoutButton.tsx](../../apps/web/components/auth/LogoutButton.tsx) | Dashboard/auth presentation: replace static em dashes and missing-value labels without changing access rules. |
| [apps/web/components/auth/MFAUI.tsx](../../apps/web/components/auth/MFAUI.tsx) | Dashboard/auth presentation: replace static em dashes and missing-value labels without changing access rules. |
| [apps/web/components/auth/SuccessHonesty.tsx](../../apps/web/components/auth/SuccessHonesty.tsx) | Dashboard/auth presentation: replace static em dashes and missing-value labels without changing access rules. |
| [apps/web/components/auth/VerificationUI.tsx](../../apps/web/components/auth/VerificationUI.tsx) | Dashboard/auth presentation: replace static em dashes and missing-value labels without changing access rules. |
| [apps/web/components/careers/CareersPage.tsx](../../apps/web/components/careers/CareersPage.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/components/company-dashboard/CompanyModals.tsx](../../apps/web/components/company-dashboard/CompanyModals.tsx) | Company: shared date controls for filters, card identity and maintenance; copy/fixture compatibility. |
| [apps/web/components/company-dashboard/CompanyScreen.tsx](../../apps/web/components/company-dashboard/CompanyScreen.tsx) | Company: shared date controls for filters, card identity and maintenance; copy/fixture compatibility. |
| [apps/web/components/customer-dashboard/CardRequestModals.tsx](../../apps/web/components/customer-dashboard/CardRequestModals.tsx) | Customer: shared date of birth control and accessible plan exclusion icon. |
| [apps/web/components/customer-dashboard/CustomerFuelCheckout.tsx](../../apps/web/components/customer-dashboard/CustomerFuelCheckout.tsx) | Dashboard/auth presentation: replace static em dashes and missing-value labels without changing access rules. |
| [apps/web/components/customer-dashboard/CustomerModals.tsx](../../apps/web/components/customer-dashboard/CustomerModals.tsx) | Dashboard/auth presentation: replace static em dashes and missing-value labels without changing access rules. |
| [apps/web/components/customer-dashboard/CustomerScreen.tsx](../../apps/web/components/customer-dashboard/CustomerScreen.tsx) | Customer: subordinate screen headings and readable static copy. |
| [apps/web/components/dashboard/DashboardScreen.tsx](../../apps/web/components/dashboard/DashboardScreen.tsx) | Partner: primary headings, readable missing values and removal of an inactive payout control. |
| [apps/web/components/dashboard/StationDiscounts.tsx](../../apps/web/components/dashboard/StationDiscounts.tsx) | Partner: shared calendar/time controls with original API serialization. |
| [apps/web/components/landing/ClosingCta.tsx](../../apps/web/components/landing/ClosingCta.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/components/landing/Footer.tsx](../../apps/web/components/landing/Footer.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/components/landing/Header.tsx](../../apps/web/components/landing/Header.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/components/landing/Hero.tsx](../../apps/web/components/landing/Hero.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/components/landing/Pricing.tsx](../../apps/web/components/landing/Pricing.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/components/landing/ProductShowcase.tsx](../../apps/web/components/landing/ProductShowcase.tsx) | Public: responsive equal columns and factual product descriptions. |
| [apps/web/components/landing/Story.tsx](../../apps/web/components/landing/Story.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/components/shared/Calendar/Calendar.tsx](../../apps/web/components/shared/Calendar/Calendar.tsx) | Shared: accessible calendar/date/time interaction, bounds, keyboard navigation and draft state. |
| [apps/web/components/shared/Calendar/DateField.tsx](../../apps/web/components/shared/Calendar/DateField.tsx) | Shared: accessible calendar/date/time interaction, bounds, keyboard navigation and draft state. |
| [apps/web/components/site/CookieConsentBanner.tsx](../../apps/web/components/site/CookieConsentBanner.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/components/site/PageIntro.tsx](../../apps/web/components/site/PageIntro.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/components/site/SiteFooter.tsx](../../apps/web/components/site/SiteFooter.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/components/site/SiteHeader.tsx](../../apps/web/components/site/SiteHeader.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/components/solutions/SolutionPage.tsx](../../apps/web/components/solutions/SolutionPage.tsx) | Public: clearer factual copy, brand-consistent readability, responsive layout or metadata. |
| [apps/web/lib/calendar-date.ts](../../apps/web/lib/calendar-date.ts) | Shared: validate and serialize local calendar dates and date-times. |
| [apps/web/lib/mock/admin-data.ts](../../apps/web/lib/mock/admin-data.ts) | Dashboard/auth presentation: replace static em dashes and missing-value labels without changing access rules. |
| [apps/web/lib/mock/company-data.ts](../../apps/web/lib/mock/company-data.ts) | Dashboard/auth presentation: replace static em dashes and missing-value labels without changing access rules. |
| [apps/web/lib/services/client.ts](../../apps/web/lib/services/client.ts) | Shared: bounded 75-second transport and missing-value/mock copy; no automatic write retry. |
| [apps/web/tests/calendar-date.test.cjs](../../apps/web/tests/calendar-date.test.cjs) | Focused regression or fixture update for the changes described in the area reports. |
| [apps/web/tests/landing-test-report.test.cjs](../../apps/web/tests/landing-test-report.test.cjs) | Focused regression or fixture update for the changes described in the area reports. |
| [apps/web/tests/test-report-company.test.cjs](../../apps/web/tests/test-report-company.test.cjs) | Focused regression or fixture update for the changes described in the area reports. |
| [apps/web/tests/transport-regression.test.cjs](../../apps/web/tests/transport-regression.test.cjs) | Focused regression or fixture update for the changes described in the area reports. |
| [apps/web/tests/ui-copy.test.cjs](../../apps/web/tests/ui-copy.test.cjs) | Shared regression: detect literal, escaped and entity em dashes; preserve only exact legacy exclusion. |
