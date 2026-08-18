import Link from "next/link";
import { Bell, ChevronDown, Search } from "lucide-react";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-obligon-border bg-obligon-mist/95 backdrop-blur">
      <div className="flex h-20 items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <div className="hidden min-w-0 flex-1 items-center gap-3 rounded-xl border border-obligon-border bg-white px-4 py-3 md:flex">
          <Search className="shrink-0 text-obligon-text" size={18} />
          <input
            className="w-full bg-transparent text-sm text-obligon-navy outline-none placeholder:text-obligon-text"
            placeholder="Search transactions, payouts, staff, or cards"
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/dashboard/notifications"
            className="relative inline-flex size-11 items-center justify-center rounded-xl border border-obligon-border bg-white text-obligon-navy"
            aria-label="Notifications"
          >
            <Bell size={19} />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-obligon-green" />
          </Link>
          <button className="hidden h-11 items-center gap-3 rounded-xl border border-obligon-border bg-white px-4 text-sm font-bold text-obligon-navy sm:inline-flex" type="button">
            Ikeja Main Station
            <ChevronDown size={16} />
          </button>
          <div className="grid size-11 place-items-center rounded-xl bg-obligon-green text-sm font-extrabold text-white">
            JA
          </div>
        </div>
      </div>
    </header>
  );
}

