-- Durable issuing evidence belongs to the trusted API, not the public Data API.
CREATE TABLE company_card_issuances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  request_key_hash CHAR(64) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  label VARCHAR(120) NOT NULL,
  vehicle_id UUID,
  driver_id UUID,
  daily_limit_kobo BIGINT NOT NULL CHECK (daily_limit_kobo > 0),
  monthly_limit_kobo BIGINT NOT NULL CHECK (monthly_limit_kobo >= daily_limit_kobo),
  holder_name VARCHAR(200),
  issuer_customer_id VARCHAR(160),
  provider_card JSONB,
  card_id UUID REFERENCES cards(id),
  state VARCHAR(32) NOT NULL CHECK (state IN ('creating','provider_created','review_required','complete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,actor_user_id,request_key_hash)
);
CREATE UNIQUE INDEX company_card_issuances_one_uncertain_org
  ON company_card_issuances(organization_id) WHERE state <> 'complete';
CREATE UNIQUE INDEX company_card_issuances_card_idx ON company_card_issuances(card_id) WHERE card_id IS NOT NULL;
ALTER TABLE company_card_issuances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON company_card_issuances FROM anon, authenticated;
COMMENT ON TABLE company_card_issuances IS 'Durable company card claims and minimal masked issuer receipts; ambiguous provider effects never resend automatically';
