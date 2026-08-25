// Domain types shared across the frontend.
// These describe the shape the future backend is expected to return.
// They intentionally mirror the mock datasets in `@/lib/mock` so the
// service layer can be swapped from mock -> live without UI changes.

export type UserRole = "customer" | "company" | "partner" | "admin";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  initials: string;
  accountTier: string;
}

export interface CustomerTransaction {
  station: string;
  meta?: string;
  vehicle?: string;
  fuel?: string;
  amount: string;
  time?: string;
}

export interface Station {
  name: string;
  distance: string;
  address: string;
  diesel: string;
  unleaded: string;
  fuels: string[];
  hours: string;
  lat: number;
  lng: number;
}

export interface Vehicle {
  plate: string;
  model: string;
  assignedCard: string;
  status: string;
}

export interface AppNotification {
  group: string;
  title: string;
  time: string;
  body: string;
}

export interface MobileTransactionItem {
  station: string;
  meta: string;
  amount: string;
  time: string;
}

export interface MobileTransactionGroup {
  group: string;
  items: MobileTransactionItem[];
}

export type CompanyStationRow = [string, string, string, string, string];
export type CompanyNotificationRow = [string, string, string, string, string?];

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface ApiResult<T> {
  status: AsyncStatus;
  data: T | null;
  error: string | null;
}
