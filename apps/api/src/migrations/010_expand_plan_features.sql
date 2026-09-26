-- Expand every plan's feature list to the full, identically ordered catalogue.
--
-- `card_plans.features` previously stored only the benefits a plan *had*, so the
-- three plans returned 10, 15 and 18 rows. A side-by-side comparison therefore
-- could not be scanned across, and a plan's "not included" items were absent
-- rather than shown as unavailable.
--
-- Each plan now carries all 18 features in the same order, with an explicit
-- state so the UI never has to infer a missing benefit:
--   "included"   - available
--   "unavailable"- explicitly not part of the plan
--   anything else- a tier or percentage that must stay visible verbatim
--   ("Advanced", "Premium", "25%", "30%", "50%", "60%", "75%", "100%")

UPDATE card_plans SET features = '[
  {"label":"Digital Fuel Wallet","state":"included"},
  {"label":"Physical Fuel Card","state":"included"},
  {"label":"Fuel Purchase","state":"included"},
  {"label":"Digital Receipts","state":"included"},
  {"label":"Transaction History","state":"included"},
  {"label":"Fuel Spend Tracking","state":"included"},
  {"label":"Fuel Budget Management","state":"included"},
  {"label":"Spending Limits","state":"included"},
  {"label":"Fuel Consumption Analytics","state":"unavailable"},
  {"label":"Loyalty Rewards","state":"unavailable"},
  {"label":"Partner Discounts","state":"25%"},
  {"label":"Partner Mechanics","state":"unavailable"},
  {"label":"Priority Support","state":"unavailable"},
  {"label":"Generator Repairer","state":"30%"},
  {"label":"Access to Car Wash","state":"unavailable"},
  {"label":"VIP Lounge","state":"unavailable"},
  {"label":"Intelligence Notifications","state":"unavailable"},
  {"label":"Towing Services","state":"unavailable"}
]'::jsonb WHERE code = 'bronze';

UPDATE card_plans SET features = '[
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
  {"label":"Partner Mechanics","state":"unavailable"},
  {"label":"Priority Support","state":"included"},
  {"label":"Generator Repairer","state":"60%"},
  {"label":"Access to Car Wash","state":"included"},
  {"label":"VIP Lounge","state":"unavailable"},
  {"label":"Intelligence Notifications","state":"included"},
  {"label":"Towing Services","state":"unavailable"}
]'::jsonb WHERE code = 'gold';

UPDATE card_plans SET features = '[
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
]'::jsonb WHERE code = 'platinum';
