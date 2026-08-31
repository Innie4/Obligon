export type DashboardPageKey =
  | "overview"
  | "settlements"
  | "station"
  | "pricing"
  | "transactions"
  | "reports"
  | "staff"
  | "verification"
  | "disputes"
  | "notifications"
  | "settings"
  | "pos"
  | "profile";

export type DashboardIcon =
  | "overview"
  | "wallet"
  | "station"
  | "pricing"
  | "transactions"
  | "reports"
  | "staff"
  | "pos"
  | "support"
  | "bell"
  | "settings";

export type StatusTone = "success" | "pending" | "failed" | "info" | "neutral";

export type Metric = {
  label: string;
  value: string;
  delta?: string;
  helper?: string;
  tone?: StatusTone;
};

export type TableRow = {
  cells: string[];
  status?: string;
  tone?: StatusTone;
  action?: string;
};

export type DashboardPageCopy = {
  key: DashboardPageKey;
  title: string;
  kicker?: string;
  description?: string;
  primaryAction?: string;
  tabs?: string[];
  searchPlaceholder?: string;
  userName?: string;
  userRole?: string;
};

export const dashboardNav: Array<{ key: DashboardPageKey; label: string; href: string; icon: DashboardIcon }> = [
  { key: "overview", label: "Dashboard", href: "/dashboard", icon: "overview" },
  { key: "transactions", label: "Transactions", href: "/dashboard/transactions", icon: "transactions" },
  { key: "station", label: "Fuel Stations", href: "/dashboard/station-profile", icon: "station" },
  { key: "reports", label: "Analytics", href: "/dashboard/reports", icon: "reports" },
  { key: "settlements", label: "Partners", href: "/dashboard/settlements", icon: "wallet" },
  { key: "pricing", label: "Fuel Pricing", href: "/dashboard/fuel-pricing", icon: "pricing" },
  { key: "staff", label: "Staff Management", href: "/dashboard/staff", icon: "staff" },
  { key: "verification", label: "Card Verification POS", href: "/dashboard/card-verification", icon: "pos" },
  { key: "disputes", label: "Disputes & Support", href: "/dashboard/disputes", icon: "support" },
  { key: "notifications", label: "Notifications", href: "/dashboard/notifications", icon: "bell" },
  { key: "settings", label: "System Settings", href: "/dashboard/settings", icon: "settings" }
];

