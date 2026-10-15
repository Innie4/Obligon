import { badRequest } from './errors.js';
import { nairaToKobo } from './money-amounts.js';

function nairaAmount(value, label) {
  return nairaToKobo(value, { min: 10000, max: 100000000000, label });
}
export function cardLimits(daily, monthly) {
  const dailyKobo = nairaAmount(daily, 'Daily limit');
  const monthlyKobo = nairaAmount(monthly, 'Monthly limit');
  if (monthlyKobo < dailyKobo) throw badRequest('Monthly limit cannot be lower than the daily limit');
  return { dailyKobo, monthlyKobo };
}
export function companyReportOptions(query = {}) {
  const range = query.range ?? '30';
  if (typeof range !== 'string' || !/^\d+$/.test(range) || Number(range) < 1 || Number(range) > 365) throw badRequest('Report range must be between 1 and 365 days');
  const scope = query.scope ?? 'transactions';
  if (!['transactions', 'vehicles', 'invoices', 'maintenance'].includes(scope)) throw badRequest('Choose a supported export scope');
  const format = query.format ?? 'csv';
  if (!['csv', 'pdf'].includes(format)) throw badRequest('Choose CSV or PDF format');
  const date = query.date ?? null;
  if (date !== null && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw badRequest('Choose a valid transaction date');
  const filter = (value) => { if (value == null || value === '') return null; if (typeof value !== 'string' || value.length > 120) throw badRequest('Invalid report filter'); return value; };
  const driverId = query.driverId ?? null;
  if (driverId !== null && (typeof driverId !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(driverId))) throw badRequest('Choose a valid driver');
  return { days: Number(range), scope, format, vehicle: filter(query.vehicle), driver: filter(query.driver), driverId, date };
}

/** Identity is forwarded to the issuer once; it is never added to audit metadata or stored locally. */
export function companyIssuerIdentity(holder, account) {
  const field = (key, label, max = 200) => {
    const value = holder?.[key];
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw badRequest(`Enter ${label}`);
    return value.trim();
  };
  const firstName = field('firstName', 'the card holder first name', 80);
  const lastName = field('lastName', 'the card holder last name', 80);
  const dob = field('dob', 'a valid date of birth', 10);
  companyReportOptions({ date: dob });
  if (Date.parse(dob) >= Date.now()) throw badRequest('Date of birth must be in the past');
  const bvn = field('bvn', 'an 11-digit BVN', 11);
  if (!/^2\d{10}$/.test(bvn)) throw badRequest('BVN must be 11 digits starting with 2');
  const postalCode = field('postalCode', 'the six-digit postal code', 6);
  if (!/^\d{6}$/.test(postalCode)) throw badRequest('Enter the six-digit postal code');
  const phoneNumber = String(holder?.phone || account.phone || '').replace(/[\s()-]/g, '');
  if (!/^(?:\+234\d{10}|0\d{10})$/.test(phoneNumber)) throw badRequest('Enter a valid Nigerian contact phone number');
  return { firstName, lastName, dob, bvn, phoneNumber: phoneNumber.startsWith('0') ? `+234${phoneNumber.slice(1)}` : phoneNumber, email: account.email, address: field('address', 'the residential address'), city: field('city', 'the city', 80), state: field('state', 'the state', 80), postalCode };
}
