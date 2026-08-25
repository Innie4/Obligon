"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
import { assets } from "@/components/landing/assets";
import { companyNav, pageCopy, type CompanyPageKey } from "@/lib/mock/company-data";
import { useSession } from "@/components/shared/AuthContext";

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

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-[#dfe5ec] bg-white px-5 py-8 lg:flex">
      <Link href="/company" className="relative mx-auto block h-14 w-44" aria-label="Obligon LTD company dashboard">
        <Image src={assets.obligonLogo} alt="Obligon LTD" fill sizes="176px" className="object-contain" priority />
      </Link>
      <nav className="mt-10 flex-1 space-y-1 overflow-y-auto pr-1">
        {companyNav.map((item) => (
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
        <Link
          href="/company/maintenance"
          className={`flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-bold ${
            active === "maintenance" ? "bg-obligon-green text-white" : "text-[#4f5663] hover:bg-[#f2f6f2] hover:text-obligon-green"
          }`}
        >
          {iconMap.maintenance}
          Maintenance
        </Link>
      </nav>
      <div className="mt-6 rounded-lg bg-[#f2f6f2] p-4">
        <p className="text-sm font-extrabold text-[#07162f]">{user?.organization ?? "Obligon LTD Logistics Inc."}</p>
        <p className="mt-1 text-xs text-obligon-text">{user?.accountTier ?? "Enterprise Fleet"}</p>
      </div>
    </aside>
  );
}

function CompanyTopbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const page = pageCopy[activePage(pathname)];

  return (
    <header className="sticky top-0 z-30 border-b border-[#dfe5ec] bg-[#f8fafc]/95 backdrop-blur">
      <div className="flex h-16 items-center gap-4 px-5 lg:px-8">
        <button type="button" onClick={onOpenMenu} className="grid size-10 place-items-center rounded-lg border border-[#dfe5ec] bg-white lg:hidden" aria-label="Open company menu">
          <Menu size={20} />
        </button>
        <label className="hidden h-10 w-full max-w-[360px] items-center gap-3 rounded-lg border border-[#dfe5ec] bg-white px-3 md:flex">
          <Search size={16} className="text-[#808793]" />
          <input className="w-full bg-transparent text-sm outline-none placeholder:text-[#808793]" placeholder={page.search ?? "Search Obligon LTD..."} />
        </label>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/company/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-lg border border-[#dfe5ec] bg-white">
            <Bell size={18} />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-[#c1121f]" />
          </Link>
          <Link href="/company/settings" className="hidden text-right sm:block">
            <p className="text-sm font-extrabold text-[#07162f]">Fleet Admin</p>
            <p className="text-xs text-obligon-text">Obligon LTD Dashboard</p>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function CompanyShell({ children }: CompanyShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#07162f]">
      <CompanySidebar />
      {mobileMenuOpen ? <div className="fixed inset-0 z-50 bg-[#07162f]/55 lg:hidden" onMouseDown={() => setMobileMenuOpen(false)}><aside role="dialog" aria-modal="true" aria-label="Company navigation" onMouseDown={(event) => event.stopPropagation()} className="h-full w-[280px] overflow-y-auto bg-white p-5 shadow-hero"><div className="flex items-center justify-between"><p className="font-display text-xl font-extrabold">Menu</p><button type="button" onClick={() => setMobileMenuOpen(false)} className="grid size-10 place-items-center rounded-lg bg-[#f2f6fa]" aria-label="Close company menu"><X size={20} /></button></div><nav className="mt-7 space-y-1">{companyNav.map((item) => <Link key={item.key} href={item.href} onClick={() => setMobileMenuOpen(false)} className="flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-bold text-[#4f5663] hover:bg-[#f2f6f2] hover:text-obligon-green">{iconMap[item.key]}<span>{item.label}</span></Link>)}<Link href="/company/maintenance" onClick={() => setMobileMenuOpen(false)} className="flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-bold text-[#4f5663] hover:bg-[#f2f6f2] hover:text-obligon-green">{iconMap.maintenance}<span>Maintenance</span></Link></nav></aside></div> : null}
      <div className="lg:pl-[280px]">
        <CompanyTopbar onOpenMenu={() => setMobileMenuOpen(true)} />
        {children}
      </div>
    </main>
  );
}

