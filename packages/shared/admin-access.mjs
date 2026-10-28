export const ADMIN_ROLES = Object.freeze([
  { value: "super_admin", label: "Super Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "staff", label: "Staff" },
]);

export const ADMIN_PAGES = Object.freeze([
  { key: "companies", title: "Companies", href: "/admin/companies" },
  { key: "intake", title: "Requests & activity", href: "/admin/intake" },
  { key: "discounts", title: "Discount approvals", href: "/admin/discount-approvals" },
  { key: "applications", title: "Partner applications", href: "/admin/partner-applications" },
  { key: "benefits", title: "Customer benefits", href: "/admin/customer-benefits" },
  { key: "operations", title: "Operations", href: "/admin/operations" },
  { key: "disputes", title: "Disputes", href: "/admin/disputes" },
  { key: "reports", title: "Reports", href: "/admin/reports" },
  { key: "staff", title: "Staff & access", href: "/admin/staff" },
]);

export function normalizeAdminRole(value) {
  return ADMIN_ROLES.some(role => role.value === value) ? value : null;
}

export function hasAdminPage(user, key) {
  return user?.role === "admin" && normalizeAdminRole(user.staff_role) !== null &&
    ADMIN_PAGES.some(page => page.key === key) &&
    Array.isArray(user.staff_permissions) && user.staff_permissions.includes(key) &&
    (key !== "staff" || user.staff_role === "super_admin");
}

export function adminPageForPath(path) {
  const pathname = String(path ?? "").split(/[?#]/)[0].replace(/\/+$/, "");
  if (pathname === "/admin") return "companies";
  return ADMIN_PAGES.find(page => pathname === page.href || pathname.startsWith(`${page.href}/`))?.key ?? null;
}

export function adminPageForApiPath(path) {
  const first = String(path ?? "").replace(/^\/api\/admin(?=\/|$)/, "").split(/[?#]/)[0].split("/").filter(Boolean)[0];
  if (["companies"].includes(first)) return "companies";
  if (["activity", "intake", "job-applications", "jobs", "stations", "financial-activity", "email-delivery"].includes(first)) return "intake";
  if (first === "discount-requests") return "discounts";
  if (["applications", "card-requests", "card-replacements"].includes(first)) return "applications";
  if (["benefits", "generator-repairs"].includes(first)) return "benefits";
  if (["support", "fuel-review", "settlement-review", "payout-accounts", "settlement-accounts", "refunds", "reconcile", "company-card-issuances"].includes(first)) return "operations";
  if (["disputes", "security-logs"].includes(first)) return "disputes";
  if (first === "reports") return "reports";
  if (first === "staff") return "staff";
  return null;
}
