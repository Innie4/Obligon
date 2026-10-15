"use client";

import { DashboardLogo } from "@/components/shared/DashboardLogo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/components/shared/useDialogFocus";
import {
  BarChart3,
  Bell,
  Car,
  CreditCard,
  FileText,
  Fuel,
  HelpCircle,
  LayoutDashboard,
  MapPinned,
  Menu,
  Search,
  Settings,
  ShieldAlert,
  Users,
  Wrench,
  X
} from "lucide-react";
import { companyNav, type CompanyPageKey } from "@/lib/mock/company-data";
import { useSession } from "@/components/shared/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CompanyContextSelector, ReturnToPrimaryAccount } from "@/components/company-dashboard/CompanyContextSelector";
import { LogoutButton } from "@/components/auth/LogoutButton";

type CompanyShellProps = {
  children: React.ReactNode;
};

const iconMap: Record<CompanyPageKey, React.ReactNode> = {
  overview: <LayoutDashboard size={19} />,
  vehicles: <Car size={19} />,
  cards: <CreditCard size={19} />,
  transactions: <FileText size={19} />,
  reports: <BarChart3 size={19} />,
  stations: <MapPinned size={19} />,
  roadside: <ShieldAlert size={19} />,
  billing: <Fuel size={19} />,
  team: <Users size={19} />,
  notifications: <Bell size={19} />,
  support: <HelpCircle size={19} />,
  settings: <Settings size={19} />,
  maintenance: <Wrench size={19} />
};

function activePage(pathname: string): CompanyPageKey {
  if (pathname.includes("/vehicles")) return "vehicles";
  if (pathname.includes("/cards")) return "cards";
  if (pathname.includes("/transactions")) return "transactions";
  if (pathname.includes("/reports")) return "reports";
  if (pathname.includes("/stations")) return "stations";
  if (pathname.includes("/roadside")) return "roadside";
  if (pathname.includes("/billing")) return "billing";
  if (pathname.includes("/team")) return "team";
  if (pathname.includes("/notifications")) return "notifications";
  if (pathname.includes("/support")) return "support";
  if (pathname.includes("/settings")) return "settings";
  if (pathname.includes("/maintenance")) return "maintenance";
  return "overview";
}

