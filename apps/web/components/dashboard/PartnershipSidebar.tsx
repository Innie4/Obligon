"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useState } from "react";
import type { ComponentType } from "react";
import { ConfirmModal } from "@/components/shared/Dialogs";
import {
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Fuel,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  Layers,
  LogOut,
  ReceiptText,
  Settings,
  Users
} from "lucide-react";
import { assets } from "@/components/landing/assets";
import { dashboardNav, type DashboardIcon, type DashboardPageKey } from "./dashboard-data";

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

type NavItem = { key: DashboardPageKey; label: string; href: string };

const item = (key: DashboardPageKey): NavItem => {
  const found = dashboardNav.find((nav) => nav.key === key);
  if (!found) throw new Error(`Unknown nav key: ${key}`);
  return found;
};

const primaryItems: NavItem[] = [
  item("overview"),
  item("transactions"),
  item("station"),
  item("reports"),
  item("settlements")
];

const navGroups: Array<{
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  items: NavItem[];
}> = [
  {
    key: "operations",
    label: "Operations",
    icon: Layers,
    items: [item("pricing"), item("staff"), item("verification")]
  },
  {
    key: "support",
    label: "Support & Alerts",
    icon: LifeBuoy,
    items: [item("disputes"), item("notifications")]
  }
];

const bottomItems: NavItem[] = [item("settings")];

function isActive(pathname: string, nav: NavItem) {
  return pathname === nav.href || (nav.key === "overview" && pathname === "/dashboard");
}

export function PartnershipSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = React.useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      navGroups.map((group) => [group.key, group.items.some((nav) => isActive(pathname, nav))])
    )
  );

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderLink = (nav: NavItem) => {
    const Icon = iconMap[
      dashboardNav.find((nav2) => nav2.key === nav.key)?.icon ?? "overview"
    ];
    const active = isActive(pathname, nav);

    return (
      <Link
        key={nav.key}
        href={nav.href}
        className={`relative flex min-h-[42px] items-center gap-3 rounded-lg px-4 text-[13px] font-semibold transition ${
          active ? "bg-white/10 text-obligon-lime" : "text-white/68 hover:bg-white/6 hover:text-white"
        }`}
      >
        <Icon size={18} className="shrink-0" />
        <span className="truncate">{nav.label}</span>
        {active ? <span className="absolute right-0 top-2 h-6 w-1 rounded-l-full bg-obligon-lime" /> : null}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col bg-[#071853] text-white lg:flex">
      <div className="flex h-[181px] items-start px-6 pt-8">
        <Link href="/" className="relative block h-[149px] w-[223px]" aria-label="Obligon LTD home">
          <Image src={assets.obligonLogo} fill sizes="223px" alt="Obligon LTD" className="object-contain object-left-top" priority />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-6 pb-5">
        <div className="space-y-1">
          {primaryItems.map(renderLink)}

          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const open = openGroups[group.key];
            const groupActive = group.items.some((nav) => isActive(pathname, nav));

            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className={`relative flex min-h-[42px] w-full items-center gap-3 rounded-lg px-4 text-[13px] font-semibold transition ${
                    groupActive ? "bg-white/10 text-obligon-lime" : "text-white/68 hover:bg-white/6 hover:text-white"
                  }`}
                  aria-expanded={open}
                >
                  <GroupIcon size={18} className="shrink-0" />
                  <span className="truncate">{group.label}</span>
                  <ChevronDown
                    size={16}
                    className={`ml-auto shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>

                {open ? <div className="mt-1 space-y-1 pl-6">{group.items.map(renderLink)}</div> : null}
              </div>
            );
          })}

          {bottomItems.map(renderLink)}
        </div>
      </nav>

      <div className="mx-6 border-t border-white/15 py-6">
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="flex h-[42px] w-full items-center gap-3 rounded-lg px-4 text-[13px] font-semibold text-[#ff6b7b] hover:bg-white/5"
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
        message="You will be signed out of your partner dashboard. Any unsaved changes will be lost."
        confirmLabel="Log Out"
        tone="red"
      />
    </aside>
  );
}
