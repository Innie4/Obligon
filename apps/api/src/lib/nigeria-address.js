import { isNigeriaCity } from '../../../../packages/shared/nigeria-cities.mjs';
import { badRequest } from './errors.js';

/** Validate the same pinned State/city catalog seeded by migration 040. */
export function normalizeNigeriaCardAddress(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('Choose a State / FCT and city or town');
  const state = typeof input.state === 'string' ? input.state.trim() : '';
  const city = typeof input.city === 'string' ? input.city.trim() : '';
  if (!isNigeriaCity(state, city)) throw badRequest('Choose a city or town in the selected State / FCT');
  const postalCode = input.postalCode == null ? '' : input.postalCode;
  if (typeof postalCode !== 'string' || (postalCode.trim() && !/^\d{6}$/.test(postalCode.trim()))) {
    throw badRequest('Enter a six-digit postal code or leave it blank');
  }
  return { state, city, postalCode: postalCode.trim() || null };
}
