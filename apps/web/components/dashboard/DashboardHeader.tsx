"use client";

import Link from "next/link";
import * as React from "react";
import { Bell } from "lucide-react";
import { dashboardNav } from "@/lib/mock/dashboard-data";
import { useSession } from "@/components/shared/AuthContext";
import { usePartnerNotifications } from "./PartnerNotificationsProvider";
import { MobilePartnerAccount } from "./MobileDashboardNav";
import { partnerPageAllowed } from "../../../../packages/shared/partner-access.mjs";
import { DashboardSearch } from "@/components/shared/DashboardSearch";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DashboardHeader() {
  const { user } = useSession();
  const displayName = user?.name ?? "Partner";
  const searchEntries = [...dashboardNav.filter(item => partnerPageAllowed(user, item.key)), { label: "Sign-in options", href: "/auth/sign-in-options", keywords: "Google passkey password security" }];

// The unread dot is driven by the real count rather than rendered
  // unconditionally. It was a permanent green badge on every page, including the
  // notifications page itself when there was nothing unread — and "Mark all as
  // read" never removed it, because nothing owned it.
  //
  // The count comes from the shared provider rather than from a fetch of its own.
  // It used to call `api.getPartnerNotifications()` here, keyed on the pathname, so
  // it refetched only when entering or leaving the notifications route: reading
  // everything and pressing "Mark all as read" left this badge showing a count for
  // notifications that no longer existed, on every other page, until a reload.
  const { unread } = usePartnerNotifications();

  return (
    <header className="sticky top-0 z-[45] border-b border-obligon-border bg-white lg:z-30">
      <div className="flex min-h-[72px] items-center justify-between gap-3 px-5 lg:px-10">
        <DashboardSearch scope="partner" entries={searchEntries} />

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
          <MobilePartnerAccount />
          {/*
            No primary-action button here.

            It fired `toastSuccess("Save Changes — request received for this
            session.")` on every page and made no request, so a partner clicking
            "Request Payout" or "Raise a Dispute" was told it had happened. Each
            page now offers only controls that call the API. The prop `page.primaryAction`
            is no longer read here.
          */}
          <div className="flex items-center gap-3 border-l border-obligon-border pl-3">
            <Link
              href="/dashboard/notifications"
              className="relative inline-flex size-11 items-center justify-center rounded-xl text-obligon-navy transition-colors hover:bg-obligon-mist"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell size={18} />
              {unread > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 grid min-w-[16px] place-items-center rounded-full bg-obligon-green px-1 text-[9px] font-extrabold leading-4 text-white"
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            <div
              className="hidden size-9 place-items-center rounded-full bg-obligon-panel text-xs font-bold text-obligon-blue sm:grid"
              aria-hidden="true"
            >
              {initials(displayName)}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
