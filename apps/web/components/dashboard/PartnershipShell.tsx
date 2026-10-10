"use client";

import * as React from "react";
import { PartnerSubscriptionGate } from "./PartnerSubscriptionGate";
import { usePathname } from "next/navigation";
import { DashboardHeader } from "./DashboardHeader";
import { PartnershipSidebar } from "./PartnershipSidebar";
import { MobileDashboardNav } from "./MobileDashboardNav";
import { PartnerNotificationsProvider } from "./PartnerNotificationsProvider";
import { LogoutButton } from "@/components/auth/LogoutButton";
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
    () => (allowed ? allowedRoles ?? ["partner"] : []),
    [allowed, allowedRoles]
  );

  return (
    <AuthGuard allowedRoles={allowed ? roles : []}>
      {/* One notification fetch for the whole console, so the header badge and the
          notifications page cannot disagree about what is unread. */}
      <PartnerNotificationsProvider>
      <main className="min-h-screen bg-[#f7f7fd] text-obligon-navy">
        <PartnershipSidebar />
        <div className="lg:pl-[280px]">
          <DashboardHeader />
          {/*
            Sign-out for viewports below `lg`.

            The only LogoutButton lived inside the sidebar's
            `hidden ... lg:flex` container, so on a phone — where the sidebar is not
            rendered at all — a partner could not sign out of the dashboard. The
            session and its tokens persisted until browser storage was cleared by
            hand. MobileDashboardNav is rendered here because every page wraps its
            content in DashboardCanvas, which emits it.
          */}
          {isMechanic || !allowed ? null : (
            <div className="flex justify-end border-b border-[#e3e4ef] px-5 py-2 sm:px-8 lg:hidden">
              <LogoutButton className="h-9 rounded-lg px-3 text-xs" />
            </div>
          )}
          <MobileDashboardNav />
          <PartnerSubscriptionGate>{children}</PartnerSubscriptionGate>
        </div>
      </main>
      </PartnerNotificationsProvider>
    </AuthGuard>
  );
}
