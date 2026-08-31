"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Loader2, Mail, Lock, AlertTriangle } from "lucide-react";
import { useSession } from "@/components/shared/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useSession();
  const { success: toastSuccess, error: toastError } = useToast();

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
      await login({ email, password, role: "admin" });
      toastSuccess("Admin authorization granted. Welcome back.");
      router.push(routes.adminDashboard);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid credentials. Please try again.";
      setError(message);
      toastError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full max-w-[440px] mx-auto p-4 sm:p-6">
        <div className="rounded-2xl border border-obligon-border bg-white p-8 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Admin Portal</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-obligon-navy">Admin Access</h2>
            </div>
            <div className="grid size-11 place-items-center rounded-xl bg-obligon-lime/20 text-obligon-green">
              <ShieldCheck size={24} />
            </div>
          </div>

          <p className="mt-2 text-sm text-obligon-text">
            Enter your internal administrative credentials to access the oversight system.
          </p>

          {error && (
            <div className="mt-5 rounded-lg bg-[#fff0f0] border border-[#fecaca] p-3 text-sm text-[#93000a] flex items-start gap-2" role="alert">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <div>
              <label htmlFor="admin-email" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-obligon-text/50" />
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  placeholder="admin@obligon.energy"
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
              <label htmlFor="admin-password" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
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

            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 rounded border-obligon-border text-obligon-green accent-obligon-green focus:ring-obligon-green"
                />
                <span className="text-xs text-obligon-text font-medium">Remember credentials</span>
              </label>
              <Link href={routes.forgotPassword} className="text-xs font-bold text-obligon-green hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting || !email.trim() || !password}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-obligon-green text-base font-bold text-white shadow-green transition hover:bg-obligon-green/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                "Authenticate Admin"
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-obligon-border pt-4 text-center">
            <Link href={routes.login} className="text-xs font-bold text-obligon-text hover:text-obligon-green transition">
              ← Return to Standard Customer / Partner Login
            </Link>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
