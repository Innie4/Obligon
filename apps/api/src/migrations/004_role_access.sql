-- 004: persisted role capabilities used by RBAC and dashboard policy checks
CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL CHECK (role IN ('customer','company','partner','mechanic','admin')),
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);

INSERT INTO role_permissions (role, permission) VALUES
  ('customer', 'customer.dashboard'),
  ('customer', 'customer.wallet'),
  ('customer', 'customer.cards'),
  ('customer', 'customer.support'),
  ('company', 'company.dashboard'),
  ('company', 'company.fleet'),
  ('company', 'company.cards'),
  ('company', 'company.billing'),
  ('company', 'company.team'),
  ('company', 'company.support'),
  ('partner', 'partner.dashboard'),
  ('partner', 'partner.pricing'),
  ('partner', 'partner.settlements'),
  ('partner', 'partner.staff'),
  ('partner', 'partner.disputes'),
  ('mechanic', 'mechanic.dashboard'),
  ('mechanic', 'mechanic.roadside'),
  ('mechanic', 'mechanic.staff'),
  ('mechanic', 'mechanic.disputes'),
  ('admin', 'admin.dashboard'),
  ('admin', 'admin.companies'),
  ('admin', 'admin.applications'),
  ('admin', 'admin.reports'),
  ('admin', 'admin.staff'),
  ('admin', 'admin.disputes')
ON CONFLICT (role, permission) DO NOTHING;

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_authenticated_read ON role_permissions
  FOR SELECT TO authenticated USING (true);
