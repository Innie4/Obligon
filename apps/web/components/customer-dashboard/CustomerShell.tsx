"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CircleHelp, CreditCard, Grid2X2, History, MapPinned, Settings, WalletCards } from "lucide-react";
import { assets } from "@/components/landing/assets";
import { customerNav, secondaryCustomerNav, pageTitles, type CustomerPageKey } from "./customer-data";

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
  const active = pageForPath(pathname);

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-[#dbe2d8] bg-[#f7fbf8] px-4 py-8 lg:flex">
      <Link href="/customer" className="relative ml-8 block h-16 w-36" aria-label="Obligon customer dashboard">
        <Image src={assets.obligonLogo} alt="Obligon" fill sizes="144px" className="object-contain object-left" priority />
      </Link>

      <div className="mt-20 flex items-center gap-4 px-4">
        <span className="grid size-12 place-items-center rounded-full bg-[#dbe7ff] text-sm font-extrabold text-obligon-blue">FM</span>
        <div>
          <p className="font-extrabold text-obligon-green">Fleet Manager</p>
          <p className="text-sm text-obligon-text">Obligon Enterprise</p>
          <p className="text-xs font-medium text-[#3754a5]">Premium Account</p>
        </div>
      </div>

      <nav className="mt-12 space-y-3">
        {[...customerNav, ...secondaryCustomerNav].map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`flex h-12 items-center gap-3 rounded-lg px-4 text-base font-semibold ${
              active === item.key ? "bg-[#63b800] text-[#1b3c00]" : "text-[#3f463d] hover:bg-white"
            }`}
          >
            <span className={active === item.key ? "text-[#1b3c00]" : "text-[#3f463d]"}>{iconMap[item.key]}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <Link href="/customer/support" className="mt-auto flex items-center gap-3 px-4 text-base text-[#3f463d]">
        <CircleHelp size={20} />
        Support
      </Link>
    </aside>
  );
}

function MobileHeader() {
  return (
    <header className="flex h-[84px] items-center justify-between border-b border-[#e0e7de] bg-[#f7fbf8] px-8 lg:hidden">
      <Link href="/customer" className="relative h-11 w-28" aria-label="Obligon customer dashboard">
        <Image src={assets.obligonLogo} alt="Obligon" fill sizes="112px" className="object-contain object-left" priority />
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

  return (
    <header className="sticky top-0 z-30 hidden h-[74px] items-center justify-between border-b border-[#cfd8cc] bg-[#f7fbf8] px-16 lg:flex">
      <h1 className="font-display text-2xl font-extrabold tracking-normal text-[#20251f]">{pageTitles[page]}</h1>
      <div className="flex items-center gap-5">
        <Link href="/customer/notifications" className="text-[#3f463d]" aria-label="Notifications">
          <Bell size={21} />
        </Link>
        <Link href="/customer/profile" className="hidden rounded-full border border-[#dbe2d8] bg-white px-4 py-2 text-sm font-bold text-obligon-green xl:block">
          Fleet Manager
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

