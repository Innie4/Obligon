# Obligon production-readiness review

14 October 2026 audit · Approval reported 15 October 2026 · Baseline 5914f6e

**Human review approval reported; external production acceptance remains unverified.**
The user reported qualified reviewer approval for the exact tested 155-file source set on 15 October 2026. Approved application commit: a8fa66227cda3e7b0ac1165efbbde07b9e0b74b5. Master push is authorized and pending at this pre-push report checkpoint; no deployment is claimed. External provider, hosted, recovery and device acceptance remain unverified.

[HTML report](index.html) · [Structured findings](findings.json) · [Page matrix](route-matrix.json) · [Changed-file index](source-index.json)

## Verification

Human review approval reported; external production acceptance remains unverified. Exact tested source set approved; master push authorized and pending.. API 1018 tests, 1016 passed, 0 failed, 2 skipped; web 260 tests, 260 passed, 0 failed, 0 skipped. Lint 0 errors, 78 warning entries. Thirteen real local HTTP smoke cases are included in API coverage, not added to the totals. Build: passed. Browser: 73/73 known local page routes visited in 233 saved observations, plus 12/12 available live customer routes; available rendered/guard and targeted interaction states, not all state permutations or real-provider acceptance.

Focused suite counts overlap the full runs and are not added together. File coverage records actual review depth; it does not prove every interaction or real-provider state.

## Source coverage

All 392 baseline tracked files have a recorded review depth. 372 current source/configuration files were fully read, reused by matching hash or revalidated after changes; six binary images were decoded and reviewed, 13 assets received structural review, and one lockfile has inventory/scanner coverage. No source file remains uncovered or inventory-only. This is source coverage, not proof of every interaction or provider state.

| Review depth | Files |
| --- | --- |
| Previously full-read current source/configuration, hash revalidated | 167 |
| Current source/configuration reread or changed regions revalidated | 21 |
| Current source/configuration full-read | 184 |
| Binary images decoded and visually reviewed | 6 |
| Asset/vector structure reviewed | 13 |
| Dependency lockfile inventory and scanner proof | 1 |

Current pages: 73. Changed source/test/configuration/assets: 155. The exhaustive changed-file hash index and static route/dependency map are below.

## Live Vercel customer acceptance

All 12 known customer routes were visited, including aliases and standalone forms, through the user-supplied account. The initial login failed for an undiagnosed reason; one bounded retry returned 200. Measured 320px core pages have no document overflow; exploratory 288px is excluded from 320px acceptance. Credentials and personal account values are omitted. Routine live sign-in, sign-out and Essential Only consent actions occurred.

The current deployment still exhibits fractional funding, unavailable station-distance wording, personal-account fleet copy and mobile Sign Out pointer overlap. These map to existing/local Customer corrections, not duplicate defects. Keyboard confirmation completed live logout 200 after pointer overlap was reproduced. No review-branch deployment has been performed.

No checkout, refund, PIN/credential/profile change, identity submission, support ticket or location permission was submitted. The account has no issued card or active subscription, so those success states remain blocked. Three captured 401 responses recovered at page level; this is not a new root-cause diagnosis or complete hosted authorization acceptance.

[Sanitized live customer receipt](evidence/live-customer-browser.json)

## Customer

### UI-CU-01 — Keep funding principal, fee and total exact in kobo

**Pages:** Wallet / Fund wallet.
**Affected categories:** Customer.
**Status:** Implemented; focused local evidence recorded.
**Before:** Amount 100.25 with absorbed fee renders Pay 100; customer fee can be a rounded binary calculation and total rounds to whole naira.
**After:** Whole-naira input, grouped commas and .00 accepted; fractional, exponent, malformed, negative, zero and >₦5,000,000 rejected. BigInt fee ceiling in kobo; customer total rounded upward to whole naira, remainder included in fee and disclosed. Platform fee is zero, base is unchanged. Existing expectedTotalKobo passed; API409 discards old quote and reloads settings without making a second money request.

**Verification:**
- production-customer-controls.test.cjs; existing customer card, entitlement and receipt regressions
- Focused customer suite recorded 16 passing cases; current frozen full suites passed; focused counts overlap them
- Current live funding accepts a synthetic fractional naira input and enables a rounded Pay amount without the approved whole-naira explanation. No checkout was submitted. The local branch already rejects that input and preserves an exact disclosed quote.

**Evidence:** [obligon-production-customer-fixes.json](evidence/obligon-production-customer-fixes.json) · [live-customer-browser.json](evidence/live-customer-browser.json)
**Compatibility:** Existing dashboard and payment-return destinations retained; quotes must match server confirmation.
**Recovery:** Failed reads retain truthful known/unknown state and explicit retry; no fabricated successful payment.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### UI-CU-02 — Show unavailable funding configuration as a recoverable error

**Pages:** Wallet / Fund wallet.
**Affected categories:** Customer.
**Status:** Implemented; focused local evidence recorded.
**Before:** Config request fails or is pending: fallback says fee absorbed and zero despite unknown actual bearer/fee.
**After:** Loading/malformed/failed fee settings keep payment disabled; fee/total never falls back to an absorbed zero. Visible loading/error and retry.

**Verification:**
- production-customer-controls.test.cjs; existing customer card, entitlement and receipt regressions
- Focused customer suite recorded 16 passing cases; current frozen full suites passed; focused counts overlap them

**Evidence:** [obligon-production-customer-fixes.json](evidence/obligon-production-customer-fixes.json)
**Compatibility:** Existing dashboard and payment-return destinations retained; quotes must match server confirmation.
**Recovery:** Failed reads retain truthful known/unknown state and explicit retry; no fabricated successful payment.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### UI-CU-03 — Report push registration failure and retain the actual preference

**Pages:** Profile / notifications.
**Affected categories:** Customer, Shared.
**Status:** Implemented; focused local evidence recorded.
**Before:** Permission denied, PushManager or subscription API rejects; handleToggle only finally, leaving unhandled rejection without toast or inline explanation.
**After:** Push permission/subscription rejection caught; preference remains unchanged, busy clears, toast and inline alert explain recovery. Rapid requests guarded while busy/saving.

**Verification:**
- production-customer-controls.test.cjs; existing customer card, entitlement and receipt regressions
- Focused customer suite recorded 16 passing cases; current frozen full suites passed; focused counts overlap them

**Evidence:** [obligon-production-customer-fixes.json](evidence/obligon-production-customer-fixes.json)
**Compatibility:** Existing dashboard and payment-return destinations retained; quotes must match server confirmation.
**Recovery:** Failed reads retain truthful known/unknown state and explicit retry; no fabricated successful payment.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### UI-CU-04 — Keep My Card controls reachable after a failed load

**Pages:** My Card.
**Affected categories:** Customer.
**Status:** Implemented; focused local evidence recorded.
**Before:** Card/request Promise.all rejects: hasCard null so neither card nor request action appears; open-card request rejects without catch.
**After:** Card and request settled independently; useful known card retained, new issuance blocked when request absence unknown. Loading/error/retry explicit. Effect cleanup ignores late loads. Pending request load failure and nested409 lookup failure caught.

**Verification:**
- production-customer-controls.test.cjs; existing customer card, entitlement and receipt regressions
- Focused customer suite recorded 16 passing cases; current frozen full suites passed; focused counts overlap them

**Evidence:** [obligon-production-customer-fixes.json](evidence/obligon-production-customer-fixes.json)
**Compatibility:** Existing dashboard and payment-return destinations retained; quotes must match server confirmation.
**Recovery:** Failed reads retain truthful known/unknown state and explicit retry; no fabricated successful payment.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### UI-CU-05 — Link card-purchase help to the existing Support page

**Pages:** My Card / card purchase, Support.
**Affected categories:** Customer.
**Status:** Implemented; focused local evidence recorded.
**Before:** Unexposed 503 card checkout error says contact 0700 000 0000, absent verified support configuration.
**After:** Fictional0700 support number removed; customer pointed to existing dashboard Support.

**Verification:**
- production-customer-controls.test.cjs; existing customer card, entitlement and receipt regressions
- Focused customer suite recorded 16 passing cases; current frozen full suites passed; focused counts overlap them

**Evidence:** [obligon-production-customer-fixes.json](evidence/obligon-production-customer-fixes.json)
**Compatibility:** Existing dashboard and payment-return destinations retained; quotes must match server confirmation.
**Recovery:** Failed reads retain truthful known/unknown state and explicit retry; no fabricated successful payment.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### UI-CU-06 — Show an unknown wallet state with retry instead of a false zero

**Pages:** Wallet.
**Affected categories:** Customer.
**Status:** Implemented; focused local evidence recorded.
**Before:** Wallet pending/fails before first load: balance defaults zero while only history has AsyncBoundary error.
**After:** Unknown funds/payment history show loading/unavailable. Known stale balance retained with warning, local last-success-display timestamp and wallet retry.

**Verification:**
- production-customer-controls.test.cjs; existing customer card, entitlement and receipt regressions
- Focused customer suite recorded 16 passing cases; current frozen full suites passed; focused counts overlap them

**Evidence:** [obligon-production-customer-fixes.json](evidence/obligon-production-customer-fixes.json)
**Compatibility:** Existing dashboard and payment-return destinations retained; quotes must match server confirmation.
**Recovery:** Failed reads retain truthful known/unknown state and explicit retry; no fabricated successful payment.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### UI-CU-07 — Recover a fuel-code load error on successful refresh

**Pages:** My Card / fuel authorization.
**Affected categories:** Customer.
**Status:** Implemented; focused local evidence recorded.
**Before:** Failed refresh sets error; successful refresh does not clear it and no visible load retry control.
**After:** Fuel load failures separate from payment/authorization error; successful retry clears only resolved loadError. Visible reload; outdated/unavailable fuel details block new authorization/payment while paid code/history display preserved.

**Verification:**
- production-customer-controls.test.cjs; existing customer card, entitlement and receipt regressions
- Focused customer suite recorded 16 passing cases; current frozen full suites passed; focused counts overlap them

**Evidence:** [obligon-production-customer-fixes.json](evidence/obligon-production-customer-fixes.json)
**Compatibility:** Existing dashboard and payment-return destinations retained; quotes must match server confirmation.
**Recovery:** Failed reads retain truthful known/unknown state and explicit retry; no fabricated successful payment.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### UI-CU-08 — Open a receipt deep link once while background polling continues

**Pages:** Transactions / receipt.
**Affected categories:** Customer.
**Status:** Implemented; focused local evidence recorded.
**Before:** /customer/transaction-detail?id=X opens receipt; closing modal leaves id query and next history poll resets selectedTxn.
**After:** Receipt deep link consumed by requested ID once; same-ID polling cannot reopen closed receipt, different intentional ID can still open.

**Verification:**
- production-customer-controls.test.cjs; existing customer card, entitlement and receipt regressions
- Focused customer suite recorded 16 passing cases; current frozen full suites passed; focused counts overlap them

**Evidence:** [obligon-production-customer-fixes.json](evidence/obligon-production-customer-fixes.json)
**Compatibility:** Existing dashboard and payment-return destinations retained; quotes must match server confirmation.
**Recovery:** Failed reads retain truthful known/unknown state and explicit retry; no fabricated successful payment.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### UI-PASSWORD-CHANGE-01 — Explain and complete provider password reauthentication

**Pages:** Profile / Change password, Login.
**Affected categories:** Customer, Auth.
**Status:** Corrected and independently verified for reviewed snapshot.
**Before:** The earlier review reproduced stale context, stale credentials or a mismatched session/state contract.
**After:** API success explicitly declares reauthenticationRequired for provider-managed password update; client clears captured session only for current successful required-reauth response; modal clears React user and routes login with accurate copy. Local credential flow preserves current session as intended.

**Verification:**
- Fresh actual HTTP/PG provider boundary mock requires one external update, response flagtrue and all sessions/proofs revoked; local responsefalse keeps current session valid.
- Fresh compiled client tests clear only when flagtrue and do not erase newer account on stale response.
- Fresh compiled password modal test checks explanatory copy, null React user, confirmation toast and /auth/login replace.
- Supabase provider is mocked at fetch boundary; real provider staging is unavailable.

**Evidence:** [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json)
**Compatibility:** Session generations and immutable organization IDs replace display-name or obsolete-result assumptions. Existing tokens retain their old JWT expiry until reissued.
**Recovery:** Late responses cannot restore or clear another active account; pending provider credential recovery fails closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### FIN-FINAL-06 — Require the original paid quote before withdrawal refund

**Pages:** My Card / withdrawal.
**Affected categories:** Customer.
**Status:** Resolved and independently verified.
**Before:** Withdrawal substituted mutable plan amount for the missing original charge, inconsistent with stricter verify/admin/reconcile quote handling.
**After:** Customer withdrawal requires a positive bounded charged_kobo before reservation/clawback. Missing original charge rejects without current catalog fallback.

**Verification:**
- Source-confirmed fallback ternary at withdrawal amount derivation; no production historical rows inspected.
- Independent final financial contract run: 141 passed, 0 failed/skipped; local PostgreSQL and provider mocks only

**Evidence:** [obligon-production-finance-final-review.json](evidence/obligon-production-finance-final-review.json) · [obligon-production-final-refund-boundaries.json](evidence/obligon-production-final-refund-boundaries.json)
**Compatibility:** Strict owner, original charge, currency, amount and provider identity requirements may reject incomplete historical data.
**Recovery:** Uncertain or unsupported provider outcomes retain durable debt for manual correlation rather than automatic resubmission.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### FUEL-SAVINGS — Use recorded fuel evidence and honest savings semantics

**Pages:** Overview, My Card receipts, Company reports, Partner POS.
**Affected categories:** Customer, Partner, Company.
**Status:** Implemented; focused local evidence recorded.
**Before:** Savings multiplied unweighted averages and mixed historical purchases with mutable current prices; some transactions omitted unit-price evidence.
**After:** Savings use recorded applied discount evidence. Current network comparisons are labelled estimates; sale/order quote evidence is preserved and per-transaction arithmetic is exact.

**Verification:**
- savings.integration.test.mjs; fuel-sale.integration.test.mjs; fuel-checkout.integration.test.mjs

**Evidence:** [obligon-production-fuel-integrity.json](evidence/obligon-production-fuel-integrity.json)
**Compatibility:** Historical missing metadata remains explicit instead of inventing a current quote.
**Recovery:** Unavailable comparison prices show unavailable estimates; recorded discounts remain traceable.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### PUSH-BOUNDARIES — Make device push state and outbound destinations truthful

**Pages:** Profile, Browser push registration, Shared push delivery.
**Affected categories:** Customer.
**Status:** Implemented; focused local evidence recorded.
**Before:** An account preference could imply a ready browser subscription; supplied HTTPS targets could reach internal addresses.
**After:** Profile derives device readiness from actual browser subscription state. Registration and delivery validate documented push-service origins and keys, bind DNS-to-socket addresses, reject private/reserved targets and redirects, bound sends, and surface unsubscribe failures.

**Verification:**
- push-boundaries.test.mjs: 82 no-egress endpoint/DNS/ownership cases; push-subscription.test.cjs: 7 helper cases
- Customer control regressions and final permission review distinguish account preference from ready device.

**Evidence:** [obligon-production-push-boundaries.json](evidence/obligon-production-push-boundaries.json) · [obligon-production-permissions-review.json](evidence/obligon-production-permissions-review.json)
**Compatibility:** New or changed push-service hosts require explicit vetted allowlist updates; real service-worker delivery needs hosted testing.
**Recovery:** Invalid historical subscriptions are skipped safely; failure does not falsely switch the preference to success.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### ROOT-CU-ACCESS — Keep personal records separate from a selected fleet

**Pages:** Overview, Wallet, Transactions, My Card, Notifications, Support.
**Affected categories:** Customer, Company.
**Status:** Implemented; focused local evidence recorded.
**Before:** Root integration identified an ownership, state, attribution, copy or responsive gap.
**After:** Personal APIs clear selected fleet context and scope wallet/card/history/savings/support/notification actions to owned personal records; notification dismissal now checks ownership and dismissal state.

**Verification:**
- customer-production-boundaries.integration.test.mjs
- /tmp/obligon-customer-notification-before.log
- /tmp/obligon-root-final-boundaries.log

**Evidence:** [root-increments.json](evidence/root-increments.json)
**Compatibility:** Existing role/resource contracts are preserved except deliberate denial of invalid or unsupported access.
**Recovery:** Errors remain explicit; unsupported provider effects fail closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### ROOT-CU-PHONE — Reset verification and old codes when the phone changes

**Pages:** Profile, Contact verification.
**Affected categories:** Customer, Auth.
**Status:** Implemented; focused local evidence recorded.
**Before:** Root integration identified an ownership, state, attribution, copy or responsive gap.
**After:** Changing a phone number atomically clears verification and invalidates contact codes.

**Verification:**
- customer-production-boundaries.integration.test.mjs

**Evidence:** [root-increments.json](evidence/root-increments.json)
**Compatibility:** Existing role/resource contracts are preserved except deliberate denial of invalid or unsupported access.
**Recovery:** Errors remain explicit; unsupported provider effects fail closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### ROOT-ISSUER — Fail closed on unsupported issuer spending and reconcile card state

**Pages:** My Card, Admin Card approval, Issuer callbacks.
**Affected categories:** Customer, Admin, Shared.
**Status:** Implemented; focused local evidence recorded.
**Before:** Root integration identified an ownership, state, attribution, copy or responsive gap.
**After:** Unsupported account-backed issuer spending fails closed; issuer transactions become durable reconciliation-review records; inactive maps to frozen and late activation cannot revive terminal cards.

**Verification:**
- sudo-contract.test.mjs
- payment-webhook-recovery.integration.test.mjs

**Evidence:** [root-increments.json](evidence/root-increments.json)
**Compatibility:** Existing role/resource contracts are preserved except deliberate denial of invalid or unsupported access.
**Recovery:** Errors remain explicit; unsupported provider effects fail closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### ROOT-OPTIONAL-SWEEP — Keep ordinary dashboard reads working without checkout configuration

**Pages:** Overview, Wallet.
**Affected categories:** Customer.
**Status:** Implemented; focused local evidence recorded.
**Before:** Root integration identified an ownership, state, attribution, copy or responsive gap.
**After:** Missing checkout configuration cannot make optional reconciliation reject a normal read; payment actions still fail closed.

**Verification:**
- reconciliation-fallback.integration.test.mjs and the final frozen API run prove expected missing-provider read fallback while writes remain fail closed.
- Final local Overview and Wallet states rendered without an error under mocked/disabled-provider runtime; actual 390px client/scroll 373px matches in the saved browser ledger. No checkout was submitted.

**Evidence:** [root-increments.json](evidence/root-increments.json) · [browser-verification.json](evidence/browser-verification.json)
**Compatibility:** Existing role/resource contracts are preserved except deliberate denial of invalid or unsupported access.
**Recovery:** Errors remain explicit; unsupported provider effects fail closed.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### REVIEW-PIN-TYPE-01 — Serialize PIN changes and revoke existing wallet fuel codes

**Pages:** My Card, PIN setup/change, Wallet fuel authorization.
**Affected categories:** Customer, Auth.
**Status:** Closed in current source; affected local proof recorded.
**Before:** String(newPin) regex accepted numeric/array inputs but bcrypt.hash received original non-string, allowing masked500.
**After:** Strict four-digit string validation occurs before bcrypt for new/current PIN. The locked transaction updates hash, clears active fuel code/expiry and commits action/audit together.

**Verification:**
- customer.routes.js1572..1587; customer-production-boundaries.integration.test.mjs malformed types, concurrent initial setup, wrong/correct current PIN and codeNULL assertions.

**Evidence:** [obligon-production-company-approval-review.json](evidence/obligon-production-company-approval-review.json) · [root-increments.json](evidence/root-increments.json)
**Compatibility:** PIN input must be a four-digit string. API card metadata exposes only whether a PIN is set.
**Recovery:** Wrong/stale PIN leaves the card unchanged; hash, active code revocation and audit either commit together or roll back.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### UI-CARD-REFUND-01 — Keep terminal card applications closed to payment and identity collection

