"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ArrowLeft, ShieldCheck, Loader2, AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { routes } from "@/components/site/routes";
import { Input } from "@/components/site/Input";
import { useToast } from "@/components/shared/Toast";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  if (!emailRegex.test(email)) return "Enter a valid email address";
  return null;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { error: toastError, success: toastSuccess } = useToast();

  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const validate = (): boolean => {
    const err = validateEmail(email);
    if (err) {
      setError(err);
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    try {
      // In a real app, this would call an API endpoint
      // await api.forgotPassword({ email });
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API call

      toastSuccess("Reset link sent! Check your email.");
      setSent(true);
      setEmail("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send reset link. Please try again.";
      setServerError(message);
      toastError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (value: string) => {
    setEmail(value);
    if (error) setError(null);
    if (serverError) setServerError(null);
  };

  const isDisabled = submitting || !email.trim();

  return (
    <AuthShell compact>
      <section className="w-full max-w-[440px] rounded-3xl border border-obligon-border bg-white p-8 shadow-card">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-obligon-green/10 text-obligon-green">
          <ShieldCheck size={32} />
        </div>
        <h1 className="mt-8 text-center font-display text-3xl font-extrabold leading-10 text-obligon-navy">
          {sent ? "Check Your Email" : "Forgot Password?"}
        </h1>
        <p className="mt-4 text-center text-base leading-6 text-obligon-text">
          {sent
            ? "We've sent a password reset link to your email. Follow the link to create a new password."
            : "Enter your email address and we'll send you a secure link to reset your password."}
        </p>

        {sent ? (
          <div className="mt-8 space-y-4">
            <Link
              href={routes.login}
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-obligon-green text-base font-bold text-white shadow-green"
            >
              Back to Login
            </Link>
            <Link href={routes.login} className="inline-flex w-full items-center justify-center text-sm font-bold text-obligon-green">
              Didn't receive the email? <span className="underline">Resend</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (!submitting && email.trim()) handleSubmit(e); }} className="mt-8 space-y-5">
            <div className="relative">
              <label htmlFor="forgot-email" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-obligon-text/50" aria-hidden="true" />
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  placeholder="james.adenuga@enterprise.ng"
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmail(val);
                    if (error) setError(null);
                    if (serverError) setServerError(null);
                  }}
                  className={`h-12 w-full rounded-lg border px-4 pl-10 pr-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 ${
                    error || serverError ? "border-[#fecaca] bg-[#fff0f0]" : "border-obligon-border bg-white"
                  }`}
                  disabled={submitting}
                  autoComplete="email"
                  aria-invalid={!!error || !!serverError}
                  aria-describedby={error || serverError ? "forgot-email-error" : undefined}
                />
                {error || serverError ? (
                  <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#fca5a5]" aria-hidden="true" />
                ) : (
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-obligon-text/50" aria-hidden="true" />
                )}
              </div>
              {(error || serverError) && (
                <p id="forgot-email-error" className="mt-1 text-xs font-medium text-[#93000a]" role="alert">
                  {error ?? serverError}
                </p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg bg-[#fff0f0] border border-[#fecaca] p-3 text-sm text-[#93000a] flex items-start gap-2" role="alert">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <button
              type="submit"
              className={`inline-flex h-12 w-full items-center justify-center rounded-lg text-base font-bold text-white shadow-green transition ${
                submitting || !email.trim() ? "bg-obligon-green/50 cursor-not-allowed" : "bg-obligon-green hover:bg-obligon-green/90 shadow-green"
              }`}
              disabled={submitting || !email.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>
        )}

        <Link href={routes.login} className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[1.2px] text-obligon-green">
          <ArrowLeft size={16} />
          Back to Login
        </Link>
        <p className="mt-8 border-t border-obligon-border pt-6 text-center text-xs uppercase tracking-[1.2px] text-obligon-text">
          Trusted by 200+ fleet operators
        </p>
      </section>
    </AuthShell>
  );
}