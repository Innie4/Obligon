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
import { LogoutButton } from "@/components/auth/LogoutButton";

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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-[#dfe5ec] bg-white px-6 py-8 text-[#07162f] lg:flex">
      <div>
        <Link href="/admin" className="block" aria-label="Obligon LTD home">
          <DashboardLogo priority />
        </Link>
      </div>

      <nav className="mt-12 flex-1 space-y-1.5 px-5">
        {adminNav.map((item) => {
          const Icon = iconMap[item.icon];
          const active = pathname === item.href || (item.href === "/admin" && pathname === "/admin");

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`relative flex h-[44px] items-center gap-3 rounded-xl px-4 text-[13px] font-bold transition ${
                active ? "bg-[#061958] text-white shadow-hero" : "text-[#4f5663] hover:bg-[#f2f6fa] hover:text-[#061958]"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#dfe5ec] px-5 py-5">
        <div className="flex items-center gap-3 rounded-xl bg-[#f7f7fd] p-3 border border-obligon-border">
          <span className="grid size-10 place-items-center rounded-full bg-obligon-lime text-sm font-extrabold text-[#061958]">{user?.initials ?? "OA"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-obligon-navy truncate">{user?.name ?? "Obligon Admin"}</p>
            <p className="text-xs font-medium text-obligon-text truncate">{user?.accountTier ?? "Level 4 Access"}</p>
          </div>
        </div>
        <LogoutButton className="mt-3 h-[42px] w-full justify-start rounded-xl px-4 text-[13px] text-[#c1121f] hover:bg-[#fff0f3]" />
      </div>

    </aside>
  );
}
