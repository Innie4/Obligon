// Service-client layer (integration seam).
//
// The UI should depend ONLY on the `ApiClient` interface below, never on a
// concrete transport. Today a `MockApiClient` returns the isolated datasets in
// `@/lib/mock`. When a real backend exists, implement `ApiClient` with `fetch`
// (see `LiveApiClient` stub) and call `createApiClient("live")`.
//
// No real endpoints are wired yet — this is the boundary for future backend work.

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

import { readPersistedSession } from "@/lib/session-store";
import type {
  ApiResult,
  AppNotification,
  CustomerTransaction,
  MobileTransactionGroup,
  SessionUser,
  Station,
  Vehicle
} from "./types";

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

  /**
   * Generic transport used by the future live client. The mock client rejects
   * it so accidental "live" calls fail loudly instead of silently returning mock data.
   */
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

class MockApiClient implements ApiClient {
  async getSession(): Promise<SessionUser | null> {
    return readPersistedSession();
  }

  // Customer
  async getCustomerTransactions(): Promise<CustomerTransaction[]> {
    return transactionHistory;
  }

  async getMobileHistory(): Promise<MobileTransactionGroup[]> {
    return mobileHistory;
  }

  async getStations(): Promise<Station[]> {
    return stations;
  }

  async getVehicles(): Promise<Vehicle[]> {
    return vehicleRows.map((row) => ({
      plate: row.cells[1],
      model: row.cells[0],
      assignedCard: row.cells[2],
      status: row.status ?? row.cells[3]
    }));
  }

  async getNotifications(): Promise<AppNotification[]> {
    return notifications;
  }

  async getCustomerVehiclePerformance(): Promise<string[][]> {
    return vehicles;
  }

  async getCustomerRecentActivity(): Promise<CustomerTransaction[]> {
    return recentActivity;
  }

  async getCustomerTopUpHistory(): Promise<string[][]> {
    return topUpHistory;
  }

  async getCustomerDesktopTopUps(): Promise<string[][]> {
    return desktopTopUps;
  }

  async getCustomerOverviewMetrics(): Promise<CustomerMetric[]> {
    return customerOverviewMetrics;
  }

  // Company
  async getCompanyVehicles(): Promise<Row[]> {
    return vehicleRows;
  }

  async getCompanyTransactions(): Promise<Row[]> {
    return transactionRows;
  }

  async getCompanyStations(): Promise<string[][]> {
    return companyStations;
  }

  async getCompanyNotifications(): Promise<string[][]> {
    return companyNotifications;
  }

  async getCompanyCards(): Promise<Row[]> {
    return cardRows;
  }

  async getCompanyReportSpend(): Promise<Row[]> {
    return spendRows;
  }

  async getCompanyAssistance(): Promise<Row[]> {
    return assistanceHistory;
  }

  async getCompanyInvoices(): Promise<Row[]> {
    return invoices;
  }

  async getCompanyTeam(): Promise<Row[]> {
    return teamRows;
  }

  async getCompanyTickets(): Promise<Row[]> {
    return tickets;
  }

  async getCompanyMaintenance(): Promise<Row[]> {
    return maintenanceRows;
  }

  async getCompanyOverviewMetrics(): Promise<Metric[]> {
    return companyOverviewMetrics;
  }

  async getCompanyCardMetrics(): Promise<Metric[]> {
    return cardMetrics;
  }

  async getCompanyRecentTransactions(): Promise<Row[]> {
    return recentTransactions;
  }

  // Partner
  async getPartnerOverviewMetrics(): Promise<PartnerMetric[]> {
    return partnerOverviewMetrics;
  }

  async getPartnerQuickStats(): Promise<string[][]> {
    return partnerQuickStats;
  }

  async getPartnerRecentTransactions(): Promise<PartnerTableRow[]> {
    return partnerOverviewTransactions;
  }

  async getPartnerPayouts(): Promise<PartnerTableRow[]> {
    return partnerPayoutRows;
  }

  async getPartnerPrices(): Promise<PartnerTableRow[]> {
    return partnerPriceRows;
  }

  async getPartnerTransactions(): Promise<PartnerTableRow[]> {
    return partnerTransactionRows;
  }

  async getPartnerReports(): Promise<PartnerTableRow[]> {
    return partnerReportRows;
  }

  async getPartnerStaff(): Promise<PartnerTableRow[]> {
    return partnerStaffRows;
  }

  async getPartnerDisputes(): Promise<PartnerTableRow[]> {
    return partnerDisputeRows;
  }

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

  // Admin
  async getAdminCompanyMetrics(): Promise<AdminMetric[]> {
    return adminCompanyMetrics;
  }

  async getAdminCompanyRows(): Promise<AdminRow[]> {
    return adminCompanyRows;
  }

  async getAdminAppMetrics(): Promise<AdminMetric[]> {
    return adminAppMetrics;
  }

  async getAdminAppRows(): Promise<AdminRow[]> {
    return adminAppRows;
  }

  async getAdminReportMetrics(): Promise<AdminMetric[]> {
    return adminReportMetrics;
  }

  async getAdminStationPerformance(): Promise<AdminRow[]> {
    return adminStationRows;
  }

  async getAdminDisputeMetrics(): Promise<AdminMetric[]> {
    return adminDisputeMetrics;
  }

  async getAdminDisputeRows(): Promise<AdminRow[]> {
    return adminDisputeRows;
  }

  async getAdminStaffMetrics(): Promise<AdminMetric[]> {
    return adminStaffMetrics;
  }

  async getAdminStaffRows(): Promise<AdminRow[]> {
    return adminStaffRows;
  }

  async request<T>(_path: string, _init?: RequestInit): Promise<T> {
    throw new Error("Live backend is not wired yet. Resolve via MockApiClient.");
  }
}

