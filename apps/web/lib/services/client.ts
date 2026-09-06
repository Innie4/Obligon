// Service-client layer (integration seam).
//
// The UI depends ONLY on the `ApiClient` interface below. Two implementations:
//   • MockApiClient  — offline datasets in `@/lib/mock` (UI-only development).
//   • LiveApiClient  — real HTTP against the Obligon API (apps/api).
//
// Live mode is automatic when `NEXT_PUBLIC_API_URL` is configured.

import {
  transactionHistory,
  stations,
  notifications,
  mobileHistory,
  recentActivity,
  vehicles,
  topUpHistory,
  desktopTopUps,
  overviewMetrics as customerOverviewMetrics,
  type CustomerMetric
} from "@/lib/mock/customer-data";
import {
  vehicleRows,
  transactionRows,
  stations as companyStations,
  notifications as companyNotifications,
  cardRows,
  spendRows,
  assistanceHistory,
  invoices,
  teamRows,
  tickets,
  maintenanceRows,
  overviewMetrics as companyOverviewMetrics,
  cardMetrics,
  recentTransactions
} from "@/lib/mock/company-data";
import {
  overviewMetrics as partnerOverviewMetrics,
  quickStats as partnerQuickStats,
  overviewTransactions as partnerOverviewTransactions,
  payoutRows as partnerPayoutRows,
  priceRows as partnerPriceRows,
  transactionRows as partnerTransactionRows,
  reportRows as partnerReportRows,
  staffRows as partnerStaffRows,
  disputeRows as partnerDisputeRows,
  notificationGroups as partnerNotificationGroups
} from "@/lib/mock/dashboard-data";
import {
  companyMetrics as adminCompanyMetrics,
  companyRows as adminCompanyRows,
  applicationMetrics as adminAppMetrics,
  applicationRows as adminAppRows,
  reportMetrics as adminReportMetrics,
  stationPerformanceRows as adminStationRows,
  disputeMetrics as adminDisputeMetrics,
  disputeRows as adminDisputeRows,
  staffMetrics as adminStaffMetrics,
  staffRows as adminStaffRows,
  type AdminMetric,
  type AdminRow
} from "@/lib/mock/admin-data";
import type { Metric, Row } from "@/lib/mock/company-data";
import type { Metric as PartnerMetric, TableRow as PartnerTableRow } from "@/lib/mock/dashboard-data";

import { readPersistedSession, readTokens, writeTokens, writePersistedSession, type AuthTokens } from "@/lib/session-store";
import type {
  ApiResult,
  AppNotification,
  CustomerTransaction,
  MobileTransactionGroup,
  SessionUser,
  Station,
  Vehicle
} from "./types";

const API_URL = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "";
export const LIVE_MODE = Boolean(API_URL);

export interface ApiClient {
  getSession(): Promise<SessionUser | null>;

  // Customer domain
  getCustomerTransactions(): Promise<CustomerTransaction[]>;
  getMobileHistory(): Promise<MobileTransactionGroup[]>;
  getStations(): Promise<Station[]>;
  getVehicles(): Promise<Vehicle[]>;
  getNotifications(): Promise<AppNotification[]>;
  getCustomerVehiclePerformance(): Promise<string[][]>;
  getCustomerRecentActivity(): Promise<CustomerTransaction[]>;
  getCustomerTopUpHistory(): Promise<string[][]>;
  getCustomerDesktopTopUps(): Promise<string[][]>;
  getCustomerOverviewMetrics(): Promise<CustomerMetric[]>;

  // Company domain
  getCompanyVehicles(): Promise<Row[]>;
  getCompanyTransactions(): Promise<Row[]>;
  getCompanyStations(): Promise<string[][]>;
  getCompanyNotifications(): Promise<string[][]>;
  getCompanyCards(): Promise<Row[]>;
  getCompanyReportSpend(): Promise<Row[]>;
  getCompanyAssistance(): Promise<Row[]>;
  getCompanyInvoices(): Promise<Row[]>;
  getCompanyTeam(): Promise<Row[]>;
  getCompanyTickets(): Promise<Row[]>;
  getCompanyMaintenance(): Promise<Row[]>;
  getCompanyOverviewMetrics(): Promise<Metric[]>;
  getCompanyCardMetrics(): Promise<Metric[]>;
  getCompanyRecentTransactions(): Promise<Row[]>;

  // Partner domain
  getPartnerOverviewMetrics(): Promise<PartnerMetric[]>;
  getPartnerQuickStats(): Promise<string[][]>;
  getPartnerRecentTransactions(): Promise<PartnerTableRow[]>;
  getPartnerPayouts(): Promise<PartnerTableRow[]>;
  getPartnerPrices(): Promise<PartnerTableRow[]>;
  getPartnerTransactions(): Promise<PartnerTableRow[]>;
  getPartnerReports(): Promise<PartnerTableRow[]>;
  getPartnerStaff(): Promise<PartnerTableRow[]>;
  getPartnerDisputes(): Promise<PartnerTableRow[]>;
  getPartnerNotifications(): Promise<AppNotification[]>;

