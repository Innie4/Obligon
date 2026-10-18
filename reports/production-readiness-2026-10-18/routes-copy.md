# Routes and copy: 18 October 2026

Base revision: `877b5ea965de5ea5fd87e98ef98737a4688a2eee`; findings and checks apply to the current working changes. This is a scoped frontend review, not a claim that all production providers or role permissions have been accepted.

## Acceptance and verified results

- All 73 production page files are inventoried. The temporary `/calendar-qa` browser fixture is excluded and must be removed before shipping.
- All 183 statically resolvable local navigation, alias, page, public asset, and homepage/same-section anchor references resolve. No broken static target was found. There are 186 static references in total; the other three are external references.
- Seventeen local landing asset entries exist. Story category cards no longer use Facebook and LinkedIn logos as product icons.
- 61 dynamic link/redirect expressions are identified separately in the JSON evidence. Some use validated navigation records already counted; safe return URLs, notification destinations, provider checkout URLs, and runtime role redirects still require their existing behavioral tests and available live access.
- Focused existing web tests: **116 passed, zero failed, zero skipped**. This includes public controls, landing navigation/plans, customer controls/entitlements/card state, auth navigation/MFA, and company first-card form regressions. Log: `/tmp/obligon-route-copy-tests-18.log`.
- Scoped ESLint invocations exit successfully with zero errors. Pre-existing unused-symbol warnings remain in existing customer/auth files. A stale label expectation was updated from Our Solutions to Explore FuelVista while retaining the destination and arrow checks.
- `git diff --check` passes. No new dependency, API contract, account permission, subscription gate, or monetary behavior was introduced by this slice.

## Changes by page or dashboard

| Area | Concrete changes |
|---|---|
| Homepage hero | Two-line Your fuel / Your control headline; concrete individual/company fuel description; Get Started and Explore FuelVista links; existing navy/lime brand retained; decorative radial/blur layers removed. |
| Homepage about/story | Replaced unsupported tracking/delivery claims and vague innovation language with current card, budget, station, records, and enquiry functions. Existing lucide Fuel, Truck, Warehouse, CreditCard icons now represent their categories. Clearer heading sizes retain the existing layout. |
| Homepage product | Removed unsupported market-standard and instant-alert claims. Describes virtual-card controls, recorded purchases, plan-dependent partner discounts, and physical-card unavailability. Fixed the rigid 479px + 479px tablet grid by using responsive equal columns, so overflow-hidden no longer clips its children near 1024px. |
| Homepage pricing | Personal-inclusive Plans and Access heading, concrete organization enquiry actions, readable 13px minimum small labels. Excluded features use an accessible X icon and unchanged Not included text, replacing the emitted HTML em dash. Prices, plan features, tabs, and company contract requirement are unchanged. |
| Homepage header/footer/mission | Small navigation/footer labels increased to 13px, mission/vision copy names fuel management and partner coordination. Footer avoids broad innovation claims. |
| FuelVista page | Concrete fuel/card controls and partner purchase records replace governance/elite/disbursement wording. Existing operational modules and paths remain. |
| EnergyVista and GenVista pages | Supply and generator service enquiries explicitly require availability, scope, coverage, pricing, and service-term confirmation. Removed claims of working inventory forecasting, runtime telemetry, anomaly detection, and automated generator software. |
| Shared solution pages | Company enquiries and confirmed onboarding replace Enterprise Ready/deployment claims. FuelVista card artwork has an accurate illustration alt label on every solution page. |
| Careers | Describes actual fuel software work and hiring enquiries without revolution/ecosystem/radical-ownership claims. Recruitment forms remain unchanged. |
| Privacy banner, policy and metadata | Removed generator/fleet telemetry marketing claims. Banner describes sign-in/privacy storage; policy identifies voluntarily shared GPS, transaction records, and necessary device details. Consent controls remain unchanged. |
| Public Support | Email label and enquiry placeholder include personal customers as well as business contacts; submission behavior remains unchanged. |
| Customer overview, history, card, wallet, support, profile, notifications | Seven inner h1 elements become h2 while preserving styling and the CustomerShell page h1. Missing values use N/A; ticket labels and MFA/biometric guidance use ordinary punctuation. Budget help uses Month-to-Date wording. |
| Customer fuel checkout | Station/city/fuel option labels use middle-dot separators. Payment logic is unchanged. |
| Auth verification, signup success, logout, demo, MFA placeholders | Replaced emitted em dashes with ordinary sentences or masked placeholder dots. Partial code delivery accurately names the successful and failed channel. Password/MFA/session behavior is unchanged. |
| Admin discount review | Date range uses the word to rather than an em dash. Approval behavior is unchanged. |
| Mock dashboard descriptions and service messages | Replaced ecosystem/seamless filler and em-dash success/fallback text. Client request timeout changes in the shared file are owned and verified by the root task, not this slice. |

