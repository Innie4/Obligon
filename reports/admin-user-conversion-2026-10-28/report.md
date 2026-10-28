# Existing-user administrator conversion

28 October 2026. Base: `093bc86750482e62e08a134141ae937f7d144dd9`. Source/test patch SHA-256: `2794d6be400822584ebcaef1787ad0594d4fd77d82e971a6cbfcc4e3c8252831`. The user requested existing-account role replacement, testing, push and deployment. Their qualification and release authorization are recorded in this conversation. No real account was converted during QA.

## Result

`POST /api/admin/staff` now converts an existing registered user in place. It does not insert another user, generate a temporary password or email credentials. The popup asks for the registered email, required administrator role and selected pages. The prior Full name field is removed so existing identity details cannot be overwritten. Existing administrators continue to use Review record to edit their access.

- The same user ID, name, email, password, provider identity, MFA, enrolled sign-in methods, contact verification and profile are preserved.
- The primary account role becomes `admin`; selected `staff_role` and `staff_permissions` replace former account access. Sessions, partner API keys, pending MFA/password-reset proofs and account-bound enrollment/link challenges are revoked or consumed atomically with an attributable `admin.staff_converted` audit.
- Super Admin plus Staff page access is required and rechecked under the existing manager transaction lock. Matching users are locked. Ten simultaneous conversions produce one successful conversion/audit; later calls receive an already-admin conflict.
- Unknown emails return 404 without creating an account. Casefold-ambiguous legacy emails and already-admin accounts return 409. Inactive, expired and reserved shared testing identities cannot be promoted. Account deadlines and verification are never silently reset.
- Converted admins cannot reuse customer subscriptions/onboarding APIs, select former company contexts, accept company invitations or authenticate partner integration keys. The same role checks also protect direct API calls and company owners without membership rows. Existing non-admin company workflows remain unchanged.
- Company ownership, memberships, wallets, ledger rows, transactions and subscriptions are retained. Conversion does not transfer funds, refund/cancel subscriptions or assign a new company owner. Earlier support tickets retain the original requester's recorded category instead of turning Unknown when their user becomes an admin.

## Acceptance evidence

| Check | Outcome |
| --- | --- |
| Initial reproduction | Existing-user conversion failed with 400 before implementation; `evidence/admin-access-red.log`. |
| Conversion regression | **15 passed**, zero failures/skips; `evidence/admin-user-conversion-final.log`. Covers all four former roles, identity/credential/history preservation, old sessions/refresh, pending proofs, denied former workspaces, reserved identities, valid API key before conversion and denial after revocation/reactivation, atomic audit rollback and ten competing requests. |
| Adjacent API checks | **121 other tests passed**, zero skips, in `evidence/conversion-and-adjacent-green.log` alongside the then-14 conversion cases. They cover existing administrator grants, company invitations/membership/workflows, partner scope and sign-in methods. The last conversion-only run adds the fifteenth case and strengthens API-key proof; unchanged adjacent tests were not needlessly repeated. |
| Support regression | **60 passed**, zero failures/skips; `evidence/support-origin-final.log`. Red evidence demonstrates the category changed to admin without the fix; messages by other authors or later roles cannot replace the original author's category. |
| Full web suite | **761 passed**, zero failures/skips; `evidence/web-final.log`. |
| Production frontend build | **Passed**, including type/lint checks, `evidence/build-final.log`. Existing warnings are not represented as zero warnings. No web source changed after this build. |
| Source checks | `git diff --check` passed. No dependencies, migrations, CI changes or production environment edits. |

These are **196 distinct affected API checks across the listed runs**, rather than a claim of one full-repository API run. The legacy seeded-server smoke suite was updated for the intentional admin denial but was not executed against production; no destructive tests or real provider/fund movement were used.

## Browser verification

Used the actual local app/API with isolated PostgreSQL and synthetic accounts; external provider calls were disabled. An unknown email produced a centered error and retained the form. A registered customer was converted to Supervisor with Operations and Reports. The success popup confirmed reassignment; the same original credentials then opened Operations, with only the selected navigation. Opening the actual `/customer` route returned to the assigned admin workspace.

Read-only database checks confirmed the same user ID/name, unchanged wallet balance, preserved wallet/ledger/transaction/membership identifiers and one conversion audit (`evidence/browser-database-verification.json`). Desktop and 320 CSS-pixel form states were inspected without horizontal overflow; controls remain reachable by scrolling. Screenshots record both top/bottom form states rather than claiming every field fits in one phone viewport.

Chrome's local development console reported body-attribute hydration differences containing extension-added `__processed_...` attributes. This was kept separate from application behavior; the patch does not suppress hydration diagnostics globally. The deliberately invalid email produced the expected API rejection. No universal design score or end-to-end payment readiness is claimed.

## Review and release

Independent source review found the customer API role gap and historical support-category regression; both were fixed with failing reproductions before release. Root reviewed the delegated UI/tests and final SQL. Previous company ownership and balances remain preserved but no longer grant their former operator access; any ownership transfer is a separate, deliberate business action.

Push the reviewed source to master and record exact Vercel/Render revision/status plus live read-only UI results in `release-receipt.md`. Do not convert a real production user merely to test this release. The source inventory is `source-manifest.txt`; the complete source/test diff and its hash are saved locally before commit.

Recovery: prefer a forward correction retaining the new role gates and revocation logic. Reverting to the old API permits admin accounts with retained customer/company records to use those old APIs and changes Add administrator back to creating accounts. Already-revoked sessions cannot be restored by a code rollback; users can sign in with retained credentials. No destructive schema rollback is needed, and no automatic reverse role conversion or money movement is included.
