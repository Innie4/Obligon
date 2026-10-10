CREATE TABLE fuel_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reference varchar(160) NOT NULL UNIQUE,
 idempotency_key uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 station_id uuid NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
 card_id uuid REFERENCES cards(id) ON DELETE RESTRICT,
 settlement_account_id uuid NOT NULL REFERENCES settlement_accounts(id) ON DELETE RESTRICT,
 discount_request_id uuid REFERENCES station_discount_requests(id) ON DELETE RESTRICT,
 fuel_type varchar(80) NOT NULL,
 litres numeric(10,2) NOT NULL CHECK(litres>0),
 unit_price_kobo bigint NOT NULL CHECK(unit_price_kobo>0),
 base_amount_kobo bigint NOT NULL CHECK(base_amount_kobo>0),
 amount_kobo bigint NOT NULL CHECK(amount_kobo>0),
 platform_fee_kobo bigint NOT NULL CHECK(platform_fee_kobo>=0),
 partner_net_kobo bigint NOT NULL CHECK(partner_net_kobo>=0),
 provider varchar(30) NOT NULL DEFAULT 'flutterwave',
 provider_transaction_id varchar(160),
 checkout_url varchar(2048),
 checkout_simulated boolean NOT NULL DEFAULT false,
 status varchar(30) NOT NULL DEFAULT 'awaiting_payment'
   CHECK(status IN('awaiting_payment','paid','paid_review','fulfilled','refund_pending','refunded')),
 review_reason varchar(500),
 authorization_code varchar(6),
 transaction_id uuid REFERENCES transactions(id) ON DELETE RESTRICT,
 reservation_expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 paid_at timestamptz, fulfilled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,idempotency_key),
 CHECK(amount_kobo=partner_net_kobo+platform_fee_kobo)
);
CREATE UNIQUE INDEX fuel_orders_active_code_uidx ON fuel_orders(authorization_code) WHERE status='paid';
CREATE UNIQUE INDEX fuel_orders_provider_charge_uidx ON fuel_orders(provider,provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX fuel_orders_user_created_idx ON fuel_orders(user_id,created_at DESC);
CREATE INDEX fuel_orders_card_reservation_idx ON fuel_orders(card_id,reservation_expires_at) WHERE status='awaiting_payment';
COMMENT ON TABLE fuel_orders IS 'Station-specific direct payment with immutable price and split; paid fuel authorization stays recoverable until fulfilled.';
ALTER TABLE fuel_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fuel_orders FROM anon,authenticated;
