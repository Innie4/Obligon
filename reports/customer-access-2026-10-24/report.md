# Customer access, location, themes and plan benefits

2026-10-24. Base `f72ae49c150787599cac2c720b6e4b183267cd16`, branch `master`.

## Release status

Implementation is locally verified. On 2026-10-24, the user confirmed they are qualified and explicitly approved pushing and deploying this exact prepared patch. The approval applies to the frozen review identity below, with new programme funding disabled. Deployment progress and live verification are recorded in [release.md](release.md).

Review the complete [source diff](changes.diff), [file hashes](source-manifest.json), [backend review](backend-review.md), [frontend review](frontend-review.md) and [browser verification](browser-verification.md). The source manifest identifies the exact review revision. Historical reports from other tasks are excluded from the source patch.

Frozen review identity: **71 source/test/dependency/configuration files**, patch SHA-256 `58deb84ce9b4e02325c322dc727a29a8ee9f0bea4d9af16d5fcb27ae83037fc9`.

New benefit funding defaults to **disabled**. This release must retain that setting until provider settlement verification and operational approval are complete. The programme starts with zero funds in production. Synthetic local balances shown in screenshots are test fixtures only.

## Agreed behaviour

- An unsubscribed customer may purchase a plan, complete card verification and sign out. Profile, Support and operational dashboard access stay locked.
- Server-confirmed plan payment unlocks the dashboard immediately. Identity approval and card issuance are still separate requirements for card use.
- The first Stations visit for an eligible newly created account asks whether to use location. Existing accounts do not receive a retrospective automatic prompt.
- Gold and Platinum earn 5% cashback on final eligible personal fuel spend, after discounts and excluding fees. Rewards have no expiry and redeem into the personal fuel wallet.
- Obligon funds generator labour discounts: Bronze 30%, Gold 60%, Platinum 100%. Parts are charged in full. The customer must see an itemized quote and programme funds must be reserved before acceptance.

## Pages and dashboards changed

| Page or area | Result |
| --- | --- |
| All customer pages and shared navigation | A shared subscription state gates the page, menus, search and bottom navigation. Loading, lookup failure, expiry and account changes block operational content. The unpaid shell contains My Card access and sign-out. |
| `/customer` Overview | Plan-gated purchase analytics with 7/30/90/365-day ranges, exact spend, purchase counts, daily totals and separate litre/kg/scm quantities. Rewards show available, awaiting-funding and refund-recovery balances, redemption history and safe retry controls. Bronze cannot earn new cashback or access premium analytics. Previously earned cashback remains redeemable on a later active plan. |
| `/customer/card` My Card | Remains reachable without a subscription for plan purchase and identity verification. Operational budget/fuel controls are unavailable while unpaid. Paid applicants waiting for a card can renew. The first paid period begins after confirmed payment and is not restarted by later approval or callback replay. |
| `/customer/stations` Stations | Accessible location popup, explicit opt-in or browse-without-location, saved account preference, atomic one-time initial claim and manual fallback. Opted-in GPS watches position changes and cleans up on disable/unmount. Approved active registered stations are sorted nearest first. Fuel filters apply across the server-side network before the nearest-results limit, and draft filter edits apply only on confirmation. |
| `/customer/profile` Profile & Settings | Sign-in options are inside Profile rather than a standalone sidebar entry. Light/dark choices save to the account, roll back on failure and reset safely when the account changes. Theme styling covers customer dialogs and feedback portals. Premium spending alerts can be enabled with validated percentage thresholds, with delivery availability stated explicitly. |
| `/customer/support` Support | Itemized generator requests, quote review, labour subsidy, acceptance confirmation, held-payment receipt and cancellation before work begins. Existing assisted services remain plan-gated requests whose availability and quotes require confirmation. Priority Support follows the plan. |
| Customer wallet, fuel checkout, history, transaction detail/receipts, notifications and report-problem pages | The shared paid gate prevents operational use before payment. Relevant API routes additionally enforce wallet, fuel purchase, history, receipts, budget and spending-limit features. Existing owned payment confirmations can still reconcile after plan expiry. Legacy subscription navigation inherits My Card behaviour. |
| `/admin/customer-benefits` Customer Benefits | New navigation and page for programme balance, pending rewards, reserved repair subsidies, funding history/recovery and repair reviews. Funding checkout is visibly unavailable while the release flag is off. Admins can itemize labour/parts, select a verified mechanic, reserve subsidy, start work, complete it or cancel before work. |
| Partner POS and paid order fulfillment | Purchase-time cashback eligibility is snapshotted from the personal plan. Direct checkout earns only after fulfillment. Post-commit personal spending alerts cannot turn a successful sale into a failed response. Company transactions do not receive personal cashback or personal spending alerts. |
| Company dashboard and public pages | No visual redesign in this task. Shared payment integration tests cover affected company behaviour. Personal rewards are explicitly separated from company activity. |

