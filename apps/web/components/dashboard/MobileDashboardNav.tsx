"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNav } from "@/lib/mock/dashboard-data";
import { useSession } from "@/components/shared/AuthContext";

export function MobileDashboardNav() {
  const pathname = usePathname();
  const { user } = useSession();
  const mechanicKeys = new Set(["overview", "transactions", "reports", "staff", "disputes", "notifications", "settings"]);
  const items = user?.role === "mechanic" ? dashboardNav.filter((item) => mechanicKeys.has(item.key)) : dashboardNav;

  return (
    <div className="border-b border-obligon-border bg-white px-5 py-3 lg:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
              pathname === item.href ? "bg-obligon-green text-white" : "bg-obligon-mist text-obligon-text"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

