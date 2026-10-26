"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "@/components/shared/AuthContext";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu } from "lucide-react";
import { adminNav } from "@/lib/mock/admin-data";
import { DashboardSearch } from "@/components/shared/DashboardSearch";

export function AdminHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { user } = useSession();
  const page = adminNav.find(item => item.href === pathname)?.label ?? "Company oversight";
  const searchEntries = [...adminNav, { label: "Sign-in options", href: "/auth/sign-in-options", keywords: "Google passkey password security" }];
  return <header className="admin-topbar sticky top-0 z-30">
    <div className="flex min-h-[72px] min-w-0 items-center gap-3 px-4 sm:gap-5 sm:px-6 lg:px-10">
      <button type="button" onClick={onOpenMenu} className="admin-icon-button admin-mobile-trigger shrink-0" aria-label="Open admin menu"><Menu size={19} /></button>
      <div className="admin-breadcrumb hidden shrink-0 xl:flex"><span>Administration</span><span aria-hidden="true">/</span><strong>{page}</strong></div>
      <div className="min-w-0 flex-1 xl:ml-auto xl:max-w-[400px]"><DashboardSearch scope="admin" entries={searchEntries} /></div>
      <Link href="/admin/intake" className="admin-icon-button shrink-0" aria-label="Admin activity"><ArrowUpRight size={19} aria-hidden="true" /></Link>
      <div className="hidden shrink-0 border-l border-obligon-border pl-5 sm:block"><p className="max-w-[160px] truncate text-xs font-semibold">{user?.name ?? "Administrator"}</p><p className="mt-1 text-xs text-obligon-text">Admin workspace</p></div>
    </div>
  </header>;
}
