// Service-client layer (integration seam).
//
// The UI should depend ONLY on the `ApiClient` interface below, never on a
// concrete transport. Today a `MockApiClient` returns the isolated datasets in
// `@/lib/mock`. When a real backend exists, implement `ApiClient` with `fetch`
// (see `LiveApiClient` stub) and call `createApiClient("live")`.
//
// No real endpoints are wired yet — this is the boundary for future backend work.

import {
  sessionUser,
  transactionHistory,
  stations,
  notifications,
  mobileHistory,
  recentActivity,
  vehicles,
  topUpHistory,
  desktopTopUps
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
  overviewMetrics,
  cardMetrics,
  recentTransactions
} from "@/lib/mock/company-data";
import type { Metric, Row } from "@/lib/mock/company-data";

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
  getCustomerTransactions(): Promise<CustomerTransaction[]>;
  getMobileHistory(): Promise<MobileTransactionGroup[]>;
  getStations(): Promise<Station[]>;
  getVehicles(): Promise<Vehicle[]>;
  getNotifications(): Promise<AppNotification[]>;
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
  getCustomerVehiclePerformance(): Promise<string[][]>;
  getCustomerRecentActivity(): Promise<CustomerTransaction[]>;
  getCustomerTopUpHistory(): Promise<string[][]>;
  getCustomerDesktopTopUps(): Promise<string[][]>;

  /**
   * Generic transport used by the future live client. The mock client rejects
   * it so accidental "live" calls fail loudly instead of silently returning mock data.
   */
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

class MockApiClient implements ApiClient {
  async getSession(): Promise<SessionUser | null> {
    return sessionUser;
  }

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
    return overviewMetrics;
  }

  async getCompanyCardMetrics(): Promise<Metric[]> {
    return cardMetrics;
  }

  async getCompanyRecentTransactions(): Promise<Row[]> {
    return recentTransactions;
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

  async request<T>(_path: string, _init?: RequestInit): Promise<T> {
    throw new Error("Live backend is not wired yet. Resolve via MockApiClient.");
  }
}

function LiveApiClient(_baseUrl: string): ApiClient {
  return {
    async getSession() {
      throw new Error("LiveApiClient.getSession not implemented");
    },
    async getCustomerTransactions() {
      throw new Error("LiveApiClient.getCustomerTransactions not implemented");
    },
    async getMobileHistory() {
      throw new Error("LiveApiClient.getMobileHistory not implemented");
    },
    async getStations() {
      throw new Error("LiveApiClient.getStations not implemented");
    },
    async getVehicles() {
      throw new Error("LiveApiClient.getVehicles not implemented");
    },
    async getNotifications() {
      throw new Error("LiveApiClient.getNotifications not implemented");
    },
    async getCompanyVehicles() {
      throw new Error("LiveApiClient.getCompanyVehicles not implemented");
    },
    async getCompanyTransactions() {
      throw new Error("LiveApiClient.getCompanyTransactions not implemented");
    },
    async getCompanyStations() {
      throw new Error("LiveApiClient.getCompanyStations not implemented");
    },
    async getCompanyNotifications() {
      throw new Error("LiveApiClient.getCompanyNotifications not implemented");
    },
    async getCompanyCards() {
      throw new Error("LiveApiClient.getCompanyCards not implemented");
    },
    async getCompanyReportSpend() {
      throw new Error("LiveApiClient.getCompanyReportSpend not implemented");
    },
    async getCompanyAssistance() {
      throw new Error("LiveApiClient.getCompanyAssistance not implemented");
    },
    async getCompanyInvoices() {
      throw new Error("LiveApiClient.getCompanyInvoices not implemented");
    },
    async getCompanyTeam() {
      throw new Error("LiveApiClient.getCompanyTeam not implemented");
    },
    async getCompanyTickets() {
      throw new Error("LiveApiClient.getCompanyTickets not implemented");
    },
    async getCompanyMaintenance() {
      throw new Error("LiveApiClient.getCompanyMaintenance not implemented");
    },
    async getCompanyOverviewMetrics() {
      throw new Error("LiveApiClient.getCompanyOverviewMetrics not implemented");
    },
    async getCompanyCardMetrics() {
      throw new Error("LiveApiClient.getCompanyCardMetrics not implemented");
    },
    async getCompanyRecentTransactions() {
      throw new Error("LiveApiClient.getCompanyRecentTransactions not implemented");
    },
    async getCustomerVehiclePerformance() {
      throw new Error("LiveApiClient.getCustomerVehiclePerformance not implemented");
    },
    async getCustomerRecentActivity() {
      throw new Error("LiveApiClient.getCustomerRecentActivity not implemented");
    },
    async getCustomerTopUpHistory() {
      throw new Error("LiveApiClient.getCustomerTopUpHistory not implemented");
    },
    async getCustomerDesktopTopUps() {
      throw new Error("LiveApiClient.getCustomerDesktopTopUps not implemented");
    },
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
