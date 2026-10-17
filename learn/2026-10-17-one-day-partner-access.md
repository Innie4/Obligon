# One day partner dashboard access

2026-10-17 · Prepare a fixed 24-hour inspection login for the existing partner test account.

## In short

Temporary access now has a database deadline rather than relying on a subscription ending or a scheduled cleanup. Normal password checks still apply, and the shared account can inspect its dashboard without creating lasting business changes. Production activation requires review first.

## What changed

- `apps/api/src/migrations/033_account_access_expiry.sql` adds nullable `users.access_expires_at`; `lib/accountAccess.js` checks it.
- `apps/api/src/lib/temporaryPartnerAccount.js` grants one explicit lease, preserves existing station details, rejects financial activity, and keeps restarts from renewing it.
- `apps/api/src/scripts/grant-partner-test-access.js` previews by default and reads the password only from protected environment input when explicitly applied.
- `apps/api/src/middleware/auth.js` checks expiry for sessions/API keys and restricts this leased identity to reads.
- `apps/api/src/routes/auth.routes.js` checks login/MFA/refresh and caps durable sessions. Temporary login keeps its local password without creating a permanent provider identity.
- `apps/api/src/lib/sse.js` ends realtime connections at the deadline and avoids writes after closure.
- `apps/api/tests/account-access.test.mjs`, `partner-test-expiry.integration.test.mjs`, and `sse-access-expiry.test.mjs` cover expiry, isolation and concurrency.

## How it works

1. The operator previews the existing identity, then uses the reviewed command to apply access.
2. A transaction locks the exact account and organization. Conflicting ownership, MFA/provider credentials, funds or financial records stop activation.
3. The password is hashed, old sessions/keys are revoked, automatic settlement is disabled, and the database records a deadline exactly 24 hours after the grant starts.
4. Login still verifies the password. Sessions and refresh tokens cannot outlive that deadline.
5. Every authenticated request checks the account deadline. Existing realtime connections close at expiry. Restarting preserves the original deadline and never grants another day.

## Why it's built this way

An expiring subscription still allows account/settings access. A timer also cannot reliably enforce expiry while a free hosting instance sleeps. The database deadline works independently of both. A read-only shared account cannot create another staff identity or API credential that survives its lease.

## The concept worth knowing

**Simply put:** this is a visitor pass with a printed checkout time. Leaving and re-entering the building does not issue another day.

**Precisely:** an absolute timestamp is persisted once. Authorization compares current time against it on each request. Access JWTs retain their ordinary encoded lifetime, but database checks reject them after the account cutoff; possession of an unexpired token alone is insufficient.

## Watch out for

Local tests use synthetic accounts and disposable PostgreSQL. They do not prove production activation. Qualified review, deployment, the explicit grant and live login must finish before claiming these credentials work. Existing non-expiring accounts keep a null deadline. Rollback should suspend the test account and revoke sessions before removing the new expiry enforcement.

## Check yourself

1. Why does ending the subscription not end access?
   <details><summary>Answer</summary>Some dashboard/account routes intentionally remain available without a paid subscription. Account authorization needs its own deadline.</details>

2. What if the API restarts halfway through the day?
   <details><summary>Answer</summary>The stored deadline remains unchanged. Startup preserves the remaining access rather than calculating another 24 hours.</details>

3. Why block staff and API-key creation?
   <details><summary>Answer</summary>Those could create access that outlives the shared account. Inspection access needs no such lasting effects.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
