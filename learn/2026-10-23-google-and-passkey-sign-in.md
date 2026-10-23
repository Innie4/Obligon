# Google and passkey sign-in

> 2026-10-23 · Add Google login and a separate device passkey option.

## In short

Existing accounts can link Google and register passkeys after confirming their password. Both methods use the existing sessions, account permissions and two-factor authentication. The application stores public passkey information, never fingerprint or face data.

## What changed

- `apps/api/src/routes/auth-methods.routes.js`: configuration, enrollment, login and removal routes. `routes/auth.routes.js`: common session/MFA completion and stable Supabase identity checks.
- `apps/api/src/lib/google-identity.js`, `passkeys.js`, and `auth-method-proof.js`: Google token verification, WebAuthn ceremonies and current-method proofs.
- `apps/api/src/migrations/039_account_signin_methods.sql`: private identity, public-key and challenge tables. `apps/api/src/config/env.js` and `apps/api/.env.example`: provider and relying-party configuration.
- `apps/web/lib/auth-methods.ts`, `lib/services/client.ts` and `components/shared/AuthContext.tsx`: browser ceremonies, typed requests and protection against stale login responses.
- `apps/web/components/auth/AdditionalSignInMethods.tsx`, `GoogleIdentityButton.tsx`, `SignInOptions.tsx`, `AuthForms.tsx`, `AuthShell.tsx` and `LogoutButton.tsx`: login controls, the official Google button and password-confirmed management. `apps/web/app/auth/sign-in-options/page.tsx` and `components/site/routes.ts`: the shared route.
- Customer `CustomerShell.tsx`/`CustomerScreen.tsx`, company `CompanyShell.tsx`, admin `AdminShell.tsx`/`AdminSidebar.tsx` and partner `PartnershipSidebar.tsx`/`MobileDashboardNav.tsx`, under their existing component folders: management links for every dashboard.
- API tests `auth-method-settings.test.mjs`, `google-identity.test.mjs`, `auth-methods.integration.test.mjs`, `software-passkey.test.mjs`, `helpers/software-passkey.mjs` and `database-private-access.integration.test.mjs`: configuration, signatures, database races and private access. Web tests `additional-auth-methods.test.cjs`, `auth-method-ui.test.cjs` and `production-auth-navigation.test.cjs`: transport, callbacks, settings and navigation.
- Both app `package.json` files and `pnpm-lock.yaml`: maintained WebAuthn and JOSE libraries.

## How it works

1. Password-confirmed management creates a short-lived server challenge bound to the account and current session.
2. Google returns a signed identity token, or the authenticator signs the WebAuthn challenge after device verification.
3. The server verifies that proof and checks its exact origin, account state and deadline while holding database locks.
4. A successful login uses the existing TOTP step when enabled, then creates the normal session. Each challenge can complete once.
5. Removing a method revokes other sessions and pending authenticated proofs. The managing session remains available.

## Why it's built this way

Google's stable subject identifies the linked account. Email matching could attach a different identity to an existing account. Established libraries handle cryptographic formats; existing Obligon code continues to decide access.

## The concept worth knowing: a challenge

A challenge is like a numbered collection ticket valid for one visit. Knowing yesterday's ticket should not let someone collect again.

Precisely, the server stores a random, expiring value. Signed responses must contain that value, and a transaction consumes it once. The final deadline check also covers time spent waiting for database locks.

## Watch out for

Software signatures and isolated tests do not prove physical fingerprint, face, PIN or synced-device behavior. Actual Google-account acceptance and hosted deployment remain separate checks. Keep the RP domain stable, use trusted HTTPS origins, and obtain qualified review before release.

## Check yourself

1. Why can a matching Google email not link an account automatically?
<details><summary>Answer</summary>The verified issuer and subject identify the provider account. Local ownership still needs explicit password-confirmed linking.</details>

2. What if a challenge expires while waiting for a database lock?
<details><summary>Answer</summary>The final consumption check fails and rolls back sessions, counters, enrollment and audit writes.</details>

3. Why revoke other sessions when removing a passkey?
<details><summary>Answer</summary>Deleting its public key stops future login but would otherwise leave sessions created earlier usable.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
