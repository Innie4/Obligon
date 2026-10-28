# Partner contracts and Company subscriptions

> 2026-10-28 · Change dashboard access, add one-day inspection logins and connect Careers editing.

## In short
Partners now use admin-approved contracts. Companies buy the published annual Organization plans. Both dashboards have explicit, read-only test leases that expire after 24 hours.

## What changed
- `apps/api/src/lib/subscriptions.js` separates `partnerContract`, `companySubscription` and their route guards. Company vehicle/card limits use the same catalog rules.
- `apps/api/src/routes/subscription.routes.js` freezes the checkout period and confirms annual payments atomically. Migration `049_company_organization_plans.sql` keeps old monthly quotes and periods intact.
- `company.routes.js`, `company-card-issuance.js`, `money.js` and `fuel-sale.js` enforce company plans at operational and financial boundaries. Vehicle creation counts inside a transaction; saved issuer results remain recoverable.
- `partner.routes.js`, `fuel-checkout.routes.js`, `fuel-checkout.js` and `middleware/auth.js` replace partner subscription checks with contract approval, including station selection, integration keys and delayed fuel collection.
- `temporaryPartnerAccount.js` and `scripts/grant-company-test-access.js` add the second bounded lease. `index.js`, `auth.routes.js`, `admin.routes.js` and authentication middleware preserve expiry, session and conversion restrictions.
- `intake-admin.routes.js` and `IntakeConsole.tsx` add validated job edits and removal while retaining applications.
- Frontend Company/Partner shells, gates, Billing, shared `SubscriptionPanel.tsx`, `AuthForms.tsx`, Pricing, admin approval controls, search and mock copy follow the new policy. The exact source/test inventory is in `reports/dashboard-policy-2026-10-28/source-manifest.json`; affected API and UI tests exercise these paths.

## How it works
1. Authentication resolves the current user and organization membership.
2. Partner operations require current verified approval. Existing verified partners carry over; new approvals require the admin's contract confirmation and audit record.
3. Company operations require an active paid period, or the exact reserved read-only test identity during its lease.
4. Company checkout stores integer kobo, tenant, plan and annual interval before opening the processor. Verified payment claims the pending quote once and activates its saved period.
5. Careers always reads open database postings. Editing changes the source record; closing/removing stops public listing. The foreign key preserves submitted applications.

## Why it's built this way
The dashboard tools and existing payment flow already fit their users. Changing their access policies avoids moving roles or financial history. Saving the quote's interval prevents a later catalog edit from changing what an earlier payment buys.

## The concept worth knowing: a lease
Simply put, a lease is a key with a fixed expiry. Opening the door again does not buy another day.

Precisely, the operator stores a database-timed `access_expires_at`. Runtime authentication and sessions enforce that timestamp, and startup never grants more time. The company exception also binds the exact identity and organization, so another company cannot borrow it.

## Watch out for
The temporary logins can inspect dashboards but cannot transact. Real provider acceptance is not established by isolated tests. A revoked station approval moves confirmed fuel payments into review/refund handling. Keep the additive migration and financial records during rollback. Mobile browser viewport control was unavailable, so desktop screenshots are not mobile proof.

## Check yourself
1. Why store the billing interval on the quote?
<details><summary>Answer</summary>A catalog change after checkout must not change the period purchased by that payment.</details>

2. What if the same payment is confirmed ten times?
<details><summary>Answer</summary>The locked pending payment is claimed once. Later confirmations return its recorded result without extending the subscription again.</details>

3. Why check the company plan inside a wallet transaction too?
<details><summary>Answer</summary>A service can be called outside its original route. The financial boundary must enforce the plan and authorization itself.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
