# Partner contracts, Company subscriptions and Careers

28 October 2026 · Base `460868d5419b0bd95969d358c616e6b368507be0`

## Delivered behavior

| Page or boundary | Change |
| --- | --- |
| Partner dashboard, transactions, analytics, POS and settlements | Operations require current admin-approved partner status. Existing verified partners carry over, per the user's decision. Pending accounts retain onboarding, account verification, team setup, notifications and Support. Operational overview/range, resupply and terminal messaging are blocked until approval. |
| Partner Contract, `/dashboard/billing` | Replaces plan checkout with contract status and Support. New partner subscriptions cannot be purchased. Previously started charges can still reconcile without granting contract approval. Temporary access is labelled separately from a real contract. |
| Admin Partner applications | Approval requires a literal `contractAgreed: true`. Approval and an attributable `partner.contract_approved` audit record commit together. Station publication remains a separate approval. |
| Company dashboard and operating APIs | An active Organization subscription replaces the company contract gate. Selected company membership and permissions remain authoritative. Trial, future, missing, canceled and expired plans cannot operate. Billing, Settings, Notifications and Support remain reachable. |
| Company Billing | Sells the existing public annual Starter (₦150,000), Business (₦250,000) and Enterprise (₦500,000) plans. The custom Organization option remains a quote request. Wallet funding/allocation is visible only during active access; subscription and wallet return references remain separate. Expired billing details show `expired`. |
| Company fleet/cards/reports and internal money services | Vehicle creation counts under an organization lock; new card issuance checks quota before contacting the issuer. Basic reporting remains available on Starter, advanced exports require advanced analytics. Allocations and wallet POS enforce the subscription inside the transaction. Saved issuer results retain an admin recovery path. |
| Customer station selection and fuel checkout | Station availability uses partner contract approval rather than a partner subscription. Contract loss before provider confirmation or fuel collection preserves a paid order for review/refund instead of dispensing fuel. POS rechecks approval with the locked organization. |
| Public Pricing and Signup | Organization prices and annual periods are preserved. Plan links select Company signup and return to Company Billing after contact verification. Partner copy describes contract approval. |
| Admin Requests and activity, Job postings | Review popup edits title, department, location, employment type, description and open/closed status. Removal requires a second deliberate action. Errors retain the editor; duplicate pending actions are blocked. |
| Public Careers | Created and edited open jobs appear through the live API; closed/deleted jobs disappear. Existing submitted applications survive deletion with their job link cleared. |

Account roles, company memberships, ownership and existing financial history are preserved. Mechanic and gas-station specialization restrictions remain enforced.

## Annual billing and compatibility

Migration `049_company_organization_plans.sql` adds the three public annual catalog entries and freezes each subscription quote's `billing_interval`. Existing quotes default to their original monthly period; existing paid periods remain intact. Legacy monthly entries are retired from new sales. A verified payment uses its persisted amount, tenant, plan and period, and the existing atomic payment claim prevents duplicate extension. No provider receipt or real payment is fabricated.

No table/column is removed, and there is no destructive backfill. Existing verified partners retain approval as explicitly requested. New approval records the admin's contract confirmation; this implements administrative confirmation, not electronic contract signing or document storage.

## Temporary testing access

The two reserved identities are `partner.test@obligon.com` and `company.test@obligon.com`. Each reviewed operator command starts one database-timed 24-hour, read-only lease. Passwords are supplied through protected environment input and are absent from the repository, report and frontend. Startup and login do not extend access. Existing sessions/API keys are revoked at grant, and login, refresh, bearer requests and realtime expiry enforce the deadline.

The company exception requires the exact reserved user ID, email, role, organization and bounded deadline. It creates no paid subscription or invoice. Partners are explicitly assigned fuel-station specialization for viewing their actual dashboard. These accounts cannot create money movements, staff, credentials or business records. Production activation is intentionally deferred until the reviewed release is live; precise expiry will be recorded in the release receipt.

