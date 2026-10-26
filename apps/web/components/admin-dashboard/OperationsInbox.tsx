"use client";
import { StatusPopup } from "@/components/shared/StatusPopup";
import * as React from "react";
import { authenticatedRequest } from "@/lib/services";
import { AdminDialog } from "./AdminDialog";
interface Ticket {
  id: string;
  reference: string;
  full_name?: string;
  subject: string;
  message: string;
  status: string;
  user_id?: string | null;
  requester_role?: string | null;
  organization_type?: string | null;
  organization_name?: string | null;
  contact_message_id?: string | null;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  category?: string;
  priority?: string;
  attachments?: string[];
}
interface Message { id: string; body: string; sender_role: string }
interface Order { id: string; reference: string; station_name: string; full_name: string; amount_kobo: number; review_reason: string; status: string }
interface Bank { id: string; organization: string; bankName: string; accountName: string; accountMask: string; verified: boolean; isDefault: boolean; needsRenomination: boolean }
interface Review { id: string; reference: string; organization: string; amount_kobo?: number; net_kobo?: number; failure_reason?: string }
type RequestSource = "Customer" | "Partner" | "Company" | "Public enquiry" | "Unknown";
const sources: RequestSource[] = ["Customer", "Partner", "Company", "Public enquiry", "Unknown"];
export function supportRequestSource(ticket: Pick<Ticket, "requester_role" | "organization_type" | "user_id" | "contact_message_id">): RequestSource {
  if (ticket.organization_type === "company") return "Company";
  if (ticket.organization_type === "partner" || ticket.organization_type === "mechanic") return "Partner";
  if (ticket.requester_role === "customer") return "Customer";
  if (ticket.requester_role === "company") return "Company";
  if (ticket.requester_role === "partner" || ticket.requester_role === "mechanic") return "Partner";
  if (!ticket.user_id && ticket.contact_message_id) return "Public enquiry";
  return "Unknown";
}
function SourceBadge({ source }: { source: RequestSource }) {
  return <span className="inline-flex items-center gap-1.5 rounded-md border border-obligon-border bg-obligon-mist px-2.5 py-1 text-xs font-semibold text-obligon-navy"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-obligon-green" />{source}</span>;
}
function BankVerificationStatus({ loading, failed, empty }: { loading: boolean; failed: boolean; empty: boolean }) {
  if (loading) return <StatusPopup tone="loading" message="Loading partner bank accounts…" />;
  if (failed) return <StatusPopup tone="error" message="Bank accounts could not be loaded. Refresh operational records to try again." />;
  if (empty) return <p className="py-3 text-obligon-text">No partner bank accounts are available for verification.</p>;
  return null;
}
export function OperationsInbox() {
  const [review, setReview] = React.useState<{ payouts: Review[]; settlements: Review[] }>({ payouts: [], settlements: [] });
  const [tickets, setTickets] = React.useState<Ticket[]>([]), [orders, setOrders] = React.useState<Order[]>([]), [banks, setBanks] = React.useState<Bank[]>([]), [selected, setSelected] = React.useState<Ticket | null>(null), [messages, setMessages] = React.useState<Message[]>([]), [text, setText] = React.useState(""), [error, setError] = React.useState(""), [success, setSuccess] = React.useState(""), [busy, setBusy] = React.useState(false);
  const [source, setSource] = React.useState<RequestSource | "All">("All");
  const [loading, setLoading] = React.useState(true), [loadFailed, setLoadFailed] = React.useState(false), [threadLoading, setThreadLoading] = React.useState(false), [threadFailed, setThreadFailed] = React.useState(false), [attachmentLoading, setAttachmentLoading] = React.useState(false);
  const selectSequence = React.useRef(0);
  const load = React.useCallback(async () => {
    setLoading(true); setLoadFailed(false); setError("");
    try {
      const [t, o, b, r] = await Promise.all([
        authenticatedRequest<{ tickets: Ticket[] }>("/api/admin/support"),
        authenticatedRequest<{ orders: Order[] }>("/api/admin/fuel-review"),
        authenticatedRequest<{ accounts: Bank[] }>("/api/admin/payout-accounts"),
        authenticatedRequest<{ payouts: Review[]; settlements: Review[] }>("/api/admin/settlement-review"),
      ]);
      setReview(r); setTickets(t.tickets); setOrders(o.orders); setBanks(b.accounts);
    } catch (e) { setError((e as Error).message); setLoadFailed(true); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  function closeTicket() { ++selectSequence.current; setSelected(null); setThreadLoading(false); setThreadFailed(false); }
  async function select(t: Ticket, preserveNotice = false) {
    if (busy || attachmentLoading) return;
    const sequence = ++selectSequence.current;
    setError(""); if (!preserveNotice) setSuccess(""); setText(""); setSelected(t); setMessages([]); setThreadLoading(true); setThreadFailed(false);
    try {
      const result = await authenticatedRequest<{ messages: Message[]; ticket: Ticket }>(`/api/admin/support/${t.id}/messages`);
      if (sequence === selectSequence.current) { setMessages(result.messages); setSelected({ ...t, ...result.ticket }); }
    } catch (e) { if (sequence === selectSequence.current) { setError((e as Error).message); setThreadFailed(true); } }
    finally { if (sequence === selectSequence.current) setThreadLoading(false); }
  }
  async function action(path: string, body: unknown, successMessage: string) {
    if (busy) return false;
    setBusy(true); setError(""); setSuccess("");
    try { await authenticatedRequest(path, { method: "POST", body: JSON.stringify(body) }); await load(); setSuccess(successMessage); return true; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  }
  const filteredTickets = source === "All" ? tickets : tickets.filter(ticket => supportRequestSource(ticket) === source);
  const feedback = <>
      {busy ? <StatusPopup tone="pending" message="Saving operational review…" /> : null}
      {loading ? <StatusPopup tone="loading" message="Loading operational records…" /> : null}
      {threadLoading ? <StatusPopup tone="loading" message="Loading support conversation…" /> : null}
      {attachmentLoading ? <StatusPopup tone="loading" message="Opening protected attachment…" /> : null}
      {error ? <StatusPopup tone="error" message={error} onRetry={loadFailed ? load : undefined} /> : null}
      {success ? <StatusPopup tone="success" message={success} /> : null}
  </>;
  return (
    <section className="admin-page mx-auto w-full min-w-0 max-w-[1600px] px-4 py-6 text-sm sm:px-6 sm:py-8 lg:px-8">
      {!selected ? feedback : null}
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-sm font-semibold text-obligon-green">Operations</p><h1 className="text-2xl font-bold tracking-tight text-obligon-navy sm:text-3xl">Support and settlement review</h1><p className="mt-2 max-w-2xl leading-6 text-obligon-text">Respond to requests, investigate payment exceptions and review partner bank accounts.</p></div>
        <button type="button" disabled={loading || busy} onClick={() => void load()} className="min-h-11 rounded-xl border border-obligon-border bg-white px-4 font-semibold">Refresh</button>
      </header>
      {!loading && !loadFailed ? <>
        <div className="admin-metric-rail mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[["Support requests", tickets.length], ["Fuel exceptions", orders.length], ["Settlement exceptions", review.payouts.length + review.settlements.length], ["Bank accounts", banks.length]].map(([label, count]) => <div key={label} className="rounded-2xl border border-obligon-border bg-white p-4 sm:p-5"><p className="text-sm text-obligon-text">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-obligon-navy">{count}</p></div>)}
        </div>
        <section aria-labelledby="support-requests-heading" className="admin-panel overflow-hidden rounded-2xl border border-obligon-border bg-white">
          <div className="border-b border-obligon-border p-5 sm:p-6"><h2 id="support-requests-heading" className="text-xl font-bold text-obligon-navy">Support requests</h2><p className="mt-1 text-obligon-text">Choose an account type, then open a request to review its conversation.</p>
            <p className="mt-3 text-xs leading-5 text-obligon-text">Showing up to 200 most recent requests. Counts apply to this view.</p>
            <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter support requests by source">
              {(["All", ...sources] as const).map(value => <button key={value} type="button" aria-pressed={source === value} disabled={busy || attachmentLoading} onClick={() => { if (busy || attachmentLoading) return; setError(""); setSuccess(""); setSource(value); }} className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${source === value ? "border-obligon-green bg-obligon-green text-white" : "border-obligon-border bg-white text-obligon-navy hover:bg-obligon-mist"}`}>{value}<span className="ml-2 tabular-nums opacity-75">{value === "All" ? tickets.length : tickets.filter(ticket => supportRequestSource(ticket) === value).length}</span></button>)}
            </div>
          </div>
          <div className="divide-y divide-obligon-border">
            {filteredTickets.map(ticket => <article key={ticket.id} className="flex min-w-0 flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div className="min-w-0 flex-1 basis-52"><div className="mb-2 flex flex-wrap items-center gap-2"><SourceBadge source={supportRequestSource(ticket)} /><span className="text-xs font-medium text-obligon-text">{ticket.reference}</span></div><h3 className="break-words text-base font-semibold text-obligon-navy [overflow-wrap:anywhere]">{ticket.subject}</h3><p className="mt-1 break-words text-sm text-obligon-text">{ticket.full_name ?? ticket.contact_name ?? ticket.contact_email ?? "Contact details unavailable"}{ticket.organization_name ? ` · ${ticket.organization_name}` : ""}</p></div>
              <div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-obligon-mist px-3 py-1.5 text-xs font-semibold capitalize text-obligon-navy">{ticket.status.replaceAll("_", " ")}</span><button type="button" className="min-h-11 rounded-lg border border-obligon-border bg-white px-4 font-semibold text-obligon-navy" disabled={busy || attachmentLoading} onClick={() => void select(ticket)} aria-pressed={selected?.id === ticket.id} aria-label={`Review request ${ticket.reference}`}>Review request <span aria-hidden="true" className="ml-2">↗</span></button></div>
            </article>)}
            {!filteredTickets.length ? <div className="p-8 text-center"><h3 className="font-semibold text-obligon-navy">{source === "All" ? "No support requests in this view." : `No matching ${source.toLowerCase()} requests in this view.`}</h3><p className="mt-2 text-obligon-text">{source === "All" ? "New requests will appear here when they are submitted." : "Choose another account type to view its requests."}</p></div> : null}
          </div>
        </section>
        <section aria-labelledby="fuel-exceptions-heading" className="admin-operations-section mt-7"><h2 id="fuel-exceptions-heading" className="text-xl font-bold text-obligon-navy">Paid fuel exceptions</h2><p className="mt-1 text-obligon-text">Review paid orders that could not be fulfilled before requesting a refund.</p>
          {orders.map(order => <article key={order.id} className="mt-5 rounded-xl border border-obligon-border p-4 sm:p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-obligon-navy">{order.reference}</h3><p className="mt-1 text-obligon-text">{order.full_name} · {order.station_name}</p></div><p className="text-lg font-bold tabular-nums">₦{(Number(order.amount_kobo) / 100).toLocaleString()}</p></div><p className="mt-3 text-obligon-text">{order.review_reason}</p><p className="mt-1 text-xs font-semibold capitalize">{order.status.replaceAll("_", " ")}</p><button type="button" disabled={busy || order.status === "refund_pending"} className="mt-4 min-h-11 rounded-lg border border-obligon-border px-4 font-semibold" onClick={() => void action(`/api/admin/fuel-review/${order.id}/refund`, { reason: "Paid order could not be fulfilled within card limits" }, "Refund request recorded. Check its status before taking further action.")}>Request original-payment refund</button></article>)}
          {!orders.length ? <p className="mt-4 py-3 text-obligon-text">No paid fuel exceptions.</p> : null}
        </section>
        <section aria-labelledby="settlement-exceptions-heading" className="admin-operations-section mt-7"><h2 id="settlement-exceptions-heading" className="text-xl font-bold text-obligon-navy">Settlement exceptions</h2><p className="mt-1 max-w-3xl leading-6 text-obligon-text">Check processor statements before resolving uncertain transfers or historical accounting. Funds stay reserved while transfer status is unknown.</p>
          {review.payouts.map(payout => <article key={payout.id} className="mt-4 rounded-xl border border-obligon-border p-5"><h3 className="font-semibold">{payout.organization}</h3><p className="mt-1 text-obligon-text">{payout.reference} · ₦{(Number(payout.amount_kobo) / 100).toLocaleString()}</p><p className="mt-3">{payout.failure_reason}</p></article>)}
          {review.settlements.map(settlement => <article key={settlement.id} className="mt-4 rounded-xl border border-obligon-border p-5"><h3 className="font-semibold">{settlement.organization}</h3><p className="mt-1 text-obligon-text">{settlement.reference}</p><p className="mt-3">Historical settlement requires statement reconciliation.</p></article>)}
          {!review.payouts.length && !review.settlements.length ? <p className="mt-4 py-3 text-obligon-text">No settlement exceptions.</p> : null}
        </section>
        <section aria-labelledby="bank-verification-heading" className="admin-operations-section mt-7"><h2 id="bank-verification-heading" className="mb-5 text-xl font-bold text-obligon-navy">Partner bank verification</h2><BankVerificationStatus loading={false} failed={false} empty={banks.length === 0} />
          {banks.map(bank => <article key={bank.id} className="mt-4 rounded-xl border border-obligon-border p-4 sm:p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{bank.organization}</h3><p className="mt-1 text-obligon-text">{bank.bankName} · {bank.accountName}</p><p className="mt-1 font-mono text-sm">{bank.accountMask}</p></div><span className="h-fit rounded-full bg-obligon-mist px-3 py-1.5 text-xs font-semibold">{bank.needsRenomination ? "Account replacement needed" : bank.verified ? "Verified" : "Pending review"}</span></div>{bank.needsRenomination ? <p className="mt-3 text-obligon-text">The partner must add this bank account again before it can be verified.</p> : null}<button type="button" disabled={busy || !bank.isDefault || bank.needsRenomination} className="mt-4 min-h-11 rounded-lg border border-obligon-border px-4 font-semibold" onClick={() => void action(`/api/admin/payout-accounts/${bank.id}/verify`, { approved: !bank.verified }, bank.verified ? "Bank verification revoked." : "Bank account verification saved.")}>{bank.verified ? "Revoke verification" : "Verify default account"}</button></article>)}
        </section>
      </> : <div className="rounded-2xl border border-obligon-border bg-white p-6"><h2 className="font-semibold text-obligon-navy">Operational records</h2><p className="mt-2 text-obligon-text">Support, payment exceptions and bank reviews appear here once records are available.</p></div>}
      <AdminDialog open={Boolean(selected)} title={selected?.subject ?? "Review support request"} description={selected ? `${selected.reference} · ${supportRequestSource(selected)}` : undefined} onClose={closeTicket} wide>
        {selected ? feedback : null}
        {selected ? <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2"><SourceBadge source={supportRequestSource(selected)} /><span className="rounded-full bg-obligon-mist px-3 py-1.5 text-xs font-semibold capitalize">{selected.status.replaceAll("_", " ")}</span>{selected.priority ? <span className="text-xs text-obligon-text">{selected.priority} priority</span> : null}</div>
          <div className="rounded-xl border border-obligon-border bg-obligon-mist/40 p-4"><p className="font-semibold text-obligon-navy">{selected.full_name ?? selected.contact_name ?? "Requester"}</p>{selected.organization_name ? <p className="mt-1 text-obligon-text">{selected.organization_name}</p> : null}<p className="mt-1 break-words text-sm text-obligon-text">{[selected.contact_email, selected.contact_phone].filter(Boolean).join(" · ")}</p><p className="mt-4 whitespace-pre-wrap break-words leading-6">{selected.message}</p></div>
          {selected.attachments?.length ? <div className="flex flex-wrap gap-2">{selected.attachments.map((_, index) => <button type="button" key={index} className="min-h-11 rounded-lg border border-obligon-border px-3 font-semibold" onClick={async () => { setAttachmentLoading(true); setError(""); try { const result = await authenticatedRequest<{ url: string }>(`/api/admin/support/${selected.id}/attachments/${index}`); window.location.assign(result.url); } catch (e) { setError((e as Error).message); } finally { setAttachmentLoading(false); } }}>Open attachment {index + 1}</button>)}</div> : null}
          {messages.length ? <div className="space-y-3"><h3 className="font-semibold text-obligon-navy">Conversation</h3>{messages.map(message => <div key={message.id} className="rounded-xl border border-obligon-border p-4"><p className="mb-1 text-xs font-semibold capitalize text-obligon-text">{message.sender_role}</p><p className="whitespace-pre-wrap break-words leading-6">{message.body}</p></div>)}</div> : null}
          {threadFailed ? <button type="button" className="min-h-11 rounded-lg border border-obligon-border px-4 font-semibold" onClick={() => void select(selected)}>Retry conversation</button> : null}
          <form onSubmit={async event => { event.preventDefault(); const sequence = selectSequence.current; if (await action(`/api/admin/support/${selected.id}/messages`, { message: text }, "Reply sent.") && sequence === selectSequence.current) { setText(""); await select(selected, true); } }}>
            <label className="block font-semibold text-obligon-navy" htmlFor="admin-support-reply">Reply</label><textarea id="admin-support-reply" className="mt-2 block min-h-32 w-full rounded-xl border border-obligon-border bg-white p-3 font-normal" maxLength={5000} required value={text} onChange={event => setText(event.target.value)} />
            <div className="mt-4 flex flex-wrap items-center gap-3"><button disabled={busy || threadLoading || threadFailed || !text.trim()} className="min-h-11 rounded-lg bg-obligon-green px-5 font-semibold text-white">Send reply</button><button disabled={busy || threadLoading || threadFailed} type="button" className="min-h-11 rounded-lg border border-obligon-border px-4 font-semibold" onClick={async () => { setBusy(true); setError(""); setSuccess(""); try { await authenticatedRequest(`/api/admin/support/${selected.id}`, { method: "PATCH", body: JSON.stringify({ status: selected.status === "closed" ? "active" : "closed" }) }); await load(); closeTicket(); setSuccess(selected.status === "closed" ? "Support request reopened." : "Support request closed."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{selected.status === "closed" ? "Reopen ticket" : "Close ticket"}</button></div>
          </form>
        </div> : null}
      </AdminDialog>
    </section>
  );
}
