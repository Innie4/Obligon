-- Private identity, financial and migration data is served by the authorized API.
-- Retain the existing Supabase public schema and its anon/authenticated group roles.
-- No row rewrite, backfill, ownership change or future-owner default ACL is required.
-- Live row counts/growth, retention and backend role memberships require operator review.
-- These tables contain identity/MFA credentials, user-linked financial data, bank
-- destinations or operational history. Existing retention is unchanged.
-- The backend must retain table-owner access, or explicit privileges plus BYPASSRLS;
-- service_role grants are preserved. RLS is not forced on owners. Unknown inherited
-- grants, additional hosted policies and dependent grant chains need qualified review.
-- The repository uses its authenticated HTTP API for data; the only Supabase SDK
-- client handles Storage. Unknown external direct Data API clients may stop working
-- and require qualified review before deployment. Public catalog exceptions below
-- match public.routes.js /plans, /jobs and /content; station/tenant operational
-- records are projected by authenticated API routes rather than exposed directly.
-- Bound metadata-lock waits; a failure rolls the entire migration back before HTTP starts.
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  private_table text;
  columns_sql text;
  api_policy record;
BEGIN
  -- Explicit application-owned scope from migrations 001-031 and the runner's
  -- schema_migrations ledger. Do not alter unrelated hosted objects/default ACLs.
  FOREACH private_table IN ARRAY ARRAY[
    'users', 'sessions', 'verification_codes', 'audit_logs', 'security_logs',
    'organizations', 'memberships', 'invites', 'wallets', 'wallet_ledger',
    'top_ups', 'payment_methods', 'cards', 'card_actions', 'vehicles', 'drivers',
    'stations', 'fuel_prices', 'fuel_price_history', 'resupply_orders', 'equipment',
    'fueling_logs', 'transactions', 'maintenance_schedules', 'roadside_requests',
    'bank_accounts', 'settlements', 'payouts', 'disputes', 'notifications',
    'support_tickets', 'ticket_messages', 'subscriptions', 'invoices',
    'partner_applications', 'job_applications', 'leads', 'contact_messages',
    'cookie_consents', 'data_requests', 'analytics_events', 'push_subscriptions',
    'idempotency_keys', 'role_permissions', 'card_requests', 'payment_refunds',
    'plan_wallet_credits', 'settlement_accounts', 'payment_splits',
    'monthly_spend_projections', 'settlement_periods', 'customer_subscriptions',
    'subscription_payments', 'discount_review_states', 'station_discount_requests',
    'fuel_orders', 'email_outbox', 'partner_api_keys', 'schema_migrations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', private_table);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', private_table);
    -- Also remove any independently granted column permissions, including grants
    -- from deployments that never gave these roles table-wide SELECT or UPDATE.
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
      INTO columns_sql
      FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = ('public.' || private_table)::regclass
        AND a.attnum > 0 AND NOT a.attisdropped;
    EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated', columns_sql, private_table);
    -- Retire direct Data API policies on these private tables. Policies solely
    -- for other backend roles are retained; trusted owners/BYPASSRLS are unchanged.
    FOR api_policy IN
      SELECT p.polname FROM pg_catalog.pg_policy p
      WHERE p.polrelid = ('public.' || private_table)::regclass
        AND p.polroles && ARRAY[0::oid, 'anon'::regrole::oid, 'authenticated'::regrole::oid]
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', api_policy.polname, private_table);
    END LOOP;
  END LOOP;
END $$;

-- These UUID-only helpers are no longer needed by any public catalog policy.
-- Keep the functions and their owners; retire unnecessary Data API RPC access.
REVOKE ALL PRIVILEGES ON FUNCTION public.current_obligon_user_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.current_obligon_org_ids() FROM PUBLIC, anon, authenticated;

-- Public catalog data remains read-only, limited to fields published by the API.
-- In particular, pricing_plans.paystack_plan_code is a private processor binding.
DO $$
DECLARE
  catalog_table text;
  columns_sql text;
BEGIN
  FOREACH catalog_table IN ARRAY ARRAY['pricing_plans', 'card_plans', 'job_postings', 'content_items'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', catalog_table);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', catalog_table);
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum) INTO columns_sql
      FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = ('public.' || catalog_table)::regclass AND a.attnum > 0 AND NOT a.attisdropped;
    EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated', columns_sql, catalog_table);
  END LOOP;
END $$;
GRANT SELECT (code, name, price_kobo, interval, features, highlighted, active) ON TABLE public.pricing_plans TO anon, authenticated;
GRANT SELECT (code, name, amount_kobo, interval, features, active, sort_order) ON TABLE public.card_plans TO anon, authenticated;
GRANT SELECT (id, title, department, location, employment_type, description, requirements, status, created_at) ON TABLE public.job_postings TO anon, authenticated;
GRANT SELECT (id, kind, title, body, meta, sort_order, active) ON TABLE public.content_items TO anon, authenticated;
-- The other three catalogs retain their existing active/open SELECT policies.
DROP POLICY IF EXISTS card_plans_public_select ON public.card_plans;
CREATE POLICY card_plans_public_select ON public.card_plans FOR SELECT USING (active = true);

COMMENT ON TABLE public.users IS 'Private account identity and authentication credentials; trusted API access only, UUID-only identity helpers retained';
COMMENT ON TABLE public.payment_refunds IS 'Private user-linked refund evidence and recovery state; trusted API access only';
COMMENT ON TABLE public.plan_wallet_credits IS 'Private wallet credit idempotency evidence; trusted API access only';
COMMENT ON TABLE public.settlement_accounts IS 'Private organization bank destinations and processor bindings; trusted API access only';
COMMENT ON TABLE public.payment_splits IS 'Private processor settlement evidence; trusted API access only';
COMMENT ON TABLE public.monthly_spend_projections IS 'Private user monthly fuel budget expectations; trusted API access only';
COMMENT ON TABLE public.settlement_periods IS 'Private organization accrual watermarks and fees; trusted API access only';
COMMENT ON TABLE public.schema_migrations IS 'Private migration application ledger; trusted migration owner access only';
COMMENT ON TABLE public.cards IS 'Private card ownership, limits and hashed PIN configuration; access only through authorized API routes';
COMMENT ON TABLE public.wallets IS 'Private individual and company wallet balances; access only through authorized API routes';
COMMENT ON TABLE public.wallet_ledger IS 'Private auditable wallet movement records; access only through authorized API routes';
