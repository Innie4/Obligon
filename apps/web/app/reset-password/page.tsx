"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ArrowLeft, KeyRound, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";
import { authApi } from "@/lib/services";

/**
 * Step 2 of password recovery: the user received a 6-digit code via
 * forgot-password; here they enter it together with a new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();

  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const emailParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("email") : null;
    if (emailParam) setEmail(emailParam);
  }, []);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter the email you reset the password for";
    if (!/^\d{6}$/.test(code)) errors.code = "Enter the 6-digit code from your email or SMS";
    if (newPassword.length < 8) errors.newPassword = "New password must be at least 8 characters";
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) errors.newPassword = "Use at least one letter and one number";
    if (newPassword !== confirmPassword) errors.confirmPassword = "Passwords do not match";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword({ email, code, newPassword });
      setSubmitting(false);
      setDone(true);
      toastSuccess("Password updated. You can now sign in with your new password.");
    } catch (err) {
      setSubmitting(false);
      const message = err instanceof Error ? err.message : "Could not reset the password. Please try again.";
      setError(message);
      toastError(message);
    }
  }

  const inputClass = (field: string) =>
    `h-12 w-full rounded-lg border px-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 ${
      fieldErrors[field] || error ? "border-[#fecaca] bg-[#fff0f0]" : "border-obligon-border bg-white"
    }`;

  return (
    <AuthShell compact>
      <section className="w-full max-w-[440px] rounded-3xl border border-obligon-border bg-white p-8 shadow-card">
        <div className={`mx-auto grid size-16 place-items-center rounded-full ${done ? "bg-obligon-green/10 text-obligon-green" : "bg-obligon-lime/20 text-obligon-green"}`}>
          {done ? <CheckCircle2 size={32} /> : <KeyRound size={32} />}
        </div>
        <h1 className="mt-8 text-center font-display text-3xl font-extrabold leading-10 text-obligon-navy">
          {done ? "Password Updated" : "Set a New Password"}
        </h1>
        <p className="mt-4 text-center text-base leading-6 text-obligon-text">
          {done
            ? "Your password has been changed and all other sessions were signed out."
            : "Enter the 6-digit code we sent you, then choose a new password for your account."}
        </p>

        {done ? (
          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={() => router.push(routes.login)}
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-obligon-green text-base font-bold text-white shadow-green"
            >
              Continue to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="reset-email" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                Account Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldErrors((p) => ({ ...p, email: "" }));
                }}
                placeholder="you@company.ng"
                className={inputClass("email")}
                disabled={submitting}
                autoComplete="email"
              />
              {fieldErrors.email ? <p className="mt-1 text-xs font-medium text-[#93000a]" role="alert">{fieldErrors.email}</p> : null}
            </div>

            <div>
              <label htmlFor="reset-code" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                6-Digit Reset Code
              </label>
              <input
                id="reset-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setFieldErrors((p) => ({ ...p, code: "" }));
                }}
                placeholder="••••••"
                className={`${inputClass("code")} text-center font-mono text-xl tracking-[8px]`}
                disabled={submitting}
                autoComplete="one-time-code"
              />
              {fieldErrors.code ? <p className="mt-1 text-xs font-medium text-[#93000a]" role="alert">{fieldErrors.code}</p> : null}
            </div>

            <div>
              <label htmlFor="reset-password" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                New Password
              </label>
              <input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setFieldErrors((p) => ({ ...p, newPassword: "" }));
                }}
                placeholder="At least 8 characters"
                className={inputClass("newPassword")}
                disabled={submitting}
                autoComplete="new-password"
              />
              {fieldErrors.newPassword ? <p className="mt-1 text-xs font-medium text-[#93000a]" role="alert">{fieldErrors.newPassword}</p> : null}
            </div>

            <div>
              <label htmlFor="reset-confirm" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                Confirm New Password
              </label>
              <input
                id="reset-confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setFieldErrors((p) => ({ ...p, confirmPassword: "" }));
                }}
                placeholder="Repeat your new password"
                className={inputClass("confirmPassword")}
                disabled={submitting}
                autoComplete="new-password"
              />
              {fieldErrors.confirmPassword ? <p className="mt-1 text-xs font-medium text-[#93000a]" role="alert">{fieldErrors.confirmPassword}</p> : null}
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-obligon-text">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="size-4 rounded border-obligon-border accent-obligon-green"
                disabled={submitting}
              />
              Show passwords
            </label>

            {error ? (
              <div className="rounded-lg bg-[#fff0f0] border border-[#fecaca] p-3 text-sm text-[#93000a] flex items-start gap-2" role="alert">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !email || code.length !== 6 || !newPassword || !confirmPassword}
              className={`inline-flex h-12 w-full items-center justify-center rounded-lg text-base font-bold text-white shadow-green transition ${
                submitting || !email || code.length !== 6 || !newPassword || !confirmPassword
                  ? "bg-obligon-green/50 cursor-not-allowed"
                  : "bg-obligon-green hover:bg-obligon-green/90"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
        )}

        <Link href={routes.forgotPassword ?? "/forgot-password"} className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[1.2px] text-obligon-green">
          <ArrowLeft size={16} />
          Request a new code
        </Link>
      </section>
    </AuthShell>
  );
}
