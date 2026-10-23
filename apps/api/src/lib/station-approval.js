import { badRequest } from './errors.js';
import { partnerAllowedFuels, partnerFuelCode, fuelSellingUnits } from '../../../../packages/shared/partner-access.mjs';

export function canonicalFuelAliases(fuel) {
  return {PMS:['PMS','PMS PETROL','PETROL','UNLEADED'],AGO:['AGO','AGO DIESEL','DIESEL'],DPK:['DPK','DPK KEROSENE','KEROSENE'],CNG:['CNG','CNG COMPRESSED GAS'],LPG:['LPG','LPG GAS','LPG AUTOGAS','GAS']}[partnerFuelCode(fuel)] ?? [];
}

export function canonicalFuelSql(column) {
  if (!/^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?$/i.test(column)) throw new Error('Expected a fixed fuel column name');
  return `CASE ${['PMS','AGO','DPK','CNG','LPG'].map(code=>`WHEN upper(trim(${column})) IN (${canonicalFuelAliases(code).map(alias=>`'${alias}'`).join(',')}) THEN '${code}'`).join(' ')} END`;
}

export function stationFuelConfiguration(partner, fuels, sellingUnits = {}) {
  const allowed = partnerAllowedFuels({ role: partner.role ?? 'partner', partnerType: partner.partnerType ?? partner.partner_type ?? 'other', organizationType: partner.organizationType ?? partner.org_type ?? partner.type });
  if (!allowed.length) throw badRequest('This partner account cannot publish station fuels.');
  if (!Array.isArray(fuels) || !fuels.length || fuels.length > 20) throw badRequest('Choose at least one supported station fuel.');
  if (!sellingUnits || typeof sellingUnits !== 'object' || Array.isArray(sellingUnits)) throw badRequest('Choose a selling unit for each station fuel.');
  const codes = [...new Set(fuels.map(fuel => {
    const code = partnerFuelCode(fuel);
    if (!code || !allowed.includes(code)) throw badRequest('Choose fuels allowed for this partner account.');
    return code;
  }))];
  if (Object.keys(sellingUnits).some(code => !codes.includes(code))) throw badRequest('Selling units must use the selected canonical fuel codes.');
  const units = Object.fromEntries(codes.map(code => {
    const unit = sellingUnits[code] ?? (fuelSellingUnits(code).length === 1 ? 'litre' : null);
    if (!fuelSellingUnits(code).includes(unit)) throw badRequest(`Choose an allowed selling unit for ${code}.`);
    return [code, unit];
  }));
  return { fuels: codes, sellingUnits: units };
}

export function approvedStationUnit(station, fuel, expectedUnit, { requireExpected = false } = {}) {
  const code = partnerFuelCode(fuel);
  const allowed=partnerAllowedFuels({role:station.role??'partner',partnerType:station.partnerType??station.partner_type??'other',organizationType:station.organizationType??station.org_type??station.type});
  const unit = code && station.approved_selling_units?.[code];
  if (!code || !allowed.includes(code) || !Array.isArray(station.fuels) || !station.fuels.some(item=>partnerFuelCode(item)===code) || !fuelSellingUnits(code).includes(unit)) throw badRequest('This station fuel and selling unit require admin approval.');
  if (requireExpected && ['CNG', 'LPG'].includes(code) && expectedUnit == null) throw badRequest('Select the current approved selling unit for this gas fuel.');
  if (expectedUnit != null && expectedUnit !== unit) throw badRequest('The approved selling unit changed. Reload station pricing before continuing.');
  return { fuelType: code, sellingUnit: unit };
}

export function approvedStationPrice(station, price, expectedUnit, options) {
  if (!price) throw badRequest('No published price for this station and fuel.');
  const result = approvedStationUnit(station, price.fuel_type, expectedUnit, options);
  if (price.selling_unit !== result.sellingUnit) throw badRequest('The published price does not match the approved selling unit. Ask the station to update its price.');
  return result;
}

export function canonicalStationPrices(prices) {
  const chosen = new Map();
  for (const price of prices) {
    const code = partnerFuelCode(price.fuel_type);
    if (!code) continue;
    const key = `${price.station_id ?? ''}:${code}`;
    const current = chosen.get(key);
    if (!current || price.fuel_type === code || (current.fuel_type !== code && new Date(price.updated_at ?? 0) > new Date(current.updated_at ?? 0))) chosen.set(key, price);
  }
  return [...chosen.values()].map(row => ({ ...row, fuel_type:partnerFuelCode(row.fuel_type) }));
}
