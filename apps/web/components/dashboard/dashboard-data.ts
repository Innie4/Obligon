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
  | "settings";

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

export type DashboardStat = {
  label: string;
  value: string;
  delta: string;
  tone?: "green" | "blue" | "amber" | "red";
};

export type DashboardRow = {
  id: string;
  primary: string;
  secondary: string;
  amount: string;
  status: "Live" | "Pending" | "Paid" | "Flagged" | "Open" | "Resolved" | "Active" | "Draft";
  meta: string;
};

export type DashboardPanel = {
  title: string;
  body: string;
  value?: string;
  items?: string[];
};

export type DashboardPageData = {
  key: DashboardPageKey;
  title: string;
  kicker: string;
  description: string;
  primaryAction: string;
  modalTitle: string;
  modalBody: string;
  stats: DashboardStat[];
  panels: DashboardPanel[];
  tableTitle: string;
  rows: DashboardRow[];
  filters: string[];
};

export const dashboardNav: Array<{ key: DashboardPageKey; label: string; href: string; icon: DashboardIcon }> = [
  { key: "overview", label: "Overview", href: "/dashboard", icon: "overview" },
  { key: "settlements", label: "Settlements & Payouts", href: "/dashboard/settlements", icon: "wallet" },
  { key: "station", label: "Station Profile", href: "/dashboard/station-profile", icon: "station" },
  { key: "pricing", label: "Fuel Pricing", href: "/dashboard/fuel-pricing", icon: "pricing" },
  { key: "transactions", label: "Transactions", href: "/dashboard/transactions", icon: "transactions" },
  { key: "reports", label: "Reports & Analytics", href: "/dashboard/reports", icon: "reports" },
  { key: "staff", label: "Staff Management", href: "/dashboard/staff", icon: "staff" },
  { key: "verification", label: "Card Verification POS", href: "/dashboard/card-verification", icon: "pos" },
  { key: "disputes", label: "Disputes & Support", href: "/dashboard/disputes", icon: "support" },
  { key: "notifications", label: "Notifications", href: "/dashboard/notifications", icon: "bell" },
  { key: "settings", label: "Settings", href: "/dashboard/settings", icon: "settings" }
];

const commonRows: DashboardRow[] = [
  {
    id: "TX-23891",
    primary: "PMS sale - Zenith Logistics",
    secondary: "Pump 03 / Attendant: Efe",
    amount: "₦482,000",
    status: "Live",
    meta: "Today, 10:24 AM"
  },
  {
    id: "TX-23876",
    primary: "AGO bulk dispense",
    secondary: "Bay 02 / Card ending 4492",
    amount: "₦1,240,000",
    status: "Paid",
    meta: "Today, 8:15 AM"
  },
  {
    id: "TX-23811",
    primary: "Manual review hold",
    secondary: "Location mismatch detected",
    amount: "₦186,500",
    status: "Flagged",
    meta: "Yesterday"
  }
];

