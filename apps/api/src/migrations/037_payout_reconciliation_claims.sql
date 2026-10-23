-- Persist attempt order and recover claims after a worker stops during a lookup.
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS reconcile_claim_token UUID;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS reconcile_claim_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS payouts_reconciliation_queue_idx
  ON payouts (last_reconciled_at ASC NULLS FIRST, created_at, id)
  WHERE status = 'processing';
