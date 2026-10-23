# Payments and partner access

23 October 2026. Base: a27caac35d740a2dd4b8c53ea83c948a3163a400.

The task is complete when the affected payment flows are traced, concrete defects are corrected and independently reviewed, isolated regressions pass, the exact release receives qualified human approval, and the approved source is pushed and verified on Vercel/Render. Provider-only and operational checks must be reported honestly.

## Accepted product decisions

- Mechanics use a workshop dashboard with profile, team, support, verification and billing. No mechanic booking or service-payment workflow is being invented.
- Gas stations use each station's approved selling unit. No implicit litre/kilogram/volume conversion is allowed.
- Existing partner membership rank, subscription, station ownership and subtype checks are cumulative. Menu filtering never substitutes for server authorization.

## Payment invariants

- Amounts use exact integer minor units and validated bounds. No overspending or unauthorized/cross-tenant movement.
- Repeated requests and workers must not duplicate ledger or provider effects. Bind durable keys to caller and payload.
- Pending, failed, successful and uncertain outcomes remain distinct and recoverable. Provider response loss must not cause blind reissue.
- Every movement remains attributable and traceable; corrections preserve evidence. Full provider/bank/books agreement is a separate acceptance requirement.
- Gas quantity and approved unit are snapshotted with the price/order/receipt. Historical records keep their original units.

## Increments and ownership

1. Root: authoritative organization subtype, approved station fuels/units, signup/session/API/SSE policy and safe sale enforcement. Verify all roles, nested routes, stale tokens, foreign IDs and denied mutations.
2. Customer/partner agent: common navigation policy, workshop screen and honest unit-aware station/POS forms. Verify desktop/mobile/search/direct URLs and quantity display.
3. Financial agent: durable company issuing, correct company wallet notification destination and checked settlement aggregates. Verify retries, response loss, database failures and exact amounts.
4. Company/admin agent: durable fair payout reconciliation claims. Verify more than one batch, concurrent workers, expiry/recovery and stale responses.
5. Integrate, independent review, focused then broad suites/build/local browser checks. Document provider, operator and release acceptance gaps. Request approval only after concrete patch/report are ready.

No real funds, destructive hosted tests, new paid services or live scheduler changes. Local PostgreSQL 18 at loopback port 55423 uses disposable data. Migrations 035/036/037 are reserved respectively for partner scope, company issuance and payout reconciliation.
