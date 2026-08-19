"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  CircleDollarSign,
  CreditCard,
  Fuel,
  Headphones,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  Users
} from "lucide-react";
import { assets } from "@/components/landing/assets";
import { dashboardNav, type DashboardIcon } from "./dashboard-data";

const iconMap = {
  overview: LayoutDashboard,
  wallet: CircleDollarSign,
  station: Building2,
  pricing: Fuel,
  transactions: ReceiptText,
  reports: BarChart3,
  staff: Users,
  pos: CreditCard,
  support: Headphones,
  bell: Bell,
  settings: Settings
} satisfies Record<DashboardIcon, ComponentType<{ size?: number; className?: string }>>;

export function PartnershipSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col bg-[#071853] text-white lg:flex">
      <div className="flex h-[181px] items-start px-6 pt-8">
        <Link href="/" className="relative block h-[149px] w-[223px]" aria-label="Obligon home">
          <Image src={assets.obligonLogo} fill sizes="223px" alt="Obligon" className="object-contain object-left-top" priority />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-6 pb-5">
        <div className="space-y-1">
          {dashboardNav.map((item) => {
            const Icon = iconMap[item.icon];
            const active = pathname === item.href || (item.key === "overview" && pathname === "/dashboard");

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`relative flex min-h-[42px] items-center gap-3 rounded-lg px-4 text-[13px] font-semibold transition ${
                  active ? "bg-white/10 text-obligon-lime" : "text-white/68 hover:bg-white/6 hover:text-white"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate">{item.label}</span>
                {active ? <span className="absolute right-0 top-2 h-6 w-1 rounded-l-full bg-obligon-lime" /> : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mx-6 border-t border-white/15 py-6">
        <Link href="/login" className="flex h-[42px] items-center gap-3 rounded-lg px-4 text-[13px] font-semibold text-[#ff6b7b] hover:bg-white/5">
          <LogOut size={18} />
          Log Out
        </Link>
      </div>
    </aside>
  );
}

