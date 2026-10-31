# Payment validation and four-day dashboard access

## Final verified status

The Wallet UI and reviewed calculation fixes are deployed. Application commits `c6f58e1` and `a05a103` were pushed to `master`; Vercel reports Ready and Render reports Live for `a05a103`. The latter adds rejection diagnostics without changing webhook authentication or accounting. This section supersedes the earlier release-progress notes below.

The final live smoke check passed all 14 requests, covering API health, Admin access, Company access, Partner access and session logout. The Company has an active Enterprise subscription and a real wallet balance of **₦100**. Live Billing has separate Subscription and Wallet tabs; confirming the already-paid reference displays a success popup and preserves one ledger credit. See [live checks](live-release-smoke.json) and [live Wallet screenshot](../company-wallet-tab-2026-10-31/live-wallet-confirmed.png).

**Webhook delivery remains unresolved.** After the owner reported copying Render's actual secret into Flutterwave and saving it, both API resend and native dashboard resend still returned `401 Invalid signature`. The native delivery log reached attempt 10. Render's deployed diagnostics confirm that the V3 verification header is present, the V4 signature header is absent, the incoming header is not a known placeholder, and the server hash is configured. Together with the unchanged exact comparison, this proves that the delivered V3 value differs from the running server configuration. It does not reveal which value Flutterwave currently stores or whether resend preserves an earlier value. A signed nonfinancial probe using Render's configured value was accepted.

No accepted provider-event receipt or matching webhook audit exists for this payment. Its original **₦105 charge, ₦5 application fee and single ₦100 wallet credit** remain unchanged. No new charge, payout or refund was made during diagnosis. See [final receipt/ledger check](webhook-receipt-postdeploy.json), [native delivery result](webhook-native-final.json), [safe runtime flags](webhook-authentication-log-final.json) and the prepared [Flutterwave investigation brief](flutterwave-investigation.md). No message has been sent to Flutterwave.

The three account credentials are supplied in chat, excluded from repository evidence, and expire **4 November 2026 at 20:38:43.560 WAT**. The Company plan is complimentary; it is not a fabricated processor subscription payment. The Partner test station remains pending and unpublished. Real-money proof covers Company wallet funding only. Customer checkout, actual subscription purchases, external issuing, refunds, payouts, bank settlement and unattended recovery remain unverified. The scheduler and dependency advisory limitations below remain open; this is not a complete launch-readiness pass.

Prepared on 31 October 2026 against source revision `ccdff3dbf6fec17e5cb70bc5ae9c54cfbce95054`.

## Result and release decision

Two confirmed calculation bugs are fixed locally and independently reviewed. Company Billing now separates Subscription and Wallet, including an explanation when wallet access is locked. The combined working tree passes 332 isolated API checks, 16 focused Wallet/access UI checks and a production build. **One user-completed real Company payment passed provider verification and manual application confirmation. Live webhook acceptance remains blocked by signature authentication failure; its exact cause is unconfirmed. The project is not proven ready for unrestricted real-money launch.**

The concrete four-file financial patch is [changes.diff](changes.diff), SHA-256 `4c6be4be722e68f4be189b61dcf6e05111231babbc7e09ae125ed3badf009300`. The user explicitly confirmed qualified review and approval of this exact patch. The release agent rechecked its hash and confirmed it matches. The combined nine source/test files are approved for release; no further review confirmation is required for that unchanged change set.

The approved nine-file release was committed and pushed as `c6f58e1b4b19e73fed68473bd0402d51c2ef02ad`. The release agent verified Vercel **Ready** and Render **Live** for that release. The recorded build below tested the matching nine-file working tree before commit. A subsequent two-file webhook logging/test patch is independently reviewed and awaiting its own commit/deployment; its authentication behavior is unchanged.

## What changed

| Dashboard/page | Change | Reproduced defect |
|---|---|---|
| Customer, fuel checkout | Uses exact integer quote calculations matching API rounding; malformed quantities cannot proceed | At a unit price of ₦1,050.50 and quantity 0.57, preview showed ₦598.78 while the API charged ₦598.79 |
| Customer, cashback | Awards 5% of the actual final fuel debit after discounts; station revenue share is not subtracted twice | A ₦90 debit with a ₦10 station revenue share earned ₦4 instead of the agreed ₦4.50 |
| Corresponding existing API/web tests | Added precision, malformed-quote, small-award and refund regressions | Both defects reproduced before implementation |
| Company, Billing | Separate Subscription and Wallet tabs, payment-return selection, keyboard navigation and success popup after funding confirmation | Wallet funding and subscription controls previously shared one page section |
| Company, protected Wallet access | Uses the existing subscription check to show a locked-state explanation and a working View subscription action | A first tab implementation left an inactive company's Wallet panel empty; this was corrected before release |
| Existing webhook integration test | Exercises `createApp()` middleware and a Company wallet's first verified callback, forged/missing authentication and duplicate delivery | Previous fixtures mounted a separate parser/router and did not demonstrate Company wallet delivery through the real app wiring |

