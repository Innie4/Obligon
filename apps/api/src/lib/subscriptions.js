import { one } from '../db.js';
import { forbidden } from './errors.js';
import { activeTemporaryDashboardAccess } from './temporaryPartnerAccount.js';

export function subscriptionIsActive(sub, now = new Date()) {
  return Boolean(sub && sub.status === 'active' && new Date(sub.current_period_start) <= now && new Date(sub.current_period_end) > now);
}
export function catalogEntitlements(features = []) {
  const text = features.join(' | ');
  const vehicles = text.match(/(?:Up to\s+)?(\d+) vehicles/i);
  const cards = text.match(/(\d+) fuel cards/i);
  return { vehicles: vehicles ? Number(vehicles[1]) : null, cards: cards ? Number(cards[1]) : null,
    advancedReports: /Advanced (analytics|reporting)|Custom credit limits/i.test(text),
    apiAccess: /API access/i.test(text), prioritySupport: /Priority support|Dedicated account manager|SLA support/i.test(text) };
}
export async function customerSubscription(userId, t = { one }) {
  const sub = await t.one(`SELECT s.*, p.name, p.features FROM customer_subscriptions s JOIN card_plans p ON p.code=s.plan_code WHERE s.user_id=$1`, [userId]);
  return { subscription: sub, active: subscriptionIsActive(sub), features: sub?.features ?? [] };
}
export async function companySubscription(orgId, t = { one }, user = null) {
  const sub = await t.one(`SELECT s.*, p.name, p.features, p.price_kobo FROM subscriptions s JOIN pricing_plans p ON p.code=s.plan_code WHERE s.organization_id=$1`, [orgId]);
  const temporaryAccess = Boolean(user && activeTemporaryDashboardAccess(user, orgId) && user.role === 'company');
  const features = temporaryAccess ? ['Unlimited vehicles', 'Unlimited cards', 'Advanced analytics', 'Roadside assistance', 'Priority support'] : sub?.features ?? [];
  return { subscription: sub, active: temporaryAccess || subscriptionIsActive(sub), temporaryAccess,
    expiresAt: temporaryAccess ? user.access_expires_at : null, entitlements: catalogEntitlements(features) };
}
export async function partnerContract(orgId, t = { one }) {
  const org = await t.one("SELECT verification_status FROM organizations WHERE id=$1 AND type IN ('partner','mechanic')", [orgId]);
  const active = org?.verification_status === 'verified';
  return { active, contractStatus: org?.verification_status ?? 'pending', renewalMode: 'contract',
    entitlements: { advancedReports: active, apiAccess: active, prioritySupport: active } };
}
export async function requireCompanyPlan(orgId, t = { one }, user = null) {
  const state = await companySubscription(orgId, t, user);
  if (!state.active) throw forbidden('An active Organization subscription is required. Choose or renew your plan in Billing.');
  return state;
}
export async function activateCustomerSubscription(t, request) {
  // Claim once from persisted payment proof. Later card approval cannot restart a period.
  const paid = await t.one(`UPDATE card_requests SET subscription_activated_at=now()
    WHERE id=$1 AND payment_status='paid' AND paid_at IS NOT NULL AND subscription_activated_at IS NULL
      AND plan_code IS NOT NULL AND payment_reference IS NOT NULL
      AND status NOT IN('withdrawn','cancelled','rejected') AND issuance_state NOT IN('refund_pending','refunded')
    RETURNING user_id,plan_code,payment_reference,paid_at,subscription_activated_at`, [request.id]);
  if (!paid) return;
  await t.query(`INSERT INTO customer_subscriptions (user_id, plan_code, payment_reference, current_period_start, current_period_end)
    VALUES ($1,$2,$3,$4,$4::timestamptz+interval '1 month') ON CONFLICT(user_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,
    payment_reference=EXCLUDED.payment_reference,status='active',current_period_start=EXCLUDED.current_period_start,
    current_period_end=EXCLUDED.current_period_end,updated_at=now() WHERE customer_subscriptions.payment_reference<>EXCLUDED.payment_reference
      AND customer_subscriptions.current_period_start<=$5::timestamptz`,
    [paid.user_id, paid.plan_code, paid.payment_reference, paid.subscription_activated_at, paid.paid_at]);
}
export async function revokeCustomerSubscription(t, request) {
  await t.query(`UPDATE customer_subscriptions SET status='canceled',updated_at=now()
    WHERE user_id=$1 AND payment_reference=$2 AND status<>'canceled'`, [request.user_id, request.payment_reference]);
}
export async function requireCustomerPlan(userId, feature = null, t = { one }) {
  const state = await customerSubscription(userId, t);
  if (!state.active) throw forbidden('An active paid subscription is required. Renew your plan to continue.');
  if (feature && !customerFeatureIncluded(state.features, feature)) throw forbidden('Your subscription does not include this feature.');
  return state;
}

