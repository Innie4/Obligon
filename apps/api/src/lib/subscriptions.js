import { one } from '../db.js';
import { forbidden } from './errors.js';

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
export async function partnerSubscription(orgId, t = { one }) {
  const sub = await t.one(`SELECT s.*, p.name, p.features, p.price_kobo FROM subscriptions s JOIN pricing_plans p ON p.code=s.plan_code WHERE s.organization_id=$1`, [orgId]);
  return { subscription: sub, active: subscriptionIsActive(sub), entitlements: catalogEntitlements(sub?.features ?? []) };
}
export async function activateCustomerSubscription(t, request) {
  // The first paid period starts at approval; replays of the same request cannot extend it.
  await t.query(`INSERT INTO customer_subscriptions (user_id, plan_code, payment_reference, current_period_start, current_period_end)
    VALUES ($1,$2,$3,now(),now()+interval '1 month') ON CONFLICT(user_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,
    payment_reference=EXCLUDED.payment_reference,status='active',current_period_start=EXCLUDED.current_period_start,
    current_period_end=EXCLUDED.current_period_end,updated_at=now() WHERE customer_subscriptions.payment_reference<>EXCLUDED.payment_reference`,
    [request.user_id, request.plan_code, request.payment_reference]);
}
export async function requireCustomerPlan(userId, feature = null, t = { one }) {
  const state = await customerSubscription(userId, t);
  if (!state.active) throw forbidden('An active paid subscription is required. Renew your plan to continue.');
  if (feature) {
    const entry = state.features.find(f => typeof f === 'object' && String(f.label ?? f.name ?? '').toLowerCase() === feature.toLowerCase());
    if (!entry || entry.included === false || entry.value === '—' || entry.value === false || entry.value === 'Not included' || entry.state === 'unavailable') throw forbidden('Your subscription does not include this feature.');
  }
  return state;
}
export async function enforcePartnerPlan(req, _res, next) {
  try {
    if (/^\/(billing|bank-accounts|settlements|settings|notifications|disputes)(\/|$)/.test(req.path)) return next();
    const state = await partnerSubscription(req.user.orgId);
    if (!state.active) throw forbidden('Choose and pay for a partner subscription before using the dashboard.');
    req.subscription = state;
    if (req.path.startsWith('/reports') && !state.entitlements.advancedReports) throw forbidden('Advanced reports require a plan with advanced analytics.');
    next();
  } catch(err) { next(err); }
}
