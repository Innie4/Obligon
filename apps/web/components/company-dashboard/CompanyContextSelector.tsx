"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { dashboardDestination } from "@/lib/auth-routing";
import { useSession } from "@/components/shared/AuthContext";
import { companyInvitationsApi, type CompanyContextOption } from "@/lib/services/company-invitations";

export function CompanyContextSelector({ compact = false }: { compact?: boolean }) {
  const { user, setUser } = useSession();
  const [organizations, setOrganizations] = React.useState<CompanyContextOption[]>([]);
  const [selected, setSelected] = React.useState(user?.organizationType === "company" ? user.organizationId ?? "" : "");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const selectId = React.useId();
  React.useEffect(() => {
    let current = true;
    setLoading(true);
    companyInvitationsApi.contexts().then(result => { if (current) setOrganizations(result.organizations); })
      .catch(cause => { if (current) setError(cause instanceof Error ? cause.message : "Your companies could not be loaded."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [user?.id]);
  React.useEffect(() => { setSelected(user?.organizationType === "company" ? user.organizationId ?? "" : ""); },[user?.organizationId,user?.organizationType]);
  async function selectCompany(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try { setUser(await companyInvitationsApi.select(selected)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "This company could not be opened."); }
    finally { setBusy(false); }
  }
  if (loading) return <p className="text-sm" role="status">Loading your companies…</p>;
  return <form onSubmit={selectCompany} className={compact ? "space-y-2" : "space-y-4"}>
    {organizations.length ? <>
      <label htmlFor={selectId} className="block text-sm font-bold">Company workspace</label>
      <select id={selectId} value={selected} onChange={event => setSelected(event.target.value)} disabled={busy} className="min-h-12 w-full rounded-lg border border-obligon-border bg-white px-3 text-sm">
        <option value="">Select a company</option>
        {organizations.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select>
      <button type="submit" disabled={busy || !selected || selected === user?.organizationId} className="min-h-12 w-full rounded-lg bg-obligon-green px-3 text-sm font-bold text-white disabled:opacity-60">{busy ? "Opening company…" : "Open company"}</button>
    </> : !error ? <p className="text-sm leading-6">You do not have an active company membership. Open the invitation sent by your company owner to join a fleet.</p> : null}
    {error ? <p className="text-sm text-[#93000a]" role="alert">{error}</p> : null}
  </form>;
}

export function ReturnToPrimaryAccount() {
  const router = useRouter();
  const { user,setUser } = useSession();
  const [busy,setBusy] = React.useState(false);
  const [error,setError] = React.useState<string | null>(null);
  async function returnToAccount() {
    setBusy(true); setError(null);
    try { const next = await companyInvitationsApi.select(null); setUser(next); router.push(dashboardDestination(next.role)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your account could not be opened."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={() => void returnToAccount()} className="min-h-12 text-sm font-bold text-obligon-green underline disabled:opacity-60">{busy ? "Opening account…" : `Return to ${user?.role === "customer" ? "personal" : user?.role ?? "your"} account`}</button>{error ? <p className="text-sm text-[#93000a]" role="alert">{error}</p> : null}</div>;
}
