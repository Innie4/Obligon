# Contact verification implementation and release review

Date: 20 October 2026

Status: implemented and tested locally with real email delivery. Production release has not occurred. Nigerian SMS receipt remains unconfirmed.

## Result

Signup requests both email and SMS codes. Confirming either completes account verification. The remaining contact stays unverified and can be confirmed later. Customer and partner verification screens now describe that rule and allow continuation after one proof.

This changes completion semantics without adding a new dashboard authorization gate. Company invitations still require verified email; enabling SMS alerts still requires verified phone. Company contract approval, organization membership, role permissions, card rules and MFA remain independent.

`accountVerified` means email OR phone. `allVerified` still means both. Signup retains the eligible `verificationRequired` channel list and adds `verificationMode: "any"` to make the rule explicit.

## Provider setup

Descope Free was configured through the user's Chrome session. The user completed signup/agreement acceptance and approved creation of a project-scoped Authentication credential with a 90-day lifetime. No billing or payment card was added. The credential is stored only in the ignored server `.env`, with file permissions 0600, and is absent from the review patch and browser assets.

The published free allowance is 100 SMS/voice deliveries per month and 1,000 emails per day. This is capped service, not unlimited verification. Provider acceptance does not guarantee inbox or handset delivery. Public OTP API access remains disabled; the backend authenticates its provider requests. The configured code lifetime is ten minutes.

Official sources are linked in [the integration guide](../../docs/contact-verification.md). General transactional email and SMS continue through the existing Resend/Termii paths; this integration handles contact verification only.

## Application changes

| Area | Files | Behavior |
|---|---|---|
| API provider | `apps/api/src/lib/descope-verification.js` | Send/check managed codes, normalize Nigerian contacts, require matching channel and contact, reject test-user proof, bound response reads and discard provider sessions. No automatic POST retry. |
| Challenge storage | `apps/api/src/migrations/034_contact_verification_provider.sql` | Add provider and destination to verification records. Preserve existing local challenges, table permissions and RLS. |
| Auth and profile | `apps/api/src/routes/auth.routes.js`, `customer.routes.js` | Bind proof to the issued challenge, retain durable limits and single consumption, expose either-contact completion, and keep individual flags truthful. |
| SMS compatibility | `apps/api/src/lib/sms.js` | Normalize Nigerian domestic and bare mobile numbers for Termii, retain explicit international formats, and refuse malformed destinations before network access. |
| Configuration | `apps/api/src/config/env.js`, `.env.example`, `README.md` | Select the verification provider, keep secrets server-side, and distinguish configured verification from general messaging. |
| Shared verification | `apps/web/components/auth/VerificationUI.tsx`, `SuccessHonesty.tsx` | Show completion after one proof, preserve invitation email requirements, and offer optional second-contact verification. |
| Partner verification | `apps/web/components/dashboard/PartnerVerification.tsx` | Apply the same completion rule and optional second-contact action. |
| Client contract | `apps/web/lib/services/client.ts`, `types.ts` | Submit the selected channel and carry account completion without falsifying contact status. |
| Regression coverage | API verification/provider/SMS/configuration tests; existing invitation and temporary-partner tests; web partner/invitation/client tests | Cover separate proofs, failures, replay, concurrency, role states, invitations and optional verification. |

Already completed accounts do not automatically trigger new sends on entering verification. Switching channels clears stale input and errors. Opening optional verification cancels pending dashboard navigation, including on unmount.

## Fresh verification evidence

