export type AdminPageKey = "applications" | "reports" | "disputes" | "companies" | "staff";

export type AdminIconKey = "dashboard" | "transactions" | "fuelStations" | "analytics" | "partners" | "settings" | "disputes";

export type AdminTone = "green" | "blue" | "red" | "amber" | "dark" | "muted";

export type AdminMetric = {
  label: string;
  value: string;
  helper?: string;
  tone?: AdminTone;
};

export type AdminRow = {
  id?: string;
  avatar?: string;
  cells: string[];
  status?: string;
  tone?: AdminTone;
  flagged?: boolean;
};

export const adminNav: Array<{ key: AdminPageKey; label: string; href: string; icon: AdminIconKey }> = [
  { key: "companies", label: "Dashboard", href: "/admin", icon: "dashboard" },
  { key: "applications", label: "Partner Applications", href: "/admin/partner-applications", icon: "partners" },
  { key: "reports", label: "Platform Reports", href: "/admin/reports", icon: "analytics" },
  { key: "disputes", label: "Dispute Resolution", href: "/admin/disputes", icon: "disputes" },
  { key: "staff", label: "Staff & Access", href: "/admin/staff", icon: "settings" }
];

export const adminPageCopy: Record<AdminPageKey, {
  title: string;
  description?: string;
  search: string;
  user: string;
  role: string;
  eyebrow?: string;
}> = {
  applications: {
    title: "Application Review Queue",
    description: "Review and verify station credentials for platform onboarding. Ensure all documentation meets regulatory compliance.",
    search: "Search applications...",
    user: "Amara Okafor",
    role: "LEAD COMPLIANCE",
    eyebrow: "OBLIGON INTERNAL"
  },
  reports: {
    title: "Platform Analytics",
    search: "Global Admin Search...",
    user: "Admin User",
    role: "OBLIGON INTERNAL",
    eyebrow: "OBLIGON INTERNAL"
  },
  disputes: {
    title: "Dispute Resolution",
    description: "Late shift: Review and resolve operational discrepancies across the network.",
    search: "Search Ticket ID, Station, or Transaction...",
    user: "K. Balogun",
    role: "Tier 4 Clearance"
  },
  companies: {
    title: "Company Oversight",
    description: "Monitor enterprise accounts, subscription plans, and fleet performance across the entire Fuelvista ecosystem.",
    search: "Global Admin Search...",
    user: "Adekunle Smith",
    role: "Fleet Overseer"
  },
  staff: {
    title: "Staff & Access Control",
    description: "Manage internal permissions and staff access levels.",
    search: "Search staff or roles...",
    user: "Octavia Benson",
    role: "SENIOR CONTROLLER"
  }
};

export const applicationMetrics: AdminMetric[] = [
  { label: "TOTAL PENDING", value: "42", helper: "+4 SINCE YESTERDAY", tone: "green" },
  { label: "AVG. REVIEW TIME", value: "1.2 days", helper: "-0.2 DAYS TREND", tone: "red" },
  { label: "VERIFICATION SUCCESS RATE", value: "88%", helper: "STABLE", tone: "green" }
];

export const applicationRows: AdminRow[] = [
  { avatar: "EN", cells: ["#OB-2024-0982", "Enyo Lagos\n(Victoria Island)", "Lagos,\nNigeria", "Tunde\nBakare", "2024-10-12"], status: "UNDER REVIEW", tone: "dark" },
  { avatar: "MO", cells: ["#OB-2024-1015", "Mobil Abuja\n(Wuse II)", "Abuja,\nFCT", "Fatima\nYusuf", "2024-10-14"], status: "UNDER REVIEW", tone: "dark" },
  { avatar: "TE", cells: ["#OB-2024-1022", "TotalEnergies\nKano", "Kano,\nKano State", "Ibrahim\nMusa", "2024-10-14"], status: "UNDER REVIEW", tone: "dark" },
  { avatar: "AA", cells: ["#OB-2024-1045", "AA Rano Port\nHarcourt", "Rivers\nState", "Emeka\nNwosu", "2024-10-15"], status: "UNDER REVIEW", tone: "dark" }
];

export const reportMetrics: AdminMetric[] = [
  { label: "TOTAL NETWORK VOLUME", value: "14.2M Ltrs", helper: "+12.4%", tone: "green" },
  { label: "TOTAL REVENUE", value: "₦8.4B", helper: "+8.1%", tone: "green" },
  { label: "ACTIVE PARTNER STATIONS", value: "850", helper: "+42 New", tone: "green" }
];