**Pages:** My Card / application follow-up.
**Affected categories:** Customer.
**Status:** Implemented; focused local evidence recorded.
**Before:** Latest cancelled/unpaid request offered Complete payment. Withdrawn paid/not_started and refund_pending requests auto-opened identity details; returned paid checkout did the same.
**After:** Recognize cancelled/withdrawn/refunded/payment-refunded/issuance-refund-pending before initial auto-open, displayed payment/details branches, provider return, simulated verification, pending resume and details submission. Terminal applications expose status, Notifications/Support and the existing plan picker, subject to unchanged API guards.

**Verification:**
- 49 selected web cases passed: 27 customer control, 14 existing My Card and eight browser push helper cases; focused totals overlap broader suites.
- Uses existing owner-scoped card-request/refund/withdraw response; provider settlement is not independently exercised by component doubles.

**Evidence:** [obligon-production-customer-refund-ui.json](evidence/obligon-production-customer-refund-ui.json)
**Compatibility:** Terminal applications cannot reopen payment or identity collection. Only full-kind succeeded refund evidence can establish a completed full withdrawal.
**Recovery:** Recorded outcomes survive a later read failure. Unconfirmed/failed/review-required refunds direct to Notifications or Support and allow explicit status refresh.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### UI-CARD-REFUND-02 — Describe the actual withdrawal and refund confirmation outcome

**Pages:** My Card / withdrawal, Notifications, Support.
**Affected categories:** Customer, Admin.
**Status:** Implemented; focused local evidence recorded.
**Before:** Withdraw caller discarded API result, refreshed request, and always toasted provider-will-process; a failed follow-up read hid successful recorded withdrawal.
**After:** Use server message, reviewRequired, refundStatus and returned request. Keep recorded outcome if subsequent application read fails, close stale detail/progress/pending dialogs, show honest unconfirmed/support-review/confirmed copy. Synchronous ref plus busy button prevents two clicks from starting duplicate HTTP requests.

**Verification:**
- 49 selected web cases passed: 27 customer control, 14 existing My Card and eight browser push helper cases; focused totals overlap broader suites.
- Uses existing owner-scoped card-request/refund/withdraw response; provider settlement is not independently exercised by component doubles.

**Evidence:** [obligon-production-customer-refund-ui.json](evidence/obligon-production-customer-refund-ui.json)
**Compatibility:** Terminal applications cannot reopen payment or identity collection. Only full-kind succeeded refund evidence can establish a completed full withdrawal.
**Recovery:** Recorded outcomes survive a later read failure. Unconfirmed/failed/review-required refunds direct to Notifications or Support and allow explicit status refresh.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### UI-CARD-REFUND-03 — Require full-refund kind and current provider outcome before confirmation

**Pages:** My Card / refund follow-up.
**Affected categories:** Customer, Admin.
**Status:** Implemented; focused local evidence recorded.
**Before:** New caller probe showed a succeeded partial/excess refund could be mistaken for a completed full withdrawal, and failed status could retain stale pending copy.
**After:** Read existing /card-request/refund endpoint using owner reference; only full-kind status establishes withdrawal evidence. Succeeded full refund shows confirmed; failed/review-required outcomes show Support guidance. Explicit Check refund status refreshes the existing endpoint; errors remain visible and never claim refund settlement.

**Verification:**
- 49 selected web cases passed: 27 customer control, 14 existing My Card and eight browser push helper cases; focused totals overlap broader suites.
- Uses existing owner-scoped card-request/refund/withdraw response; provider settlement is not independently exercised by component doubles.

**Evidence:** [obligon-production-customer-refund-ui.json](evidence/obligon-production-customer-refund-ui.json)
**Compatibility:** Terminal applications cannot reopen payment or identity collection. Only full-kind succeeded refund evidence can establish a completed full withdrawal.
**Recovery:** Recorded outcomes survive a later read failure. Unconfirmed/failed/review-required refunds direct to Notifications or Support and allow explicit status refresh.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### CUSTOMER-FIRST-PIN-01 — Allow the first card PIN to be set without inventing an old PIN

**Pages:** My Card / Set or change PIN.
**Affected categories:** Customer, Auth.
**Status:** Fixed; API root11/11 and component30/30 green.
**Before:** Uninitialized card PIN required an existing PIN in the dialog, making first setup impossible.
**After:** Explicit pinSet metadata selects first setup or protected change; unknown metadata stays disabled with retry; existing PIN proof and rapid duplicate suppression remain required. Root API row lock and hash ownership revalidation remain authoritative.

**Verification:**
- Root actual API11/11 and component30/30 affected suites passed; first setup, unknown-state fail closed/retry, duplicate suppression and protected change are covered.
- Final whole API run also covers row-lock/current-hash ownership validation, malformed PIN types and atomic active fuel-code revocation.

**Evidence:** [obligon-production-residual-coverage.json](evidence/obligon-production-residual-coverage.json)
**Compatibility:** Existing protected PIN change still requires the current PIN; first setup is selected only from explicit pinSet=false.
**Recovery:** Unknown card/PIN metadata remains disabled with retry; no PIN hash or plaintext is returned as metadata.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### RES-STATION-DISTANCE-01 — Show unavailable station distance honestly in Station Details

**Pages:** Station locator, Station Details.
**Affected categories:** Customer.
**Status:** Implemented and independently reviewed; actual final local320px unavailable-distance rendering passed; live deployment still has old label.
**Before:** Station Details unconditionally appended away to backend Location unavailable; the list card already used optional numeric distance metadata correctly.
**After:** Dialog state retains optional/null distanceKm and uses the existing numeric-presence condition. Null/undefined show Distance unavailable; zero and known numeric distances retain their unit-bearing distance plus away.

**Verification:**
- Actual source for detail state, both selection paths, existing card condition, detail label and backend response contract independently read.
- All34-case focused green output and literal two-case red failures read: null/omitted scenarios failed before; null/omitted/zero/known opened-dialog scenarios all pass after. These are controlled actual-component tests, not real browser geolocation/provider proof.
- Final saved browser ledger contains finalStationRepair at/customer/stations:320px client/scroll320, unavailabletrue and falseAwayfalse. Real geolocation/provider station data remains outside this fixture proof.
- Current live Station Details appends away to Location unavailable. The local branch repair is independently reviewed and component-tested; it has not been deployed.

**Evidence:** [obligon-production-station-distance.json](evidence/obligon-production-station-distance.json) · [obligon-production-station-distance-review.json](evidence/obligon-production-station-distance-review.json) · [live-customer-browser.json](evidence/live-customer-browser.json) · [browser-verification.json](evidence/browser-verification.json)
**Compatibility:** Existing geolocation, map selection, station API, units and known/zero distance behavior remain unchanged.
**Recovery:** Missing location is an unavailable value, never a fabricated distance; no global clipping or replacement data is added.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### RES-CUSTOMER-COPY-01 — Describe the personal account and fuel card in customer copy

**Pages:** Overview / mobile greeting, Support / report a card issue.
**Affected categories:** Customer.
**Status:** Corrected and independently reviewed locally; current live deployment still uses the previous wording.
**Before:** The personal customer greeting called the account a live fleet, and the customer issue choice displayed Lost / Stolen Fleet Card.
**After:** The mobile greeting describes the personal account. The visible issue choice says Lost / Stolen Fuel Card while retaining the existing internal value and complaint payload.

**Verification:**
- The exact current greeting and issueTypes/selection/display/submit lines were independently read; state and handlers remain unchanged.
- The temporary actual-component/native FormData probe output and full source were independently read:1/1 green proves selecting the new visible label submits the retained subject Lost / Stolen Fleet Card and category complaint. This probe is not added to full-suite totals or a production submission.
- Current live mobile Overview and card-issue form retain fleet wording in the personal customer context. The local two-line copy repair retains the complaint wire contract; it has not been deployed.

**Evidence:** [obligon-production-customer-copy.json](evidence/obligon-production-customer-copy.json) · [obligon-production-customer-copy-review.json](evidence/obligon-production-customer-copy-review.json) · [live-customer-browser.json](evidence/live-customer-browser.json)
**Compatibility:** Only visible wording changed. Existing support categorization and API wire values remain compatible; no new product promise or role change.
**Recovery:** The existing report request validation, busy state, attachment handling and ticket-reference checks remain intact.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### RES-MOBILE-LOGOUT-STACK-01 — Keep Sign Out confirmation above page controls

**Pages:** Mobile Account menu, Desktop sidebar, Sign Out confirmation.
**Affected categories:** Customer.
**Status:** Implemented and independently reviewed; actual current-source mobile/desktop pointer and Escape acceptance passed.
**Before:** The mobile logout confirmation (z50) was inside the Account menu stacking context (z40). The later bottom navigation also usedz40 and intercepted the real confirmation tap; live hit test returned the Stations SVG and pointer navigation did not send logout. Separately, the desktop fixed sidebar zauto contained the same dialog and a later StationMap iframe intercepted its confirmation pointer.
**After:** Mobile Account nowz50 outranks bottom navigationz40; desktop Sidebarz40 outranks the StationMap iframe. The separately reviewed shared conditional rule lowers Cookie Consent toz30 only while an aria-modal dialog exists, retaining normal first-visitz40.

**Verification:**
- Exact current CustomerShell two-class diff and unchanged logout/modal/focus hierarchy independently reviewed. Mobile menuz50 outranks bottom navigation40; desktop Sidebar40 outranks the station iframe; shared conditional cookie rule retains its normal layer and lowers beneath active dialogs.
- Saved final actual browser receipt independently read:320px Sign Out button receives pointer and click returns/auth/login; Escape closes dialog and returns focus to Sign Out.1280x500 desktop confirmation also receives pointer and click returns/auth/login. These are local synthetic UI interactions, not real-provider or human auth-security approval.
- Current live mobile bottom navigation intercepts the Sign Out confirmation pointer. A keyboard confirmation completed logout 200. The local stacking repair has final local after-browser acceptance and has not been deployed.

**Evidence:** [obligon-production-mobile-logout-stacking.json](evidence/obligon-production-mobile-logout-stacking.json) · [obligon-production-customer-logout-stacking.json](evidence/obligon-production-customer-logout-stacking.json) · [obligon-production-mobile-logout-review.json](evidence/obligon-production-mobile-logout-review.json) · [live-customer-browser.json](evidence/live-customer-browser.json) · [customer-logout-browser.json](evidence/customer-logout-browser.json)
**Compatibility:** Existing dimensions, navigation links and authenticated logout contract remain. The mobile and desktop stacking contexts change only to keep the shared confirmation visible and clickable.
**Recovery:** The existing shared hook retains Escape/focus restoration and the same authenticated logout clears/revokes session; CSS paint acceptance must be proven in the actual browser.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

## Partner

### ROOT-SETTLEMENT-RESPONSIVE — Keep settlement tables inside their scroll container

**Pages:** Settlements.
**Affected categories:** Partner.
**Status:** Implemented; focused local evidence recorded.
**Before:** Root integration identified an ownership, state, attribution, copy or responsive gap.
**After:** Grid uses a zero minimum for the table column and confines wide tables to their horizontal scroll container.

**Verification:**
- Final saved browser recheck at 1280px has document scroll width 1265px; 820px tables stay inside 535px scroll containers. Actual 390px client/scroll 373px and 320px client/scroll 303px match, with no page-level overflow.
- Current settlement view is included in the 73-route local browser ledger; table scrolling remains available.

**Evidence:** [root-increments.json](evidence/root-increments.json) · [browser-verification.json](evidence/browser-verification.json)
**Compatibility:** Existing role/resource contracts are preserved except deliberate denial of invalid or unsupported access.
**Recovery:** Errors remain explicit; unsupported provider effects fail closed.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### ROOT-MECHANIC-COMPATIBILITY — Preserve authorized mechanic station access

**Pages:** Mechanic dashboard, Partner station reads.
**Affected categories:** Partner, Auth.
**Status:** Implemented; focused local evidence recorded.
**Before:** Root integration identified an ownership, state, attribution, copy or responsive gap.
**After:** An active mechanic may resolve the existing partner station membership; signed organization type/current membership must match, suspended access and mutation routes remain denied.

**Verification:**
- company-invitations.integration.test.mjs
- /tmp/obligon-mechanic-role-before.log
- /tmp/obligon-integrated-fixture-corrections.log

**Evidence:** [root-increments.json](evidence/root-increments.json)
**Compatibility:** Existing role/resource contracts are preserved except deliberate denial of invalid or unsupported access.
**Recovery:** Errors remain explicit; unsupported provider effects fail closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### ROOT-PAYOUT-PROOF — Bind payout outcomes to the current verified transfer attempt

**Pages:** Settlements, Payout reconciliation.
**Affected categories:** Partner, Shared.
**Status:** Implemented; focused local evidence recorded.
**Before:** Root integration identified an ownership, state, attribution, copy or responsive gap.
**After:** Recognize provider failed status consistently; require exact receipt ID, merchant reference, NGN and amount before outcomes; compare durable attempt identity for delayed failure and missing-ID recovery so stale responses cannot retire or replace newer reservations.

**Verification:**
- apps/api/tests/settlement-accounting.integration.test.mjs
- /tmp/obligon-final-payout-classifier-red.log
- /tmp/obligon-final-payout-ordering-red.log
- /tmp/obligon-production-payout-final-review.json

**Evidence:** [root-increments.json](evidence/root-increments.json)
**Compatibility:** Existing role/resource contracts are preserved except deliberate denial of invalid or unsupported access.
**Recovery:** Errors remain explicit; unsupported provider effects fail closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### PARTNER-TRANSACTION-INPUT-01 — Validate pagination and filters before querying transaction history

**Pages:** Transactions, Transaction export.
**Affected categories:** Partner.
**Status:** Implemented; focused local evidence recorded.
**Before:** Invalid pagination was coerced/interpolated into SQL, invalid dates could raise500, and same-timestamp rows lacked a stable tie-breaker.
**After:** Whole finite integer bounds are validated and parameterized; list/export share bounded string filters and real dates, with created_at/id deterministic ordering. Valid large limits remain capped.

**Verification:**
- Actual HTTP signed-partner requests reject 13 malformed bounds and eight list/export date cases with400 and no internal error logs. Two same-time own rows traverse exact stable page IDs; scoped export excludes wrong-status, wrong-date and foreign-partner rows.
- Final three-file affected run passed63/63 with real local PostgreSQL/HTTP; counts overlap root full suites.

**Evidence:** [obligon-production-final-company-partner-contracts.json](evidence/obligon-production-final-company-partner-contracts.json) · [root-increments.json](evidence/root-increments.json)
**Compatibility:** Existing verified fleets retain authorized access; pending/unverified/rejected companies can complete Support/settings/notification onboarding. Legacy self-service plan/cancel writes always deny.
**Recovery:** Existing organization verification is an admin product gate, not independent evidence of a signed legal contract. Contract acceptance and approved operating procedure require owner/legal review.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### PARTNER-STAFF-01 — Apply real staff roles, disable access and expose POS permission

**Pages:** Staff, Partner POS authorization.
**Affected categories:** Partner, Auth.
**Status:** Fixed; actual HTTP/PG4/4 and component2/2 green.
**Before:** Attendant default was not a supported API role; enabled:false returned success but ignored status, leaving staff access active. POS permission was not represented accurately.
**After:** Attendant maps to dispatcher; explicit POS access is sent/serialized from stored permissions. Suspended memberships stay visible for restoration; status changes persist and revoke following dashboard requests, validate booleans, serialize station updates and recheck current admin/owner. Owner mutation and foreign targets are refused. Existing incompatible global account roles are not silently changed.

**Verification:**
- Actual isolated HTTP/PostgreSQL partner-staff suite4/4 and component suite2/2 passed. HTTP identity is a fixture injection; current membership middleware/router/DB state are exercised.
- Explicit enabled/status booleans, unsupported roles, POS permissions, cross-organization/owner protection and following suspended staff access are covered.

**Evidence:** [obligon-production-residual-coverage.json](evidence/obligon-production-residual-coverage.json)
**Compatibility:** Existing unsupported global account roles are not silently rewritten. Attendant selection maps to the supported dispatcher membership and explicit POS capability.
**Recovery:** Suspended memberships remain visible for authorized restoration; status and station changes serialize and preserve owner/organization boundaries.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

## Company

### UI-CO-02 — Traverse all fleet vehicles and cards

**Pages:** Vehicles, Cards.
**Affected categories:** Company.
**Status:** Implemented; focused local evidence recorded.
**Before:** Fleet exceeds 100: service hardcodes limit=100, discards total, tables have no pagination.
**After:** Vehicles and cards now accept caller queries, retain total, show20 rows/page with previous/next and search resetting page. API caps100, rejects malformed/negative/fractional/array/out-of-range bounds, binds limit/offset and orders created_at,id consistently.

**Verification:**
- company-workflows.integration.test.mjs; production-company-workflows.test.cjs
- Scoped real PostgreSQL/HTTP and component proof; external service fulfillment remains manual

**Evidence:** [obligon-production-company-workflows.json](evidence/obligon-production-company-workflows.json)
**Compatibility:** Existing API bounds/owned IDs and export scopes retained; page filters reset pagination.
**Recovery:** Uncertain allocations preserve original request identity and selected organization; request failures keep drafts.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### UI-CO-03 — Page through the full filtered transaction history

**Pages:** Transactions, Reports / transaction export.
**Affected categories:** Company.
**Status:** Implemented; focused local evidence recorded.
**Before:** More than 100 matches: summary admits only first100, CSV includes all but user cannot inspect older rows in dashboard.
**After:** Transactions now request explicit offset, retain totals, use same20-row navigation. Vehicle/driver/range/date changes reset page; export retains active filters independently of pagination.

**Verification:**
- company-workflows.integration.test.mjs; production-company-workflows.test.cjs
- Scoped real PostgreSQL/HTTP and component proof; external service fulfillment remains manual

**Evidence:** [obligon-production-company-workflows.json](evidence/obligon-production-company-workflows.json)
**Compatibility:** Existing API bounds/owned IDs and export scopes retained; page filters reset pagination.
**Recovery:** Uncertain allocations preserve original request identity and selected organization; request failures keep drafts.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### UI-CO-04 — Fund and allocate the fleet budget and issue a usable fuel code

**Pages:** Billing / fuel wallet, Cards / fuel authorization.
**Affected categories:** Company, Partner.
**Status:** Implemented; focused local evidence recorded.
**Before:** Company creates virtual card but has no wallet topup/member allocation UI and no card POS-code/PIN controls; no webcalls to available endpoints.
**After:** Billing exposes company balance/ledger, quoted whole-naira funding with fail-closed settings and authorization of expectedTotalKobo, stored provider callback reference and explicit server confirmation, plus member allocations preserving request payload/key on uncertain retries and reopen/reload. Cards exposes single-use fuel code with exact server code/expiry and company-wallet explanation. No simulated funding/code result is treated as money success.

**Verification:**
- company-workflows.integration.test.mjs; production-company-workflows.test.cjs
- Scoped real PostgreSQL/HTTP and component proof; external service fulfillment remains manual

**Evidence:** [obligon-production-company-workflows.json](evidence/obligon-production-company-workflows.json)
**Compatibility:** Existing API bounds/owned IDs and export scopes retained; page filters reset pagination.
**Recovery:** Uncertain allocations preserve original request identity and selected organization; request failures keep drafts.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### UI-CO-05 — Follow support, maintenance and roadside requests to their actual status

**Pages:** Support, Maintenance, Roadside assistance.
**Affected categories:** Company.
**Status:** Implemented; focused local evidence recorded.
**Before:** Company support exposes ticket list only, no protected message fetch/reply contract; maintenance/roadside creation is present but admin dispatch/provider update workflow cannot be found.
**After:** Support tickets open protected conversations with real status, messages and replies; failed replies preserve draft, closed replies atomically reopen. Ticket list and threads scope current org even for same original user. Ticket+first message transaction prevents orphans and validates bounds. Maintenance records allow permission-protected confirmed status changes; exact cost parsing prevents malformed zero/floating rounding. Maintenance and roadside explain manual coordination and provide Support follow-up with record ID; eligible roadside requests can be cancelled with visible errors.

**Verification:**
- company-workflows.integration.test.mjs; production-company-workflows.test.cjs
- Scoped real PostgreSQL/HTTP and component proof; external service fulfillment remains manual