## Design rationale and inspector limits

All ten UI Reference Guide source summaries were considered. The selected local guidance was the existing Obligon React/Tailwind pattern plus the Design Taste accessibility reference: clear headings, relevant decorative icons, readable labels, semantic controls, responsive equal columns, and preserved keyboard behavior. No new visual library or runtime dependency was needed.

The automated public-page inspector is a visual heuristic. Its raw findings and screenshots are retained by the root task, including aesthetic failures that do not establish a broken user flow. Existing navy/lime branding, necessary pricing labels, feature comparison cards, and useful section content remain because they serve the product. No nonessential animation was added merely to satisfy an aesthetic score; existing reduced-motion support remains. Runtime errors, broken links, clipping, contrast, readability, and interaction failures are assessed separately with concrete evidence. This report does not label an unchanged heuristic score as a clean accessibility or performance audit.

## Final solution-page readability pass

After the root browser inspector found overlong solution headlines and undersized labels, the final pass shortened the headlines to Control fuel spending, Business fuel supply, and Generator support. The shared close now says Discuss your requirements with a mobile 30px size and desktop 36px size. Running solution body text is 16px; secondary labels are at least 13px. Hero metrics stack on phones so the labels remain readable instead of being compressed into three narrow cards; desktop keeps the three-column comparison. Shared header/footer labels and PageIntro eyebrows reach 13px, while global heading sizes remain unchanged. No photos, animation, dependencies, or commercial plan terms were added.

## Route inventory

| Area | Pages | Routes |
|---|---:|---|
| public | 13 | `/`, `/careers`, `/cookie-policy`, `/forgot-password`, `/login`, `/mechanic`, `/privacy-policy`, `/reset-password`, `/solutions/energyvista`, `/solutions/fuelvista`, `/solutions/genvista`, `/support`, `/terms-of-service` |
| auth | 12 | `/auth/company-invitation`, `/auth/failure`, `/auth/in-progress`, `/auth/login`, `/auth/logout`, `/auth/mfa/challenge`, `/auth/mfa/setup`, `/auth/session-expired`, `/auth/signup`, `/auth/success`, `/auth/verify-email`, `/auth/verify-phone` |
| customer | 12 | `/customer`, `/customer/card`, `/customer/fuel-checkout`, `/customer/notifications`, `/customer/profile`, `/customer/report-problem`, `/customer/stations`, `/customer/subscription`, `/customer/support`, `/customer/transaction-detail`, `/customer/transactions`, `/customer/wallet` |
| dashboard | 13 | `/dashboard`, `/dashboard/billing`, `/dashboard/card-verification`, `/dashboard/disputes`, `/dashboard/fuel-pricing`, `/dashboard/notifications`, `/dashboard/reports`, `/dashboard/settings`, `/dashboard/settlements`, `/dashboard/staff`, `/dashboard/station-profile`, `/dashboard/transactions`, `/dashboard/verify` |
| company | 13 | `/company`, `/company/billing`, `/company/cards`, `/company/maintenance`, `/company/notifications`, `/company/reports`, `/company/roadside`, `/company/settings`, `/company/stations`, `/company/support`, `/company/team`, `/company/transactions`, `/company/vehicles` |
| admin | 10 | `/admin`, `/admin/companies`, `/admin/discount-approvals`, `/admin/disputes`, `/admin/intake`, `/admin/login`, `/admin/operations`, `/admin/partner-applications`, `/admin/reports`, `/admin/staff` |


