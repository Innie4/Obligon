"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/shared/AuthContext";
import type { UserRole } from "@/lib/services/types";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { routes } from "@/components/site/routes";

export default function LoginPage() {
  const router = useRouter();
  const { status, user, login } = useSession();
  const [serverError, setServerError] = useState<string | null>(null);

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      router.push(routes.customerDashboard);
    }
  }, [user, router]);

const handleLogin = async (credentials: { email: string; password: string; role?: UserRole }) => {
  setServerError(null);
  try {
    await login(credentials);
    router.push(routes.customerDashboard);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid credentials. Please try again.";
    setServerError(message);
  }
};

  return (
    <AuthShell>
      <div className="w-full max-w-[400px] mx-auto p-8">
        <div className="rounded-2xl border border-obligon-border bg-white p-8 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Customer Login</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-obligon-navy">Welcome back</h2>
            </div>
            <div className="size-10 rounded-md bg-obligon-lime/20 text-obligon-green"></div>
          </div>

          {serverError && (
            <div className="mt-4 rounded-lg bg-[#fff0f0] border border-[#fecaca] p-3 text-sm text-[#93000a] flex items-start gap-2" role="alert">
              <span className="align-middle">{serverError}</span>
            </div>
          )}

          <form className="mt-8 space-y-4" onSubmit={e => {
            e.preventDefault();
            // In real app, would call login API
            const email = (e.target as any).email.value;
            const password = (e.target as any).password.value;
            const role = (e.target as any).role.value;
            handleLogin({ email, password, role });
          }}>
            <div className="relative">
              <label htmlFor="login-email" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                Corporate Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="james@enterprise.ng"
                className={`h-12 w-full rounded-lg border px-4 pl-10 pr-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 border-obligon-border bg-white`}
                required
                autoComplete="email"
              />
            </div>

            <div className="relative">
              <label htmlFor="login-password" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                placeholder="Enter password"
                className={`h-12 w-full rounded-lg border px-4 pl-10 pr-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 border-obligon-border bg-white`}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              <label className="inline-flex items-center gap-2 text-obligon-text cursor-pointer">
                <input type="checkbox" className="size-4 accent-obligon-green" />
                <span>Remember me</span>
              </label>
              <Link href={routes.forgotPassword} className="font-bold text-obligon-green hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className={`mt-6 w-full rounded-lg text-base font-bold text-white shadow-green transition`}
            >
              Secure Login
            </button>
          </form>
        </div>
      </div>
    </AuthShell>
  );
}