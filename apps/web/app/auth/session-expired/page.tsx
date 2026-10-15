"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, AlertTriangle } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { routes } from "@/components/site/routes";
import { useSession } from "@/components/shared/AuthContext";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/services";
import { dashboardDestination } from "@/lib/auth-routing";

export default function SessionExpiredPage() {
  const router = useRouter();
  const { login } = useSession();
  const { error: toastError, success: toastSuccess } = useToast();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both email and password");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await login({ email: email.trim(), password });
      if (result.mfaRequired) {
        router.push(routes.mfaChallenge);
        return;
      }
      const session = await api.getSession();
      if (!session) throw new Error("Your session could not be verified. Please sign in again.");
      toastSuccess("Welcome back!");
      router.push(dashboardDestination(session.role));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setError(message);
      toastError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell compact>
      <section className="w-full max-w-[440px] mx-auto rounded-3xl border border-obligon-border bg-white p-8 shadow-card">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-[#fff3d8] text-[#9a6300]">
          <Clock size={32} />
        </div>
        <h1 className="mt-8 text-center font-display text-3xl font-extrabold leading-10 text-obligon-navy">
          Session Expired
        </h1>
        <p className="mt-4 text-center text-base leading-6 text-obligon-text">
          Your session has timed out for security. Please sign in again to continue.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div className="relative">
            <label htmlFor="reauth-email" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
              Email address
            </label>
            <input
              id="reauth-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              className="h-12 w-full rounded-lg border border-obligon-border bg-white px-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
              required
              autoComplete="email"
              disabled={submitting}
            />
          </div>
          <div className="relative">
            <label htmlFor="reauth-password" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
              Password
            </label>
            <input
              id="reauth-password"
              name="password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              className="h-12 w-full rounded-lg border border-obligon-border bg-white px-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
              required
              autoComplete="current-password"
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-[#fff0f0] border border-[#fecaca] p-3 text-sm text-[#93000a] flex items-start gap-2" role="alert">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-obligon-green text-base font-bold text-white shadow-green"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign In Again"}
          </button>
        </form>

        <Link href={routes.forgotPassword} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-obligon-green hover:underline">
          Forgot password?
        </Link>
        <Link href={routes.login} className="mt-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[1.2px] text-obligon-green">
          <ArrowLeft size={16} />
          Back to Login
        </Link>
      </section>
    </AuthShell>
  );
}
