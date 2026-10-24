"use client";

import Link from "next/link";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
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
    body: "Checking your sign-in session.",
    icon: Loader2,
    tone: "text-obligon-green",
    footer: "Session verification",
  },
  success: {
    eyebrow: "",
    title: "Session Verified",
    body: "Your sign-in session is active. Continue to your dashboard.",
    icon: CheckCircle2,
    tone: "text-obligon-green",
    footer: "Session verified",
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
  const displayBody = status === "failure" && serverError ? serverError : message ?? item.body;
  const linkClass = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-bold text-obligon-green underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  if (status === "progress") {
    return <><h1 className="sr-only">{item.title}</h1><StatusPopup tone="loading" title={item.title} message={displayBody} dismissible={false} action={<Link href={routes.login} className={linkClass}>Cancel and return to login</Link>} /></>;
  }
  if (status === "failure") {
    return <><h1 className="sr-only">{item.title}</h1><StatusPopup tone="error" title={item.title} message={displayBody} dismissible={false} onRetry={onRetry} action={<div className="flex flex-wrap gap-2"><Link href={routes.login} className={linkClass}>Return to login</Link><Link href={routes.support} className={linkClass}>Contact Support</Link></div>} /></>;
  }

  return <section className="w-full min-w-0 max-w-lg rounded-2xl bg-white p-5 text-center sm:p-8">
    <div className="mx-auto grid size-20 place-items-center rounded-full bg-obligon-mist text-obligon-green"><CheckCircle2 size={42} strokeWidth={1.8} aria-hidden="true" /></div>
    <h1 className="mt-8 font-display text-3xl font-extrabold text-obligon-navy">{item.title}</h1>
    <p className="mx-auto mt-4 max-w-sm text-base leading-6 text-obligon-text">{displayBody}</p>
    <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
      <Link href={redirect ?? routes.login} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-obligon-green px-6 font-bold text-white">{redirect ? "Continue to Dashboard" : "Return to Login"}</Link>
      <Link href={routes.fuelvista} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-obligon-border px-6 font-bold text-obligon-navy">Explore Solutions</Link>
    </div>
  </section>;
}
