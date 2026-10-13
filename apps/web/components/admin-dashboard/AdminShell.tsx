"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";
import { adminNav } from "@/lib/mock/admin-data";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useDialogFocus } from "@/components/shared/useDialogFocus";

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  useDialogFocus(menuRef, () => setMobileMenuOpen(false), mobileMenuOpen);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <AuthGuard allowedRoles={["admin"]}>
      <main className="min-h-screen bg-[#f7f7fd] text-obligon-navy">
        <AdminSidebar />
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-[#050816]/75 lg:hidden" onMouseDown={() => setMobileMenuOpen(false)}>
          <aside ref={menuRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Admin navigation" onMouseDown={(event) => event.stopPropagation()} className="flex h-full w-[min(280px,100%)] flex-col overflow-y-auto bg-[#061958] p-6 text-white shadow-hero outline-none">
            <div className="flex shrink-0 items-center justify-between gap-3">
              <p className="font-display text-2xl font-extrabold">Obligon LTD Admin</p>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="grid size-11 shrink-0 place-items-center rounded-lg bg-white/10" aria-label="Close admin menu"><X size={20} /></button>
            </div>
            <nav aria-label="Admin sections" className="mt-8 space-y-2">
              {adminNav.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 items-center rounded-lg px-4 text-sm font-bold text-[#dce4ff] hover:bg-white/10 hover:text-obligon-lime">{item.label}</Link>)}
            </nav>
            <div className="mt-auto border-t border-white/20 pt-4">
              <LogoutButton className="min-h-11 w-full justify-start !text-white hover:!bg-white/10" />
            </div>
          </aside>
        </div>
      ) : null}
      <div className="lg:pl-[280px]">
        <AdminHeader onOpenMenu={() => setMobileMenuOpen(true)} />
        {children}
      </div>
      </main>
    </AuthGuard>
  );
}
