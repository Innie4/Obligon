# Dashboard release deployment

Apply migrations 020–024 with the repository migrator before serving this release. Back up production first and deploy the API and web together. Migration 019 remains part of fresh installs; 020 resets its unsafe watermarks and quarantines ambiguous historical periods. Historical paid rows with destroyed amounts require reconciliation against processor statements; the application deliberately does not guess them.

Configure Flutterwave checkout, transfer funding, verified webhooks and registered collection subaccounts; Sudo API credentials, debit/credit account IDs and `CARD_IDENTITY_KEY` (32 random bytes as 64 hex characters); production Supabase Auth/storage; and real email/SMS delivery. Rotate the identity key only with an explicit re-encryption migration. Missing issuer configuration fails closed rather than producing fabricated cards.

Migrations suspend legacy settlement subaccounts without an exact bank link. Partners must re-add their bank account and admins verify it before direct checkout is available. Each bank has an immutable destination; changing the default cannot rewrite earlier fuel orders. The automatic transfer scheduler uses verified default bank accounts, while direct fuel checkout requires the bound active collection subaccount.

Run `pnpm config:check`, the production web build, and `pnpm test:api` / `pnpm test:web`. Integration suites additionally use `OBLIGON_TEST_DATABASE_URL` pointing to disposable localhost PostgreSQL. Card issuer integration checks use `TEST_DATABASE_URL` and mocked external APIs. Never aim tests or seed commands at production.

For free local OTP tests select `EMAIL_PROVIDER=local`, `SMS_PROVIDER=local`, and `LOCAL_OUTBOX_PATH` outside public/static directories. Messages expire after ten minutes and the outbox is bounded. Local delivery and explicit payment simulation are rejected in production. Production browser bundles must omit `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`.

Customer first paid subscription starts after admin card approval; renewals use verified payments and one-month periods. Partner operations require an active paid catalog plan, with advanced reports restricted by the catalog. Receipts, support, bank setup and subscription renewal remain available for inactive accounts. All paid customer tiers receive the full approved station discount. At ₦10,000 base and 10%, the checkout charges ₦9,000, records ₦1,000 for Obligon and ₦8,000 partner revenue. Processor fees are separate and require live statement verification.

Direct fuel payments use Flutterwave split settlement and never enter automatic wallet transfer accrual. Wallet purchases atomically debit the fuel wallet and accrue net revenue for completed business months. Transfer timeouts retain reserved funds and reconcile the immutable merchant reference without submitting again. Admin Support & Settlements exposes uncertain transfers, historical accounting exceptions and paid fuel orders that require original-payment refunds. Confirm live processor settlement and refund behavior with an authorized small transaction before accepting production payments.

Physical delivery, biometric authorization and manual payouts remain explicitly coming soon. Existing unrelated admin/fleet mock screens were not converted into a new administration product by this customer/partner release.

## Local release verification

2026-10-10: all 24 migrations applied from an empty disposable PostgreSQL database; seed succeeded. Full API suite: 489 tests, 474 passed, 15 opt-in checks skipped, zero failures. Additional issuer approval/replacement integration check passed with mocked vendor APIs. All three frontend regression files and TypeScript passed. Production Next.js build passed with demo login disabled. Chrome checks covered unpaid/paid partner access, inactive manual payouts, station-specific discount submission/admin approval, admin card queue loading, inactive customer budget tools, and saved admin support replies visible to the customer. No real payment, issuer, SMS or remote database calls were used.

The code review checked authorization boundaries, exact amount/reference/currency verification, replay handling, bank binding, historical accounting preservation and deployment configuration. Code verdict: approve for branch review. Advisory banner: SHIP WITH CAUTION. Live credentials, release environment and production rollback readiness are not assessed; run the shipping workflow before production deployment.

Migration 024 removes the old unique organization destination constraint to preserve immutable bank destinations. Rolling back only application binaries to the previous release can break its old upsert. Keep payment operations paused during coordinated rollout; retain a database snapshot and use a reviewed forward fix or restore plan for rollback.

### Nearby customer stations

Customer Stations accepts a consented device location (updated as it changes) or manual latitude/longitude. The API validates coordinate pairs and ranks all active stations by straight-line distance before returning the nearest 50. Missing customer coordinates produce no guessed distances; stations without usable coordinates follow located stations. The view refreshes every 30 seconds while visible and when focus returns. Search and fuel filters preserve that distance order.

Partner registration retains station address, city and available fuels. Partner Station Profile requires exact latitude/longitude when saving, validates geographic bounds, and saves fuel names as an array. Existing admin approval still activates new stations; pending stations remain unpublished. Migration 025 removes the hardcoded Lagos coordinate defaults and permits unknown locations. Existing coordinates are preserved; entries at the exact former default pair need partner confirmation before distance ranking. Existing stations with missing or unconfirmed coordinates need their partner to complete Location Details.

Regression coverage: nearest-before-limit, new active station visibility, pending station exclusion, changed customer origin, missing location, coordinate validation (including zero), fuel filtering, and cancellation of stale background responses after location changes.
