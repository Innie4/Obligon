"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { useSession } from "@/components/shared/AuthContext";
import { useToast } from "@/components/shared/Toast";
import { DEMO_ACCOUNTS, DEMO_LOGIN_ENABLED, destinationForRole, type DemoAccount } from "@/lib/demo/accounts";
import { readPersistedSession } from "@/lib/session-store";

/**
 * One-click sign-in for the five demo accounts.
 *
 * Renders nothing at all unless `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`. Not hidden,
 * not disabled — absent from the bundle's behaviour entirely, so there is no way to
 * reach a demo account from a deployment that did not opt in.
 *
 * The reason it is behind a flag: these are shared passwords for accounts with no
 * second factor, and this component would put all five in the JavaScript bundle.
 * Fine for a demo; a published admin password is not.
 *
 * A button calls the same `login` the form calls, then routes on the role the
 * *server* reports. It never routes on the role the button advertises — if the
 * account's real role differs, the browser lands where the session actually is,
 * which is the only place it can be correct.
 */
export function DemoAccountPanel() {
  if (!DEMO_LOGIN_ENABLED) return null;
  return <DemoAccountPanelBody />;
}

function DemoAccountPanelBody() {
  const router = useRouter();
  const { login } = useSession();
  const { error: toastError, info: toastInfo } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function enter(account: DemoAccount) {
    setBusy(account.email);
    try {
      const result = await login({
        email: account.email,
        password: account.password,
        rememberMe: false
      });
      if (result?.mfaRequired) {
        // A demo account with a second factor cannot be entered in one click, which
        // defeats the panel. Said plainly rather than failing on the MFA screen.
        toastError(`${account.label} requires a verification code. The demo account should not have MFA enabled.`);
        setBusy(null);
        return;
      }
      // `readPersistedSession` is written by `login` before it resolves, so the role
      // is already available — no second round trip to /api/auth/session.
      const role = readPersistedSession()?.role;
      toastInfo(`Signed in as ${account.label}.`);
      router.push(role ? destinationForRole(role) : account.landing);
    } catch (err) {
      toastError(
        err instanceof Error
          ? err.message
          : `Could not open the ${account.label} demo. Has the database been seeded?`
      );
      setBusy(null);
    }
  }

  const groups = ["Platform", "Operations"] as const;

  return (
    <section
      aria-labelledby="demo-accounts-heading"
      className="mx-auto mt-6 w-full max-w-[480px] rounded-2xl border border-dashed border-obligon-green/50 bg-[#f7fbf8] p-5"
    >
      <div className="flex items-start gap-2.5">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-obligon-green" />
        <div className="min-w-0">
          <h3 id="demo-accounts-heading" className="text-sm font-extrabold text-obligon-navy">
            Explore a demo account
          </h3>
          <p className="mt-0.5 text-xs font-medium text-obligon-text">
            One click per role. No email, no password — each opens the dashboard for that role.
          </p>
        </div>
      </div>

      {groups.map((group) => {
        const accounts = DEMO_ACCOUNTS.filter((account) => account.group === group);
        if (!accounts.length) return null;
        return (
          <div key={group} className="mt-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[1px] text-obligon-text">
              {group}
            </p>
            <ul className="mt-2 grid gap-2">
              {accounts.map((account) => {
                const pending = busy === account.email;
                return (
                  <li key={account.email}>
                    <button
                      type="button"
                      onClick={() => void enter(account)}
                      disabled={busy !== null}
                      aria-busy={pending}
                      className="flex w-full items-center gap-3 rounded-xl border border-obligon-border bg-white px-3.5 py-3 text-left transition hover:border-obligon-green hover:bg-[#f7fbf8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e8fbd7] text-[11px] font-extrabold text-obligon-green"
                      >
                        {account.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold text-obligon-navy">
                          {account.label}
                        </span>
                        <span className="block truncate text-xs font-medium text-obligon-text">
                          {account.blurb}
                        </span>
                      </span>
                      {pending ? (
                        <Loader2 size={16} className="shrink-0 animate-spin text-obligon-green" />
                      ) : (
                        <LogIn size={16} className="shrink-0 text-obligon-text" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {/*
        Says what it is and what it costs. A demo panel that looks like a normal
        feature is how a seeded account ends up being treated as a real one.
      */}
      <p className="mt-4 flex items-start gap-1.5 border-t border-obligon-border pt-3 text-[11px] font-medium text-obligon-text">
        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[#986700]" />
        <span>
          Shared demo credentials with no two-factor. This panel is compiled in only
          where <code className="font-mono">NEXT_PUBLIC_ENABLE_DEMO_LOGIN</code> is set,
          and the API refuses to create these accounts under{" "}
          <code className="font-mono">NODE_ENV=production</code>.
        </span>
      </p>
    </section>
  );
}