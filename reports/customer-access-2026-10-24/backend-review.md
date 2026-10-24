# Customer access and benefits backend review

Date: 2026-10-24. Base: `f72ae49`. Reviewed the uncommitted customer-access patch, with focused fresh verification after the final test-fixture corrections.

## Result

No confirmed unresolved backend defect was found in the final reviewed paths. This is a bounded code and isolated-test review, not a claim that the whole application is flawless or production ready. It does not replace the qualified human review required before releasing payment, access-control and sensitive-data changes.

The review of migrations 042, 044 and 045 and their application callers was performed separately from their implementation. I authored the spending-alert implementation and migration 043 earlier in this task; that portion is a self-check rather than an independent review.

## What was traced

- **Paid customer access and first payment:** the customer API clears company context before enforcing the personal-plan gate. Onboarding/card verification and existing owned-payment confirmation remain available. Operational routes require a currently active paid period, with additional plan-feature checks. Browser confirmation, signed webhook processing and reconciliation all activate the first period from persisted verified payment proof. The activation marker prevents later card approval or replay from restarting that period.
- **Renewal and refunds:** a paid applicant can renew while waiting for card issuance; an unrelated company card does not qualify. Full withdrawal/refund cancels only the subscription matching the original payment reference and cannot cancel a later renewal. The migration preserves matching existing periods and grants a one-time period only to eligible historical paid applicants.
- **Benefit funding:** the programme starts at zero, and new funding checkout is disabled by default. A durable admin/key/amount intent is stored before the external checkout call. Retries reuse that intent. Credit requires an independently verified real Flutterwave transaction with the matching reference, currency, gross amount and usable net settlement. The programme receives verified net funds, never the checkout gross. Missing net settlement remains unresolved without credit. Confirmation, movement journal and budget credit are atomic; existing intents can reconcile while new funding is disabled.
- **Cashback:** eligible completed personal fuel purchases snapshot the paid plan and 5% rate. Calculations use exact integer minor units, exclude platform fees and floor to kobo. Direct processor checkout requires fulfillment before award. Unfunded awards remain pending. Funded awards reserve actual programme funds. Duplicate redemption keys bind to one amount and one customer. A definitive insufficient-funds/recovery decline is durably recorded before its conflict response; an uncertain response can be retried with the same key. Full and cumulative partial refunds reverse cashback, recover available cashback first and offset already redeemed value against future awards without an invented wallet debit.
- **Generator repairs:** the request snapshots the approved plan subsidy. Only verified mechanics can be assigned. Quotes reserve available programme subsidy; parts remain fully customer-paid. Quote-version checks reject stale payment. Customer payment, programme reservation and repair state are transactional. A fully subsidized labour-only quote needs no customer wallet. Cancellation before work returns held money once. Completion consumes the reservation and records an unpaid partner liability, without claiming an external payout. Customer ownership, admin authorization and active-plan boundaries were traced through the HTTP routers.
- **Integration and persisted data:** migrations 042 through 045, private-table permission inventory, the existing reconciliation scheduler, signed Flutterwave webhook entry, fuel-sale/checkout cashback snapshots and postcommit spending-alert hooks were checked. Informational alert failures cannot change a committed purchase into a failed sale. All new financial records use the existing transaction and ledger conventions; repair movement/event immutability is tested with actual database triggers.

The expected deployment model is multiple API workers sharing PostgreSQL. The reviewed money paths use durable uniqueness and database locks/transactions rather than relying on process-local serialization.

## Fresh verification

Run from `apps/api` against the existing explicit localhost-only disposable test database:

```sh
NODE_ENV=test DOTENV_CONFIG_PATH=/dev/null DATABASE_SSL=false \
OBLIGON_TEST_DATABASE_URL=postgresql://obligon_test@127.0.0.1:55423/obligon_pay_rbac23 \
node --test --test-concurrency=1 \
  tests/customer-plan-access.integration.test.mjs \
  tests/customer-rewards.integration.test.mjs \
  tests/generator-repairs.integration.test.mjs \
  tests/personal-fuel-alerts.test.mjs
```

Result: **55 tests passed, 0 failed, 0 skipped**. Evidence: `/tmp/obligon-backend-independent24.log`.

The tests exercise real PostgreSQL transactions and HTTP boundaries with isolated data and controlled provider responses. Cases include 20 concurrent redemptions, repeated identical keys, payload/cross-customer key binding, 20 concurrent funding confirmations, database failure after mutation, missing/forged settlement data, uncertain provider checkout, full and successive partial refunds, 20 concurrent repair payments, competing subsidy reservations, cancellation replay, unpaid access, later-renewal preservation and migration idempotence. Assertions include balances, ledger/movement records, immutable records and programme conservation rather than HTTP success alone.

