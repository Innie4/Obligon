# Payment and partner access review

23 October 2026. Base revision: `a27caac35d740a2dd4b8c53ea83c948a3163a400`.

Status: implementation and isolated verification prepared. This patch has not been committed, pushed or deployed. Qualified human review of this exact patch is required before production release. Passing the checks below does not establish complete production readiness.

## Decisions followed

- Mechanics receive a workshop dashboard with profile, team, Support, verification and billing. A mechanic booking or service-payment product has not been introduced.
- Gas stations use each product's admin-approved selling unit. No litre, mass or volume conversion is inferred.
- Existing role, membership, organization verification, subscription, station ownership and transaction limits continue to apply together.
- No real funds, hosted provider mutations, new paid services or production scheduler changes were used for these tests.

## Changes by dashboard and page

| Area | Pages or flow | Implemented behavior |
| --- | --- | --- |
| Customer | Overview | Reports fuel quantities separately in litres, kilograms and standard cubic metres, retaining fractions. Recent activity uses the transaction's recorded unit. |
| Customer | Transactions and receipt preview/download | Preserves the recorded quantity and selling unit. Personal transaction and wallet history exclude company records. PDF receipts retain fractions and show the actual unit. |
| Customer | Fuel checkout and fuel orders | Uses approved product/unit prices, requires explicit gas units, records the quote's unit, and preserves it through confirmation and collection. Changed approval sends an already-paid order to review instead of authorizing a different quantity. |
| Customer | Station locator and station detail | Shows per-product prices with approved units. Hides stale unit prices, unapproved offers and suspended stations; retains nearest-station ranking and confirmed-coordinate rules. |
| Partner | Desktop sidebar, mobile bottom navigation, Account menu, search and direct URLs | All use shared subtype policy. Mechanics see workshop/account functions; gas stations see their allowed station functions. Hidden navigation is backed by server authorization. The legacy mechanic URL follows the current organization subtype. |
| Partner: mechanic | Overview and Workshop profile | Replaces fuel metrics with real workshop/team/Support information. Owners and authorized managers can save workshop details and services. Viewers cannot manage the profile. No booking, collection or service-payment functionality is claimed. |
| Partner: mechanic | Team, Support, notifications, settings, verification and billing | Common account functions remain reachable, including nested staff actions. Fuel POS permissions and fuel notifications/events are excluded. Staff mutations recheck current management permission inside their transaction. |
| Partner: gas station | Station profile | Selects canonical gas products and requested units. Owners cannot approve their own product/unit scope; changes return the station to review. |
| Partner: gas station | Fuel pricing and price history | Allows the organization's products and approved station units. A changed unit requires a new price; old price history retains the previous unit and does not calculate a percentage across different units. Malformed entries are rejected. |
| Partner | POS and receipts | Checks organization subtype, station approval, current price/unit and request unit on the server before dispensing or debiting a wallet. Receipts show the recorded unit. |
| Partner | Resupply | Whole quantities use the approved unit and retain that unit on the request. Historical litre requests keep their original meaning. |
| Partner | Reports, transactions and CSV exports | Separates physical units instead of adding kilograms to litres. Exports include quantity and unit. |
| Partner | Settlements and payouts | Reconciliation rotates unresolved work fairly, claims work durably, fences stale workers and checks exact integer bounds before posting settlement changes. Verified legacy Paystack callbacks update payout and settlement accounting atomically. |
| Company | Cards and issuance modal | A stable caller key binds the organization, actor and request. A durable operation precedes the external issuer call. Concurrent requests cannot issue repeated cards. Provider response loss remains an explicit review state. Completion rechecks current actor, membership and company approval. |
| Company | Billing and top-up notification | Company-wallet notifications open Company Billing. Personal-wallet credits retain their personal-wallet destination. |
| Company | Transactions, reports, exports and station locator | Retains quantity/unit in exports and formatted tables, groups reports by product and unit, and publishes only approved station offers. |
| Admin | Intake station review | Explicitly approves legal products and selling units. Gas units cannot be inferred from historical litre contracts. |
| Admin | Operations recovery | Lists unresolved company issuance operations and refund states. Existing-card reconciliation verifies issuer identity, customer, active NGN status and separately fetched zero balances. The bounded payment reconciliation action is clearly described; no arbitrary transfer or manual mark-paid button is introduced. |
| Admin | Platform reports and exports | Network and station quantities remain separate by unit, including CSV and PDF output. |
| Signup and sessions | Partner type and services | Supports gas stations and persists mechanic services. Organization subtype remains authoritative for staff, existing sessions and API keys. |
| Shared realtime | Partner event delivery | Rechecks the current account, session and membership before protected delivery, filters fuel events by subtype, and bounds queued delivery. |
| Shared provider client | Payment, issuer and verification requests | Timeouts cover headers and complete bodies; response bodies are bounded to 1 MiB. Write requests remain single-attempt. Flutterwave rejects a numeric wire amount if its decimal representation would lose a kobo. |
| Web runtime | Next.js | The initial advisory audit found critical and high advisories in 15.5.27. Next.js and matching ESLint/SWC packages are now 15.5.28. The post-update production advisory audit reports zero findings. |