export const dashboardPages: Record<DashboardPageKey, DashboardPageData> = {
  overview: {
    key: "overview",
    title: "Partnership Overview",
    kicker: "Retail Partner Command Center",
    description: "Monitor station health, volume, settlement readiness, dispute pressure, and live customer activity from one control surface.",
    primaryAction: "Request Settlement",
    modalTitle: "Request Settlement",
    modalBody: "Create a payout request for cleared transactions. Finance will reconcile and confirm your linked corporate account.",
    stats: [
      { label: "Today Revenue", value: "₦7.84M", delta: "+18.4%", tone: "green" },
      { label: "Fuel Volume", value: "42,810L", delta: "+6.2%", tone: "blue" },
      { label: "Pending Payout", value: "₦2.16M", delta: "Next batch", tone: "amber" },
      { label: "Open Disputes", value: "4", delta: "-2 this week", tone: "green" }
    ],
    panels: [
      { title: "Station Status", value: "Verified", body: "Mainland Energy Station is active with GPS confidence at 98%.", items: ["PMS pump online", "AGO pump online", "DPK inactive"] },
      { title: "Settlement Readiness", value: "84%", body: "Most eligible transactions have cleared fraud and volume checks.", items: ["17 cleared batches", "3 pending review"] },
      { title: "Compliance Snapshot", value: "Good", body: "No overdue documents. License renewal reminder is due in 23 days.", items: ["CAC verified", "Tax ID verified"] }
    ],
    tableTitle: "Recent Activity",
    rows: commonRows,
    filters: ["All", "Live", "Paid", "Flagged"]
  },
  settlements: {
    key: "settlements",
    title: "Settlements & Payouts",
    kicker: "Finance Operations",
    description: "Track cleared batches, payout windows, deductions, failed settlement attempts, and corporate account readiness.",
    primaryAction: "Create Payout Request",
    modalTitle: "Create Payout Request",
    modalBody: "Select cleared transaction batches and submit them for the next settlement window.",
    stats: [
      { label: "Available Balance", value: "₦12.42M", delta: "Ready now", tone: "green" },
      { label: "In Review", value: "₦1.88M", delta: "6 batches", tone: "amber" },
      { label: "Paid This Month", value: "₦48.9M", delta: "+21%", tone: "blue" },
      { label: "Failed Payouts", value: "1", delta: "Bank retry", tone: "red" }
    ],
    panels: [
      { title: "Linked Account", value: "GTBank 0147", body: "Corporate account validated for direct Nigerian Naira disbursement." },
      { title: "Next Payout Window", value: "4:00 PM", body: "Requests submitted before cut-off are included in today's processing queue." },
      { title: "Settlement Policy", body: "Immediate settlement is available after automated fraud, KYC, and station-volume checks." }
    ],
    tableTitle: "Settlement Batches",
    rows: [
      { id: "PO-7812", primary: "Batch 17 - PMS/AGO", secondary: "36 transactions cleared", amount: "₦3,840,000", status: "Pending", meta: "Cut-off 4:00 PM" },
      { id: "PO-7801", primary: "Batch 16 - PMS", secondary: "28 transactions", amount: "₦2,980,000", status: "Paid", meta: "Paid 12:07 PM" },
      { id: "PO-7798", primary: "Batch 15 - AGO", secondary: "Bank retry queued", amount: "₦840,000", status: "Flagged", meta: "Action needed" }
    ],
    filters: ["All", "Pending", "Paid", "Flagged"]
  },
  station: {
    key: "station",
    title: "Station Profile",
    kicker: "Identity & Compliance",
    description: "Manage station identity, operating hours, location verification, pump capacity, contacts, and compliance documents.",
    primaryAction: "Edit Station Profile",
    modalTitle: "Edit Station Profile",
    modalBody: "Update public station details, operating capacity, document records, or business contacts for review.",
    stats: [
      { label: "Verification", value: "98%", delta: "GPS locked", tone: "green" },
      { label: "Pump Capacity", value: "8 lanes", delta: "6 active", tone: "blue" },
      { label: "Documents", value: "5/5", delta: "Complete", tone: "green" },
      { label: "Service Rating", value: "4.7", delta: "+0.2", tone: "green" }
    ],
    panels: [
      { title: "Business Identity", value: "Mainland Energy Station", body: "Registered petroleum retailer operating in Ikeja, Lagos." },
      { title: "Primary Contact", value: "James Adenuga", body: "Operations manager with approval access for pricing and dispute workflows." },
      { title: "Operating Hours", value: "24/7", body: "Customer-facing fuel fulfilment is currently marked as always open." }
    ],
    tableTitle: "Compliance Documents",
    rows: [
      { id: "DOC-001", primary: "CAC Certificate", secondary: "Uploaded by Admin", amount: "PDF", status: "Active", meta: "Expires 2028" },
      { id: "DOC-002", primary: "DPR License", secondary: "Field verified", amount: "PDF", status: "Active", meta: "Renew in 23 days" },
      { id: "DOC-003", primary: "Bank Mandate", secondary: "Finance approved", amount: "PDF", status: "Active", meta: "GTBank" }
    ],
    filters: ["All", "Active", "Pending"]
  },
  pricing: {
    key: "pricing",
    title: "Fuel Pricing",
    kicker: "Price Control",
    description: "Update retail prices, request price approval, compare Obligon corridor guidance, and maintain station-level fuel availability.",
    primaryAction: "Submit Price Update",
    modalTitle: "Submit Price Update",
    modalBody: "Proposed PMS, AGO, DPK, and LPG prices will be sent through partner pricing approval before publishing.",
    stats: [
      { label: "PMS", value: "₦680/L", delta: "Live", tone: "green" },
      { label: "AGO", value: "₦1,180/L", delta: "Live", tone: "green" },
      { label: "DPK", value: "₦970/L", delta: "Offline", tone: "amber" },
      { label: "LPG", value: "₦1,050/kg", delta: "Draft", tone: "blue" }
    ],
    panels: [
      { title: "Corridor Guidance", value: "Within band", body: "Current PMS and AGO pricing align with verified station corridor averages." },
      { title: "Approval Rule", value: "Manager + Obligon", body: "Price changes require station manager approval before publishing to fleet customers." },
      { title: "Availability", body: "Toggle fuel availability when tanks are offline, under maintenance, or temporarily sold out." }
    ],
    tableTitle: "Price Change Log",
    rows: [
      { id: "PR-092", primary: "PMS adjusted to ₦680/L", secondary: "Approved by James", amount: "+₦15", status: "Live", meta: "Today" },
      { id: "PR-088", primary: "AGO adjusted to ₦1,180/L", secondary: "Approved by Obligon", amount: "+₦20", status: "Live", meta: "Yesterday" },
      { id: "PR-081", primary: "LPG set to ₦1,050/kg", secondary: "Awaiting station approval", amount: "Draft", status: "Draft", meta: "2 days ago" }
    ],
    filters: ["All", "Live", "Draft", "Pending"]
  },
  transactions: {
    key: "transactions",
    title: "Transactions",
    kicker: "Ledger Activity",
    description: "Review card transactions, pump activity, approval status, station attendants, and fraud-control flags.",
    primaryAction: "Export Transactions",
    modalTitle: "Export Transactions",
    modalBody: "Download filtered activity as a CSV for finance reconciliation and local operations reporting.",
    stats: [
      { label: "Today Count", value: "184", delta: "+12%", tone: "green" },
      { label: "Gross Volume", value: "31,940L", delta: "+5.1%", tone: "blue" },
      { label: "Approved", value: "97.8%", delta: "Auto-clear", tone: "green" },
      { label: "Flagged", value: "4", delta: "Review", tone: "amber" }
    ],
    panels: [
      { title: "Fraud Controls", value: "Active", body: "Location, volume, card status, and route checks are active on every transaction." },
      { title: "Peak Window", value: "7-10 AM", body: "Morning logistics activity is the highest-volume operating window for this station." },
      { title: "Top Customer", value: "Zenith Logistics", body: "18 transactions today with no active dispute signal." }
    ],
    tableTitle: "Transaction Ledger",
    rows: commonRows,
    filters: ["All", "Live", "Paid", "Flagged"]
  },
  reports: {
    key: "reports",
    title: "Reports & Analytics",
    kicker: "Performance Intelligence",
    description: "Analyze sales, customer segments, pump utilization, settlement trends, dispute patterns, and service reliability.",
    primaryAction: "Generate Report",
    modalTitle: "Generate Report",
    modalBody: "Choose a period and export a station performance report for owners, finance teams, or Obligon account managers.",
    stats: [
      { label: "Monthly Revenue", value: "₦68.3M", delta: "+14%", tone: "green" },
      { label: "Utilization", value: "76%", delta: "+8%", tone: "blue" },
      { label: "Avg. Ticket", value: "₦88k", delta: "+3%", tone: "green" },
      { label: "Dispute Rate", value: "0.6%", delta: "Low", tone: "green" }
    ],
    panels: [
      { title: "Revenue Trend", value: "+14%", body: "Fleet customer volumes are increasing week-over-week across PMS and AGO." },
      { title: "Pump Utilization", value: "76%", body: "Pump 03 and Pump 04 carry the highest activity and should remain priority lanes." },
      { title: "Insights", body: "Offer partner incentives during afternoon low-volume windows to improve station throughput." }
    ],
    tableTitle: "Saved Reports",
    rows: [
      { id: "RP-051", primary: "Monthly settlement report", secondary: "Finance export", amount: "CSV", status: "Active", meta: "Aug 2026" },
      { id: "RP-047", primary: "Pump utilization analysis", secondary: "Operations export", amount: "PDF", status: "Active", meta: "Last week" },
      { id: "RP-040", primary: "Dispute performance review", secondary: "Support export", amount: "PDF", status: "Resolved", meta: "July 2026" }
    ],
    filters: ["All", "Active", "Resolved"]
  },
  staff: {
    key: "staff",
    title: "Staff Management",
    kicker: "Access & Roles",
    description: "Manage station attendants, supervisors, finance contacts, approval permissions, shifts, and POS access.",
    primaryAction: "Invite Staff",
    modalTitle: "Invite Staff",
    modalBody: "Add a station operator and assign their role, shift, and approval permissions.",
    stats: [
      { label: "Active Staff", value: "18", delta: "3 admins", tone: "green" },
      { label: "On Shift", value: "7", delta: "Now", tone: "blue" },
      { label: "Pending Invites", value: "2", delta: "Awaiting", tone: "amber" },
      { label: "Suspended", value: "1", delta: "Review", tone: "red" }
    ],
    panels: [
      { title: "Role Policy", value: "Least privilege", body: "Attendants verify cards and transactions, while supervisors approve exceptions." },
      { title: "Shift Coverage", value: "Healthy", body: "Morning, afternoon, and overnight coverage are active for today." },
      { title: "Audit Trail", body: "Every staff change is captured for compliance and station owner review." }
    ],
    tableTitle: "Staff Directory",
    rows: [
      { id: "ST-014", primary: "Efe Okon", secondary: "Pump attendant / Morning shift", amount: "POS", status: "Active", meta: "Last login 9:42 AM" },
      { id: "ST-008", primary: "Amina Yusuf", secondary: "Supervisor / Full access", amount: "Admin", status: "Active", meta: "Online" },
      { id: "ST-021", primary: "Dayo Martins", secondary: "Invite sent", amount: "Attendant", status: "Pending", meta: "Yesterday" }
    ],
    filters: ["All", "Active", "Pending", "Flagged"]
  },
  verification: {
    key: "verification",
    title: "Card Verification POS",
    kicker: "Point of Sale Control",
    description: "Verify fleet cards, approve pump-side requests, check spending limits, and catch invalid card activity before dispensing.",
    primaryAction: "Start Verification",
    modalTitle: "Start Card Verification",
    modalBody: "Enter a card number or scan code to validate customer, vehicle, limit, route, and station eligibility.",
    stats: [
      { label: "Verified Today", value: "172", delta: "+16", tone: "green" },
      { label: "Declined", value: "5", delta: "Limit/GPS", tone: "amber" },
      { label: "Avg. Time", value: "8s", delta: "Fast", tone: "green" },
      { label: "Offline Mode", value: "Ready", delta: "Synced", tone: "blue" }
    ],
    panels: [
      { title: "Verification Checklist", value: "5/5", body: "Card status, customer wallet, station eligibility, pump limit, and location checks." },
      { title: "POS Health", value: "Online", body: "Terminal sync and local fallback cache are ready for active pump operations." },
      { title: "Manual Override", body: "Supervisor authorization is required for any transaction that fails automated checks." }
    ],
    tableTitle: "Verification Attempts",
    rows: [
      { id: "CV-3301", primary: "Card ending 4492", secondary: "Zenith Logistics / Truck LAG-832", amount: "₦180,000", status: "Active", meta: "Approved 8s" },
      { id: "CV-3296", primary: "Card ending 1902", secondary: "Route mismatch", amount: "₦95,000", status: "Flagged", meta: "Supervisor needed" },
      { id: "CV-3288", primary: "Card ending 7750", secondary: "Wallet and route approved", amount: "₦210,500", status: "Resolved", meta: "Completed" }
    ],
    filters: ["All", "Active", "Flagged", "Resolved"]
  },
  disputes: {
    key: "disputes",
    title: "Disputes & Support",
    kicker: "Resolution Center",
    description: "Resolve transaction disputes, submit evidence, track customer issues, and escalate support cases to Obligon operations.",
    primaryAction: "Open Support Case",
    modalTitle: "Open Support Case",
    modalBody: "Create a dispute or station-support case. Attach transaction details, staff notes, and evidence for review.",
    stats: [
      { label: "Open Cases", value: "4", delta: "-2", tone: "green" },
      { label: "Avg. Resolve", value: "3.1h", delta: "On target", tone: "green" },
      { label: "Evidence Due", value: "2", delta: "Today", tone: "amber" },
      { label: "Escalated", value: "1", delta: "Ops review", tone: "red" }
    ],
    panels: [
      { title: "Support SLA", value: "4 hours", body: "Priority partner issues are triaged within the active operating window." },
      { title: "Evidence Rules", value: "Receipt + POS log", body: "Disputed transactions need attendant notes and POS trace details." },
      { title: "Escalation Path", body: "Fraud, payment, and account cases route to the correct Obligon operations team." }
    ],
    tableTitle: "Support Cases",
    rows: [
      { id: "DS-198", primary: "Customer claims duplicate charge", secondary: "TX-23811 / POS evidence pending", amount: "₦186,500", status: "Open", meta: "Due today" },
      { id: "DS-187", primary: "Settlement amount mismatch", secondary: "Batch PO-7798", amount: "₦840,000", status: "Flagged", meta: "Escalated" },
      { id: "DS-176", primary: "Receipt upload corrected", secondary: "Attendant note added", amount: "₦48,000", status: "Resolved", meta: "Closed" }
    ],
    filters: ["All", "Open", "Flagged", "Resolved"]
  },
  notifications: {
    key: "notifications",
    title: "Notifications",
    kicker: "Account Activity",
    description: "See settlement alerts, price approvals, document reminders, POS warnings, staff events, and support updates.",
    primaryAction: "Mark All Read",
    modalTitle: "Mark Notifications Read",
    modalBody: "All unread partner notifications will be marked as reviewed for this station profile.",
    stats: [
      { label: "Unread", value: "7", delta: "3 urgent", tone: "amber" },
      { label: "Finance", value: "2", delta: "Payouts", tone: "green" },
      { label: "Security", value: "1", delta: "POS alert", tone: "red" },
      { label: "Operations", value: "4", delta: "Station", tone: "blue" }
    ],
    panels: [
      { title: "Critical Alert", value: "POS mismatch", body: "One card verification attempt needs supervisor review before dispense approval." },
      { title: "Settlement Update", value: "₦2.98M paid", body: "Batch PO-7801 was paid into the linked corporate account." },
      { title: "Document Reminder", body: "DPR license renewal window opens soon. Prepare updated station documents." }
    ],
    tableTitle: "Notification Inbox",
    rows: [
      { id: "NT-910", primary: "Payout batch paid", secondary: "PO-7801 completed", amount: "Finance", status: "Paid", meta: "18 mins ago" },
      { id: "NT-908", primary: "Card verification warning", secondary: "Route mismatch on Pump 02", amount: "Security", status: "Flagged", meta: "32 mins ago" },
      { id: "NT-903", primary: "Price update approved", secondary: "PMS price published", amount: "Operations", status: "Resolved", meta: "Yesterday" }
    ],
    filters: ["All", "Paid", "Flagged", "Resolved"]
  },
  settings: {
    key: "settings",
    title: "Settings",
    kicker: "Station Preferences",
    description: "Control account security, approval thresholds, notification preferences, billing details, and platform access rules.",
    primaryAction: "Save Settings",
    modalTitle: "Save Settings",
    modalBody: "Your station preferences will be saved locally for this frontend preview and prepared for backend integration.",
    stats: [
      { label: "MFA", value: "On", delta: "Required", tone: "green" },
      { label: "Approval Limit", value: "₦250k", delta: "Supervisor", tone: "blue" },
      { label: "Alerts", value: "12 rules", delta: "Active", tone: "green" },
      { label: "API Access", value: "Draft", delta: "Disabled", tone: "amber" }
    ],
    panels: [
      { title: "Security", value: "Protected", body: "Multi-factor authentication and login alerts are enabled for managers." },
      { title: "Notifications", value: "Custom", body: "Finance alerts, POS exceptions, and document reminders are enabled." },
      { title: "Approval Routing", body: "Transactions above station thresholds require supervisor approval." }
    ],
    tableTitle: "Preference Log",
    rows: [
      { id: "SET-030", primary: "Enabled POS exception alerts", secondary: "Changed by Amina Yusuf", amount: "Security", status: "Active", meta: "Today" },
      { id: "SET-021", primary: "Adjusted approval threshold", secondary: "₦200k to ₦250k", amount: "Finance", status: "Active", meta: "Last week" },
      { id: "SET-017", primary: "Draft API credential", secondary: "Awaiting owner approval", amount: "API", status: "Draft", meta: "July 2026" }
    ],
    filters: ["All", "Active", "Draft"]
  }
};

