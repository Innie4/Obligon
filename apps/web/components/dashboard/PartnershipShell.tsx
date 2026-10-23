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
import { partnerRouteAllowed } from "../../../../packages/shared/partner-access.mjs";

type PartnershipShellProps = {
  children: React.ReactNode;
  allowedRoles?: Array<"partner" | "mechanic">;
};

export function PartnershipShell({ children, allowedRoles }: PartnershipShellProps) {
  const pathname = usePathname();
  const { user } = useSession();
  const allowed = partnerRouteAllowed(user, pathname);
  const roles = React.useMemo<Array<"partner" | "mechanic">>(
    () => allowed ? allowedRoles ?? ["partner", "mechanic"] : [],
    [allowed, allowedRoles]
  );

  return (
    <AuthGuard allowedRoles={allowed ? roles : []}>
      {/* One notification fetch for the whole console, so the header badge and the
          notifications page cannot disagree about what is unread. */}
      <PartnerNotificationsProvider>
      <main className="min-h-screen bg-obligon-mist pb-[calc(5rem+env(safe-area-inset-bottom))] text-obligon-navy lg:pb-0">
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