Only new cashback awards use the corrected eligible-spend calculation. Existing award snapshots were preserved. Any historical correction needs an explicitly reviewed compensating reconciliation, not direct edits to financial history. Funding, refund reversals, concurrent access and wallet redemption protections remain in place. The corrected award can reserve more of Obligon's benefit budget than the previous underpayment.

## Fresh verification

- 332 of 332 API checks passed across 24 existing files on a disposable loopback PostgreSQL 18 database with all 49 migrations. No failed, skipped or cancelled checks. The new Company webhook regression is included.
- 16 of 16 final Company Billing/access-policy UI tests passed, with no failures or skips. An independent reviewer reran the same 16 checks successfully after the inactive Wallet fallback was added.
- 57 customer control/My Card web tests passed and 88 focused cashback/fuel-sale/fuel-checkout API tests passed during reproduction and correction.
- Web typecheck passed. The latest sanitized production Next build of the combined dirty working tree passed and generated 80 static pages. 75 existing warning lines remain, including unused code/hook warnings and workspace-root inference from multiple lockfiles. Build success is not a warning-free result, a UI-only artifact or proof of deployment.
- Independent review found no blockers in the financial calculation patch, the final Wallet UI/access patch or the webhook test addition. `git diff --check` passed. The user subsequently approved the exact financial patch as a qualified reviewer.
- Fixture-provider tests cover internal verification, concurrency/idempotency, recovery, ledger effects and tenant boundaries. They are not genuine external sandbox settlement tests.
- The subsequent webhook diagnostic test failed before the logger was added and passed afterward. Its full focused suite passed 12 of 12 checks, with no skips. It verifies unchanged rejection responses, boolean-only logs, absent credential/payload values and no logging or financial effects for a valid ignored probe. Evidence: [failing reproduction](evidence/webhook-auth-diagnostics-red.tap) and [passing suite](evidence/webhook-auth-diagnostics-green.tap).

Exact commands, test outputs and file hashes are preserved in [the evidence report](evidence/isolated-payment-validation.md). The first release's nine-file source identity was recorded before commit in [the manifest](evidence/wallet-webhook-source-manifest.json).

## Release scan evidence

Trivy found zero secret findings in the nine release source/test files and their diff. A fresh production npm advisory audit covered 305 dependencies and returned zero High/Critical findings and **one Moderate advisory**, `qs` 6.16.0, GHSA-6pq8-jhm2-2vcw; its listed fix is 6.16.1. The lockfile is unchanged and dependency remediation was not included in the approved change set. A bounded caller check found no direct `qs` or affected comma-array-format usage in the checked application sources; this is an exposure assessment, not proof the transitive dependency is safe. The audit is not clean and these scans do not establish overall security. Evidence: [scan report](evidence/release-scans-2026-10-31.md) and [counts/advisory details](evidence/release-scans-2026-10-31.json).

The two follow-up diagnostic files also had zero secret findings in the fresh targeted Trivy scan: [diagnostic scan](evidence/webhook-diagnostics-secret-scan.json). Checking source/docs found no whitespace issues. Raw `changes.diff` contains blank diff-context lines that produce staged whitespace warnings when Git treats the raw patch as a text document; those warnings are not source-code whitespace findings.

## Company Wallet browser verification

The exact Wallet preview passed desktop and 390-pixel mobile checks. The mobile document's `scrollWidth` was 390 pixels, with no horizontal overflow at that width. Home/End keys switched tabs and moved focus, and reloading a direct `?tab=wallet` URL preserved Wallet selection. The active account displayed its verified ₦100 balance and ledger entry. An inactive subscription displayed the locked explanation, and View subscription selected the Subscription tab without exposing wallet operations.

Screenshots: [active desktop](../company-wallet-tab-2026-10-31/active-desktop.png), [active mobile](../company-wallet-tab-2026-10-31/active-mobile.png), and [inactive mobile](../company-wallet-tab-2026-10-31/inactive-mobile.png). These are preview checks, not proof of the final hosted release. Design reference decisions are recorded in [the direction note](../company-wallet-tab-2026-10-31/DIRECTION.md).

