# Clearer tasks across Obligon

> 2026-10-24 · Refine public pages and all dashboards, verify, and release.

## In short
The interface now brings each page’s main task forward on phones. Long forms have section links, plan comparison takes less space, and empty or failed requests retain useful recovery controls. The existing payment and server authorization paths stay in place.

## What changed
Paths below are under `apps/web/`; the complete source list is in `reports/ui-excellence-2026-10-24/source-manifest.json`.

- `app/globals.css`: anchor offsets; `app/admin/login/page.tsx`: phone spacing and main heading; `app/auth/logout/page.tsx`: visible progress popup.
- `components/landing/Header.tsx`, `Hero.tsx`, `Story.tsx`, `Pricing.tsx`, `ClosingCta.tsx`, `Footer.tsx`: clearer hierarchy, compact plan comparison and readable footer text.
- `components/solutions/SolutionPage.tsx`: compact mobile facts and specific headings across all three solutions.
- `components/auth/AuthForms.tsx`, `AuthShell.tsx`: task headings and compact account choices. `AdditionalSignInMethods.tsx`, `SignInOptions.tsx`: availability wording. `AuthStatus.tsx`: popup recovery cannot disappear into a blank page. `SuccessAutoRedirect.tsx`: stable first render.
- `components/shared/SubscriptionPanel.tsx`: compared and purchased plans stay distinct, with full benefits. `States.tsx`: optional compact summaries preserve full-size defaults.
- `components/customer-dashboard/CustomerScreen.tsx`, `CustomerShell.tsx`: headings, phone records, wrapping receipts, neutral spend styling, compact summaries, persistent filters and section links. `CustomerAccess.tsx`: non-dismissible checks and direct sign-in recovery without changing access gates. `CustomerTheme.tsx`: focusable section destinations. `CustomerFuelCheckout.tsx`: section targets and readable empty copy.
- `components/dashboard/DashboardScreen.tsx`, `StationDiscounts.tsx`: compact metrics and existing-role edit affordances. `StationProfileForm.tsx`, `WorkshopDashboard.tsx`: section links and two Save controls sharing one form.
- `components/company-dashboard/CompanyScreen.tsx`, `CompanyShell.tsx`: phone controls, contextual empty records and consistent active navigation.
- `components/admin-dashboard/AdminBenefits.tsx`, `AdminScreen.tsx`, `DiscountApprovals.tsx`, `IntakeConsole.tsx`, `OperationsInbox.tsx`: safe wrapping, labelled controls, compact queue selection and selected-ticket semantics.
- Tests changed: `admin-queue-states`, `admin-screen-loading`, `auth-method-ui`, `company-admin-ui-polish`, `customer-my-card`, `landing-plans-regression`, `partner-audit-regression`, `partner-subtype-workshop`, `production-auth-navigation`, `production-customer-controls`, `station-profile-form`, `ui-dashboard-polish`, and new `subscription-comparison`, all `.test.cjs` under `tests/`.

## How it works
1. A role opens its existing route and receives the existing server-controlled state.
2. Phone layouts group related values; section links move focus to the requested content.
3. Plan preview changes only comparison state. An explicit purchase still sends the clicked `planCode` through the original handler.
4. Form buttons share the same submit handler and validation. Loading/error popups keep retry or cancellation available.
5. Authentication success first renders the same loading markup on server and browser, then shows the resolved session destination.

## Why it’s built this way
Native links, disclosures and form submission preserve keyboard behavior and existing validation. New navigation frameworks and duplicate checkout flows would add risk without helping these tasks.

## The concept worth knowing: presentation state
A shop display can show a different product without changing your basket. Likewise, comparing a plan must not change your active subscription or start a purchase. `SubscriptionPanel` keeps those values separate, and regression tests check the exact checkout payload.

## Watch out for
Automated accessibility checks do not replace screen-reader or physical-device testing. Provider availability still affects issuing, BVN and SMS. Live notification email also failed because the Resend sender domain is unverified. The map’s WebGL canvas can appear blank in full-page screenshots while rendering correctly in an ordinary viewport; inspect the visible map before changing its sizing.

## Check yourself
1. Why keep preview and purchased plan separate?
<details><summary>Answer</summary>Browsing must not charge or modify an account. Only the explicit action chooses the purchase payload.</details>

2. What if each Save button had its own handler?
<details><summary>Answer</summary>Validation and duplicate-request protection could diverge. Both buttons submit the same form.</details>

3. Why keep filters visible when there are no results?
<details><summary>Answer</summary>The user needs them to clear the condition causing the empty result.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that’s the part to reread.

---
*Made with Edirae Learn · edirae.com*
