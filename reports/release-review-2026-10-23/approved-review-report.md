# Exact combined release review

23 October 2026. **Prepared for qualified human review. Not committed, pushed or deployed.**

Base revision: `a27caac35d740a2dd4b8c53ea83c948a3163a400` on `master`.

Application/test/dependency patch: **188 files**. SHA-256:

`446d9a44acc544b22b271caefa7cd15bd06f234f3ab818e3bb339baa0be7a775`

Review the [complete diff](changes.diff), [source manifest](source-manifest.json) and [file inventory](changed-files.md). The manifest hashes each source file; reports, screenshots and learning notes are supporting evidence outside this application-patch identity. No real environment file or provider credential belongs in the commit.

## What is being released

| Increment | Review scope and evidence |
| --- | --- |
| Payments and partner access | Mechanic workshop access, gas products and approved selling units, cross-dashboard quantities/receipts/exports, server authorization, durable company-card issuance, uncertain provider recovery, payout claims and settlement reconciliation. [Detailed report](../payments-partner-access-2026-10-23/report.md). |
| Google and passkeys | Additional existing-account sign-in methods, password-authorized linking/enrollment/removal, verified Google tokens, real WebAuthn signatures, private durable challenges, current-session/MFA/context checks and account method management. [Detailed report](../google-passkey-2026-10-23/report.md). |
| Dashboard search | Authorized navigation and bounded recent-record lookup across customer/partner/company/admin, keyboard/mobile search, stale-context protection and destination filtering. [Detailed report](../dashboard-search-2026-10-23/report.md). |
| Interface and states | Shared public/account/dashboard design, usable hidden-scrollbar regions, responsive records/metrics, accurate labels/copy, map fallbacks, support/plan/queue/retry states and final blocked MFA presentation. [UI report](../ui-polish-2026-10-23/report.md) and [every page](../ui-polish-2026-10-23/page-by-page.md). |
| Dependency remediation | Focused Next.js 15.5.28 and matching runtime/lint updates. No security helper framework or CI expansion. Production advisory audit reports zero findings for the current unchanged dependency inputs. |

The user authorized implementing these features and pushing to master. AGENTS.md separately requires qualified human review before releasing money movement, authentication/authorization, tenant-access and sensitive-data changes. Previous release and Google Cloud approvals do not cover this final combined source patch.

## Verification

- **623 web tests passed**, zero failures/skips; final production build, TypeScript/lint stage and `git diff --check` passed. Existing unused-variable and local multiple-lockfile workspace-root warnings remain.
- **1,251 API tests passed**, zero failures; 13 explicitly opt-in live-service smoke checks skipped. All 74 backend/shared/dependency files in the frozen acceptance snapshot remain byte-identical, so that acceptance is reused rather than rerun without a relevant source change.
- Clean migration run applied **001–039**; immediate rerun applied zero. New authentication tables have RLS enabled and public/Data API grants revoked in the isolated database.
- Production advisory audit: zero findings. Latest offline Trivy source-secret scan: zero matches in its documented scope. These are bounded checks, not a security certification.
- Independent agents reviewed the financial/authentication increments, scoped search and final UI changes. Map lifecycle, stale callbacks and table alignment received focused checks. Final public layout changes preserved form/call contracts in an independent syntax-tree comparison.
- Chrome acceptance used isolated disposable accounts and records. **232 final role/public/auth frames**, four widths, no detected page-level horizontal overflow. Search routes, receipts, calendar cancellation, menu focus, keyboard scrolling, logout, workshop restrictions and admin network failure/recovery were exercised. Screenshots do not prove every state or provider effect.

Latest receipts: [final-verification.json](../ui-polish-2026-10-23/evidence/final-verification.json), [API receipt](../google-passkey-2026-10-23/evidence/api-final-receipt.json), [backend freshness](../ui-polish-2026-10-23/evidence/backend-evidence-freshness.json), [critique](../ui-polish-2026-10-23/CRITIQUE.md).

## Impact and operational review

**Money and persisted data.** Migrations 035–039 add subtype/unit fields, durable issuance/reconciliation records and account-method tables, with explicit checks/backfills and permission changes. Issuer requests, fuel quantities and payout recovery have cross-service effects. Review transaction/lock/idempotency boundaries, migrations against current hosted data, provider contracts and unresolved-outcome recovery. Tests use integer minor units and isolated providers; they do not prove provider/bank/books agreement or a fully balanced accounting system.

**Authorization.** Partner subtype restrictions apply to UI and server actions, current membership and realtime delivery. Company issuance completion rechecks the actor/company context. Sign-in methods preserve suspension, temporary expiry, lockout and MFA decisions. Review these boundaries and private credential/challenge storage against deployment permissions.

**Public contracts and callers.** Customer, partner, company, admin, exports, receipts and approved station offers share quantity/unit semantics. Search uses existing scoped APIs and current destination filters. Header search is a bounded recent-record feature, not a global history index. Layout changes retain the existing actions rather than inventing new money or workshop payment workflows.

**Configuration after approval.** On Render, configure the approved public Google web client ID; set `APP_URL=https://obligon.vercel.app`, matching narrowly scoped `CORS_ORIGINS`, `WEBAUTHN_RP_ID=obligon.vercel.app`, `WEBAUTHN_RP_NAME=Obligon` and the intended `WEBAUTHN_ENABLED` value. Never use `vercel.app` as the relying-party ID. The Google Cloud audience was published with user approval; production application settings have not yet been changed by this release.

**Recovery.** Preserve durable issuance/payout claims, recorded units, authentication public keys and audit evidence. Do not remove migrations or delete financial evidence as an application rollback. Reverting to old code that treats gas kilograms or standard cubic metres as litres is unsafe. Google can be disabled by clearing `GOOGLE_CLIENT_ID`; passkey login/enrollment can be disabled with `WEBAUTHN_ENABLED=false` while password access remains. Investigate uncertain provider results before any repeated external write. Hosted rollback timing, database restoration and operational recovery have not been rehearsed in this task.

## Remaining launch evidence

1. Sudo sandbox access and actual card-issuer acceptance.
2. Full provider payment/refund/payout sandbox acceptance, external refund procedure, provider/bank/books reconciliation and hosted crash/timeout recovery.
3. Dependable hosted reconciliation runner, monitoring, abnormal-transaction alerts and backup restoration.
4. Actual Google-account linking/login, physical/synced passkey and supported-device ceremonies. No fingerprint/face scans are collected by the application.
5. Nigerian SMS handset delivery and general sender-domain operational acceptance.
6. Independent static/API/security/load/device/accessibility assessment and applicable qualified payment/card/regulatory review. Actual 200% browser zoom and complete screen-reader/all-element contrast coverage remain unverified.
7. Exact approved revision deployed on both Vercel and Render, successful hosted migration logs, health and post-deployment smoke checks. Earlier hosted revisions are not evidence for this patch.

The independent UI rubric retains unverified dimensions and does not assign unsupported 5/5 scores. This package supports review of an application release; it does **not** establish unrestricted real-money launch readiness.

## Approval and next step

A qualified reviewer must approve this exact 188-file source patch and its stated residual risks before its production release. After that approval, commit the reviewed application sources, intended reports and learning notes; push `master`; verify the exact revisions, migrations and health on Vercel/Render; and perform bounded live smoke checks. Preserve real environment files, sensitive browser captures and unrelated historical reports outside staging.