The new analytics describe purchases and purchased quantities. They do not infer vehicle efficiency, mileage or actual engine consumption without telemetry. The UI states that limit.

## Backend and persisted data

- Migration **042** adds account theme/location preferences and a one-time subscription activation marker. Existing account location prompts are marked seen. Existing matching paid periods are preserved. Eligible paid applicants who previously waited for card approval receive their initial period at rollout, without rewriting payment timestamps. Matching withdrawn/refunded charges cannot retain the associated entitlement or cancel an unrelated newer renewal.
- Migration **043** adds opt-in spending alerts. Event keys deduplicate thresholds by customer and month. Dashboard notifications and a durable email outbox respect category/channel preferences and verified email. SMS and push are not advertised as budget-alert delivery channels.
- Migration **044** adds programme funding, cashback awards/balances, immutable redemption attempts, subsidy reservations and balanced source/destination movement records. Legacy purchases have a zero cashback rate. The programme never credits spendable money without verified funding.
- Migration **045** adds versioned generator quotes, request/events, service escrow traces and unpaid partner payables. Amounts and quote totals have database constraints. Financial movement/event records are immutable. All new private tables have RLS enabled and browser API roles lose direct privileges.

New API surfaces use existing routers and authorization: customer preferences, benefits/alerts/analytics, rewards and generator repairs; administrator benefits funding and generator-repair review. Existing reconciliation and signed webhook paths include funding recovery. No dependency framework, CI workflow or external service was added for these features.

## Financial properties checked

Amounts use integer minor units and exact bounded conversions. Programme transfers record equal positive source/destination amounts. Customer payment, repair state, wallet ledger and subsidy reservation changes commit atomically. Unique keys bind the caller and payload; PostgreSQL locks and constraints protect concurrent workers.

Cashback funding reserves actual programme funds. Missing funding creates pending awards, without wallet credit. Duplicate redemptions have one effect. Uncertain requests retain their browser recovery key. Insufficient-funds declines are committed durably, so an old declined key cannot unexpectedly redeem later. Refunds reverse related rewards; already-used cashback is recovered from later awards, without an invented treasury credit or forced wallet debit.

Repair acceptance binds the quote version and customer. Only verified mechanic partners can be assigned. Cancellation before work returns held payment and releases the subsidy once. Completion records an **unpaid partner liability**. It sends no external payout and does not claim a mechanic has been paid.

The automated cases include repeated keys, altered payloads, cross-customer access, 20 concurrent redemptions/funding confirmations/repair payments, competing reservations, malformed/zero/oversized amounts, database failure after mutations, uncertain checkout creation, missing/forged net settlement, full and cumulative partial refunds, stale quotes and cancellation replay. Broader existing payment recovery/webhook suites also pass in isolation with controlled providers.

## Verification

Evidence is saved under [evidence](evidence/). Test databases were restricted to the explicitly opted-in localhost PostgreSQL cluster. Providers were controlled responses; no real funds or personal identity operations were used.