**Evidence:** [obligon-production-company-workflows.json](evidence/obligon-production-company-workflows.json)
**Compatibility:** Existing API bounds/owned IDs and export scopes retained; page filters reset pagination.
**Recovery:** Uncertain allocations preserve original request identity and selected organization; request failures keep drafts.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### COMPANY-INVITATIONS — Accept invitations and choose a company workspace

**Pages:** Team, All company pages, /auth/company-invitation.
**Affected categories:** Company, Auth.
**Status:** Implemented; focused local evidence recorded.
**Before:** Team invitations had no acceptance path; primary account role and company authorization were conflated.
**After:** Single-use expiring invitations bind the intended account and organization. Active owned/membership company contexts are selected with the original durable session deadline; personal identity remains intact.

**Verification:**
- company-invitations.integration.test.mjs; company-membership.integration.test.mjs; production-company-invitations.test.cjs
- Reviewed tenant selection and acceptance proof; real email delivery is an external check

**Evidence:** [obligon-production-company-invitations.json](evidence/obligon-production-company-invitations.json) · [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json)
**Compatibility:** New invitation route and explicit company context; revoked/suspended/foreign membership does not grant access.
**Recovery:** Invitation rejection remains actionable; no role escalation or shared-session workaround.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### COMPANY-FUNDING-INTENTS — Persist and confirm company funding against the actual schema

**Pages:** Billing, Company wallet funding.
**Affected categories:** Company.
**Status:** Implemented; focused local evidence recorded.
**Before:** Company funding inserted a nonexistent currency column and omitted required charged_kobo; retry/confirmation lacked immutable owner and charge binding.
**After:** Company funding now persists principal, quoted fee, charged total and selected method using established top_up fields. Confirmation credits only the stored principal once, rechecks immutable company wallet ownership/NGN currency, and does not distribute wallet funding to a collection subaccount.

**Verification:**
- company-money.integration.test.mjs: actual-schema insert, owner binding, failed checkout, quote confirmation and cross-organization/currency rejection

**Evidence:** [obligon-production-finance-final-review.json](evidence/obligon-production-finance-final-review.json) · [obligon-production-company-workflows.json](evidence/obligon-production-company-workflows.json)
**Compatibility:** No new top_up currency column or fabricated simulated success; provider checkout must return a valid link.
**Recovery:** Missing/pending or failed-then-success outcomes remain recoverable under fresh strict verification.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### UI-CONTEXT-01 — Replace page and dialog state when the selected fleet changes

**Pages:** All company pages, Company selector.
**Affected categories:** Company, Auth.
**Status:** Corrected; root-owned actual browser evidence independently inspected.
**Before:** The earlier review reproduced stale context, stale credentials or a mismatched session/state contract.
**After:** The selected-company CompanyShell main subtree is keyed by user.organizationId. Changing A to B therefore replaces the main subtree, including CompanyScreen page, modal state and their outstanding effect cleanups. Same-org rerenders preserve it.

**Verification:**
- CompanyShell selected-company main is keyed by organizationId; page and modal lifetimes are descendants.
- Root exercised actual browser on the same /company page: A shows6 vehicles and original FLT-1198 row; switching to Audit second fleet shows0 vehicles/0spend/0cards and empty transactions with no A row. Returned A reloads6 (reported by root).
- Reviewer read browser JSON and visually inspected both before/after screenshots. This is actual application React DOM behavior, not inferred from mock hook tests.

**Evidence:** [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json)
**Compatibility:** Session generations and immutable organization IDs replace display-name or obsolete-result assumptions. Existing tokens retain their old JWT expiry until reissued.
**Recovery:** Late responses cannot restore or clear another active account; pending provider credential recovery fails closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### UI-CONTEXT-02 — Bind allocation retries to the selected company ID

**Pages:** Billing / wallet allocation, Company selector.
**Affected categories:** Company, Auth.
**Status:** Corrected and independently verified for reviewed snapshot.
**Before:** The earlier review reproduced stale context, stale credentials or a mismatched session/state contract.
**After:** Pending allocation storage and its payload bind immutable organizationId. Restoring in another same-name fleet loads no pending request. API rejects a request whose expected organization differs from selected signed organization before money effects.

**Verification:**
- Fresh production-company-workflows direct component test same-name company selection cannot restore another company allocation.
- Fresh temporary existing-fixture real HTTP/PG probe: both same-name fleets available to same owner; old A payload under B returns409 with unchanged wallets/ledger and zero idempotency/audit rows; matching current org transfers the exact principal and balanced2 ledger legs.
- Temp probe uses existing fixture auth injection for route-contract test; actual signed tenant context enforcement is separately exercised by company-invitations HTTP suite.

**Evidence:** [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json)
**Compatibility:** Session generations and immutable organization IDs replace display-name or obsolete-result assumptions. Existing tokens retain their old JWT expiry until reissued.
**Recovery:** Late responses cannot restore or clear another active account; pending provider credential recovery fails closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### FIN-FINAL-01 — Authorize wallet allocations by current company membership

**Pages:** Billing / wallet allocation, Company selector.
**Affected categories:** Company, Auth.
**Status:** Resolved and independently verified.
**Before:** Money helper demanded primary account role company, contradicting current company-context and membership authorization.
**After:** Current active account plus company type and live owner/admin/wallet.manage membership authorize allocation independently of primary account role. Actual role remains attributable in audit; idempotency/payload binding is unchanged.

**Verification:**
- Fresh isolated HTTP/PostgreSQL probe expected200,received403 An authorized company actor is required;0/1passed before repair.
- Independent final financial contract run: 141 passed, 0 failed/skipped; local PostgreSQL and provider mocks only

**Evidence:** [obligon-production-finance-final-review.json](evidence/obligon-production-finance-final-review.json) · [obligon-production-final-refund-boundaries.json](evidence/obligon-production-final-refund-boundaries.json)
**Compatibility:** Strict owner, original charge, currency, amount and provider identity requirements may reject incomplete historical data.
**Recovery:** Uncertain or unsupported provider outcomes retain durable debt for manual correlation rather than automatic resubmission.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### REVIEW-COMPANY-SEARCH-01 — Keep contract-gated search destinations consistent

**Pages:** Company header search, Company menu.
**Affected categories:** Company.
**Status:** Closed in current source; affected local proof recorded.
**Before:** Topbar search filtered raw companyNav while sidebar/mobile hid operations for unapproved companies.
**After:** Topbar search now uses approval-aware visibleNav; pending destinations omit Vehicles and retain Support, verified destinations retain operational navigation.

**Verification:**
- CompanyShell.tsx104..111; production-company-invitations.test.cjs actual rendered fixture query results.

**Evidence:** [obligon-production-company-approval-review.json](evidence/obligon-production-company-approval-review.json)
**Compatibility:** Current selected company approval controls all navigation surfaces.
**Recovery:** Support remains available before operational approval; API authorization remains authoritative.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### REVIEW-COMPANY-MENU-01 — Close and reset mobile navigation when switching companies

**Pages:** Company mobile navigation, Company selector.
**Affected categories:** Company.
**Status:** Closed in current source; actual compiled22/22 and320px browser keyboard proof recorded.
**Before:** An open mobile menu was replaced by the main subtree organization key while useDialogFocus retained the disconnected previous dialog; Tab navigation could remain on the replacement container.
**After:** Stable organization ID change closes the open menu and focuses the new connected topbar menu button via its ref. Same-company rerenders keep the open menu. Reopening lets useDialogFocus capture the new dialog; existing topmost/cleanup behavior is retained.

**Verification:**
- Current CompanyShell ref/effect and unmodified useDialogFocus capture/cleanup independently reviewed. Compiled component reproduced21pass1fail then22/22green. Saved320px browser proof records selected-company switch closes the old drawer (dialogCount0), focuses the new Open company menu button, reopened Tab focuses Close company menu, and Escape restores Open company menu.

**Evidence:** [obligon-production-company-approval-review.json](evidence/obligon-production-company-approval-review.json) · [root-increments.json](evidence/root-increments.json)
**Compatibility:** Same-company rerenders retain the open menu; changing the selected organization ID closes it.
**Recovery:** The new topbar menu button receives focus; reopening uses a new dialog capture. Actual browser keyboard recheck is recorded separately from component fixture proof.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### COMPANY-CONTRACT-BILLING-01 — Require agreed-contract support for plan or cancellation changes

**Pages:** Billing, Support / contract changes.
**Affected categories:** Company, Admin.
**Status:** Implemented; focused local evidence recorded.
**Before:** Plan endpoint could mark a plan active and insert a paid invoice without a payment or agreed contract change; cancellation could mutate the same contract subscription.
**After:** Both legacy self-service billing writes deny403 with agreed-contract/Support guidance. No organization/subscription/invoice/wallet/ledger/payment-method/audit mutation occurs.

**Verification:**
- Both writes returned200 in the pre-fix HTTP run; after repair they return403 with complete before/after row snapshots identical.
- Final three-file affected run passed63/63 with real local PostgreSQL/HTTP; counts overlap root full suites.

**Evidence:** [obligon-production-final-company-partner-contracts.json](evidence/obligon-production-final-company-partner-contracts.json) · [root-increments.json](evidence/root-increments.json)
**Compatibility:** Existing verified fleets retain authorized access; pending/unverified/rejected companies can complete Support/settings/notification onboarding. Legacy self-service plan/cancel writes always deny.
**Recovery:** Existing organization verification is an admin product gate, not independent evidence of a signed legal contract. Contract acceptance and approved operating procedure require owner/legal review.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### COMPANY-APPROVAL-GATE-01 — Keep a new company in onboarding until admin contract approval

**Pages:** Overview / approval notice, Billing, Support, Settings, Notifications, All company operations after approval.
**Affected categories:** Company, Admin, Auth, Partner.
**Status:** Implemented; focused local evidence recorded.
**Before:** Company onboarding lacked an operational approval boundary and could create a14-day free period.
**After:** Pending/unverified/rejected company operations deny403 until the existing organization admin-verification status is verified. Overview,billing,support,settings and notifications retain onboarding access. New signup persists pending/canceled company metadata, zero wallet and no trial/subscription or paid invoice. Session exposes organizationVerificationStatus.

**Verification:**
- Three workflow cases each prove21 denied operations with unchanged fleet/financial snapshots, allowed support/settings/notification follow-up that cannot self-approve, and actual DB verification transition restoring four reads and fuel-code issuance. Signed-session real signup proves pending/no subscription/no invoice and retained onboarding access.
- Final three-file affected run passed63/63 with real local PostgreSQL/HTTP; counts overlap root full suites.

**Evidence:** [obligon-production-final-company-partner-contracts.json](evidence/obligon-production-final-company-partner-contracts.json) · [root-increments.json](evidence/root-increments.json)
**Compatibility:** Existing verified fleets retain authorized access; pending/unverified/rejected companies can complete Support/settings/notification onboarding. Legacy self-service plan/cancel writes always deny.
**Recovery:** Existing organization verification is an admin product gate, not independent evidence of a signed legal contract. Contract acceptance and approved operating procedure require owner/legal review.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

## Admin

### FIN-FINAL-03 — Cap individual and cumulative refunds at the original charge

**Pages:** Refund review, Support / payment refunds.
**Affected categories:** Admin, Customer.
**Status:** Resolved and independently verified.
**Before:** Neither individual nor aggregate original-charge cap existed, so unsupported over-refund requests reached the provider.
**After:** Refund helper binds immutable paid card/fuel owner, provider, reference and transaction ID. Exact BigInt aggregate full/partial reserved debt cannot exceed original charge under purchase-row and common charge advisory locks. Existing failed/uncertain debts conservatively retain capacity; explicit verified excess remains separate.

**Verification:**
- Fresh isolated HTTP/PG probes returned200 and sent mocked provider refund200000 against100000, or aggregate120000 against100000;0/2passed before repair. This proves authorization sent excessive amounts, not that a real provider would pay them.
- Independent final financial contract run: 141 passed, 0 failed/skipped; local PostgreSQL and provider mocks only

**Evidence:** [obligon-production-finance-final-review.json](evidence/obligon-production-finance-final-review.json) · [obligon-production-final-refund-boundaries.json](evidence/obligon-production-final-refund-boundaries.json)
**Compatibility:** Strict owner, original charge, currency, amount and provider identity requirements may reject incomplete historical data.
**Recovery:** Uncertain or unsupported provider outcomes retain durable debt for manual correlation rather than automatic resubmission.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### FIN-FINAL-04 — Report refund requests truthfully until the provider confirms them

**Pages:** Refund review, Customer My Card / withdrawal.
**Affected categories:** Admin, Customer.
**Status:** Resolved and independently verified.
**Before:** Caller still marked original payment refunded, returned success and notified that money was on its way despite no provider POST.
**After:** Admin/customer reserve issuance, withdrawal and durable debt in the same transaction; historical wallet-credit clawback is included. Paid charge and refund_pending issuance remain until exact successful provider lookup, with cumulative settled full/partial amount equal to original charge. Pending/manual-review API/notification copy does not claim disbursement.

**Verification:**
- Fresh isolated HTTP/PG probe charged5000kobo; providerPOST0,route200,card payment_status refunded;0/1passed before repair.
- Independent final financial contract run: 141 passed, 0 failed/skipped; local PostgreSQL and provider mocks only

**Evidence:** [obligon-production-finance-final-review.json](evidence/obligon-production-finance-final-review.json) · [obligon-production-final-refund-boundaries.json](evidence/obligon-production-final-refund-boundaries.json)
**Compatibility:** Strict owner, original charge, currency, amount and provider identity requirements may reject incomplete historical data.
**Recovery:** Uncertain or unsupported provider outcomes retain durable debt for manual correlation rather than automatic resubmission.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### PAYMENT-DIAGNOSTICS — Preserve provider plan pagination and refund attention

**Pages:** Payment diagnostics, Subscriptions, Refund review.
**Affected categories:** Admin.
**Status:** Implemented; focused local evidence recorded.
**Before:** Provider response unwrapping lost plan arrays/pagination; manual or failed refund debt could be omitted from attention.
**After:** Payment diagnostics retain full plan envelopes, collect pages and expose plan drift. Reconciliation attention includes unresolved manual/failed refund debt, including debt outside a bounded batch.

**Verification:**
- payment-plans.integration.test.mjs; refund-boundaries.integration.test.mjs

**Evidence:** [obligon-production-fuel-integrity.json](evidence/obligon-production-fuel-integrity.json) · [obligon-production-finance-final-review.json](evidence/obligon-production-finance-final-review.json)
**Compatibility:** Existing diagnostics now distinguish missing/unknown configuration from a successful empty provider result.
**Recovery:** Diagnostics do not settle uncorrelated provider debt or claim funds were returned.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### ADMIN-COMPANY-CONTRACT-APPROVAL — Provision a pending fleet and record explicit contract approval

**Pages:** Companies, Company editor, Owner onboarding.
**Affected categories:** Admin, Company, Auth.
**Status:** Implemented and verified in final frozen local API; human/external release gates remain.
**Before:** Admin provisioning could announce operational access without agreed-contract review, and newly created fleets had no company wallet for funding.
**After:** Provisioning now creates pending/canceled company state and its owned zero company wallet in one transaction, then reports actual invitation delivery. The admin editor separates verification from subscription state and requires an explicit contract-agreed checkbox for first approval. The API requires literal contractAgreed=true, preserves omitted ceilings/state, and commits the attributable old/new status audit with approval.

**Verification:**
- Final frozen API1018 tests/1016passes/0failures/2missing-env credential skips include pending listing/invitation, explicit contract confirmation, attributable atomic approval, legacy zero-wallet restoration, funded preservation and injected audit rollback.

**Evidence:** [obligon-production-company-approval-review.json](evidence/obligon-production-company-approval-review.json) · [obligon-production-admin-test-boundaries.json](evidence/obligon-production-admin-test-boundaries.json) · [root-increments.json](evidence/root-increments.json)
**Compatibility:** Previously verified company edits preserve approval without repeated contract confirmation. Approved admin review also restores an absent legacy company wallet as zero NGN and preserves any existing funded wallet.
**Recovery:** Audit/wallet/provisioning failure rolls back creation or approval. Approved missing-wallet restoration starts at zero and never infers historical balance or provider settlement; existing funded rows stay unchanged.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### ADMIN-CREDIT-01 — Validate the exact credit ceiling before provisioning a fleet

**Pages:** Companies / Add company.
**Affected categories:** Admin, Company.
**Status:** Corrected in frozen source; independent review pending.
**Before:** POST /companies rounded/coerced Number(creditLimit)||0 and admitted malformed, negative, sub-kobo and oversized credit limits before writing a new user/company and email.
**After:** Uses existing exact nairaToKobo parser before user lookup/write and email. Minimum/default0; maximum100_000_000_000kobo. Missing/null defaults0; explicitly malformed inputs reject.

**Verification:**
- Four invalid-input cases return400 with no new user/organization/email row; default, zero, 100.29 decimal and maximum1000000000.00naira persist exact expected integer kobo.

**Evidence:** [obligon-production-admin-test-boundaries.json](evidence/obligon-production-admin-test-boundaries.json)
**Compatibility:** Uses existing exact-money helpers and isolated test infrastructure; no new service or scanner framework.
**Recovery:** Invalid configured values fail before writes. Human authentication/financial review and hosted checks remain required.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### ADMIN-REPORT-01 — Display million and billion revenue at the correct scale

**Pages:** Reports / revenue summary.
**Affected categories:** Admin.
**Status:** Corrected in frozen source; independent review pending.
**Before:** Revenue >=1e9kobo used billion-naira suffix while dividing by1e11kobo, displaying10millionnaira as₦0.0B.
**After:** Billion suffix starts at1e11kobo (one billion naira). Reporting only; no money movement.

**Verification:**
- Actual HTTP metrics are₦10,000,000 at1e9kobo and₦1.0B at1e11kobo.

**Evidence:** [obligon-production-admin-test-boundaries.json](evidence/obligon-production-admin-test-boundaries.json)
**Compatibility:** Uses existing exact-money helpers and isolated test infrastructure; no new service or scanner framework.
**Recovery:** Invalid configured values fail before writes. Human authentication/financial review and hosted checks remain required.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

## Public

### ROOT-LEGAL-COPY — Remove unsupported privacy and regulatory promises

**Pages:** Privacy Policy, Personal data requests.
**Affected categories:** Public.
**Status:** Implemented; focused local evidence recorded.
**Before:** Root integration identified an ownership, state, attribution, copy or responsive gap.
**After:** Removed unsupported regulatory-compliance badges and unverified response/DPO promises; reports request receipt and actual next steps.

**Verification:**
- production-public-controls.test.cjs

**Evidence:** [root-increments.json](evidence/root-increments.json)
**Compatibility:** Existing role/resource contracts are preserved except deliberate denial of invalid or unsupported access.
**Recovery:** Errors remain explicit; unsupported provider effects fail closed.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### PUBLIC-CONTROLS — Keep navigation and request forms usable and recoverable

**Pages:** Landing, Careers, Privacy request, Support, Global motion.
**Affected categories:** Public.
**Status:** Implemented; focused local evidence recorded.
**Before:** Tablet navigation disappeared; career/privacy responses could outlive the current form; field labels, busy states and reduced-motion support were incomplete.
**After:** Header/menu breakpoints match. Careers uses a named keyboard-contained dialog with synchronous duplicate/dismissal guards. Privacy fields have explicit values and labels; failed drafts can retry and obsolete responses are ignored. Support category is associated with its field; reduced motion disables decorative animation and smooth scrolling.

**Verification:**
- production-public-controls.test.cjs: 12 cases; existing dialog and landing plan regressions retained

**Evidence:** [obligon-production-public-fixes.json](evidence/obligon-production-public-fixes.json)
**Compatibility:** Existing Individual/Organization plan grouping and brand assets preserved.
**Recovery:** Failed forms retain drafts; a late response cannot contaminate a later request.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### UI-PU-06/FuelVista — Describe only the implemented FuelVista controls

**Pages:** FuelVista solution page.
**Affected categories:** Public.
**Status:** Fixed localized unsupported-copy subset of prior UI-PU-06.
**Before:** Promised route/station limits, geofence approval and abnormal/location-mismatch detection not implemented in current caller/schema controls.
**After:** Describes existing vehicle/driver daily/monthly controls, recorded alerts, single-use wallet authorization and report export. No geofencing/alert infrastructure invented.

