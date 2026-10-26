# Accurate admin table readouts

> 2026-10-26 · Review the approved admin release, correct misleading readouts, test and deploy.

## In short
The company table now shows its actual active-card count even when the company's subscription is canceled. Two headings now describe the values underneath them accurately. These changes help an administrator read a record without confusing its count, category or reporting scope.

## What changed
- `apps/api/src/routes/admin.routes.js`: the companies response always formats the existing `active_cards` query result instead of substituting `ONBOARDING`.
- `apps/web/components/admin-dashboard/AdminScreen.tsx`: the disputes column says `Category`; the reporting percentage says `Share of listed revenue`.
- `apps/api/tests/admin-support.integration.test.mjs`: four real-route cases cover zero and two active cards for pending and verified companies with canceled subscriptions.

The release report records the checks and the limits of the visual review. This note and `learn/INDEX.md` explain the correction.

## How it works
1. The existing SQL counts cards with the current company's organization ID and an `active` status.
2. The response puts that count into the fourth table cell using `String(r.active_cards)`.
3. Separate response fields continue to describe verification and subscription status. A company can therefore show `2` active card records alongside a `Frozen` company badge.
4. The shared admin table uses the supplied headings in desktop tables and compact mobile records.

## Why it's built this way
The query already provided the correct count. Reusing it avoids another database request and preserves its organization filter. Changing authorization or card status would be a different operation, so this display correction does neither.

The report percentage already uses revenue from the listed stations as its denominator. A precise heading explains that existing calculation without changing it. The dispute row already contains the category; its heading now matches.

## The concept worth knowing: independent dimensions
Simply put, the number of books on a shelf and whether the library is open answer different questions. Closing the library does not turn its book count into the word `Closed`.

Here, `active_cards`, verification status and subscription status are separate dimensions of a company record. A count should remain a count. It does not itself grant permission to use those cards.

## Watch out for
- These tests also insert frozen cards and an active card belonging to another organization. Neither should increase this company's count.
- A canceled company showing active card records does not establish that purchases are allowed. Existing server authorization still controls operations.
- The percentage describes the listed stations, not all network revenue.
- This correction does not establish universal 5/5 visual quality or payment-provider readiness.

## Check yourself
1. Why remove the subscription condition instead of changing the company status?
   <details><summary>Answer</summary>The condition hid an existing count. Changing company status could grant access and would not correct the table's meaning.</details>
2. What if a different company has an active card?
   <details><summary>Answer</summary>The SQL organization filter excludes it from this company's count. The regression fixtures check that boundary.</details>
3. Why say `listed revenue`?
   <details><summary>Answer</summary>The percentage denominator sums the returned station list. Calling it a network-wide share would imply a broader denominator.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

---
*Made with Edirae Learn · edirae.com*