export const pageCopy: Record<DashboardPageKey, DashboardPageCopy> = {
  overview: {
    key: "overview",
    title: "Enterprise Overview",
    kicker: "SYSTEM OPERATIONAL",
    description: "Real-time performance metrics for Nigerian logistics clusters.",
    primaryAction: "Add Partner",
    searchPlaceholder: "Search transactions, stations...",
    userName: "AB",
    userRole: "Admin"
  },
  settlements: {
    key: "settlements",
    title: "Settlements & Payouts",
    description: "Manage your enterprise capital velocity. Track, request, and audit your payout history in real-time.",
    primaryAction: "Request Payout",
    searchPlaceholder: "Search payouts, invoices, or fleets...",
    userName: "Olusola Adeyemi",
    userRole: "FLEET DIRECTOR"
  },
  station: {
    key: "station",
    title: "Station Profile",
    kicker: "SYNCING TERMINAL DATA...",
    description: "Last updated: 2 mins ago",
    primaryAction: "Save Changes",
    tabs: ["Overview", "Fueling Logs", "Equipment"],
    searchPlaceholder: "Search station records...",
    userName: "Adewale Oke",
    userRole: "OPERATIONS LEAD"
  },
  pricing: {
    key: "pricing",
    title: "Fuel Market Pricing",
    kicker: "PRICING OPERATIONS",
    description: "Last update: Oct 24, 2023 · 09:12 AM",
    primaryAction: "Update Prices",
    tabs: ["Overview", "Inventory", "Invoices"],
    searchPlaceholder: "Search fuel, depot, or audit logs...",
    userName: "Pricing Desk",
    userRole: "NETWORK SYNC"
  },
  transactions: {
    key: "transactions",
    title: "Transactions",
    primaryAction: "Add Partner",
    tabs: ["Overview", "Inventory", "Fleet", "Invoices"],
    searchPlaceholder: "SEARCH TRANSACTIONS...",
    userName: "Chidi Okoro",
    userRole: "OPERATIONS"
  },
  reports: {
    key: "reports",
    title: "Analytics",
    primaryAction: "EXPORT REPORT",
    searchPlaceholder: "Search account...",
    userName: "Reports",
    userRole: "ANALYTICS"
  },
  staff: {
    key: "staff",
    title: "Staff Management",
    description: "Manage your station attendants and digital payment permissions.",
    primaryAction: "Add Staff Member",
    tabs: ["Overview", "Inventory", "Fleet", "Invoices"],
    searchPlaceholder: "Search staff...",
    userName: "Partners",
    userRole: "ADMIN"
  },
  verification: {
    key: "verification",
    title: "Card Verification",
    description: "Enter the 6-digit terminal authorization code or tap card to scan.",
    primaryAction: "Verify Transaction",
    searchPlaceholder: "Search fleet or driver...",
    userName: "Terminal 082",
    userRole: "LAGOS CENTRAL"
  },
  disputes: {
    key: "disputes",
    title: "Disputes & Support",
    description: "Manage partner inquiries and resolve billing or operational discrepancies.",
    primaryAction: "Raise a Dispute",
    searchPlaceholder: "Search tickets...",
    userName: "Adebayo Chen",
    userRole: "FLEET PARTNER"
  },
  notifications: {
    key: "notifications",
    title: "System Notifications",
    kicker: "ADMIN NOTIFICATIONS",
    description: "Manage real-time alerts for finance, support, security, and platform updates.",
    primaryAction: "Mark all as read",
    searchPlaceholder: "Search operations...",
    userName: "Adeola Johnson",
    userRole: "FLEET MANAGER"
  },
  settings: {
    key: "settings",
    title: "System Configuration",
    description: "Manage your station credentials, security protocols, and enterprise notification rules.",
    primaryAction: "Save Changes",
    tabs: ["Account Details", "Security", "Notification Preferences"],
    searchPlaceholder: "Search settings...",
    userName: "Chidi Okoro",
    userRole: "ADMIN"
  },
  pos: {
    key: "pos",
    title: "POS Authorization Terminal",
    description: "Authorize driver transactions using one-time verification codes or NFC tap.",
    primaryAction: "Authorize Code",
    searchPlaceholder: "Enter 6-digit OTC code...",
    userName: "POS Operator",
    userRole: "TERMINAL"
  },
  profile: {
    key: "profile",
    title: "Station Profile & Amenities",
    description: "Configure station locator listing, amenities, and manager contacts.",
    primaryAction: "Save Profile",
    searchPlaceholder: "Search station attributes...",
    userName: "Station Manager",
    userRole: "PARTNER"
  }
};

export const overviewMetrics: Metric[] = [
  { label: "TODAY'S TRANSACTIONS", value: "4,892", delta: "12.4%", tone: "success" },
  { label: "TODAY'S REVENUE", value: "₦14,250,800.00", delta: "8.1%", helper: "ESTIMATED NET MARGIN: 12.5%", tone: "success" },
  { label: "PENDING SETTLEMENTS", value: "₦3,120,440.00", helper: "Processing Cluster 04...", tone: "pending" }
];

export const quickStats = [
  ["All-time Transactions", "1.2M+"],
  ["Active Cards", "12,450"],
  ["Partner Stations", "850"],
  ["Verified Partners", "142"]
];

export const overviewTransactions: TableRow[] = [
  { cells: ["TXN-902341", "Oando Ikorodu", "CLUSTER A4", "₦145,000.00", "14:22:01"], status: "SUCCESS", tone: "success" },
  { cells: ["TXN-902342", "TotalEnergies Lekki", "CLUSTER L2", "₦82,400.00", "14:18:45"], status: "SUCCESS", tone: "success" },
  { cells: ["TXN-902343", "Conoil Victoria Island", "CLUSTER L1", "₦320,000.00", "14:12:30"], status: "PENDING", tone: "pending" }
];

export const payoutRows: TableRow[] = [
  { cells: ["#PY-99201-NX", "Oct 24, 2023 • 14:32", "₦4,500,000.00", "Direct Bank"], status: "SUCCESS", tone: "success" },
  { cells: ["#PY-99205-NX", "Oct 25, 2023 • 09:15", "₦12,250,000.00", "Direct Bank"], status: "PENDING", tone: "pending" },
  { cells: ["#PY-99188-NX", "Oct 23, 2023 • 11:45", "₦1,100,000.00", "Direct Bank"], status: "FAILED", tone: "failed", action: "RETRY" },
  { cells: ["#PY-99172-NX", "Oct 21, 2023 • 16:20", "₦8,900,000.00", "Direct Bank"], status: "SUCCESS", tone: "success" }
];

