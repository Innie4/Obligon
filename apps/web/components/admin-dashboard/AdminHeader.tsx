"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, HelpCircle, Search } from "lucide-react";
import { adminNav, adminPageCopy } from "./admin-data";

function currentPage(pathname: string) {
  return adminNav.find((item) => item.href === pathname)?.key ?? "companies";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AdminHeader() {
  const pathname = usePathname();
  const page = adminPageCopy[currentPage(pathname)];

  return (
    <header className="sticky top-0 z-30 border-b border-[#cfd3e1] bg-[#f7f7fd]/95 backdrop-blur">
      <div className="flex h-[64px] items-center gap-5 px-6 lg:px-12">
        <label className="hidden h-[38px] w-full max-w-[448px] items-center gap-3 rounded-lg border border-[#c8ccdb] bg-[#eef3ff] px-3 md:flex">
          <Search size={16} className="text-[#777c8f]" />
          <input className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-[#7d8293]" placeholder={page.search} />
        </label>

        {page.eyebrow ? (
          <span className="hidden rounded-full border border-obligon-green bg-[#f3ffe6] px-4 py-1.5 text-[10px] font-extrabold uppercase text-obligon-green xl:inline-flex">
            {page.eyebrow}
          </span>
        ) : null}

        {pathname === "/admin/reports" ? (
          <button type="button" className="ml-auto hidden h-9 items-center gap-2 rounded-lg border border-[#c8ccdb] bg-[#eef3ff] px-4 text-xs font-extrabold text-obligon-navy md:inline-flex">
            <CalendarDays size={16} />
            Last 30 Days
          </button>
        ) : (
          <div className="ml-auto" />
        )}

        <Link href="/admin/staff" className="relative inline-flex size-8 items-center justify-center text-obligon-navy" aria-label="Admin alerts">
          <Bell size={19} />
          <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-[#c1121f]" />
        </Link>
        {pathname === "/admin/partner-applications" ? <HelpCircle size={18} className="text-obligon-navy" /> : null}
        <div className="h-10 w-px bg-[#d5d8e5]" />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-extrabold text-obligon-navy">{page.user}</p>
            <p className="text-[10px] font-bold uppercase text-obligon-text">{page.role}</p>
          </div>
          <div className="grid size-9 place-items-center rounded-lg bg-[#050816] text-xs font-extrabold text-white">
            {initials(page.user)}
          </div>
        </div>
      </div>
    </header>
  );
}

