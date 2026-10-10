-- Preserve existing public/UUID conventions and Supabase role ownership.
-- No legacy unpaid card request is backfilled into an active subscription.
CREATE TABLE IF NOT EXISTS customer_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 plan_code text NOT NULL REFERENCES card_plans(code),
 payment_reference varchar(160) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'active',
 current_period_start timestamptz NOT NULL,
 current_period_end timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE customer_subscriptions IS 'Verified paid customer plan period; fees are separate from fuel wallet funds.';
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS subscription_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference varchar(160) NOT NULL UNIQUE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 organization_id uuid REFERENCES organizations(id) ON DELETE RESTRICT,
 plan_code varchar(80) NOT NULL, amount_kobo bigint NOT NULL CHECK(amount_kobo>0),
 provider varchar(30) NOT NULL, payment_status varchar(20) NOT NULL DEFAULT 'pending',
 provider_transaction_id varchar(160), paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_payments_user_idx ON subscription_payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subscription_payments_org_idx ON subscription_payments(organization_id, created_at DESC);
COMMENT ON TABLE subscription_payments IS 'Idempotent verified subscription charges, including manual renewal.';
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS discount_review_states (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code varchar(20) NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO discount_review_states(code) VALUES ('pending'),('approved'),('rejected'),('superseded') ON CONFLICT(code) DO NOTHING;
CREATE TABLE IF NOT EXISTS station_discount_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
 fuel_type varchar(80) NOT NULL, rate_bp integer NOT NULL CHECK(rate_bp>0 AND rate_bp<5000),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 review_state_id bigint NOT NULL REFERENCES discount_review_states(id),
 requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT, review_reason varchar(1000), reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS station_discount_station_idx ON station_discount_requests(station_id,fuel_type,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS station_discount_review_idx ON station_discount_requests(review_state_id,created_at);
COMMENT ON TABLE station_discount_requests IS 'Immutable discount revision awaiting admin approval; replacement does not publish until approved.';
ALTER TABLE station_discount_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_review_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS base_amount_kobo bigint;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS platform_fee_kobo bigint;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS partner_net_kobo bigint;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_request_id uuid REFERENCES station_discount_requests(id) ON DELETE RESTRICT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS settlement_method varchar(30) NOT NULL DEFAULT 'wallet_transfer';
-- Server connection owns tables. Browser Supabase roles have no direct access.
REVOKE ALL ON customer_subscriptions,subscription_payments,discount_review_states,station_discount_requests FROM anon, authenticated;

-- Revoke pre-release codes before enforcing platform-wide uniqueness.
UPDATE cards SET pos_code=NULL,pos_code_expires_at=NULL WHERE pos_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cards_pos_code_uk ON cards(pos_code) WHERE pos_code IS NOT NULL;

-- Approved business rule: every paid customer plan receives the full station discount.
UPDATE card_plans SET features=(SELECT jsonb_agg(CASE WHEN f->>'label'='Partner Discounts' THEN jsonb_set(f,'{state}','"Full approved station discount"'::jsonb) ELSE f END) FROM jsonb_array_elements(features) f);

UPDATE organizations SET auto_settlement=TRUE WHERE type IN ('partner','mechanic');
UPDATE users SET biometrics_enabled=FALSE WHERE biometrics_enabled=TRUE;

-- The partner catalog must exist without demo seeding. Preserve deployed prices/features.
INSERT INTO pricing_plans(code,name,price_kobo,interval,features,highlighted) VALUES
 ('starter','Starter',2500000,'month','["Up to 5 vehicles","5 fuel cards","Basic reporting","Email support"]',false),
 ('growth','Growth',7500000,'month','["Up to 25 vehicles","Unlimited cards","Advanced analytics","Roadside assistance","Priority support"]',true),
 ('enterprise','Enterprise',15000000,'month','["Unlimited vehicles","Dedicated account manager","Custom credit limits","API access","SLA support"]',false)
 ON CONFLICT(code) DO NOTHING;

UPDATE card_plans SET features=replace(features::text,'Physical Fuel Card','Virtual Fuel Card')::jsonb;
