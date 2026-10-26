"use client";

import { DashboardLogo } from "@/components/shared/DashboardLogo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, BarChart3, Building2, Grid2X2, Handshake, Settings, WalletCards } from "lucide-react";
import { adminNav } from "@/lib/mock/admin-data";
import { useSession } from "@/components/shared/AuthContext";
import { LogoutButton, SignInOptionsLink } from "@/components/auth/LogoutButton";

const icons = { dashboard: Grid2X2, transactions: WalletCards, fuelStations: Building2, analytics: BarChart3, partners: Handshake, settings: Settings, disputes: AlertTriangle };
const groups = [
  { label: "Workspace", paths: ["/admin", "/admin/intake"] },
  { label: "Review queues", paths: ["/admin/partner-applications", "/admin/discount-approvals", "/admin/customer-benefits", "/admin/operations", "/admin/disputes"] },
  { label: "Management", paths: ["/admin/reports", "/admin/staff"] },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useSession();
  return <aside className="admin-sidebar">
    <div className="admin-sidebar-brand">
      <Link href="/admin" aria-label="Obligon LTD home"><DashboardLogo priority width={155} /></Link>
      <p>Administration</p>
    </div>
    <nav aria-label="Admin sections">
      {groups.map(group => <div key={group.label} className="admin-nav-group">
        <p className="admin-nav-label">{group.label}</p>
        {adminNav.filter(item => group.paths.includes(item.href)).map(item => {
          const path = item.href;
          const Icon = icons[item.icon];
          const active = pathname === path || (path === "/admin" && pathname === "/admin/companies");
          return <Link key={path} href={path} aria-current={active ? "page" : undefined} className="admin-nav-link"><Icon size={18} className="shrink-0" aria-hidden="true" /><span>{item.label}</span></Link>;
        })}
      </div>)}
    </nav>
    <div className="admin-sidebar-footer">
      <div className="flex items-center gap-3 pb-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e5efdc] text-xs font-bold text-[#243f19]">{user?.initials ?? "OA"}</span>
        <div className="min-w-0"><p className="truncate text-xs font-semibold">{user?.name ?? "Administrator"}</p><p className="mt-1 text-xs opacity-75">Platform administrator</p></div>
      </div>
      <SignInOptionsLink className="min-h-11 w-full justify-start rounded-lg px-2 text-xs" />
      <LogoutButton className="min-h-11 w-full justify-start rounded-lg px-2 text-xs" />
    </div>
  </aside>;
}
