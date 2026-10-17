"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3, Bell, Building2, ChevronDown, CircleDollarSign, CreditCard,
  Fuel, Headphones, LayoutDashboard, ReceiptText, Settings, ShieldCheck, Users
} from "lucide-react";
import { dashboardNav, type DashboardPageKey } from "@/lib/mock/dashboard-data";
import { useSession } from "@/components/shared/AuthContext";
import { LogoutButton } from "@/components/auth/LogoutButton";

const mechanicKeys = new Set<DashboardPageKey>(["overview", "transactions", "reports", "staff", "disputes", "notifications", "settings"]);
const partnerPrimaryKeys: DashboardPageKey[] = ["overview", "transactions", "station", "reports", "settlements"];
const mechanicPrimaryKeys: DashboardPageKey[] = ["overview", "transactions", "reports", "staff"];
const icons = {
  overview: LayoutDashboard, wallet: CircleDollarSign, station: Building2,
  pricing: Fuel, transactions: ReceiptText, reports: BarChart3, staff: Users,
  pos: CreditCard, support: Headphones, bell: Bell, shield: ShieldCheck, settings: Settings
};
const compactLabels: Partial<Record<DashboardPageKey, string>> = {
  overview: "Home", station: "Stations", settlements: "Payouts", staff: "Staff"
};

function mobileItems(isMechanic: boolean) {
  const visible = isMechanic ? dashboardNav.filter(item => mechanicKeys.has(item.key)) : dashboardNav;
  const primaryKeys = isMechanic ? mechanicPrimaryKeys : partnerPrimaryKeys;
  return {
    primary: primaryKeys.flatMap(key => visible.filter(item => item.key === key)),
    account: visible.filter(item => !primaryKeys.includes(item.key))
  };
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href || pathname === "/mechanic";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Less frequent sections stay in the header, matching the customer console. */
export function MobilePartnerAccount() {
  const pathname = usePathname();
  const { user } = useSession();
  const { account } = mobileItems(user?.role === "mechanic");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const active = account.some(item => isActive(pathname, item.href));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    // Unmount the popup (and any sign-out dialog) when the desktop sidebar takes over.
    const desktop = window.matchMedia("(min-width: 1024px)");
    function resize() {
      if (desktop.matches) setOpen(false);
    }
    resize();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    desktop.addEventListener("change", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      desktop.removeEventListener("change", resize);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative lg:hidden" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="partner-mobile-account"
        onClick={() => setOpen(value => !value)}
        className={`inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green ${active ? "border-obligon-green bg-obligon-green text-white" : "border-obligon-border bg-white text-obligon-green"}`}
      >
        Account <ChevronDown size={16} aria-hidden="true" className={open ? "rotate-180" : ""} />
      </button>
      {open ? (
        <nav id="partner-mobile-account" aria-label="Partner account" className="fixed right-5 top-[72px] z-50 max-h-[calc(100dvh-10rem-env(safe-area-inset-bottom))] w-[min(288px,calc(100vw-40px))] overflow-y-auto overscroll-contain rounded-xl border border-obligon-border bg-white p-2 shadow-xl">
          {account.map(item => {
            const Icon = icons[item.icon];
            const current = isActive(pathname, item.href);
            return (
              <Link key={item.key} href={item.href} aria-current={current ? "page" : undefined} onClick={() => setOpen(false)} className={`flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-obligon-green ${current ? "bg-obligon-mist text-obligon-green" : "text-obligon-navy hover:bg-obligon-mist"}`}>
                <Icon size={20} aria-hidden="true" className="shrink-0" />{item.label}
              </Link>
            );
          })}
          <LogoutButton className="min-h-12 w-full justify-start rounded-lg px-3 text-sm text-obligon-navy hover:bg-obligon-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-obligon-green" />
        </nav>
      ) : null}
    </div>
  );
}

export function MobileDashboardNav() {
  const pathname = usePathname();
  const { user } = useSession();
  const isMechanic = user?.role === "mechanic";
  const { primary } = mobileItems(isMechanic);

  return (
    <nav aria-label="Partner primary" className={`fixed inset-x-0 bottom-0 z-40 grid h-[calc(74px+env(safe-area-inset-bottom))] border-t border-obligon-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden ${isMechanic ? "grid-cols-4" : "grid-cols-5"}`}>
      {primary.map(item => {
        const Icon = icons[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.key} href={item.href} aria-label={item.label} aria-current={active ? "page" : undefined} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-extrabold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-obligon-green sm:text-xs ${active ? "bg-obligon-mist text-obligon-green" : "text-obligon-text hover:bg-obligon-mist"}`}>
            {active ? <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 bg-obligon-green" /> : null}
            <Icon size={21} aria-hidden="true" />
            {compactLabels[item.key] ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}