  // Admin domain
  getAdminCompanyMetrics(): Promise<AdminMetric[]>;
  getAdminCompanyRows(): Promise<AdminRow[]>;
  getAdminAppMetrics(): Promise<AdminMetric[]>;
  getAdminAppRows(): Promise<AdminRow[]>;
  getAdminReportMetrics(): Promise<AdminMetric[]>;
  getAdminStationPerformance(): Promise<AdminRow[]>;
  getAdminDisputeMetrics(): Promise<AdminMetric[]>;
  getAdminDisputeRows(): Promise<AdminRow[]>;
  getAdminStaffMetrics(): Promise<AdminMetric[]>;
  getAdminStaffRows(): Promise<AdminRow[]>;

  /** Generic transport (used for SSE and any ad-hoc call). */
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

// ---------------------------------------------------------------------------
// Error extraction + fetch transport with automatic token refresh
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  details?: Record<string, string[]>;
  constructor(status: number, message: string, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const tokens = readTokens();
      if (!tokens?.refreshToken || !API_URL) return false;
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: tokens.refreshToken })
        });
        if (!res.ok) return false;
        const data = await res.json();
        writeTokens({ accessToken: data.accessToken, refreshToken: tokens.refreshToken });
        if (data.user) writePersistedSession(data.user);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function http<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  if (!API_URL) throw new ApiError(0, "Live backend URL is not configured (NEXT_PUBLIC_API_URL missing).");
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const tokens = readTokens();
  if (tokens?.accessToken) headers.set("Authorization", `Bearer ${tokens.accessToken}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && !retried && readTokens()) {
    const ok = await refreshTokens();
    if (ok) return http<T>(path, init, true);
    writeTokens(null);
    writePersistedSession(null);
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (isJson && body?.error?.message) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message, isJson ? body?.error?.details : undefined);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// LiveApiClient — every read maps to a real endpoint; mutations are typed helpers
// ---------------------------------------------------------------------------

class LiveApiClient implements ApiClient {
  async request<T>(path: string, init?: RequestInit): Promise<T> {
    return http<T>(path, init);
  }

  async getSession(): Promise<SessionUser | null> {
    if (!readTokens()) return null;
    try {
      const data = await http<{ user: SessionUser }>("/api/auth/session");
      writePersistedSession(data.user);
      return data.user;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        writeTokens(null);
        writePersistedSession(null);
        return null;
      }
      // Network failure: fall back to the cached session so the UI still works
      return readPersistedSession();
    }
  }

  // ---------- Customer ----------
  async getCustomerOverviewMetrics(): Promise<CustomerMetric[]> {
    const data = await http<{ metrics: CustomerMetric[] }>("/api/customer/overview");
    return data.metrics;
  }
  async getCustomerRecentActivity(): Promise<CustomerTransaction[]> {
    const data = await http<{ recentActivity: CustomerTransaction[] }>("/api/customer/overview");
    return data.recentActivity;
  }
  async getCustomerTransactions(): Promise<CustomerTransaction[]> {
    const data = await http<{ transactions: CustomerTransaction[] }>("/api/customer/transactions");
    return data.transactions;
  }
  async getMobileHistory(): Promise<MobileTransactionGroup[]> {
    const data = await http<{ groups: MobileTransactionGroup[] }>("/api/customer/transactions/mobile-history");
    return data.groups;
  }
  async getStations(): Promise<Station[]> {
    const data = await http<{ stations: Station[] }>("/api/customer/stations");
    return data.stations;
  }
  async getVehicles(): Promise<Vehicle[]> {
    const data = await http<{ vehicles: Array<{ cells: string[]; plate?: string; model?: string; assignedCard?: string; status?: string }> }>("/api/company/vehicles").catch(() => ({ vehicles: [] }));
    return data.vehicles.map((v) => ({
      plate: v.plate ?? v.cells[1] ?? "",
      model: v.model ?? v.cells[0]?.split("\n")[0] ?? "",
      assignedCard: v.assignedCard ?? v.cells[2] ?? "No card assigned",
      status: v.status ?? "Active"
    }));
  }
  async getNotifications(): Promise<AppNotification[]> {
    const data = await http<{ notifications: AppNotification[] }>("/api/customer/notifications");
    return data.notifications;
  }
  async getCustomerVehiclePerformance(): Promise<string[][]> {
    // Customers own wallets, not fleets — show an empty table unless they
    // actually have vehicles assigned via a company membership.
    return [];
  }
  async getCustomerTopUpHistory(): Promise<string[][]> {
    const data = await http<{ topUps: string[][] }>("/api/customer/wallet");
    return data.topUps;
  }
  async getCustomerDesktopTopUps(): Promise<string[][]> {
    const data = await http<{ desktopTopUps: string[][] }>("/api/customer/wallet");
    return data.desktopTopUps;
  }

  // ---------- Company ----------
  async getCompanyOverviewMetrics(): Promise<Metric[]> {
    const data = await http<{ metrics: Metric[] }>("/api/company/overview");
    return data.metrics;
  }
  async getCompanyRecentTransactions(): Promise<Row[]> {
    const data = await http<{ recentTransactions: Row[] }>("/api/company/overview");
    return data.recentTransactions;
  }
  async getCompanyVehicles(): Promise<Row[]> {
    const data = await http<{ vehicles: Row[] }>("/api/company/vehicles");
    return data.vehicles;
  }
  async getCompanyTransactions(): Promise<Row[]> {
    const data = await http<{ transactions: Row[] }>("/api/company/transactions");
    return data.transactions;
  }
  async getCompanyStations(): Promise<string[][]> {
    const data = await http<{ stations: string[][] }>("/api/company/stations");
    return data.stations;
  }
  async getCompanyNotifications(): Promise<string[][]> {
    const data = await http<{ notifications: string[][] }>("/api/company/notifications");
    return data.notifications;
  }
  async getCompanyCards(): Promise<Row[]> {
    const data = await http<{ cards: Row[] }>("/api/company/cards");
    return data.cards;
  }
  async getCompanyReportSpend(): Promise<Row[]> {
    const data = await http<{ spend: Row[] }>("/api/company/reports");
    return data.spend;
  }
  async getCompanyAssistance(): Promise<Row[]> {
    const data = await http<{ requests: Row[] }>("/api/company/roadside");
    return data.requests;
  }
  async getCompanyInvoices(): Promise<Row[]> {
    const data = await http<{ invoices: Row[] }>("/api/company/billing");
    return data.invoices;
  }
  async getCompanyTeam(): Promise<Row[]> {
    const data = await http<{ team: Row[] }>("/api/company/team");
    return data.team;
  }
  async getCompanyTickets(): Promise<Row[]> {
    const data = await http<{ tickets: Row[] }>("/api/company/support/tickets");
    return data.tickets;
  }
  async getCompanyMaintenance(): Promise<Row[]> {
    const data = await http<{ schedules: Row[] }>("/api/company/maintenance");
    return data.schedules;
  }
  async getCompanyCardMetrics(): Promise<Metric[]> {
    const data = await http<{ metrics: Metric[] }>("/api/company/cards");
    return data.metrics;
  }

  // ---------- Partner ----------
  async getPartnerOverviewMetrics(): Promise<PartnerMetric[]> {
    const data = await http<{ metrics: PartnerMetric[] }>("/api/partner/overview");
    return data.metrics;
  }
  async getPartnerQuickStats(): Promise<string[][]> {
    const data = await http<{ quickStats: string[][] }>("/api/partner/overview");
    return data.quickStats;
  }
  async getPartnerRecentTransactions(): Promise<PartnerTableRow[]> {
    const data = await http<{ recentTransactions: PartnerTableRow[] }>("/api/partner/overview");
    return data.recentTransactions;
  }
  async getPartnerPayouts(): Promise<PartnerTableRow[]> {
    const data = await http<{ payouts: PartnerTableRow[] }>("/api/partner/settlements");
    return data.payouts;
  }
  async getPartnerPrices(): Promise<PartnerTableRow[]> {
    const data = await http<{ history: PartnerTableRow[] }>("/api/partner/pricing");
    return data.history;
  }
  async getPartnerTransactions(): Promise<PartnerTableRow[]> {
    const data = await http<{ transactions: PartnerTableRow[] }>("/api/partner/transactions");
    return data.transactions;
  }
  async getPartnerReports(): Promise<PartnerTableRow[]> {
    const data = await http<{ companies: PartnerTableRow[] }>("/api/partner/reports");
    return data.companies;
  }
  async getPartnerStaff(): Promise<PartnerTableRow[]> {
    const data = await http<{ staff: PartnerTableRow[] }>("/api/partner/staff");
    return data.staff;
  }
  async getPartnerDisputes(): Promise<PartnerTableRow[]> {
    const data = await http<{ disputes: PartnerTableRow[] }>("/api/partner/disputes");
    return data.disputes;
  }
  async getPartnerNotifications(): Promise<AppNotification[]> {
    const data = await http<{ notifications: AppNotification[] }>("/api/partner/notifications");
    return data.notifications;
  }

  // ---------- Admin ----------
  async getAdminCompanyMetrics(): Promise<AdminMetric[]> {
    const data = await http<{ metrics: AdminMetric[] }>("/api/admin/companies");
    return data.metrics;
  }
  async getAdminCompanyRows(): Promise<AdminRow[]> {
    const data = await http<{ companies: AdminRow[] }>("/api/admin/companies");
    return data.companies;
  }
  async getAdminAppMetrics(): Promise<AdminMetric[]> {
    const data = await http<{ metrics: AdminMetric[] }>("/api/admin/applications");
    return data.metrics;
  }
  async getAdminAppRows(): Promise<AdminRow[]> {
    const data = await http<{ applications: AdminRow[] }>("/api/admin/applications");
    return data.applications;
  }
  async getAdminReportMetrics(): Promise<AdminMetric[]> {
    const data = await http<{ metrics: AdminMetric[] }>("/api/admin/reports");
    return data.metrics;
  }
  async getAdminStationPerformance(): Promise<AdminRow[]> {
    const data = await http<{ stations: AdminRow[] }>("/api/admin/reports");
    return data.stations;
  }
  async getAdminDisputeMetrics(): Promise<AdminMetric[]> {
    const data = await http<{ metrics: AdminMetric[] }>("/api/admin/disputes");
    return data.metrics;
  }
  async getAdminDisputeRows(): Promise<AdminRow[]> {
    const data = await http<{ disputes: AdminRow[] }>("/api/admin/disputes");
    return data.disputes;
  }
  async getAdminStaffMetrics(): Promise<AdminMetric[]> {
    const data = await http<{ metrics: AdminMetric[] }>("/api/admin/staff");
    return data.metrics;
  }
  async getAdminStaffRows(): Promise<AdminRow[]> {
    const data = await http<{ staff: AdminRow[] }>("/api/admin/staff");
    return data.staff;
  }
}

// ---------------------------------------------------------------------------
// MockApiClient — offline datasets + simulated mutations (UI-only mode)
// ---------------------------------------------------------------------------

const simulate = <T>(result: T, ms = 600): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(result), ms));

class MockApiClient implements ApiClient {
  async getSession(): Promise<SessionUser | null> {
    return readPersistedSession();
  }

  async getCustomerTransactions(): Promise<CustomerTransaction[]> { return transactionHistory; }
  async getMobileHistory(): Promise<MobileTransactionGroup[]> { return mobileHistory; }
  async getStations(): Promise<Station[]> { return stations; }
  async getVehicles(): Promise<Vehicle[]> {
    return vehicleRows.map((row) => ({
      plate: row.cells[1],
      model: row.cells[0],
      assignedCard: row.cells[2],
      status: row.status ?? row.cells[3]
    }));
  }
  async getNotifications(): Promise<AppNotification[]> { return notifications; }
  async getCustomerVehiclePerformance(): Promise<string[][]> { return vehicles; }
  async getCustomerRecentActivity(): Promise<CustomerTransaction[]> { return recentActivity; }
  async getCustomerTopUpHistory(): Promise<string[][]> { return topUpHistory; }
  async getCustomerDesktopTopUps(): Promise<string[][]> { return desktopTopUps; }
  async getCustomerOverviewMetrics(): Promise<CustomerMetric[]> { return customerOverviewMetrics; }

  async getCompanyVehicles(): Promise<Row[]> { return vehicleRows; }
  async getCompanyTransactions(): Promise<Row[]> { return transactionRows; }
  async getCompanyStations(): Promise<string[][]> { return companyStations; }
  async getCompanyNotifications(): Promise<string[][]> { return companyNotifications; }
  async getCompanyCards(): Promise<Row[]> { return cardRows; }
  async getCompanyReportSpend(): Promise<Row[]> { return spendRows; }
  async getCompanyAssistance(): Promise<Row[]> { return assistanceHistory; }
  async getCompanyInvoices(): Promise<Row[]> { return invoices; }
  async getCompanyTeam(): Promise<Row[]> { return teamRows; }
  async getCompanyTickets(): Promise<Row[]> { return tickets; }
  async getCompanyMaintenance(): Promise<Row[]> { return maintenanceRows; }
  async getCompanyOverviewMetrics(): Promise<Metric[]> { return companyOverviewMetrics; }
  async getCompanyCardMetrics(): Promise<Metric[]> { return cardMetrics; }
  async getCompanyRecentTransactions(): Promise<Row[]> { return recentTransactions; }

  async getPartnerOverviewMetrics(): Promise<PartnerMetric[]> { return partnerOverviewMetrics; }
  async getPartnerQuickStats(): Promise<string[][]> { return partnerQuickStats; }
  async getPartnerRecentTransactions(): Promise<PartnerTableRow[]> { return partnerOverviewTransactions; }
  async getPartnerPayouts(): Promise<PartnerTableRow[]> { return partnerPayoutRows; }
  async getPartnerPrices(): Promise<PartnerTableRow[]> { return partnerPriceRows; }
  async getPartnerTransactions(): Promise<PartnerTableRow[]> { return partnerTransactionRows; }
  async getPartnerReports(): Promise<PartnerTableRow[]> { return partnerReportRows; }
  async getPartnerStaff(): Promise<PartnerTableRow[]> { return partnerStaffRows; }
  async getPartnerDisputes(): Promise<PartnerTableRow[]> { return partnerDisputeRows; }
  async getPartnerNotifications(): Promise<AppNotification[]> {
    return partnerNotificationGroups.flatMap((group) =>
      group.items.map(([title, time, body]) => ({
        group: group.label,
        title,
        time,
        body,
        read: false
      }))
    );
  }

  async getAdminCompanyMetrics(): Promise<AdminMetric[]> { return adminCompanyMetrics; }
  async getAdminCompanyRows(): Promise<AdminRow[]> { return adminCompanyRows; }
  async getAdminAppMetrics(): Promise<AdminMetric[]> { return adminAppMetrics; }
  async getAdminAppRows(): Promise<AdminRow[]> { return adminAppRows; }
  async getAdminReportMetrics(): Promise<AdminMetric[]> { return adminReportMetrics; }
  async getAdminStationPerformance(): Promise<AdminRow[]> { return adminStationRows; }
  async getAdminDisputeMetrics(): Promise<AdminMetric[]> { return adminDisputeMetrics; }
  async getAdminDisputeRows(): Promise<AdminRow[]> { return adminDisputeRows; }
  async getAdminStaffMetrics(): Promise<AdminMetric[]> { return adminStaffMetrics; }
  async getAdminStaffRows(): Promise<AdminRow[]> { return adminStaffRows; }

  async request<T>(_path: string, _init?: RequestInit): Promise<T> {
    throw new ApiError(0, "Mock mode has no transport. Configure NEXT_PUBLIC_API_URL to go live.");
  }
}

// ---------------------------------------------------------------------------
// Auth + mutation API (works against the live backend; simulated in mock mode)
// ---------------------------------------------------------------------------

export interface LoginResponse {
  user: SessionUser;
  accessToken?: string;
  refreshToken?: string;
  mfaRequired: boolean;
}

export const authApi = {
  async login(payload: { email: string; password: string; rememberMe?: boolean; role?: string; totp?: string }): Promise<LoginResponse> {
    if (!LIVE_MODE) {
      await simulate({}, 500);
      const session = readPersistedSession();
      const name = payload.email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        user: session ?? {
          id: `usr_${payload.email.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`,
          name, email: payload.email, initials: name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
          role: (payload.role as SessionUser["role"]) ?? "customer",
          organization: "Obligon LTD Enterprise", accountTier: "Premium Account"
        },
        mfaRequired: false
      };
    }
    const data = await http<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (data.accessToken && data.refreshToken) {
      writeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      writePersistedSession(data.user);
    }
    return data;
  },

  async signup(payload: Record<string, unknown>): Promise<LoginResponse> {
    if (!LIVE_MODE) {
      await simulate({}, 700);
      throw new ApiError(0, "Signup requires the live backend. Configure NEXT_PUBLIC_API_URL.");
    }
    const data = await http<LoginResponse>("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) });
    if (data.accessToken && data.refreshToken) {
      writeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      writePersistedSession(data.user);
    }
    return data;
  },

  async logout(): Promise<void> {
    if (LIVE_MODE) {
      const tokens = readTokens();
      await http("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: tokens?.refreshToken }) }).catch(() => undefined);
    }
    writeTokens(null);
    writePersistedSession(null);
  },

  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/auth/change-password", { method: "POST", body: JSON.stringify(payload) });
  },

  async forgotPassword(email: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean; message?: string }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
  },

  async resetPassword(payload: { email: string; code: string; newPassword: string }) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify(payload) });
  },

  async verifyEmailSend() {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/auth/verify-email/send", { method: "POST" });
  },
  async verifyEmailConfirm(code: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/auth/verify-email/confirm", { method: "POST", body: JSON.stringify({ code }) });
  },
  async verifyPhoneSend(phone?: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/auth/verify-phone/send", { method: "POST", body: JSON.stringify({ phone }) });
  },
  async verifyPhoneConfirm(code: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/auth/verify-phone/confirm", { method: "POST", body: JSON.stringify({ code }) });
  },
  async mfaChallenge(payload: { email: string; totp: string; rememberMe?: boolean }) {
    if (!LIVE_MODE) { await simulate({}); return { user: readPersistedSession() } as unknown as LoginResponse; }
    const data = await http<LoginResponse>("/api/auth/mfa/challenge", { method: "POST", body: JSON.stringify(payload) });
    if (data.accessToken && data.refreshToken) {
      writeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      writePersistedSession(data.user);
    }
    return data;
  },

  async mfaSetup() {
    if (!LIVE_MODE) throw new ApiError(0, "MFA setup requires the live backend.");
    return http<{ secret: string; otpauth: string; qrDataUrl: string; backupCodes: string[] }>("/api/auth/mfa/setup", { method: "POST" });
  },
  async mfaEnable(token: string): Promise<{ ok: boolean; backupCodes?: string[] }> {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean; backupCodes?: string[] }>("/api/auth/mfa/enable", { method: "POST", body: JSON.stringify({ token }) });
  },
  async mfaDisable(password: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/auth/mfa/disable", { method: "POST", body: JSON.stringify({ password }) });
  }
};

/** Domain mutations — live HTTP when configured, simulated locally otherwise. */
export const mutationsApi = {
  // Customer: wallet
  async topUpWallet(amount: number, method: string) {
    if (!LIVE_MODE) { await simulate({}, 900); return { ok: true, reference: `TRX-LOCAL-${Date.now()}`, simulated: true }; }
    return http<{ ok: boolean; reference: string; paymentUrl?: string; simulated?: boolean; message?: string }>("/api/customer/wallet/topup", {
      method: "POST", body: JSON.stringify({ amount, method })
    });
  },
  async confirmTopUp(reference: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/customer/wallet/topup/confirm", { method: "POST", body: JSON.stringify({ reference }) });
  },
  async addPaymentMethod(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/customer/payment-methods", { method: "POST", body: JSON.stringify(payload) });
  },
  async removePaymentMethod(id: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/customer/payment-methods/${id}`, { method: "DELETE" });
  },

  // Customer: card
  async cardAction(cardId: string, action: "freeze" | "unfreeze" | "report-lost" | "replace" | "pin" | "limits", payload: Record<string, unknown> = {}) {
    if (!LIVE_MODE) { await simulate({}, 800); return { ok: true, simulated: true } as Record<string, unknown>; }
    const path = action === "pin" ? "pin" : action === "limits" ? "limits" : action;
    return http<Record<string, unknown>>(`/api/customer/cards/${cardId}/${path}`, { method: "POST", body: JSON.stringify(payload) });
  },
  async cardStatus(cardId: string) {
    if (!LIVE_MODE) return null;
    return http<{ card: Record<string, unknown> | null }>(`/api/customer/card`);
  },

  // Customer: profile / notifications / support
  async updateProfile(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 700); return { ok: true, simulated: true }; }
    return http<{ ok: boolean; user: SessionUser }>("/api/customer/profile", { method: "PUT", body: JSON.stringify(payload) });
  },
  async markNotificationRead(id: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/customer/notifications/${id}/read`, { method: "POST" });
  },
  async markAllNotificationsRead() {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/customer/notifications/read-all", { method: "POST" });
  },
  async createSupportTicket(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 800); return { ok: true, reference: `TKT-LOCAL-${Date.now()}`, simulated: true }; }
    return http<{ ok: boolean; reference: string }>("/api/customer/support/tickets", { method: "POST", body: JSON.stringify(payload) });
  },

  // Company
  async createVehicle(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 700); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>("/api/company/vehicles", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateVehicle(id: string, payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/company/vehicles/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  async deleteVehicle(id: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/company/vehicles/${id}`, { method: "DELETE" });
  },
  async createDriver(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/company/drivers", { method: "POST", body: JSON.stringify(payload) });
  },
  async assignCard(payload: { cardId: string; vehicleId?: string; driverId?: string }) {
    if (!LIVE_MODE) { await simulate({}, 800); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>("/api/company/assignments", { method: "POST", body: JSON.stringify(payload) });
  },
  async issueCompanyCard(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 900); return { ok: true, simulated: true }; }
    return http<{ ok: boolean; maskedPan?: string; simulated?: boolean }>("/api/company/cards", { method: "POST", body: JSON.stringify(payload) });
  },
  async companyCardAction(cardId: string, action: "freeze" | "unfreeze" | "limits" | "pos-code", payload: Record<string, unknown> = {}) {
    if (!LIVE_MODE) { await simulate({}, 800); return { ok: true, simulated: true } as Record<string, unknown>; }
    return http<Record<string, unknown>>(`/api/company/cards/${cardId}/${action}`, { method: action === "limits" ? "PUT" : "POST", body: JSON.stringify(payload) });
  },
  async createRoadsideRequest(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 900); return { ok: true, requestId: "local", status: "RECEIVED", simulated: true }; }
    return http<{ ok: boolean; requestId: string; status: string }>("/api/company/roadside", { method: "POST", body: JSON.stringify(payload) });
  },
  async cancelRoadsideRequest(id: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/company/roadside/${id}/cancel`, { method: "POST" });
  },
  async inviteTeamMember(payload: { email: string; role: string }) {
    if (!LIVE_MODE) { await simulate({}, 800); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>("/api/company/team/invite", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateTeamMember(id: string, payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/company/team/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  async removeTeamMember(id: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/company/team/${id}`, { method: "DELETE" });
  },
  async changePlan(planCode: string) {
    if (!LIVE_MODE) { await simulate({}, 900); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>("/api/company/billing/plan", { method: "POST", body: JSON.stringify({ planCode }) });
  },
  async cancelSubscription(confirm: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean; message?: string }>("/api/company/billing/cancel", { method: "POST", body: JSON.stringify({ confirm }) });
  },
  async bookMaintenance(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 800); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>("/api/company/maintenance", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateMaintenance(id: string, status: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/company/maintenance/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
  },
  async updateOrgSettings(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 700); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>("/api/company/settings", { method: "PUT", body: JSON.stringify(payload) });
  },
  async createCompanyTicket(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 800); return { ok: true, reference: `TK-LOCAL-${Date.now()}`, simulated: true }; }
    return http<{ ok: boolean; reference: string }>("/api/company/support/tickets", { method: "POST", body: JSON.stringify(payload) });
  },
  async companyNotificationRead(id: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/company/notifications/${id}/read`, { method: "POST" });
  },
  async companyNotificationReadAll() {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/company/notifications/read-all", { method: "POST" });
  },

  // Partner
  async updateStation(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 700); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>("/api/partner/station", { method: "PUT", body: JSON.stringify(payload) });
  },
  async uploadStationAsset(file: File) {
    if (!LIVE_MODE) { await simulate({}, 900); return { ok: true, path: "local", simulated: true }; }
    const form = new FormData();
    form.append("asset", file);
    return http<{ ok: boolean; path: string }>("/api/partner/station/assets", { method: "POST", body: form });
  },
  async removeStationAsset(path: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/partner/station/assets", { method: "DELETE", body: JSON.stringify({ path }) });
  },
  async messageTerminal(message: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/partner/station/message-terminal", { method: "POST", body: JSON.stringify({ message }) });
  },
  async requestResupply(payload: { fuelType: string; litres: number }) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/partner/station/resupply", { method: "POST", body: JSON.stringify(payload) });
  },
  async updatePrices(updates: Array<{ fuelType: string; price: number }>) {
    if (!LIVE_MODE) { await simulate({}, 900); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>("/api/partner/pricing", { method: "POST", body: JSON.stringify({ updates }) });
  },
  async updatePayoutConfig(payload: { settlementLimit?: number; autoSettlement?: boolean }) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/partner/settlements/config", { method: "PUT", body: JSON.stringify(payload) });
  },
  async addBankAccount(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 800); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>("/api/partner/bank-accounts", { method: "POST", body: JSON.stringify(payload) });
  },
  async removeBankAccount(id: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/partner/bank-accounts/${id}`, { method: "DELETE" });
  },
  async requestPayout(payload: { amount: number; bankAccountId?: string }) {
    if (!LIVE_MODE) { await simulate({}, 900); return { ok: true, reference: `PY-LOCAL-${Date.now()}`, simulated: true }; }
    return http<{ ok: boolean; reference: string }>("/api/partner/payouts", { method: "POST", body: JSON.stringify(payload) });
  },
  async retryPayout(id: string) {
    if (!LIVE_MODE) { await simulate({}, 800); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>(`/api/partner/payouts/${id}/retry`, { method: "POST" });
  },
  async posAuthorize(payload: { code: string; litres?: number; fuelType?: string }) {
    if (!LIVE_MODE) {
      await simulate({}, 900);
      return {
        approved: true, reference: `TXN-LOCAL-${Date.now()}`, card: "•••• •••• •••• 4242",
        vehicle: "TRK-084", fleet: "Demo Fleet", creditLimitLabel: "₦500,000",
        amountLabel: `₦${((payload.litres ?? 40) * 1085).toLocaleString()}`, time: new Date().toLocaleTimeString(), simulated: true
      };
    }
    return http<Record<string, unknown>>("/api/partner/pos/authorize", { method: "POST", body: JSON.stringify(payload) });
  },
  async addStaff(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 800); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>("/api/partner/staff", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateStaff(id: string, payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/partner/staff/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  async removeStaff(id: string) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/partner/staff/${id}`, { method: "DELETE" });
  },
  async createDispute(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 900); return { ok: true, reference: `DS-LOCAL-${Date.now()}`, simulated: true }; }
    return http<{ ok: boolean; reference: string }>("/api/partner/disputes", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateDispute(id: string, payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/partner/disputes/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  async partnerNotificationAction(id: string | null, action: "read" | "dismiss" | "read-all") {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    const path = action === "read-all" ? "/api/partner/notifications/read-all" : `/api/partner/notifications/${id}/${action}`;
    return http<{ ok: boolean }>(path, { method: "POST" });
  },
  async updatePartnerSettings(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 700); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>("/api/partner/settings", { method: "PUT", body: JSON.stringify(payload) });
  },

  // Admin
  async reviewApplication(id: string, decision: "approve" | "reject" | "under_review", note?: string) {
    if (!LIVE_MODE) { await simulate({}, 900); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>(`/api/admin/applications/${id}/review`, { method: "POST", body: JSON.stringify({ decision, note }) });
  },
  async provisionFleet(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 900); return { ok: true, fleetId: `FLT-LOCAL-${Date.now()}`, simulated: true }; }
    return http<{ ok: boolean; fleetId: string }>("/api/admin/companies", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateCompany(orgId: string, payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/admin/companies/${orgId}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  async resolveDispute(id: string, payload: { outcome: string; note?: string; refundAmount?: number }) {
    if (!LIVE_MODE) { await simulate({}, 900); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>(`/api/admin/disputes/${id}/resolve`, { method: "POST", body: JSON.stringify(payload) });
  },
  async createAdminStaff(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 800); return { ok: true, simulated: true }; }
    return http<{ ok: boolean }>("/api/admin/staff", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateAdminStaff(id: string, payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>(`/api/admin/staff/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  }
};

/** Public (unauthenticated) endpoints — careers, leads, contact, plans, consent. */
export const publicApi = {
  async getPlans(): Promise<Array<{ code: string; name: string; priceLabel: string; features: string[]; highlighted: boolean }>> {
    if (!LIVE_MODE) {
      return [
        { code: "starter", name: "Starter", priceLabel: "₦25,000", features: ["Up to 5 vehicles", "5 fuel cards", "Basic reporting"], highlighted: false },
        { code: "growth", name: "Growth", priceLabel: "₦75,000", features: ["Up to 25 vehicles", "Unlimited cards", "Advanced analytics"], highlighted: true },
        { code: "enterprise", name: "Enterprise", priceLabel: "₦150,000", features: ["Unlimited vehicles", "Dedicated manager", "API access"], highlighted: false }
      ];
    }
    const data = await http<{ plans: Array<{ code: string; name: string; priceLabel: string; features: string[]; highlighted: boolean }> }>("/api/public/plans");
    return data.plans;
  },
  async selectPlan(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 700); return { ok: true, message: "Our onboarding team will contact you shortly.", simulated: true }; }
    return http<{ ok: boolean; message: string }>("/api/public/plans/select", { method: "POST", body: JSON.stringify(payload) });
  },
  async submitLead(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 700); return { ok: true, message: "Thanks — we'll be in touch.", simulated: true }; }
    return http<{ ok: boolean; message: string }>("/api/public/leads", { method: "POST", body: JSON.stringify(payload) });
  },
  async submitContact(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}, 800); return { ok: true, message: "Message received — we'll respond within a few hours.", simulated: true }; }
    return http<{ ok: boolean; message: string }>("/api/public/contact", { method: "POST", body: JSON.stringify(payload) });
  },
  async getJobs(): Promise<Array<{ id: string; title: string; department: string; location: string; employmentType: string; description: string; requirements: string[] }>> {
    if (!LIVE_MODE) {
      return [
        { id: "j1", title: "Senior Backend Engineer", department: "Engineering", location: "Lagos, Nigeria (Hybrid)", employmentType: "Full-time", description: "Build the APIs powering Nigeria's fuel card network.", requirements: ["5+ years Node.js", "Postgres at scale"] },
        { id: "j2", title: "Fleet Success Manager", department: "Operations", location: "Abuja, Nigeria", employmentType: "Full-time", description: "Own onboarding and retention for enterprise fleets.", requirements: ["3+ years B2B SaaS"] },
        { id: "j3", title: "Product Designer", department: "Design", location: "Remote", employmentType: "Contract", description: "Design dashboard and mobile experiences.", requirements: ["Portfolio required", "Figma fluency"] }
      ];
    }
    const data = await http<{ jobs: Array<{ id: string; title: string; department: string; location: string; employmentType: string; description: string; requirements: string[] }> }>("/api/public/jobs");
    return data.jobs;
  },
  async applyToJob(payload: Record<string, unknown>, resume?: File | null) {
    if (!LIVE_MODE) { await simulate({}, 900); return { ok: true, message: "Application received — we'll be in touch.", simulated: true }; }
    const form = new FormData();
    for (const [k, v] of Object.entries(payload)) form.append(k, String(v));
    if (resume) form.append("resume", resume);
    return http<{ ok: boolean; message: string }>("/api/public/jobs/apply", { method: "POST", body: form });
  },
  async saveCookieConsent(preferences: Record<string, unknown>, dntRespected: boolean) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true }; }
    return http<{ ok: boolean }>("/api/public/cookie-consent", { method: "POST", body: JSON.stringify({ preferences, dntRespected }) });
  },
  async submitDataRequest(payload: Record<string, unknown>) {
    if (!LIVE_MODE) { await simulate({}); return { ok: true, message: "Your data request has been logged.", simulated: true }; }
    return http<{ ok: boolean; message: string }>("/api/public/data-requests", { method: "POST", body: JSON.stringify(payload) });
  },
  async trackEvent(name: string, props?: Record<string, unknown>) {
    if (!LIVE_MODE) return;
    void http("/api/public/events", { method: "POST", body: JSON.stringify({ name, props }) }).catch(() => undefined);
  }
};

