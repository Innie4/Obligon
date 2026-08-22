export type CompanyPageKey =
  | "overview"
  | "vehicles"
  | "cards"
  | "transactions"
  | "reports"
  | "stations"
  | "roadside"
  | "billing"
  | "team"
  | "notifications"
  | "support"
  | "settings"
  | "maintenance";

export type CompanyModalKey =
  | "vehicle"
  | "service"
  | "assign"
  | "roadside"
  | "newCard"
  | "cardConfirm"
  | "driver"
  | "teamMember"
  | "supportTicket"
  | "export"
  | null;

export type CompanyTone = "green" | "red" | "amber" | "blue" | "dark" | "muted";

export type Metric = {
  label: string;
  value: string;
  helper?: string;
  tone?: CompanyTone;
};

export type Row = {
  cells: string[];
  status?: string;
  tone?: CompanyTone;
};

export const companyNav: Array<{ key: CompanyPageKey; label: string; href: string }> = [
  { key: "overview", label: "Overview", href: "/company" },
  { key: "vehicles", label: "Vehicles", href: "/company/vehicles" },
  { key: "cards", label: "Cards", href: "/company/cards" },
  { key: "transactions", label: "Transactions", href: "/company/transactions" },
  { key: "reports", label: "Reports", href: "/company/reports" },
  { key: "stations", label: "Station Locator", href: "/company/stations" },
  { key: "roadside", label: "Roadside", href: "/company/roadside" },
  { key: "billing", label: "Billing", href: "/company/billing" },
  { key: "team", label: "Team", href: "/company/team" },
  { key: "notifications", label: "Notifications", href: "/company/notifications" },
  { key: "support", label: "Support", href: "/company/support" },
  { key: "settings", label: "Settings", href: "/company/settings" }
];

export const pageCopy: Record<CompanyPageKey, { title: string; description?: string; search?: string }> = {
  overview: { title: "Obligon Dashboard", search: "Search..." },
  vehicles: { title: "Fleet Overview", description: "Manage and track your active vehicles and assigned fuel cards.", search: "Search vehicles..." },
  cards: { title: "Fuelvista Cards", description: "Manage your fleet fuel cards, limits, and assignments.", search: "Search cards..." },
  transactions: { title: "Transactions", description: "View and manage fleet transaction history.", search: "Search transactions..." },
  reports: { title: "Reports & Analytics", search: "Search reports..." },
  stations: { title: "Partner Stations", description: "Find high-speed diesel and verified Obligon network locations.", search: "Search locations, zip codes..." },
  roadside: { title: "Roadside Assistance", description: "Manage and track active emergency requests.", search: "Search..." },
  billing: { title: "Subscription & Billing", description: "Manage your fleet plan, monitor usage, and view past invoices.", search: "Search Obligon..." },
  team: { title: "Team & Access Control", description: "Manage permissions and internal access for your organization.", search: "Search staff..." },
  notifications: { title: "Notifications", description: "Alerts & Updates" },
  support: { title: "Help & Support", description: "Manage your support tickets and find answers quickly." },
  settings: { title: "Account Settings", description: "Manage your organizational profile and security preferences. Ensure your information is up to date for seamless fleet operations.", search: "Search..." },
  maintenance: { title: "Maintenance Manager", description: "Track service schedules, view history, and optimize fleet health.", search: "Search vehicles, services..." }
};

export const overviewMetrics: Metric[] = [
  { label: "Vehicle Count", value: "84", helper: "+2 from last month", tone: "green" },
  { label: "Total Spend", value: "₦4.2M", helper: "-5% vs target", tone: "red" },
  { label: "Active Cards", value: "78", helper: "Unchanged", tone: "blue" }
];

export const recentTransactions: Row[] = [
  { cells: ["Oct 24, 08:30", "KJA-123-XY", "John Doe", "₦15,000"], status: "APPROVED", tone: "green" },
  { cells: ["Oct 24, 10:15", "EKY-456-ZA", "Jane Smith", "₦8,500"], status: "APPROVED", tone: "green" },
  { cells: ["Oct 23, 16:45", "LND-789-BC", "Mike Johnson", "₦22,000"], status: "DECLINED", tone: "red" },
  { cells: ["Oct 23, 11:20", "BDG-321-DF", "Sarah Lee", "₦12,400"], status: "PENDING", tone: "amber" }
];

export const vehicleRows: Row[] = [
  { cells: ["Ford Transit 350\nCargo Van • 2022", "LND-234-XY", "**** 8901"], status: "Active", tone: "green" },
  { cells: ["Toyota Hilux\nPickup • 2021", "KJA-901-AZ", "No card assigned"], status: "Maintenance", tone: "amber" },
  { cells: ["Mercedes Sprinter\nMinibus • 2020", "EKY-442-BR", "**** 3245"], status: "Inactive", tone: "muted" }
];

export const cardMetrics: Metric[] = [
  { label: "Total Cards", value: "124", helper: "+12 this month", tone: "green" },
  { label: "Active", value: "118", helper: "95% of total", tone: "green" },
  { label: "Frozen", value: "4", helper: "Action required", tone: "red" },
  { label: "Total Card Spend Limit", value: "₦4.2M", helper: "Available pool: ₦8.5M", tone: "blue" }
];

