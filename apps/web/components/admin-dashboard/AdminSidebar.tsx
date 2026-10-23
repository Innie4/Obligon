"use client";

import { DashboardLogo } from "@/components/shared/DashboardLogo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Grid2X2,
  Handshake,
  Settings,
  WalletCards
} from "lucide-react";
import { adminNav, type AdminIconKey } from "@/lib/mock/admin-data";
import { useSession } from "@/components/shared/AuthContext";
import { LogoutButton, SignInOptionsLink } from "@/components/auth/LogoutButton";

const iconMap = {
  dashboard: Grid2X2,
  transactions: WalletCards,
  fuelStations: Building2,
  analytics: BarChart3,
  partners: Handshake,
  settings: Settings,
  disputes: AlertTriangle
} satisfies Record<AdminIconKey, ComponentType<{ size?: number; className?: string }>>;

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useSession();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-obligon-border bg-white px-5 py-6 text-obligon-navy lg:flex">
      <div>
        <Link href="/admin" className="block" aria-label="Obligon LTD home">
          <DashboardLogo priority />
        </Link>
      </div>

      <nav aria-label="Admin sections" className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {adminNav.map((item) => {
          const Icon = iconMap[item.icon];
          const active = pathname === item.href || (item.href === "/admin" && pathname === "/admin");

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active ? "bg-obligon-green text-white" : "text-obligon-text hover:bg-obligon-mist hover:text-obligon-navy"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 shrink-0 border-t border-obligon-border pt-4">
        <div className="flex items-center gap-3 py-2">
          <span className="grid size-10 place-items-center rounded-full bg-obligon-lime text-sm font-extrabold text-[#061958]">{user?.initials ?? "OA"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-obligon-navy truncate">{user?.name ?? "Obligon Admin"}</p>
            <p className="text-xs font-medium text-obligon-text truncate">{user?.accountTier ?? "Level 4 Access"}</p>
          </div>
        </div>
        <SignInOptionsLink className="mt-2 min-h-11 w-full justify-start text-sm" />
        <LogoutButton className="min-h-11 w-full justify-start rounded-lg px-4 text-sm text-[#c1121f] hover:bg-[#fff0f3]" />
      </div>

    </aside>
  );
}
