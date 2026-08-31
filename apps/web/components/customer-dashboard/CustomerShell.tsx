"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Grid2X2,
  History,
  MapPinned,
  Settings,
  WalletCards
} from "lucide-react";
import { assets } from "@/components/landing/assets";
import { customerNav, secondaryCustomerNav, pageTitles, type CustomerPageKey } from "@/lib/mock/customer-data";
import { useSession } from "@/components/shared/AuthContext";

type CustomerShellProps = {
  children: React.ReactNode;
};

const iconMap: Record<CustomerPageKey, React.ReactNode> = {
  overview: <Grid2X2 size={20} />,
  card: <CreditCard size={20} />,
  transactions: <History size={20} />,
  stations: <MapPinned size={20} />,
  support: <CircleHelp size={20} />,
  wallet: <WalletCards size={20} />,
  transactionDetail: <History size={20} />,
  reportProblem: <CircleHelp size={20} />,
  profile: <Settings size={20} />,
  notifications: <Bell size={20} />
};

function pageForPath(pathname: string): CustomerPageKey {
  if (pathname.includes("/transactions")) return "transactions";
  if (pathname.includes("/card")) return "card";
  if (pathname.includes("/wallet")) return "wallet";
  if (pathname.includes("/stations")) return "stations";
  if (pathname.includes("/support")) return "support";
  if (pathname.includes("/transaction-detail")) return "transactionDetail";
  if (pathname.includes("/report-problem")) return "reportProblem";
  if (pathname.includes("/profile")) return "profile";
  if (pathname.includes("/notifications")) return "notifications";
  return "overview";
}

function Sidebar() {
  const pathname = usePathname();
  const { user } = useSession();
  const active = pageForPath(pathname);
  const accountKeys: CustomerPageKey[] = secondaryCustomerNav.map((item) => item.key);
  const [accountOpen, setAccountOpen] = useState(accountKeys.includes(active));

  const renderLink = (item: (typeof customerNav)[number]) => (
    <Link
      key={item.key}
      href={item.href}
      className={`flex h-12 items-center gap-3 rounded-xl px-4 text-base font-semibold transition ${
        active === item.key ? "bg-obligon-green text-white font-bold shadow-green" : "text-[#4f5663] hover:bg-[#f2f6f2] hover:text-obligon-green"
      }`}
    >
      <span className={active === item.key ? "text-white" : "text-[#4f5663]"}>{iconMap[item.key]}</span>
      {item.label}
    </Link>
  );

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-[#dfe5ec] bg-white px-4 py-8 lg:flex">
      <Link href="/customer" className="relative ml-4 block h-16 w-44" aria-label="Obligon LTD customer dashboard">
        <Image src={assets.obligonLogo} alt="Obligon LTD" fill sizes="176px" className="object-contain object-left" priority />
      </Link>

      <div className="mt-10 flex items-center gap-3.5 rounded-xl bg-[#f7fbf8] p-3.5 border border-obligon-border">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-obligon-lime/30 text-sm font-extrabold text-[#131f00]">{user?.initials ?? "FM"}</span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-obligon-navy truncate text-sm">{user?.name ?? "Customer"}</p>
          <p className="text-xs text-obligon-text truncate">{user?.organization ?? "Fuelvista Consumer"}</p>
          <p className="text-[11px] font-bold text-obligon-green mt-0.5">{user?.accountTier ?? "Active Wallet"}</p>
        </div>
      </div>

      <nav className="mt-8 space-y-2 flex-1 overflow-y-auto pr-1">
        {customerNav.map(renderLink)}

        <button
          type="button"
          onClick={() => setAccountOpen((open) => !open)}
          aria-expanded={accountOpen}
          className={`flex h-12 w-full items-center gap-3 rounded-xl px-4 text-base font-semibold transition ${
            accountKeys.includes(active) ? "bg-obligon-green text-white font-bold shadow-green" : "text-[#4f5663] hover:bg-[#f2f6f2] hover:text-obligon-green"
          }`}
        >
          <span className={accountKeys.includes(active) ? "text-white" : "text-[#4f5663]"}>
            <Settings size={20} />
          </span>
          Account
          <ChevronDown
            size={18}
            className={`ml-auto transition-transform ${accountOpen ? "rotate-180" : ""}`}
          />
        </button>

        {accountOpen ? <div className="space-y-2 pl-4 border-l-2 border-obligon-border/60 ml-2 mt-1">{secondaryCustomerNav.map(renderLink)}</div> : null}
      </nav>

      <Link href="/customer/support" className="mt-auto flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-[#4f5663] hover:bg-[#f2f6f2] hover:text-obligon-green transition">
        <CircleHelp size={20} />
        Customer Support
      </Link>
    </aside>
  );
}

function MobileHeader() {
  return (
    <header className="flex h-[84px] items-center justify-between border-b border-[#e0e7de] bg-[#f7fbf8] px-8 lg:hidden">
      <Link href="/customer" className="relative h-14 w-36" aria-label="Obligon LTD customer dashboard">
        <Image src={assets.obligonLogo} alt="Obligon LTD" fill sizes="144px" className="object-contain object-left" priority />
      </Link>
      <Link href="/customer/notifications" className="text-obligon-green" aria-label="Notifications">
        <Bell size={22} fill="currentColor" />
      </Link>
    </header>
  );
}

function DesktopHeader() {
  const pathname = usePathname();
  const page = pageForPath(pathname);
  const { user } = useSession();

  return (
    <header className="sticky top-0 z-30 hidden h-[74px] items-center justify-between border-b border-[#cfd8cc] bg-[#f7fbf8] px-16 lg:flex">
      <h1 className="font-display text-2xl font-extrabold tracking-normal text-[#20251f]">{pageTitles[page]}</h1>
      <div className="flex items-center gap-5">
        <Link href="/customer/notifications" className="text-[#3f463d]" aria-label="Notifications">
          <Bell size={21} />
        </Link>
        <Link href="/customer/profile" className="hidden rounded-full border border-[#dbe2d8] bg-white px-4 py-2 text-sm font-bold text-obligon-green xl:block">
          {user?.name ?? "Guest"}
        </Link>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();
  const active = pageForPath(pathname);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[74px] grid-cols-5 border-t border-[#cfd8cc] bg-[#f7fbf8] lg:hidden">
      {customerNav.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold ${
            active === item.key ? "text-obligon-green" : "text-[#3f463d]"
          }`}
        >
          {active === item.key ? <span className="absolute top-1 h-0.5 w-16 bg-obligon-green" /> : null}
          {iconMap[item.key]}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function CustomerShell({ children }: CustomerShellProps) {
  return (
    <main className="min-h-screen bg-[#f7fbf8] text-[#20251f]">
      <Sidebar />
      <div className="lg:pl-64">
        <DesktopHeader />
        <MobileHeader />
        {children}
      </div>
      <MobileBottomNav />
    </main>
  );
}

