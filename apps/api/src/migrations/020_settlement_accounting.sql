-- Preserve original period money and separately track disbursements.
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS paid_kobo BIGINT NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS reconciliation_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE settlements ADD CONSTRAINT settlements_paid_kobo_bounds
  CHECK (paid_kobo >= 0 AND paid_kobo <= net_kobo);
UPDATE settlements SET paid_kobo = net_kobo WHERE status = 'paid';

-- Payment timestamps cannot identify the revenue period. Runtime accrual derives
-- the initial watermark from paid period_end in BUSINESS_TIMEZONE. Reset existing
-- watermarks because 019 both failed its backfill and advanced unfinished months.
UPDATE settlement_periods SET last_settled_through = TIMESTAMPTZ '-infinity';

-- Historical duplicate/incorrectly reduced paid rows require reconciliation
-- against processor statements. Do not rewrite evidence or guess paid amounts.
UPDATE settlements pending SET reconciliation_required=TRUE
 WHERE pending.status='pending' AND EXISTS
  (SELECT 1 FROM settlements paid WHERE paid.partner_org_id=pending.partner_org_id
   AND paid.period_end=pending.period_end AND paid.status='paid');
UPDATE settlements SET reconciliation_required=TRUE
 WHERE status='paid' AND net_kobo=0 AND gross_kobo>0;
