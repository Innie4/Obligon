# Customer access and funded plan benefits

> 2026-10-24 · Enforce customer subscriptions, improve location and appearance settings, and implement plan benefits.

## In short

Customers now unlock operational pages after confirmed plan payment. Location consent and themes belong to the account. Cashback and generator labour discounts draw from a separate funded programme, so a displayed benefit cannot create money by itself.

## What changed

- `apps/web/components/customer-dashboard/CustomerAccess.tsx` and `CustomerShell.tsx` share the paid gate. `CustomerScreen.tsx` connects it to each page.
- `StationLocationControl.tsx` handles the one-time prompt and location updates. `CustomerTheme.tsx` and `customer-theme.css` handle account-specific appearance.
- `CustomerBenefits.tsx` implements analytics, rewards, alerts and repair requests. `apps/web/components/admin-dashboard/AdminBenefits.tsx`, `apps/web/app/admin/customer-benefits/page.tsx` and `apps/web/lib/mock/admin-data.ts` add administrator review.
- `apps/web/lib/benefit-money.ts` parses exact amounts. `cashback-intent.ts` preserves uncertain redemption requests.
- `apps/api/src/lib/subscriptions.js` and the customer, subscription, webhook and checkout routes enforce access and payment activation. `fuel-sale.js` and `fuel-checkout.js` snapshot purchase eligibility.
- New API modules `benefit-budget.js`, `customer-rewards.js`, `generator-repairs.js`, `customer-benefits.js`, `personal-fuel-alerts.js` and `benefit-reconcile.js` implement the benefits. Their routes validate and authorize requests; `reconcile.js` includes recovery.
- Migrations 042–045 store preferences, payment activation, alerts, programme funds and repairs. `env.js` and `.env.example` default new funding off. `flutterwave.js` reads optional settlement evidence.
- Focused API/web tests and existing affected fixtures verify the integration. The complete per-file inventory, including the package-only Multer update, is in `reports/customer-access-2026-10-24/source-manifest.md`.

## How it works

1. The client checks the signed-in customer's subscription. Operational API calls also require a currently paid period and the relevant feature.
2. Confirmed initial payment claims `subscription_activated_at` once. Later approval cannot restart that period.
3. Stations atomically claims the first prompt. Location starts only after saved opt-in; stopping it removes its watcher.
4. Completed eligible purchases create cashback awards. Available programme funds reserve the award before it becomes redeemable.
5. Redemption reuses the caller's saved key after an uncertain response. The database moves cashback and wallet balances once.
6. A repair quote separates labour and parts, reserves its subsidy and holds the customer's payment. Completion records an unpaid mechanic liability.

## Why it's built this way

The browser gate improves navigation; server checks enforce access. Database transactions and locks work across multiple API workers. New programme funding stays disabled until provider settlement behaviour is verified. Existing components and ledger conventions avoid a second payment system.

## The concept worth knowing: idempotency

Think of a receipt number: asking twice about one receipt should not create a second purchase. An idempotency key identifies one intended action. Here it is bound durably to the caller and amount. Repeating it returns the existing outcome; changing the amount under that key is rejected. A confirmed decline is also saved, so it cannot unexpectedly succeed later.

## Watch out for

Local tests use synthetic providers and funds. Actual settlement, card issuing, physical GPS and email receipt remain separate checks. Repair completion does not pay the mechanic externally. Purchase analytics do not estimate vehicle efficiency. Production release requires qualified human review.

## Check yourself

1. Why does hiding a menu fail to protect an unpaid customer's data?
   <details><summary>Answer</summary>A client can call the API directly. The server must check the paid period and feature before returning or changing operational data.</details>

2. What if the redemption response is lost after the wallet was credited?
   <details><summary>Answer</summary>The saved key lets the client retry the same action. The database finds its durable record and avoids a second credit.</details>

3. Why reserve a repair subsidy before accepting customer payment?
   <details><summary>Answer</summary>Concurrent quotes could otherwise promise the same programme funds. Reservation commits the subsidy to that quote before the customer pays.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