function LiveApiClient(_baseUrl: string): ApiClient {
  return {
    async getSession() { throw new Error("LiveApiClient.getSession not implemented"); },
    async getCustomerTransactions() { throw new Error("LiveApiClient.getCustomerTransactions not implemented"); },
    async getMobileHistory() { throw new Error("LiveApiClient.getMobileHistory not implemented"); },
    async getStations() { throw new Error("LiveApiClient.getStations not implemented"); },
    async getVehicles() { throw new Error("LiveApiClient.getVehicles not implemented"); },
    async getNotifications() { throw new Error("LiveApiClient.getNotifications not implemented"); },
    async getCustomerVehiclePerformance() { throw new Error("LiveApiClient.getCustomerVehiclePerformance not implemented"); },
    async getCustomerRecentActivity() { throw new Error("LiveApiClient.getCustomerRecentActivity not implemented"); },
    async getCustomerTopUpHistory() { throw new Error("LiveApiClient.getCustomerTopUpHistory not implemented"); },
    async getCustomerDesktopTopUps() { throw new Error("LiveApiClient.getCustomerDesktopTopUps not implemented"); },
    async getCustomerOverviewMetrics() { throw new Error("LiveApiClient.getCustomerOverviewMetrics not implemented"); },

    async getCompanyVehicles() { throw new Error("LiveApiClient.getCompanyVehicles not implemented"); },
    async getCompanyTransactions() { throw new Error("LiveApiClient.getCompanyTransactions not implemented"); },
    async getCompanyStations() { throw new Error("LiveApiClient.getCompanyStations not implemented"); },
    async getCompanyNotifications() { throw new Error("LiveApiClient.getCompanyNotifications not implemented"); },
    async getCompanyCards() { throw new Error("LiveApiClient.getCompanyCards not implemented"); },
    async getCompanyReportSpend() { throw new Error("LiveApiClient.getCompanyReportSpend not implemented"); },
    async getCompanyAssistance() { throw new Error("LiveApiClient.getCompanyAssistance not implemented"); },
    async getCompanyInvoices() { throw new Error("LiveApiClient.getCompanyInvoices not implemented"); },
    async getCompanyTeam() { throw new Error("LiveApiClient.getCompanyTeam not implemented"); },
    async getCompanyTickets() { throw new Error("LiveApiClient.getCompanyTickets not implemented"); },
    async getCompanyMaintenance() { throw new Error("LiveApiClient.getCompanyMaintenance not implemented"); },
    async getCompanyOverviewMetrics() { throw new Error("LiveApiClient.getCompanyOverviewMetrics not implemented"); },
    async getCompanyCardMetrics() { throw new Error("LiveApiClient.getCompanyCardMetrics not implemented"); },
    async getCompanyRecentTransactions() { throw new Error("LiveApiClient.getCompanyRecentTransactions not implemented"); },

    async getPartnerOverviewMetrics() { throw new Error("LiveApiClient.getPartnerOverviewMetrics not implemented"); },
    async getPartnerQuickStats() { throw new Error("LiveApiClient.getPartnerQuickStats not implemented"); },
    async getPartnerRecentTransactions() { throw new Error("LiveApiClient.getPartnerRecentTransactions not implemented"); },
    async getPartnerPayouts() { throw new Error("LiveApiClient.getPartnerPayouts not implemented"); },
    async getPartnerPrices() { throw new Error("LiveApiClient.getPartnerPrices not implemented"); },
    async getPartnerTransactions() { throw new Error("LiveApiClient.getPartnerTransactions not implemented"); },
    async getPartnerReports() { throw new Error("LiveApiClient.getPartnerReports not implemented"); },
    async getPartnerStaff() { throw new Error("LiveApiClient.getPartnerStaff not implemented"); },
    async getPartnerDisputes() { throw new Error("LiveApiClient.getPartnerDisputes not implemented"); },
    async getPartnerNotifications() { throw new Error("LiveApiClient.getPartnerNotifications not implemented"); },

    async getAdminCompanyMetrics() { throw new Error("LiveApiClient.getAdminCompanyMetrics not implemented"); },
    async getAdminCompanyRows() { throw new Error("LiveApiClient.getAdminCompanyRows not implemented"); },
    async getAdminAppMetrics() { throw new Error("LiveApiClient.getAdminAppMetrics not implemented"); },
    async getAdminAppRows() { throw new Error("LiveApiClient.getAdminAppRows not implemented"); },
    async getAdminReportMetrics() { throw new Error("LiveApiClient.getAdminReportMetrics not implemented"); },
    async getAdminStationPerformance() { throw new Error("LiveApiClient.getAdminStationPerformance not implemented"); },
    async getAdminDisputeMetrics() { throw new Error("LiveApiClient.getAdminDisputeMetrics not implemented"); },
    async getAdminDisputeRows() { throw new Error("LiveApiClient.getAdminDisputeRows not implemented"); },
    async getAdminStaffMetrics() { throw new Error("LiveApiClient.getAdminStaffMetrics not implemented"); },
    async getAdminStaffRows() { throw new Error("LiveApiClient.getAdminStaffRows not implemented"); },

    async request<T>(path: string, init?: RequestInit): Promise<T> {
      const res = await fetch(path, init);
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as T;
    }
  };
}

export type ApiMode = "mock" | "live";

export function createApiClient(mode: ApiMode = "mock", baseUrl = ""): ApiClient {
  return mode === "live" ? LiveApiClient(baseUrl) : new MockApiClient();
}

// Single app-wide client instance. Swap the mode when the backend is ready.
export const api: ApiClient = createApiClient("mock");

export type { ApiResult };
