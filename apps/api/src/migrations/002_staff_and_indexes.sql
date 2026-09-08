-- 002: internal staff permission persistence + analytics/log indexes
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON analytics_events(name, created_at DESC);
CREATE INDEX IF NOT EXISTS security_logs_severity_idx ON security_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS payouts_org_status_idx ON payouts(partner_org_id, status);
CREATE INDEX IF NOT EXISTS settlements_org_status_idx ON settlements(partner_org_id, status);
CREATE INDEX IF NOT EXISTS invoices_org_idx ON invoices(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS roadside_status_idx ON roadside_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS topups_status_idx ON top_ups(status, created_at DESC);
