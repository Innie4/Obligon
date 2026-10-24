import { one, tx } from '../db.js';
import { badRequest, notFound, serviceUnavailable } from './errors.js';
import { customerFeatureIncluded, customerSubscription } from './subscriptions.js';
import { businessTimeZone } from './time.js';
import { queueEmail } from './email-outbox.js';
import { emitToUser } from './sse.js';
import { env } from '../config/env.js';

const units = ['litre', 'kg', 'scm'];
const defaultAlerts = { enabled: false, thresholds: [80, 100] };
const currentMonthSql = "date_trunc('month',now())::date";

export function analyticsRange(value = '30') {
  if (!['string', 'number'].includes(typeof value) || !['7', '30', '90', '365'].includes(String(value))) {
    throw badRequest('Choose a 7, 30, 90, or 365 day purchase history.');
  }
  return Number(value);
}

function exactUnsigned(value, label) {
  if (!/^\d+$/.test(String(value))) throw serviceUnavailable(`${label} needs review before this report can be shown.`);
  return BigInt(value);
}

function exactQuantity(value) {
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw serviceUnavailable('A recorded purchase quantity needs review.');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

function decimalQuantity(hundredths) {
  const fraction = String(hundredths % 100n).padStart(2, '0').replace(/0+$/, '');
  return `${hundredths / 100n}${fraction ? `.${fraction}` : ''}`;
}

export function exactKoboLabel(value) {
  const amount = exactUnsigned(value, 'Recorded spend');
  const fraction = String(amount % 100n).padStart(2, '0');
  return `₦${(amount / 100n).toLocaleString('en-NG')}${fraction === '00' ? '' : `.${fraction}`}`;
}

const emptyQuantities = () => ({ litre: 0n, kg: 0n, scm: 0n });
const publicQuantities = value => Object.fromEntries(units.map(unit => [unit, decimalQuantity(value[unit])]));
function safeCount(value) {
  const count = exactUnsigned(value, 'Purchase count');
  if (count > BigInt(Number.MAX_SAFE_INTEGER)) throw serviceUnavailable('The purchase count exceeds the supported reporting range.');
  return Number(count);
}

/** Money remains integer kobo, and quantities remain integer hundredths until serialization. */
export function summarizePurchaseAnalytics(row, range, timeZone) {
  const days = Array.from({ length: range }, (_, index) => {
    const date = new Date(`${row.first_date}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), spend: 0n, purchaseCount: 0, quantities: emptyQuantities() };
  });
  const dayMap = new Map(days.map(day => [day.date, day]));
  const byFuel = new Map();
  let spend = 0n, purchaseCount = 0;
  const quantities = emptyQuantities();
  for (const group of row.groups) {
    if (!units.includes(group.selling_unit) || exactUnsigned(group.invalid_records, 'Recorded purchase') !== 0n) throw serviceUnavailable('Recorded purchase data needs review before this report can be shown.');
    const amount = exactUnsigned(group.spend_kobo, 'Recorded spend');
    const quantity = exactQuantity(group.quantity);
    const count = safeCount(group.purchases);
    const day = dayMap.get(group.day);
    if (!day) throw serviceUnavailable('The purchase reporting window needs review.');
    const key = JSON.stringify([group.fuel_type, group.selling_unit]);
    if (!byFuel.has(key)) byFuel.set(key, { fuelType: group.fuel_type, sellingUnit: group.selling_unit, quantity: 0n, spend: 0n, purchaseCount: 0 });
    const fuel = byFuel.get(key);
    fuel.quantity += quantity; fuel.spend += amount; fuel.purchaseCount += count;
    spend += amount; purchaseCount += count; quantities[group.selling_unit] += quantity;
    day.spend += amount; day.purchaseCount += count; day.quantities[group.selling_unit] += quantity;
    if (!Number.isSafeInteger(purchaseCount)) throw serviceUnavailable('The purchase count exceeds the supported reporting range.');
  }
  return {
    basis: 'recorded_successful_personal_purchases', range, timeZone, bucket: 'day',
    from: new Date(row.start_at).toISOString(), to: new Date(row.end_at).toISOString(),
    spendKobo: String(spend), purchaseCount, quantities: publicQuantities(quantities),
    byFuel: [...byFuel.values()].sort((a, b) => a.fuelType.localeCompare(b.fuelType) || a.sellingUnit.localeCompare(b.sellingUnit)).map(fuel => ({ fuelType: fuel.fuelType, sellingUnit: fuel.sellingUnit, quantity: decimalQuantity(fuel.quantity), spendKobo: String(fuel.spend), purchaseCount: fuel.purchaseCount })),
    days: days.map(day => ({ date: day.date, spendKobo: String(day.spend), purchaseCount: day.purchaseCount, quantities: publicQuantities(day.quantities) }))
  };
}

export async function customerPurchaseAnalytics(userId, requestedRange = '30') {
  const range = analyticsRange(requestedRange);
  const timeZone = businessTimeZone();
  const row = await one(`WITH bounds AS (
    SELECT (date_trunc('day',now() AT TIME ZONE $2)-make_interval(days=>$3::int-1)) AT TIME ZONE $2 AS start_at,
      (date_trunc('day',now() AT TIME ZONE $2)+interval '1 day') AT TIME ZONE $2 AS end_at
  ), purchases AS (
    SELECT to_char(t.created_at AT TIME ZONE $2,'YYYY-MM-DD') AS day,t.fuel_type,t.selling_unit,
      SUM(t.amount_kobo)::text AS spend_kobo,SUM(t.litres)::text AS quantity,COUNT(*)::text AS purchases,
      COUNT(*) FILTER(WHERE t.amount_kobo<0 OR t.litres<0 OR t.selling_unit NOT IN('litre','kg','scm') OR t.selling_unit IS NULL)::text AS invalid_records
    FROM transactions t CROSS JOIN bounds b
    WHERE t.customer_user_id=$1 AND t.organization_id IS NULL AND t.status='success'
      AND t.created_at>=b.start_at AND t.created_at<b.end_at AND t.created_at<=now()
    GROUP BY day,t.fuel_type,t.selling_unit
  ) SELECT b.start_at,b.end_at,to_char(b.start_at AT TIME ZONE $2,'YYYY-MM-DD') AS first_date,
    COALESCE(jsonb_agg(p) FILTER(WHERE p.day IS NOT NULL),'[]'::jsonb) AS groups
    FROM bounds b LEFT JOIN purchases p ON true GROUP BY b.start_at,b.end_at`, [userId, timeZone, range]);
  return summarizePurchaseAnalytics(row, range, timeZone);
}

export function normalizeSpendingAlertPreferences(value) {
  if (value == null) return { ...defaultAlerts, thresholds: [...defaultAlerts.thresholds] };
  if (typeof value !== 'object' || Array.isArray(value) || typeof value.enabled !== 'boolean' ||
    !Array.isArray(value.thresholds) || value.thresholds.length < 1 || value.thresholds.length > 5 ||
    value.thresholds.some(threshold => !Number.isInteger(threshold) || threshold < 1 || threshold > 100) || new Set(value.thresholds).size !== value.thresholds.length) {
    throw badRequest('Choose one to five different spending thresholds between 1% and 100%.');
  }
  return { enabled: value.enabled, thresholds: [...value.thresholds].sort((a, b) => a - b) };
}

function alertDelivery(user) {
  const preferences = user.notification_prefs ?? {};
  const allowed = preferences.categories?.budget !== false;
  return {
    inApp: allowed && preferences.inApp !== false ? 'enabled' : 'disabled',
    email: !allowed || preferences.email === false ? 'disabled' : !user.email_verified ? 'verify_email' : !env.RESEND_API_KEY ? 'provider_unavailable' : 'queued',
    sms: 'not_supported', push: 'not_supported'
  };
}

async function currentBudget(t, userId) {
  const row = await t.one(`WITH totals AS (
    SELECT COALESCE(SUM(amount_kobo),0)::text AS spend_kobo,COUNT(*) FILTER(WHERE amount_kobo<0)::text AS invalid_records
    FROM transactions WHERE customer_user_id=$1 AND organization_id IS NULL AND status='success'
      AND created_at>=${currentMonthSql} AND created_at<${currentMonthSql}+interval '1 month' AND created_at<=now()
  ) SELECT to_char(${currentMonthSql},'YYYY-MM') AS month,p.projected_kobo,totals.spend_kobo,totals.invalid_records
    FROM totals LEFT JOIN monthly_spend_projections p ON p.user_id=$1 AND p.month=${currentMonthSql}`, [userId]);
  if (exactUnsigned(row.invalid_records, 'Recorded spend') !== 0n) throw serviceUnavailable('Recorded spend needs review before budget alerts can be shown.');
  return row;
}

export async function customerSpendingAlertSettings(userId) {
  const user = await one('SELECT spending_alert_preferences,notification_prefs,email_verified FROM users WHERE id=$1', [userId]);
  if (!user) throw notFound('Account not found.');
  const budget = await currentBudget({ one }, userId);
  return { ...normalizeSpendingAlertPreferences(user.spending_alert_preferences), delivery: alertDelivery(user), month: budget.month,
    budgetKobo: budget.projected_kobo == null ? null : String(exactUnsigned(budget.projected_kobo, 'Projected spend')), spendKobo: String(exactUnsigned(budget.spend_kobo, 'Recorded spend')) };
}

export async function updateCustomerSpendingAlerts(userId, update) {
  await tx(async t => {
    const user = await t.one('SELECT spending_alert_preferences FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!user) throw notFound('Account not found.');
    const preferences = normalizeSpendingAlertPreferences({ ...normalizeSpendingAlertPreferences(user.spending_alert_preferences), ...update });
    await t.query('UPDATE users SET spending_alert_preferences=$2::jsonb,updated_at=now() WHERE id=$1', [userId, JSON.stringify(preferences)]);
  });
  return customerSpendingAlertSettings(userId);
}

/** Safe to retry after committed payments or on overview: one event per account, month and threshold. */
export async function generateCustomerSpendingAlerts(userId) {
  const result = await tx(async t => {
    const subscription = await customerSubscription(userId, t);
    if (!subscription.active || !customerFeatureIncluded(subscription.features, 'Intelligence Notifications')) return { generated: 0, reason: 'not_included', notices: [] };
    const user = await t.one('SELECT id,email,email_verified,notification_prefs,spending_alert_preferences FROM users WHERE id=$1 FOR SHARE', [userId]);
    if (!user) return { generated: 0, reason: 'account_unavailable', notices: [] };
    const settings = normalizeSpendingAlertPreferences(user.spending_alert_preferences);
    if (!settings.enabled || user.notification_prefs?.categories?.budget === false) return { generated: 0, reason: 'disabled', notices: [] };
    const budget = await currentBudget(t, userId);
    if (budget.projected_kobo == null) return { generated: 0, reason: 'no_projection', notices: [] };
    const projected = exactUnsigned(budget.projected_kobo, 'Projected spend');
    const spend = exactUnsigned(budget.spend_kobo, 'Recorded spend');
    if (projected === 0n) return { generated: 0, reason: 'no_projection', notices: [] };
    const notices = [];
    const delivery = alertDelivery(user);
    for (const threshold of settings.thresholds) {
      if (spend * 100n < projected * BigInt(threshold)) continue;
      const eventKey = `customer-spending:${userId}:${budget.month}:${threshold}`;
      const title = `Fuel spending reached ${threshold}%`;
      const body = `${exactKoboLabel(spend)} spent of your ${exactKoboLabel(projected)} projected fuel spend for ${budget.month}. This alert does not stop a purchase.`;
      const notice = await t.one(`INSERT INTO notifications(user_id,organization_id,title,body,category,action_required,link,event_key,in_app_visible)
        VALUES($1,NULL,$2,$3,'budget',false,'/customer/card#fuel-budget',$4,$5)
        ON CONFLICT(event_key) WHERE event_key IS NOT NULL DO NOTHING RETURNING *`, [userId, title, body, eventKey, delivery.inApp === 'enabled']);
      if (!notice) continue;
      if (delivery.email !== 'disabled' && delivery.email !== 'verify_email' && user.email) await queueEmail(t, { eventKey, to: user.email, subject: `Obligon - ${title}`, body });
      notices.push(notice);
    }
    return { generated: notices.length, month: budget.month, spendKobo: String(spend), budgetKobo: String(projected), notices };
  });
  for (const notice of result.notices) if (notice.in_app_visible) emitToUser(userId, 'notification', notice);
  const { notices, ...summary } = result;
  return summary;
}
