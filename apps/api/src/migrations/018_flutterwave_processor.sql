-- Flutterwave as the payment processor.
--
-- Paystack was the original processor and its shape is still baked into the
-- schema. Three of these defaults actively mislabel rows:
--
--   * `payouts.provider` / `top_ups.provider` / `card_requests.payment_provider`
--     all DEFAULT 'paystack', so a row inserted without naming a processor claims
--     a processor that did not take the money. Anything reading that column to
--     decide which API to call would verify a Flutterwave charge against Paystack.
--   * `organizations.payment_provider` never existed; a partner has no recorded
--     processor at all.
--
-- `bank_accounts.recipient_code` is the Paystack transfer-recipient handle.
-- Flutterwave has no equivalent concept: a transfer takes the beneficiary's bank
-- code and account number inline, or a beneficiary id created separately. Both
-- are recorded alongside it so switching processors does not mean re-collecting
-- bank details from every partner.
--
-- The account number itself is deliberately NOT stored. It is held by the
-- processor, and only the masked form and whatever handle that processor returns
-- are kept here. That is the same posture the column already had.

ALTER TABLE payouts
  ALTER COLUMN provider SET DEFAULT 'flutterwave';

ALTER TABLE top_ups
  ALTER COLUMN provider SET DEFAULT 'flutterwave';

ALTER TABLE card_requests
  ALTER COLUMN payment_provider SET DEFAULT 'flutterwave';

-- Which processor settled this partner. NULL means "the deployment's configured
-- provider", which is the right answer for a single-processor deployment and
-- keeps the column honest when one is added.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS payment_provider TEXT;

-- Provider-side handles for a bank account. `recipient_code` stays for Paystack;
-- `beneficiary_id` is Flutterwave's equivalent.
ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS beneficiary_id TEXT,
  ADD COLUMN IF NOT EXISTS payout_provider TEXT;

-- Which processor a transfer belongs to, so a retry or a reconciliation pass
-- asks the right API. Previously a transfer was assumed to be Paystack's.
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS transfer_provider TEXT;