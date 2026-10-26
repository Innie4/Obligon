"use client";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "@/lib/services/client";
import { bvnStatusLabel } from "@/lib/card-identity";
import { AdminDialog } from "./AdminDialog";

type Application = {
  id: string; full_name: string; email: string; bvn_last_four: string;
  date_of_birth: string; postal_code: string | null; identity_phone: string;
  address: string; city: string; state: string; plan_code: string; status: string;
  verification_status: string; issuance_state: string; rejection_reason: string;
  identityRevision: string | null; emailConfirmationStatus: "not_started" | "pending" | "verified";
  identityEmailMasked: string | null; bvnStatus: string; bvnCheckedAt: string | null;
  bvnNameMatch: boolean | null; bvnAccountNameMatch: boolean | null; bvnDobMatch: boolean | null;
  bvnResultMessage: string | null; accountName?: string; identityStale?: boolean; bvnReferenceAvailable?: boolean;
};
const actionClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-obligon-border bg-white px-4 py-3 text-sm font-bold text-obligon-navy disabled:opacity-50";
const inputClass = "mt-2 min-h-12 w-full min-w-0 rounded-xl border border-obligon-border bg-white px-3 text-base font-normal text-obligon-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-obligon-green";
const matchLabel = (value: boolean | null) => value === true ? "Matches" : value === false ? "Does not match" : "Not checked";