**Verification:**
- Residual corrected run: 36 passed, 0 failed/skipped; CLI, email text, PDF timezone and existing regression cases
- Per-file ledger distinguishes full-source, targeted, inventory-only, asset and dependency-lockfile depth.

**Evidence:** [obligon-production-residual-coverage.json](evidence/obligon-production-residual-coverage.json)
**Compatibility:** Documentation and output corrections reflect actual configured behavior; no new operational claim.
**Recovery:** Manual provider scripts were not run; no CI bootstrap changes were introduced.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### LOCAL-BRAND-FONTS — Build with the existing brand fonts without a Google download

**Pages:** Landing, Public pages, Auth pages, Customer dashboard, Partner dashboard, Company dashboard, Admin dashboard.
**Affected categories:** Public, Auth, Customer, Partner, Company, Admin, Shared.
**Status:** Implemented; final frozen build and 260-case web run passed; actual local rendered states recorded.
**Before:** Production builds depended on fetching the brand fonts from Google, and the final attempt timed out.
**After:** The same licensed font families are bundled locally and loaded through the framework local-font integration; brand type names and layout variables are preserved.

**Verification:**
- Licensed local normal-variable fonts preserve Latin/naira glyph coverage, CSS variables and existing families. Three actual font/Next-loader cases are included in the 260-case run.
- Final frozen production build passed; current local route/rendered acceptance is recorded in the final browser ledger.

**Evidence:** [obligon-production-local-fonts.json](evidence/obligon-production-local-fonts.json)
**Compatibility:** No font-family redesign or added runtime dependency.
**Recovery:** A clean build no longer needs a Google font download; license provenance remains recorded.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

## Auth

### AUTH-DISABLE-01 — Recheck current credentials and session before disabling MFA

**Pages:** MFA settings, Profile / security.
**Affected categories:** Auth, Customer.
**Status:** Corrected and independently verified for reviewed snapshot.
**Before:** The earlier review reproduced stale context, stale credentials or a mismatched session/state contract.
**After:** MFA disable locks current user and rechecks credential revision, active status, pending provider recovery and same-account live durable session before password proof and disable commit; pending MFA proofs invalidate in same transaction.

**Verification:**
- Fresh real HTTP/PG account-lock ordering: reset queued before disable completes200; old-password disable returns401; MFA remains enabled, replacement password persists, sessions revoked.
- Session revoked while disable awaits account lock returns401 and preserves MFA; legitimate disable succeeds and consumes pending proof while keeping current intended local session.

**Evidence:** [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json)
**Compatibility:** Session generations and immutable organization IDs replace display-name or obsolete-result assumptions. Existing tokens retain their old JWT expiry until reissued.
**Recovery:** Late responses cannot restore or clear another active account; pending provider credential recovery fails closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### AUTH-LOCKOUT-01 — Count concurrent failed sign-in attempts atomically

**Pages:** Login, MFA / account lockout.
**Affected categories:** Auth.
**Status:** Corrected and independently verified for reviewed snapshot.
**Before:** The earlier review reproduced stale context, stale credentials or a mismatched session/state contract.
**After:** Failed counter increment/lockout derive atomically from current PostgreSQL count, guarded by original password hash and provider credential revision.

**Verification:**
- Fresh five concurrent wrong passwords return401, persist count5 and future lockout, then correct password is denied.
- Fresh stale password failure blocked by row lock then credential replacement returns401 without incrementing the replacement credential counter.

**Evidence:** [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json)
**Compatibility:** Session generations and immutable organization IDs replace display-name or obsolete-result assumptions. Existing tokens retain their old JWT expiry until reissued.
**Recovery:** Late responses cannot restore or clear another active account; pending provider credential recovery fails closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### AUTH-UI-SESSION-01 — Reject stale login and MFA results before storing or navigating

**Pages:** Login, MFA, Successful sign-in.
**Affected categories:** Auth, Customer, Partner, Company, Admin.
**Status:** Corrected and independently verified for reviewed snapshot.
**Before:** The earlier review reproduced stale context, stale credentials or a mismatched session/state contract.
**After:** Auth service guards revision, exact token identity and original pending MFA proof before storage writes; AuthProvider guards generation; MFA UI rejects obsolete/unmounted results before user state and navigation.

**Verification:**
- Fresh direct actual compiled service tests cover pending MFA/password login after logout/new login, replacing proof, MFA response replays, late logout and provider password change.
- Fresh AuthProvider tests cover older successful/failed password login after newer account authenticated.
- Fresh MFA UI completion after revision invalidation or unmount causes no session update or navigation.
- Client React component tests use mock hook fixtures, not full browser reconciliation/cross-tab proof.

**Evidence:** [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json)
**Compatibility:** Session generations and immutable organization IDs replace display-name or obsolete-result assumptions. Existing tokens retain their old JWT expiry until reissued.
**Recovery:** Late responses cannot restore or clear another active account; pending provider credential recovery fails closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### UI-MFA-BACKUP-01 — Normalize accepted backup codes before MFA submission

**Pages:** MFA / backup-code sign-in.
**Affected categories:** Auth.
**Status:** Corrected and independently verified for reviewed snapshot.
**Before:** The earlier review reproduced stale context, stale credentials or a mismatched session/state contract.
**After:** Accepted optional-hyphen backup values trim, uppercase and serialize to generated XXXX-XXXX format before challenge submission.

**Verification:**
- Fresh compiled UI tests accept lowercase spaced hyphenated and separator-free a1b2c3d4 and submit A1B2-C3D4.
- Fresh actual HTTP backup challenge remains one-use under10 concurrent completions; cannot bypass prior password proof.

**Evidence:** [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json)
**Compatibility:** Session generations and immutable organization IDs replace display-name or obsolete-result assumptions. Existing tokens retain their old JWT expiry until reissued.
**Recovery:** Late responses cannot restore or clear another active account; pending provider credential recovery fails closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### AUTH-REFRESH-LIFETIME-01 — Match remembered refresh tokens to the durable session deadline

**Pages:** Login / Remember me, Session refresh, Company selector.
**Affected categories:** Auth, Customer, Partner, Company, Admin.
**Status:** Corrected and independently verified for reviewed frozen auth snapshot.
**Before:** The earlier review reproduced stale context, stale credentials or a mismatched session/state contract.
**After:** Refresh JWT numeric exp equals persisted sessions.expires_at, including remembered30d/ordinary7d. Company context selection/return reissues against original locked expiry and same SID.

**Verification:**
- Fresh actual HTTP test remembered refresh on simulated day8 succeeds and at durable expiry rejects.
- Fresh normal/remembered exp equals stored expiry to integer second; selection/return preserves original expiry and SID.
- Fresh revoked or DB-expired session denies otherwise unexpired remembered token.
- Existing tokens retain old exp until reissue; standard JWT precision may expire less than1s before millisecond DB expiry.
- ordinary/remembered JWT exp equals stored session expiry
- real HTTP remembered refresh works on simulated day8 and rejects at stored expiry
- selection and personal context return retain durable expiry and session identity
- revoked/database-expired session rejects an otherwise unexpired remembered JWT

**Evidence:** [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json) · [obligon-production-auth-session-final.json](evidence/obligon-production-auth-session-final.json)
**Compatibility:** Session generations and immutable organization IDs replace display-name or obsolete-result assumptions. Existing tokens retain their old JWT expiry until reissued.
**Recovery:** Late responses cannot restore or clear another active account; pending provider credential recovery fails closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### AUTH-SIDLESS-ACCESS-01 — Require every normal access token to belong to a live session

**Pages:** Login, All authenticated dashboards and APIs.
**Affected categories:** Auth, Customer, Partner, Company, Admin.
**Status:** Corrected and independently verified for reviewed frozen auth snapshot.
**Before:** The earlier review reproduced stale context, stale credentials or a mismatched session/state contract.
**After:** Normal access JWT requires nonempty SID and live unrevoked unexpired same-subject durable session; existing scoped partner API-key branch remains separate.

**Verification:**
- Fresh actual HTTP session endpoint denies a signed sidless JWT before and after logout; valid bound access succeeds before logout and rejects after.
- Missing/wrong-account/revoked/expired session ID tests reject.
- Reviewed production access issuers all provide SID, refresh issuers all pass DB expiry; signer/middleware/auth final hashes match frozen artifact.
- sidless JWT rejects before and after logout while valid bound JWT succeeds before logout
- missing, wrong-account, revoked and expired session IDs reject

**Evidence:** [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json) · [obligon-production-auth-session-final.json](evidence/obligon-production-auth-session-final.json)
**Compatibility:** Session generations and immutable organization IDs replace display-name or obsolete-result assumptions. Existing tokens retain their old JWT expiry until reissued.
**Recovery:** Late responses cannot restore or clear another active account; pending provider credential recovery fails closed.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### AUTH-NAVIGATION — Route only verified sessions to safe role destinations

**Pages:** Login, Admin login, MFA, Success, Session expired, In progress, Failure.
**Affected categories:** Auth, Customer, Partner, Company, Admin.
**Status:** Implemented; focused local evidence recorded.
**Before:** Expired-session, progress, failure, success and admin entry pages did not consistently honor MFA, roles or safe return paths.
**After:** A shared internal-path validator rejects external and encoded unsafe paths; every role has a verified destination. MFA completion updates mounted context, backup codes are normalized, and setup errors remain real errors.

**Verification:**
- production-auth-navigation.test.cjs; mfa-password-proof.test.cjs; auth-session-races.test.cjs
- Final auth review recorded 82 API and 63 selected web cases; these overlap broader suites and are not added to them.

**Evidence:** [obligon-production-auth-navigation.json](evidence/obligon-production-auth-navigation.json) · [obligon-production-auth-session-races.json](evidence/obligon-production-auth-session-races.json) · [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json)
**Compatibility:** Existing login links remain; non-admin credentials cannot announce admin authorization.
**Recovery:** Failed setup/challenge preserves a genuine retry; no fabricated MFA secret or QR.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### AUTH-PASSWORD-RESET — Serialize reset, contact codes and credential replacement

**Pages:** Forgot password, Verification, Profile / password change, MFA.
**Affected categories:** Auth, Customer, Partner, Company, Admin.
**Status:** Implemented; focused local evidence recorded.
**Before:** Concurrent reset replays and stale MFA proofs could survive credential replacement; failed guess counting was not durably bounded.
**After:** Account locks serialize one-time claims and credential revisions. Guess limits, expiry and password bounds are checked before commit; reset revokes durable sessions and MFA proofs atomically. Provider failures retain a pending recovery revision.

**Verification:**
- password-reset-claim.integration.test.mjs; mfa-password-proof.integration.test.mjs
- Real local account-lock, rollback and concurrent completion cases; provider calls mocked

**Evidence:** [obligon-production-password-reset-fix.json](evidence/obligon-production-password-reset-fix.json) · [obligon-production-auth-session-races.json](evidence/obligon-production-auth-session-races.json) · [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json)
**Compatibility:** Provider-managed password change explicitly requires reauthentication; local flow preserves only the intended session.
**Recovery:** A pending provider update cannot manufacture success; a new reset code is required for recovery.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### RETIRED-TEST-ACCESS — Retire shared temporary partner credentials

**Pages:** Partner login fixture, Startup, Demo seed.
**Affected categories:** Auth, Partner.
**Status:** Implemented; focused local evidence recorded.
**Before:** The repository still supported the previously requested hardcoded partner fixture.
**After:** Temporary partner access defaults off and cannot be enabled in production; startup suspends the known account and revokes sessions. Nonproduction fixtures require an explicit supplied password. Demo setup uses parameterized corrective values.

**Verification:**
- temporary-partner-account.integration.test.mjs; demo-accounts.test.mjs

**Evidence:** [obligon-production-remaining-access-audit.json](evidence/obligon-production-remaining-access-audit.json)
**Compatibility:** Historical fixture cleanup takes effect only after approved code deployment; source removal alone does not prove hosted session revocation.
**Recovery:** No production test-login bypass is introduced; fixture accounts remain isolated to local tests.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### RES-DEV-01 — Repair local demo accounts with valid parameterized state

**Pages:** Demo login, Partner demo dashboard, Mechanic demo dashboard.
**Affected categories:** Auth, Partner.
**Status:** Fixed and actual isolated CLI/PG rechecked.
**Before:** Parameterized existing demo repair bound the literal quoted string active, violating users_status_check for a suspended account.
**After:** Binds plain active and actual boolean false/true; restores intended fixture states, preserves existing password and remains idempotent across2 CLI invocations.

**Verification:**
- Residual corrected run: 36 passed, 0 failed/skipped; CLI, email text, PDF timezone and existing regression cases
- Per-file ledger distinguishes full-source, targeted, inventory-only, asset and dependency-lockfile depth.

**Evidence:** [obligon-production-residual-coverage.json](evidence/obligon-production-residual-coverage.json)
**Compatibility:** Documentation and output corrections reflect actual configured behavior; no new operational claim.
**Recovery:** Manual provider scripts were not run; no CI bootstrap changes were introduced.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### RES-EMAIL-01 — Render the password-reset subject without broken characters

**Pages:** Forgot password / reset email.
**Affected categories:** Auth.
**Status:** Fixed.
**Before:** Password reset subject contained actual replacement-character mojibake.
**After:** Readable reset subject retains one-time code; template output assertion rejects replacement characters.

**Verification:**
- Residual corrected run: 36 passed, 0 failed/skipped; CLI, email text, PDF timezone and existing regression cases
- Per-file ledger distinguishes full-source, targeted, inventory-only, asset and dependency-lockfile depth.

**Evidence:** [obligon-production-residual-coverage.json](evidence/obligon-production-residual-coverage.json)
**Compatibility:** Documentation and output corrections reflect actual configured behavior; no new operational claim.
**Recovery:** Manual provider scripts were not run; no CI bootstrap changes were introduced.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### RES-SESSION-COPY-01 — Call a successful session check session verification

**Pages:** Sign-in progress, Sign-in success.
**Affected categories:** Auth.
**Status:** Fixed localized copy; tsc passed.
**Before:** A valid session was described as identity verified although this page only verifies session validity.
**After:** Session checking/verified labels describe the actual authentication check; identity assurance is no longer claimed.

**Verification:**
- Residual corrected run: 36 passed, 0 failed/skipped; CLI, email text, PDF timezone and existing regression cases
- Per-file ledger distinguishes full-source, targeted, inventory-only, asset and dependency-lockfile depth.

**Evidence:** [obligon-production-residual-coverage.json](evidence/obligon-production-residual-coverage.json)
**Compatibility:** Documentation and output corrections reflect actual configured behavior; no new operational claim.
**Recovery:** Manual provider scripts were not run; no CI bootstrap changes were introduced.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### AUTH-NARROW-REFLOW — Fit MFA digits and session-status cards on a 320px screen

**Pages:** MFA / challenge, Failure, In progress, Successful sign-in.
**Affected categories:** Auth.
**Status:** Implemented; final frozen build/web and actual 320px/1280px reflow acceptance passed.
**Before:** Actual 320px browser measurements found the MFA challenge scroll width 368px and a session-status card extending 2px beyond its 303px available width.
**After:** MFA digit inputs now form a six-column shrinkable mobile grid; status cards use smaller mobile padding/headings and local wrapping. Original larger-screen spacing, type, labels, focus handlers, autocomplete and disabled states are preserved.

**Verification:**
- Affected TypeScript check and focused whitespace diff check exited 0. Localized reversible CSS correction; no mirror source-layout tests were added.
- Saved actual browser measurements show no document overflow at 320px or 1280px. Six mobile digit targets measure 45px; desktop boxes retain 48px/flex. Status headings retain 24px mobile/30px desktop. Missing/expired sign-in challenge is an expected disabled state, not a newly reported defect.

**Evidence:** [obligon-production-narrow-auth-layout.json](evidence/obligon-production-narrow-auth-layout.json) · [narrow-auth-after.json](evidence/narrow-auth-after.json)
**Compatibility:** No authentication or proof logic changed. The original desktop layout resumes at the existing small breakpoint.
**Recovery:** Inputs and status text shrink and wrap within their actual container, preserving reachable controls.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

## Shared

### UI-REFRESH-01 — Let the active polling refresh finish without cancelling itself

**Pages:** Customer dashboard, Partner dashboard, Company dashboard, Admin dashboard.
**Affected categories:** Customer, Partner, Company, Admin, Shared.
**Status:** Corrected and independently verified for reviewed snapshot.
**Before:** The earlier review reproduced stale context, stale credentials or a mismatched session/state contract.
**After:** Same-input refresh drops while inFlight holds a request without changing silentNonce and invalidating the running effect; dependency/reload cleanup and request-sequence ownership still discard stale responses.

**Verification:**
- Fresh source-compiled hook probe resolves initial records, starts a refresh, fires overlap without new request, resolves first refresh and receives Fresh records.
- Fresh stale old location completion cannot unlock a current location request; initial-error recovery/stale warning/clear behavior remains green.

**Evidence:** [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json)
**Compatibility:** Session generations and immutable organization IDs replace display-name or obsolete-result assumptions. Existing tokens retain their old JWT expiry until reissued.
**Recovery:** Late responses cannot restore or clear another active account; pending provider credential recovery fails closed.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### FIN-FINAL-02 — Reject non-NGN wallets before naira fuel debits

**Pages:** Customer My Card, Company Cards, Partner POS.
**Affected categories:** Customer, Company, Partner, Shared.
**Status:** Resolved and independently verified.
**Before:** POS debited that wallet using naira-denominated minor units without checking wallet currency.
**After:** Locked wallet selection includes currency, and NGN pricing cannot debit non-NGN personal or company wallet. Rejection preserves code, balances and ledger.

**Verification:**
- Fresh isolated PostgreSQL probe expected currency rejection, but sale succeeded;0/1passed before repair.
- Independent final financial contract run: 141 passed, 0 failed/skipped; local PostgreSQL and provider mocks only

**Evidence:** [obligon-production-finance-final-review.json](evidence/obligon-production-finance-final-review.json) · [obligon-production-final-refund-boundaries.json](evidence/obligon-production-final-refund-boundaries.json)
**Compatibility:** Strict owner, original charge, currency, amount and provider identity requirements may reject incomplete historical data.
**Recovery:** Uncertain or unsupported provider outcomes retain durable debt for manual correlation rather than automatic resubmission.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### FIN-FINAL-05 — Rotate unresolved refund work and retain review attention

**Pages:** Refund reconciliation, Admin Payment diagnostics.
**Affected categories:** Shared, Admin, Customer.
**Status:** Resolved and independently verified.
**Before:** ORDER BY created_at never rotates unresolvable rows, starving future refundable debts. Summary ignored refund reviewRequired/errored.
**After:** Refund sweeps order by updated_at/created_at/id and rotate every unresolved row in finally. Global manual/failed debt counts include items outside the batch and contribute to attention. Lost-response claims never automatically resubmit.

**Verification:**
- Fresh isolated PG probe with limit1: older review_required row selected across3sweeps; newer queued refund generated0mockPOST;0/1passed before repair.
- Independent final financial contract run: 141 passed, 0 failed/skipped; local PostgreSQL and provider mocks only

**Evidence:** [obligon-production-finance-final-review.json](evidence/obligon-production-finance-final-review.json) · [obligon-production-final-refund-boundaries.json](evidence/obligon-production-final-refund-boundaries.json)
**Compatibility:** Strict owner, original charge, currency, amount and provider identity requirements may reject incomplete historical data.
**Recovery:** Uncertain or unsupported provider outcomes retain durable debt for manual correlation rather than automatic resubmission.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### FIN-FINAL-07 — Record the successful provider receipt on delayed settlement

**Pages:** Customer Wallet, Customer My Card, Company Billing, Payment callbacks / reconciliation.
**Affected categories:** Shared, Customer, Company, Partner.
**Status:** Resolved and independently verified.
**Before:** COALESCE(existing,verified) preserves old failed/init identifier when recognizing the successful charge, violating receipt traceability.
**After:** Verified successful processor ID replaces old failed/init ID on the first paid transition in top-up/card manual/webhook/cron owners. Already-paid duplicate guards preserve the recognized successful identity. Independent card probes and top-up webhook failed→paid test exercise this.

**Verification:**
- Source-confirmed successful-transition SQL in completeTopUp, card manual verification, card reconciliation and webhook. No claim credit amount was wrong.
- Independent final financial contract run: 141 passed, 0 failed/skipped; local PostgreSQL and provider mocks only

