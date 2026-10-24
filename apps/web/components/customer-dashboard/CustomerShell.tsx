"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DashboardLogo } from "@/components/shared/DashboardLogo";
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
import { customerNav, secondaryCustomerNav, pageTitles, type CustomerPageKey } from "@/lib/mock/customer-data";
import { useSession } from "@/components/shared/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { customerAccountLabel } from "@/lib/customer-entitlements";
import { CustomerAccessProvider, CustomerAccessBoundary, useCustomerAccess } from "./CustomerAccess";
import { DashboardSearch } from "@/components/shared/DashboardSearch";
import { CustomerThemeProvider } from "./CustomerTheme";
import "./customer-theme.css";

const customerSearchEntries = [
  ...[...customerNav, ...secondaryCustomerNav].map(item => ({ ...item, keywords: item.key === "card" ? "buy fuel authorize subscription renew plan" : item.key === "transactions" ? "transactions receipts reference" : "" })),
  { label: "Sign-in options", href: "/customer/profile#sign-in-options", keywords: "Google passkey password security" },
  { label: "Appearance", href: "/customer/profile#customer-appearance-title", keywords: "theme light dark" }
];

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
  const { data: subscription } = useCustomerAccess();
  const accountLabel = customerAccountLabel(subscription);
  const active = pageForPath(pathname);
  const accountKeys: CustomerPageKey[] = secondaryCustomerNav.map((item) => item.key);
  const [accountOpen, setAccountOpen] = useState(accountKeys.includes(active));

  const renderLink = (item: (typeof customerNav)[number]) => (
    <Link
      key={item.key}
      href={item.href}
      aria-current={active === item.key ? "page" : undefined}
      className={`flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-colors ${
        active === item.key ? "bg-obligon-mist text-obligon-green font-bold" : "text-[#4f5663] hover:bg-[#f2f6f2] hover:text-obligon-green"
      }`}
    >
      <span className={active === item.key ? "text-obligon-green" : "text-[#4f5663]"}>{iconMap[item.key]}</span>
      {item.label}
    </Link>
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-obligon-border bg-white px-5 py-6 lg:flex">
      <Link href="/customer" className="block shrink-0" aria-label="Obligon LTD customer dashboard">
        <DashboardLogo priority />
      </Link>

      <div className="mt-8 flex shrink-0 items-center gap-3 rounded-xl bg-obligon-mist/60 p-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-obligon-lime/30 text-sm font-extrabold text-[#131f00]">{user?.initials ?? "FM"}</span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-obligon-navy truncate text-sm">{user?.name ?? "Customer"}</p>
          <p className="text-xs text-obligon-text truncate">Customer account</p>
          <p className="text-xs font-bold text-obligon-green mt-0.5">{accountLabel}</p>
        </div>
      </div>

      <nav className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
        {customerNav.map(renderLink)}

        <button
          type="button"
          onClick={() => setAccountOpen((open) => !open)}
          aria-expanded={accountOpen}
          className={`flex h-12 w-full items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-colors ${
            accountKeys.includes(active) ? "bg-obligon-mist text-obligon-green font-bold" : "text-[#4f5663] hover:bg-[#f2f6f2] hover:text-obligon-green"
          }`}
        >
          <span className={accountKeys.includes(active) ? "text-obligon-green" : "text-[#4f5663]"}>
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

      <LogoutButton className="mt-auto shrink-0 w-full justify-start gap-3 px-4 py-3 rounded-xl text-[#4f5663] hover:bg-[#f2f6f2] hover:text-obligon-green" />
    </aside>
  );
}

