// Domain types shared across the frontend.
// These describe the shape the future backend is expected to return.
// They intentionally mirror the mock datasets in `@/lib/mock` so the
// service layer can be swapped from mock -> live without UI changes.

export type UserRole = "customer" | "company" | "partner" | "mechanic" | "admin";

/**
 * Notification channel switches, mirrored from the `users.notification_prefs`
 * JSONB column. `notify.js` on the API reads exactly these keys, so the UI must
 * not invent its own names here.
 */
export interface NotificationPrefs {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  categories: Record<string, boolean>;
}

export interface CustomerProfile {
  user: SessionUser & { notificationPrefs?: NotificationPrefs; city?: string; emailVerified?: boolean; phoneVerified?: boolean };
  wallet: { balanceLabel: string; budgetLimitKobo: number | null };
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  initials: string;
  accountTier: string;
  phone?: string;
  address?: string;
  twoFactorEnabled?: boolean;
  biometricsEnabled?: boolean;
  notificationPrefs?: NotificationPrefs;
}

export interface CustomerTransaction {
  station: string;
  meta?: string;
  vehicle?: string;
  fuel?: string;
  amount: string;
  time?: string;
  reference?: string;
  status?: string;
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
  id?: string;
  group: string;
  title: string;
  time: string;
  body: string;
  read?: boolean;
  actionRequired?: boolean;
  link?: string;
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