## Limits and blocked acceptance checks

- Static existence does not prove every runtime role, record state, provider redirect, or deployment setting. Root browser verification supplies available role/page evidence; unavailable accounts or provider operations must remain marked blocked. No live payment, customer profile change, support ticket, or production station mutation was performed by this slice.
- Existing organization plan promises such as network station counts, API integration, dedicated support, white-label access, and individual rewards/mechanics/towing/wash/lounge benefits require business and partner confirmation. The user previously approved these plan groupings; this task does not invent fulfilment evidence or silently change commercial terms.
- Exact cookie/analytics retention statements, optional tracker behavior, business registration assertions, and legal wording require actual provider configuration and qualified legal/privacy review. This slice removes unsupported telemetry marketing language but does not invent retention policy.
- One compatibility comparison in `customer-entitlements.ts` intentionally recognizes a legacy em-dash value as not included. It is not emitted copy and changing it could misclassify older API responses. Comments and user-provided content are outside the authored-copy replacement. The final 178-file authored-copy scan has no emitted em dash; only this compatibility comparison remains.
- The legacy unreferenced `AdminModals.AddStaffModal` contains a session-only simulated add path. No current caller/import was found, so this is not counted as the working persisted admin staff workflow and was not wired into production.
- Public browser screenshots, responsive acceptance, and whole-project build/tests are supplied by the root task. This report does not invent Lighthouse/Core Web Vitals scores or claim every physical device was tested.

## Files touched by this slice

- `apps/web/app/layout.tsx`
- `apps/web/app/privacy-policy/page.tsx`
- `apps/web/app/support/page.tsx`
- `apps/web/app/solutions/energyvista/page.tsx`
- `apps/web/app/solutions/fuelvista/page.tsx`
- `apps/web/app/solutions/genvista/page.tsx`
- `apps/web/components/admin-dashboard/DiscountApprovals.tsx`
- `apps/web/components/auth/DemoAccountPanel.tsx`
- `apps/web/components/auth/LogoutButton.tsx`
- `apps/web/components/auth/MFAUI.tsx`
- `apps/web/components/auth/SuccessHonesty.tsx`
- `apps/web/components/auth/VerificationUI.tsx`
- `apps/web/components/careers/CareersPage.tsx`
- `apps/web/components/customer-dashboard/CustomerFuelCheckout.tsx`
- `apps/web/components/customer-dashboard/CustomerModals.tsx`
- `apps/web/components/customer-dashboard/CustomerScreen.tsx`
- `apps/web/components/landing/ClosingCta.tsx`
- `apps/web/components/landing/Footer.tsx`
- `apps/web/components/landing/Header.tsx`
- `apps/web/components/landing/Hero.tsx`
- `apps/web/components/landing/Pricing.tsx`
- `apps/web/components/landing/ProductShowcase.tsx`
- `apps/web/components/landing/Story.tsx`
- `apps/web/components/site/CookieConsentBanner.tsx`
- `apps/web/components/site/SiteHeader.tsx`
- `apps/web/components/site/SiteFooter.tsx`
- `apps/web/components/site/PageIntro.tsx`
- `apps/web/components/solutions/SolutionPage.tsx`
- `apps/web/lib/mock/admin-data.ts`
- `apps/web/lib/mock/company-data.ts`
- `apps/web/lib/services/client.ts`
- `apps/web/tests/landing-test-report.test.cjs`


Evidence: `evidence/routes-static.json`, `evidence/copy-static.json`; focused test and lint logs listed above. Root task will write one consolidated Edirae Learn breakdown for the complete production-readiness task.