## Financial properties checked

The isolated tests exercise durable idempotency, concurrent authorization/assignment and payout claims, insufficient funds and amount bounds, duplicate and invalid callbacks, provider timeouts and uncertain responses, transaction rollback, stale membership and tenant boundaries, refund recovery and unit changes after payment. A recorded issuer receipt can complete locally without another issuing POST. Unknown provider results stay recoverable rather than being treated as failures safe to retry.

Concrete regressions were demonstrated against the old behavior before their fixes: twenty company-card retries issued twenty provider requests; stalled provider bodies outlived their deadline; old Paystack callbacks left settlement totals unpaid; and a full batch of old unresolved payouts could starve newer work. Staff demotion during an awaited create request could also commit credentials and a membership under the old route.

## Verification

- Final integrated API run: **1,213 tests, 1,200 passed, zero failed, 13 skipped**. The skipped cases are the explicitly configured live-service smoke suite, not the isolated PostgreSQL/HTTP suites. See `evidence/api-acceptance.tap`.
- Cross-dashboard quantity checks include a generated PDF receipt and real HTTP responses against disposable PostgreSQL. Source syntax checks covered 30 changed/new backend/shared modules with no failures.
- Clean migration smoke: all **38** migrations applied, then **zero** applied on the second run with an unchanged migration ledger. Verified 14 expected columns, seven unit checks, payout queue index and company-issuance row security.
- Patched-runtime frontend suite: **485 passed, zero failed or skipped**; TypeScript and the production build passed. A later CSS-only pricing correction received 13 focused tests, another TypeScript check and a fresh production build. Browser evidence is recorded separately. Targeted test groups overlap with the full suite and must not be added to its total.
- Production dependency advisory audit after the focused update: **zero findings** across 279 production/optional dependencies, down from one critical and one high. Only Next.js and its matching ESLint/runtime packages changed. The first download timed out; a bounded retry succeeded. See `evidence/dependency-receipt.json` and `evidence/dependency-after.json`.
- Trivy's local, offline source-secret scans found **zero matches** in `apps` and `packages`; dependencies, generated output and environment files were excluded. This is a pattern scan, not a guarantee that no secret exists.
- Review agents inspected the payment, authorization, realtime and approved-unit increments. Their reviews are supporting evidence and do not replace the required qualified human release review.

## Remaining launch requirements and limits

