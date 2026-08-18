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
  ShieldCheck,
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-white/10 bg-obligon-navy text-white lg:flex">
      <div className="flex h-20 items-center border-b border-white/10 px-7">
        <Link href="/" className="relative block h-12 w-[74px]" aria-label="Obligon home">
          <Image src={assets.obligonLogo} fill sizes="74px" alt="Obligon" className="object-contain" priority />
        </Link>
      </div>

      <div className="border-b border-white/10 px-7 py-6">
        <p className="text-[11px] uppercase tracking-[1.4px] text-obligon-lime">Partner Portal</p>
        <h2 className="mt-2 font-display text-xl font-bold leading-7">Mainland Energy Station</h2>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-obligon-lime/20 bg-obligon-lime/10 px-3 py-1 text-xs font-bold text-obligon-lime">
          <ShieldCheck size={14} />
          Verified
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-1">
          {dashboardNav.map((item) => {
            const Icon = iconMap[item.icon];
            const active = pathname === item.href;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active ? "bg-obligon-lime text-[#131f00]" : "text-white/65 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-4">
        <Link href="/login" className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/60 hover:bg-white/5 hover:text-white">
          <LogOut size={18} />
          Sign out
        </Link>
      </div>
    </aside>
  );
}
