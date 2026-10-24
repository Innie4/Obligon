# Customer access and benefits frontend review

Reviewed on 24 October 2026, Africa/Lagos. This is an independent application review, not production release approval.

## Result

No remaining actionable frontend correctness finding was identified in the reviewed paths after the fixes below. External payment delivery and production deployment have not been established by this review.

Reviewed `CustomerBenefits.tsx`, `AdminBenefits.tsx`, `cashback-intent.ts`, `benefit-money.ts`, and their integration with customer access, location, appearance, profile settings and admin navigation. Checked the corresponding API paths, payload names and monetary response types against the implemented routes.

## Findings corrected during review

- Immediate duplicate cashback submissions previously created different request keys. A synchronous interlock now permits one request. Saved requests retain their original account, amount and key through uncertain responses and remounts.
- A durably declined saved redemption previously blocked subsequent amounts. The server now records the decline and returns `details.code: ["cashback_not_redeemed"]`; the UI clears only a definitive declined recovery record, retaining uncertain requests.
- Freshly discovered saved requests can be checked even when their amount exceeds the currently available balance. Confirmed redemption history also reconciles saved keys.
- Admin funding now exposes history, reference-specific verification and validated links to an existing checkout. Matching unresolved funding blocks a new checkout after remount; immediate duplicate starts are blocked. Missing processor transaction IDs are omitted rather than sent as null.
- Analytics hides the previous period during replacement loading or failure. Repair lists show an empty state only after a successful empty response. Zero-labour quotes with positive parts totals are accepted; fully subsidized repairs explain that no wallet payment is due.
- Alert delivery statuses are displayed. Profile sign-in guidance retains the distinction between device authentication and transaction approval. Dark benefit-list dividers use the customer theme.

## Fresh verification

| Check | Result |
|---|---|
| Benefits UI tests | 6 passed |
| Customer access/location tests | 7 passed |
| Customer theme tests, including contrast checks | 10 passed |
| Immediate repeated redemption handler | One request, one request key |
| Saved request with a definitive decline | Recovery record cleared; input enabled |
| Saved request discovered from shared browser storage | Original key reused |
| Matching unresolved admin funding | No new checkout; verification uses the original reference |
| Repeated immediate admin funding submission | One checkout request |
| Fully subsidized repair confirmation | “Accept quote”; “No wallet payment is due” |

Additional executed recovery evidence is saved in [frontend-review-recovery.json](evidence/frontend-review-recovery.json). Focused test logs are `/tmp/obligon-frontend-review-benefits24.log`, `/tmp/obligon-frontend-review-access24.log` and `/tmp/obligon-frontend-review-theme24.log`.

Access checks remain closed while subscription state is loading or failed. Unsubscribed customers can reach My Card and sign out. Preferences load only for an active paid account; account remounts and cleanup prevent retained themes or location watchers from crossing accounts. Location prompting uses the persisted atomic claim and does not request GPS before opt-in. Failed manual-location saves restore automatic tracking.

## Limits

Recovery proofs used controlled UI fixtures and synthetic responses, with no real charge, redemption or external payout. Earlier browser screenshots established palette and first-run location presentation, but the final benefits screens still need a complete browser pass at supported widths. Real device biometrics, GPS accuracy and external email/payment delivery were not exercised here. Backend financial reconciliation, operational monitoring and qualified human review remain separate release requirements.

Reviewed source hashes:

- `CustomerBenefits.tsx`: `3e3ddeb646ec4282bbda81631c7257703bb4e6f2db73c0f049f171c16eced39e`
- `AdminBenefits.tsx`: `3970a6a2689a06bc9531eb8b3397a2eeda9cb2b687c6a443b5c673ac9e59aad4`
- `cashback-intent.ts`: `da4a8ce9a2999aaa0653e7ad056423f0e210a7cf1f6ffb0c03b3efcfd44aeece`
- `benefit-money.ts`: `a43feeab204f4c540283caa52c2e926a8528e354ed4061b7dcd1a976b082ef00`
