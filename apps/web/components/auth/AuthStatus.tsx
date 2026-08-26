"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle, AlertCircle, CheckCircle, RotateCcw } from "lucide-react";
import { routes } from "@/components/site/routes";

type AuthStatusType = "progress" | "success" | "failure";

interface AuthStatusProps {
  status: AuthStatusType;
  message?: string;
  serverError?: string;
  redirect?: string;
  onRetry?: () => void;
}

type DefaultContent = {
  eyebrow?: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  tone: string;
  footer: string;
};

const defaultContent: Record<AuthStatusType, DefaultContent> = {
  progress: {
    eyebrow: "Secure",
    title: "Securing your session...",
    body: "Performing multi-factor validation and initializing encrypted connection.",
    icon: Loader2,
    tone: "text-obligon-green",
    footer: "End-to-end encrypted verification",
  },
  success: {
    eyebrow: "",
    title: "Application Submitted Successfully",
    body: "Your enterprise profile is ready. Welcome to Nigeria's leading energy logistics infrastructure.",
    icon: CheckCircle2,
    tone: "text-obligon-green",
    footer: "Identity verified",
  },
  failure: {
    eyebrow: "Action Required",
    title: "Authentication Failed",
    body: "We could not complete the verification. Review your credentials or contact support for manual assistance.",
    icon: XCircle,
    tone: "text-[#93000a]",
    footer: "Verification incomplete",
  },
};

export function AuthStatus({ status, message, serverError, redirect, onRetry }: AuthStatusProps) {
  const item = defaultContent[status];
  const Icon = item.icon;
  const displayBody = status === "failure" && serverError
    ? serverError
    : message ?? item.body;

  const isRetryable = status === "failure" && !!onRetry;

  return (
    <div className="grid w-full max-w-[960px] items-center gap-10 lg:grid-cols-[480px_1fr]">
      <section className="rounded-3xl border border-obligon-border bg-white p-8 text-center shadow-card">
        {item.eyebrow ? (
          <span className="inline-flex rounded-full bg-obligon-lime/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[1px] text-[#131f00]">
            {item.eyebrow}
          </span>
        ) : null}
        <div className={`mx-auto mt-8 grid size-20 place-items-center rounded-full bg-obligon-mist ${item.tone}`}>
          <Icon className={status === "progress" ? "animate-spin" : ""} size={42} strokeWidth={1.8} />
        </div>
        <h1 className="mt-8 font-display text-3xl font-extrabold leading-10 text-obligon-navy">{item.title}</h1>
        <p className="mx-auto mt-4 max-w-sm text-base leading-6 text-obligon-text">{displayBody}</p>

        {status === "progress" ? (
          <div className="mt-8">
            <div className="h-2 overflow-hidden rounded-full bg-[#e6eeff]">
              <div className="h-full w-1/4 rounded-full bg-obligon-green animate-pulse" />
            </div>
            <p className="mt-3 text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Processing...</p>
          </div>
        ) : (
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {status === "success" && redirect ? (
              <Link href={redirect} className="inline-flex h-12 items-center justify-center rounded-lg bg-obligon-green px-6 text-base font-bold text-white shadow-green">
                Continue to Dashboard
              </Link>
            ) : status === "success" ? (
              <Link href={routes.dashboard} className="inline-flex h-12 items-center justify-center rounded-lg bg-obligon-green px-6 text-base font-bold text-white shadow-green">
                Go to Dashboard
              </Link>
            ) : (
              <button
                onClick={onRetry}
                disabled={!onRetry}
                className={`inline-flex h-12 items-center justify-center rounded-lg bg-obligon-green px-6 text-base font-bold text-white shadow-green ${
                  !onRetry ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <RotateCcw size={18} className="mr-2" />
                Try Again
              </button>
            )}

            <Link
              href={status === "success" ? routes.fuelvista : routes.support}
              className="inline-flex h-12 items-center justify-center rounded-lg border border-obligon-border px-6 text-base font-bold text-obligon-navy"
            >
              {status === "success" ? "Explore Solutions" : "Contact Support"}
            </Link>
          </div>
        )}

        {status === "failure" && (
          <div className="mt-6 rounded-lg bg-[#fff0f0] border border-[#fecaca] p-4 text-left">
            <h3 className="text-sm font-bold text-[#93000a]">Troubleshooting steps:</h3>
            <ul className="mt-2 space-y-1 text-xs text-[#93000a] list-disc list-inside">
              <li>Verify your email and password are correct</li>
              <li>Check if Caps Lock is enabled</li>
              <li>Try the "Forgot Password" link to reset your credentials</li>
              <li>Contact support if the issue persists</li>
            </ul>
          </div>
        )}

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-obligon-border px-4 py-2 text-[10px] font-bold uppercase tracking-[1px] text-obligon-text">
          {status === "failure" ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
          {item.footer}
        </div>
      </section>

      <aside className="hidden rounded-[32px] bg-obligon-navy p-10 text-white lg:block">
        <div className="flex h-[420px] flex-col justify-end rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(170,248,87,0.25),transparent_45%)] p-8">
          <p className="text-xs uppercase tracking-[1.6px] text-obligon-lime">Powering Logistics</p>
          <h2 className="mt-4 font-display text-4xl font-extrabold leading-[44px]">
            Nigeria's most trusted energy fintech infrastructure.
          </h2>
          <Link href={routes.login} className="mt-8 text-sm font-bold text-white/80 hover:text-white">
            Cancel and return to login
          </Link>
        </div>
      </aside>
    </div>
  );
}