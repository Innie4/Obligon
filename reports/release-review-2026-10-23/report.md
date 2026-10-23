# Combined release record

23 October 2026. UI/search release `13fc4f0` was pushed and verified Ready on Vercel and Live on Render. The last compatible request-parser update is locally verified. Final hosted status for the resulting revision is recorded alongside this report in `evidence/deployment-final.json`.

## Changes

| Area | Delivered behavior | Detailed evidence |
| --- | --- | --- |
| Payments and partner access | Workshop-only mechanic access; gas products with approved selling units; cross-dashboard quantities, receipts and exports; server authorization; durable company-card issuance, uncertain provider recovery, payout claims and reconciliation | [Payment and partner report](../payments-partner-access-2026-10-23/report.md) |
| Google and passkeys | Additional existing-account sign-in methods; password-authorized linking, enrollment and removal; verified Google identity and WebAuthn signatures; durable challenges; account-method management | [Sign-in report](../google-passkey-2026-10-23/report.md) |
| Dashboard search | Authorized destinations and bounded recent-record lookup across customer, partner, company and admin; keyboard and mobile interaction; stale-context protection | [Search report](../dashboard-search-2026-10-23/report.md) |
| UI polish | Public, account and dashboard layout/typography; responsive records and metrics; scroll, menu, calendar, support and MFA state improvements | [UI report](../ui-polish-2026-10-23/report.md), [page-by-page record](../ui-polish-2026-10-23/page-by-page.md) |
| Popup feedback | Loading, pending, errors and action messages in floating cards; existing validation, access policy, saved statuses, codes and references stay contextual | [Popup report](../popup-feedback-2026-10-23/report.md) |

The initial popup application/test/dependency patch contains **206 files**, based on `a27caac35d740a2dd4b8c53ea83c948a3163a400`. SHA-256: `fc0eb77d2c2093eaac0f2e741c55f999df0bb0fcdda3ec5c2df342ca52dfbfb5`. See [complete diff](changes.diff), [source manifest](source-manifest.json) and [file inventory](changed-files.md).

## Final follow-up

The push exposed an updated Zod advisory. A package-only remediation and the remaining shared-search popup/keyboard corrections are recorded in [the follow-up report](zod-advisory-followup.md). This is separate from the original approval identity. The complete final source hashes and six-file delta are in [followup-source-manifest.json](followup-source-manifest.json). Fresh acceptance passes **646 web tests and 1,251 API tests**, with 13 opt-in API smoke checks skipped; the production build and both dependency audits pass. The two API suites that inspect web source were rerun after their stale assertions were corrected. The earlier backend-only evidence-reuse limit is documented explicitly.

## Request-parser advisory follow-up

GitHub separately identified `GHSA-27r3-jxmh-p828` in Express's body-parser dependency while the release was being checked. The [package-only follow-up](body-parser-followup.md) pins the existing Express runtime and resolves patched body-parser 2.4.0. Only API package.json and the generated lockfile change; application code, tests and workspace configuration remain unchanged. The full API suite was rerun: **1,251 passed, zero failed, 13 opt-in skipped**. Both dependency audits return zero findings. [Complete final application hashes](source-manifest-final.json) cover all 206 files. Earlier zero-audit receipts are historical and do not replace these later checks.

## Approval and scope

The user confirmed qualified human approval of the original 188-file patch `446d9a44acc544b22b271caefa7cd15bd06f234f3ab818e3bb339baa0be7a775`, then authorized push/deployment. The [original report](approved-review-report.md), [approved source manifest](approved-source-manifest.json), [approved diff](approved-changes.diff) and [approval record](approval.json) are preserved.

The subsequent popup request authorizes the presentation increment. At the initial popup freeze, all **74 critical backend/shared/dependency inputs remained byte-identical** to the approved snapshot. The later Zod package/lockfile update and two UI-source test corrections are explicitly recorded in the final follow-up; application authentication/payment/authorization source logic remains unchanged. Compared service/login expressions are unchanged; independent consumer review also checked form/disabled attributes and retry callbacks. This evidence has defined limits and is not a complete proof of unchanged behavior.

## Verification

- **642 web tests passed**, zero failures or skips, after popup integration. Production build, TypeScript, lint and `git diff --check` pass. Existing unused-variable and local multiple-lockfile workspace-root warnings remain.
- **1,251 API tests passed**, zero failures; 13 explicitly opt-in live smoke checks skipped. The unchanged critical-source hashes allow this acceptance result to be reused.
- Migrations **001–039** applied to an isolated database; immediate rerun applied zero. New authentication tables have RLS and revoked public/Data API grants.
- Production dependency audit and bounded source-secret scan found zero issues in their documented scopes. The popup source scan was refreshed after source freeze.
- Independent agents reviewed consequential payment/authentication changes, search, UI and popup integration. Three popup defects were corrected and rechecked.
- Earlier Chrome acceptance captured **232 public/auth/dashboard frames** at 1440, 768, 390 and 320px, with no detected page-level horizontal overflow. Additional popup checks exercised loading, error, recovery and synthetic action feedback. These checks do not establish a universal 5/5 score or full accessibility acceptance.

Latest receipts: [popup verification](../popup-feedback-2026-10-23/final-verification.json), [approved-source comparison](../popup-feedback-2026-10-23/request-contract-check.json), [API receipt](../google-passkey-2026-10-23/evidence/api-final-receipt.json), [UI receipt](../ui-polish-2026-10-23/evidence/final-verification.json).

## Deployment and recovery

Render and Vercel are connected to `master`. The API starts only after its migration command succeeds. The approved Google web client and `WEBAUTHN_RP_ID=obligon.vercel.app`, `WEBAUTHN_RP_NAME=Obligon`, `WEBAUTHN_ENABLED=true` and matching CORS origin have been saved on Render for the deployment. No actual provider credential or real environment file is included in the commit.

The approved source and popup increment will be separate commits. If the final search changes cause a regression, restore only the reviewed search component/test from `0121bf2` and retain the Zod dependency remediation. If the earlier popup increment needs recovery, restore the approved web source from `a66d22d` while retaining the patched API dependency and new backend. This preserves the new backend and recorded selling units. Do not use the old `a27caac` application as an automatic financial rollback: old screens assume litres and could mislabel kilograms or standard cubic metres. Preserve issuance/payout claims, units, authentication keys and audit evidence. Disable new Google/passkey methods through configuration if necessary while password access remains available. Investigate uncertain provider results before repeating an external write.

The hosted rollback/restore duration and staged canary rollout have not been demonstrated on the current free hosting setup. Recovery instructions are documented; a sub-five-minute recovery guarantee is not established.

## Remaining launch evidence

1. Sudo sandbox/card-issuer acceptance.
2. Complete provider payment/refund/payout sandbox acceptance, external refund procedure, provider/bank/books reconciliation and hosted crash/timeout recovery.
3. Dependable hosted reconciliation runner, abnormal-transaction alerts, monitoring and backup-restoration drills.
4. Real Google-account linking/login and physical or synced passkey ceremonies on supported devices.
5. Nigerian SMS handset receipt and general sender-domain acceptance.
6. Independent security/load/device/accessibility assessment and applicable qualified payment/card/regulatory review. Complete screen-reader, actual 200% zoom and all-element contrast acceptance remain unverified.

Deployment success is distinct from these remaining operational requirements. No claim of flawless or complete real-money launch readiness is made.