function MobileCustomerAccount() {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setAccountOpen(false), [pathname]);
  useEffect(() => {
    if (!accountOpen) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const resize = () => { if (desktop.matches) setAccountOpen(false); };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        buttonRef.current?.focus();
      }
    };
    resize();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    desktop.addEventListener("change", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      desktop.removeEventListener("change", resize);
    };
  }, [accountOpen]);

  return <div ref={containerRef} className="relative" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAccountOpen(false);
  }}>
    <button ref={buttonRef} type="button" aria-expanded={accountOpen} aria-controls={accountOpen ? "customer-mobile-account" : undefined} onClick={() => setAccountOpen(open => !open)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-obligon-border bg-white px-2 text-sm font-bold text-obligon-green">
      Account <ChevronDown size={16} aria-hidden="true" className={accountOpen ? "rotate-180" : ""} />
    </button>
    {accountOpen ? <nav id="customer-mobile-account" aria-label="Customer account" className="fixed right-4 top-[76px] z-50 max-h-[calc(100dvh-10rem-env(safe-area-inset-bottom))] w-[min(270px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-xl border border-obligon-border bg-white p-2 shadow-xl">
      {secondaryCustomerNav.map(item => <Link key={item.key} href={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={() => setAccountOpen(false)} className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-obligon-navy hover:bg-obligon-mist">
        {iconMap[item.key]} {item.label}
      </Link>)}
      <LogoutButton className="min-h-12 w-full justify-start rounded-lg px-3 text-sm text-obligon-navy hover:bg-obligon-mist" />
    </nav> : null}
  </div>;
}

function MobileHeader() {
  return (
    <header className="sticky top-0 z-[45] flex min-h-[84px] items-center justify-between gap-2 border-b border-obligon-border bg-white px-3 sm:px-5 lg:hidden">
      <Link href="/customer" className="block shrink-0" aria-label="Obligon LTD customer dashboard">
        <DashboardLogo width={88} priority />
      </Link>
      <div className="flex min-w-0 items-center gap-1">
      <DashboardSearch scope="customer" entries={customerSearchEntries} compact />
      <Link href="/customer/notifications" className="grid size-11 place-items-center text-obligon-green" aria-label="Notifications">
        <Bell size={22} fill="currentColor" />
      </Link>
      <MobileCustomerAccount />
      </div>
    </header>
  );
}

function DesktopHeader() {
  const pathname = usePathname();
  const page = pageForPath(pathname);
  const { user } = useSession();

  return (
    <header className="sticky top-0 z-30 hidden min-h-[74px] items-center justify-between gap-5 border-b border-obligon-border bg-white/95 px-8 backdrop-blur-sm lg:flex xl:px-12">
      <h1 className="min-w-0 font-display text-lg font-bold tracking-tight sm:text-xl text-[#20251f] xl:text-2xl">{pageTitles[page]}</h1>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
        <DashboardSearch scope="customer" entries={customerSearchEntries} />
        <Link href="/customer/notifications" className="grid size-11 shrink-0 place-items-center rounded-xl text-obligon-text transition-colors hover:bg-obligon-mist" aria-label="Notifications">
          <Bell size={21} />
        </Link>
        <Link href="/customer/profile" className="hidden max-w-[180px] truncate rounded-full border border-obligon-border bg-white px-4 py-2 text-sm font-bold text-obligon-green xl:block">
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
    <nav className="fixed inset-x-0 bottom-0 z-40 grid min-h-[74px] grid-cols-5 border-t border-obligon-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      {customerNav.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active === item.key ? "page" : undefined}
          className={`relative flex min-h-[74px] flex-col items-center justify-center gap-1 text-xs font-semibold ${
            active === item.key ? "text-obligon-green" : "text-[#3f463d]"
          }`}
        >
          {active === item.key ? <span className="absolute top-1 h-1 w-8 rounded-full bg-obligon-green" /> : null}
          {iconMap[item.key]}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function CustomerShellContents({ children }: CustomerShellProps) {
  const { data, status, error } = useCustomerAccess();
  const active = status === "success" && !error && data?.active === true;
  return <CustomerThemeProvider enabled={active}>
    <main className="min-h-screen bg-obligon-mist/50 text-obligon-navy">
      {active ? <Sidebar /> : null}
      <div className={active ? "lg:pl-64" : ""}>
        {active ? <><DesktopHeader /><MobileHeader /></> : <header className="flex min-h-[84px] items-center justify-between gap-4 border-b border-obligon-border bg-white px-4 sm:px-8">
          <Link href="/customer/card" aria-label="Obligon LTD My Card"><DashboardLogo priority /></Link>
          <LogoutButton className="min-h-11 shrink-0 rounded-xl border border-obligon-border px-4 text-sm font-bold text-obligon-navy" />
        </header>}
        <CustomerAccessBoundary>{children}</CustomerAccessBoundary>
      </div>
      {active ? <MobileBottomNav /> : null}
    </main>
  </CustomerThemeProvider>;
}

export function CustomerShell({ children }: CustomerShellProps) {
  return <AuthGuard allowedRoles={["customer"]}>
    <CustomerAccessProvider><CustomerShellContents>{children}</CustomerShellContents></CustomerAccessProvider>
  </AuthGuard>;
}
