-- Wallets become typed and linkable to the account they belong to.
--
-- Previously `wallets.user_id` was UNIQUE, which made a company wallet
-- impossible: a company has several staff users, and the wallet belongs to the
-- organization, not to whichever user happened to create it.
--
-- After this change:
--   kind = 'individual' -> one wallet per user   (customer, partner, mechanic)
--   kind = 'company'    -> one wallet per organization (linked via organization_id)

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'individual'
    CHECK (kind IN ('individual','company')),
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Every existing wallet predates this change and belongs to an individual user.
UPDATE wallets SET kind = 'individual' WHERE organization_id IS NULL;

-- Replace the single-column unique constraint with scoped partial indexes.
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS wallets_individual_per_user_idx
  ON wallets(user_id) WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wallets_company_per_org_idx
  ON wallets(organization_id) WHERE organization_id IS NOT NULL;

-- Backfill: guarantee every existing user already has an individual wallet, so
-- no dashboard can be left without one after deploy.
INSERT INTO wallets (user_id, kind)
SELECT u.id, 'individual'
FROM users u
WHERE u.role IN ('customer','partner','mechanic','admin')
  AND NOT EXISTS (
    SELECT 1 FROM wallets w WHERE w.user_id = u.id AND w.organization_id IS NULL
  )
ON CONFLICT DO NOTHING;

-- A company organization gets its own wallet, linked to the org, owned by the
-- user that created it. Owner may be NULL for orgs created before this ran.
INSERT INTO wallets (user_id, organization_id, kind)
SELECT o.owner_user_id, o.id, 'company'
FROM organizations o
WHERE o.type = 'company'
  AND o.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM wallets w WHERE w.organization_id = o.id
  )
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS wallets_organization_idx ON wallets(organization_id);

-- Card-request checkout and wallet top-ups both need to remember which
-- processor took the money, so verification hits the right API.
ALTER TABLE card_requests
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'paystack';

ALTER TABLE top_ups
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;

-- Top-ups are settled against a company wallet for company accounts.
ALTER TABLE top_ups
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL;
