# Backend verification and corrections

18 October 2026. Base source revision: `877b5ea965de5ea5fd87e98ef98737a4688a2eee`.

## Result

The final complete API suite passes **1,070 tests, zero failures and zero skips**. This includes 13 HTTP smoke cases using the actual API, all database integration suites using disposable local PostgreSQL 18, and the existing payment, session, tenant and migration regression cases. External provider calls in financial tests use controlled fixtures. These results do not establish real provider acceptance or complete production readiness. [Verification receipt and changed-source hashes](evidence/api-verification.json).

No application payment rules, authentication rules, tenant boundaries, database migrations or hosted records were changed in this work. Authentication and financial route files have presentation-string corrections only. The two functional corrections concern a public application form and development-only seed data.

## Ranked findings and changes

### 1. Partner demo accounts could sign in but could not open their dashboard

**Fixed.** A fresh `seed.js` created the partner organization with an active badge but created a durable subscription only for the company organization. The real partner subscription gate correctly returned 403 for partner reads. Four existing HTTP smoke cases failed for this reason.

`apps/api/src/scripts/seed.js` now supplies the existing Enterprise catalog plan to the exact synthetic partner fixture. The helper runs for fresh and existing seeds. `ON CONFLICT DO NOTHING` preserves an existing subscription and its dates; repeating the seed never extends access. The existing production refusal guard is unchanged. The new regression creates its own schema, runs a fresh seed, repeats it, deletes only its synthetic subscription, and verifies repair. No production subscription is created, granted or renewed.

### 2. A blank careers email was accepted and saved

**Fixed.** `POST /api/public/jobs/apply` checked the email format only when the email field was truthy. An empty string passed the earlier type/length checks, returned 200 and wrote an application without a usable reply address. An isolated HTTP/PostgreSQL regression reproduced that exact result before the correction.

`apps/api/src/routes/public.routes.js` now applies the existing email-format check unconditionally. The focused regression verifies empty, whitespace-only and malformed addresses return 400 before any application or queued-email write. Valid JSON and multipart applications continue to pass the existing integration tests.

### 3. Server-generated interface text still contained em dashes

**Fixed for static runtime copy.** Presentation strings in customer, company, partner, admin and public responses, notification/email subjects, PDF labels and operational diagnostics now use ordinary wording, punctuation or `Not available`. Existing legacy plan values that use an em dash to mean an excluded feature remain accepted internally. This does not rewrite user-entered text or existing hosted database content.

The new `backend-copy.test.mjs` parses JavaScript literals rather than comments, so documentary comments do not trigger false positives. It permits only the two existing legacy-feature comparisons. It excludes migration history and maintenance scripts. No claim is made that a word blacklist can detect every vague or promotional phrase.

### 4. API regression tests still required the superseded mobile logout layout

**Fixed.** The previous test required a mobile Logout button directly in the partner shell, although the prior approved mobile navigation change moved logout into the Account menu. It now verifies that the header renders `MobilePartnerAccount`, the menu is mobile-visible and it contains the actual `LogoutButton`. Related POS fallback and direct-settlement copy assertions now match the current interface; they still reject new manual payout submission controls.

## Files changed

| Files | Change |
| --- | --- |
| `apps/api/src/scripts/seed.js` | Adds the exact synthetic partner subscription without extending existing periods. |
| `apps/api/src/routes/public.routes.js` | Rejects empty applicant email before writes; edits emitted copy. |
| `apps/api/src/routes/admin.routes.js`, `auth.routes.js`, `company.routes.js`, `customer.routes.js`, `intake-admin.routes.js`, `partner.routes.js`, `subscription.routes.js`, `support-admin.routes.js` | Presentation strings only. Existing authorization and money logic remain unchanged. |
| `apps/api/src/lib/mailer.js`, `notify.js`, `pdf.js`, `sms.js` | Email, receipt and diagnostic wording only. |
| `apps/api/src/config/env.js`, `apps/api/src/index.js` | Diagnostic wording only. |
| `apps/api/tests/backend-copy.test.mjs` | New parsed-literal copy regression. |
| `apps/api/tests/seed-subscription.integration.test.mjs` | New disposable-schema seed consistency and repeatability regression. |
| `apps/api/tests/admin-support.integration.test.mjs` | New HTTP and database no-write regression for invalid applicant email. |
| `apps/api/tests/partner-dashboard-wiring.test.mjs`, `partner-production-readiness.test.mjs` | Revalidate current payout copy, POS fallback and mobile logout placement. |

