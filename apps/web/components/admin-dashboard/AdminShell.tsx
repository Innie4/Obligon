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
import { ToastProvider } from "@/components/shared/Toast";
import { useSession } from "@/components/shared/AuthContext";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_PAGES, adminPageForPath, hasAdminPage } from "../../../../packages/shared/admin-access.mjs";
import "./admin.css";

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const { status, user } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const page = adminPageForPath(pathname);
  const canOpen = Boolean(page && hasAdminPage(user, page));
  const firstPage = ADMIN_PAGES.find(item => hasAdminPage(user, item.key));
  const visibleNav = adminNav.filter(item => {
    const key = adminPageForPath(item.href);
    return key && hasAdminPage(user, key);
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  useDialogFocus(menuRef, () => setMobileMenuOpen(false), mobileMenuOpen);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (status === "authenticated" && user?.role === "admin" && !canOpen && firstPage) router.replace(firstPage.href);
  }, [status, user?.role, canOpen, firstPage, router]);

  return (
    <ToastProvider placement="center">
    <AuthGuard allowedRoles={["admin"]}>
      <main className="admin-workspace min-h-screen text-obligon-navy">
        <a href="#admin-content" className="admin-skip-link">Skip to page content</a>
        <AdminSidebar />
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-[#050816]/75 lg:hidden" onMouseDown={() => setMobileMenuOpen(false)}>
          <aside ref={menuRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Admin navigation" onMouseDown={(event) => event.stopPropagation()} className="admin-mobile-menu flex h-full w-[min(320px,100%)] flex-col overflow-y-auto p-5 shadow-lg outline-none">
            <div className="flex shrink-0 items-center justify-between gap-3">
              <p className="font-display text-xl font-bold">Administration</p>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="grid size-11 shrink-0 place-items-center rounded-lg bg-obligon-mist" aria-label="Close admin menu"><X size={20} /></button>
            </div>
            <nav aria-label="Admin sections" className="mt-8 space-y-2">
              {visibleNav.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="admin-mobile-link">{item.label}</Link>)}
            </nav>
            <div className="mt-auto border-t border-obligon-border pt-4">
              <SignInOptionsLink className="w-full justify-start" />
              <LogoutButton className="min-h-11 w-full justify-start" />
            </div>
          </aside>
        </div>
      ) : null}
      <div className="admin-main min-w-0 lg:pl-[260px]">
        <AdminHeader onOpenMenu={() => setMobileMenuOpen(true)} />
        <div id="admin-content" className="admin-content" tabIndex={-1}>{canOpen ? children : <StatusPopup tone={firstPage ? "loading" : "error"} message={firstPage ? "Opening your assigned workspace…" : "No admin pages are assigned to this account. Ask a Super Admin to update your access, or sign out."} />}</div>
      </div>
      </main>
    </AuthGuard>
    </ToastProvider>
  );
}
