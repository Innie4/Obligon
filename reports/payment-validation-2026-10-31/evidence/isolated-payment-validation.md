# Isolated payment validation

Date: 2026-10-31. Source base: `ccdff3dbf6fec17e5cb70bc5ae9c54cfbce95054`. The initial run below tested that base; the final run tested the subsequent four-file payment patch identified by its exact file hashes.

This work ran existing tests only. No application code, production environment files, production databases, real provider credentials, live charges, refunds, payouts or card issuance were used.

## Final integrated Wallet and webhook verification

The checkout was tested again after the Company Wallet tabs/access explanation and real-application webhook regression were finalized. **This build includes the unreleased financial fixes below. It is evidence for the combined dirty working tree, not a Wallet-only deployment artifact. No deployment approval is implied.**

Exact nine-file combined SHA256: `793e36b304acbb5b98dda1b6727674895181cf252949ad7f7483bca759b45ff3`. Full paths, individual hashes, test counts and hash method are in `wallet-webhook-source-manifest.json`.

| Latest check | Actual result | Evidence |
| --- | --- | --- |
| Same 24 isolated API payment files | 332 passed; 0 failed, skipped or cancelled; exit 0 | `payment-wallet-webhook-final.log` |
| Two focused Company Wallet and access-policy web files | 16 passed; 0 failed, skipped or cancelled; exit 0 | `company-wallet-web-final-unsandboxed.tap` |
| Sanitized production Next.js build of the combined working tree | Exit 0; compiled successfully; 80/80 static pages generated; 75 Warning lines | `web-production-build-wallet-final.log` |

The API count increased by one because the webhook suite now mounts `createApp()` and checks the actual application middleware for a Company wallet callback. The added test rejects missing/forged delivery before provider lookup, verifies the legitimate charge, confirms a replay is duplicate, and asserts exactly one principal credit to the Company wallet with the personal wallet unchanged.

The focused web checks cover separate Subscription and Wallet tabs, correct payment-return routing, keyboard navigation, a locked Wallet explanation linking to subscription, wallet balance, confirmation feedback and balance refresh. The sandboxed Node runner reported only two file-level checks instead of the 16 declared cases, so it was rerun once with process/IPC restrictions lifted. Only the latter's 16 explicit subtest results are counted; the earlier file-level logs are preserved as diagnostics.

Latest focused web command from `apps/web`, with the same clean environment used elsewhere:

```sh
env -i PATH="$PATH" NODE_ENV=test DOTENV_CONFIG_PATH=/dev/null \
  node --test --test-reporter=tap \
  tests/company-billing-payment-flow.test.cjs \
  tests/dashboard-access-policy.test.cjs
```

The latest API run combined the same 24 files listed below in one `--test-concurrency=3` invocation, using the disposable loopback database and fixture providers. The latest build used the same sanitized production command documented below. Earlier unchanged web tests were not rerun. The earlier four-file typecheck remains recorded below; the latest build also performed Next.js type validation for the Company UI changes.

The database remains running for the root agent's final work. No production data, real provider sends, source-code edits, commits, pushes or deployments were performed by this validation task.

## Earlier four-file financial patch verification

The payment review found two cases not represented by the initial passing tests: the customer preview rounded a half-kobo quantity down while the API rounded up, and cashback subtracted the station's platform revenue share from the customer's already-final fuel debit. Another agent corrected those calculations and added focused regressions. This independent final run tested their resulting source.

Four-file combined SHA256: `1b1bdf0fb2578c8f882b389234c6cff57311cf15f78711aa2f565b153c984099`. Individual hashes and the deterministic hash method are in `final-source-manifest.json`. Files are `CustomerFuelCheckout.tsx`, `production-customer-controls.test.cjs`, `customer-rewards.js`, and `customer-rewards.integration.test.mjs`, with full repository paths in the manifest.

| Final check | Result | Evidence |
| --- | --- | --- |
| Same 24 API suite files, one combined run | 331 passed; 0 failed, skipped or cancelled; exit 0 | `payment-final-20261031.log` |
| Web TypeScript | Exit 0, no diagnostics | `web-typecheck-final.log` |
| Production Next.js build | Exit 0; compiled successfully; 80/80 static pages generated | `web-production-build-final.log` |

The API total increased from 329 to 331 because two cashback regression cases were added. The final API command used the same cleared environment and file list as the two initial commands below, combined into one `node --test --test-concurrency=3` invocation. It ran after the four-file patch was final. Deliberate injected-failure cases log errors for rejected refund inserts, oversized settlement aggregates, mismatched provider evidence and notification failure; their assertions passed and they do not represent unexpected test failures.

Web commands, from `apps/web`:

```sh
env -i PATH="$PATH" NODE_ENV=production DOTENV_CONFIG_PATH=/dev/null \
  node node_modules/typescript/bin/tsc --noEmit --incremental false

env -i PATH="$PATH" NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
  DOTENV_CONFIG_PATH=/dev/null \
  NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 \
  NEXT_PUBLIC_APP_URL=http://127.0.0.1:4310 \
  node node_modules/next/dist/bin/next build
```

The existing `scripts/build.mjs` wrapper loads the root `.env`; the final build invoked its underlying Next.js CLI directly instead. There were no actual `.env` files in `apps/web`. No live credentials were loaded. The build emitted 75 Warning lines, including existing unused imports, hook dependencies and Next.js workspace-root inference caused by the parent and checkout lockfiles. Those warnings remain; this was a successful build, not a warning-free build. Web tests already run by the implementation agent were not repeated by this validation task.