**Evidence:** [obligon-production-finance-final-review.json](evidence/obligon-production-finance-final-review.json) · [obligon-production-final-refund-boundaries.json](evidence/obligon-production-final-refund-boundaries.json)
**Compatibility:** Strict owner, original charge, currency, amount and provider identity requirements may reject incomplete historical data.
**Recovery:** Uncertain or unsupported provider outcomes retain durable debt for manual correlation rather than automatic resubmission.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### EXACT-MONEY — Parse and calculate amounts in exact bounded kobo

**Pages:** Wallet, My Card, Company billing, Partner POS, Admin refunds, Shared payment providers.
**Affected categories:** Shared, Partner, Company, Admin.
**Status:** Implemented; focused local evidence recorded.
**Before:** Floating-point multiplication, inferred provider units and silent rounding could change charged amount, quotes or accepted precision.
**After:** Exact decimal-to-kobo parsing, BigInt arithmetic and bounded integer contracts cover fee, discount, projection, fuel, refund and provider calculations. Frozen principal/fee/charged quotes remain distinct; customer-borne whole-naira rounding is disclosed rather than fabricated.

**Verification:**
- money-amounts.test.mjs; exact-money-provider.test.mjs; exact-money-projection.integration.test.mjs
- Focused exact-money/fuel/refund proof overlaps final financial suites; no summed total claimed.

**Evidence:** [obligon-production-exact-money.json](evidence/obligon-production-exact-money.json) · [obligon-production-fuel-integrity.json](evidence/obligon-production-fuel-integrity.json) · [obligon-production-finance-final-review.json](evidence/obligon-production-finance-final-review.json)
**Compatibility:** Overprecision and unknown units fail rather than being rounded silently; retained Paystack minor-unit and Flutterwave major-unit contracts stay explicit.
**Recovery:** Incomplete or mismatched provider evidence remains pending/manual review; no credit is issued from an inferred amount.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### PAYMENT-RECOVERY — Verify immutable payment evidence and recover callbacks atomically

**Pages:** Wallet, My Card, Company billing, Partner subscriptions, Admin payment diagnostics.
**Affected categories:** Shared, Partner, Company, Admin.
**Status:** Implemented; focused local evidence recorded.
**Before:** Receipt-only webhook claims could suppress money effects after process death; delayed successful attempts could be stranded or retain a failed processor identity.
**After:** Callbacks reverify provider, reference, NGN currency and amount against the saved quote. Event claim and owned financial effect share a transaction; old receipt-only claims can recover. Delayed paid transitions store the authoritative successful processor ID and preserve exact excess refund debt.

**Verification:**
- payment-webhook-recovery.integration.test.mjs; reconciliation-fallback.integration.test.mjs; payment-verification-contract.test.mjs
- Concurrency, rollback, duplicate callbacks and process-termination/restart proofs use local provider fixtures.

**Evidence:** [obligon-production-finance-final-review.json](evidence/obligon-production-finance-final-review.json) · [obligon-production-refund-recovery.json](evidence/obligon-production-refund-recovery.json) · [obligon-production-exact-money.json](evidence/obligon-production-exact-money.json)
**Compatibility:** Simulation never substitutes for configured production verification; old hosted references are resolved only by strict successful evidence.
**Recovery:** Uncertain payable intents remain discoverable and fair sweeps rotate unresolved work; receipt-only historical claims require supported owner recovery.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### REFUND-RECOVERY — Reserve refund capacity and correlate final provider states

**Pages:** Admin support/refunds, Customer withdrawal, Shared reconciliation.
**Affected categories:** Shared, Customer, Admin.
**Status:** Implemented; focused local evidence recorded.
**Before:** Provider-specific terminal states, wrong provider dispatch, lost responses and insufficient immutable charge evidence could strand or misclassify refunds.
**After:** Refund reservation is exact and charge-bounded. Provider dispatch happens once after durable claim; lookup correlates refund, original charge, NGN amount/currency and reference. Documented final states settle debt; generic completed or incomplete evidence remains pending.

**Verification:**
- refund-recovery.integration.test.mjs; refund-boundaries.integration.test.mjs; refund-ambiguity.integration.test.mjs

**Evidence:** [obligon-production-refund-recovery.json](evidence/obligon-production-refund-recovery.json) · [obligon-production-final-refund-boundaries.json](evidence/obligon-production-final-refund-boundaries.json) · [obligon-production-finance-final-review.json](evidence/obligon-production-finance-final-review.json)
**Compatibility:** Fractional/subminimum Flutterwave refunds and lookup responses without currency remain manual-review debt; no unsupported rounding.
**Recovery:** Lost-response claims never auto-resubmit. Cumulative confirmed settled refund amount must equal the original charge before marking a full refund.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### DATABASE-PRIVATE-ACCESS — Restrict all private application database tables

**Pages:** All authenticated dashboards, Public catalogs, Backend database.
**Affected categories:** Customer, Partner, Company, Admin, Public, Auth, Shared.
**Status:** Implemented; focused local evidence recorded.
**Before:** Direct Data API table/column/policy grants could expose private identity, sessions, cards or money data independently of application authorization.
**After:** Migration 032 explicitly protects 59 private tables and leaves four published catalogs filtered, column-scoped and read-only. It removes private Data API grants/policies and unnecessary identity RPC execution while preserving trusted backend access.

**Verification:**
- database-private-access.integration.test.mjs: 3 real-role PostgreSQL tests
- 63-table inventory, 590 denied table commands, column privileges, catalog filters, backend access and migration reapplication checked.

**Evidence:** [obligon-production-database-access-fix.json](evidence/obligon-production-database-access-fix.json)
**Compatibility:** No rows/backfill/ownership rewrites. Unknown external direct Data API clients may break; future tables and hosted default ACLs need explicit review.
**Recovery:** Transactional startup migration and metadata lock timeout prevent partial change. Do not restore broad private grants as rollback; recover approved backend access under qualified review.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### UPLOAD-COMPATIBILITY — Upgrade Multer and keep multipart failures actionable

**Pages:** Public careers/support, Customer support, Partner station assets/disputes, Admin private attachments.
**Affected categories:** Public, Customer, Partner, Admin, Shared.
**Status:** Implemented; focused local evidence recorded.
**Before:** Multer/parser input failures surfaced as masked 500s; a valid partner dispute INSERT had a bind-count mismatch.
**After:** Multer 2.4 replaces the vulnerable runtime dependency. Known oversized uploads return 413; malformed framing and supported typed limits return 400. Unknown storage/database faults remain masked 5xx. Partner disputes now use nine scoped values and reject foreign station references before storage.

**Verification:**
- upload-compatibility.integration.test.mjs: 9 new real-HTTP cases plus 9 error-contract cases (18 passed)
- Five upload endpoints, exact 10 MiB boundary, authenticated roles, storage and parser recovery checked.

**Evidence:** [obligon-production-upload-compatibility.json](evidence/obligon-production-upload-compatibility.json)
**Compatibility:** Existing allowed file types, size caps and safe error contracts retained; genuine server errors are not relabelled client errors.
**Recovery:** Malformed upload does not write records/files; health stays responsive. Storage/provider availability remains an external gate.
**Qualified human review:** Required by policy; reported approval is recorded in the current central gate for this unchanged source set.

### DEPENDENCIES — Reconcile independent dependency scanners

**Pages:** API runtime dependency, Build tooling.
**Affected categories:** Customer, Partner, Company, Admin, Public, Auth, Shared.
**Status:** Implemented; focused local evidence recorded.
**Before:** Initial production audit disagreed with independent Trivy results for the old Multer package.
**After:** Final production pnpm audit and Trivy report no production vulnerabilities after Multer 2.4. All-dependency pnpm audit still reports one high development-only braces advisory with no published patched version.

**Verification:**
- Fresh final pnpm production/all dependency metadata and Trivy Results inspected

**Evidence:** [obligon-production-prod-dependency-audit-final.json](evidence/obligon-production-prod-dependency-audit-final.json) · [obligon-production-all-dependency-audit-final.json](evidence/obligon-production-all-dependency-audit-final.json) · [obligon-production-trivy-final.json](evidence/obligon-production-trivy-final.json)
**Compatibility:** Dependency scan is bounded to installed/locked packages; it is not proof of application security or a release approval.
**Recovery:** The remaining dev advisory is disclosed; no invented override, scan framework or CI changes were added.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### ROOT-STALE-PROOF — Make payment and export regressions assert real current behavior

**Pages:** Customer Wallet / settlement regression coverage, Partner Transactions / export regression coverage.
**Affected categories:** Shared, Customer, Partner.
**Status:** Implemented; focused local evidence recorded.
**Before:** Root integration identified an ownership, state, attribution, copy or responsive gap.
**After:** Negative posting assertion now requires the real applyLedgerEntry block and checks principal rather than slicing a missing function; export assertions follow validated filter helpers and remain backed by actual HTTP scoped export checks.

**Verification:**
- apps/api/tests/late-settlement.test.mjs
- apps/api/tests/partner-dashboard-wiring.test.mjs
- apps/api/tests/partner-production-readiness.test.mjs
- /tmp/obligon-production-api-verified.log

**Evidence:** [root-increments.json](evidence/root-increments.json)
**Compatibility:** Existing role/resource contracts are preserved except deliberate denial of invalid or unsupported access.
**Recovery:** Errors remain explicit; unsupported provider effects fail closed.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### SHARED-ASYNC-STATES — Retain last successful data and forward empty-state actions

**Pages:** Customer dashboard, Partner dashboard, Company dashboard, Admin dashboard, Empty first-use pages.
**Affected categories:** Shared, Customer, Partner, Company, Admin.
**Status:** Implemented; focused local evidence recorded.
**Before:** A refresh error erased useful records and empty-boundary actions could disappear.
**After:** Shared async state keeps last good data with a nonblocking warning, explicit retry and proper stale response ownership. EmptyState action props are forwarded rather than dropped.

**Verification:**
- production-shared-state.test.cjs; async-location-regression.test.cjs; production-customer-controls.test.cjs

**Evidence:** [obligon-production-auth-ui-final-review.json](evidence/obligon-production-auth-ui-final-review.json)
**Compatibility:** Initial load failure remains a blocking error; stale data is labelled rather than treated as current.
**Recovery:** Recovery replaces stale records only when the current request succeeds.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### TEST-MONEY-OPTIN-01 — Require an isolated local database for money regression tests

**Pages:** Company Billing and Customer Wallet (regression infrastructure).
**Affected categories:** Shared, Company, Customer.
**Status:** Corrected in frozen source; independent review pending.
**Before:** No OBLIGON_TEST_DATABASE_URL made before-hook return, but all9 tests and broad prefix DELETE cleanup still queried DATABASE_URL.
**After:** All9 tests explicitly skip without opt-in; app DB/money/wallet modules import only after PostgreSQL protocol+localhost check and owned-schema setup. Fixtures use a synthetic plan and local delivery. Cleanup closes only created application/setup pools and drops only the schema whose successful creation was recorded; no prefix deletes or ambient fallback.

**Verification:**
- Same safe invalid-URL command exits0, tests9/pass0/fail0/skipped9. With explicit local opt-in all9 money tests pass in owned schema.

**Evidence:** [obligon-production-admin-test-boundaries.json](evidence/obligon-production-admin-test-boundaries.json)
**Compatibility:** Uses existing exact-money helpers and isolated test infrastructure; no new service or scanner framework.
**Recovery:** Invalid configured values fail before writes. Human authentication/financial review and hosted checks remain required.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### TEST-SUDO-SECRET-01 — Include issuer webhook secrets in configured-value scans

**Pages:** Issuer callbacks / credential regression coverage.
**Affected categories:** Shared, Admin, Customer.
**Status:** Corrected in frozen source; independent review pending.
**Before:** SUDO_WEBHOOK_SECRET was excluded from sensitive values even though the Sudo verifier uses it as an HMAC signing secret.
**After:** Removes that public exemption and adds synthetic classification test; public Sudo URL and Flutterwave public-key classification stays public.

**Verification:**
- Synthetic classification and gitignore tests pass;2 real-env/history comparison checks explicitly skip because no comparison.env file was supplied.

**Evidence:** [obligon-production-admin-test-boundaries.json](evidence/obligon-production-admin-test-boundaries.json)
**Compatibility:** Uses existing exact-money helpers and isolated test infrastructure; no new service or scanner framework.
**Recovery:** Invalid configured values fail before writes. Human authentication/financial review and hosted checks remain required.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### RES-DOC-01 — Document the actual payment, setup and deployment contracts

**Pages:** All dashboards and public pages / deployment setup.
**Affected categories:** Shared, Customer, Partner, Company, Admin, Public, Auth.
**Status:** Fixed.
**Before:** README advertised retired shared temporary login, Paystack primary processing, incorrect frontend-origin callback URLs and implicit offline mode.
**After:** Documents disabled/retired temporary bootstrap without password literal, Flutterwave primary plus legacy compatibility, public API callback origin and current explicit mock/live mode; actual provider/deploy/human-review gates disclosed.

**Verification:**
- Residual corrected run: 36 passed, 0 failed/skipped; CLI, email text, PDF timezone and existing regression cases
- Per-file ledger distinguishes full-source, targeted, inventory-only, asset and dependency-lockfile depth.

**Evidence:** [obligon-production-residual-coverage.json](evidence/obligon-production-residual-coverage.json)
**Compatibility:** Documentation and output corrections reflect actual configured behavior; no new operational claim.
**Recovery:** Manual provider scripts were not run; no CI bootstrap changes were introduced.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### RES-DOC-02 — Replace stale completion claims with current acceptance and release gates

**Pages:** All dashboards and public pages / acceptance documentation.
**Affected categories:** Shared, Customer, Partner, Company, Admin, Public, Auth.
**Status:** Fixed.
**Before:** Current guide still said no backend/persistence; milestone claimed all domains100% and only keys remain. Earlier pass report could be mistaken for current acceptance.
**After:** Current live API/persistence and pending release evidence stated; historical report annotated, original historical counts preserved.

**Verification:**
- Residual corrected run: 36 passed, 0 failed/skipped; CLI, email text, PDF timezone and existing regression cases
- Per-file ledger distinguishes full-source, targeted, inventory-only, asset and dependency-lockfile depth.

**Evidence:** [obligon-production-residual-coverage.json](evidence/obligon-production-residual-coverage.json)
**Compatibility:** Documentation and output corrections reflect actual configured behavior; no new operational claim.
**Recovery:** Manual provider scripts were not run; no CI bootstrap changes were introduced.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### RES-PDF-01 — Use the business timezone in downloaded receipts and reports

**Pages:** Customer Transactions / receipts, Company Billing / invoices, Company Reports, Partner Reports, Admin Reports.
**Affected categories:** Shared, Customer, Company, Partner, Admin.
**Status:** Fixed and actual PDF output rechecked.
**Before:** Receipt/invoice/report dates used host timezone, disagreeing with BUSINESS_TIMEZONE dashboard around calendar-day boundaries.
**After:** All three PDF helpers use businessTimeZone; source-compiled actual PDF bytes, Poppler text and rendered receipt show Lagos15Oct00:30 from UTC14Oct23:30; existing table layout tests remain green.

**Verification:**
- Residual corrected run: 36 passed, 0 failed/skipped; CLI, email text, PDF timezone and existing regression cases
- Per-file ledger distinguishes full-source, targeted, inventory-only, asset and dependency-lockfile depth.

**Evidence:** [obligon-production-residual-coverage.json](evidence/obligon-production-residual-coverage.json)
**Compatibility:** Documentation and output corrections reflect actual configured behavior; no new operational claim.
**Recovery:** Manual provider scripts were not run; no CI bootstrap changes were introduced.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### RES-CLI-01 — Expect retryable unverified callbacks in the local payment diagnostic

**Pages:** Payment callbacks / local diagnostic coverage.
**Affected categories:** Shared, Customer, Partner, Company.
**Status:** Fixed; actual isolated HTTP/PG provider-verification/no-credit probe1/1.
**Before:** Manual e2e script asserts200 for a valid-signature callback whose provider charge cannot be corroborated. Updated verified callback path deliberately returns503/no credit so provider can retry.
**After:** Expected503 for signed but uncorroborated charge; asserts pending topup, unchanged balance and no wallet posting before corroborated retry.

**Verification:**
- A separately isolated provider-mocked HTTP probe proves valid-signature uncorroborated payment returns503 with no wallet credit.
- The complete provider-dependent diagnostic was not run; its corrected source expectation matches current retryable behavior.

**Evidence:** [obligon-production-residual-coverage.json](evidence/obligon-production-residual-coverage.json)
**Compatibility:** Documentation and output corrections reflect actual configured behavior; no new operational claim.
**Recovery:** Manual provider scripts were not run; no CI bootstrap changes were introduced.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### RES-DIAGNOSTIC-02 — Make manual wallet and preference diagnostics require safe local fixtures

**Pages:** Customer Wallet / local diagnostic coverage, Profile preferences / local diagnostic coverage.
**Affected categories:** Shared, Customer.
**Status:** Localized repair; process safety3/3; full mutating scripts not executed.
**Before:** Wallet expectation used10x wrong kobo amount, second signup missed required phone and wrong signature header was ignored; preference push auth key had wrong byte length. Mutating targets and default credentials lacked explicit local opt-in.
**After:** Checks use current exact amount/header/phone/push contracts, explicit local fixture credentials and loopback opt-in; wallet script requires local simulation before mutation; preference cleanup/restoration runs in finally. Published missing credential names are not mistaken for secret values.

**Verification:**
- Three child-process safety cases passed: missing opt-in, forbidden targets and absent fixture credentials reject before fetch.
- The two full mutating diagnostic workflows were not executed; separate isolated route/accounting tests prove application behavior.

**Evidence:** [obligon-production-residual-coverage.json](evidence/obligon-production-residual-coverage.json)
**Compatibility:** Requires explicit loopback fixture context and credentials; wallet diagnostic requires local simulation before mutations. Current kobo/header/phone/push-key expectations replace stale fixtures.
**Recovery:** Preference changes restore in finally. Operator/provider configuration checks remain external; no live payment or fixture cleanup is claimed.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

### SHARED-CONSENT-MODAL-LAYER-01 — Keep Cookie Consent readable and below active dialogs

**Pages:** Cookie Consent / first visit, Customer Sign Out confirmation, Company/Partner/Admin shared dialogs, Public/Auth modal surfaces.
**Affected categories:** Shared, Customer, Partner, Company, Admin, Public, Auth.
**Status:** Implemented and independently reviewed; actual final first-visit normal/modal/closed acceptance passed.
**Before:** A later global Cookie Consent context atz40 painted above a sidebar-owned modal also contained atz40. Actual fresh-origin short-desktop hit test hit Cookie Consent instead of Sign Out. Lowering cookie unconditionally would put its normal1024px banner behind the sidebar.
**After:** The banner retains its defaultz40 and existing dimensions/text/handlers. Exactly one body:has([aria-modal="true"]) descendant selector lowers only that banner toz30 while a modal exists. Removing the dialog returns the banner to its unchanged utilityz40.

**Verification:**
- Full current45-line globals stylesheet, exact default bannerz40/ARIA label, RootLayout sibling order and mobilez50/desktopz40 CustomerShell contexts independently read. The selector targets only Cookie Consent under a body containing an actual aria-modal=true element; it does not match the banner itself or alter layout, overflow, consent/auth/session handlers.
- Saved final browser receipt independently read: normal1024px bannerz40/text hittrue; short1280x500 modal confirmation hittrue while cookie framez37 (below sidebar40); after closing/logout settlednormalz40/text hittrue. Existing300ms transition produces intermediate values, so computed30 was not asserted.

**Evidence:** [obligon-production-consent-layer-review.json](evidence/obligon-production-consent-layer-review.json) · [consent-layer-before.json](evidence/consent-layer-before.json) · [consent-layer-after.json](evidence/consent-layer-after.json)
**Compatibility:** Existing normal cookie position/layer and shared dialog contract remain; source does not add a portal, dependency or persistent four-sidebar changes. Actual local Chromium state acceptance and other-browser/device release checks remain explicit.
**Recovery:** When the modal DOM is removed, the state selector ceases to match and normal consent visibility/layer returns. No consent preferences or session storage are modified by this CSS.
**Qualified human review:** Ordinary scoped correction; external acceptance remains unverified.

