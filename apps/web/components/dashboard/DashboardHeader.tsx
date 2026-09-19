"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import { Bell, Plus, Search } from "lucide-react";
import { dashboardNav, pageCopy } from "@/lib/mock/dashboard-data";
import { useSession } from "@/components/shared/AuthContext";
import { useToast } from "@/components/shared/Toast";

function activePageForPath(pathname: string) {
  return dashboardNav.find((item) => item.href === pathname)?.key ?? "overview";
}

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
  const { success: toastSuccess } = useToast();
  const page = pageCopy[activePageForPath(pathname)];
  const displayName = user?.name ?? page.userName ?? "Partner";
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const filteredNav = dashboardNav.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

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
              placeholder={page.searchPlaceholder}
              role="combobox"
              aria-expanded={searchOpen}
              aria-controls="partner-search-results"
              aria-autocomplete="list"
              aria-label={page.searchPlaceholder ?? "Search"}
            />
          </label>
          {searchOpen ? (
            <ul id="partner-search-results" role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-72 overflow-y-auto rounded-lg border border-[#d7d8e4] bg-white p-1.5 shadow-hero">
              {filteredNav.length ? (
                filteredNav.map((item) => (
                  <li key={item.key} role="option" aria-selected={pathname === item.href}>
                    <Link
                      href={item.href}
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
                <li className="px-3 py-2 text-sm font-medium text-obligon-text" role="status">No matching sections.</li>
              )}
            </ul>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-4">
          {user?.role !== "mechanic" ? (
            <button
              onClick={() => toastSuccess(`${page.primaryAction ?? "Add Partner"} — request received for this session.`)}
              className="hidden h-8 items-center gap-1.5 rounded-lg bg-obligon-green px-4 text-xs font-bold text-white shadow-sm sm:inline-flex"
              type="button"
            >
              <Plus size={14} />
              {page.primaryAction ?? "Add Partner"}
            </button>
          ) : null}
          <div className="flex h-8 items-center gap-3 border-l border-[#d7d8e4] pl-4">
            <Link
              href="/dashboard/notifications"
              className="relative inline-flex size-8 items-center justify-center text-obligon-navy"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <span className="absolute right-1 top-1 size-2 rounded-full border border-[#f7f7fd] bg-obligon-green" />
            </Link>
            <div className="grid size-8 place-items-center rounded-full bg-[#cfd8f6] text-[11px] font-extrabold text-obligon-blue">
              {initials(displayName)}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