After `c6f58e1` deployed, the live Company Wallet displayed ₦100. Reconfirming the existing payment showed the success popup and left exactly one ₦100 ledger credit. This is a manual-confirmation check; it does not establish provider webhook acceptance. Evidence: [post-deploy receipt/ledger check](webhook-receipt-postdeploy.json).

## Live payment evidence

- Live API health returned 200. Published payment configuration returned 200, with Flutterwave selected and simulation off.
- A read-only authenticated Flutterwave Nigerian bank-directory request returned 200, proving the available live API credential authenticates. It does not prove charges or payouts settle.
- The current customer-borne wallet funding fee is 5%; the published minimum wallet deposit is ₦100. The user completed the authorized Company checkout for **₦105**, consisting of **₦100 wallet principal and ₦5 quoted fee**.
- Flutterwave verification returned `successful`, NGN and the expected ₦105. Manual Company confirmation returned 200 and credited the wallet ₦100. Repeating confirmation returned `alreadyPaid=true`, the same balance and exactly one ₦100 ledger credit. The provider separately reported ₦102.74 net settlement; that field is not the wallet principal or proof of receipt into a bank account. Evidence: [payment result](company-real-payment.json) and [browser capture](company-real-payment.png).
- The supplied customer test credential currently belongs to an active Admin account. It cannot test customer-only payment routes. The account's role was not changed and **no customer charge was made**. Evidence: [role/access check](customer-access.json).
- No sandbox credentials are available in the current configuration. Sudo card issuing is missing. BVN remains disabled in the inspected configuration.
- No additional charge was created for webhook replay. No real partner payout, refund or card issuance was performed. No production financial entries were fabricated or reset to manufacture a test result.

## Live webhook configuration and delivery

