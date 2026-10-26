"use client";

import * as React from "react";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { EmptyState } from "@/components/shared/States";
import { authenticatedRequest } from "@/lib/services";
import { AdminDialog } from "./AdminDialog";

interface Request { id: string; station_name: string; partner_name: string; fuel_type: string; rate_bp: number; starts_at: string; ends_at: string; status: string }
const actionClass = "min-h-11 rounded-xl border border-obligon-border bg-white px-4 text-sm font-semibold text-obligon-navy disabled:opacity-50";

export function DiscountApprovals() {
  const [rows, setRows] = React.useState<Request[]>([]), [error, setError] = React.useState(""), [reason, setReason] = React.useState(""), [busy, setBusy] = React.useState(false), [loading, setLoading] = React.useState(true), [loadFailed, setLoadFailed] = React.useState(false);
  const [selected, setSelected] = React.useState<Request | null>(null), [notice, setNotice] = React.useState("");
  const load = React.useCallback(async () => {
    setLoading(true); setLoadFailed(false); setError("");
    try { setRows((await authenticatedRequest<{ requests: Request[] }>("/api/admin/discount-requests")).requests); }
    catch (failure) { setError((failure as Error).message); setLoadFailed(true); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  async function review(id: string, decision: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await authenticatedRequest(`/api/admin/discount-requests/${id}/review`, { method: "POST", body: JSON.stringify({ decision, reason }) });
      setReason(""); setSelected(null); setNotice(decision === "approved" ? "Station discount approved." : "Station discount rejected."); await load();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  const feedback = <>
{busy ? <StatusPopup tone="pending" message="Saving discount review…" /> : null}
    {loading ? <StatusPopup tone="loading" message="Loading discount requests…" /> : null}
    {error ? <StatusPopup tone="error" message={error} onRetry={loadFailed ? load : undefined} /> : null}
    {notice ? <StatusPopup tone="success" message={notice} /> : null}
  </>;
  return <section className="admin-page mx-auto w-full min-w-0 max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    {!selected ? feedback : null}
    <header className="admin-page-heading flex flex-wrap items-end justify-between gap-4 pb-6"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-obligon-green">Partner requests</p><h1 className="text-2xl font-bold tracking-tight text-obligon-navy sm:text-3xl">Station discounts</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-obligon-text">Review the rate, dates and station before approving a partner discount.</p></div><button type="button" disabled={loading || busy} onClick={() => void load()} className={actionClass}>Refresh</button></header>
    {!loading && !loadFailed ? <div className="admin-panel overflow-hidden rounded-2xl border border-obligon-border bg-white">
      {rows.length ? <ul className="divide-y divide-obligon-border">{rows.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6"><div className="min-w-0"><h2 className="break-words text-sm font-bold text-obligon-navy">{row.station_name}</h2><p className="mt-1 break-words text-sm text-obligon-text">{row.partner_name} · {row.fuel_type}</p><p className="mt-2 text-xs text-obligon-text">{new Date(row.starts_at).toLocaleDateString("en-NG")} to {new Date(row.ends_at).toLocaleDateString("en-NG")}</p></div><div className="flex flex-wrap items-center gap-4"><div className="text-right"><p className="text-lg font-bold tabular-nums text-obligon-navy">{row.rate_bp / 100}%</p><span className="text-xs font-semibold capitalize text-obligon-text">{row.status.replaceAll("_", " ")}</span></div><button type="button" disabled={busy} className={actionClass} onClick={() => { if (busy) return; setError(""); setNotice(""); setSelected(row); setReason(""); }}>Review record<span className="sr-only"> for {row.station_name}</span></button></div></li>)}</ul> : <EmptyState title="No discount requests" message="New station discount requests will appear here for review." />}
    </div> : null}
    <AdminDialog open={Boolean(selected)} title="Review station discount" description="Partner request" onClose={() => setSelected(null)}>
      {selected ? feedback : null}
      {selected ? <div className="space-y-5"><dl className="admin-review-summary grid grid-cols-2 gap-5 rounded-xl bg-obligon-mist p-4 text-sm"><div><dt className="text-obligon-text">Station</dt><dd className="mt-1 break-words font-semibold">{selected.station_name}</dd></div><div><dt className="text-obligon-text">Partner</dt><dd className="mt-1 break-words font-semibold">{selected.partner_name}</dd></div><div><dt className="text-obligon-text">Discount</dt><dd className="mt-1 font-semibold">{selected.rate_bp / 100}% · {selected.fuel_type}</dd></div><div><dt className="text-obligon-text">Status</dt><dd className="mt-1 font-semibold capitalize">{selected.status.replaceAll("_", " ")}</dd></div><div className="col-span-2"><dt className="text-obligon-text">Active dates</dt><dd className="mt-1 font-semibold">{new Date(selected.starts_at).toLocaleString("en-NG")} to {new Date(selected.ends_at).toLocaleString("en-NG")}</dd></div></dl><p className="text-sm leading-6 text-obligon-text">Customer discount and Obligon fee are each calculated from the undiscounted fuel price.</p>{selected.status === "pending" ? <><label className="block text-sm font-semibold text-obligon-navy">Review reason<span className="mt-1 block text-xs font-normal text-obligon-text">Required when rejecting this request.</span><textarea disabled={busy} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-obligon-border bg-white p-3 font-normal" /></label><div className="admin-actions flex flex-wrap gap-3 border-t border-obligon-border pt-5"><button disabled={busy} onClick={() => void review(selected.id, "approved")} className={`${actionClass} !border-obligon-green !bg-obligon-green !text-white`}>Approve discount</button><button disabled={busy || !reason.trim()} onClick={() => void review(selected.id, "rejected")} className={actionClass}>Reject request</button></div></> : null}</div> : null}
    </AdminDialog>
  </section>;
}
