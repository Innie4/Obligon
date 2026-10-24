-- Itemized generator repair quotes, funded labour assistance and internal service escrow.
-- No provider payout is created or represented as completed by this workflow.
CREATE TABLE IF NOT EXISTS generator_repairs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference varchar(100) NOT NULL UNIQUE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE RESTRICT,
 plan_code text NOT NULL REFERENCES card_plans(code) ON DELETE RESTRICT,
 labour_discount_percent smallint NOT NULL CHECK(labour_discount_percent IN(30,60,100)),
 description text NOT NULL CHECK(char_length(description) BETWEEN 10 AND 4000),
 request_key uuid NOT NULL, status varchar(24) NOT NULL DEFAULT 'requested'
 CHECK(status IN('requested','quoted','awaiting_funding','accepted','in_progress','completed','cancelled')),
 quote_version integer NOT NULL DEFAULT 0 CHECK(quote_version>=0),
 payment_key uuid, paid_at timestamptz, completed_at timestamptz,
 completion_note text, cancellation_reason text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_key), UNIQUE(user_id,payment_key)
);
CREATE TABLE IF NOT EXISTS generator_repair_quotes (
 repair_id uuid NOT NULL REFERENCES generator_repairs(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK(version>0), scope text NOT NULL CHECK(char_length(scope) BETWEEN 10 AND 4000),
 partner_org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 labour_kobo bigint NOT NULL CHECK(labour_kobo>=0), parts_kobo bigint NOT NULL CHECK(parts_kobo>=0),
 subsidy_kobo bigint NOT NULL CHECK(subsidy_kobo>=0 AND subsidy_kobo<=labour_kobo),
 customer_payable_kobo bigint NOT NULL CHECK(customer_payable_kobo>=0),
 total_kobo bigint NOT NULL CHECK(total_kobo>0 AND total_kobo<=100000000000),
 funding_reference varchar(160) NOT NULL UNIQUE, funding_status varchar(12) NOT NULL CHECK(funding_status IN('unfunded','reserved','consumed','released')),
 quote_key uuid NOT NULL, quoted_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 request_hash varchar(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(repair_id,version), UNIQUE(quoted_by,quote_key),
 CHECK(total_kobo=labour_kobo+parts_kobo AND total_kobo=customer_payable_kobo+subsidy_kobo)
);
CREATE TABLE IF NOT EXISTS generator_repair_money (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), repair_id uuid NOT NULL REFERENCES generator_repairs(id) ON DELETE RESTRICT,
 reference varchar(160) NOT NULL UNIQUE, source_account varchar(200) NOT NULL, destination_account varchar(200) NOT NULL,
 amount_kobo bigint NOT NULL CHECK(amount_kobo>0 AND amount_kobo<=100000000000),
 kind varchar(32) NOT NULL CHECK(kind IN('customer_escrow','customer_refund','customer_payable','subsidy_payable')),
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(source_account<>destination_account)
);
CREATE TABLE IF NOT EXISTS generator_repair_payables (
 repair_id uuid PRIMARY KEY REFERENCES generator_repairs(id) ON DELETE RESTRICT,
 partner_org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 customer_kobo bigint NOT NULL CHECK(customer_kobo>=0), subsidy_kobo bigint NOT NULL CHECK(subsidy_kobo>=0),
 amount_kobo bigint NOT NULL CHECK(amount_kobo>0 AND amount_kobo=customer_kobo+subsidy_kobo),
 status varchar(24) NOT NULL DEFAULT 'unpaid' CHECK(status='unpaid'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS generator_repair_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), repair_id uuid NOT NULL REFERENCES generator_repairs(id) ON DELETE RESTRICT,
 actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, actor_role varchar(30) NOT NULL,
 action varchar(40) NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER generator_repair_money_immutable BEFORE UPDATE OR DELETE ON generator_repair_money FOR EACH ROW EXECUTE FUNCTION immutable_benefit_record();
CREATE TRIGGER generator_repair_events_immutable BEFORE UPDATE OR DELETE ON generator_repair_events FOR EACH ROW EXECUTE FUNCTION immutable_benefit_record();
CREATE INDEX IF NOT EXISTS generator_repairs_user_created_idx ON generator_repairs(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS generator_repairs_status_created_idx ON generator_repairs(status,created_at);
CREATE INDEX IF NOT EXISTS generator_repair_events_repair_idx ON generator_repair_events(repair_id,created_at);
COMMENT ON TABLE generator_repair_money IS 'Service-level equal source/destination trace, linked to wallet ledger and benefit budget movements. Not an external payout ledger.';
COMMENT ON TABLE generator_repair_payables IS 'Funded partner service liability. Unpaid means no external payout has been performed.';
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['generator_repairs','generator_repair_quotes','generator_repair_money','generator_repair_payables','generator_repair_events'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC,anon,authenticated',tbl);
 END LOOP;
END $$;