export const priceRows: TableRow[] = [
  { cells: ["Oct 24, 2023 · 09:12", "PMS", "₦615.00", "₦617.00", "+0.32"], status: "APPLIED", tone: "success" },
  { cells: ["Oct 22, 2023 · 13:30", "AGO", "₦1065.00", "₦1050.00", "-1.41"], status: "APPLIED", tone: "success" },
  { cells: ["Oct 20, 2023 · 16:05", "LPG", "₦1180.00", "₦1200.00", "+1.69"], status: "APPLIED", tone: "success" },
  { cells: ["Oct 18, 2023 · 10:44", "DPK", "₦845.00", "₦850.00", "+0.59"], status: "APPLIED", tone: "success" }
];

export const transactionRows: TableRow[] = [
  { cells: ["24 Oct, 2023 08:45 AM", "Swift Logistics Ltd\nFleet ID #SL-9902", "****8901", "154,200.00"], status: "SUCCESS", tone: "success" },
  { cells: ["24 Oct, 2023 08:42 AM", "Dangote Cement\nFleet ID #DC-5412", "****4220", "1,240,500.00"], status: "SUCCESS", tone: "success" },
  { cells: ["24 Oct, 2023 08:12 AM", "Redline Express\nFleet ID #RE-1102", "****3100", "45,000.00"], status: "FAILED", tone: "failed" },
  { cells: ["24 Oct, 2023 07:58 AM", "Peace Mass Transit\nFleet ID #PM-8821", "****5521", "280,000.00"], status: "PENDING", tone: "pending" }
];

export const reportRows: TableRow[] = [
  { cells: ["Dangote Logistics\n#LG-4402", "Lagos-Kano", "42102.50", "35450112"], status: "ACTIVE", tone: "success" },
  { cells: ["Julius Berger\n#ABJ-9921", "Abuja Metropolitan", "38500", "32410200"], status: "ACTIVE", tone: "success" },
  { cells: ["Maersk Nigeria\n#PH-1102", "Port Harcourt Port", "12400.12", "10442100"], status: "PENDING", tone: "pending" },
  { cells: ["GIG Logistics\n#EDO-7733", "Benin-Onitsha", "9105.45", "7667500"], status: "ACTIVE", tone: "success" }
];

export const staffRows: TableRow[] = [
  { cells: ["#ST-8821", "BO\nBabatunde Olumide\n+234 801 239 8812", "Senior Attendant", "Enabled"], status: "ACTIVE", tone: "success" },
  { cells: ["#ST-8822", "CA\nChisom Adebayo\n+234 802 555 1400", "Pump Operator", "Enabled"], status: "ACTIVE", tone: "success" },
  { cells: ["#ST-8845", "EN\nEmeka Nwosu\n+234 809 331 2921", "Shift Lead", "Disabled"], status: "INACTIVE", tone: "neutral" },
  { cells: ["#ST-8901", "YI\nYusuf Ibrahim\n+234 803 654 0021", "Night Supervisor", "Enabled"], status: "ACTIVE", tone: "success" }
];

export const disputeRows: TableRow[] = [
  { cells: ["#DS-90214", "Incorrect Fueling Charge\nLagos VI Station - Pump #4", "Billing"], status: "PENDING", tone: "pending", action: "View Details" },
  { cells: ["#DS-89920", "Wallet Sync Delay", "Technical"], status: "UNDER REVIEW", tone: "info", action: "View Details" },
  { cells: ["#DS-89844", "Fleet Card Activation", "Operations"], status: "RESOLVED", tone: "success", action: "View Details" },
  { cells: ["#DS-89771", "Invoice Discrepancy", "Billing"], status: "PENDING", tone: "pending", action: "View Details" },
  { cells: ["#DS-89602", "System Access Issue", "Technical"], status: "RESOLVED", tone: "success", action: "View Details" }
];

export const notificationGroups = [
  {
    label: "TODAY",
    items: [
      ["New Transaction Received", "09:42 AM", "A new fleet transaction was authorized at Oando Ikorodu for ₦145,000.00."],
      ["Payout Successful", "08:15 AM", "Your settlement payout of ₦4,500,000.00 was deposited into Zenith Bank PLC."]
    ]
  },
  {
    label: "YESTERDAY",
    items: [
      ["Support Ticket Update", "OCT 24, 4:50 PM", "Dispute #DS-89844 was marked resolved by support operations."],
      ["New Platform Announcement", "OCT 24, 11:30 AM", "Bulk fuel-card activation is now available for verified partners."]
    ]
  },
  {
    label: "EARLIER THIS WEEK",
    items: [["Security Alert: Password Changed", "OCT 22, 09:12 AM", "Your account password was changed from a recognized admin device."]]
  }
];

