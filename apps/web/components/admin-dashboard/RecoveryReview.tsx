"use client";

import { StatusPopup } from "@/components/shared/StatusPopup";
import * as React from "react";
import { authenticatedRequest } from "@/lib/services";
import { useAsync } from "@/components/shared/useAsync";
import { AsyncBoundary } from "@/components/shared/States";
import { AdminDialog } from "./AdminDialog";

interface Issuance { id: string; organization_id: string; label: string; state: string; issuer_customer_id: string | null; card_id: string | null; updated_at: string }
interface Refund { id: string; customer: string; reference: string; status: string; reviewRequired: boolean; reviewReason: string | null; dispatchStatus: string | null; amountLabel: string; reason: string; createdAt: string }

function IssuanceRecovery({ operation, onChanged, blocked = false, onBusyChange, onReview }: { operation: Issuance; onChanged: (message: string) => void; blocked?: boolean; onBusyChange?: (busy: boolean) => void; onReview?: () => void }) {
  const [providerCardId, setProviderCardId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const pending = React.useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || blocked || !providerCardId.trim()) return;
    pending.current = true; setBusy(true); onBusyChange?.(true); setError(""); setNotice("");
    try {
      await authenticatedRequest(`/api/admin/company-card-issuances/${encodeURIComponent(operation.id)}/reconcile`, {method:"POST",body:JSON.stringify({providerCardId:providerCardId.trim() || undefined})});
      setProviderCardId(""); setOpen(false); setNotice("Existing issuer card verified and local issuance reconciled."); onChanged("Existing issuer card verified and local issuance reconciled.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Issuance could not be reconciled. Confirm the provider record before trying again.");
    } finally { pending.current = false; setBusy(false); onBusyChange?.(false); }
  }
  const feedback = <>{busy ? <StatusPopup tone="pending" message="Checking existing issuer record…" /> : null}{error ? <StatusPopup tone="error" message={error} /> : null}{notice ? <StatusPopup tone="success" message={notice} /> : null}</>;
  return <article className="admin-review-row rounded-xl border border-obligon-border bg-white p-5">
      {!open ? feedback : null}
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h4 className="font-bold text-obligon-navy">{operation.label}</h4><p className="mt-1 text-xs text-obligon-text">{operation.state.replaceAll("_"," ")}</p></div><button type="button" className="min-h-11 rounded-xl border border-obligon-border px-4 text-sm font-semibold" disabled={busy || blocked} onClick={() => { if (busy || blocked || pending.current) return; setError(""); setNotice(""); onReview?.(); setOpen(true); }}>Review record<span className="sr-only"> for {operation.label}</span></button></div>
    <AdminDialog open={open} title={`Recover ${operation.label}`} description="Company card issuance" onClose={() => setOpen(false)}>{open ? feedback : null}<p className="break-all text-xs text-obligon-text">{operation.id}</p>
    <p className="mt-2 break-all text-xs text-obligon-text">Company: {operation.organization_id}; issuer customer: {operation.issuer_customer_id ?? "Not recorded"}</p>
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm font-bold">Existing issuer card ID<input value={providerCardId} onChange={event=>setProviderCardId(event.target.value)} maxLength={160} required disabled={busy || blocked} autoComplete="off" className="mt-2 block min-h-12 w-full rounded-lg border border-obligon-border p-3 font-normal"/><span className="mt-1 block text-xs font-normal text-obligon-text">Use the card ID from the provider’s records for this issuance. The server checks its company customer, currency, active status and zero balances.</span></label>
      <button type="submit" disabled={busy || !providerCardId.trim()} className="min-h-12 rounded-lg border border-obligon-green px-4 font-bold text-obligon-green disabled:opacity-50">{busy?"Checking issuer record…":"Reconcile existing card"}</button>
    </form>
    </AdminDialog>
  </article>;
}

