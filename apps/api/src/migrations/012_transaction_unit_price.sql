-- 012: per-transaction unit price, so savings can be measured rather than invented.
--
-- "Lifetime Savings" was computed as `litres * 1500`, a hardcoded 15 naira per
-- litre that bore no relation to what the customer actually paid. MTD Savings
-- did not exist at all: the web client scraped it out of the MTD Spend helper
-- string, which read "This month", so the dashboard showed a sentence fragment
-- where a currency figure should have been.
--
-- Real savings need the price actually paid per litre. The column is nullable
-- and backfilled from amount/litres so existing history becomes useful
-- immediately; rows that cannot be backfilled are left null and excluded from
-- savings rather than being counted at an assumed price.
--
-- Rollback: DROP COLUMN unit_price_kobo. Nothing else depends on it; the
-- dashboard falls back to omitting savings when no priced rows exist.

-- ---------------------------------------------------------------------------
-- Pre-existing defect found while writing this migration.
--
-- Migration 001 attached a `transactions_updated_at` BEFORE UPDATE trigger via
-- touch_updated_at(), but the transactions table was never given an updated_at
-- column. Postgres does not validate NEW.<field> until the trigger fires, so the
-- bug was invisible until the first write: every UPDATE on a transaction raised
-- `record "new" has no field "updated_at"`.
--
-- Confirmed against the live database. Anything that updates a transaction has
-- been failing, including resolving a dispute to "refunded" in the admin route,
-- so a won dispute could never be recorded against its transaction.
--
-- The trigger is clearly intended to work, so the column is added rather than
-- the trigger dropped: dropping it would silently discard audit timestamps.
-- ---------------------------------------------------------------------------
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS unit_price_kobo BIGINT;

-- Backfill where the arithmetic is exact and unambiguous. Rounding to the nearest
-- kobo is correct here because the column stores kobo.
UPDATE transactions
SET unit_price_kobo = ROUND(amount_kobo / NULLIF(litres, 0))::BIGINT
WHERE unit_price_kobo IS NULL
  AND litres IS NOT NULL
  AND litres > 0
  AND amount_kobo > 0;

-- Savings are only meaningful against a known unit price, so exclude the rest
-- rather than letting a zero default read as "paid nothing, saved the full
-- amount" or "paid nothing, saved nothing" arbitrarily.
ALTER TABLE transactions
  ADD CONSTRAINT transactions_unit_price_non_negative
  CHECK (unit_price_kobo IS NULL OR unit_price_kobo >= 0);

-- The dashboard aggregates savings by month and by customer.
CREATE INDEX IF NOT EXISTS transactions_unit_price_idx
  ON transactions(customer_user_id, created_at DESC)
  WHERE unit_price_kobo IS NOT NULL;