- Complete API suite after Multer 2.5.0: **1,354 passed, 0 failed, 13 opt-in smoke checks skipped**, 1,367 total. Complete output: `evidence/api-final.tap`.
- Complete web suite: **679 passed, 0 failed, 0 skipped**, including the cross-tab redemption regression.
- TypeScript `tsc --noEmit`: passed.
- Optimized Next.js production build: passed, 80 generated pages. Existing lint warnings and the nested-workspace lockfile warning remain in the saved build log; this is not a zero-warning claim.
- Clean Supabase-compatible local database: all migrations 001 through 045 applied successfully, and a second migration-runner invocation made no changes. The disposable database was removed. Plain PostgreSQL needs the existing Supabase `auth.uid()` scaffold, as used by the repository's integration tests.
- Existing staged-diff secret scanner: **CLEAN** in its documented environment-value matching scope. This is not an exhaustive repository-history or provider-secret audit.
- Fresh dependency advisory check found Multer `GHSA-q7qp-rjg7-q26m`; the package-only update installs 2.5.0. Both the production audit and the subsequent full audit return zero advisories at all severities. The remediation is documented in [multer-advisory.md](multer-advisory.md); the full response is `evidence/full-advisory-after.json`.
- Final code reviews found no unresolved concrete defect in reviewed paths. The spending-alert author's review is identified as a self-check; it is not represented as independent qualified human review.
- Chrome exercised location choice/persistence/manual nearest sorting/filtering, mobile/desktop themes, alert preference saves, rewards, customer/admin repair flow, unpaid direct URLs, Bronze restrictions and subscription transport failure. Widths: 320, 390, 768 and 1440 pixels. Details and screenshots are in [browser verification](browser-verification.md).
- Post-browser database assertions proved synthetic programme conservation, the final wallet balance and the unpaid repair liability. The JSON contains only synthetic aggregate amounts.

The 13 skipped API smoke cases require an explicit `SMOKE_BASE_URL` and the separate legacy seeded smoke accounts. They were not pointed at production or silently counted as passes. Local browser and HTTP integration checks used this task's own synthetic accounts instead.

## Design and accessibility

The requested app-designer skill and ten-source UI reference guide informed the location flow, access wall, Profile choices and state design. Existing typography, branded green, components and popup conventions were retained. The implementation uses labelled controls, native radio semantics, modal confirmations, keyboard focus support and reduced-motion-aware transitions.

Three static design directions and state specifications are retained in [design](design/). Their automated static renderer could not run because `playwright-core` was unavailable, and the browser rejected file URLs. No workaround was used. Actual HTTP application screenshots were inspected instead. No three-direction render completion, automatic visual score, 5/5 rating or flawless accessibility claim is made.

## Remaining release and operating checks

1. Qualified reviewer approval of the exact source manifest and diff is still required. The user's supplied engineering policy says: **"Require qualified human review before production release of money movement, authentication/authorization boundaries, tenant isolation, destructive migrations, sensitive data flows, or similarly consequential changes."** This patch changes paid access and money-related flows, so prior unrelated approval cannot substitute.
2. Keep `BENEFIT_FUNDING_ENABLED=false`. Actual Flutterwave sandbox settlement/net-amount evidence and operational reconciliation are unavailable. The current contract accepts only verified net funds; provider acceptance alone is insufficient.
3. Production programme funding starts at zero. Rewards wait for funding and repair discounts wait for reserved funds. This feature must not be advertised as immediately funded until a verified source is available.
4. External mechanic payout and payout reconciliation are not implemented by this workflow. Operations must settle the recorded unpaid liabilities through a reviewed process.
5. Live GPS permissions, movement on physical devices, screen-reader use, actual spending-alert email-worker delivery and production rate/monitoring behaviour remain unverified in this task.
6. Existing BVN/issuer readiness and Nigerian SMS receipt limitations remain from earlier reports. Nothing in this task proves identity-provider activation or actual card issuance.
7. Real-provider sandbox recovery, reconciliation, abnormal-transaction alerts, qualified compliance advice and the other relevant real-money release requirements in the user's financial policy are not replaced by local tests. No comprehensive external API penetration test was performed.
8. The new revision is not on Render/Vercel yet. Its migration startup, public health, exact commit, authenticated customer paths and provider-disabled state must be checked after an approved push. There is no claim that the new release is live.

## Release and recovery plan

After exact-patch approval, commit only manifested application/dependency files and this task's review/learning artifacts. Push `master` through the existing Git-connected release path. Do not upload the localhost-configured prebuilt web artifact. Keep funding disabled and inspect migration startup before considering the API live. Check both providers' exact Git revision and health, then the authenticated customer wall/My Card, paid account navigation and admin benefit page with available access. Report any blocked live checks.

If new access gates fail or duplicate/negative money effects appear, stop rollout and new benefit operations. Use the previous known Render/Vercel release or a reviewed source revert through the normal deployment path. Retain additive schema and all financial/event records; do not drop benefit tables or erase activation markers as a rollback. Investigate posted rewards/payables before any correction and use compensating records. A timed production rollback drill, canary traffic control and post-release monitoring window have not been demonstrated here. Those operational limitations must remain visible to the reviewer.