export function RecoveryReview() {
  const issuances = useAsync(()=>authenticatedRequest<{operations:Issuance[]}>("/api/admin/company-card-issuances"));
  const [refundStatus, setRefundStatus] = React.useState("");
  const refunds = useAsync(()=>authenticatedRequest<{refunds:Refund[]}>(`/api/admin/refunds${refundStatus?`?status=${encodeURIComponent(refundStatus)}`:""}`),[refundStatus]);
  const [busy,setBusy] = React.useState(false), [error,setError] = React.useState(""), [notice,setNotice] = React.useState("");
  const [issuanceBusy, setIssuanceBusy] = React.useState(false);
  const [selectedRefund, setSelectedRefund] = React.useState<Refund | null>(null);
  const running = React.useRef(false);
  async function reconcile() {
    if(running.current || issuanceBusy)return;running.current=true;setBusy(true);setError("");setNotice("");
    try { await authenticatedRequest("/api/admin/reconcile",{method:"POST",body:JSON.stringify({limit:100})});setNotice("Reconciliation run completed with a limit of 100. Review the refreshed results and any remaining exceptions.");issuances.reload();refunds.reload(); }
    catch(cause){setError(cause instanceof Error?cause.message:"Reconciliation could not complete. Existing records remain available for review.");}
    finally{running.current=false;setBusy(false);}
  }
  const feedback = <>{busy ? <StatusPopup tone="pending" message="Reconciling recorded payments and refunds…" /> : null}{error ? <StatusPopup tone="error" message={error} /> : null}{notice ? <StatusPopup tone="success" message={notice} /> : null}</>;
  return <section className="admin-page mx-auto w-full min-w-0 max-w-[1600px] px-4 py-8 text-sm sm:px-6 lg:px-8 [&_p]:break-words">
      {!selectedRefund ? feedback : null}
    <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-obligon-green">Operations recovery</p><h2 className="text-2xl font-bold tracking-tight text-obligon-navy">Recovery review</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-obligon-text">Review interrupted card issuance and outstanding refunds. Reconciliation checks existing provider records and payment work. It does not create another card or mark a refund paid manually.</p>
    <button type="button" onClick={()=>void reconcile()} disabled={busy || issuanceBusy} className="mt-4 min-h-12 rounded-lg bg-obligon-green px-5 font-bold text-white disabled:opacity-50">{busy?"Reconciling…":"Reconcile payments and refunds"}</button>
    <div className="mt-8 grid gap-8 xl:grid-cols-2">
      <section className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Interrupted company card issuance</h3><button type="button" disabled={busy || issuanceBusy} onClick={issuances.reload} className="min-h-11 rounded-lg border px-4 text-sm font-bold">Refresh cards</button></div>
        <AsyncBoundary status={issuances.status} error={issuances.error ? `Card issuance records: ${issuances.error.message}` : null} onRetry={issuances.reload} loadingLabel="Loading card issuance operations…"><div className="mt-4 space-y-4">{issuances.data?.operations.map(operation=><IssuanceRecovery key={operation.id} operation={operation} blocked={busy || issuanceBusy} onBusyChange={setIssuanceBusy} onReview={() => { setError(""); setNotice(""); }} onChanged={message => { setNotice(message); issuances.reload(); }}/>)}{issuances.data&&!issuances.data.operations.length?<p className="text-sm text-obligon-text">No interrupted card issuances were returned.</p>:null}</div></AsyncBoundary>
      </section>
      <section className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Refund status</h3><button type="button" disabled={busy || issuanceBusy} onClick={refunds.reload} className="min-h-11 rounded-lg border px-4 text-sm font-bold">Refresh refunds</button></div>
        <label className="mt-4 block text-sm font-bold">Status<select value={refundStatus} disabled={busy || issuanceBusy} onChange={event=>{ if (busy || issuanceBusy) return; setError(""); setNotice(""); setRefundStatus(event.target.value); }} className="mt-2 min-h-12 w-full rounded-lg border bg-white p-3"><option value="">All statuses</option>{["pending","succeeded","failed"].map(status=><option key={status} value={status}>{status}</option>)}</select></label>
        <AsyncBoundary status={refunds.status} error={refunds.error ? `Refund records: ${refunds.error.message}` : null} onRetry={refunds.reload} loadingLabel="Loading refunds…"><div className="mt-4 space-y-4">{refunds.data?.refunds.map(refund=><article key={refund.id} className="admin-review-row flex flex-wrap items-center justify-between gap-4 rounded-xl border border-obligon-border bg-white p-5"><div className="min-w-0"><h4 className="break-words font-bold">{refund.customer}</h4><p className="mt-1 text-sm font-semibold tabular-nums text-obligon-navy">{refund.amountLabel}</p><p className="mt-2 text-xs capitalize text-obligon-text">{refund.status.replaceAll("_", " ")}{refund.reviewRequired ? " · Review required" : ""}</p></div><button type="button" className="min-h-11 rounded-xl border border-obligon-border px-4 text-sm font-semibold" disabled={busy || issuanceBusy} onClick={() => { if (busy || issuanceBusy) return; setError(""); setNotice(""); setSelectedRefund(refund); }}>Review record<span className="sr-only"> for {refund.reference}</span></button></article>)}{refunds.data&&!refunds.data.refunds.length?<p className="text-sm text-obligon-text">No refunds match this status.</p>:null}</div></AsyncBoundary>
      </section>
    </div>
    <AdminDialog open={Boolean(selectedRefund)} title="Review refund" description="Recorded refund and provider dispatch status" onClose={() => setSelectedRefund(null)}>{selectedRefund ? feedback : null}{selectedRefund ? <div className="space-y-5"><dl className="admin-review-summary grid grid-cols-2 gap-5 rounded-xl bg-obligon-mist p-4 text-sm"><div><dt className="text-obligon-text">Customer</dt><dd className="mt-1 break-words font-semibold">{selectedRefund.customer}</dd></div><div><dt className="text-obligon-text">Amount</dt><dd className="mt-1 font-semibold tabular-nums">{selectedRefund.amountLabel}</dd></div><div><dt className="text-obligon-text">Status</dt><dd className="mt-1 font-semibold capitalize">{selectedRefund.status.replaceAll("_", " ")}</dd></div><div><dt className="text-obligon-text">Dispatch</dt><dd className="mt-1 font-semibold">{selectedRefund.dispatchStatus?.replaceAll("_", " ") ?? "Not recorded"}</dd></div><div className="col-span-2"><dt className="text-obligon-text">Reference</dt><dd className="mt-1 break-all font-semibold">{selectedRefund.reference}</dd></div></dl><p className="text-sm leading-6 text-obligon-text">{selectedRefund.reason}</p>{selectedRefund.reviewRequired || selectedRefund.reviewReason ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><h3 className="font-bold">Review required</h3><p className="mt-2">{selectedRefund.reviewReason ?? "Operator review is required before this refund can complete."}</p></div> : null}</div> : null}</AdminDialog>
  </section>;
}
