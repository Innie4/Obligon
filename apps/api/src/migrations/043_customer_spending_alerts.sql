-- Informational budget alerts are opt-in; they do not authorize, reserve, or move money.
-- users already has private-table RLS/ACL protection from migration 032.
ALTER TABLE users ADD COLUMN IF NOT EXISTS spending_alert_preferences JSONB NOT NULL
  DEFAULT '{"enabled":false,"thresholds":[80,100]}'::jsonb
  CHECK (jsonb_typeof(spending_alert_preferences) = 'object');
COMMENT ON COLUMN users.spending_alert_preferences IS
  'Customer opt-in and percentage thresholds for current monthly projected-spend alerts. Not a spending limit.';