The exact receiver URL, `https://obligon.onrender.com/api/webhooks/flutterwave`, was saved in the merchant dashboard and checked again after reload. The inspected merchant context was account `100850075`, with V3 Live webhooks enabled. This integration expects Flutterwave v3 `charge.completed` events with a `verif-hash` header matching the deployed `FLW_SECRET_HASH`. The receiver already follows that protocol; no production receiver code was changed. Official references: [v3 webhooks](https://developer.flutterwave.com/docs/webhooks) and [same-transaction webhook replay](https://developer.flutterwave.com/v3.0.0/reference/resend-transaction-webhook).

The user authorized dashboard configuration and replay of the existing paid Company transaction. Initial replay reported `Endpoint not found`. After correcting the merchant URL, replay reached the expected authentication path and reported `Invalid signature`. The browser returns a redaction placeholder for the merchant secret even when the field is revealed, so its equality with deployed Render `FLW_SECRET_HASH` cannot be determined through that read. The earlier conclusion that the values differ was invalid and has been withdrawn. Neither value is included in this report or its evidence.

The user reported saving the matching secret. The subsequent same-payment replay still returned `Invalid signature`, with no event receipt or audit and the same single ₦100 wallet credit. **Delivery verification remains pending:** determine the actual failed authentication condition, then confirm a successful receiver response, completed event receipt, matching audit entry and unchanged single ledger credit. The provider's resend API returning HTTP 200 with “hook sent successfully” is not proof of receiver acceptance when its delivery result contains an error.

A separate, deliberately nonfinancial configuration probe sent with the current Render-stored hash returned HTTP 200, `received:true`, and `ignored:obligon.configuration_probe`. This demonstrates that the active receiver accepts that stored credential. It does not prove that Flutterwave sent an accepted payment webhook, reveal the merchant secret, or change any financial record. Evidence: [active-secret probe](webhook-active-secret-probe.json).

No successful provider-event receipt or webhook audit was present in the inspected replay results. Native Flutterwave delivery attempt 7 still showed HTTP 401. The existing ₦100 wallet credit came from manual payment confirmation, not a proven accepted live webhook. The isolated Company test proves first-callback accounting through the actual application; a live replay after manual confirmation can prove delivery and duplicate protection, not first-webhook-only credit. Evidence: [native delivery log](webhook-native-delivery-log.png).

The follow-up receiver change adds only four boolean warning fields after failed authentication: presence of a V3 verification header, presence of a V4 signature header, whether a header resembles a redaction placeholder, and whether a server hash is configured. It keeps the original verification condition, rate limiter, exact 401 response and success path. It logs no header contents, hashes/digests, payloads, account details or credentials. Independent review found no blockers. Deploying this logging-only change can identify the actual header condition without changing payment authorization or relaxing verification.

Evidence: [initial routing error](webhook-replay-diagnostic.json), [replay after URL correction](webhook-replay-corrected-url.json), [replay after the user's secret update](webhook-replay-matched-secret.json), [configuration check with inconclusive secret comparison](webhook-configuration-check.json), and [saved URL browser capture](webhook-settings-corrected-url.png).

## Unresolved operational blocker

The live `/health` reports scheduler `enabled=false`, `running=false`, with no reconciliation timestamp. This conflicts with the expected `ENABLE_SCHEDULER=true` setting in `render.yaml`. The repository declares no external cron deployment that proves equivalent recovery is running.

Without unattended recovery, webhooks and limited read-path recovery do not establish that every pending top-up, subscription, direct fuel purchase, refund, settlement or outbox task will eventually finish. Enabling recovery can execute queued financial work and must follow backlog review.

Read-only aggregate snapshot at 2026-10-31 19:40 UTC:

- One pending payout row recording ₦300,000.
- Two pending settlement rows recording ₦2,517,416.55. This is a separate category and must not be added to the payout amount as though they were necessarily different liabilities.
- Four pending top-ups recording ₦107,000 and three pending subscription quotes recording ₦75,000, all awaiting real processor confirmation.
- Eight organizations have automatic settlement enabled.
- No refund rows or direct fuel orders were present.

The origin and real-provider agreement of those historical rows were not established. No queued job was run, those historical ledger records were not changed and scheduler configuration was not enabled. The later authorized Company payment adds its own verified ₦100 wallet credit; it does not validate the historical backlog. Evidence: [live diagnostics](live-diagnostics.json) and [aggregate backlog](backlog.json). Local ignored environment JWT warnings are local configuration findings, not evidence of the deployed server's JWT secrets.

## Four-day accounts

Created three new ordinary accounts: full Super Admin, Company owner with a complimentary active `organization_enterprise` plan, and a fuel-station Partner owner with temporary test access. All three have the same server deadline: **4 November 2026 at 20:38:43.560 WAT**, exactly 96 hours after activation. No existing identity was reset or extended.

All 55 live API checks passed: Admin 18, Company 21, Partner 16. These cover dashboard routes, active Company subscription, the Partner gate, a Company settings save, session refresh, matching expiry and initially zero funds. The later Company test payment changed that account's wallet to ₦100. Admin global queues were checked using HEAD so their response bodies were not copied into evidence. Contact-ownership flags remain false. Sessions do not exceed the account deadline.

The test station is pending, closed, lacks confirmed coordinates and is not published to customers. It is a dashboard/profile workspace, not an approved operating station. Actual station trading needs legitimate station approval and configuration. Full Admin credentials have real authority over production records. Records or further principals created through these ordinary accounts may persist after their own access deadline.

Activation and nonsecret route results are in [the account evidence directory](../four-day-accounts-2026-10-31/). Passwords are excluded from repository artifacts.

## Approved release and rollback plan

The approved nine-file release `c6f58e1` is on `master` with Vercel Ready and Render Live. The release agent will separately commit, push and verify the follow-up webhook diagnostics. No schema migration is part of either release. Post-deploy checks include API health, login, Company Billing/Wallet selection and the existing payment's unchanged single-credit ledger result.

Abort the rollout or roll back if login, Billing or API health breaks, or if duplicate wallet credit is observed. Rollback consists of a targeted `git revert` of the new release commit on `master`, followed by pushing that revert and verifying both hosting Git deployments and the same checks. Preserve financial records; a code revert cannot undo a payment or reward already posted. Any money correction requires attributable compensating records and investigation. Rollback timing, automatic rollback and recovery during an actual incident have not been tested or promised.

## Remaining release evidence

Deploy the reviewed boolean diagnostics, diagnose the remaining webhook signature failure without treating browser redaction as a secret value, then prove successful same-payment delivery and duplicate protection. Obtain valid customer-role access before testing customer checkout. Separately authorize and verify refunds and partner payout destinations/amounts. Review the existing financial backlog before restoring unattended recovery. Configure and verify required issuing/BVN providers before claiming new card workflows work. Historical cashback corrections need their own reviewed reconciliation. The first approved release is deployed; follow-up diagnostic deployment and accepted provider delivery remain unverified here. These remaining checks are not a new approval barrier and cannot be replaced by the passing fixture test suite.
