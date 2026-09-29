// `CustomerTransaction` is declared locally below, so it is not imported here.
import type { CustomerActivityItem, SessionUser } from "@/lib/services/types";

export const sessionUser: SessionUser = {
  id: "usr_demo_001",
  name: "Fleet Manager",
  email: "manager@obligon.enterprise.com",
  role: "customer",
  organization: "Obligon LTD Enterprise",
  initials: "FM",
  accountTier: "Premium Account"
};

export type CustomerPageKey =
  | "overview"
  | "transactions"
  | "card"
  | "wallet"
  | "stations"
  | "support"
  | "transactionDetail"
  | "reportProblem"
  | "profile"
  | "notifications";

export type CustomerTone = "green" | "blue" | "red" | "amber" | "muted" | "dark";

export type CustomerNavItem = {
  key: CustomerPageKey;
  label: string;
  href: string;
};

export type CustomerMetric = {
  label: string;
  value: string;
  helper?: string;
  tone?: CustomerTone;
};

export type CustomerTransaction = {
  station: string;
  meta: string;
  amount: string;
  time?: string;
  fuel?: string;
  vehicle?: string;
  reference?: string;
};

export const customerNav: CustomerNavItem[] = [
  { key: "overview", label: "Overview", href: "/customer" },
  { key: "card", label: "My Card", href: "/customer/card" },
  { key: "transactions", label: "History", href: "/customer/transactions" },
  { key: "stations", label: "Stations", href: "/customer/stations" },
  { key: "support", label: "Support", href: "/customer/support" }
];

export const secondaryCustomerNav: CustomerNavItem[] = [
  { key: "wallet", label: "Wallet & Top Up", href: "/customer/wallet" },
  { key: "notifications", label: "Notifications", href: "/customer/notifications" },
  { key: "profile", label: "Profile Settings", href: "/customer/profile" }
];

export const pageTitles: Record<CustomerPageKey, string> = {
  overview: "Dashboard Overview",
  transactions: "Transaction History",
  card: "My Card",
  wallet: "Wallet Management",
  stations: "Nearby Stations",
  support: "Support Center",
  transactionDetail: "Transaction Detail",
  reportProblem: "Report a Problem",
  profile: "Profile and Settings",
  notifications: "Notifications"
};

export const overviewMetrics: CustomerMetric[] = [
  { label: "Total Account Balance", value: "₦485,000" },
  { label: "MTD Spend", value: "₦215,600", helper: "1,245 L · 87 transactions this month", tone: "red" },
  { label: "Budget Usage", value: "43%", helper: "₦500,000.00 projected", tone: "green" },
  { label: "Projected Spend", value: "₦500,000.00", helper: "Tap to change", tone: "blue" },
  { label: "Litres Consumed", value: "1,245 L", tone: "green" },
  { label: "Transactions", value: "87", tone: "blue" },
  { label: "Security Status", value: "2 Alerts", helper: "1 Blocked | 0 Suspicious", tone: "red" },
  { label: "MTD Savings", value: "₦18,450.00", helper: "vs median price at the time", tone: "green" },
  { label: "Lifetime Savings", value: "₦245,780.00", helper: "Based on 1,102 transactions", tone: "green" }
];

/** Mirrors the shape `/api/customer/spend-projection` returns. */
export const spendProjection = {
  month: "2026-09",
  projectedKobo: 50_000_000,
  projectedLabel: "₦500,000.00",
  needsProjection: false,
  mtdKobo: 21_560_000,
  usagePercent: 43,
  remainingKobo: 28_440_000,
  remainingLabel: "₦284,400.00"
};

export const vehicles = [
  ["FV-001", "₦185,000", "180L", "92%"],
  ["FV-002", "₦164,000", "162L", "88%"],
  ["FV-003", "₦211,000", "220L", "76%"]
];

// Mirrors the merged `/api/customer/overview` feed: transactions and account
// notifications in one timeline, newest first. A notification carries no amount,
// because it is not a monetary event.
export const recentActivity: CustomerActivityItem[] = [
  { id: "act_1", kind: "transaction", title: "Station A", subtitle: "FV-001 • 45L", amount: "₦46,125", time: "Today, 14:23", reference: "TRX-DEMO1", status: "success", link: "/customer/transactions" },
  { id: "act_2", kind: "notification", title: "Top-up credited", subtitle: "Success: ₦50,000.00 added to your wallet.", amount: null, time: "Today, 09:02", reference: null, status: null, link: "/customer/wallet" },
  { id: "act_3", kind: "transaction", title: "Station B", subtitle: "FV-003 • 60L", amount: "₦61,500", time: "Yesterday, 09:15", reference: "TRX-DEMO2", status: "success", link: "/customer/transactions" },
  { id: "act_4", kind: "notification", title: "Card issued", subtitle: "Your virtual card is active and ready to use.", amount: null, time: "Oct 24, 16:20", reference: null, status: null, link: "/customer/card" }
];

