"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Plus, Search } from "lucide-react";
import { dashboardNav, pageCopy } from "@/lib/mock/dashboard-data";
import { useSession } from "@/components/shared/AuthContext";

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
  const page = pageCopy[activePageForPath(pathname)];
  const displayName = user?.name ?? page.userName ?? "Partner";

  return (
    <header className="sticky top-0 z-30 border-b border-[#e3e4ef] bg-[#f7f7fd]/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-6 lg:px-12">
        <label className="hidden h-[38px] w-[288px] items-center gap-3 rounded-lg border border-[#d7d8e4] bg-white px-3 md:flex">
          <Search className="shrink-0 text-[#7a7c89]" size={15} />
          <input
            className="w-full min-w-0 bg-transparent text-[13px] font-medium text-obligon-navy outline-none placeholder:text-[#8c8d98]"
            placeholder={page.searchPlaceholder}
          />
        </label>

        <div className="ml-auto flex items-center gap-4">
          <button
            className="hidden h-8 items-center gap-1.5 rounded-lg bg-obligon-green px-4 text-xs font-bold text-white shadow-sm sm:inline-flex"
            type="button"
          >
            <Plus size={14} />
            {page.primaryAction ?? "Add Partner"}
          </button>
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

