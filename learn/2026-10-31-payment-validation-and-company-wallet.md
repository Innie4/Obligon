# Payment checks and a separate Company wallet

> 2026-10-31 · Validate payments, correct calculations and make Company wallet access clear.

## In short

Local calculation fixes align the fuel quote with the API and calculate cashback from the actual debit. Company Billing separates Subscription and Wallet, and an integration test checks webhook accounting through the real application. The exact patch is approved; live delivery remains unproven.

## What changed

- `apps/web/components/customer-dashboard/CustomerFuelCheckout.tsx`: `fuelCheckoutQuote` parses decimal quantities into integer hundredths and applies exact rounding.
- `apps/web/tests/production-customer-controls.test.cjs`: checks the rendered quote and rejects malformed or oversized inputs.
- `apps/api/src/lib/customer-rewards.js`: bases new awards on the final customer debit, without subtracting the station revenue share again.
- `apps/api/tests/customer-rewards.integration.test.mjs`: checks discounted purchases, small awards, refund reversals and conserved programme funds.
- `apps/web/components/company-dashboard/CompanyScreen.tsx`: adds accessible Billing tabs, payment-return selection, wallet balance and success feedback.
- `apps/web/components/company-dashboard/CompanySubscriptionGate.tsx`: accepts optional explanatory content for a locked protected section.
- `apps/web/tests/company-billing-payment-flow.test.cjs`: checks callback routing, tabs, keyboard navigation and confirmation refresh.
- `apps/web/tests/dashboard-access-policy.test.cjs`: confirms the explanation does not unlock protected content or duplicate subscription checks.
- `apps/api/tests/payment-webhook-recovery.integration.test.mjs`: uses `createApp()` and checks an authenticated Company callback, replay and rejected authentication.

## How it works

1. The preview converts quantities and percentages into integers before multiplication. A half-kobo boundary rounds the same way as the server.
2. Cashback snapshots the final fuel debit. Station commission remains a separate accounting allocation. Existing awards retain their stored snapshots.
3. A Company funding return opens Wallet; a marked subscription return opens Subscription. An inactive subscription shows an explanation instead of an empty panel.
4. The isolated webhook test verifies a fixture payment, credits only its Company wallet once, and checks that replay creates no second credit. Unexpected external requests are blocked.

## Why it's built this way

Integer arithmetic prevents decimal errors changing the checkout price. The existing gate still decides access; its explanation only changes what a locked user sees. Testing real middleware catches wiring problems a separate test router could miss.

## The concept worth knowing: idempotency

**Simply put:** scanning the same receipt twice must not put the money into a wallet twice.

**More precisely:** the webhook receipt and wallet credit commit together, and the ledger uses a unique operation key. A repeated confirmed payment reuses the existing result instead of adding value again.

## Watch out for

- The combined local run passed 332 API checks and 16 focused Wallet/access checks. Fixture providers do not prove external settlement.
- One real Company payment was manually confirmed. A nonfinancial probe authenticated, but provider replay still fails. Browser redaction leaves secret equality unknown.
- The qualified reviewer approved the exact financial patch. Existing underpaid awards still need reviewed compensating corrections; deployment verification remains separate.
- Scheduler recovery remains disabled with an unverified historical backlog. Enabling it can execute queued financial work.

## Check yourself

1. Why keep the station commission out of the cashback deduction?
   <details><summary>Answer</summary>The customer's recorded fuel debit already includes the discount. Commission divides that payment between recipients; subtracting it again understates what the customer spent.</details>

2. What if a payment callback arrives twice?
   <details><summary>Answer</summary>The stored receipt and ledger key prevent another credit. The test checks one principal credit and an unchanged personal wallet.</details>

3. Why does a passing local webhook test not prove live delivery?
   <details><summary>Answer</summary>Its provider replies and secrets are controlled fixtures. The live merchant URL, secret and receiver response must also agree.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

---

*Made with Edirae Learn · edirae.com*
