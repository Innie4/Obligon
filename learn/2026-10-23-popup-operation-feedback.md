# Floating operation feedback

> 2026-10-23 · Show temporary loading, pending and failure messages in floating popups.

## In short

Requests now explain their progress and failures in floating cards across public pages and dashboards. Forms keep their field validation, recorded outcomes and existing submission rules.

## What changed

Paths below start at `apps/web/`. The linked manifests enumerate the individual changed files.

- `components/shared/StatusPopup.tsx` adds cards, grouping and cleanup. `States.tsx`, `Dialogs.tsx` and `ErrorBoundary.tsx` use them; `StationMap.tsx` floats map loading/failure. `Toast.tsx` and `Providers.tsx` bind notifications to the current account/company. See the [foundation manifest](../reports/popup-feedback-2026-10-23/foundation-receipt.json).
- `components/auth/`: AuthForms, AdditionalSignInMethods, GoogleIdentityButton, SignInOptions, CompanyInvitation, AuthGuard, VerificationUI, MFAUI, SuccessHonesty, SuccessAutoRedirect, AuthStatus, DemoAccountPanel and LogoutButton use transient feedback. See the [auth/public manifest](../reports/popup-feedback-2026-10-23/auth-public-receipt.json).
- `app/`: admin/login, auth/session-expired, forgot-password, reset-password and support pages; `components/careers/CareersPage.tsx` and `components/site/CookieConsentBanner.tsx` show request feedback. The same auth/public manifest records their files.
- `components/admin-dashboard/`: AdminModals, AdminScreen, CardApprovalQueue, DiscountApprovals, IntakeConsole, OperationsInbox and RecoveryReview; `company-dashboard/`: CompanyContextSelector, CompanyModals and CompanyScreen; `customer-dashboard/`: CardRequestModals, CustomerFuelCheckout, CustomerModals and CustomerScreen; `dashboard/`: DashboardScreen, PartnerApiKeys, PartnerServiceRequests, PartnerSubscriptionGate, PartnerVerification, StationDiscounts, StationLocationPicker, StationProfileForm and WorkshopDashboard replace temporary background messages. See the [dashboard manifest](../reports/popup-feedback-2026-10-23/dashboard-consumers/source-hashes.json).
- `tests/status-popup.test.cjs`, `production-shared-state.test.cjs`, `station-map-states.test.cjs`, `dashboard-floating-feedback.test.cjs` and `helpers/status-popup.cjs` cover the shared behavior and isolated consumers. Existing tests listed in the manifests now inspect popup feedback.

## How it works

1. A component renders `StatusPopup` while its existing request state needs feedback.
2. An effect registers it with `StatusPopupProvider`. A portal renders the card inside the nearest dialog, or the document body. It neither opens another modal nor moves focus.
3. Each host shows at most two ordinary cards and one progress card. Equal messages group only when their actions also match.
4. Settlement or owner removal clears the card. Dismissal hides feedback without cancelling the request. Retry invokes the existing callback only when clicked.
5. `SessionToastScope` derives identity from user, role and organization. Switching identity clears toasts and rejects callbacks captured by an earlier scope, while mounted request popups keep their own lifetime.

## Why it's built this way

Shared cards preserve existing operations and avoid separate notification implementations. Dialog portals keep retry/dismiss controls inside the existing focus boundary. Validation stays beside inputs; authorization codes and recorded business statuses remain in context.

## The concept worth knowing: ownership

Think of a queue ticket: removing its display does not finish the job. Precisely, request state owns popup lifetime; component cleanup unregisters it. Toast callbacks additionally carry an identity token, preventing a delayed old-account message from appearing after a switch.

## Watch out for

The dashboard receipt records 361 passing focused cases. This note does not establish deployment or provider readiness. Test keyboard access inside dialogs, account switches during delayed requests, long messages and mobile overlap. Dismissing an error must never imply payment success or trigger a retry.

## Check yourself

1. Why does Retry leave dismissal to the owner?
   <details><summary>Answer</summary>A retry can fail again or leave state unchanged. Hiding the error first would remove useful recovery feedback.</details>

2. What if an old account's request finishes after switching company?
   <details><summary>Answer</summary>Its captured toast scope no longer matches, so the provider rejects that notification.</details>

3. Why render a popup inside its owning dialog?
   <details><summary>Answer</summary>The existing focus boundary contains its controls, so keyboard users can reach Retry and Dismiss.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

---
*Made with Edirae Learn · edirae.com*
