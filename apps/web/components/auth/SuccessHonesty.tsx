"use client";

import { CheckCircle2, ShieldCheck, Mail, Phone } from "lucide-react";
import { useSession } from "@/components/shared/AuthContext";

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
        <p className="text-sm text-obligon-text">Checking your account…</p>
      </div>
    );
  }

  const emailVerified = Boolean(user?.emailVerified);
  const phoneVerified = Boolean(user?.phoneVerified);
  const both = emailVerified && phoneVerified;

  return (
    <div className="w-full max-w-[480px] mx-auto rounded-3xl border border-obligon-border bg-white p-8 shadow-card text-center">
      <span
        className={`inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[1px] ${
          both ? "bg-obligon-lime/20 text-[#131f00]" : "bg-[#fff3d8] text-[#9a6300]"
        }`}
      >
        {both ? "Email and Phone Verified" : "Account Created"}
      </span>
      <div className="mx-auto mt-6 grid size-20 place-items-center rounded-full bg-obligon-mist text-obligon-green">
        {both ? <CheckCircle2 className="size-10" /> : <ShieldCheck className="size-10" />}
      </div>
      <h1 className="mt-6 font-display text-3xl font-extrabold leading-10 text-obligon-navy">
        {both ? "Welcome to Obligon LTD" : "You are signed in"}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-base leading-6 text-obligon-text">
        {both
          ? "Your email address and phone number are both confirmed."
          : "Your account and your fuel wallet have been created. Confirm the contact details below to finish setting up."}
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
        Your fuel wallet was created with your account, so it is ready to be funded. Verification is
        what confirms we can reach you — on the address and number you gave us.
      </p>
    </div>
  );
}
