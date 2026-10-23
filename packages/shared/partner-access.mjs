const types = new Set(['fuel_station', 'gas_station', 'mechanic', 'other']);
const fuels = ['PMS', 'AGO', 'DPK', 'CNG', 'LPG'];

export function partnerFuelCode(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().toUpperCase();
  if (/^(PMS(?: PETROL)?|PETROL|UNLEADED)$/.test(name)) return 'PMS';
  if (/^(AGO(?: DIESEL)?|DIESEL)$/.test(name)) return 'AGO';
  if (/^(DPK(?: KEROSENE)?|KEROSENE)$/.test(name)) return 'DPK';
  if (/^CNG(?: COMPRESSED GAS)?$/.test(name)) return 'CNG';
  if (/^(LPG(?: GAS| AUTOGAS)?|GAS)$/.test(name)) return 'LPG';
  return null;
}

export function partnerTypeFor(user = {}) {
  user ??= {};
  if (user.role === 'mechanic' || user.organizationType === 'mechanic') return 'mechanic';
  if (types.has(user.partnerType)) return user.partnerType;
  return user.role === 'partner' && user.partnerType == null ? 'fuel_station' : 'other';
}

export function partnerTypeLabel(user) {
  return {fuel_station: 'Fuel station', gas_station: 'Gas station', mechanic: 'Workshop', other: 'Partner account'}[partnerTypeFor(user)];
}

export function partnerAllowedFuels(user) {
  const type = partnerTypeFor(user);
  return type === 'gas_station' ? ['CNG', 'LPG'] : type === 'fuel_station' ? [...fuels] : [];
}

const commonPages = new Set(['overview', 'billing', 'accountVerification', 'staff', 'notifications', 'settings']);
const fuelPages = new Set(['transactions', 'verification', 'pos', 'pricing', 'station', 'stationProfile', 'profile', 'reports', 'settlements', 'disputes']);

export function partnerPageAllowed(user, key) {
  if (!['partner', 'mechanic'].includes(user?.role)) return false;
  if (commonPages.has(key)) return true;
  if (key === 'workshop') return partnerTypeFor(user) === 'mechanic';
  return fuelPages.has(key) && partnerAllowedFuels(user).length > 0;
}

const pageByRoute = {
  '/dashboard': 'overview', '/mechanic': 'overview', '/dashboard/workshop': 'workshop',
  '/dashboard/billing': 'billing', '/dashboard/verify': 'accountVerification',
  '/dashboard/staff': 'staff', '/dashboard/notifications': 'notifications',
  '/dashboard/settings': 'settings', '/dashboard/transactions': 'transactions',
  '/dashboard/card-verification': 'verification', '/dashboard/fuel-pricing': 'pricing',
  '/dashboard/station-profile': 'stationProfile', '/dashboard/reports': 'reports',
  '/dashboard/settlements': 'settlements', '/dashboard/disputes': 'disputes'
};

export function partnerRouteAllowed(user, path) {
  if(path.replace(/\/$/, '') === '/mechanic') return ['partner','mechanic'].includes(user?.role) && partnerTypeFor(user)==='mechanic';
  return partnerPageAllowed(user, pageByRoute[path.replace(/\/$/, '') || '/']);
}

export function partnerApiAllowed(user, method, path) {
  if (!['partner', 'mechanic'].includes(user?.role)) return false;
  const action = `${method === 'HEAD' ? 'GET' : method} ${path.replace(/\/$/, '') || '/'}`;
  if (/^GET \/overview(?:\/range)?$/.test(action)) return true;
  if (/^(GET|POST) \/billing(?:\/[^/]+)?$/.test(action)) return true;
  if (/^(GET|POST|PUT|DELETE) \/staff(?:\/[^/]+)?$/.test(action)) return true;
  if (/^GET \/notifications$|^POST \/notifications\/(?:read-all|[^/]+\/(?:read|dismiss))$/.test(action)) return true;
  if (/^(GET|PUT) \/settings$|^(GET|POST) \/settings\/service-requests(?:\/[^/]+)?$/.test(action)) return true;
  if (/^(GET|PUT) \/workshop$/.test(action)) return partnerTypeFor(user) === 'mechanic';
  if (!partnerAllowedFuels(user).length) return false;
  return /^(GET|POST|PUT|DELETE) \/(?:transactions|reports|settlements|bank-accounts|payouts|stations|station|pricing|discounts|pos|disputes)(?:\/[^/]+){0,3}$/.test(action) ||
    /^(GET|POST|DELETE) \/settings\/api-keys(?:\/[^/]+)?$/.test(action);
}

export function fuelSellingUnits(fuel) {
  const code = partnerFuelCode(fuel);
  return code === 'CNG' ? ['kg', 'scm'] : code === 'LPG' ? ['kg', 'litre'] : ['PMS', 'AGO', 'DPK'].includes(code) ? ['litre'] : [];
}

export function sellingUnitLabel(unit) {
  return {litre: 'L', kg: 'kg', scm: 'standard m³'}[unit] ?? 'unit';
}