| Check | Result | Saved evidence |
|---|---|---|
| Contact provider HTTP integration | 35 passed, no skips | `evidence/api-contact-http.log` |
| Legacy authentication, invitation and temporary-account regression | 81 passed, no skips | `evidence/api-legacy-auth.log` |
| Focused provider/configuration/static checks | 74 passed, no skips | `evidence/api-focused.log` |
| Final SMS payload and input checks | 28 passed, no skips | `evidence/sms-payloads.log` |
| Full final web suite, including both redirect-race regressions | 456 passed, no skips | `evidence/web-suite.log` |
| Production build, including type validation | Passed | `evidence/production-build.log` |
| Existing credential regression | 4 passed, no skips | `evidence/credential-regression.log` |
| New credential scan | No occurrences in 330 scanned source/assets, including 118 browser assets | `evidence/credential-scan.json` |
| Independent final code review | Both concrete findings fixed; no remaining code blockers found | Review receipt below |

Some focused test groups overlap; their counts must not be added as a unique-test total. The final SMS run includes three new format cases added after the 74-check run. The build retains lint and workspace-root warnings; passing does not mean a warning-free repository. `git diff --check` passed.

Real Descope email receipt was confirmed by the user. The code was accepted by the provider and through the application. The database contained `email_verified=true` and `phone_verified=false`; the mobile screen showed account completion and Continue reached `/customer`. Both signup sends were accepted, but the user reported no SMS receipt. No further live SMS retries were made to chase that result. See `evidence/application-either-contact.json`, `application-live.json` and `provider-proof.json`.

![Mobile account completion with email proof](evidence/application-either-contact-mobile.png)

The live test used a disposable local schema and real provider delivery. It did not use the production Obligon database. The browser was signed out, its temporary mobile viewport cleared, the local test servers stopped, and the private account/schema and temporary credential file removed. See `evidence/cleanup.json`. The ignored development environment now points to the available local QA database on port 55419, rather than the stopped port 55418.

## Independent review receipt

The review traced signup, provider and local proof paths, sessions, profile serialization, migration permissions, database attempt/consumption locks, reset/MFA, company invitations and SMS preferences. It found two concrete problems: bare Nigerian numbers were not normalized for subsequent Termii messages, and an optional-contact action could race an automatic redirect. Both were corrected and regression tested. The reviewer found no further code blockers. This agent review does not replace qualified human release review.

## Remaining release requirements

1. Obtain qualified human review of this exact authentication and sensitive-data-flow patch. The user's AGENTS.md states: “Require qualified human review before production release of money movement, authentication/authorization boundaries, tenant isolation, destructive migrations, sensitive data flows, or similarly consequential changes.” Earlier approvals concerned earlier patches.
2. Configure the server-only Descope secrets in the hosted API environment and apply migration 034 through the existing migration process before serving the new API. No hosted Obligon environment, production migration, commit, push or deployment has occurred for this patch.
3. Verify the hosted signup, email confirmation and dashboard continuation after rollout. Actual Nigerian SMS delivery is still unresolved; retain the unverified phone flag until successful proof.
4. Track the 90-day credential expiry and free delivery limits. Review provider-side contact retention and the privacy notice. Provider sessions were discarded, but this does not delete provider-side contact records.
5. Configure a verified sender domain for general transactional Resend email. That separate requirement, and production delivery/recovery checks for other providers, are not resolved by this contact-verification change.

Rollback: return `VERIFICATION_PROVIDER` to `local` for new application-generated challenges and retain the additive migration. Outstanding challenges keep their recorded provider, so keep the Descope credential available until those challenges expire. Rolling back code restores the previous completion behavior; assess that consequence before a rollback. Local delivery simulators must remain disabled in production.

## Exact review package

Base source revision: `9c4e9572400e1c857090ddc7d9d0a93e3fa8f7fc`.

The complete 24-file application/configuration/test/documentation patch is stored as [changes.diff.gz](changes.diff.gz), with a plain `changes.diff` copy available locally. The uncompressed patch SHA-256 is `1afb8523895787d2e6032660c1272664a97b43880b27a9c8d8dd1097fb1b0839`. [change-manifest.json](change-manifest.json) records a hash for each included file. Reports and the learning note are supporting artifacts outside that application patch. See [release.md](release.md) for subsequent approval and deployment results.

Learning note: [Verify either contact](../../learn/2026-10-20-either-contact-verification.md).