export const stationPerformanceRows: AdminRow[] = [
  { avatar: "O1", cells: ["Oando Express\n- Victoria Island", "Lagos,\nNG", "452,102", "12,450", "+18.4%"], status: "PRIME", tone: "green" },
  { avatar: "T1", cells: ["TotalEnergies -\nAirport Rd", "Abuja,\nNG", "398,040", "10,120", "+12.1%"], status: "PRIME", tone: "green" },
  { avatar: "N1", cells: ["NNPC Retail -\nPort Harcourt", "Rivers,\nNG", "312,900", "8,940", "+6.8%"], status: "ACTIVE", tone: "green" },
  { avatar: "E1", cells: ["Enyo Retail -\nLekki Exp", "Lagos,\nNG", "289,500", "7,600", "+0.5%"], status: "ACTIVE", tone: "green" }
];

export const disputeMetrics: AdminMetric[] = [
  { label: "OPEN DISPUTES", value: "24", helper: "+3 since last 24h", tone: "red" },
  { label: "RESOLVED (MTD)", value: "142", helper: "92% resolution rate", tone: "green" },
  { label: "AVG. RESOLUTION TIME", value: "1.2 days", helper: "-12% vs last month", tone: "blue" }
];

export const disputeRows: AdminRow[] = [
  { cells: ["#DS-90214", "24 Oct,\n09:12", "Oando Express - Lekki\nID: STA-0043", "Incorrect\nFueling Charge", "₦12,500.00"], status: "UNDER REVIEW", tone: "blue", flagged: true },
  { cells: ["#DS-90211", "24 Oct,\n08:30", "MRS Mega Station -\nVictoria Island\nID: STA-0129", "Duplicate\nTransaction", "₦45,000.00"], status: "PENDING", tone: "amber" },
  { cells: ["#DS-90209", "23 Oct,\n17:45", "TotalEnergies -\nIkeja\nID: STA-0092", "Unauthorized\nDriver Access", "₦0.00"], status: "UNDER REVIEW", tone: "blue" },
  { cells: ["#DS-90204", "23 Oct,\n14:10", "Conoil -\nGbagada Expressway\nID: STA-0021", "Fuel Quality\nDiscrepancy", "₦112,400.00"], status: "PENDING", tone: "amber" },
  { cells: ["#DS-90199", "23 Oct,\n10:22", "Ardova PLC -\nSurulere\nID: STA-0088", "Overcharge on\nPremium Motor Spirit", "₦8,200.00"], status: "UNDER REVIEW", tone: "blue" }
];

export const companyMetrics: AdminMetric[] = [
  { label: "TOTAL FLEETS", value: "156", helper: "+12.4%", tone: "green" },
  { label: "ACTIVE CARDS", value: "12,450", tone: "green" },
  { label: "CREDIT UTILIZATION", value: "82%", helper: "of global limit", tone: "green" }
];

export const companyRows: AdminRow[] = [
  { avatar: "DL", cells: ["Dangote\nLogistics\nLagos, NG", "FLT-88293", "ENTERPRISE", "1,240", "₦45,000,000"], status: "Active", tone: "green" },
  { avatar: "RE", cells: ["Redline\nExpress\nAbuja, NG", "FLT-11409", "PRO", "480", "₦12,500,000"], status: "Active", tone: "green" },
  { avatar: "NT", cells: ["Northstar\nTrans\nKano, NG", "FLT-99012", "BASIC", "12", "₦500,000"], status: "Frozen", tone: "red" },
  { avatar: "OL", cells: ["Oasis\nLogistics\nPort Harcourt, NG", "FLT-55122", "ENTERPRISE", "ONBOARDING", "₦2,000,000"], status: "Pending", tone: "amber" },
  { avatar: "GF", cells: ["Green Field\nAg\nIbadan, NG", "FLT-44321", "PRO", "156", "₦8,200,000"], status: "Active", tone: "green" }
];

export const staffMetrics: AdminMetric[] = [
  { label: "TOTAL INTERNAL STAFF", value: "142", helper: "+3 this month", tone: "green" },
  { label: "ACTIVE ROLES", value: "08", tone: "green" },
  { label: "PENDING INVITES", value: "12", tone: "muted" },
  { label: "LAST AUDIT", value: "22 OCT 24", helper: "System Status: Secure", tone: "muted" }
];

export const staffRows: AdminRow[] = [
  { cells: ["Chidi Okechukwu\nc.okechukwu@obligon.com", "LEAD COMPLIANCE", "DASH  BILL  APPR  ADM"], status: "Active", tone: "green" },
  { cells: ["Aminat Yusuff\na.yusuff@obligon.com", "OPERATIONS MANAGER", "DASH  BILL  APPR  ADM"], status: "Active", tone: "green" },
  { cells: ["Tunde Adeyemi\nt.adeyemi@obligon.com", "JUNIOR ANALYST", "DASH  BILL  APPR  ADM"], status: "Pending Invite", tone: "muted" },
  { cells: ["Folake Adenuga\nf.adenuga@obligon.com", "REGIONAL DIRECTOR", "DASH  BILL  APPR  ADM"], status: "Locked", tone: "red" }
];

