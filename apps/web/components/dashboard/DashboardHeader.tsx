"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { dashboardNav } from "@/lib/mock/dashboard-data";
import { useSession } from "@/components/shared/AuthContext";
import { usePartnerNotifications } from "./PartnerNotificationsProvider";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DashboardHeader() {
  const pathname = usePathname();
  const { user } = useSession();
  const displayName = user?.name ?? "Partner";
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const filteredNav = dashboardNav.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

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
    <header className="sticky top-0 z-30 border-b border-[#e3e4ef] bg-[#f7f7fd]/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-6 lg:px-12">
        <div
          className="relative hidden w-[288px] md:block"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchOpen(false);
          }}
        >
          <label className="flex h-[38px] w-full items-center gap-3 rounded-lg border border-[#d7d8e4] bg-white px-3">
            <Search className="shrink-0 text-[#7a7c89]" size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchOpen(false);
                  event.currentTarget.blur();
                }
              }}
              className="w-full min-w-0 bg-transparent text-[13px] font-medium text-obligon-navy outline-none placeholder:text-[#8c8d98]"
              // Says what it searches. The placeholder claimed to search
              // "transactions, stations" while the implementation matched only nav
              // labels, so a transaction reference produced "No matching sections".
              placeholder="Search dashboard sections"
              role="combobox"
              aria-expanded={searchOpen}
              aria-controls={searchOpen ? "partner-search-results" : undefined}
              aria-autocomplete="list"
              aria-label="Search dashboard sections"
            />
          </label>
          {searchOpen ? (
            <ul id="partner-search-results" role="listbox" aria-label="Dashboard sections" className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-72 overflow-y-auto rounded-lg border border-[#d7d8e4] bg-white p-1.5 shadow-hero">
              {filteredNav.length ? (
                filteredNav.map((item) => (
                  <li key={item.key} role="none">
                    <Link
                      href={item.href}
                      role="option"
                      aria-selected={pathname === item.href}
                      aria-current={pathname === item.href ? "page" : undefined}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSearchOpen(false);
                        setQuery("");
                      }}
                      className={`block rounded-md px-3 py-2 text-sm font-bold ${pathname === item.href ? "bg-[#eef3ff] text-obligon-navy" : "text-[#4f5663] hover:bg-[#f2f6f2]"}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm font-medium text-obligon-text">
                  No matching sections.
                </li>
              )}
            </ul>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-4">
          {/*
            No primary-action button here.

            It fired `toastSuccess("Save Changes — request received for this
            session.")` on every page and made no request, so a partner clicking
            "Request Payout" or "Raise a Dispute" was told it had happened. Each
            page now offers only controls that call the API. The prop `page.primaryAction`
            is no longer read here.
          */}
          <div className="flex h-8 items-center gap-3 border-l border-[#d7d8e4] pl-4">
            <Link
              href="/dashboard/notifications"
              className="relative inline-flex size-8 items-center justify-center text-obligon-navy"
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
              className="grid size-8 place-items-center rounded-full bg-[#cfd8f6] text-[11px] font-extrabold text-obligon-blue"
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
