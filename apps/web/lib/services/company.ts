import { api } from './client';
import type { Metric, Row } from '@/lib/mock/company-data';

export type CompanyRow = Row & { id?: string; cardId?: string; statusRaw?: string; plate?: string; dailyLimit?: number; monthlyLimit?: number; vehicleId?: string; driverId?: string; reference?: string; notes?: string };
export type CompanyWallet = {
  company: { balanceKobo: number; balanceLabel: string };
  members: Array<{ userId: string; role: string; name: string; email: string; balanceKobo: number; balanceLabel: string }>;
  recent: Array<{ id: string; direction: string; amountLabel: string; description: string; reference: string; date: string }>;
};
export type CompanyTicketMessages = { status: string; messages: Array<{ id: string; sender: string; role: string; body: string; time: string }> };
export type FleetChoices = {
  issuerCustomerConfigured: boolean;
  capabilities?: { stableDriverFilters?: boolean };
  cards: Array<{ id: string; label: string; masked_pan: string; status: string; vehicle_id?: string | null; driver_id?: string | null }>;
  vehicles: Array<{ id: string; plate: string; model: string }>;
  drivers: Array<{ id: string; name: string; phone?: string | null; licenseNo?: string | null }>;
};
export type CompanyProfile = { id: string; name: string; rcNumber: string | null; address: string | null; city: string | null; website: string | null; description: string | null; plan: string | null; verificationStatus: string; fleetId: string | null };
export type CompanyNotification = { id: string; title: string; body: string; time: string; read: boolean; category: string; actionRequired: boolean; link: string | null };
export type CompanyStation = { id: string; name: string; address: string; lat: number | null; lng: number | null; hours: string; fuels: string[]; prices?: Array<{ fuel: string; priceLabel: string }> };
export type CompanyBilling = { plan: null | { name: string; priceLabel: string; status: string; nextBilling: string | null }; invoices: CompanyRow[]; paymentMethods: Array<{ id: string; display: string; isDefault: boolean }> };
const get = <T>(path: string) => api.request<T>(`/api/company${path}`);
export const companyApi = {
  overview: () => get<{ metrics: Metric[]; recentTransactions: CompanyRow[] }>('/overview'),
  vehicles: (query = 'limit=20&offset=0') => get<{ vehicles: CompanyRow[]; total: number }>(`/vehicles?${query}`),
  cards: (query = 'limit=20&offset=0') => get<{ cards: CompanyRow[]; metrics: Metric[]; total: number }>(`/cards?${query}`),
  choices: () => get<FleetChoices>('/assignments'),
  transactions: (query: string) => get<{ transactions: CompanyRow[]; total: number }>(`/transactions?${query}`),
  reports: () => get<{ metrics: Metric[]; spend: CompanyRow[]; stationUsage: Array<{ station: string; total: string; visits: number }> }>('/reports'),
  stations: (search: string) => get<{ details: CompanyStation[] }>(`/stations?search=${encodeURIComponent(search)}`),
  roadside: () => get<{ requests: CompanyRow[]; active: Array<{ id: string; vehicle: string; location: string; issue: string; status: string; etaMinutes: number | null; time: string }> }>('/roadside'),
  billing: () => get<CompanyBilling>('/billing'),
  wallet: () => get<CompanyWallet>('/wallet'),
  team: () => get<{ team: CompanyRow[] }>('/team'),
  notifications: () => get<{ detailed: CompanyNotification[]; unreadCount: number }>('/notifications'),
  tickets: () => get<{ tickets: CompanyRow[] }>('/support/tickets'),
  ticketMessages: (id: string) => get<CompanyTicketMessages>(`/support/tickets/${encodeURIComponent(id)}/messages`),
  settings: () => get<{ org: CompanyProfile }>('/settings'),
  maintenance: () => get<{ schedules: CompanyRow[]; fleetHealth: { total: number; healthyPct: number; inService: number } }>('/maintenance')
};