export function CardApprovalQueue() {
  const [rows, setRows] = useState<Application[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [providerIds, setProviderIds] = useState<Record<string, string>>({});
  const [identities, setIdentities] = useState<Record<string, string>>({});
  const [bvnReferences, setBvnReferences] = useState<Record<string, string>>({});
  const [successTone, setSuccessTone] = useState<"info" | "success">("success");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setLoadFailed(false); setError("");
    try { const result = await api.request<{ requests: Application[] }>("/api/admin/card-requests"); setRows(result.requests); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load card applications."); setLoadFailed(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function decide(row: Application, action: "approve" | "reject" | "reconcile" | "start" | "check" | "recover-bvn" | "archive-bvn") {
    if (busy || loading) return;
    setBusy(row.id); setError(""); setSuccess("");
    try {
      const bvn = action === "start" || action === "check" || action === "recover-bvn" || action === "archive-bvn";
      const body = bvn ? { action: action === "recover-bvn" ? "reconcile" : action === "archive-bvn" ? "archive" : action, identityRevision: row.identityRevision, ...(action === "recover-bvn" ? { providerReference: bvnReferences[row.id] } : {}) } : action === "reject" ? { reason: reason[row.id] } : action === "reconcile" ? { providerCardId: providerIds[row.id] } : {};
      await api.request(`/api/admin/card-requests/${row.id}/${bvn ? "bvn" : action}`, { method: "POST", body: JSON.stringify(body) });
      setIdentities({});
      await load();
      setSuccessTone(bvn ? "info" : "success");
      setSuccess(bvn ? "BVN check updated. Review the recorded result." : action === "reject" ? "Application rejected." : action === "reconcile" ? "Issued card reconciled." : "Card approved and issued.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to complete this review."); }
    finally { setBusy(""); }
  }

  async function reveal(row: Application) {
    if (busy || loading) return;
    if (identities[row.id]) { setIdentities(previous => ({ ...previous, [row.id]: "" })); return; }
    setBusy(row.id); setError(""); setSuccess("");
    try { const result = await api.request<{ bvn: string }>(`/api/admin/card-requests/${row.id}/identity`); setIdentities(previous => ({ ...previous, [row.id]: result.bvn })); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to view identity."); }
    finally { setBusy(""); }
  }

  const reviewOpen = rows.some(row => row.id === selectedId);
  const feedback = <>{busy ? <StatusPopup tone="pending" message="Processing card identity review…" /> : null}{loading ? <StatusPopup tone="loading" message="Loading card applications…" /> : null}{error ? <StatusPopup tone="error" message={error} onRetry={loadFailed ? load : undefined} /> : null}{success ? <StatusPopup tone={successTone} message={success} /> : null}</>;
  return <section id="customer-card-approvals" className="admin-panel mt-8 mb-8 min-w-0 scroll-mt-6 rounded-2xl border border-obligon-border bg-white p-5 sm:mx-6 sm:p-7 lg:mx-8" aria-label="Customer card approvals">
    {!reviewOpen ? feedback : null}
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-obligon-green">Customer verification</p><h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-obligon-navy">Card applications</h2></div><button type="button" className={actionClass} disabled={loading || Boolean(busy)} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" />Refresh</button></div>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-obligon-text">Review the customer’s email confirmation, BVN result and name matches before issuing a virtual card.</p>
    {!loading && !loadFailed && !rows.length ? <p className="py-8 text-sm text-obligon-text">No pending applications.</p> : null}
    {rows.map(row => {
      const emailConfirmed = row.emailConfirmationStatus === "verified";
      const eligible = emailConfirmed && row.bvnStatus === "matched" && row.bvnNameMatch === true && row.bvnAccountNameMatch === true && row.bvnDobMatch === true && Boolean(row.postal_code);
      const active = row.verification_status === "pending" && row.issuance_state === "not_started";
      const canStart = active && emailConfirmed && ["not_started", "unavailable"].includes(row.bvnStatus);
      const canCheck = active && Boolean(row.identityRevision) && ["pending_consent", "pending"].includes(row.bvnStatus);
      return <article key={row.id} aria-label={`Card application for ${row.full_name}`} className="admin-review-row mt-5 min-w-0 rounded-xl border border-obligon-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-4"><div className="min-w-0"><h3 className="break-words text-sm font-bold text-obligon-navy">{row.full_name}</h3><p className="mt-1 break-words text-xs text-obligon-text">{row.email}</p><p className="mt-2 text-xs text-obligon-text">{row.plan_code} · {bvnStatusLabel(row.bvnStatus)}</p></div><button type="button" className={actionClass} disabled={loading || Boolean(busy)} onClick={() => { if (busy || loading) return; setError(""); setSuccess(""); setSelectedId(row.id); }}>Review record<span className="sr-only"> for {row.full_name}</span></button></div>
        <AdminDialog open={selectedId === row.id} title={`Card application: ${row.full_name}`} description="Review the submitted identity and recorded verification checks." onClose={() => { setSelectedId(null); setIdentities({}); }} wide>
        {selectedId === row.id ? feedback : null}
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-xl font-bold text-obligon-navy">{row.full_name}</h3><p className="mt-1 break-words text-sm text-obligon-text">{row.email}</p></div><span className="rounded-full bg-obligon-mist px-3 py-2 text-xs font-bold text-obligon-green">{row.plan_code}</span></div>
        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
          <div className="min-w-0"><h4 className="text-sm font-bold text-obligon-navy">Submitted details</h4><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-obligon-text">Account name</dt><dd className="mt-1 break-words font-semibold text-obligon-navy">{row.accountName || "Not available"}</dd></div><div><dt className="text-obligon-text">BVN</dt><dd className="mt-1 font-semibold text-obligon-navy">Ending {row.bvn_last_four}</dd></div><div><dt className="text-obligon-text">Date of birth</dt><dd className="mt-1 font-semibold text-obligon-navy">{String(row.date_of_birth || "").slice(0, 10)}</dd></div><div><dt className="text-obligon-text">Phone</dt><dd className="mt-1 font-semibold text-obligon-navy">{row.identity_phone}</dd></div><div><dt className="text-obligon-text">Residential address</dt><dd className="mt-1 break-words font-semibold leading-6 text-obligon-navy">{[row.address, row.city, row.state].filter(Boolean).join(", ")}</dd></div><div><dt className="text-obligon-text">Postal code</dt><dd className="mt-1 font-semibold text-obligon-navy">{row.postal_code || "Not supplied. The customer must add it before the issuer can create a card."}</dd></div></dl>
          <details className="mt-5 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-semibold text-obligon-navy">Audited identity access</summary><p className="mt-2 text-xs leading-5 text-obligon-text">Open only when needed for this review. The access is recorded.</p>{identities[row.id] ? <p className="my-3 font-mono text-base text-obligon-navy">{identities[row.id]}</p> : null}<button type="button" className={`${actionClass} mt-3`} disabled={loading || Boolean(busy)} onClick={() => void reveal(row)}>{identities[row.id] ? "Hide identity" : "Review full identity (audited)"}</button></details></div>
          <div className="min-w-0 rounded-xl bg-obligon-mist p-4 sm:p-5"><h4 className="flex items-center gap-2 text-sm font-bold text-obligon-navy"><ShieldCheck size={18} aria-hidden="true" />Verification checks</h4><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-obligon-text">Email confirmation</dt><dd className="mt-1 flex items-center gap-2 font-semibold text-obligon-navy">{emailConfirmed ? <Check size={15} aria-hidden="true" /> : null}{emailConfirmed ? "Confirmed for this submission" : "Waiting for customer confirmation"}</dd></div><div><dt className="text-obligon-text">BVN result</dt><dd className="mt-1 font-semibold text-obligon-navy">{bvnStatusLabel(row.bvnStatus)}</dd></div><div><dt className="text-obligon-text">BVN name / submitted name</dt><dd className="mt-1 font-semibold text-obligon-navy">{matchLabel(row.bvnNameMatch)}</dd></div><div><dt className="text-obligon-text">BVN name / account name</dt><dd className="mt-1 font-semibold text-obligon-navy">{matchLabel(row.bvnAccountNameMatch)}</dd></div><div><dt className="text-obligon-text">BVN date of birth / submitted date</dt><dd className="mt-1 font-semibold text-obligon-navy">{matchLabel(row.bvnDobMatch)}</dd></div></dl>
          {row.bvnResultMessage ? <p className="mt-4 text-sm leading-6 text-obligon-text">{row.bvnResultMessage}</p> : null}
          {row.identityStale && row.bvnReferenceAvailable && ["pending_consent", "pending"].includes(row.bvnStatus) ? <div className="mt-4"><p className="text-xs leading-5 text-obligon-text">Account details changed while this check was open. Archive it to let the customer correct their submission. This does not cancel the provider’s check.</p><button type="button" className={`${actionClass} mt-3`} disabled={loading || Boolean(busy)} onClick={() => void decide(row, "archive-bvn")}>Archive stale BVN check</button></div> : null}
          {row.bvnCheckedAt ? <p className="mt-3 text-xs text-obligon-text">Checked: {new Date(row.bvnCheckedAt).toLocaleString("en-NG")}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3"><button type="button" className={actionClass} disabled={loading || Boolean(busy) || !canStart} onClick={() => void decide(row, "start")}>Start BVN check</button><button type="button" className={actionClass} disabled={loading || Boolean(busy) || !canCheck} onClick={() => void decide(row, "check")}>Retrieve BVN result</button></div>
          <p className="mt-3 text-xs leading-5 text-obligon-text">The provider may ask the customer to complete NIBSS consent from My Card. An email code confirms email control; it does not prove BVN ownership.</p>
          {["starting", "review_required"].includes(row.bvnStatus) ? <div className="mt-5 border-t border-obligon-border pt-4"><p className="text-xs leading-5 text-obligon-text">Locate this check in the provider dashboard. Enter its reference only after it has completed. An uncertain start is not retried automatically.</p><label className="mt-3 block text-sm font-semibold text-obligon-navy">Completed BVN verification reference<input className={inputClass} maxLength={120} value={bvnReferences[row.id] || ""} onChange={event => setBvnReferences(previous => ({ ...previous, [row.id]: event.target.value }))} /></label><button type="button" className={`${actionClass} mt-3`} disabled={loading || Boolean(busy) || !bvnReferences[row.id]?.trim()} onClick={() => void decide(row, "recover-bvn")}>Reconcile completed BVN check</button><p className="mt-2 text-xs leading-5 text-obligon-text">A check still starting can be reconciled after two minutes. The BVN must match this application.</p></div> : null}</div>
        </div>
        {row.rejection_reason ? <p className="mt-5 text-sm font-semibold text-obligon-navy">Rejected: {row.rejection_reason}</p> : ["review_required", "creating"].includes(row.issuance_state) ? <div className="mt-5 border-t border-obligon-border pt-5"><label className="block max-w-lg text-sm font-semibold text-obligon-navy">Verified issuer card ID<input className={inputClass} value={providerIds[row.id] || ""} onChange={event => setProviderIds(previous => ({ ...previous, [row.id]: event.target.value }))} /></label><button type="button" className={`${actionClass} mt-3`} disabled={loading || Boolean(busy) || !providerIds[row.id]} onClick={() => void decide(row, "reconcile")}>Reconcile existing issued card</button></div> : <div className="mt-6 space-y-4 border-t border-obligon-border pt-5">
          <button type="button" className={`${actionClass} !border-obligon-green !bg-obligon-green !text-white`} disabled={loading || Boolean(busy) || !active || !eligible} onClick={() => void decide(row, "approve")}>Approve and issue card</button>
          {!eligible ? <p className="text-xs leading-5 text-obligon-text">Approval requires email confirmation, matching BVN names and date of birth, and the postal code required by the issuer.</p> : null}
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end"><label className="block w-full max-w-lg text-sm font-semibold text-obligon-navy">Rejection reason for {row.full_name}<input className={inputClass} maxLength={500} value={reason[row.id] || ""} onChange={event => setReason(previous => ({ ...previous, [row.id]: event.target.value }))} /></label><button type="button" className={actionClass} disabled={loading || Boolean(busy) || !active || (reason[row.id] || "").trim().length < 5} onClick={() => void decide(row, "reject")}>Reject application</button></div>
        </div>}
        </AdminDialog>
      </article>;
    })}
    <ReplacementReconciliation />
  </section>;
}

type Replacement = { id:string;holder_name:string;email:string;sudo_card_id:string };
function ReplacementReconciliation() {
  const [rows, setRows] = useState<Replacement[]>([]), [ids, setIds] = useState<Record<string, string>>({}), [error, setError] = useState("");
  const [busy, setBusy] = useState(""), [loading, setLoading] = useState(true), [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<Replacement | null>(null), [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setLoadFailed(false); setError("");
    try { const response = await api.request<{ requests: Replacement[] }>("/api/admin/card-replacements"); setRows(response.requests); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to load replacements"); setLoadFailed(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const feedback = <>{loading ? <StatusPopup tone="loading" message="Loading card replacements…" /> : null}{busy ? <StatusPopup tone="pending" message="Checking recorded card replacement…" /> : null}{error ? <StatusPopup tone="error" message={error} onRetry={loadFailed ? load : undefined} /> : null}{notice ? <StatusPopup tone="success" message={notice} /> : null}</>;
  return <div className="mt-8 border-t border-obligon-border pt-6">
    {!selected ? feedback : null}
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Issuer replacement reconciliation</h3><button type="button" disabled={loading || Boolean(busy)} onClick={() => void load()} className={actionClass}>Refresh replacements</button></div>
    {!loading && !loadFailed && rows.length === 0 ? <p className="py-5 text-sm text-obligon-text">No uncertain card replacements.</p> : null}<ul className="mt-4 divide-y divide-obligon-border">{rows.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><h4 className="break-words text-sm font-bold">{row.holder_name}</h4><p className="mt-1 break-words text-xs text-obligon-text">{row.email}</p></div><button type="button" className={actionClass} disabled={loading || Boolean(busy)} onClick={() => { if (busy || loading) return; setError(""); setNotice(""); setSelected(row); }}>Review record<span className="sr-only"> for {row.holder_name}</span></button></li>)}</ul>
    <AdminDialog open={Boolean(selected)} title="Reconcile card replacement" description="Customer card recovery" onClose={() => setSelected(null)}>{selected ? feedback : null}{selected ? <div className="space-y-5"><div className="admin-review-summary rounded-xl bg-obligon-mist p-4"><h4 className="font-bold">{selected.holder_name}</h4><p className="mt-1 break-words text-sm text-obligon-text">{selected.email}</p><p className="mt-3 break-all text-xs text-obligon-text">Old issuer card: {selected.sudo_card_id}</p></div><p className="text-sm leading-6 text-obligon-text">Confirm termination and locate the replacement in the issuer dashboard first.</p><label className="block text-sm font-semibold">Replacement issuer card ID<input className={inputClass} value={ids[selected.id] ?? ""} onChange={event => setIds({ ...ids, [selected.id]: event.target.value })} /></label><button type="button" className={actionClass} disabled={loading || Boolean(busy) || !ids[selected.id]} onClick={async () => { if (busy || loading) return; setBusy(selected.id); setError(""); setNotice(""); try { await api.request(`/api/admin/card-replacements/${selected.id}/reconcile`, { method: "POST", body: JSON.stringify({ providerCardId: ids[selected.id] }) }); setSelected(null); setNotice("Card replacement verified and reconciled."); await load(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Reconciliation failed"); } finally { setBusy(""); } }}>Verify &amp; complete</button></div> : null}</AdminDialog>
  </div>;
}