export const transactionHistory: CustomerTransaction[] = [
  { station: "Central Hub Station", meta: "Downtown Ave", vehicle: "FLT-8492", fuel: "Premium Diesel", amount: "₦145.20", time: "Oct 24, 14:32" },
  { station: "Highway Stop 42", meta: "Route 66", vehicle: "FLT-3310", fuel: "Regular Unleaded", amount: "₦89.50", time: "Oct 24, 09:15" },
  { station: "Northside Depot", meta: "Industrial Park", vehicle: "FLT-8492", fuel: "Premium Diesel", amount: "₦210.00", time: "Oct 23, 16:45" },
  { station: "East Valley Gas", meta: "Valley Road", vehicle: "FLT-5521", fuel: "EV Fast Charge", amount: "₦32.80", time: "Oct 23, 11:20" },
  { station: "Central Hub Station", meta: "Downtown Ave", vehicle: "FLT-1198", fuel: "Premium Diesel", amount: "₦175.40", time: "Oct 22, 08:30" }
];

export const mobileHistory = [
  { group: "Today", items: [
    { station: "Station #4092 - City Center", meta: "Vehicle: TRK-084 • Diesel", amount: "-₦145.20", time: "10:42 AM" },
    { station: "Partner EV Hub West", meta: "Vehicle: VAN-012 • Charge", amount: "-₦32.50", time: "08:15 AM" }
  ] },
  { group: "Yesterday", items: [
    { station: "Station #2105 - Highway 1", meta: "Vehicle: TRK-092 • Diesel", amount: "-₦210.85", time: "04:30 PM" },
    { station: "Fleet Maintenance Depot", meta: "Vehicle: LGT-045 • Service", amount: "-₦85.00", time: "11:00 AM" },
    { station: "Station #1022 - Northside", meta: "Vehicle: TRK-084 • Diesel", amount: "-₦120.40", time: "07:45 AM" }
  ] }
];

export const topUpHistory = [
  ["Main Operating Acct", "Oct 24, 2023", "+ ₦50,000"],
  ["Personal Card •••• 4242", "Oct 18, 2023", "+ ₦25,000"],
  ["Main Operating Acct", "Oct 02, 2023", "+ ₦100,000"]
];

export const desktopTopUps = [
  ["Oct 24, 2023", "TRX-8924-A", "Bank Transfer", "+₦10,000.00"],
  ["Oct 12, 2023", "TRX-7712-B", "Corporate Card **4421", "+₦5,000.00"],
  ["Sep 28, 2023", "TRX-6509-C", "Bank Transfer", "+₦15,000.00"]
];

export const stations = [
  {
    name: "Obligon LTD Core Hub",
    distance: "0.8 mi",
    address: "120 Financial District Blvd, NY",
    diesel: "₦4.12",
    unleaded: "₦3.89",
    fuels: ["PMS Petrol", "AGO Diesel"],
    hours: "Open 24/7",
    lat: 40.7075,
    lng: -74.0113
  },
  {
    name: "Metro Transit Station",
    distance: "1.2 mi",
    address: "45 Commerce Street, NY",
    diesel: "₦4.15",
    unleaded: "₦3.95",
    fuels: ["PMS Petrol", "AGO Diesel", "LPG Gas"],
    hours: "Open 24/7",
    lat: 40.7128,
    lng: -74.008
  },
  {
    name: "Express Fueling",
    distance: "2.4 mi",
    address: "88 Industrial Parkway, NY",
    diesel: "₦4.09",
    unleaded: "₦3.85",
    fuels: ["PMS Petrol", "AGO Diesel"],
    hours: "06:00 - 23:00",
    lat: 40.742,
    lng: -73.99
  }
];

export const notifications = [
  { group: "TODAY", title: "Transaction Alert", time: "2h ago", body: "Success: $500.00 added to your wallet." },
  { group: "TODAY", title: "Station Update", time: "4h ago", body: "New Obligon LTD Core Hub opened 2 miles from your current route." },
  { group: "YESTERDAY", title: "Security Alert", time: "10:15 AM", body: "New login detected from a Chrome browser in New York." },
  { group: "OLDER", title: "System Update", time: "Oct 12", body: "Platform maintenance scheduled for Sunday at 2:00 AM EST." }
];

