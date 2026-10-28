import { api } from './services/client';
import type { SessionUser } from './services/types';
import { partnerAllowedFuels } from '../../../packages/shared/partner-access.mjs';
import { adminPageForPath, hasAdminPage } from '../../../packages/shared/admin-access.mjs';

export type DashboardSearchScope = 'customer' | 'company' | 'partner' | 'admin';
export type DashboardSearchResult = { id: string; label: string; description?: string; href: string; kind?: string };

export class DashboardSearchUnavailableError extends Error {
  constructor(public results: DashboardSearchResult[], public unavailable: string[], message = 'Some records could not be searched. You can still use the available results and pages.') {
    super(message);
    this.name = 'DashboardSearchUnavailableError';
  }
}

type RecordRow = Record<string, unknown>;
type Source = { name: string; path: string; field: string; href: string; kind: string; title: (row: RecordRow) => string; token: (row: RecordRow) => string };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const line = (value: unknown, index = 0) => text(value).split('\n')[index]?.trim() ?? '';
const cell = (row: RecordRow, index: number) => Array.isArray(row.cells) ? text(row.cells[index]) : '';
const reference = (row: RecordRow) => text(row.reference) || cell(row, 0);
const staffName = (row: RecordRow) => line(cell(row, 1), 1) || line(cell(row, 1));
const queryString = (query: string) => new URLSearchParams({ search: query, limit: '6', offset: '0' }).toString();

function sources(scope: DashboardSearchScope, query: string, user: SessionUser): Source[] {
  const params = queryString(query);
  if (scope === 'customer') return [
    { name: 'Recent transactions', path: '/api/customer/transactions?limit=50&offset=0', field: 'transactions', href: '/customer/transactions', kind: 'Transaction', title: reference, token: reference },
    { name: 'Stations', path: `/api/customer/stations?${params}`, field: 'stations', href: '/customer/stations', kind: 'Station', title: row => text(row.name), token: row => text(row.name) }
  ];
  if (scope === 'company') return [
    { name: 'Vehicles', path: `/api/company/vehicles?${params}`, field: 'vehicles', href: '/company/vehicles', kind: 'Vehicle', title: row => text(row.plate), token: row => text(row.plate) },
    { name: 'Cards', path: `/api/company/cards?${params}`, field: 'cards', href: '/company/cards', kind: 'Card', title: row => line(cell(row, 0)), token: row => cell(row, 1) || line(cell(row, 0)) },
    { name: 'Transactions', path: `/api/company/transactions?${params}`, field: 'transactions', href: '/company/transactions', kind: 'Transaction', title: reference, token: reference }
  ];
  if (scope === 'admin') {
  const adminSources: Source[] = [
    { name: 'Companies', path: `/api/admin/companies?${params}`, field: 'companies', href: '/admin', kind: 'Company', title: row => text(row.name) || line(cell(row, 0)), token: row => text(row.name) || line(cell(row, 0)) },
    { name: 'Staff', path: `/api/admin/staff?${params}`, field: 'staff', href: '/admin/staff', kind: 'Staff member', title: row => text(row.name) || line(cell(row, 0)), token: row => text(row.name) || line(cell(row, 0)) },
    { name: 'Disputes', path: `/api/admin/disputes?${params}`, field: 'disputes', href: '/admin/disputes', kind: 'Dispute', title: row => text(row.subject) || reference(row), token: reference }
  ];
  return adminSources.filter(source => { const page = adminPageForPath(source.href); return page && hasAdminPage(user, page); });
  }
  const staff: Source = { name: 'Staff', path: '/api/partner/staff', field: 'staff', href: '/dashboard/staff', kind: 'Staff member', title: staffName, token: row => cell(row, 0) };
  if (!partnerAllowedFuels(user).length) return [staff];
  return [
    { name: 'Transactions', path: `/api/partner/transactions?${params}`, field: 'transactions', href: '/dashboard/transactions', kind: 'Transaction', title: reference, token: reference },
    staff,
    { name: 'Recent disputes', path: '/api/partner/disputes', field: 'disputes', href: '/dashboard/disputes', kind: 'Dispute', title: row => text(row.subject) || reference(row), token: reference }
  ];
}

function allowed(scope: DashboardSearchScope, user: SessionUser | null | undefined): user is SessionUser {
  if (!['customer', 'company', 'partner', 'admin'].includes(scope) || !user?.id) return false;
  if (scope === 'admin') return user.role === 'admin';
  if (scope === 'customer') return user.role === 'customer';
  if (scope === 'company') return user.organizationType === 'company' && Boolean(user.organizationId && user.organizationRole);
  return ['partner', 'mechanic'].includes(user.role) && ['partner', 'mechanic'].includes(user.organizationType ?? '') && Boolean(user.organizationId);
}

/** Search existing authorized lists only. Unfiltered endpoints cover recent records, not an entire account history. */
export async function searchDashboardRecords(scope: DashboardSearchScope, query: string, user: SessionUser | null | undefined): Promise<DashboardSearchResult[]> {
  if (!allowed(scope, user)) throw new DashboardSearchUnavailableError([], ['Account access'], 'This search is not available for the current account.');
  const term = query.trim();
  if (term.length < 2) return [];
  if (term.length > 80) throw new DashboardSearchUnavailableError([], ['Search'], 'Use 80 characters or fewer to search.');
  if (scope === 'company' && user.organizationVerificationStatus !== 'verified') throw new DashboardSearchUnavailableError([], ['Company records'], 'Company records become available after your contract is approved. You can still search available pages.');
  const selected = sources(scope, term, user), needle = term.toLowerCase();
  const settled = await Promise.allSettled(selected.map(async source => {
    const data = await api.request<Record<string, unknown>>(source.path);
    if (!data || !Array.isArray(data[source.field])) throw new Error('The record list could not be read.');
    const results: DashboardSearchResult[] = [];
    const seen = new Set<string>();
    let malformed = false;
    for (const item of (data[source.field] as unknown[]).slice(0, 100)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) { malformed = true; continue; }
      const row = item as RecordRow, id = text(row.id), label = source.title(row), token = source.token(row);
      if (!id || !label || !token) { malformed = true; continue; }
      const values = Object.values(row).flatMap(value => Array.isArray(value) ? value.filter(v => typeof v === 'string') : typeof value === 'string' ? [value] : []);
      if (!values.join(' ').toLowerCase().includes(needle)) continue;
      const resultId = `${source.kind}:${id}`;
      if (seen.has(resultId)) continue;
      seen.add(resultId);
      results.push({ id: resultId, label: label.replace(/\s+/g, ' ').slice(0, 140),
        description: [source.kind, text(row.status)].filter(Boolean).join(' · ').replace(/\s+/g, ' ').slice(0, 180),
        href: `${source.href}?${new URLSearchParams({ search: token }).toString()}`, kind: source.kind });
      if (results.length === 4) break;
    }
    return { results, malformed };
  }));
  const results: DashboardSearchResult[] = [], unavailable: string[] = [];
  settled.forEach((entry, index) => {
    if (entry.status === 'rejected') unavailable.push(selected[index].name);
    else { results.push(...entry.value.results); if (entry.value.malformed) unavailable.push(selected[index].name); }
  });
  if (unavailable.length) throw new DashboardSearchUnavailableError(results.slice(0, 12), unavailable);
  return results.slice(0, 12);
}
