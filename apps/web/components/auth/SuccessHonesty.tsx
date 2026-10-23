"use client";

import { CheckCircle2, ShieldCheck, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/components/shared/AuthContext";
import { routes } from "@/components/site/routes";

/**
 * States what has actually been verified, from the session's own flags.
 *
 * The previous version of this screen read "Identity Verified" and "Your profile
 * and security credentials have been verified" no matter what had happened. A
 * signup that sent one email code and redirected here had verified neither that
 * code nor anything else, so the first thing a new account saw was a claim it
 * could not be held to.
 */
export function SuccessHonesty() {
  const { user, status } = useSession();

  if (status === "loading") {
    return (
      <div className="w-full max-w-[480px] mx-auto rounded-3xl border border-obligon-border bg-white p-8 shadow-card text-center">
        <p role="status" className="text-sm text-obligon-text">Checking your account…</p>
      </div>
    );
  }

  if (status !== "authenticated" || !user) {
    return <div className="mx-auto w-full max-w-[480px] rounded-3xl border border-obligon-border bg-white p-8 text-center shadow-card">
      <h1 className="font-display text-2xl font-bold tracking-tight text-obligon-navy">Sign in to continue</h1>
      <p className="mt-3 text-base leading-6 text-obligon-text">Sign in to view your account and verification status.</p>
      <Link href={routes.login} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-obligon-green px-6 text-sm font-semibold text-white transition-colors hover:bg-obligon-green/90">Log in</Link>
    </div>;
  }

  const emailVerified = Boolean(user?.emailVerified);
  const phoneVerified = Boolean(user?.phoneVerified);
  const both = emailVerified && phoneVerified;
  const accountVerified = emailVerified || phoneVerified || user?.accountVerified === true;

  return (
    <div className="w-full max-w-[480px] mx-auto rounded-3xl border border-obligon-border bg-white p-8 shadow-card text-center">
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${
          accountVerified ? "bg-obligon-lime/20 text-[#131f00]" : "bg-[#fff3d8] text-[#9a6300]"
        }`}
      >
        {accountVerified ? "Account Verified" : "Account Created"}
      </span>
      <div className="mx-auto mt-6 grid size-20 place-items-center rounded-full bg-obligon-mist text-obligon-green">
        {accountVerified ? <CheckCircle2 className="size-10" /> : <ShieldCheck className="size-10" />}
      </div>
      <h1 className="mt-6 font-display text-3xl font-extrabold leading-10 text-obligon-navy">
        {accountVerified ? "Welcome to Obligon LTD" : "You are signed in"}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-base leading-6 text-obligon-text">
        {both
          ? "Your email address and phone number are both confirmed."
          : accountVerified
            ? `${emailVerified ? "Your email address is confirmed. " : phoneVerified ? "Your phone number is confirmed. " : ""}Account verification is complete.`
            : "Your account and your fuel wallet have been created. Confirm either your email or your phone to finish verification."}
      </p>

      <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
        {[
          { label: "Email address", done: emailVerified, Icon: Mail },
          { label: "Phone number", done: phoneVerified, Icon: Phone }
        ].map(({ label, done, Icon }) => (
          <li key={label} className="flex items-center gap-3">
            <span
              className={`grid size-7 place-items-center rounded-full ${
                done ? "bg-obligon-lime/30 text-obligon-green" : "bg-[#f1f5f0] text-obligon-text"
              }`}
            >
              <Icon size={14} />
            </span>
            <span className="flex-1 font-bold text-obligon-navy">{label}</span>
            <span className={`text-xs font-extrabold ${done ? "text-obligon-green" : "text-obligon-text"}`}>
              {done ? "Verified" : "Not yet verified"}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs leading-5 text-obligon-text">
        Verification confirms we can reach you by email or phone. You can verify the other contact later.
      </p>
    </div>
  );
}
