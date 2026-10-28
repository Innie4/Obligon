# Make an existing user an administrator

> 2026-10-28 · Replace a registered user's previous role with selected administrator access.

## In short
The administrator popup now uses an existing registered email instead of creating another account. Conversion preserves the person's identity and account history, assigns the selected administrator role and pages, and ends their previous sessions.

## What changed
- `apps/api/src/routes/admin.routes.js`: `/staff` converts one existing account inside a database transaction and records `admin.staff_converted`.
- `apps/api/src/middleware/auth.js`: partner API keys require a current partner/mechanic role; `companyContext` rejects administrators.
- `apps/api/src/routes/auth.routes.js`: administrators receive no company contexts and cannot accept company invitations.
- `apps/api/src/routes/customer.routes.js`: the customer router rejects administrators; company card requests remain separate from administrator reviews.
- `apps/api/src/routes/support-admin.routes.js` and its integration tests: earlier tickets retain their recorded requester category after conversion.
- `apps/web/components/admin-dashboard/AdminScreen.tsx`: registered-email conversion popup, explicit consequences and success feedback; existing administrator editing is retained.
- `apps/api/tests/admin-user-conversion.integration.test.mjs`: real database tests cover preservation, permission checks, revoked access, competing requests and transaction rollback.
- `apps/api/tests/admin-access.integration.test.mjs`: converts a registered target; `apps/api/tests/api.smoke.test.mjs` rejects the former admin shortcut through customer card creation.
- `apps/web/tests/admin-staff-access-ui.test.cjs`: conversion payload, role/page requirements, errors and existing administrator editing.
- `reports/admin-user-conversion-2026-10-28/evidence/browser-fixture.mjs`: disposable local accounts with synthetic wallet/history and membership for browser checks; external providers are blocked.

## How it works
1. A Super Admin enters the registered email and selects a role and page permissions.
2. `/staff` validates the input, rechecks the acting administrator and locks the matching user. Missing, ambiguous, inactive, expired or already-admin accounts are rejected.
3. The same user ID receives `role='admin'`, `staff_role` and `staff_permissions`. Name, password, MFA, linked identities, financial records and membership rows are preserved.
4. The transaction revokes sessions and partner API keys, consumes MFA/reset proofs and bound sign-in challenges, and records the audit. Any failure rolls everything back together.
5. The user signs in again using their existing credentials. Current-role checks prevent reopening their previous customer or company workspace.

## Why it's built this way
Updating the existing identity avoids duplicate accounts and detached history. Retaining membership and financial records preserves evidence; explicit role checks prevent those preserved records from granting former workspace access. Database locks serialize competing conversions instead of trusting browser state.

## The concept worth knowing: atomic changes
Think of changing a building pass: the new permissions and withdrawal of the old pass must happen together. A database transaction makes conversion, revocation and audit one committed result. If audit insertion fails, the account remains in its original state rather than receiving an unrecorded privilege change.

## Watch out for
Conversion does not cancel subscriptions, move funds or delete organization ownership. Older application versions may lack the new role restrictions, so deployment rollback needs review; database rollback after an error is different from reverting deployed code. Focused UI regressions passed; use the release report for final combined API, build, browser and deployment evidence. No real funds or production accounts belong in destructive tests.

## Check yourself
1. Why preserve the user ID instead of inserting another administrator?
   <details><summary>Answer</summary>History, credentials and linked identities already refer to that ID. Reusing it keeps those relationships intact.</details>

2. What if saving the audit record fails?
   <details><summary>Answer</summary>The transaction rolls back role changes and revocations, leaving no partially converted account.</details>

3. Why reject company access when membership rows still exist?
   <details><summary>Answer</summary>Preservation is not permission. The user now operates as an administrator and must not inherit their former workspace access.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

---
*Made with Edirae Learn · edirae.com*
