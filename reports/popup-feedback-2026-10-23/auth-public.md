# Auth and public popup feedback

Transient request loading, pending, and errors now use the shared nonmodal `StatusPopup`. This increment changes presentation and removes duplicate error feedback. It preserves all request calls, input-validation rules, verification gates, server-role checks, return destinations, and session freshness guards.

## Coverage

- Customer, partner, company, and admin password sign-in/signup: pending feedback and server errors. The previous login/signup error had a modal, toast, and background message; it now has one floating error.
- Google/passkey sign-in and sign-in management: configuration, SDK initialization, prompts, method updates, failure, and notice feedback. Retry remains available for Google loading failures.
- Protected-route guards, invitation reads/acceptance, authenticator setup/challenge, account verification/code sends, and session-success redirects. No OTP, password, private key, QR contents, or backup codes are passed to feedback.
- Admin sign-in, expired-session sign-in, password reset requests and password updates. Field validation remains beside its associated inputs.
- Public careers: initial data loading, retryable data errors, application submission and failures. Application fields survive failure. Cookie-consent saves and support submissions show pending feedback. Demo sign-in and logout also show request progress.
- Dedicated authentication progress/failure routes use popup feedback with real cancel/login/support/retry actions. Confirmed account verification and actual invitation status remain page content because those describe records rather than request progress.

## Verification

146 focused existing/new tests passed across eight files. Fresh TypeScript and `git diff --check` passed. Assertions cover popup loading/pending lifecycle, duplicate-prompt protection, password challenge/session/role ordering, invitation return paths and verification rules, provider errors, preserved drafts and retry. Logs are `/tmp/auth-popup-*-tests23.log` and `/tmp/auth-popup-ts23-final.log`.

Browser rendering and production delivery are handled by the parent task. No deployment was attempted by this worker. Root task owns the single Edirae Learn note for the combined popup increment.

## Files

- `apps/web/components/auth/AuthForms.tsx`
- `apps/web/components/auth/AdditionalSignInMethods.tsx`
- `apps/web/components/auth/GoogleIdentityButton.tsx`
- `apps/web/components/auth/SignInOptions.tsx`
- `apps/web/components/auth/CompanyInvitation.tsx`
- `apps/web/components/auth/AuthGuard.tsx`
- `apps/web/components/auth/VerificationUI.tsx`
- `apps/web/components/auth/MFAUI.tsx`
- `apps/web/components/auth/SuccessHonesty.tsx`
- `apps/web/components/auth/SuccessAutoRedirect.tsx`
- `apps/web/components/auth/AuthStatus.tsx`
- `apps/web/components/auth/DemoAccountPanel.tsx`
- `apps/web/components/auth/LogoutButton.tsx`
- `apps/web/app/admin/login/page.tsx`
- `apps/web/app/auth/session-expired/page.tsx`
- `apps/web/app/forgot-password/page.tsx`
- `apps/web/app/reset-password/page.tsx`
- `apps/web/app/support/page.tsx`
- `apps/web/components/careers/CareersPage.tsx`
- `apps/web/components/site/CookieConsentBanner.tsx`
- `apps/web/tests/auth-method-ui.test.cjs`
- `apps/web/tests/production-company-invitations.test.cjs`
- `apps/web/tests/mfa-password-proof.test.cjs`
- `apps/web/tests/success-honesty.test.cjs`
- `apps/web/tests/production-auth-navigation.test.cjs`
- `apps/web/tests/production-public-controls.test.cjs`
