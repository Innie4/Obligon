import { routes } from "@/components/site/routes";
import type { UserRole } from "@/lib/services/types";

/** A return destination must remain a path on this application. */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value || value !== value.trim()) return null;
  try {
    const decoded = decodeURIComponent(value);
    for (const candidate of [value, decoded]) {
      if (!candidate.startsWith("/") || candidate.startsWith("//") || /[\\\u0000-\u001f\u007f-\u009f]/.test(candidate)) return null;
    }
    const base = "https://obligon.invalid";
    const parsed = new URL(value, base);
    if (parsed.origin !== base || parsed.pathname.startsWith("//")) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function dashboardDestination(role: UserRole | null | undefined): string {
  switch (role) {
    case "admin": return routes.adminDashboard;
    case "company": return routes.companyDashboard;
    case "partner":
    case "mechanic": return routes.dashboard;
    case "customer": return routes.customerDashboard;
    default: return routes.login;
  }
}

export function signInDestination(returnPath: string | null | undefined): string {
  const safePath = safeInternalPath(returnPath);
  return safePath ? `${routes.login}?returnUrl=${encodeURIComponent(safePath)}` : routes.login;
}
