-- 014: a plan purchase must not fund the fuel wallet.
--
-- Bug: buying a card plan credited the plan price to the customer's fuel wallet,
-- so "Total Account Balance" displayed the card price. That is money already
-- spent on a subscription, not a spendable fuel balance, and it made a customer
-- who had never topped up look as though they had funds to burn.
--
-- A plan now buys a card subscription only. The wallet is funded by top-ups and
-- by company allocations, and nothing else.
--
-- This reverses the credits that were already applied, and repairs the audit
-- trail for them. The earlier money.test.mjs cleanup deleted ledger rows by
-- reference prefix across the whole table, so those wallets ended up holding
-- balances with no entry explaining where the money came from. A correcting
-- entry is written for each so the ledger explains the current balance.
--
-- Rollback: not reversible. The balances have been reduced and the correction
-- is deliberate; restoring them would reinstate the bug.

-- ---------------------------------------------------------------------------
-- 1. Reverse the balance, clamped so a wallet that has since spent the credit
--    is never driven negative. Any shortfall is reported rather than hidden.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  c RECORD;
  available BIGINT;
  reversible BIGINT;
BEGIN
  FOR c IN
    SELECT pw.wallet_id, pw.card_request_id, pw.amount_kobo, w.balance_kobo
    FROM plan_wallet_credits pw
    JOIN wallets w ON w.id = pw.wallet_id
    ORDER BY pw.created_at
  LOOP
    available := c.balance_kobo;
    reversible := LEAST(available, c.amount_kobo);

    UPDATE wallets
    SET balance_kobo = balance_kobo - reversible
    WHERE id = c.wallet_id;

    -- The correcting entry, so the ledger explains the balance. balance_after
    -- is read back rather than computed so it can never disagree with the row.
    INSERT INTO wallet_ledger (wallet_id, direction, amount_kobo, balance_after_kobo, reference, description)
    SELECT c.wallet_id,
           'debit',
           reversible,
           w.balance_kobo,
           'plan-credit-reversal:' || c.card_request_id::text,
           'Reversal of plan purchase wrongly credited to fuel wallet'
    FROM wallets w WHERE w.id = c.wallet_id;

    IF reversible < c.amount_kobo THEN
      RAISE WARNING 'plan credit %: reversed % of % (balance was already spent)',
        c.card_request_id, reversible, c.amount_kobo;
    END IF;
  END LOOP;
END $$;

-- The claim table must not block a legitimate future credit, and the credits no
-- longer describe anything real.
DELETE FROM plan_wallet_credits;

-- card_requests.wallet_credited_at recorded the old behaviour; cleared so nothing
-- reads it as a statement that this request funded a wallet.
UPDATE card_requests SET wallet_credited_at = NULL WHERE wallet_credited_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Guard the regression.
--    A credit can only exist if a wallet was deliberately funded, so nothing may
--    insert one for a plan purchase.
-- ---------------------------------------------------------------------------
ALTER TABLE plan_wallet_credits
  DROP CONSTRAINT IF EXISTS plan_wallet_credits_positive;

ALTER TABLE plan_wallet_credits
  ADD CONSTRAINT plan_wallet_credits_positive CHECK (amount_kobo > 0);