## Blocked release checks

### Critical review — Satisfied by user attestation

Qualified human review of money, credentials, session, tenant, sensitive data and migration invariants before production merge/deployment.
On 15 October 2026 the user stated: A qualified reviewer has approved it, for the exact unchanged 155-file tested source set. This records reported source approval; external provider/hosted acceptance is not inferred.

### Payments and issuer — Blocked

Real configured Flutterwave/Paystack/Sudo sandbox contracts, amount units, split/fee liability, refund destination/finality, issuer authorization/custody and statement reconciliation.
Provider boundaries were mocked; unsupported or uncorrelated effects intentionally remain review-required.

### Hosted database — Blocked

Validate actual hosted owner/backend roles, BYPASSRLS, grants, policies, function ownership, public catalog columns and unknown external Data API clients before migration 032.
The 63-table local ACL proof is not a hosted permissions inspection; no production migration ran.

### Deployment — Blocked

Confirm hosted credentials, merchant/account bindings, TLS/CA, environment settings, network, storage and independent frontend/backend rollout.
No production merge, deploy, outbound code upload or hosted provider mutation was performed.

### Recovery and observability — Blocked

Exercise backup restore and rollback; assign ownership for pending/uncertain intents and refund debt, alert delivery, reconciliation and historical stranded payments.
Durable local recovery cases pass, but production operating procedures and real alerts are unverified.

### Finance architecture — Blocked

Qualified review of balanced currency journal/counterparty accounting and provider/bank reconciliation.
Existing wallet_ledger remains wallet balance history; it is not a complete financial accounting system.

### Public/legal claims — Blocked

Owner/legal/provider verification of regulatory claims, privacy procedures, retention, response commitments and operational disclosures.
Unsupported promises were removed or qualified. The existing admin organization-verification flag gates company operations but does not itself prove a signed contract; no legal/regulatory certification is claimed.

### Hosted role acceptance — Blocked

Authenticated production acceptance for live company/admin roles and real device/service-worker behavior.
Local synthetic accounts and selected available access do not substitute for all hosted role/account/device states.

### Existing CI bootstrap — Reported limitation

Provide an approved Supabase-compatible bootstrap strategy for raw PostgreSQL CI migrations.
Baseline Supabase auth roles/helpers are absent in generic raw PostgreSQL; unsolicited CI changes were outside the authorized scope.

### Development dependency — Open limitation

Track the high braces development-only advisory until a published supported fix or approved dependency strategy exists.
Final all-dependency scan reports one high advisory; final production scans report zero.

## Page and dashboard matrix

| Page | Category | Local verification scope |
| --- | --- | --- |
| /admin/companies | Admin | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /admin/discount-approvals | Admin | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /admin/disputes | Admin | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /admin/intake | Admin | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /admin/login | Admin | Local available state visited (2 observations; observed CSS widths 320, 1280). |
| /admin/operations | Admin | Local available state visited (4 observations; observed CSS widths 320, 390, 1280). |
| /admin | Admin | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /admin/partner-applications | Admin | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /admin/reports | Admin | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /admin/staff | Admin | Local available state visited (4 observations; observed CSS widths 390, 1280). |
| /auth/company-invitation | Auth | Local available state visited (3 observations; observed CSS widths 320, 390). |
| /auth/failure | Auth | Local available state visited (4 observations; observed CSS widths 320, 390, 1280). |
| /auth/in-progress | Auth | Local available state visited (3 observations; observed CSS widths 320, 390). |
| /auth/login | Auth | Local available state visited (4 observations; observed CSS widths 320, 390). |
| /auth/logout | Auth | Local available state visited (1 observations; observed CSS widths 320). |
| /auth/mfa/challenge | Auth | Local available state visited (4 observations; observed CSS widths 320, 390, 1280). |
| /auth/mfa/setup | Auth | Local available state visited (2 observations; observed CSS widths 320, 390). |
| /auth/session-expired | Auth | Local available state visited (2 observations; observed CSS widths 320, 390). |
| /auth/signup | Auth | Local available state visited (3 observations; observed CSS widths 320, 390). |
| /auth/success | Auth | Local available state visited (2 observations; observed CSS widths 320, 390). |
| /auth/verify-email | Auth | Local available state visited (2 observations; observed CSS widths 320, 390). |
| /auth/verify-phone | Auth | Local available state visited (2 observations; observed CSS widths 320, 390). |
| /careers | Public | Local available state visited (2 observations; observed CSS widths 390, 1280). |
| /company/billing | Company | Local available state visited (4 observations; observed CSS widths 320, 390, 1280). |
| /company/cards | Company | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /company/maintenance | Company | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /company/notifications | Company | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /company | Company | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /company/reports | Company | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /company/roadside | Company | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /company/settings | Company | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /company/stations | Company | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /company/support | Company | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /company/team | Company | Local available state visited (5 observations; observed CSS widths 320, 390, 1280). |
| /company/transactions | Company | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /company/vehicles | Company | Local available state visited (3 observations; observed CSS widths 390, 1280). |
| /cookie-policy | Public | Local available state visited (2 observations; observed CSS widths 390, 1280). |
| /customer/card | Customer | Local available state visited (5 observations; observed CSS widths 320, 390, 1280). Live available customer route also visited. |
| /customer/fuel-checkout | Customer | Local available state visited (3 observations; observed CSS widths 390, 1280). Live available customer route also visited. |
| /customer/notifications | Customer | Local available state visited (3 observations; observed CSS widths 390, 1280). Live available customer route also visited. |
| /customer | Customer | Local available state visited (4 observations; observed CSS widths 320, 390, 1280). Live available customer route also visited. |
| /customer/profile | Customer | Local available state visited (4 observations; observed CSS widths 320, 390, 1280). Live available customer route also visited. |
| /customer/report-problem | Customer | Local available state visited (3 observations; observed CSS widths 390, 1280). Live available customer route also visited. |
| /customer/stations | Customer | Local available state visited (4 observations; observed CSS widths 320, 390, 1280). Live available customer route also visited. |
| /customer/subscription | Customer | Local available state visited (3 observations; observed CSS widths 390, 1280). Live available customer route also visited. |
| /customer/support | Customer | Local available state visited (3 observations; observed CSS widths 390, 1280). Live available customer route also visited. |
| /customer/transaction-detail | Customer | Local available state visited (3 observations; observed CSS widths 390, 1280). Live available customer route also visited. |
| /customer/transactions | Customer | Local available state visited (3 observations; observed CSS widths 390, 1280). Live available customer route also visited. |
| /customer/wallet | Customer | Local available state visited (4 observations; observed CSS widths 390, 1280). Live available customer route also visited. |
| /dashboard/billing | Partner | Local available state visited (4 observations; observed CSS widths 390, 1280). |
| /dashboard/card-verification | Partner | Local available state visited (4 observations; observed CSS widths 390, 1280). |
| /dashboard/disputes | Partner | Local available state visited (4 observations; observed CSS widths 390, 1280). |
| /dashboard/fuel-pricing | Partner | Local available state visited (5 observations; observed CSS widths 390, 1280). |
| /dashboard/notifications | Partner | Local available state visited (4 observations; observed CSS widths 390, 1280). |
| /dashboard | Partner | Local available state visited (4 observations; observed CSS widths 390, 1280). |
| /dashboard/reports | Partner | Local available state visited (4 observations; observed CSS widths 390, 1280). |
| /dashboard/settings | Partner | Local available state visited (4 observations; observed CSS widths 390, 1280). |
| /dashboard/settlements | Partner | Local available state visited (6 observations; observed CSS widths 320, 390, 1280). |
| /dashboard/staff | Partner | Local available state visited (4 observations; observed CSS widths 390, 1280). |
| /dashboard/station-profile | Partner | Local available state visited (4 observations; observed CSS widths 390, 1280). |
| /dashboard/transactions | Partner | Local available state visited (4 observations; observed CSS widths 390, 1280). |
| /dashboard/verify | Partner | Local available state visited (4 observations; observed CSS widths 390, 1280). |
| /forgot-password | Public | Local available state visited (3 observations; observed CSS widths 320, 390, 1280). |
| /login | Public | Local available state visited (2 observations; observed CSS widths 320, 1280). |
| /mechanic | Mechanic | Local available state visited (2 observations; observed CSS widths 320, 390). |
| / | Public | Local available state visited (3 observations; observed CSS widths 320, 390, 769). |
| /privacy-policy | Public | Local available state visited (2 observations; observed CSS widths 390, 1280). |
| /reset-password | Public | Local available state visited (3 observations; observed CSS widths 320, 390, 1280). |
| /solutions/energyvista | Public | Local available state visited (2 observations; observed CSS widths 390, 1280). |
| /solutions/fuelvista | Public | Local available state visited (2 observations; observed CSS widths 390, 1280). |
| /solutions/genvista | Public | Local available state visited (2 observations; observed CSS widths 390, 1280). |
| /support | Public | Local available state visited (2 observations; observed CSS widths 390, 1280). |
| /terms-of-service | Public | Local available state visited (2 observations; observed CSS widths 390, 1280). |

## Every changed source, test, configuration and asset file

