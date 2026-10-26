"use client";

import { StatusPopup } from "@/components/shared/StatusPopup";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Loader2, Mail, Lock } from "lucide-react";
import { useSession } from "@/components/shared/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { routes } from "@/components/site/routes";
import { ToastProvider, useToast } from "@/components/shared/Toast";
import { api } from "@/lib/services";
import "@/components/admin-dashboard/admin.css";

export default function AdminLoginPage() {
  return <ToastProvider placement="center"><AdminLoginForm /></ToastProvider>;
}

function AdminLoginForm() {
  const router = useRouter();
  const { login, logout } = useSession();
  const { success: toastSuccess } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await login({ email: email.trim(), password, rememberMe, role: "admin" });
      if (result?.mfaRequired) {
        toastSuccess("Enter your authenticator code to continue.");
        router.push(routes.mfaChallenge);
        return;
      }
      const session = await api.getSession();
      if (!session || session.role !== "admin") {
        await logout();
        throw new Error("This account does not have admin access. Use the standard sign-in page for your account.");
      }
      toastSuccess("Signed in. Opening the admin workspace.");
      router.push(routes.adminDashboard);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid credentials. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="admin-workspace mx-auto w-full max-w-[480px] rounded-2xl p-4 sm:p-5">
        <div className="rounded-xl border border-obligon-border bg-white p-5 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="admin-login-heading">Admin sign in</h1>
            </div>
            <div className="grid size-11 place-items-center rounded-xl bg-obligon-lime/20 text-obligon-green">
              <ShieldCheck size={24} />
            </div>
          </div>

          <p className="mt-2 text-sm text-obligon-text">
            Use your administrator account to continue.
          </p>

          {error ? <StatusPopup tone="error" message={error} /> : null}
          {submitting ? <StatusPopup tone="pending" message="Signing in…" /> : null}

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <div>
              <label htmlFor="admin-email" className="text-sm font-semibold text-obligon-text block mb-1">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-obligon-text/50" />
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  className="h-12 w-full rounded-lg border border-obligon-border bg-white pl-10 pr-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="text-sm font-semibold text-obligon-text block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-obligon-text/50" />
                <input
                  id="admin-password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="h-12 w-full rounded-lg border border-obligon-border bg-white pl-10 pr-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 rounded border-obligon-border text-obligon-green accent-obligon-green focus:ring-obligon-green"
                />
                <span className="text-xs text-obligon-text font-medium">Remember me</span>
              </label>
              <Link href={routes.forgotPassword} className="text-xs font-bold text-obligon-green hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting || !email.trim() || !password}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-obligon-green text-base font-bold text-white transition hover:bg-obligon-green/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-obligon-border pt-4 text-center">
            <Link href={routes.login} className="text-xs font-bold text-obligon-text hover:text-obligon-green transition">
              Use Google or a passkey
            </Link>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
