"use client";

import Link from "next/link";
import * as React from "react";
import { useSession } from "@/components/shared/AuthContext";
import { usePathname } from "next/navigation";
import { Bell, HelpCircle, Menu } from "lucide-react";
import { adminNav, adminPageCopy } from "@/lib/mock/admin-data";
import { DashboardSearch } from "@/components/shared/DashboardSearch";

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

export function AdminHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const {user}=useSession();
  const page = adminPageCopy[currentPage(pathname)];
  const searchEntries = [...adminNav, { label: "Sign-in options", href: "/auth/sign-in-options", keywords: "Google passkey password security" }];

  return (
    <header className="sticky top-0 z-30 border-b border-obligon-border bg-[#f8fafc]/95 backdrop-blur">
      <div className="flex h-[64px] min-w-0 items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-12">
        <button type="button" onClick={onOpenMenu} className="grid size-11 shrink-0 place-items-center rounded-lg border border-[#c8ccdb] bg-white lg:hidden" aria-label="Open admin menu"><Menu size={18} /></button>
        <DashboardSearch scope="admin" entries={searchEntries} />

        {page.eyebrow ? (
          <span className="hidden whitespace-nowrap rounded-lg border border-obligon-border bg-white px-3 py-2 text-xs font-semibold text-obligon-green xl:inline-flex">
            {page.eyebrow}
          </span>
        ) : null}

        <div className="ml-auto" />
        <Link href="/admin/intake" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-obligon-navy" aria-label="Admin activity"><Bell size={19}/></Link>
        {pathname === "/admin/partner-applications" ? <HelpCircle size={18} className="hidden shrink-0 text-obligon-navy sm:block" /> : null}
        <div className="hidden h-10 w-px bg-[#d5d8e5] sm:block" />
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden max-w-[180px] text-right sm:block">
            <p className="truncate text-xs font-extrabold text-obligon-navy">{user?.name??"Administrator"}</p>
            <p className="text-xs font-medium text-obligon-text">Platform administrator</p>
          </div>
          <div className="grid size-9 place-items-center rounded-lg bg-[#050816] text-xs font-extrabold text-white">
            {initials(user?.name??"Admin")}
          </div>
        </div>
      </div>
    </header>
  );
}
