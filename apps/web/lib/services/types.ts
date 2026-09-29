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
/**
 * Real progress through a card request.
 *
 * "View verification status" used to open a dialog describing the three things
 * that happen next, which told the customer nothing about where they actually
 * were. Each step's state is derived on the server from the records that exist,
 * so the tracker cannot drift from the data: `done` only once the thing it
 * describes has happened, and a request that ends short is reported as failed
 * rather than showing a spinner that will never resolve.
 */
/**
 * Who bears the processor's fee.
 *
 * `platform` means Obligon absorbs it and the customer is charged the price.
 * `customer` means the fee is added to the amount demanded, so it has to be shown
 * itemised before the customer authorises rather than appearing as a surprise on
 * a statement afterwards.
 */
export interface PaymentFeeSchedule {
  bearer: "customer" | "platform";
  basisPoints: number;
  percent: number;
}

export interface PaymentConfig {
  provider: string | null;
  simulated: boolean;
  publicKeys: { paystack: string | null; flutterwave: string | null };
  fee: PaymentFeeSchedule;
  /**
   * Smallest top-up the API will accept, in kobo.
   *
   * Read from the server rather than restated in the client: the two copies used
   * to disagree, so a customer could be shown a Pay button the API rejected.
   */
  minimumTopupKobo: number;
  misconfigured?: boolean;
  missing?: string[];
}

export type ProgressStepState = "done" | "active" | "waiting" | "failed";

export interface CardProgressStep {
  key: "plan" | "payment" | "details" | "verification" | "card";
  label: string;
  description: string;
  state: ProgressStepState;
  at: string | null;
  eta?: string | null;
}

export type CardProgressOutcome =
  | "in_progress"
  | "complete"
  | "awaiting_payment"
  | "rejected"
  | "abandoned";

export interface CardRequestProgress {
  request: CardRequest | null;
  planName: string | null;
  planAmountLabel: string | null;
  steps: CardProgressStep[];
  outcome: CardProgressOutcome;
  /** The one thing waiting on the customer, or null when nothing is. */
  nextAction: string | null;
  progressPercent: number;
  completedSteps: number;
  totalSteps: number;
  currentStepIndex: number;
  card: { label: string; maskedPan: string; expiry: string; status: string; issuedAt: string | null } | null;
}

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

/**
 * One entry in the dashboard's recent-activity feed.
 *
 * Deliberately not `CustomerTransaction`. The feed merges two kinds of event —
 * a fuel transaction and an account notification — and a notification has no
 * station, no litres and no amount. Reusing the transaction shape would have
 * forced a fabricated "₦0.00" beside "Card issued", which is worse than showing
 * nothing there.
 */
export interface CustomerActivityItem {
  id: string;
  kind: "transaction" | "notification";
  title: string;
  subtitle?: string;
  /** Null for a notification, which is not a monetary event. */
  amount: string | null;
  time?: string;
  reference?: string | null;
  status?: string | null;
  link: string;
}

/**
 * What the customer expects to spend this calendar month, which the MTD Spend
 * card measures their actual spend against.
 *
 * `needsProjection` is true for a brand-new account and true again on the first
 * of each month: in both cases there is no answer for the month in progress.
 */
export interface CustomerSpendProjection {
  /**
   * The month this is about, `YYYY-MM`. Always present, whether or not a figure
   * has been set: it is the key a client uses to remember it has already asked
   * this month, so returning null for an unset month would make "already asked"
   * indistinguishable from "not yet asked".
   */
  month: string | null;
  projectedKobo: number | null;
  projectedLabel: string | null;
  needsProjection: boolean;
  mtdKobo: number;
  usagePercent: number | null;
  remainingKobo: number | null;
  remainingLabel: string | null;
  updatedAt?: string | null;
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
