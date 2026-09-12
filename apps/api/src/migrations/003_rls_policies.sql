-- 003: Supabase Row Level Security
-- The API uses the server-side database role for privileged writes. These
-- policies protect direct Supabase client access and derive identity only from
-- the authenticated Supabase Auth subject.

CREATE OR REPLACE FUNCTION public.current_obligon_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE supabase_auth_uid = auth.uid()::text LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_obligon_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = public.current_obligon_user_id()
  UNION
  SELECT m.organization_id FROM public.memberships m
  WHERE m.user_id = public.current_obligon_user_id() AND m.status = 'active';
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.top_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resupply_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fueling_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadside_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self_select ON public.users FOR SELECT
  USING (id = public.current_obligon_user_id());
CREATE POLICY organizations_member_select ON public.organizations FOR SELECT
  USING (id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY memberships_self_select ON public.memberships FOR SELECT
  USING (user_id = public.current_obligon_user_id() OR organization_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY invites_member_select ON public.invites FOR SELECT
  USING (organization_id IN (SELECT public.current_obligon_org_ids()));

CREATE POLICY wallets_self_select ON public.wallets FOR SELECT
  USING (user_id = public.current_obligon_user_id());
CREATE POLICY wallet_ledger_self_select ON public.wallet_ledger FOR SELECT
  USING (wallet_id IN (SELECT id FROM public.wallets WHERE user_id = public.current_obligon_user_id()));
CREATE POLICY top_ups_self_select ON public.top_ups FOR SELECT
  USING (user_id = public.current_obligon_user_id());
CREATE POLICY payment_methods_self_all ON public.payment_methods FOR ALL
  USING (user_id = public.current_obligon_user_id())
  WITH CHECK (user_id = public.current_obligon_user_id());

CREATE POLICY cards_owner_or_org_select ON public.cards FOR SELECT
  USING (owner_user_id = public.current_obligon_user_id() OR organization_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY card_actions_owner_or_org_select ON public.card_actions FOR SELECT
  USING (user_id = public.current_obligon_user_id() OR card_id IN (
    SELECT c.id FROM public.cards c
    WHERE c.owner_user_id = public.current_obligon_user_id() OR c.organization_id IN (SELECT public.current_obligon_org_ids())
  ));

CREATE POLICY vehicles_owner_or_org_select ON public.vehicles FOR SELECT
  USING (owner_user_id = public.current_obligon_user_id() OR organization_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY drivers_org_select ON public.drivers FOR SELECT
  USING (organization_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY maintenance_org_select ON public.maintenance_schedules FOR SELECT
  USING (organization_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY roadside_owner_or_org_select ON public.roadside_requests FOR SELECT
  USING (user_id = public.current_obligon_user_id() OR organization_id IN (SELECT public.current_obligon_org_ids()));

CREATE POLICY stations_public_select ON public.stations FOR SELECT
  USING (status = 'active' OR partner_org_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY fuel_prices_public_select ON public.fuel_prices FOR SELECT
  USING (station_id IN (SELECT id FROM public.stations WHERE status = 'active' OR partner_org_id IN (SELECT public.current_obligon_org_ids())));
CREATE POLICY station_assets_org_select ON public.equipment FOR SELECT
  USING (station_id IN (SELECT id FROM public.stations WHERE partner_org_id IN (SELECT public.current_obligon_org_ids())));
CREATE POLICY fuel_history_org_select ON public.fuel_price_history FOR SELECT
  USING (station_id IN (SELECT id FROM public.stations WHERE partner_org_id IN (SELECT public.current_obligon_org_ids())));
CREATE POLICY resupply_org_select ON public.resupply_orders FOR SELECT
  USING (station_id IN (SELECT id FROM public.stations WHERE partner_org_id IN (SELECT public.current_obligon_org_ids())));
CREATE POLICY fueling_logs_org_select ON public.fueling_logs FOR SELECT
  USING (station_id IN (SELECT id FROM public.stations WHERE partner_org_id IN (SELECT public.current_obligon_org_ids())));

CREATE POLICY transactions_owner_or_org_select ON public.transactions FOR SELECT
  USING (customer_user_id = public.current_obligon_user_id() OR organization_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY bank_accounts_org_all ON public.bank_accounts FOR ALL
  USING (organization_id IN (SELECT public.current_obligon_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY settlements_org_select ON public.settlements FOR SELECT
  USING (partner_org_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY payouts_org_select ON public.payouts FOR SELECT
  USING (partner_org_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY disputes_owner_or_org_select ON public.disputes FOR SELECT
  USING (raised_by_user_id = public.current_obligon_user_id() OR organization_id IN (SELECT public.current_obligon_org_ids()) OR station_org_id IN (SELECT public.current_obligon_org_ids()));

CREATE POLICY notifications_self_or_org_select ON public.notifications FOR SELECT
  USING (user_id = public.current_obligon_user_id() OR organization_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY notifications_self_update ON public.notifications FOR UPDATE
  USING (user_id = public.current_obligon_user_id())
  WITH CHECK (user_id = public.current_obligon_user_id());
CREATE POLICY support_tickets_self_or_org_select ON public.support_tickets FOR SELECT
  USING (user_id = public.current_obligon_user_id() OR organization_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY ticket_messages_ticket_select ON public.ticket_messages FOR SELECT
  USING (ticket_id IN (SELECT t.id FROM public.support_tickets t WHERE t.user_id = public.current_obligon_user_id() OR t.organization_id IN (SELECT public.current_obligon_org_ids())));

CREATE POLICY subscriptions_org_select ON public.subscriptions FOR SELECT
  USING (organization_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY invoices_org_select ON public.invoices FOR SELECT
  USING (organization_id IN (SELECT public.current_obligon_org_ids()));
CREATE POLICY partner_applications_self_select ON public.partner_applications FOR SELECT
  USING (user_id = public.current_obligon_user_id());
CREATE POLICY push_subscriptions_self_all ON public.push_subscriptions FOR ALL
  USING (user_id = public.current_obligon_user_id())
  WITH CHECK (user_id = public.current_obligon_user_id());
CREATE POLICY analytics_events_self_insert ON public.analytics_events FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = public.current_obligon_user_id());

CREATE POLICY pricing_plans_public_select ON public.pricing_plans FOR SELECT USING (active = true);
CREATE POLICY job_postings_public_select ON public.job_postings FOR SELECT USING (status = 'open');
CREATE POLICY content_items_public_select ON public.content_items FOR SELECT USING (active = true);
CREATE POLICY leads_public_insert ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY contact_messages_public_insert ON public.contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY cookie_consents_public_insert ON public.cookie_consents FOR INSERT WITH CHECK (user_id IS NULL OR user_id = public.current_obligon_user_id());
CREATE POLICY data_requests_public_insert ON public.data_requests FOR INSERT WITH CHECK (true);
CREATE POLICY job_applications_public_insert ON public.job_applications FOR INSERT WITH CHECK (true);

REVOKE ALL ON FUNCTION public.current_obligon_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_obligon_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_obligon_user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_obligon_org_ids() TO anon, authenticated;