function CompanySidebar() {
  const pathname = usePathname();
  const { user } = useSession();
  const active = activePage(pathname);
  const visibleNav = user?.organizationVerificationStatus === "verified" ? companyNav : companyNav.filter(item => ["overview", "support", "settings", "notifications"].includes(item.key));

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-[#dfe5ec] bg-white px-6 py-8 lg:flex">
      <Link href="/company" className="block" aria-label="Obligon company dashboard">
        <DashboardLogo priority />
      </Link>
      <nav className="mt-10 flex-1 space-y-1 overflow-y-auto pr-1">
        {visibleNav.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-bold ${
              active === item.key ? "bg-obligon-green text-white" : "text-[#4f5663] hover:bg-[#f2f6f2] hover:text-obligon-green"
            }`}
          >
            {iconMap[item.key]}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-6 rounded-lg bg-[#f2f6f2] p-4">
        <p className="text-sm font-extrabold text-[#07162f]">{user?.organization || "Your company"}</p>
        <div className="mt-4"><CompanyContextSelector compact /></div>
        <p className="mt-1 text-xs text-obligon-text">Company workspace</p>
        <ReturnToPrimaryAccount />
      </div>
      <LogoutButton className="mt-3 w-full justify-start" />
    </aside>
  );
}

function CompanyTopbar({ onOpenMenu, menuButtonRef }: { onOpenMenu: () => void; menuButtonRef?: React.RefObject<HTMLButtonElement | null> }) {
  const pathname = usePathname();
  const { user } = useSession();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const visibleNav = user?.organizationVerificationStatus === "verified" ? companyNav : companyNav.filter(item => ["overview", "support", "settings", "notifications"].includes(item.key));
  const filteredNav = visibleNav.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <header className="sticky top-0 z-30 border-b border-[#dfe5ec] bg-[#f8fafc]/95 backdrop-blur">
      <div className="flex h-16 items-center gap-4 px-5 lg:px-8">
        <button ref={menuButtonRef} type="button" onClick={onOpenMenu} className="grid size-10 place-items-center rounded-lg border border-[#dfe5ec] bg-white lg:hidden" aria-label="Open company menu">
          <Menu size={20} />
        </button>
        <div
          className="relative hidden w-full max-w-[360px] md:block"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchOpen(false);
          }}
        >
          <label className="flex h-10 w-full items-center gap-3 rounded-lg border border-[#dfe5ec] bg-white px-3">
            <Search size={16} className="text-[#808793]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchOpen(false);
                  event.currentTarget.blur();
                }
              }}
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#808793]"
              placeholder="Search dashboard sections"
              role="combobox"
              aria-expanded={searchOpen}
              aria-controls="company-search-results"
              aria-autocomplete="list"
              aria-label="Search dashboard sections"
            />
          </label>
          {searchOpen ? (
            <ul id="company-search-results" role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-72 overflow-y-auto rounded-lg border border-[#dfe5ec] bg-white p-1.5 shadow-hero">
              {filteredNav.length ? (
                filteredNav.map((item) => (
                  <li key={item.key} role="option" aria-selected={activePage(pathname) === item.key}>
                    <Link
                      href={item.href}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSearchOpen(false);
                        setQuery("");
                      }}
                      className={`block rounded-md px-3 py-2 text-sm font-bold ${activePage(pathname) === item.key ? "bg-[#f2f6f2] text-obligon-green" : "text-[#4f5663] hover:bg-[#f2f6f2]"}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm font-medium text-obligon-text" role="status">No matching sections.</li>
              )}
            </ul>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/company/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-lg border border-[#dfe5ec] bg-white">
            <Bell size={18} />
          </Link>
          <Link href="/company/settings" className="hidden text-right sm:block">
            <p className="text-sm font-extrabold text-[#07162f]">{user?.name || "Your account"}</p>
            <p className="max-w-[240px] break-words text-xs text-obligon-text">{user?.organization || "Company dashboard"}</p>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function CompanyShell({ children }: CompanyShellProps) {
  const { user } = useSession();
  const pathname = usePathname();
  const approved = user?.organizationVerificationStatus === "verified";
  const visibleNav = approved ? companyNav : companyNav.filter(item => ["overview", "support", "settings", "notifications"].includes(item.key));
  const onboardingPage = ["support", "settings", "notifications"].includes(activePage(pathname));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const previousOrganization = useRef(user?.organizationId);
  useDialogFocus(mobileMenuRef, () => setMobileMenuOpen(false), mobileMenuOpen);
  useEffect(() => {
    if (previousOrganization.current === user?.organizationId) return;
    previousOrganization.current = user?.organizationId;
    setMobileMenuOpen(false);
    if (mobileMenuOpen) menuButtonRef.current?.focus();
  }, [user?.organizationId, mobileMenuOpen]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <AuthGuard>
      {user?.organizationType !== "company" ? <main className="flex min-h-screen items-center justify-center bg-obligon-mist p-5"><section aria-labelledby="company-context-title" className="w-full max-w-lg space-y-5 rounded-2xl border border-obligon-border bg-white p-6 shadow-card"><h1 id="company-context-title" className="font-display text-2xl font-extrabold">Choose your company</h1><p className="text-sm leading-6 text-obligon-text">Select a fleet you belong to. Your account type stays the same.</p><CompanyContextSelector /><ReturnToPrimaryAccount /><LogoutButton /></section></main> :
      <main key={user.organizationId} className="min-h-screen bg-[#f8fafc] text-[#07162f]">
        <CompanySidebar />
      {mobileMenuOpen ? <div className="fixed inset-0 z-50 bg-[#07162f]/55 lg:hidden" onMouseDown={() => setMobileMenuOpen(false)}><aside ref={mobileMenuRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Company navigation" onMouseDown={(event) => event.stopPropagation()} className="h-full w-[280px] max-w-[90vw] overflow-y-auto bg-white p-5 shadow-hero"><div className="flex items-center justify-between"><p className="font-display text-xl font-extrabold">Menu</p><button type="button" onClick={() => setMobileMenuOpen(false)} className="grid size-10 place-items-center rounded-lg bg-[#f2f6fa]" aria-label="Close company menu"><X size={20} /></button></div><nav className="mt-7 space-y-1">{visibleNav.map((item) => <Link key={item.key} href={item.href} onClick={() => setMobileMenuOpen(false)} className="flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-bold text-[#4f5663] hover:bg-[#f2f6f2] hover:text-obligon-green">{iconMap[item.key]}<span>{item.label}</span></Link>)}</nav><CompanyContextSelector compact /><ReturnToPrimaryAccount /><LogoutButton className="mt-6 w-full justify-start" /></aside></div> : null}
      <div className="lg:pl-[280px]">
        <CompanyTopbar menuButtonRef={menuButtonRef} onOpenMenu={() => setMobileMenuOpen(true)} />
        {user.organizationVerificationStatus !== "verified" ? <section role="status" className="mx-5 mt-5 rounded-xl border border-obligon-border bg-white p-5 lg:mx-8"><h2 className="text-lg font-extrabold">Contract approval required</h2><p className="mt-2 text-sm leading-6">Company operations become available after your contract is agreed and an admin approves your company. Refresh this page after approval.</p><Link href="/company/support" className="mt-3 inline-flex min-h-11 items-center font-bold text-obligon-green underline">Contact Support</Link></section> : null}
        {approved || onboardingPage ? children : null}
      </div>
      </main>}
    </AuthGuard>
  );
}