## Verification evidence

| Check | Observed result | Local evidence |
| --- | --- | --- |
| Fresh disposable database migrations | All 33 migrations applied successfully | `/tmp/obligon-readiness-18-pg/migrations.log` |
| Initial full baseline with database suites | 1,067 cases; 1,050 passed, two failed and 15 skipped | `/tmp/obligon-readiness-18-api-baseline.log` |
| Initial migration failure isolated | Five passed, zero failed and zero skipped | `/tmp/obligon-readiness-18-migration-isolated.log` |
| Complete suite with HTTP smoke before seed correction | Four HTTP failures exposed the absent partner fixture subscription | Earlier run diagnosed before the final log was replaced |
| Blank applicant email reproduction | HTTP 200 where 400 was required | `/tmp/obligon-readiness-18-careers-red.log` |
| Focused public/admin/upload/copy/seed checks | 67 passed, zero failed and zero skipped | `/tmp/obligon-readiness-18-focused-final.log` |
| Final full API suite after both functional corrections | **1,070 passed, zero failed and zero skipped** | `/tmp/obligon-readiness-18-api-final.log` |
| Diff whitespace check | Passed | `git diff --check -- apps/api` |

The complete run used `node --test --test-concurrency=4 tests/*.test.mjs`, explicit `NODE_ENV=test`, `DOTENV_CONFIG_PATH=/dev/null`, the dedicated localhost database and the local QA API. Four workers avoid oversubscribing this workstation. The first unrestricted run had one migration-fixture connection terminated during cleanup; the isolated five-case migration run and the final bounded full run both passed. No production migration or production test-data cleanup occurred.

The temporary QA API runs at `http://127.0.0.1:4418`. Its database is disposable and listens only on localhost. The root `.env` is gitignored, mode 0600, and contains only local fixture configuration and newly generated JWT secrets. It has no hosted provider credentials. Payment simulation is disabled, provider handling is strict, email and SMS use local delivery, the business timezone is Africa/Lagos and the scheduler is disabled. Browser checks must use the synthetic test accounts. Secrets and connection-string values are intentionally omitted here.

## Production checks still requiring external evidence

1. **Provider and issuer acceptance.** Real configured Flutterwave, any retained Paystack, Sudo, Resend and Termii accounts must be verified in their actual sandbox/production environments. A free account or API key does not establish issuer approval, funded settlement accounts, sender-domain approval, SMS sender approval, bank/merchant bindings or reconciliation. Local tests cannot replace these checks.
2. **Hosted database and recovery.** The local migration and permission suites pass. Actual hosted roles, grants, ownership, backup restoration and recovery procedures still need hosted evidence. No hosted database inspection or permission mutation was performed by this worker.
3. **Financial operations.** Production provider/bank reconciliation, treatment of uncertain effects, alert delivery and responsible operators require operational acceptance. The previous production-readiness report also calls for qualified review of complete financial accounting and counterparty records. This worker did not redesign the ledger or claim that a green API suite provides that review.
4. **Deployment identity and devices.** The parent audit verified the current live health contract separately in `evidence/live-health.json`. This worker does not infer commit identity from a health response. Actual hosted role/account/device states, issuer actions and physical GPS accuracy remain separate acceptance checks.

No language rewrite or new service framework was introduced. The existing Node/Express/PostgreSQL application already has bounded provider calls, connection pooling, transactional migrations and focused recovery tests. A speculative rewrite would not resolve missing provider or operational evidence.