export function customerFeatureIncluded(features, label) {
  if (!Array.isArray(features)) return false;
  const entry = features.find(f => f && typeof f === 'object' && String(f.label ?? f.name ?? '').toLowerCase() === label.toLowerCase());
  if (!entry || [entry.state, entry.value, entry.included].some(value => value === false || (typeof value === 'string' && ['unavailable', 'not included', 'false', '—', '-'].includes(value.trim().toLowerCase())))) return false;
  const value = entry.state ?? entry.value ?? entry.included;
  return value === true || (typeof value === 'string' && value.trim() !== '' && !['unavailable', 'not included', 'false', '—', '-'].includes(value.trim().toLowerCase()));
}

export async function enforceCustomerPlan(req, _res, next) {
  try {
    const path = req.path.replace(/\/+$/, '') || '/';
    const onboarding = (req.method === 'GET' && ['/card', '/card-plans'].includes(path)) ||
      /^\/card-request(?:\/|$)/.test(path) || /^\/subscription(?:\/|$)/.test(path);
    // Existing owned payment intents must still reconcile after a period expires.
    const recovery = req.method === 'POST' && ['/wallet/topup/confirm', '/fuel-checkout/confirm'].includes(path);
    if (onboarding || recovery) return next();
    let feature = null;
    if (/^\/wallet(?:\/|$)|^\/payment-methods(?:\/|$)/.test(path)) feature = 'Digital Fuel Wallet';
    else if (/^\/transactions\/[^/]+\/receipt$/.test(path)) feature = 'Digital Receipts';
    else if (/^\/transactions(?:\/|$)/.test(path)) feature = 'Transaction History';
    else if (path === '/overview') feature = 'Fuel Spend Tracking';
    else if (path === '/spend-projection') feature = 'Fuel Budget Management';
    else if (/^\/fuel-checkout(?:\/|$)/.test(path) || /\/pos-code$/.test(path)) feature = 'Fuel Purchase';
    else if (/^\/cards\/[^/]+\/limits$/.test(path)) feature = 'Spending Limits';
    req.subscription = await requireCustomerPlan(req.user.id, feature);
    next();
  } catch (error) { next(error); }
}
export async function enforcePartnerContract(req, _res, next) {
  try {
    const state = await partnerContract(req.user.orgId);
    req.contract = state;
    const onboarding = /^\/(billing|settings|notifications|staff|workshop)(\/|$)/.test(req.path) ||
      ['/station','/stations','/station/assets'].includes(req.path);
    if (!state.active && !onboarding) throw forbidden('Partner operations require admin contract approval. Contact Support after agreeing your contract.');
    next();
  } catch (error) { next(error); }
}
export async function enforceCompanyPlan(req, _res, next) {
  try {
    const onboarding = req.method === 'GET' && req.path === '/billing' ||
      /^\/(subscription|billing|invoices|support|notifications|settings)(\/|$)/.test(req.path) ||
      req.method === 'POST' && req.path === '/wallet/topup/confirm';
    if (onboarding) return next();
    req.subscription = await requireCompanyPlan(req.user.orgId, { one }, req.user);
    if (req.path.startsWith('/reports/export') && !req.subscription.entitlements.advancedReports) throw forbidden('Advanced reports require an Organization plan with advanced analytics.');
    next();
  } catch (error) { next(error); }
}
