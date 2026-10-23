"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";
import { adminNav } from "@/lib/mock/admin-data";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { LogoutButton, SignInOptionsLink } from "@/components/auth/LogoutButton";
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
      <main className="min-h-screen bg-[#f8fafc] text-obligon-navy">
        <AdminSidebar />
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-[#050816]/75 lg:hidden" onMouseDown={() => setMobileMenuOpen(false)}>
          <aside ref={menuRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Admin navigation" onMouseDown={(event) => event.stopPropagation()} className="flex h-full w-[min(300px,100%)] flex-col overflow-y-auto border-r border-obligon-border bg-white p-5 text-obligon-navy shadow-lg outline-none">
            <div className="flex shrink-0 items-center justify-between gap-3">
              <p className="font-display text-xl font-bold">Admin workspace</p>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="grid size-11 shrink-0 place-items-center rounded-lg bg-obligon-mist" aria-label="Close admin menu"><X size={20} /></button>
            </div>
            <nav aria-label="Admin sections" className="mt-8 space-y-2">
              {adminNav.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-obligon-text hover:bg-obligon-mist hover:text-obligon-navy">{item.label}</Link>)}
            </nav>
            <div className="mt-auto border-t border-obligon-border pt-4">
              <SignInOptionsLink className="w-full justify-start" />
              <LogoutButton className="min-h-11 w-full justify-start" />
            </div>
          </aside>
        </div>
      ) : null}
      <div className="min-w-0 lg:pl-[280px]">
        <AdminHeader onOpenMenu={() => setMobileMenuOpen(true)} />
        {children}
      </div>
      </main>
    </AuthGuard>
  );
}