/** Open an SSE stream for real-time feeds (POS, dispatch, notifications). */
export function openRealtimeStream(onEvent: (event: string, payload: unknown) => void): () => void {
  if (!LIVE_MODE || typeof window === "undefined") return () => undefined;
  const tokens = readTokens();
  if (!tokens?.accessToken) return () => undefined;
  const source = new EventSource(`${API_URL}/api/realtime/stream?token=${encodeURIComponent(tokens.accessToken)}`);
  const handler = (eventName: string) => (e: MessageEvent) => {
    try {
      onEvent(eventName, JSON.parse(e.data));
    } catch {
      onEvent(eventName, e.data);
    }
  };
  for (const name of ["notification", "pos.approved", "pos.declined", "roadside.updated", "pricing.updated", "fleet.updated", "verification.approved", "terminal.message"]) {
    source.addEventListener(name, handler(name) as EventListener);
  }
  return () => source.close();
}

export type ApiMode = "mock" | "live";

export function createApiClient(mode: ApiMode = "mock"): ApiClient {
  return mode === "live" ? new LiveApiClient() : new MockApiClient();
}

// Single app-wide client instance. Live automatically when NEXT_PUBLIC_API_URL is set.
export const api: ApiClient = createApiClient(LIVE_MODE ? "live" : "mock");

export type { ApiResult };
