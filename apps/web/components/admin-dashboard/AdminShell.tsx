"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";
import { adminNav } from "./admin-data";

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#f7f7fd] text-obligon-navy">
      <AdminSidebar />
      {mobileMenuOpen ? <div className="fixed inset-0 z-50 bg-[#050816]/75 lg:hidden" onMouseDown={() => setMobileMenuOpen(false)}><aside role="dialog" aria-modal="true" aria-label="Admin navigation" onMouseDown={(event) => event.stopPropagation()} className="h-full w-[280px] bg-[#061958] p-6 text-white shadow-hero"><div className="flex items-center justify-between"><p className="font-display text-2xl font-extrabold">Obligon Admin</p><button type="button" onClick={() => setMobileMenuOpen(false)} className="grid size-10 place-items-center rounded-lg bg-white/10" aria-label="Close admin menu"><X size={20} /></button></div><nav className="mt-10 space-y-2">{adminNav.map((item) => <Link key={item.key} href={item.href} onClick={() => setMobileMenuOpen(false)} className="flex h-11 items-center rounded-lg px-4 text-sm font-bold text-[#dce4ff] hover:bg-white/10 hover:text-obligon-lime">{item.label}</Link>)}</nav></aside></div> : null}
      <div className="lg:pl-[280px]">
        <AdminHeader onOpenMenu={() => setMobileMenuOpen(true)} />
        {children}
      </div>
    </main>
  );
}
