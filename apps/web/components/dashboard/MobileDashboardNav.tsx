"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNav } from "@/lib/mock/dashboard-data";

export function MobileDashboardNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-obligon-border bg-white px-5 py-3 lg:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {dashboardNav.map((item) => (
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

