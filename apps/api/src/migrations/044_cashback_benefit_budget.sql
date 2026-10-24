ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cashback_rate_bp INTEGER NOT NULL DEFAULT 0 CHECK(cashback_rate_bp IN(0,500)),
 ADD COLUMN IF NOT EXISTS cashback_plan_code TEXT;
ALTER TABLE fuel_orders ADD COLUMN IF NOT EXISTS cashback_rate_bp INTEGER NOT NULL DEFAULT 0 CHECK(cashback_rate_bp IN(0,500)),
 ADD COLUMN IF NOT EXISTS cashback_plan_code TEXT;
COMMENT ON COLUMN transactions.cashback_rate_bp IS 'Paid plan entitlement snapshotted at purchase; legacy transactions remain ineligible.';

CREATE TABLE benefit_budget(
 programme VARCHAR(20) PRIMARY KEY CHECK(programme='obligon'),
 available_kobo BIGINT NOT NULL DEFAULT 0 CHECK(available_kobo BETWEEN 0 AND 9007199254740991),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO benefit_budget(programme) VALUES('obligon');
CREATE TABLE benefit_funding(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),reference VARCHAR(160) NOT NULL UNIQUE,
 admin_user_id UUID NOT NULL REFERENCES users(id),idempotency_key UUID NOT NULL,
 amount_kobo BIGINT NOT NULL CHECK(amount_kobo>0 AND amount_kobo%100=0),provider VARCHAR(20) NOT NULL DEFAULT 'flutterwave' CHECK(provider='flutterwave'),
 status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK(status IN('pending','paid','review_required')),
 checkout_state VARCHAR(24) NOT NULL DEFAULT 'creating' CHECK(checkout_state IN('creating','ready','review_required')),
 checkout_url TEXT,provider_transaction_id VARCHAR(160),verified_net_kobo BIGINT CHECK(verified_net_kobo>0),
 review_reason VARCHAR(300),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(admin_user_id,idempotency_key),UNIQUE(provider,provider_transaction_id)
);
CREATE TABLE cashback_balances(
 user_id UUID PRIMARY KEY REFERENCES users(id),available_kobo BIGINT NOT NULL DEFAULT 0 CHECK(available_kobo BETWEEN 0 AND 9007199254740991),
 recovery_kobo BIGINT NOT NULL DEFAULT 0 CHECK(recovery_kobo BETWEEN 0 AND 9007199254740991),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE cashback_awards(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id),user_id UUID NOT NULL REFERENCES users(id),
 plan_code VARCHAR(30) NOT NULL,rate_bp INTEGER NOT NULL CHECK(rate_bp=500),eligible_spend_kobo BIGINT NOT NULL CHECK(eligible_spend_kobo>0),
 earned_kobo BIGINT NOT NULL CHECK(earned_kobo>0),funded_kobo BIGINT NOT NULL DEFAULT 0 CHECK(funded_kobo>=0),
 recovery_offset_kobo BIGINT NOT NULL DEFAULT 0 CHECK(recovery_offset_kobo>=0),reversed_kobo BIGINT NOT NULL DEFAULT 0 CHECK(reversed_kobo>=0 AND reversed_kobo<=earned_kobo),
 status VARCHAR(24) NOT NULL DEFAULT 'pending_funding' CHECK(status IN('pending_funding','funded','reversed')),
 last_checked_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cashback_awards_user_idx ON cashback_awards(user_id,created_at DESC);
CREATE TABLE cashback_redemptions(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id),idempotency_key UUID NOT NULL,
 amount_kobo BIGINT NOT NULL CHECK(amount_kobo>0),wallet_id UUID NOT NULL REFERENCES wallets(id),reference VARCHAR(160) NOT NULL UNIQUE,
 status VARCHAR(16) NOT NULL DEFAULT 'completed' CHECK(status IN('completed','declined')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(user_id,idempotency_key)
);
CREATE TABLE benefit_budget_reservations(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),reference VARCHAR(160) NOT NULL UNIQUE,kind VARCHAR(20) NOT NULL CHECK(kind='repair'),
 user_id UUID NOT NULL REFERENCES users(id),amount_kobo BIGINT NOT NULL CHECK(amount_kobo>0),
 status VARCHAR(20) NOT NULL DEFAULT 'reserved' CHECK(status IN('reserved','consumed','released')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE benefit_movements(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),event_key VARCHAR(200) NOT NULL UNIQUE,from_account VARCHAR(200) NOT NULL,to_account VARCHAR(200) NOT NULL,
 amount_kobo BIGINT NOT NULL CHECK(amount_kobo>0),reason VARCHAR(300) NOT NULL,actor_user_id UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),CHECK(from_account<>to_account)
);
COMMENT ON TABLE benefit_movements IS 'Immutable balanced internal benefit transfers. Each row posts the same positive minor-unit amount from one named account to another. Recovery accounts are noncash receivables and never fund available budget.';
CREATE FUNCTION immutable_benefit_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Benefit money records are immutable; use compensating transfers'; END $$;
CREATE TRIGGER benefit_movements_immutable BEFORE UPDATE OR DELETE ON benefit_movements FOR EACH ROW EXECUTE FUNCTION immutable_benefit_record();
CREATE TRIGGER cashback_redemptions_immutable BEFORE UPDATE OR DELETE ON cashback_redemptions FOR EACH ROW EXECUTE FUNCTION immutable_benefit_record();
ALTER TABLE benefit_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_funding ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_budget_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON benefit_budget,benefit_funding,cashback_balances,cashback_awards,cashback_redemptions,benefit_budget_reservations,benefit_movements FROM PUBLIC,anon,authenticated;
