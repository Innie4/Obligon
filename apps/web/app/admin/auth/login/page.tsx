"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "@/components/shared/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";

export default function AdminLoginPage() {
  const router = useRouter();
  const { status, user, login } = useSession();

  // If already logged in as admin, redirect to admin dashboard
  useEffect(() => {
    if (user && user.role === "admin") {
      router.push("/admin/dashboard");
    }
  }, [user, router]);

  const [serverError, setServerError] = useState<string | null>(null);

  const handleLogin = async (credentials: { email: string; password: string }) => {
    setServerError(null);
    try {
      await login(credentials);
      router.push("/admin/dashboard");
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
              <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Admin Login</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-obligon-navy">Welcome back, Admin</h2>
            </div>
            <div className="size-10 rounded-md bg-obligon-lime/20 text-obligon-green" />
          </div>

          {serverError && (
            <div className="mt-4 rounded-lg bg-[#fff0f0] border border-[#fecaca] p-3 text-sm text-[#93000a] flex items-start gap-2" role="alert">
              <span>{serverError}</span>
            </div>
          )}

          <form className="mt-8 space-y-4" onSubmit={e => {
            e.preventDefault();
            const email = (e.target as any).email.value;
            const password = (e.target as any).password.value;
            handleLogin({ email, password });
          }}>
            <div className="relative">
              <label htmlFor="admin-email" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                Admin Email
              </label>
              <input
                id="admin-email"
                name="email"
                type="email"
                placeholder="admin@obligon.com"
                className={`h-12 w-full rounded-lg border px-4 pl-10 pr-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 border-obligon-border bg-white`}
                required
                autoComplete="email"
              />
            </div>

            <div className="relative">
              <label htmlFor="admin-password" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                Password
              </label>
              <input
                id="admin-password"
                name="password"
                type="password"
                placeholder="Enter password"
                className={`h-12 w-full rounded-lg border px-4 pl-10 pr-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 border-obligon-border bg-white`}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              <div className="size-4 accent-obligon-green" />
              <span>Remember me</span>
            </div>

            <button
              type="submit"
              className={`mt-6 w-full rounded-lg text-base font-bold text-white shadow-green transition`}
            >
              Admin Login
            </button>
          </form>
        </div>
      </div>
    </AuthShell>
  );
}