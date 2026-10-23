"use client";

import { StatusPopup } from "@/components/shared/StatusPopup";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { useSession } from "@/components/shared/AuthContext";
import { routes } from "@/components/site/routes";
import { companyInvitationPath, withAuthReturn } from "@/lib/company-invitation-routing";
import { companyInvitationsApi, type CompanyInvitation as Invitation } from "@/lib/services/company-invitations";

export function CompanyInvitation({ token }: { token: string | null }) {
  const router = useRouter();
  const { user, status, setUser, logout } = useSession();
  const [invitation, setInvitation] = React.useState<Invitation | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const destination = companyInvitationPath(token);
  React.useEffect(() => {
    if (!destination || !token || status !== "authenticated") return;
    let current = true;
    setLoading(true); setError(null); setInvitation(null);
    companyInvitationsApi.read(token).then(result => { if (current) setInvitation(result.invitation); })
      .catch(cause => { if (current) setError(cause instanceof Error ? cause.message : "This invitation could not be opened."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [destination, token, status, user?.id, user?.email]);

  async function join() {
    if (!invitation || !token) return;
    setBusy(true); setError(null);
    try {
      if (invitation.status === "pending") {
        await companyInvitationsApi.accept(token);
        setInvitation({ ...invitation, status: "accepted" });
      }
      const next = await companyInvitationsApi.select(invitation.organizationId);
      setUser(next); router.push("/company");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The invitation could not be accepted. Please try again."); }
    finally { setBusy(false); }
  }
  async function changeAccount() {
    setBusy(true);
    await logout(); router.push(withAuthReturn(routes.login,destination));
  }
  const waiting = status === "loading" || loading;
  return <AuthShell compact><section aria-labelledby="company-invitation-title" className="w-full max-w-lg rounded-2xl border border-obligon-border bg-white p-6 shadow-card sm:p-8">
    <h1 id="company-invitation-title" className="font-display text-3xl font-extrabold text-obligon-navy">Join your company team</h1>
    <p className="mt-3 text-sm leading-6 text-obligon-text">Join an existing fleet with your account. Your account type stays the same.</p>
    {!destination ? <StatusPopup tone="error" message="This invitation link is invalid. Ask the company owner for a new invitation." /> : waiting ? <StatusPopup tone="loading" message="Checking your invitation…" /> : status === "unauthenticated" ? <div className="mt-6 space-y-4">
      <p className="text-sm leading-6">Sign in with the email address that received the invitation.</p>
      <Link className="inline-flex min-h-12 items-center justify-center rounded-lg bg-obligon-green px-6 font-bold text-white" href={withAuthReturn(routes.login,destination)}>Sign in to join</Link>
      <p className="text-sm">New to Obligon? <Link href={withAuthReturn(routes.signup,destination)} className="font-bold text-obligon-green underline">Create an account</Link></p>
    </div> : <div className="mt-6 space-y-4">
      <p className="break-words text-sm">Signed in as <strong>{user?.email}</strong></p>
      {invitation ? <>
        <div className="rounded-lg bg-obligon-mist p-4"><p className="font-bold">{invitation.companyName}</p><p className="mt-1 text-sm capitalize">Team role: {invitation.role}</p></div>
        {invitation.status === "expired" || invitation.status === "revoked" ? <p className="text-sm" role="status">This invitation is {invitation.status}. Ask the company owner for a new invitation.</p> : !user?.emailVerified && invitation.status === "pending" ? <div className="space-y-3"><p className="text-sm">Verify your email address to accept this invitation.</p><Link href={withAuthReturn(routes.verifyEmail,destination)} className="inline-flex min-h-12 items-center rounded-lg bg-obligon-green px-6 font-bold text-white">Verify email</Link></div> : <button type="button" disabled={busy} onClick={() => void join()} className="min-h-12 w-full rounded-lg bg-obligon-green px-6 font-bold text-white disabled:opacity-60">{busy ? "Opening company…" : invitation.status === "accepted" ? "Open company dashboard" : "Accept invitation"}</button>}
      </> : null}
      <button type="button" disabled={busy} onClick={() => void changeAccount()} className="min-h-12 text-sm font-bold text-obligon-green underline disabled:opacity-60">Sign in with another account</button>
    </div>}
    {error ? <StatusPopup tone="error" message={error} /> : null}
    {busy ? <StatusPopup tone="pending" message="Opening your company account…" /> : null}
  </section></AuthShell>;
}