| Path | Category | What changed | SHA-256 |
| --- | --- | --- | --- |
| [FRONTEND_COMPLETION_REPORT.md](../../FRONTEND_COMPLETION_REPORT.md) | Shared | Updates acceptance status and explicit incomplete/external workflows. | b9df811fcaa13e1f6f8153de65408b52398071a9c28eb6bb98bad219808c53aa |
| [MILESTONE_TRACKER.md](../../MILESTONE_TRACKER.md) | Shared | Replaces stale completion claims with scoped audit, implementation and release gates. | c364d77c39430c48132de5ca4b7562b83930bbf46aacd71a5c112a4d2549a3a9 |
| [apps/api/.env.example](../../apps/api/.env.example) | Shared | Corrects root .env setup and API-origin webhook documentation; clarifies disposable local setup and production gates. | a24ceb366e1a97d3e52376cd90d128c1d84730beb7fd55683adafff8d3d85a69 |
| [apps/api/README.md](../../apps/api/README.md) | Shared | Documents exact-money, provider recovery, authorization and private database deployment constraints. | e106445cbe82d2b8af0e7cc7c6d5fa88fe8078b766ef3b8c961a28c3f5c1bd74 |
| [apps/api/package.json](../../apps/api/package.json) | Shared | Updates Multer to 2.4.0 within the runtime dependency remediation scope. | 9e095658f0cc7ecd4adf738d64f3a4d63c3226756ea01ac64a8d637ed3fc36e7 |
| [apps/api/src/app.js](../../apps/api/src/app.js) | Shared | Classifies known multipart limits/framing failures as safe 400/413 without hiding genuine server faults. | 943ab52c539117d5faa8233adfda7a2103ec55387cf69cedaa6d03c2ec3ef956 |
| [apps/api/src/lib/company-input.js](../../apps/api/src/lib/company-input.js) | Company | Validates exact independent monetary limits and company input contracts. | 7ee6f43a1362aca01dc7076d705c60ccb7005dabb2d60a9ab3ba3d097163351a |
| [apps/api/src/lib/discounts.js](../../apps/api/src/lib/discounts.js) | Shared | Uses exact bounded minor-unit discount and charged/partner fee arithmetic. | 14019adfd3cd9e5ea9cde61ca1e04aa419957dd4a4ed731851fcf9e48c6628f0 |
| [apps/api/src/lib/flutterwave.js](../../apps/api/src/lib/flutterwave.js) | Shared | Validates explicit provider currency/reference/major-unit amount contracts and refund evidence; preserves paginated envelopes. | bebdc0ea6054441b93ebb7f113bce6bb287d8985caf1255a7685a40c89738e95 |
| [apps/api/src/lib/fuel-checkout.js](../../apps/api/src/lib/fuel-checkout.js) | Shared | Persists exact immutable quote and unit-price evidence; atomically correlates payment and recoverable excess refunds. | 52c059d8ed289be47612bcbbdcd4ab1523bd228a3baef2e2b5725b59b1ea43b9 |
| [apps/api/src/lib/fuel-sale.js](../../apps/api/src/lib/fuel-sale.js) | Shared | Requires accepted station status and NGN wallet; locks and records exact sale evidence. | 6b05aecaee203bec2d6c64b4f1ace9dc27db2986ae8af79d143edda967856ee2 |
| [apps/api/src/lib/mailer.js](../../apps/api/src/lib/mailer.js) | Shared | Repairs encoded password-reset subject text without changing the reset delivery flow. | 21f3dce09763f01bc011a15da827c7bcd2363948476894fe5b72bfb92ab067d0 |
| [apps/api/src/lib/money-amounts.js](../../apps/api/src/lib/money-amounts.js) | Shared | Adds bounded exact decimal-to-kobo parsing and BigInt monetary contracts. | 00dc5ea6395a29249ab2bc922c12fb3712289bb28274f673e7a1740dedf2a194 |
| [apps/api/src/lib/money.js](../../apps/api/src/lib/money.js) | Shared | Enforces caller/payload-bound transfer identity, live company membership and exact balanced wallet effects. | 646ced224c6acc63367a435d7800f3c70a1017c913e01a6097ebfdb9f5302e08 |
| [apps/api/src/lib/payments.js](../../apps/api/src/lib/payments.js) | Shared | Freezes fee/charged quotes, verifies retained provider contracts and reserves/dispatches recoverable exact refunds. | 7148ad755f6afd03288f233c284239032d74522dc22b2cc8c57864a8b9c5df46 |
| [apps/api/src/lib/paystack.js](../../apps/api/src/lib/paystack.js) | Shared | Requires real production verification and exact minor-unit refund/payment correlation. | cfc9401713912f8641d311b29da6340556066c5986c11aa27f8780d3ee6e2ab1 |
| [apps/api/src/lib/pdf.js](../../apps/api/src/lib/pdf.js) | Shared | Uses the configured business timezone in receipt, invoice and report dates. | b5831367474c373d56fef84e3f3371ac3fb8c0d1f60ac29cfc2596a29c076fd8 |
| [apps/api/src/lib/plans.js](../../apps/api/src/lib/plans.js) | Shared | Preserves paginated provider plan data and reports genuine drift. | 296b5e1587dfa694e6350af03235d93534fec67a25ed27cf08a372e2381ef317 |
| [apps/api/src/lib/push.js](../../apps/api/src/lib/push.js) | Shared | Validates trusted services/keys and guarded DNS/socket delivery; bounds outbound work and avoids internal targets. | 882bac8dab82a82621c5c0163d06d9efcaacb9ccf81b259df6b2f83d8fdad98a |
| [apps/api/src/lib/reconcile.js](../../apps/api/src/lib/reconcile.js) | Shared | Recovers uncertain payments fairly, respects provider states and original quotes, and surfaces global refund attention. | ba18cfca3739d3f0d77b9a5ee83dd067067fbdd5ae6942b52a1bd9c460a3f31f |
| [apps/api/src/lib/savings.js](../../apps/api/src/lib/savings.js) | Customer | Separates recorded discount savings from current-price estimates with exact per-transaction evidence. | 25348cba6e40c8d7cec21974148be19d112d25724528d3acaf1711ba0824c4cb |
| [apps/api/src/lib/scheduler.js](../../apps/api/src/lib/scheduler.js) | Shared | Validates immutable transfer identity/NGN amount/currency/reference and prevents delayed failed lookup from overwriting a concurrently settled payout. | fc976e14db2f62b4e9fb3e8cece6140d4d8cf1a8f81409abdc1cda233a4e7778 |
| [apps/api/src/lib/security.js](../../apps/api/src/lib/security.js) | Shared | Generates cryptographic codes and binds refresh JWT expiry/context to durable session expiry. | 61afaf50419e91565fec007e0e137fdd6d40a4f6da2c40f364cc2d3204820c5a |
| [apps/api/src/lib/spend.js](../../apps/api/src/lib/spend.js) | Customer | Rejects monetary overprecision rather than rounding a different projection. | 669a258238055dc31414691ec178a59b25d08c7c4d44225ab205aa9151ad2f60 |
| [apps/api/src/lib/sudo.js](../../apps/api/src/lib/sudo.js) | Shared | Fails closed for unsupported account-backed issuer spending; retains verified zero-funded issuance. | e9f12d0154991ece98acebac26c2e6ade5c683682d3e8b39835a846cc56cba28 |
| [apps/api/src/lib/temporaryPartnerAccount.js](../../apps/api/src/lib/temporaryPartnerAccount.js) | Shared | Retires shared testing access in production and requires explicit nonproduction fixture credentials. | 836867bdec1b9321fe4c6da5b31f2913e77c57bc6d4ce739f90d83dbb386f1aa |
| [apps/api/src/lib/transfer-recovery.js](../../apps/api/src/lib/transfer-recovery.js) | Shared | Retains exact recoverable transfer outcomes rather than fabricated provider success. | 0ca84ac162f8e574aec25c9e54fbd9d32e5ed25b4bb210ecaa38aacfdb969014 |
| [apps/api/src/middleware/auth.js](../../apps/api/src/middleware/auth.js) | Auth | Checks active membership/current account and bound durable session identity; preserves scoped API-key branch. | d85d648df02bb35503e63533d522e772c4aa668360d34c48f1ed9a8b345d33b8 |
| [apps/api/src/migrations/032_private_database_access.sql](../../apps/api/src/migrations/032_private_database_access.sql) | Shared | Revokes private Data API table/column/function access across 59 tables while preserving four filtered public catalogs and trusted backend. | e5b415c22997aa7f1bb6e6cd6bd66229257d259f134d91d795a7fc446e373f7b |
| [apps/api/src/routes/admin.routes.js](../../apps/api/src/routes/admin.routes.js) | Admin | Binds exact original-charge refunds, validates provisioning credit, fixes revenue billion thresholds, creates pending fleets with an owned company wallet, and requires atomic attributable contract-agreed admin approval. | 9ecdb24e33857af71f7a4db2410624f735a0e71fa9bc4d72bd5ba0b771de7122 |
| [apps/api/src/routes/auth.routes.js](../../apps/api/src/routes/auth.routes.js) | Auth | Serializes password/MFA/OTP/session claims, binds durable refresh expiry, supports invitations and stable company contexts, and creates pending contract-gated company signups without free trial. | 56644e49366f4a85b0ce11e624e81e5d5f4e15f067fb21b73062d4cd87488b0b |
| [apps/api/src/routes/company.routes.js](../../apps/api/src/routes/company.routes.js) | Company | Adds owned paging, exact quotes/allocation identity, fuel-code and support controls; denies self-service contract billing and gates operations on existing admin verification while retaining onboarding. | 22075c3794292b1d2aa7f6fe970f24bde3f96f98af84afda9114c1ad55cb5574 |
| [apps/api/src/routes/customer.routes.js](../../apps/api/src/routes/customer.routes.js) | Customer | Isolates personal ownership and exact funding/refund/phone state; PIN updates validate typed digits, lock current credentials, revoke old wallet fuel codes, and expose only pinSet metadata. | 836218ba3c8f9c76012234d56504f23afddd00ecba344cd2771ed46e5b156be9 |
| [apps/api/src/routes/partner.routes.js](../../apps/api/src/routes/partner.routes.js) | Partner | Corrects scoped dispute bindings, validates exact station inputs and finite transaction pagination/date/filter queries, and adds deterministic ID order for list/export. | 146f4d79942c5205483983fa6729e44e85acd9aa856ce1a60a2514039f8eda79 |
| [apps/api/src/routes/push.routes.js](../../apps/api/src/routes/push.routes.js) | Shared | Rejects untrusted subscriptions before storage and keeps removal owner-scoped. | a4657c44b1bdbd289776023a322f1f2610ac04b9b8a9365efd4e9b46d01ff47f |
| [apps/api/src/routes/subscription.routes.js](../../apps/api/src/routes/subscription.routes.js) | Shared | Preserves original payment quotes and exact excess-debt outcomes. | 3894e22e9463bc57e054672ad7dfe21156db6cb021ac8442d71eab610becc4eb |
| [apps/api/src/routes/webhooks.routes.js](../../apps/api/src/routes/webhooks.routes.js) | Shared | Reverifies immutable payment evidence and couples durable callback ownership with the financial transaction. | 669fe223ded403b8c8ffe66a6dc08cd141002ded15a37270c301d4866fc63574 |
| [apps/api/src/scripts/_e2e-payment.mjs](../../apps/api/src/scripts/_e2e-payment.mjs) | Shared | Corrects the diagnostic expectation for authenticated but uncorroborated webhook charges to retryable 503. | 00e643672f1d4e2cdcd92f5183e287e42c23b0021f83ddf99c2a115a029a0196 |
| [apps/api/src/scripts/demo-accounts.js](../../apps/api/src/scripts/demo-accounts.js) | Shared | Parameterizes demo-account corrective values instead of embedding SQL literals. | f33e69477deae7535346c8321c73ce4d783cbbc35312912e0332e43c92fe1d2d |
| [apps/api/tests/activity-balance-and-otp.test.mjs](../../apps/api/tests/activity-balance-and-otp.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for activity balance and otp. | 609d7ba228b833d0ac6fb1567873d04bd341dc5453e5eb55b4ad420dfe5c9c17 |
| [apps/api/tests/admin-support.integration.test.mjs](../../apps/api/tests/admin-support.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for admin support. Added cases include: admin provisioning creates a pending company and sends an honest review invitation; pending company verification takes priority over the canceled subscription badge. | 1a3d0fb7946e6fa90bfa9584297183e48a0b5ddae8ff844dadf405e56383e5f9 |
| [apps/api/tests/api.smoke.test.mjs](../../apps/api/tests/api.smoke.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for api.smoke. | 501bc244d697b7c7cb93132c5b1d2e4e9f8d91cf6187f0763c38393f98657001 |
| [apps/api/tests/auth-session-lifetime.integration.test.mjs](../../apps/api/tests/auth-session-lifetime.integration.test.mjs) | Auth | Adds/updates focused regression cases and fixtures for auth session lifetime. Added cases include: a signed access token without a durable session is refused before and after logout; access JWT session IDs must refer to the same active unexpired account session. | 66852ea08e421148eb747141d6b96b408eb64d4e6330c1d0e9db3707b4c98571 |
| [apps/api/tests/company-dashboard.integration.test.mjs](../../apps/api/tests/company-dashboard.integration.test.mjs) | Company | Adds/updates focused regression cases and fixtures for company dashboard. | 4ab2da7aa6bb6272ddffc6979e7796db3400a6102f6b24f82a52ce78a35db991 |
| [apps/api/tests/company-input.test.mjs](../../apps/api/tests/company-input.test.mjs) | Company | Adds/updates focused regression cases and fixtures for company input. Added cases include: company card limits retain every kobo in bounded decimal input; company card limits reject coerced arrays rather than interpreting them as naira. | 8dde891ad7e546c73370ae9e67ceda3abd93075bf67baa3cedf9d34537967654 |
| [apps/api/tests/company-invitations.integration.test.mjs](../../apps/api/tests/company-invitations.integration.test.mjs) | Company | Adds/updates focused regression cases and fixtures for company invitations. Added cases include: a verified signed-in invitee joins the existing fleet without changing the primary account role; concurrent redemption is single use and never duplicates a membership. | a53a0549dfc5459ec4fe8de7beaffaabac362ed0f0c6c2bb4a4e42b98ea14196 |
| [apps/api/tests/company-membership.integration.test.mjs](../../apps/api/tests/company-membership.integration.test.mjs) | Company | Adds/updates focused regression cases and fixtures for company membership. Added cases include: active company member retains permitted access; suspended company membership loses access immediately. | 75f43a4ac8f7462f68e8bc5885f30cafd4e33e32a4431934d555c321ced4017a |
| [apps/api/tests/company-money.integration.test.mjs](../../apps/api/tests/company-money.integration.test.mjs) | Company | Adds/updates focused regression cases and fixtures for company money. Added cases include: pending company approval prevents direct allocation without any money effect; company top-up persists principal, quoted fee, charged total and chosen method against the real schema. | f607d3f4983a6e3c3b7b8eb2955404ad7337828b3d29b91f3a7429051018a1f4 |
| [apps/api/tests/company-workflows.integration.test.mjs](../../apps/api/tests/company-workflows.integration.test.mjs) | Company | Adds/updates focused regression cases and fixtures for company workflows. Added cases include: fleet pages traverse beyond one hundred rows with stable IDs and matching totals; fleet pagination rejects malformed bounds before SQL and caps valid limits. | 21a39b95e669c3c2de91cb9599bcde0cdb4fb388a89fe308e2ba30271a7bd885 |
| [apps/api/tests/customer-audit.integration.test.mjs](../../apps/api/tests/customer-audit.integration.test.mjs) | Customer | Adds/updates focused regression cases and fixtures for customer audit. | 963b9c92c4c9148261495e3d467eaa1f8397b749bae06a2d42d6343e3c3069f9 |
| [apps/api/tests/customer-production-boundaries.integration.test.mjs](../../apps/api/tests/customer-production-boundaries.integration.test.mjs) | Customer | Adds/updates focused regression cases and fixtures for customer production boundaries. Added cases include: personal card PIN setup state is explicit and concurrent first setup cannot replace an established PIN; customer deposits reject fractional, malformed and oversized input before intent creation. | 8a6e5fc8285ceddaed9fd24c180f2c3bc4e7596810ebab57085efab670789ba0 |
| [apps/api/tests/database-private-access.integration.test.mjs](../../apps/api/tests/database-private-access.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for database private access. Added cases include: permission maintenance denies every application-private table and column to both Data API roles; trusted owner/backend still read and write while all four public catalogs remain filtered and read-only. | 9a1bfbc5afed941664921a19fba86887f7a69a4e6755bac344cb7c49e2f5fb55 |
| [apps/api/tests/demo-accounts.test.mjs](../../apps/api/tests/demo-accounts.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for demo accounts. Added cases include: demo repair binds actual status and boolean values and remains idempotent. | 8295bb354f05468520a498aa4b5f648ef9d032638ec5616063ce43ea643f369e |
| [apps/api/tests/discount-math.test.mjs](../../apps/api/tests/discount-math.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for discount math. Added cases include: large safe principal discounts round half-up using exact integer products; a valid small two-decimal discount rate is not refused by binary multiplication. | 447e1c439a8ee79fc117b5bc795339c79ae594c85b9017009d114cc873aa2cb6 |
| [apps/api/tests/exact-money-projection.integration.test.mjs](../../apps/api/tests/exact-money-projection.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for exact money projection. Added cases include: projection stores bounded exact decimal kobo and supports changing the same month; projection refuses sub-kobo amounts without writing a rounded plan. | 79e2699464744b9ff2e8c39c4e04840f74ab7ac315ee6ed93f96f5b1cc45fafb |
| [apps/api/tests/exact-money-provider.test.mjs](../../apps/api/tests/exact-money-provider.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for exact money provider. Added cases include: split settlement uses exact integer half-up arithmetic for a large safe principal; a platform split fee greater than the charge is rejected. | 2409b8c770dfc27c1ba2a929345e1a8ab55394613ef34232c40bcb09f6abce65 |
| [apps/api/tests/flutterwave-processor.test.mjs](../../apps/api/tests/flutterwave-processor.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for flutterwave processor. | 342fb675fed17e684a8a703502f18c962041e8ddea98579cdcf3dc3a3a6fa686 |
| [apps/api/tests/flutterwave-units.test.mjs](../../apps/api/tests/flutterwave-units.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for flutterwave units. Added cases include: v3 verification amounts have a documented major-unit contract; decimal major units convert exactly and malformed precision is refused. | 06504d363af3692ef4a80cdb80619d8c9889d4a68d163c5cc79ffa43a18780ca |
| [apps/api/tests/fuel-checkout.integration.test.mjs](../../apps/api/tests/fuel-checkout.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for fuel checkout. Added cases include: direct fuel confirmation persists its original unit price after station prices change; direct checkout computes the original decimal litres quote with exact half-up rounding. | cba27f7c25fd70bf314c8e1418893c8db2b23ca18210be09778a1e521f132611 |
| [apps/api/tests/fuel-sale.integration.test.mjs](../../apps/api/tests/fuel-sale.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for fuel sale. Added cases include: closed active station cannot consume a wallet code or move money; wallet sale records the quoted unit price and keeps it after published price changes. | f54c7048ce81e2f5885e21adff3855d381a1b733d53146e7803168a16e9d0c90 |
| [apps/api/tests/history-settlement-and-scheduler.test.mjs](../../apps/api/tests/history-settlement-and-scheduler.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for history settlement and scheduler. | 3d98ba8739bcff5a0397c4dc38fc49fdbb729fea21ce568a3490d11f292f6839 |
| [apps/api/tests/late-settlement.test.mjs](../../apps/api/tests/late-settlement.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for late settlement. | c5de74748ecbfba855461ec55fb2b71cd04149afeef45d8d9c49a9bbaaaa4a28 |
| [apps/api/tests/legacy-provider-verification.test.mjs](../../apps/api/tests/legacy-provider-verification.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for legacy provider verification. Added cases include: production cannot confirm an unpaid legacy charge through a frontend simulation claim; production cannot fabricate a legacy refund through simulation. | 5774faed0ede97052120aa2e6a2a7b9a342d4c37dd4169c3208b58230b44df66 |
| [apps/api/tests/local-diagnostic-safety.test.mjs](../../apps/api/tests/local-diagnostic-safety.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for local diagnostic safety. Added cases include: preference diagnostic refuses absent explicit fixture credentials before login. | 494c0ad7f0262a7eff7e256b058b2f04daadcc57cfae70b2139e86b1a6015726 |
| [apps/api/tests/mfa-password-proof.integration.test.mjs](../../apps/api/tests/mfa-password-proof.integration.test.mjs) | Auth | Adds/updates focused regression cases and fixtures for mfa password proof. Added cases include: a standalone email and valid backup code cannot bypass the password step; an authenticated session cannot overwrite an already enabled MFA secret. | f64593b64310fdcd852174aa901d8ca992aebca89fa88937cc0ecd8a4500a783 |
| [apps/api/tests/migration-startup.integration.test.mjs](../../apps/api/tests/migration-startup.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for migration startup. | 7ae1d8e23408711fe63e6e69f2494408e7165779fc908933017bb316be132c4f |
| [apps/api/tests/minimum-topup.test.mjs](../../apps/api/tests/minimum-topup.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for minimum topup. | ef40f9d4dfb7c34d320e2f8913c6035bbf5d39b59054fb290f9804a62c299ccb |
| [apps/api/tests/money-amounts.test.mjs](../../apps/api/tests/money-amounts.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for money amounts. Added cases include: naira input preserves exact kobo without binary rounding; whole-naira checkout refuses fractional deposits rather than silently surcharging. | 244901385449a8e7b82222339f34543f857011af3f95da2bf83d59fbb73161fa |
| [apps/api/tests/money.test.mjs](../../apps/api/tests/money.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for money. Added cases include: creditWalletOnce credits exactly once for the same idempotency key; debitWalletOnce refuses to overdraw and never goes negative. | eb2462331c600b016ccee2d375d01f79e006e199ab6f4ed17a716764c43123f2 |
| [apps/api/tests/no-secret-leak.test.mjs](../../apps/api/tests/no-secret-leak.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for no secret leak. Added cases include: Sudo webhook signing secrets are sensitive while public provider configuration remains public. | 7e1ea2be23adfbf0a0edee01a5a3994a43c5ec86ec2bf9dc3712579d0f4b46dc |
| [apps/api/tests/otp-provider-resilience.test.mjs](../../apps/api/tests/otp-provider-resilience.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for otp provider resilience. Added cases include: password-reset subject preserves readable text and the one-time code. | 6c091698f13c6ab6a598c4cc77d39f7ba66668198037126587f80d20a8384e89 |
| [apps/api/tests/partner-dashboard-wiring.test.mjs](../../apps/api/tests/partner-dashboard-wiring.test.mjs) | Partner | Adds/updates focused regression cases and fixtures for partner dashboard wiring. | ddf896e9497f53b9ab1315fe43b39fa288f550428af78a8be8741c3e055d259c |
| [apps/api/tests/partner-production-readiness.test.mjs](../../apps/api/tests/partner-production-readiness.test.mjs) | Partner | Adds/updates focused regression cases and fixtures for partner production readiness. Added cases include: pagination uses validated integer bounds and bound SQL parameters. | a019ffee1cbdba3d2fa78550a2bb11d6e18f7e51f6d77414417293a7c1927153 |
| [apps/api/tests/partner-staff.integration.test.mjs](../../apps/api/tests/partner-staff.integration.test.mjs) | Partner | Adds/updates focused regression cases and fixtures for partner staff. Added cases include: staff disable persists, revokes current access, remains visible and can be restored; staff owner, foreign membership and invalid permission mutations are rejected without state changes. | 76ad0e6d43dbdcf8450e64ef5629efe80e7bde3248f0af1ef52ca36589a21251 |
| [apps/api/tests/password-reset-claim.integration.test.mjs](../../apps/api/tests/password-reset-claim.integration.test.mjs) | Auth | Adds/updates focused regression cases and fixtures for password reset claim. Added cases include: five wrong reset guesses durably burn the code and prevent the correct guess; four concurrent reset replays change the password only once. | ed99a82748009c4db002b7f51777d7e920cbf9ebd47bda943cd2413bf6b8f2e0 |
| [apps/api/tests/payment-plans.integration.test.mjs](../../apps/api/tests/payment-plans.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for payment plans. Added cases include: official v3 envelope retrieves both pages and exposes cancelled-plan drift; empty official catalogue is accepted and cached. | c35d8ac8ce8e9580743343a83ed52678465aa624dc0ec7fce753fac961e93573 |
| [apps/api/tests/payment-verification-contract.test.mjs](../../apps/api/tests/payment-verification-contract.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for payment verification contract. Added cases include: verified v3 amounts always use major units, including 100-fold overpayment; overpayment remains explicit evidence for the refund owner. | 313c39b99f4262c85e010b3f529fce100d3e2071f4a0c8fa15597c340eb2f0e0 |
| [apps/api/tests/payment-webhook-recovery.integration.test.mjs](../../apps/api/tests/payment-webhook-recovery.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for payment webhook recovery. Added cases include: forged provider webhooks cannot look up payments or claim events; signed legacy callbacks require current matching currency, reference and amount. | 86419d3e1306b44bbaa7bbc326c70f03460d9dfe3fc06fdf96211471aa84bea4 |
| [apps/api/tests/payout-balance-guard.test.mjs](../../apps/api/tests/payout-balance-guard.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for payout balance guard. | f08e370ffd491a8d76eed721f9f14c910f9aba4af61de6e3228cea8068eb6ade |
| [apps/api/tests/pdf-layout.test.mjs](../../apps/api/tests/pdf-layout.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for pdf layout. Added cases include: receipt, invoice and report dates use the configured business day across UTC midnight. | 80e681de11e12f3d59af10d46d20450f13715229ebf953c3167f9300255d8223 |
| [apps/api/tests/prefs-security.check.mjs](../../apps/api/tests/prefs-security.check.mjs) | Shared | Adds/updates focused regression cases and fixtures for prefs security.check. Added cases include: temporary push subscription cleanup succeeds; original notification preferences are restored. | 73fc789fbe78a1f500d5bec27c769d2b47cd502e382bab2f9ab120b4ee3feff6 |
| [apps/api/tests/push-boundaries.test.mjs](../../apps/api/tests/push-boundaries.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for push boundaries. Added cases include: public DNS result is the address handed directly to the socket, without a second lookup; a service redirect response never triggers a second request. | e6de9f1cea6e05b03c2584e8bb6580833d8679b742b862672a0dab4c500f28db |
| [apps/api/tests/reconciliation-fallback.integration.test.mjs](../../apps/api/tests/reconciliation-fallback.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for reconciliation fallback. Added cases include: a delayed bank payment stays recoverable after its initial provider lookup is missing; a still-pending payment remains recoverable after the former eight-attempt threshold. | 2c5dc97d84da3778b78055f18e1277b88d166eed980b24242cdd2cf8cad54107 |
| [apps/api/tests/refund-ambiguity.integration.test.mjs](../../apps/api/tests/refund-ambiguity.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for refund ambiguity. | 683b25c95f190ff3a7587a977dd9b01683d743030774994082a64ec694c46699 |
| [apps/api/tests/refund-boundaries.integration.test.mjs](../../apps/api/tests/refund-boundaries.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for refund boundaries. Added cases include: admin partial refund cannot exceed the immutable original charge; aggregate partial refunds cannot exceed the original charge. | 29fa2552ac91476160c1105475e42f5e81437ff678617c36b4ad27ac04d33a93 |
| [apps/api/tests/refund-recovery.integration.test.mjs](../../apps/api/tests/refund-recovery.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for refund recovery. Added cases include: refund intent rolls back with its purchase and never contacts provider; a crash after committing intent is recovered with one POST across 20 concurrent dispatches. | 2087e3ee1d9271fa3714b2737fb572655a1aba195ea50eedfe35b121748fee29 |
| [apps/api/tests/savings-fee.test.mjs](../../apps/api/tests/savings-fee.test.mjs) | Customer | Adds/updates focused regression cases and fixtures for savings fee. Added cases include: platform-borne fees never silently surcharge a fractional checkout. | 2695355705f7d4dc1cb796524a7cb48bdbf08fc96aaea323fb6b3090db169a8b |
| [apps/api/tests/savings.integration.test.mjs](../../apps/api/tests/savings.integration.test.mjs) | Customer | Adds/updates focused regression cases and fixtures for savings. Added cases include: unequal-volume purchases sum actual recorded discounts rather than averaging unit prices; recorded historical savings do not change when current network prices change. | 83f064218af3d9008eb240608e96bca4ae60a68b1a94b74765edd7746e927070 |
| [apps/api/tests/settlement-accounting.integration.test.mjs](../../apps/api/tests/settlement-accounting.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for settlement accounting. Added cases include: a delayed failed lookup cannot overwrite a concurrently settled payout; contradictory transfer identity, currency, amount or reference never releases a payout reservation. | 7589a0ce0e29a9ccb7a1eb9427662226954070ba1bb2c0bd3c659880ff067ee7 |
| [apps/api/tests/sudo-contract.test.mjs](../../apps/api/tests/sudo-contract.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for sudo contract. Added cases include: unintegrated issuer funding is rejected before any card creation. | bc6e4b0505199da3c5d1c4a3beab41569ce42ebb17b07485ccb7b4e508f03c6b |
| [apps/api/tests/temporary-partner-account.integration.test.mjs](../../apps/api/tests/temporary-partner-account.integration.test.mjs) | Partner | Adds/updates focused regression cases and fixtures for temporary partner account. Added cases include: startup retires temporary access by default and production cannot recreate it. | 1809e2b375cda321bd527012e88139e21e620ee0ab2be6575f0386ee7c6bfb09 |
| [apps/api/tests/upload-compatibility.integration.test.mjs](../../apps/api/tests/upload-compatibility.integration.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for upload compatibility. Added cases include: oversized uploads return 413 across all five routes without storing files or records; unexpected file fields and excess files return safe 400 errors. | c97897bfd826272d283845ee0d24fb367618b2e93fdcb319ec250fc22f29b89c |
| [apps/api/tests/verification-flow.test.mjs](../../apps/api/tests/verification-flow.test.mjs) | Shared | Adds/updates focused regression cases and fixtures for verification flow. Added cases include: a matched live contact code is consumed atomically within its account lock. | 75e4241d5bba3441da9ce6cecb08e2e9b29bbbc5a5acf382ad6d50924193d412 |
| [apps/api/tests/wallet-payments.check.mjs](../../apps/api/tests/wallet-payments.check.mjs) | Shared | Adds/updates focused regression cases and fixtures for wallet payments.check. Added cases include: confirming credits the wallet once; webhook fails closed for missing verif-hash or unavailable authentication. | 50ca6ec1e2ed3276a0eef977fef928d7f5e9a438cbc8d5a5c07b6d3da69b966b |
| [apps/web/FRONTEND_ACCEPTANCE.md](../../apps/web/FRONTEND_ACCEPTANCE.md) | Shared | Updates acceptance checklist with actual role/form/error proof and external gates. | a332fb0f8934226d5cd0bf27f793feb2e40a171ed35376b26bb31dcf1cf125d1 |
| [apps/web/app/admin/login/page.tsx](../../apps/web/app/admin/login/page.tsx) | Admin | Uses safe internal return paths and verified session/MFA/role routing on this entry page. | a46868f3af88642d40d0c35e17d6db0966f6172c15f93af755057233e54b7ac8 |
| [apps/web/app/auth/company-invitation/page.tsx](../../apps/web/app/auth/company-invitation/page.tsx) | Company | Uses safe internal return paths and verified session/MFA/role routing on this entry page. | bdb0b53f489c38651b873ad4c60e479d873937524e00e50b19b9e9e4a99ea001 |
| [apps/web/app/auth/failure/page.tsx](../../apps/web/app/auth/failure/page.tsx) | Auth | Uses safe internal return paths and verified session/MFA/role routing on this entry page. | 013c5c3bb65a773428c2b9460fbf751254d6c5c943ef3242f286b01a06052bb5 |
| [apps/web/app/auth/in-progress/page.tsx](../../apps/web/app/auth/in-progress/page.tsx) | Auth | Uses safe internal return paths and verified session/MFA/role routing on this entry page. | e2ff84dcbcc41fc95c8ce4bc74a2dfaa04d98d8b5034711ed46759c04b616a9d |
| [apps/web/app/auth/session-expired/page.tsx](../../apps/web/app/auth/session-expired/page.tsx) | Auth | Uses safe internal return paths and verified session/MFA/role routing on this entry page. | 6a41f44508ab1922e3c8d1a962a8fe198b94a2778e78b2ac7bba05ba71b6446f |
| [apps/web/app/auth/signup/page.tsx](../../apps/web/app/auth/signup/page.tsx) | Auth | Uses safe internal return paths and verified session/MFA/role routing on this entry page. | b8ea0e8b28a454bc2f0469ec375ac129bffaa1b9032c702034cc8c1d6f3b1fcd |
| [apps/web/app/fonts/Inter-variable.woff2](../../apps/web/app/fonts/Inter-variable.woff2) | Public | Bundles the existing licensed brand font for deterministic framework font loading without a Google request. | 351f50d53207a6a7d8643edfa2520468627b141466d572493c0ef1b3075d0311 |
| [apps/web/app/fonts/PlusJakartaSans-variable.woff2](../../apps/web/app/fonts/PlusJakartaSans-variable.woff2) | Public | Bundles the existing licensed brand font for deterministic framework font loading without a Google request. | 49c62cf1fb70f225ea113361f0134a48858c3a7d0175173aa3e38a0c6c8539d2 |
| [apps/web/app/fonts/README.md](../../apps/web/app/fonts/README.md) | Public | Records the local font provenance, preserved families and license paths. | 5a19b6e344ac5511ff84ebbad75b2e001d27e77ecfe54fb506f1a3e928b698b3 |
| [apps/web/app/globals.css](../../apps/web/app/globals.css) | Shared | Adds reduced-motion fallback and conditionally lowers only Cookie Consent while an aria-modal dialog exists, retaining its normal z40 layout/layer. | 4e27f9d47fbbbbf6982265684f4c6bb4c815914186521827df9130371f8167eb |
| [apps/web/app/layout.tsx](../../apps/web/app/layout.tsx) | Shared | Loads the existing Inter and Plus Jakarta Sans families from bundled licensed files while preserving font variables, removing the Google download build dependency. | 1ad1ba2343c6d7ec3c28e085c500a9502a1682a5d355e2034ff04506662e3561 |
| [apps/web/app/solutions/fuelvista/page.tsx](../../apps/web/app/solutions/fuelvista/page.tsx) | Public | Qualifies operational product copy rather than claiming unsupported automation. | 7002e66a66a26699d46138ac0551c42974424a4f37abe27ab21cfe5396faff23 |
| [apps/web/app/support/page.tsx](../../apps/web/app/support/page.tsx) | Public | Associates contact category label with its native select. | 49cdfbde574cf2f2612763806f0d2d217d5d939f5f5d97ac7c026f0e734196be |
| [apps/web/components/admin-dashboard/AdminScreen.tsx](../../apps/web/components/admin-dashboard/AdminScreen.tsx) | Admin | Separates company verification from subscription state, requires an explicit contract-agreed checkbox for new approval, reports actual owner-invitation result, and keeps edits/close controls disabled while saving. | da50325ea79ea72d9306278ccbbd0463bf9d42f5f6748d7ca36e44c2ef6f50e1 |
| [apps/web/components/auth/AuthForms.tsx](../../apps/web/components/auth/AuthForms.tsx) | Auth | Adds truthful MFA/admin/credential result routing and safe pending state. | d7d3ee47ceb73daaad5ff7de91f107ae379411f376455892fdfa3451dd1f9369 |
| [apps/web/components/auth/AuthStatus.tsx](../../apps/web/components/auth/AuthStatus.tsx) | Auth | Reports actual session verification without invented identity or encryption claims; shrinkable status card, mobile padding/type and local word wrapping prevent 320px overflow. | 262f5412a3bbe236e942acb88c852b83a43fb33ec8fe6c6702c41cb2ab8257f7 |
| [apps/web/components/auth/CompanyInvitation.tsx](../../apps/web/components/auth/CompanyInvitation.tsx) | Auth | Adds explicit account-bound invitation preview/acceptance and company entry. | e59ae3425eaacdb9dfd63c63cd71ac8b5493cbebedc17d9fe2325a4eac277742 |
| [apps/web/components/auth/MFAUI.tsx](../../apps/web/components/auth/MFAUI.tsx) | Auth | Shows real setup failures, accepts normalized backup codes, guards obsolete completion, and fits six labeled challenge digits into a shrinkable mobile grid while preserving desktop boxes and input behavior. | aa3fe0c79e2ca79d9bbd2b534c295d8fb3a0e31fdbdbead0b2932b187d1cb48b |
| [apps/web/components/auth/SuccessAutoRedirect.tsx](../../apps/web/components/auth/SuccessAutoRedirect.tsx) | Auth | Waits for authenticated ready session and chooses a safe verified role destination. | 97ee67b5803e895e72efbb884135f6f5e58e45bae26160e3e2bfc0191f797d18 |
| [apps/web/components/auth/VerificationUI.tsx](../../apps/web/components/auth/VerificationUI.tsx) | Auth | Retains current verification state and proper stale/busy completion handling. | d3f8aa5efb5f3db5721746c0c85e1bc822ee4e9f50d91a04e4b7b37127d963ca |
| [apps/web/components/careers/CareersPage.tsx](../../apps/web/components/careers/CareersPage.tsx) | Public | Makes application dialog keyboard-contained and guards duplicate or stale submissions. | c123d530b1a3290ccd34a7fa9253d856409ce2660a14811a0007fc89e8961ee4 |
| [apps/web/components/company-dashboard/CompanyContextSelector.tsx](../../apps/web/components/company-dashboard/CompanyContextSelector.tsx) | Company | Chooses active company contexts and returns to primary identity with durable-session preservation. | 822feaa5b2eb10706b39485a78d5c3bd1052ae600863652ad2d8110903fdfe62 |
| [apps/web/components/company-dashboard/CompanyModals.tsx](../../apps/web/components/company-dashboard/CompanyModals.tsx) | Company | Adds quoted funding, stable allocation retry identity, conversations/maintenance/card-code controls and exact money fields. | 97321118d5b87068fbfcb62bb962ff711b8a9807cbd95a6f2b33eb2d9b5ea207 |
| [apps/web/components/company-dashboard/CompanyScreen.tsx](../../apps/web/components/company-dashboard/CompanyScreen.tsx) | Company | Adds pagination, operational follow-up, wallet/budget/code surfaces and protected support conversations. | e648228662a8266e543d266624307a8dff8acdd1d9f25147c030dc7a32c63cf2 |
| [apps/web/components/company-dashboard/CompanyShell.tsx](../../apps/web/components/company-dashboard/CompanyShell.tsx) | Company | Remounts workspace state by organization ID, filters contract-gated navigation, presents approval/Support guidance, and closes the old mobile drawer with a new topbar focus target when the selected company changes. | dc3bd1bf1780bce0beaab283e4fd710441e2a1b2f81ca4e02883e659a4f8cb27 |
| [apps/web/components/customer-dashboard/CustomerFuelCheckout.tsx](../../apps/web/components/customer-dashboard/CustomerFuelCheckout.tsx) | Customer | Separates load recovery from payment errors and preserves existing paid code/history safely. | 4310a63a4528ad904cca19b1b9728a3b1c0f6a35e6353e619f23ce27bf496cf2 |
| [apps/web/components/customer-dashboard/CustomerModals.tsx](../../apps/web/components/customer-dashboard/CustomerModals.tsx) | Customer | Uses exact disclosed funding quote, truthful config failure, current password reauthentication and safe retries; visible card-issue wording is personal while the legacy support wire value stays intact. | b3aa054f4d02cf21b8ab44556d146b3708d6d78bd70dc894335fbca827a27c80 |
| [apps/web/components/customer-dashboard/CustomerScreen.tsx](../../apps/web/components/customer-dashboard/CustomerScreen.tsx) | Customer | Retains useful card/wallet state, retry and receipt links, repairs device push readiness, prevents terminal card application reopening, and presents actual full-refund outcomes; keeps missing station distance unavailable while retaining valid zero distance; the mobile greeting describes the personal account. | 3b2bfa6fd7e489c704660f6793e75096952de44d6f56f34fb68d255f8251f248 |
| [apps/web/components/customer-dashboard/CustomerShell.tsx](../../apps/web/components/customer-dashboard/CustomerShell.tsx) | Customer | Raises the mobile Account dropdown and desktop sidebar stacking contexts so their unchanged Sign Out confirmations outrank underlying navigation/map controls; logout/session/focus handlers and layout dimensions remain intact. | 4aa800c0b12475876360841d181420c54e3703d1680ae4fb4baece13bd1915fd |
| [apps/web/components/dashboard/DashboardScreen.tsx](../../apps/web/components/dashboard/DashboardScreen.tsx) | Partner | Makes settlement table column shrinkable to confine responsive scrolling. | 2ee26d035782a978b3861d9bcb87f4ddd59a3b6d963794559795af9ac6c1e5b7 |
| [apps/web/components/dashboard/PartnershipShell.tsx](../../apps/web/components/dashboard/PartnershipShell.tsx) | Partner | Allows the existing mechanic subset and reachable sign-out without widening partner mutation permissions. | 26df7a6ed181d8f277c88e6e1307e39b92645bf55e74baf260c22f4a54db883b |
| [apps/web/components/landing/Header.tsx](../../apps/web/components/landing/Header.tsx) | Public | Aligns tablet/mobile menu breakpoints with desktop navigation. | a61b4ca7cc6b58c558ff954b2ebd6329d6eaef2d5e6a63a8416ba412efbc0cc9 |
| [apps/web/components/legal/LegalPage.tsx](../../apps/web/components/legal/LegalPage.tsx) | Public | Adds named privacy form state, stable request values, retry guards and qualified legal copy. | 7783e7dc9041da8c5515812a11097a38c00791ad393866cde9e650776abe4faf |
| [apps/web/components/shared/AuthContext.tsx](../../apps/web/components/shared/AuthContext.tsx) | Shared | Guards session generation before accepting older login/MFA results. | 21a4ea9fa75f556228c697c01fc283e9cd34fc4f7fb74eb31b12de144b63c307 |
| [apps/web/components/shared/States.tsx](../../apps/web/components/shared/States.tsx) | Shared | Preserves empty-state actions and exposes nonblocking refresh warnings. | c91b6c653f959f1f7eddbb563eef98bdba878410808afa3ecbe4fe42c1abbb9a |
| [apps/web/components/shared/useAsync.ts](../../apps/web/components/shared/useAsync.ts) | Shared | Keeps last good data and prevents overlapping refresh from invalidating its own in-flight response. | 97ade7c0204510900821c8db45f1cff520284c3dd5bd7f8dfbf7a913594f473b |
| [apps/web/lib/auth-routing.ts](../../apps/web/lib/auth-routing.ts) | Shared | Adds role destinations and strict safe internal return-path validation. | 312b811985662d30b655e47d690764a566795d9c42f01ecedd164641d3a3362f |
| [apps/web/lib/company-invitation-routing.ts](../../apps/web/lib/company-invitation-routing.ts) | Company | Binds invitation continuation to valid internal paths. | 6fe94209b262f541b3b326100b8b972614b157853b82009d9d278fc1beefbff1 |
| [apps/web/lib/customer-funding-quote.ts](../../apps/web/lib/customer-funding-quote.ts) | Customer | Computes exact disclosed customer funding fee/total with bounded whole-naira input. | 422b328117b0d21afbe116b4400fb13638e348d7d0f4913c10af866aee95edec |
| [apps/web/lib/push-subscription.ts](../../apps/web/lib/push-subscription.ts) | Shared | Derives actual device subscription readiness and propagates browser/API unsubscribe errors. | ef65f4cd31ec2aeef1f8374ae4228a52e910fc01c3900471f7d0d32ae032b646 |
| [apps/web/lib/services/client.ts](../../apps/web/lib/services/client.ts) | Shared | Guards session/token generation writes and adds exact/quoted/owned dashboard service contracts. | 2aa375de4d7c935dafa6946a2dbc97520f6210f47d0b5431d707d0b35817d118 |
| [apps/web/lib/services/company-invitations.ts](../../apps/web/lib/services/company-invitations.ts) | Company | Adds account-bound invitation and company context selection API service. | 046c1154cc7071cb1873d20b9fdb6abcb54aa647af02c12d88880c8beb9b0b9f |
| [apps/web/lib/services/company.ts](../../apps/web/lib/services/company.ts) | Company | Adds typed paging, wallet, budget, code and operational service contracts. | 06270673606cce5c2e48f8675dd94295a97e1da5f6de774c113e0ecbea1c6bd7 |
| [apps/web/lib/services/types.ts](../../apps/web/lib/services/types.ts) | Shared | Adds stable organization/context, company verification status, terminal card request states and exact dashboard contract fields. | 23693aeb863addfaf368aec1a10943e6561154d24688e95a06622cd34ecaeac6 |
| [apps/web/public/fonts/Inter-OFL.txt](../../apps/web/public/fonts/Inter-OFL.txt) | Public | Preserves the upstream Open Font License alongside the bundled brand font. | 5b9321a4298cfeb6b34354164a1c3afc3db114569984c502b9b35d988fd58c57 |
| [apps/web/public/fonts/PlusJakartaSans-OFL.txt](../../apps/web/public/fonts/PlusJakartaSans-OFL.txt) | Public | Preserves the upstream Open Font License alongside the bundled brand font. | 995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99 |
| [apps/web/tests/admin-company-approval.test.cjs](../../apps/web/tests/admin-company-approval.test.cjs) | Company | Adds/updates focused regression cases and fixtures for admin company approval. Added cases include: company review exposes labelled verification and contract approval controls; approving without explicit confirmation never sends an approval request. | 0f19bf0d282cf9de833304308cd9718d576427162b5cd547076afcc2842e0943 |
| [apps/web/tests/auth-regression.test.cjs](../../apps/web/tests/auth-regression.test.cjs) | Shared | Adds/updates focused regression cases and fixtures for auth regression. | 57879ac8b3c080e0226f852f62d069299800d1309f4a3950c2400702a4e4b18f |
| [apps/web/tests/auth-session-races.test.cjs](../../apps/web/tests/auth-session-races.test.cjs) | Auth | Adds/updates focused regression cases and fixtures for auth session races. Added cases include: replaced password proof rejects a pending MFA completion even without a session token; two MFA replays cannot persist two different successful completions. | ed6002b6d1de745461fe4f0637ea54a1a636ab2e502c19359e1ab20d46757fb4 |
| [apps/web/tests/local-fonts.test.cjs](../../apps/web/tests/local-fonts.test.cjs) | Public | Adds/updates focused regression cases and fixtures for local fonts. Added cases include: actual Next local loader emits only local font assets with preserved swap, weight and CSS variables. | 1320cb695d93245cfe89a5143a7bd6f1f7839ad244c1709c359464772c4be273 |
| [apps/web/tests/mfa-password-proof.test.cjs](../../apps/web/tests/mfa-password-proof.test.cjs) | Auth | Adds/updates focused regression cases and fixtures for mfa password proof. Added cases include: failed live authenticator setup displays its real error and cannot show or continue with fake credentials; a challenge opened without password proof explains recovery and disables code submission. | ad11f275e636cc0354c7c5d765c0ade8a969d7d3c9c11bdd8ae28365c217c1fd |
| [apps/web/tests/production-auth-navigation.test.cjs](../../apps/web/tests/production-auth-navigation.test.cjs) | Shared | Adds/updates focused regression cases and fixtures for production auth navigation. Added cases include: expired-session password proof follows MFA without announcing completed sign-in; expired session cannot announce success when post-login verification fails. | 25be631e84176448c2e4ca388d18d31a74a3541a1eaa74745fa7e938c3bd6873 |
| [apps/web/tests/production-company-invitations.test.cjs](../../apps/web/tests/production-company-invitations.test.cjs) | Company | Adds/updates focused regression cases and fixtures for production company invitations. Added cases include: legacy invitation query maps to a validated internal acceptance destination; signed-out invitation provides sign-in and signup links that preserve acceptance. | c1e25c96a2710ce9176be00ee6b4c354426911a1725a57f580210b2bbfeb9658 |
| [apps/web/tests/production-company-workflows.test.cjs](../../apps/web/tests/production-company-workflows.test.cjs) | Company | Adds/updates focused regression cases and fixtures for production company workflows. Added cases include: company fleet services preserve total and caller pagination/search; vehicle and card pages load another page and search resets its offset. | 676b85d7bacd8ff5cf5ae61d24087e3bf905caf947619faaa436a95567531f13 |
| [apps/web/tests/production-customer-controls.test.cjs](../../apps/web/tests/production-customer-controls.test.cjs) | Customer | Adds/updates focused regression cases and fixtures for production customer controls. Added cases include: whole-naira input rejects fractional, malformed and unbounded amounts; exact quote rounds customer total upwards and leaves platform Bearer [redacted] unchanged. | 77c3d5e15585331035cba3a9bce8bc7e79577fddaf7c7c42779f4b576db2f75a |
| [apps/web/tests/production-partner-staff.test.cjs](../../apps/web/tests/production-partner-staff.test.cjs) | Partner | Adds/updates focused regression cases and fixtures for production partner staff. Added cases include: staff form maps attendant to supported dispatcher and sends explicit POS access; editing disabled staff starts disabled and submits the chosen enabled state. | 879e0a5a4ff250401b2932f1a5714f42e95fc3e5c8cb33dd186a5f61f0052a41 |
| [apps/web/tests/production-public-controls.test.cjs](../../apps/web/tests/production-public-controls.test.cjs) | Public | Adds/updates focused regression cases and fixtures for production public controls. Added cases include: landing navigation remains reachable between mobile and desktop breakpoints; career application opens a named dialog using the shared focus behavior. | 9e31196000e0915bdbccd3279b7fd597ad9d3b2901b56a1ac56eafe42102211d |
| [apps/web/tests/production-shared-state.test.cjs](../../apps/web/tests/production-shared-state.test.cjs) | Shared | Adds/updates focused regression cases and fixtures for production shared state. Added cases include: overlapping same-input polls retain their pending response; initial loading failure remains a blocking error without invented records. | 3efbfb41687e1a107f79380fc405f4c1ec7e740fc87b74a5b664c64c9432da43 |
| [apps/web/tests/push-subscription.test.cjs](../../apps/web/tests/push-subscription.test.cjs) | Shared | Adds/updates focused regression cases and fixtures for push subscription. Added cases include: API unsubscribe failure rejects and leaves the browser subscribed for retry; browser unsubscribe refusal with a remaining subscription rejects instead of claiming push is disabled. | 80dbc2e15f57fc175e54d034b0f96fb80529230ebbe4f8af92bd893f0e29829c |
| [pnpm-lock.yaml](../../pnpm-lock.yaml) | Shared | Records the resolved Multer dependency tree used by final audits. | 7e0a9dd8b2e6c7f9d32556feac8e95e1d5d6ed3e0bcb2e46144f8abfc41c892e |

Local source hashes bind this report snapshot. Copied worker JSON is sanitized; provider, hosted ACL/config/recovery, legal and qualified-human release checks remain outside local acceptance.
