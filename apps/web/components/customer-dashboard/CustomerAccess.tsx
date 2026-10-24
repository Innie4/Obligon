"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, CreditCard, LockKeyhole } from "lucide-react";
import { useSession } from "@/components/shared/AuthContext";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { useAsync, type AsyncResult } from "@/components/shared/useAsync";
import { usePolling } from "@/components/shared/usePolling";
import { api } from "@/lib/services";
import type { CustomerEntitlementState } from "@/lib/customer-entitlements";

const CustomerAccessContext = React.createContext<AsyncResult<CustomerEntitlementState> | null>(null);

export function CustomerAccessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  return <CustomerAccessSession key={user?.id ?? "signed-out"}>{children}</CustomerAccessSession>;
}

function CustomerAccessSession({ children }: { children: React.ReactNode }) {
  const result = useAsync(() => api.request<CustomerEntitlementState>("/api/customer/subscription"));
  usePolling(result.refresh, { intervalMs: 4000 });
  return <CustomerAccessContext.Provider value={result}>{children}</CustomerAccessContext.Provider>;
}

export function useCustomerAccess() {
  const state = React.useContext(CustomerAccessContext);
  if (!state) throw new Error("Customer access must be read inside CustomerAccessProvider");
  return state;
}

export function CustomerAccessBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data, status, error, reload } = useCustomerAccess();
  if (status === "loading") return <StatusPopup tone="loading" message="Checking your subscription…" dismissible={false} />;
  if (error || status === "error") return <StatusPopup tone="error" message="Your subscription could not be checked. Try again or sign in again to continue." onRetry={reload} dismissible={false} action={<Link href="/auth/login" className="inline-flex min-h-11 items-center rounded-lg border border-obligon-border px-4 text-sm font-bold text-obligon-navy">Sign in again</Link>} />;
  if (data?.active || pathname === "/customer/card") return <>{children}</>;
  return <section className="mx-auto flex min-h-[70dvh] max-w-2xl items-center px-5 py-12 sm:px-8">
    <div className="w-full">
      <div aria-hidden="true" className="relative mb-8 flex h-32 items-center justify-center rounded-3xl bg-obligon-mist">
        <CreditCard size={76} strokeWidth={1.25} className="text-obligon-green" />
        <span className="absolute bottom-5 right-[calc(50%-64px)] grid size-11 place-items-center rounded-full border-4 border-white bg-obligon-green text-white"><LockKeyhole size={18} /></span>
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-obligon-green">Your customer account</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-obligon-navy sm:text-4xl">Choose a plan to continue</h1>
      <p className="mt-4 max-w-lg text-base leading-7 text-obligon-text">Subscribe to unlock your customer dashboard. Confirmed plan payment gives you access. Your card becomes available after identity verification and approval.</p>
      <Link href="/customer/card" className="mt-7 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-obligon-green px-6 font-bold text-white">Choose a plan <ArrowRight size={18} aria-hidden="true" /></Link>
      <p className="mt-5 text-sm leading-6 text-obligon-text">Already paid? Open My Card to check your payment and complete verification.</p>
    </div>
  </section>;
}
