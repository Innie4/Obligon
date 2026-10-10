# Customer and partner dashboard release

## Approved scope
Fix card approval and issuance, enforce paid plan periods and published entitlements on server and UI, require partner subscription before dashboard operations, station-specific pricing and scheduled admin-approved discount revisions, disable manual payouts, preserve immutable settlement accounting, local OTP testing, truthful support/card/biometric UI, bounded authentication requests, safe card replacement, and production configuration.

## Business rules
Partner plans use existing pricing_plans prices/features. Customer plans use card_plans. Subscription fees never become fuel balance. Access expires at paid period end; renewal requires verified payment, with no claim of automatic recurring debit. Customers retain account, payment, support and refund access when expired. Partners retain billing, bank setup, support and settings access while unpaid. Administrators approve customer identity/card requests and every station discount revision before publication. Date ranges are half-open instants (start inclusive, end exclusive); expired or pending discounts do not apply. Existing approved discount remains effective while adjustment awaits review.

Flutterwave direct settlement sends partner fuel revenue to the registered subaccount, deducting Obligon's approved share. Station-specific checkout uses direct splits; existing prepaid wallet sales use automatic net bank transfers. At 10% discount on ₦10,000 base price: customer pays ₦9,000, partner receives ₦8,000, and Obligon receives ₦1,000. All paid customer plans receive the full approved station discount, overriding older tier percentages. Discounts must remain below 50% to preserve positive partner revenue. Manual payout creation/retry is disabled; bank setup and movement history remain available. No production .env values or real external money will be used for automated testing.

## Acceptance
- Unauthorized/expired/over-limit requests fail server-side, including direct API bypass.
- Failed/replayed/concurrent payment events never extend a subscription or debit a wallet twice.
- Admin approval/rejection is audited and visible; issuing failures are recoverable without fabricated cards or duplicate issuance.
- POS code is single-use, exact station price is used, wallet debit/limits/transaction/fuel log commit atomically.
- Settlements use completed business-timezone periods, preserve gross/fee history and unpaid remainder, and share process-independent locks.
- Local email/SMS outbox is explicitly selected, restricted to nonproduction, bounded and expiring; production cannot silently simulate delivery.
- Fake agent replies and biometric security claims are removed; real persisted ticket messages are shown.
- Frontend typecheck/build, API regression/integration tests, isolated migrations, and browser flows must be checked before push.

## Deployment limits
Real issuing, identity review, processor split settlement and production delivery require valid vendor credentials/configuration and production smoke verification. A successful local build cannot establish those external capabilities. Database migrations must be deployed separately; no implicit changes to the supplied remote database.
