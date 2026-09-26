-- Individual subscription plans + paid, verified fuel-card requests.
--
-- Flow: customer picks a plan -> checkout + payment -> payment verified ->
-- submits identity details (full name, BVN) -> verification -> card issued.
-- `card_requests` therefore gains payment and verification state alongside its
-- existing review status.

-- ---------------------------------------------------------------- plans
CREATE TABLE IF NOT EXISTS card_plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount_kobo INT NOT NULL CHECK (amount_kobo > 0),
  interval TEXT NOT NULL DEFAULT 'monthly',
  blurb TEXT NOT NULL DEFAULT '',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep these in step with the Individual plans on the landing page.
INSERT INTO card_plans (code, name, amount_kobo, interval, blurb, features, sort_order)
VALUES
  ('bronze', 'Bronze', 250000, 'monthly', 'Everyday fuel card with core wallet and spend controls.', '[
    {"label":"Digital Fuel Wallet","state":"included"},
    {"label":"Physical Fuel Card","state":"included"},
    {"label":"Fuel Purchase","state":"included"},
    {"label":"Digital Receipts","state":"included"},
    {"label":"Transaction History","state":"included"},
    {"label":"Fuel Spend Tracking","state":"included"},
    {"label":"Fuel Budget Management","state":"included"},
    {"label":"Spending Limits","state":"included"},
    {"label":"Partner Discounts","state":"25%"},
    {"label":"Generator Repairer","state":"30%"}
  ]'::jsonb, 1),
  ('gold', 'Gold', 350000, 'monthly', 'Advanced tracking and rewards for higher-mileage drivers.', '[
    {"label":"Digital Fuel Wallet","state":"included"},
    {"label":"Physical Fuel Card","state":"included"},
    {"label":"Fuel Purchase","state":"included"},
    {"label":"Digital Receipts","state":"included"},
    {"label":"Transaction History","state":"included"},
    {"label":"Fuel Spend Tracking","state":"Advanced"},
    {"label":"Fuel Budget Management","state":"included"},
    {"label":"Spending Limits","state":"included"},
    {"label":"Fuel Consumption Analytics","state":"Advanced"},
    {"label":"Loyalty Rewards","state":"Premium"},
    {"label":"Partner Discounts","state":"50%"},
    {"label":"Priority Support","state":"included"},
    {"label":"Generator Repairer","state":"60%"},
    {"label":"Access to Car Wash","state":"included"},
    {"label":"Intelligence Notifications","state":"included"}
  ]'::jsonb, 2),
  ('platinum', 'Platinum', 500000, 'monthly', 'Full network access including mechanics, VIP lounge and towing.', '[
    {"label":"Digital Fuel Wallet","state":"included"},
    {"label":"Physical Fuel Card","state":"included"},
    {"label":"Fuel Purchase","state":"included"},
    {"label":"Digital Receipts","state":"included"},
    {"label":"Transaction History","state":"included"},
    {"label":"Fuel Spend Tracking","state":"Advanced"},
    {"label":"Fuel Budget Management","state":"included"},
    {"label":"Spending Limits","state":"included"},
    {"label":"Fuel Consumption Analytics","state":"Advanced"},
    {"label":"Loyalty Rewards","state":"Premium"},
    {"label":"Partner Discounts","state":"75%"},
    {"label":"Partner Mechanics","state":"included"},
    {"label":"Priority Support","state":"included"},
    {"label":"Generator Repairer","state":"100%"},
    {"label":"Access to Car Wash","state":"included"},
    {"label":"VIP Lounge","state":"included"},
    {"label":"Intelligence Notifications","state":"included"},
    {"label":"Towing Services","state":"included"}
  ]'::jsonb, 3)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  amount_kobo = EXCLUDED.amount_kobo,
  blurb = EXCLUDED.blurb,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order;

-- ------------------------------------------------------- request columns
ALTER TABLE card_requests
  ADD COLUMN IF NOT EXISTS plan_code TEXT REFERENCES card_plans(code) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid','failed','refunded')),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS bvn TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (verification_status IN ('not_started','pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS verification_eta TEXT;

-- Widen the review status to cover payment and verification states.
ALTER TABLE card_requests DROP CONSTRAINT IF EXISTS card_requests_status_check;
ALTER TABLE card_requests ADD CONSTRAINT card_requests_status_check
  CHECK (status IN ('awaiting_payment','pending','pending_verification','approved','rejected','cancelled'));

-- One open request per customer across every pre-approval state, so the paid
-- flow cannot be used to open a second request.
DROP INDEX IF EXISTS card_requests_one_open_per_user_idx;
CREATE UNIQUE INDEX IF NOT EXISTS card_requests_one_open_per_user_idx
  ON card_requests(user_id)
  WHERE status IN ('awaiting_payment','pending','pending_verification','approved');

CREATE UNIQUE INDEX IF NOT EXISTS card_requests_payment_reference_idx
  ON card_requests(payment_reference) WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS card_requests_plan_idx ON card_requests(plan_code);

ALTER TABLE card_plans ENABLE ROW LEVEL SECURITY;

-- Migrations are applied once and recorded, so a bare CREATE POLICY matches the
-- existing style (Postgres has no DROP POLICY IF EXISTS).
CREATE POLICY card_requests_self_update ON card_requests FOR UPDATE
  USING (user_id = public.current_obligon_user_id())
  WITH CHECK (user_id = public.current_obligon_user_id());