The disposable cluster was restarted for the focused fixes and final run and remains available for the root agent's final integration work. This task did not deploy anything. Qualified human review of the new financial patch remains a release requirement.

## Environment and setup

- Node `v24.21.0`; PostgreSQL `18.6`.
- New disposable cluster: `/tmp/obligon-payment-validation-20261031/pgdata`.
- Listener: `127.0.0.1:55831` only; database `obligon_payment_validation`.
- Existing application migration runner applied all 49 migrations successfully.
- The first migration attempt identified missing Supabase `auth.uid()` infrastructure in an empty vanilla PostgreSQL database. Added the same local `auth.uid()` stub used by `apps/api/tests/migration-startup.integration.test.mjs`, plus NOLOGIN `anon` and `authenticated` roles. This was a local fixture adjustment, not an application migration change.
- Commands used `env -i`, `DOTENV_CONFIG_PATH=/dev/null`, `NODE_ENV=test`, and an explicit loopback database URL. API package scripts that load the root `.env` were deliberately bypassed.
- Integration suites create and drop isolated schemas. Final query confirmed no suite schemas remained.

## Initial base-revision verification

| Run | Files | Passed | Failed | Skipped | Cancelled |
| --- | ---: | ---: | ---: | ---: | ---: |
| Payment regression | 22 | 302 | 0 | 0 | 0 |
| Annual checkout and access boundaries | 2 | 27 | 0 | 0 | 0 |
| Total | 24 | 329 | 0 | 0 | 0 |

Both test commands exited 0. Provider responses were controlled test fixtures; these results do not establish live provider settlement or delivery.

Run 1 (from `apps/api`, redirected to `payment-regression.tap`; Node selected its spec reporter despite that filename):

```sh
env -i PATH="$PATH" NODE_ENV=test DOTENV_CONFIG_PATH=/dev/null \
  DATABASE_URL=postgresql://obligon_test@127.0.0.1:55831/obligon_payment_validation \
  DATABASE_SSL=false \
  OBLIGON_TEST_DATABASE_URL=postgresql://obligon_test@127.0.0.1:55831/obligon_payment_validation \
  node --test --test-concurrency=3 \
  tests/money.test.mjs tests/money-amounts.test.mjs \
  tests/exact-money-provider.test.mjs tests/payment-methods.test.mjs \
  tests/payment-verification-contract.test.mjs tests/payment-error-visibility.test.mjs \
  tests/plan-wallet-separation.test.mjs tests/payment-plans.integration.test.mjs \
  tests/company-money.integration.test.mjs tests/fuel-checkout.integration.test.mjs \
  tests/fuel-sale.integration.test.mjs tests/payment-webhook-recovery.integration.test.mjs \
  tests/settlement-accounting.integration.test.mjs tests/legacy-payout-accounting.integration.test.mjs \
  tests/refund-boundaries.integration.test.mjs tests/refund-recovery.integration.test.mjs \
  tests/refund-ambiguity.integration.test.mjs tests/reconciliation-fallback.integration.test.mjs \
  tests/exact-money-projection.integration.test.mjs tests/customer-rewards.integration.test.mjs \
  tests/company-card-issuance.integration.test.mjs tests/savings.integration.test.mjs
```

Run 2 used the same cleared environment and database settings:

```sh
node --test --test-concurrency=2 \
  tests/dashboard-policy.integration.test.mjs \
  tests/customer-production-boundaries.integration.test.mjs
```

## Properties exercised

- Customer and company payment verification checks transaction reference, currency and exact amount; frontend simulation claims do not prove payment.
- Company wallet top-ups credit principal once under ten concurrent confirmations; allocation repeats preserve one balanced effect and bind the key to the payload.
- Twenty concurrent allocations cannot overspend; debit and credit ledger totals agree. Database failure on the credit leg rolls back both balances, audit and retry claim.
- Twenty concurrent provider callbacks create one wallet principal credit; forged webhook signatures cause no provider lookup or event claim; transaction failure rolls back receipt and money effect for safe retry.
- Unknown and timed-out provider responses remain recoverable. Late verified success, stale receipts, excess payment refunds, refund caps, concurrent refund claims and reconciliation identity checks are covered.
- Partner fuel sale authorization and settlement accounting enforce contract, scope, exact units and funds boundaries.
- Company card retries create one issuer effect; uncertain replies block blind retries; saved issuer receipts recover after a local insert failure; revoked access cannot complete an issuer request.
- Annual company checkout freezes a one-year paid period and duplicate confirmations cannot extend it twice. Existing monthly quotes remain monthly after a catalogue change.
- Expired company plans cannot operate; billing mutations require current billing permission; customer/company resources cannot borrow another tenant's payment or wallet.

## Remaining limits

- No real checkout, cardholder authentication, bank approval, processor settlement, beneficiary receipt, email/SMS delivery or production webhook delivery was performed in this isolated run.
- Provider sandbox/staging tests were not performed; mocked provider evidence is not a substitute.
- Tests exercise simulated persistence failures and durable recovery paths, but this run did not kill a live API worker or PostgreSQL process mid-transaction, restart a whole deployed application during a real payment, or verify multiple deployed workers against a real provider.
- Production monitoring, abnormal transaction alerts, bank/provider reconciliation and applicable card/regulatory review were not evaluated here.
- The initial 329, financial-patch 331 and latest integrated 332 API checks passed, but that does not prove the application or payment system is perfect, secure, or ready for unrestricted real-money launch.

Raw evidence: `migrations.log`, `local-supabase-fixture.log`, `local-database-check.log`, `payment-regression.tap`, `payment-access-boundaries.log`, and `initdb.log` in this directory.
