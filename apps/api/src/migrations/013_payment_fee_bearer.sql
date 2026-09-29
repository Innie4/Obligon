-- 013: record the gateway fee charged to the customer.
--
-- The fee has to be stored, not recomputed at read time, for two reasons:
--
--   1. Verification compares what the processor says it collected against what
--      we asked for. If the fee were derived from a mutable environment variable
--      at verification time, changing PAYMENT_FEE_BASIS_POINTS between checkout
--      and the returning redirect would make a genuine payment look short and
--      reject it. The amount actually demanded is the amount recorded.
--   2. An overpayment is measured against base + fee. Without the fee recorded
--      the difference would be paid back to the customer, refunding money that
--      was legitimately collected.
--
-- `amount_kobo` continues to mean the price of the thing bought. The fee is
-- never credited to a wallet: it is the cost of moving the money, not fuel.
--
-- Rollback: DROP the two fee columns. Nothing else references them; checkout
-- falls back to charging the base amount with no fee.

ALTER TABLE top_ups
  ADD COLUMN IF NOT EXISTS fee_kobo BIGINT NOT NULL DEFAULT 0
    CHECK (fee_kobo >= 0);

ALTER TABLE card_requests
  ADD COLUMN IF NOT EXISTS fee_kobo BIGINT NOT NULL DEFAULT 0
    CHECK (fee_kobo >= 0);

-- The figure the processor must report back: base + fee. Used by verification
-- and by the overpayment comparison.
ALTER TABLE top_ups
  ADD COLUMN IF NOT EXISTS charged_kobo BIGINT;

ALTER TABLE card_requests
  ADD COLUMN IF NOT EXISTS charged_kobo BIGINT;

-- Backfill anything already in flight. A top-up stores its own amount, but a card
-- request takes its price from the plan, so the two need different sources. The
-- resulting charged_kobo is exactly what those checkouts asked the customer for,
-- since the fee did not exist when they were created.
UPDATE top_ups SET charged_kobo = amount_kobo WHERE charged_kobo IS NULL;

UPDATE card_requests r
SET charged_kobo = p.amount_kobo
FROM card_plans p
WHERE p.code = r.plan_code AND r.charged_kobo IS NULL;

-- A request whose plan has since been removed has no price to fall back on.
-- Retiring it as failed is honest: nothing can be collected for it.
UPDATE card_requests SET status = 'cancelled', updated_at = now()
WHERE charged_kobo IS NULL AND status = 'awaiting_payment';

UPDATE card_requests SET charged_kobo = 0 WHERE charged_kobo IS NULL;

ALTER TABLE top_ups
  ALTER COLUMN charged_kobo SET NOT NULL;

ALTER TABLE card_requests
  ALTER COLUMN charged_kobo SET NOT NULL;
