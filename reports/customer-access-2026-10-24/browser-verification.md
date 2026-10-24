# Browser verification

2026-10-24, Chrome, local optimized Next.js build. The API used a disposable PostgreSQL schema and synthetic accounts. All external provider fetches were disabled. No personal GPS, real charges, real refunds, real BVN or issuance operations were used.

| Area | Observed result | Evidence |
| --- | --- | --- |
| Paid customer | Dashboard opens before card issuance; balance and LPG kilograms agree with the fixture | `paid-overview-dark-mobile.png`, `paid-overview-tablet.png` |
| New-account Stations | First eligible visit shows a location dialog; saved browse-without-location choice prevents a second prompt after reload | `location-first-run-final.png` |
| Nearest stations | Synthetic coordinates sorted stations at 0.0 km then 54.8 km; LPG filter retained the nearest matching station | Browser AX observations; automated network/filter tests in API suite |
| Profile | Light and dark radios save, dark survives reload and account switching, sign-in settings are inside Profile | `profile-dark-mobile-final.png`, `profile-dark-desktop-final.png` |
| Spending alerts | Saved thresholds 50, 80, 100; no-budget state explains why alerts will not fire yet | Profile observations and real PostgreSQL/outbox tests |
| Cashback | Redeemed synthetic NGN100 from NGN120 earned; available cashback became NGN20; wallet gained NGN100 once | `cashback-success-desktop.png`, `browser-financial-invariants.json` |
| Generator repair | Customer requested quote; admin quoted NGN1,000 labour plus NGN500 parts, reserved NGN600 Gold subsidy; customer paid NGN900 into escrow | `repair-request-mobile.png`, `admin-repair-quote-mobile.png`, `repair-confirm-mobile.png` |
| Repair completion | Admin started and completed work; subsidy consumed; NGN1,500 partner liability stays unpaid with no external payout | `admin-repair-completed-mobile.png`, `admin-benefits-desktop.png` |
| Unpaid customer | Only plan purchase/card verification/sign-out shell; direct Profile URL stays locked; My Card still offers plans | `unpaid-overview-desktop.png`, `unpaid-profile-320.png`, `unpaid-plans-320.png` |
| Bronze | Overview omits premium purchase analytics; no new cashback earning; earlier earned rewards would remain redeemable | Browser AX observations and plan API tests |
| Subscription failure | Stopping the disposable API then reloading removes operational content and shows a retry popup | `subscription-error-mobile.png` |

Widths checked: 320, 390, 768 and 1440 CSS pixels. On the measured screens document scroll width equalled viewport width. This is bounded responsive evidence, not an exhaustive device/assistive-technology audit. Final screenshots were visually inspected. A full-page capture timed out once, so viewport captures were used. Earlier development snapshots are retained as historical evidence and are not final screenshots.

Production-build application console errors before the intentional outage: zero in the captured log window. Older development hydration messages and a browser-extension error were excluded explicitly in `production-browser-errors.json`. This does not establish error-free production operation.

After browser actions, direct database assertions proved funded NGN50,000 equals programme available NGN49,280 + cashback available NGN20 + redeemed NGN100 + consumed repair subsidy NGN600. The customer wallet was NGN19,200 and the partner repair payable was NGN1,500, marked unpaid. These are synthetic fixture amounts. Provider settlement semantics remain unverified.

All task-owned Next/API processes were stopped, the successful UI schema dropped by fixture cleanup, and the exact failed fixture schema removed. Temporary viewport override was reset and the temporary browser tab closed.
