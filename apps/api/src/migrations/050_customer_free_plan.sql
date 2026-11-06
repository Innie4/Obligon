-- Every personal customer starts on the Free plan. It is a durable catalogue
-- entry, but not a billable subscription: `customerSubscription()` supplies it
-- when there is no active paid period, so we do not invent a payment reference
-- or expire a customer's basic account.

ALTER TABLE card_plans DROP CONSTRAINT IF EXISTS card_plans_amount_kobo_check;
ALTER TABLE card_plans
  ADD CONSTRAINT card_plans_amount_kobo_check CHECK (amount_kobo >= 0);

INSERT INTO card_plans (code, name, amount_kobo, interval, blurb, features, active, sort_order)
VALUES (
  'free',
  'Free',
  0,
  'forever',
  'A basic fuel wallet and purchase history. Upgrade when you need a fuel card or premium services.',
  '[
    {"label":"Digital Fuel Wallet","state":"included"},
    {"label":"Virtual Fuel Card","state":"unavailable"},
    {"label":"Fuel Purchase","state":"unavailable"},
    {"label":"Digital Receipts","state":"included"},
    {"label":"Transaction History","state":"included"},
    {"label":"Fuel Spend Tracking","state":"included"},
    {"label":"Fuel Budget Management","state":"unavailable"},
    {"label":"Spending Limits","state":"unavailable"},
    {"label":"Fuel Consumption Analytics","state":"unavailable"},
    {"label":"Loyalty Rewards","state":"unavailable"},
    {"label":"Partner Discounts","state":"unavailable"},
    {"label":"Partner Mechanics","state":"unavailable"},
    {"label":"Priority Support","state":"unavailable"},
    {"label":"Generator Repairer","state":"unavailable"},
    {"label":"Access to Car Wash","state":"unavailable"},
    {"label":"VIP Lounge","state":"unavailable"},
    {"label":"Intelligence Notifications","state":"unavailable"},
    {"label":"Towing Services","state":"unavailable"}
  ]'::jsonb,
  TRUE,
  0
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  amount_kobo = EXCLUDED.amount_kobo,
  interval = EXCLUDED.interval,
  blurb = EXCLUDED.blurb,
  features = EXCLUDED.features,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order;

-- The paid catalogue was renamed to "Virtual Fuel Card" in migration 022.
-- Preserve compatibility with databases where it has not been renamed yet.
UPDATE card_plans
SET features = replace(features::text, 'Physical Fuel Card', 'Virtual Fuel Card')::jsonb
WHERE code IN ('bronze', 'gold', 'platinum')
  AND features::text LIKE '%Physical Fuel Card%';