Read-only production previews found one inactive reserved Partner identity and no Company identity. No production user was changed by these previews. Render's free plan does not offer a shell; the existing protected database configuration and reviewed operator commands are available for activation.

## Verification evidence

- Full API regression: **1,469 checks, 1,456 passed, zero failed, 13 skipped** (`evidence/api-final.tap`). The skipped legacy seeded-server smoke cases were not configured against a separate seeded server. No production funds or destructive provider tests were used.
- Full frontend regression: **779 passed**, zero failures/skips (`evidence/web-final.tap`).
- Production frontend build passed with existing lint and workspace-root warnings (`evidence/build-final.log`). No dependency, CI or framework changes.
- Subsequent focused checks cover the final expired billing label, operational Partner overview and station onboarding exceptions. Final focused station/approval checks passed 76 tests, and the bounded lease suite passed 35. These overlap the full regression suite and are not added to its total.
- Isolated lease tests cover exact 24-hour grants, collisions, concurrent grants, restart persistence, expired login/JWT/refresh, read-only writes and tenant identity binding. Two independent review passes checked the policy callers and temporary-account implementation.
- Chrome used the actual local application/API with disposable PostgreSQL data and external providers disabled. Publishing a job showed it on Careers, editing changed its title/location, and removal confirmation appeared inside the centered review popup. Automated API and UI tests verified deletion and retention of applications. No production job was created or removed.
- Chrome confirmed Company operations with a paid annual fixture and pending company verification, annual prices, wallet visibility, and the expired plan gate with wallet actions hidden. A verified Partner with no paid subscription opened its dashboard and Contract page; a pending contract displayed the gate.

Browser viewport override did not take effect: observed width remained 1,661 CSS pixels after an explicit 390-pixel request and reload. The screenshots are desktop evidence, not verified mobile evidence. Chrome's local development console reported extension-added `__processed_...`/`data-qb-installed` hydration attributes; no application suppression was added. The first local login attempt used an obsolete fixture port embedded in the existing local environment; the dev server was pointed at the current isolated API and normal sign-in then passed.

## Review, limits and release

Independent review found stale station-picker subscription checks, missing approval rechecks during fuel recovery, quota omissions, Starter reporting denial, a retired-plan test-grant lookup, and overly broad station onboarding exceptions. Each was corrected with focused regression evidence. No unresolved review finding is being treated as passed.

Real annual checkout acceptance with a payment-provider sandbox has not been performed; no charge was made. This change reuses the existing payment integration and does not certify overall real-money launch readiness. Provider setup, issuer/BVN dependencies and other pre-existing launch requirements remain separate. There is no new package-version change requiring a fresh package remediation.

The user-supplied AGENTS.md requires qualified human review before production release of payment and authentication/authorization changes. This concrete report, `source-manifest.json` and the complete `changes.diff` form the review packet. Deployment and activation require that review and the user's release authorization. Hosting status is recorded only after the exact source is live on Vercel and Render.

Recovery: redeploy prior source `460868d` on both hosts if smoke checks regress; retain additive migration 049 and payment records. Revoke the two known test users/sessions if required. Do not reverse paid ledger entries or delete reconciliation records. Source rollback restores the former access policy, so prefer a focused forward correction for a policy-only issue. No paid hosting upgrade or external message is included.

Design references: the installed UI Reference Guide ten-source catalog informed selection. Existing Obligon tokens, centered AdminDialog and feedback components were reused. No new visual library, hosted design generation or unrelated redesign was introduced.

Reviewed source packet: **62 application/test/migration files**, patch SHA-256 `140b06a8f176d36a70d77e833da86aa796c784029802944d3314598408785ade`. Source hashes exclude this prose and the learning note.

Release authorization: the user confirmed qualified review of this exact packet and authorized push, deployment and activation of both bounded logins after successful deployment.
