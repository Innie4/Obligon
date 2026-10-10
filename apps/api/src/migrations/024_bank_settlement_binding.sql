-- A settlement destination is immutable evidence for prior checkout splits.
-- New bank nominations receive separate rows instead of changing an old destination.
ALTER TABLE settlement_accounts ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE RESTRICT;
ALTER TABLE settlement_accounts DROP CONSTRAINT IF EXISTS settlement_accounts_organization_id_key;
UPDATE settlement_accounts SET status='suspended',updated_at=now() WHERE bank_account_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS settlement_accounts_bank_account_uk ON settlement_accounts(bank_account_id) WHERE bank_account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS settlement_accounts_active_org_uk ON settlement_accounts(organization_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS settlement_accounts_org_created_idx ON settlement_accounts(organization_id,created_at DESC);
-- Ambiguous legacy defaults cannot identify an approved payment destination.
WITH changed AS (
 UPDATE bank_accounts SET is_default=FALSE WHERE organization_id IN (SELECT organization_id FROM bank_accounts WHERE is_default GROUP BY organization_id HAVING count(*)>1) RETURNING id,organization_id
)
INSERT INTO audit_logs(actor_role,action,entity_type,entity_id,metadata)
 SELECT 'system','bank.default_review_required','bank_account',id::text,jsonb_build_object('organizationId',organization_id,'previousDefault',TRUE) FROM changed;
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_default_org_uk ON bank_accounts(organization_id) WHERE is_default=TRUE;
COMMENT ON COLUMN settlement_accounts.bank_account_id IS 'Exact nominated bank destination; legacy NULL links are suspended and require re-nomination, never guessed from masked digits';