1. Sudo credentials and actual sandbox issuer acceptance are still unavailable. Mocked provider tests do not prove issuer setup, issuer terms or live behavior.
2. Complete payment/refund/payout sandbox acceptance and bank/provider/books reconciliation, crash recovery in the hosted setup, and the manual external-refund procedure still require operational evidence. The local ledger is not proof of provider agreement or a fully balanced accounting system.
3. A dependable hosted reconciliation runner, monitoring, abnormal-transaction alerts and backup restoration need acceptance. The live scheduler has not been enabled by this patch.
4. If the issuer customer-create response is lost before the customer ID is saved, no card POST is sent; provider-led investigation is required. A deleted/deactivated fleet assignment during issuance retains the issuer evidence and requires Support resolution before completion.
5. Nigerian SMS handset delivery remains unconfirmed from earlier work. Email delivery previously worked, and either-contact signup verification is retained. General sender-domain acceptance remains an operational check.
6. Broader independent static/API security assessment, load/device acceptance, applicable payment/card obligations and qualified legal/regulatory review have not been established by this task.
7. Vercel/Render acceptance of this exact new revision cannot be claimed before approval, push and deployment. The earlier deployed revision does not contain these fixes.
8. Chrome's request-header policy currently blocks automation in the user's Chrome profiles. Any successful in-app-browser evidence is labelled separately.

## Release and recovery

The user-authorized push targets `master`, which triggers hosted deployment. Before that release, a qualified reviewer must approve the exact source patch and residual risks. The source manifest and patch hash are supplied with the completed review package.

Migrations 035–038 are additive except for explicit constraint replacement and data backfills. Validate deployment logs and health against the exact revision. Preserve issuance claims, payment/refund evidence and recorded units during rollback. Reverting application code is not a reason to remove financial evidence, undo verified money effects or reinterpret gas quantities as litres. A failed release must stop for investigation; do not blindly repeat provider writes.

## Review record

The independent payment reviewer requested a fresh actor/company check after issuer latency; that check and suspended-actor, revoked-manager and withdrawn-contract tests were added. The authorization reviewer found a staff-create/delete race around awaited work; those writes now take the organization lock and recheck current management permission transactionally, with an old-code reproduction and passing focused tests. The unit reviewer confirmed that a changed approval cannot reinterpret a paid order and identified a legacy mixed-station edge; an unreviewed gas product no longer suppresses an independently approved liquid offer. The final pricing boundary also rejects null entries and sorts product writes consistently.

The broad test run initially exposed outdated handcrafted schemas, obsolete source assertions and a supposedly foreign organization owned by the same fixture user. Those fixtures were corrected to model the current schema and genuinely separate tenants. Real HTTP/PostgreSQL tests verify the behavior independently of source-pattern assertions. Earlier failing run logs were retained in the task's temporary diagnostics; `evidence/api-acceptance.tap` is the final integrated result.

The pre-update web build generated 78 static pages and retained existing lint and workspace-root warnings. These warnings are not represented as a clean lint result. Final patched-runtime verification is recorded separately from that earlier build.

During visual acceptance, the CNG price suffix wrapped into three short lines inside its input. The amount now uses shrink-safe flex sizing and the approved-unit suffix stays on one line. The pre-fix screenshot is retained separately from the final view.

The responsive pricing pass additionally found horizontal overflow at phone width. Explicit single-column grid tracks, shrink-safe cards/selects and responsive controls correct the min-content sizing; final desktop and phone measurements are recorded in the browser receipt.

## Final local browser acceptance

The in-app browser tested the patched production build with synthetic accounts against an isolated real API/PostgreSQL schema. Workshop owner/viewer permissions, mobile Account menus, direct fuel-route restriction, gas profile/pricing/POS, admin recovery and unit-review forms, and company station prices were inspected. No financial form was submitted. Console error log was empty. Pricing document/body widths matched client width at 320px (305), 390px (375) and 1440px (1425), with scrollbar space accounted for. Final images and `evidence/browser-acceptance.json` preserve the checks. Chrome remained unavailable; this evidence comes from the in-app browser. Task servers and disposable schema were cleaned up afterward.

This payment/subtype increment contains 103 source/test/dependency files. Its source patch SHA-256 is `dbdee29aa4124bafcb3d18be635ff9707e5639ca1bd1eae0863414a05559b625`; see `changes.diff`, `source-manifest.json` and `changed-files.md`. The later Google/passkey request is a new authentication increment and requires an updated combined review package before release.