No application source was changed during this final review. Final test-fixture changes reported by the implementing agent were included in the fresh run. The parent owns the final complete API/web suites and rendered browser verification.

## Remaining release evidence and operating limits

- This new combined patch still requires its own qualified human review before production release. Earlier approval of the separate BVN patch does not cover it.
- No real funds were used. Flutterwave sandbox/live evidence for benefit funding and its net-settlement field is still unavailable. Keep new benefit funding disabled until those checks are completed.
- Programme funds start at zero. Cashback can be earned but cannot become spendable until genuinely funded; repair subsidy cannot be reserved from an empty programme.
- Repair completion creates an unpaid liability. External mechanic payout and reconciliation of that payout are outside this workflow and must not be represented as completed.
- BVN/Sudo issuing access remains disabled or unverified from the preceding task. These tests do not prove provider account readiness, actual card issuance, Nigerian SMS receipt or email-worker delivery in production.
- The complete production recovery, monitoring, provider sandbox and reconciliation requirements in the supplied financial policy remain release requirements. Local passing tests do not substitute for them.

## Reviewed source fingerprints

| File | SHA-256 |
| --- | --- |
| `apps/api/src/lib/benefit-budget.js` | `219abc8d35e2b989757f93d1e1e1ee69db95421e019d5e200c8929fd8d784dc4` |
| `apps/api/src/lib/customer-rewards.js` | `11339d96edbead0f84863e30e02cab55b0c334be1ece18c4ca721d6dec80a32c` |
| `apps/api/src/lib/generator-repairs.js` | `ff012519ae15573791440bdb0446ab0026c9b69cc78c91cde5f6ae1e9703376a` |
| `apps/api/src/lib/subscriptions.js` | `2e16473a100d19cc1da01909a8888bdd07f039def4785de9a50841f8ae3b3311` |
| `042_customer_preferences_paid_access.sql` | `e7121ffce30f2d73e9064e40d3247528c6e7f18870686352c8a144b64650f285` |
| `043_customer_spending_alerts.sql` | `4c3c70065cf156a49296ee260e0350ea02199dfcb8bb3ffc35ffbe8c7183e9f3` |
| `044_cashback_benefit_budget.sql` | `4f86d0440b4cf9b3ebb8cfdb88a59b1be108e1a164607fa6c662a5210f8cbd4a` |
| `045_generator_repairs.sql` | `c10dc6bbc73b4b44c1cfe2978312a33eb0e452c25b0a091cff11195a5103463e` |

## Final dependency-only follow-up

The final advisory audit identified Multer advisory `GHSA-q7qp-rjg7-q26m`. I separately inspected the staged dependency delta: `apps/api/package.json` changes only Multer `^2.4.0` to `^2.5.0`; the generated lockfile changes only its importer, package resolution/integrity and snapshot key. There is no unrelated dependency update or application, test or CI change in this increment. The remaining Multer dependency list and Node engine requirement are unchanged. This stays within the supplied vulnerability-fix scope.

I checked the registry/remediation receipt, compared its integrity to the lockfile, independently confirmed that the installed API resolution is `2.5.0`, and checked the two-file staged diff for whitespace errors. No new dependency-only finding was identified. The unchanged feature code was not reviewed or tested again solely for this manifest update.

I inspected the saved final verification artifacts:

- `evidence/multer-upload-tests.tap`: **12 passed, 0 failed, 0 skipped**, covering the existing valid, malformed, oversized and unsupported upload cases.
- `evidence/multer-audit-after.json`: production audit reports **zero advisories** at all severities.
- `evidence/full-advisory-after.json`: full dependency audit reports **zero advisories** at all severities, including development dependencies.
- `evidence/api-final.tap`: the parent's final complete API run after the dependency update has **1,354 passed, 0 failed, 13 opt-in checks skipped** out of 1,367. Skipped checks remain unverified and must retain their documented limits.
- `evidence/web-final.tap`: **679 passed, 0 failed, 0 skipped**, including the added cross-tab redemption regression. The UI/API feature implementation is unchanged from the reviewed source fingerprints above.

Final dependency fingerprints:

| File | SHA-256 |
| --- | --- |
| `apps/api/package.json` | `1bf0b95b080fd9b560bae141b67009fb905cd7fc4294fc353f636e030ff60010` |
| `pnpm-lock.yaml` | `db37facc1fc066ac1f83ae83040af25bfbdfb4124bc5cbcb5daeee46b78415a7` |

The frozen combined source/test/dependency patch has **71 files**, with SHA-256 **`58deb84ce9b4e02325c322dc727a29a8ee9f0bea4d9af16d5fcb27ae83037fc9`**. I confirmed that this matches `changes.diff`; `source-manifest.json` identifies the reviewed files. Reports/evidence are separate from that source patch. This bounded follow-up provides agent review evidence, not qualified human approval or permission to deploy. The release limitations above still apply.
