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

export type CardRequestStatus =
  | "awaiting_payment"
  | "pending"
  | "pending_verification"
  | "approved"
  | "rejected"
  | "cancelled";

export interface CardPlanFeature {
  label: string;
  /** "included" | "Advanced" | "Premium" | a percentage such as "25%". */
  state: string;
}

export interface CardPlan {
  code: string;
  name: string;
  amountKobo: number;
  amountLabel: string;
  interval: string;
  blurb: string;
  features: CardPlanFeature[];
}

export type PaymentProviderId = "paystack" | "flutterwave";

/** Normalised result of starting a hosted checkout, whichever provider ran it. */
export interface CheckoutResult {
  ok: boolean;
  reference: string;
  provider: PaymentProviderId;
  paymentUrl: string | null;
  simulated: boolean;
  message?: string;
}

export interface CardRequest {
  id: string;
  label: string;
  status: CardRequestStatus;
  planCode: string | null;
  planName: string | null;
  planAmountLabel: string | null;
  paymentStatus: "unpaid" | "paid" | "failed" | "refunded";
  paymentReference: string | null;
  paidAt: string | null;
  fullName: string | null;
  bvnLastFour: string | null;
  verificationStatus: "not_started" | "pending" | "verified" | "rejected";
  verificationEta: string | null;
  requestedAt: string;
}

export interface CardCheckout {
  ok: boolean;
  reference: string;
  provider: PaymentProviderId;
  paymentUrl: string | null;
  simulated: boolean;
  message: string;
  request: CardRequest;
}

/**
 * The customer's in-flight card request, if any.
 *
 * Checkout answers 409 when one already exists, which on its own is a dead end.
 * These flags tell the client which ways out are actually available: an unpaid
 * request can be resumed or cancelled, and a paid one can be withdrawn for a
 * refund. Offering the wrong one would either re-charge a paid plan or strand
 * money that was already taken.
 */
export interface OpenCardRequest {
  request: CardRequest | null;
  reference?: string | null;
  canResume: boolean;
  canCancel: boolean;
  canWithdraw: boolean;
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
