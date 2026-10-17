"use client";

import * as React from "react";
import { PartnerSubscriptionGate } from "./PartnerSubscriptionGate";
import { usePathname } from "next/navigation";
import { DashboardHeader } from "./DashboardHeader";
import { PartnershipSidebar } from "./PartnershipSidebar";
import { MobileDashboardNav } from "./MobileDashboardNav";
import { PartnerNotificationsProvider } from "./PartnerNotificationsProvider";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useSession } from "@/components/shared/AuthContext";

type PartnershipShellProps = {
  children: React.ReactNode;
  allowedRoles?: Array<"partner" | "mechanic">;
};

/**
 * Routes a mechanic account may open, mirroring `mechanicAllowedPaths` in
 * `apps/api/src/routes/partner.routes.js`.
 *
 * The shell used to widen every page's roles to `["partner", "mechanic"]`, so a
 * mechanic typing `/dashboard/fuel-pricing` or following a stale bookmark got the
 * full editable price form — three inputs, "Broadcast & Sync to Dispensers" — and
 * every submission returned "This partner feature is not available for mechanic
 * accounts". The sidebar hid the links client-side, which is not authorisation:
 * hiding a link does not unrender the page behind it.
 */
const MECHANIC_ROUTES = new Set([
  "/mechanic",
  "/dashboard",
  "/dashboard/transactions",
  "/dashboard/reports",
  "/dashboard/staff",
  "/dashboard/disputes",
  "/dashboard/notifications",
  "/dashboard/settings"
]);

export function PartnershipShell({ children, allowedRoles }: PartnershipShellProps) {
  const pathname = usePathname();
  const { user } = useSession();
  const isMechanic = user?.role === "mechanic";
  const allowed = isMechanic ? MECHANIC_ROUTES.has(pathname) : true;
  // Memoised: `allowedRoles` is listed as an AuthGuard effect dependency, so a fresh
  // array literal re-fired the guard on every parent render for the dashboard's whole
  // lifetime.
  //
  // An empty role list means "no role may view this". AuthGuard treats an empty
  // allow-list as deny-all (it did not once, and rendered the page anyway), so a
  // mechanic who navigates straight to a page the API refuses lands on the overview
  // instead of a form that can only 403.
  const roles = React.useMemo<Array<"partner" | "mechanic">>(
    () => (allowed ? allowedRoles ?? (MECHANIC_ROUTES.has(pathname) ? ["partner", "mechanic"] : ["partner"]) : []),
    [allowed, allowedRoles, pathname]
  );

  return (
    <AuthGuard allowedRoles={allowed ? roles : []}>
      {/* One notification fetch for the whole console, so the header badge and the
          notifications page cannot disagree about what is unread. */}
      <PartnerNotificationsProvider>
      <main className="min-h-screen bg-[#f7f7fd] pb-[calc(5rem+env(safe-area-inset-bottom))] text-obligon-navy lg:pb-0">
        <PartnershipSidebar />
        <div className="lg:pl-[280px]">
          <DashboardHeader />
          <PartnerSubscriptionGate>{children}</PartnerSubscriptionGate>
        </div>
        <MobileDashboardNav />
      </main>
      </PartnerNotificationsProvider>
    </AuthGuard>
  );
}
