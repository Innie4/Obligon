-- Legacy administrators already had unrestricted access. Preserve that access
-- deliberately once; future administrators require an explicit role and grants.
UPDATE users SET staff_role='super_admin',
  staff_permissions='["companies","intake","discounts","applications","benefits","operations","disputes","reports","staff"]'::jsonb
WHERE role='admin';

ALTER TABLE users ALTER COLUMN staff_role SET DEFAULT 'staff';
ALTER TABLE users ADD CONSTRAINT users_admin_role_allowed CHECK (
  role<>'admin' OR (staff_role IS NOT NULL AND staff_role IN ('super_admin','supervisor','staff'))
);
ALTER TABLE users ADD CONSTRAINT users_admin_pages_allowed CHECK (
  role<>'admin' OR (
    jsonb_typeof(staff_permissions)='array' AND
    staff_permissions <@ '["companies","intake","discounts","applications","benefits","operations","disputes","reports","staff"]'::jsonb AND
    (NOT (staff_permissions ? 'staff') OR staff_role='super_admin')
  )
);
