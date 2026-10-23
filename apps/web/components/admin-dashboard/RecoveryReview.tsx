"use client";

import { StatusPopup } from "@/components/shared/StatusPopup";
import * as React from "react";
import { authenticatedRequest } from "@/lib/services";
import { useAsync } from "@/components/shared/useAsync";
import { AsyncBoundary } from "@/components/shared/States";

interface Issuance { id: string; organization_id: string; label: string; state: string; issuer_customer_id: string | null; card_id: string | null; updated_at: string }
interface Refund { id: string; customer: string; reference: string; status: string; reviewRequired: boolean; reviewReason: string | null; dispatchStatus: string | null; amountLabel: string; reason: string; createdAt: string }

function IssuanceRecovery({ operation, onChanged }: { operation: Issuance; onChanged: () => void }) {
  const [providerCardId, setProviderCardId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const pending = React.useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || !providerCardId.trim()) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await authenticatedRequest(`/api/admin/company-card-issuances/${encodeURIComponent(operation.id)}/reconcile`, {method:"POST",body:JSON.stringify({providerCardId:providerCardId.trim() || undefined})});
      setProviderCardId(""); setNotice("Existing issuer card verified and local issuance reconciled."); onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Issuance could not be reconciled. Confirm the provider record before trying again.");
    } finally { pending.current = false; setBusy(false); }
  }
  return <article className="rounded-xl border border-obligon-border bg-white p-5">
      {(busy) ? <StatusPopup tone="pending" message="Checking existing issuer record…" /> : null}
    <h4 className="font-bold text-obligon-navy">{operation.label}</h4><p className="mt-1 text-sm text-obligon-text">{operation.state.replaceAll("_"," ")} · {operation.id}</p>
    <p className="mt-2 break-all text-xs text-obligon-text">Company: {operation.organization_id}; issuer customer: {operation.issuer_customer_id ?? "Not recorded"}</p>
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm font-bold">Existing issuer card ID<input value={providerCardId} onChange={event=>setProviderCardId(event.target.value)} maxLength={160} required disabled={busy} autoComplete="off" className="mt-2 block min-h-12 w-full rounded-lg border border-obligon-border p-3 font-normal"/><span className="mt-1 block text-xs font-normal text-obligon-text">Use the card ID from the provider’s records for this issuance. The server checks its company customer, currency, active status and zero balances.</span></label>
      <button type="submit" disabled={busy || !providerCardId.trim()} className="min-h-12 rounded-lg border border-obligon-green px-4 font-bold text-obligon-green disabled:opacity-50">{busy?"Checking issuer record…":"Reconcile existing card"}</button>
    </form>
    {error?<StatusPopup tone="error" message={error} />:null}{notice?<StatusPopup tone="info" message={notice} />:null}
  </article>;
}

export function RecoveryReview() {
  const issuances = useAsync(()=>authenticatedRequest<{operations:Issuance[]}>("/api/admin/company-card-issuances"));
  const [refundStatus, setRefundStatus] = React.useState("");
  const refunds = useAsync(()=>authenticatedRequest<{refunds:Refund[]}>(`/api/admin/refunds${refundStatus?`?status=${encodeURIComponent(refundStatus)}`:""}`),[refundStatus]);
  const [busy,setBusy] = React.useState(false), [error,setError] = React.useState(""), [notice,setNotice] = React.useState("");
  const running = React.useRef(false);
  async function reconcile() {
    if(running.current)return;running.current=true;setBusy(true);setError("");setNotice("");
    try { await authenticatedRequest("/api/admin/reconcile",{method:"POST",body:JSON.stringify({limit:100})});setNotice("Reconciliation run completed with a limit of 100. Review the refreshed results and any remaining exceptions.");issuances.reload();refunds.reload(); }
    catch(cause){setError(cause instanceof Error?cause.message:"Reconciliation could not complete. Existing records remain available for review.");}
    finally{running.current=false;setBusy(false);}
  }
  return <section className="mx-auto w-full min-w-0 max-w-[1600px] border-t border-obligon-border px-4 py-8 text-sm sm:px-6 lg:px-8 [&_p]:break-words">
      {(busy) ? <StatusPopup tone="pending" message="Reconciling recorded payments and refunds…" /> : null}
    <h2 className="text-2xl font-bold text-obligon-navy">Recovery review</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-obligon-text">Review interrupted card issuance and outstanding refunds. Reconciliation checks existing provider records and payment work. It does not create another card or mark a refund paid manually.</p>
    <button type="button" onClick={()=>void reconcile()} disabled={busy} className="mt-4 min-h-12 rounded-lg bg-obligon-green px-5 font-bold text-white disabled:opacity-50">{busy?"Reconciling…":"Reconcile payments and refunds"}</button>
    {error?<StatusPopup tone="error" message={error} />:null}{notice?<StatusPopup tone="info" message={notice} />:null}
    <div className="mt-8 grid gap-8 xl:grid-cols-2">
      <section className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Interrupted company card issuance</h3><button type="button" onClick={issuances.reload} className="min-h-11 rounded-lg border px-4 text-sm font-bold">Refresh cards</button></div>
        <AsyncBoundary status={issuances.status} error={issuances.error?.message??null} onRetry={issuances.reload} loadingLabel="Loading card issuance operations…"><div className="mt-4 space-y-4">{issuances.data?.operations.map(operation=><IssuanceRecovery key={operation.id} operation={operation} onChanged={issuances.reload}/>)}{issuances.data&&!issuances.data.operations.length?<p className="text-sm text-obligon-text">No interrupted card issuances were returned.</p>:null}</div></AsyncBoundary>
      </section>
      <section className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Refund status</h3><button type="button" onClick={refunds.reload} className="min-h-11 rounded-lg border px-4 text-sm font-bold">Refresh refunds</button></div>
        <label className="mt-4 block text-sm font-bold">Status<select value={refundStatus} onChange={event=>setRefundStatus(event.target.value)} className="mt-2 min-h-12 w-full rounded-lg border bg-white p-3"><option value="">All statuses</option>{["pending","succeeded","failed"].map(status=><option key={status} value={status}>{status}</option>)}</select></label>
        <AsyncBoundary status={refunds.status} error={refunds.error?.message??null} onRetry={refunds.reload} loadingLabel="Loading refunds…"><div className="mt-4 space-y-4">{refunds.data?.refunds.map(refund=><article key={refund.id} className="rounded-xl border border-obligon-border bg-white p-5"><h4 className="font-bold">{refund.customer} · {refund.amountLabel}</h4><p className="mt-2 break-all text-sm text-obligon-text">{refund.reference} · {refund.status}</p><p className="mt-2 text-sm">{refund.reason}</p>{refund.dispatchStatus?<p className="mt-2 text-xs text-obligon-text">Dispatch: {refund.dispatchStatus.replaceAll("_"," ")}</p>:null}{refund.reviewRequired||refund.reviewReason?<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{refund.reviewReason??"Operator review is required before this refund can complete."}</p>:null}</article>)}{refunds.data&&!refunds.data.refunds.length?<p className="text-sm text-obligon-text">No refunds match this status.</p>:null}</div></AsyncBoundary>
      </section>
    </div>
  </section>;
}
