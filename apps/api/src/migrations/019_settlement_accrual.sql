-- Settlement accrual.
--
-- Nothing in the application ever inserted a `pending` settlement. The only
-- INSERT was in the seed script, and it wrote rows already marked `paid`. The
-- consequence was total: `claimableBalanceKobo()` sums pending settlements, so a
-- partner's claimable balance was permanently zero, `POST /api/partner/payouts`
-- refused every request with "You have no settled balance available to withdraw
-- yet", and `runAutoSettlements` had nothing to pay. The payout guard added
-- earlier was correct and the thing it guards could never be non-zero.
--
-- A settlement is a completed earning period, so it is derived rather than
-- invented: successful transactions at the partner's stations since the last
-- settled period, less the platform's fee.
--
-- `fee_basis_points` lives here rather than being read from the environment at
-- settlement time, so the figure on a settlement row is the figure that was
-- actually deducted. Reading config later would let a rate change rewrite history.

CREATE TABLE IF NOT EXISTS settlement_periods (
  partner_org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_settled_through TIMESTAMPTZ NOT NULL DEFAULT TIMESTAMPTZ '-infinity',
  fee_basis_points INT NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settlement_periods (partner_org_id)
  SELECT id FROM organizations WHERE type IN ('partner', 'mechanic')
  ON CONFLICT (partner_org_id) DO NOTHING;

-- Backfill: each partner's existing `paid` settlements define what has already
-- been disbursed. A partner whose seed history is all `paid` therefore starts with
-- nothing claimable, which is correct — that money has been paid.
INSERT INTO settlement_periods (partner_org_id, last_settled_through)
SELECT DISTINCT ON (partner_org_id)
       partner_org_id, COALESCE(MAX(paid_at) OVER (PARTITION BY partner_org_id), TIMESTAMPTZ '-infinity')
FROM settlements
WHERE status = 'paid'
ORDER BY partner_org_id, paid_at DESC
ON CONFLICT (partner_org_id) DO NOTHING;

-- Lets the accrual scan only transactions since the last settled period.
CREATE INDEX IF NOT EXISTS settlements_org_status_idx ON settlements(partner_org_id, status);

-- One accrual period per partner per month boundary.
--
-- Without this the accrual's `ON CONFLICT DO NOTHING` had nothing to conflict on —
-- `settlements.reference` carries no UNIQUE constraint — so every scheduler pass
-- inserted another row for a period already accrued. Verified: two consecutive
-- `accrueSettlements()` calls produced two identical `STL-202610-...` rows.
--
-- Duplicates are collapsed first, keeping the earliest row of each
-- (partner_org_id, period_end) pair and adding the others' money into it, so no
-- accrued value is lost by making the constraint hold. The index cannot be created
-- while duplicates exist, and the migration is transactional, so this must run
-- first. On a database that never ran the buggy accrual this is a no-op.
--
-- `id::text` is the tiebreaker because Postgres has no `min()`/`max()` for uuid.
CREATE TEMP TABLE _settle_survivors ON COMMIT DROP AS
SELECT DISTINCT ON (partner_org_id, period_end) id, partner_org_id, period_end
  FROM settlements
 WHERE status = 'pending'
 ORDER BY partner_org_id, period_end, created_at, id::text;

UPDATE settlements keep
   SET gross_kobo = keep.gross_kobo + COALESCE(rolled.gross, 0),
       fees_kobo  = keep.fees_kobo  + COALESCE(rolled.fees, 0),
       net_kobo   = keep.net_kobo   + COALESCE(rolled.net, 0)
  FROM _settle_survivors sv
  LEFT JOIN (
    SELECT s.partner_org_id, s.period_end,
           SUM(s.gross_kobo)::bigint AS gross,
           SUM(s.fees_kobo)::bigint  AS fees,
           SUM(s.net_kobo)::bigint   AS net
      FROM settlements s
      JOIN _settle_survivors s2
        ON s2.partner_org_id = s.partner_org_id AND s2.period_end = s.period_end
     WHERE s.status = 'pending' AND s.id <> s2.id
     GROUP BY s.partner_org_id, s.period_end
  ) rolled
    ON rolled.partner_org_id = sv.partner_org_id AND rolled.period_end = sv.period_end
 WHERE keep.id = sv.id;

DELETE FROM settlements
 WHERE status = 'pending'
   AND id NOT IN (SELECT id FROM _settle_survivors);

CREATE UNIQUE INDEX IF NOT EXISTS settlements_org_period_end_uidx
  ON settlements(partner_org_id, period_end)
  WHERE status = 'pending';