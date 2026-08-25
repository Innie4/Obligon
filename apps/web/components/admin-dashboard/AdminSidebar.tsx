"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Grid2X2,
  Handshake,
  LogOut,
  Settings,
  WalletCards
} from "lucide-react";
import { assets } from "@/components/landing/assets";
import { adminNav, type AdminIconKey } from "@/lib/mock/admin-data";
import { ConfirmModal } from "@/components/shared/Dialogs";
import { useSession } from "@/components/shared/AuthContext";

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
  const router = useRouter();
  const { user } = useSession();
  const [logoutOpen, setLogoutOpen] = React.useState(false);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col bg-[#061958] text-white lg:flex">
      <div className="px-8 pt-14">
        <Link href="/" className="relative block h-[72px] w-[204px]" aria-label="Obligon LTD home">
          <Image src={assets.obligonLogo} fill sizes="204px" alt="Obligon LTD" className="object-contain object-left" priority />
        </Link>
      </div>

      <nav className="mt-20 flex-1 space-y-2 px-6">
        {adminNav.map((item) => {
          const Icon = iconMap[item.icon];
          const active = pathname === item.href || (item.href === "/admin" && pathname === "/admin");

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`relative flex h-[42px] items-center gap-3 rounded-lg px-4 text-[13px] font-bold transition ${
                active ? "bg-white/8 text-obligon-lime" : "text-[#aebbe4] hover:bg-white/5 hover:text-white"
              }`}
            >
              {active ? <span className="absolute left-0 top-0 h-full w-1 rounded-r bg-obligon-lime" /> : null}
              <Icon size={19} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/12 px-6 py-6">
          <div className="flex items-center gap-3 rounded-lg px-2 py-3">
            <span className="grid size-10 place-items-center rounded-full bg-obligon-lime text-sm font-extrabold text-[#061958]">{user?.initials ?? "OA"}</span>
            <div>
              <p className="text-sm font-extrabold">{user?.name ?? "Obligon LTD Admin"}</p>
              <p className="text-xs font-medium text-[#9aa8d0]">{user?.accountTier ?? "Level 4 Access"}</p>
            </div>
          </div>
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="mt-3 flex h-[42px] w-full items-center gap-3 rounded-lg px-4 text-[13px] font-bold text-[#ff5454] hover:bg-white/5"
        >
          <LogOut size={18} />
          Log Out
        </button>
      </div>

      <ConfirmModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => router.push("/login")}
        title="Log Out?"
        message="You will be signed out of the Obligon LTD admin console. Any unsaved changes will be lost."
        confirmLabel="Log Out"
        tone="red"
      />
    </aside>
  );
}