export const cardRows: Row[] = [
  { cells: ["Fuelvista Premium\nPhysical Card", "•••• •••• •••• 8901", "John Doe\nLagos HQ - TRK-01", "₦150,000\n45% used"], status: "Active", tone: "green" },
  { cells: ["Fuelvista Standard\nVirtual Card", "•••• •••• •••• 4291", "Sarah Williams\nAbuja Office - VAN-12", "₦85,000\n82% used"], status: "Active", tone: "green" },
  { cells: ["Fuelvista Standard\nPhysical Card", "•••• •••• •••• 1102", "Unassigned\nPool Card", "₦0"], status: "Frozen", tone: "red" },
  { cells: ["Fuelvista Standard\nLost/Stolen", "•••• •••• •••• 5539", "Mike Johnson\n-", "Cancelled"], status: "Cancelled", tone: "muted" }
];

export const transactionRows: Row[] = [
  { cells: ["Oct 24, 2023\n14:32 EST", "Unit 104\nSarah J.", "Shell Station #402\nDiesel • 24 Gal", "•••• 4920", "₦112.45"], status: "Cleared", tone: "green" },
  { cells: ["Oct 24, 2023\n09:15 EST", "Unit 201\nMike R.", "Love's Travel Stop\nDEF • 5 Gal", "•••• 8831", "₦45.00"], status: "Cleared", tone: "green" },
  { cells: ["Oct 23, 2023\n18:45 EST", "Unit 104\nMaintenance", "Joe's Auto Repair\nService • Oil Change", "•••• 4920", "₦89.99"], status: "Pending", tone: "amber" }
];

export const spendRows: Row[] = [
  { cells: ["Oct 24, 2023", "TRK-842", "Major Repair", "₦4,250.00"] },
  { cells: ["Oct 22, 2023", "VAN-104", "Fuel Restock", "₦1,840.50"] },
  { cells: ["Oct 20, 2023", "TRK-901", "Registration", "₦1,200.00"] }
];

export const stations = [
  ["Pilot Travel Center #42", "2.4 mi", "1234 Highway 51 North, Default City", "₦3.89", "VERIFIED"],
  ["Love's Travel Stop", "5.1 mi", "8700 I-40 East, Next Town", "₦3.95", "NETWORK"],
  ["Independent Fuel Co.", "8.7 mi", "402 Industrial Blvd, Port City", "₦4.02", "DIESEL"]
];

export const assistanceHistory: Row[] = [
  { cells: ["Oct 12, 2023", "Unit #2104", "Flat Tire"], status: "Resolved", tone: "green" },
  { cells: ["Sep 28, 2023", "Unit #8831", "Engine Fault"], status: "Resolved", tone: "green" },
  { cells: ["Sep 15, 2023", "Unit #1099", "Lockout"], status: "Resolved", tone: "green" }
];

export const invoices: Row[] = [
  { cells: ["Oct 12, 2023", "INV-2023-10", "₦499.00"], status: "Paid", tone: "green" },
  { cells: ["Sep 12, 2023", "INV-2023-09", "₦499.00"], status: "Paid", tone: "green" },
  { cells: ["Aug 12, 2023", "INV-2023-08", "₦499.00"], status: "Paid", tone: "green" }
];

export const teamRows: Row[] = [
  { cells: ["Sarah Jenkins", "sarah.j@obligon.com", "Admin", "Oct 12, 09:41 AM"] },
  { cells: ["Marcus Reed", "m.reed@obligon.com", "Fleet Manager", "Oct 12, 08:15 AM"] },
  { cells: ["David Chen", "d.chen@obligon.com", "Dispatcher", "Oct 05, 04:30 PM"] }
];

export const notifications = [
  ["Spend Threshold Exceeded", "Just now", "Vehicle TX-9844 exceeded the daily fuel spend limit by ₦45.00 at Shell Station #402.", "SPEND ALERT", "ACTION REQUIRED"],
  ["Low Account Balance", "2 hrs ago", "Main operating account balance has fallen below the ₦5,000 threshold. Current balance: ₦4,820.50.", "LOW BALANCE", ""],
  ["Scheduled Maintenance Due", "5 hrs ago", "Vehicle NY-1120 is due for its 50k mile service. Schedule within the next 7 days to maintain warranty.", "MAINTENANCE", ""],
  ["Suspicious Card Activity", "Yesterday, 4:30 PM", "Card ending in 4921 attempted a purchase outside authorized zones. Transaction declined.", "", ""],
  ["Maintenance Completed", "Yesterday, 9:00 AM", "Vehicle CA-5531 routine inspection and oil change marked as complete by shop.", "", ""]
];

export const tickets: Row[] = [
  { cells: ["#TK-8492", "Oct 24, 2023", "GPS Tracking Delay on Unit 42"], status: "Open", tone: "amber" },
  { cells: ["#TK-8451", "Oct 22, 2023", "Fuel Card Decline - Driver Smith"], status: "Pending", tone: "blue" },
  { cells: ["#TK-8310", "Oct 15, 2023", "Monthly Report Export Error"], status: "Resolved", tone: "green" },
  { cells: ["#TK-8102", "Sep 28, 2023", "API Rate Limit Increase Request"], status: "Resolved", tone: "green" }
];

export const maintenanceRows: Row[] = [
  { cells: ["Oct 18, 2023", "TRK-9011", "Transmission Fluid Flush", "Obligon Certified Hub A", "₦450.00"], status: "COMPLETED", tone: "green" },
  { cells: ["Oct 15, 2023", "VAN-204", "Standard PM A Service", "Mobile Tech - Unit 4", "₦120.50"], status: "COMPLETED", tone: "green" },
  { cells: ["Oct 12, 2023", "TRK-8802", "Emergency Brake Repair", "HeavyDuty Pros Inc.", "₦1,245.00"], status: "INVOICED", tone: "blue" }
];

