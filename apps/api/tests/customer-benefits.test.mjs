import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyticsRange, exactKoboLabel, normalizeSpendingAlertPreferences, summarizePurchaseAnalytics } from '../src/lib/customer-benefits.js';

test('analytics accepts only supported bounded calendar windows', () => {
  assert.equal(analyticsRange(undefined), 30);
  for (const range of ['7', '30', '90', '365']) assert.equal(analyticsRange(range), Number(range));
  for (const range of ['0', '-7', '366', '7.0', ['30'], true, '30;DROP TABLE users']) assert.throws(() => analyticsRange(range));
});

test('purchase analytics preserves exact money and keeps physical units separate', () => {
  const report = summarizePurchaseAnalytics({ first_date: '2026-10-01', start_at: new Date('2026-10-01Z'), end_at: new Date('2026-10-08Z'), groups: [
    { day: '2026-10-01', fuel_type: 'PMS', selling_unit: 'litre', spend_kobo: '9007199254740993', quantity: '1.25', purchases: '1', invalid_records: '0' },
    { day: '2026-10-01', fuel_type: 'LPG', selling_unit: 'kg', spend_kobo: '700', quantity: '2.50', purchases: '1', invalid_records: '0' },
    { day: '2026-10-02', fuel_type: 'CNG', selling_unit: 'scm', spend_kobo: '800', quantity: '3.75', purchases: '1', invalid_records: '0' },
  ] }, 7, 'Africa/Lagos');
  assert.equal(report.spendKobo, '9007199254742493');
  assert.deepEqual(report.quantities, { litre: '1.25', kg: '2.5', scm: '3.75' });
  assert.equal(report.days.length, 7);
  assert.equal(report.days[0].spendKobo, '9007199254741693');
  assert.equal(report.days[6].spendKobo, '0');
  assert.equal(report.byFuel.find(item => item.fuelType === 'LPG').sellingUnit, 'kg');
  assert.equal(report.basis, 'recorded_successful_personal_purchases');
  assert.doesNotMatch(JSON.stringify(report), /efficiency|odometer|consumed/i);
});

test('analytics refuses invalid recorded data instead of silently inventing a total', () => {
  const base = { first_date: '2026-10-01', start_at: new Date('2026-10-01Z'), end_at: new Date('2026-10-08Z') };
  for (const change of [{ spend_kobo: '-1' }, { selling_unit: 'gallons' }, { quantity: '1.005' }, { invalid_records: '1' }]) {
    assert.throws(() => summarizePurchaseAnalytics({ ...base, groups: [{ day: '2026-10-01', fuel_type: 'PMS', selling_unit: 'litre', spend_kobo: '1', quantity: '1.00', purchases: '1', invalid_records: '0', ...change }] }, 7, 'UTC'));
  }
});

test('spending alerts are opt-in with explicit configurable thresholds', () => {
  assert.deepEqual(normalizeSpendingAlertPreferences(null), { enabled: false, thresholds: [80, 100] });
  assert.deepEqual(normalizeSpendingAlertPreferences({ enabled: true, thresholds: [100, 25, 80] }), { enabled: true, thresholds: [25, 80, 100] });
  for (const thresholds of [[], [0], [101], [80.5], [80, 80], ['80'], [10, 20, 30, 40, 50, 60]]) assert.throws(() => normalizeSpendingAlertPreferences({ enabled: true, thresholds }));
});

test('alert money labels use integer kobo even above the floating-point safe range', () => {
  assert.equal(exactKoboLabel('9007199254740993'), '₦90,071,992,547,409.93');
  assert.equal(exactKoboLabel('100'), '₦1');
  assert.equal(exactKoboLabel('105'), '₦1.05');
});
