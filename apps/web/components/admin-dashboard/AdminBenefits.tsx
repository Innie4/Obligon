"use client";

import * as React from "react";
import { api } from "@/lib/services";
import { benefitAmountKobo, benefitMoney } from "@/lib/benefit-money";
import { useAsync } from "@/components/shared/useAsync";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { AdminDialog } from "./AdminDialog";
import type { Repair } from "@/components/customer-dashboard/CustomerBenefits";

type Budget = { availableKobo: number; pendingCashbackKobo: number | string; reservedRepairKobo: number | string; fundingAvailable: boolean; fundingBlockReason?: string; requirements?: string[] };
type QuoteDraft = { labour: string; parts: string; scope: string; partner: string };
type FundingIntent = { id: string; reference: string; amountKobo: number; status: string; checkoutState: string; checkoutUrl: string | null; verifiedNetKobo: number | null; reviewReason: string | null; createdAt: string };
const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-obligon-border bg-white px-3 text-sm text-obligon-navy";
const buttonClass = "min-h-11 rounded-xl border border-obligon-border px-4 py-2 text-sm font-bold text-obligon-green disabled:opacity-50";

export function AdminBenefits() {
  const budget = useAsync(() => api.request<Budget>("/api/admin/benefits/budget"));
  const fundingHistory = useAsync(() => api.request<{ funding: FundingIntent[] }>("/api/admin/benefits/funding"));
  const repairs = useAsync(() => api.request<{ repairs: Repair[]; partners: Array<{ id: string; name: string }> }>("/api/admin/generator-repairs"));
  const [funding, setFunding] = React.useState("");
  const [busy, setBusy] = React.useState(false), [failure, setFailure] = React.useState(""), [success, setSuccess] = React.useState("");
  const [drafts, setDrafts] = React.useState<Record<string, QuoteDraft>>({});
  const [confirm, setConfirm] = React.useState<{ title: string; message: string; run: () => void } | null>(null);
  const [selectedRepairId, setSelectedRepairId] = React.useState<string | null>(null);
  const intents = React.useRef(new Map<string, string>());
  const fundingReturn = React.useRef(false);
  const fundingInFlight = React.useRef(false);
  function keyFor(action: string, payload: string) {
    const identity = `${action}:${payload}`;
    if (!intents.current.has(identity)) intents.current.set(identity, crypto.randomUUID());
    return intents.current.get(identity)!;
  }
  async function mutate(path: string, body: object, notice: string) {
    if (busy || fundingInFlight.current) return;
    setBusy(true); setFailure(""); setSuccess("");
    try { await api.request(path, { method: "POST", body: JSON.stringify(body) }); setSuccess(notice); budget.reload(); fundingHistory.reload(); repairs.reload(); }
    catch (failure) { setFailure(failure instanceof Error ? failure.message : "The benefit action could not be confirmed."); }
    finally { setBusy(false); }
  }
  React.useEffect(() => {
    if (fundingReturn.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("paymentFlow") !== "benefitfunding" || !params.get("reference")) return;
    fundingReturn.current = true;
    void mutate("/api/admin/benefits/funding/confirm", { reference: params.get("reference"), ...(params.get("transaction_id") ? { transactionId: params.get("transaction_id") } : {}) }, "Funding verification updated. Review the available programme balance.");
    // A processor return is checked once; failed confirmation remains visible for review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function startFunding(event: React.FormEvent) {
    event.preventDefault();
    if (busy || fundingInFlight.current) return;
    setFailure(""); setSuccess("");
    const amountKobo = benefitAmountKobo(funding);
    if (!amountKobo || amountKobo % 100 !== 0) { setFailure("Enter a positive whole-naira funding amount."); return; }
    if (fundingHistory.status !== "success" || fundingHistory.error) { setFailure("Load funding history before starting another payment."); return; }
    const unresolved = fundingHistory.data?.funding.find(intent => intent.status !== "paid" && intent.amountKobo === amountKobo);
    if (unresolved) { setFailure(`Funding request ${unresolved.reference} already exists for this amount. Check or resume that request in Funding history and recovery.`); return; }
    fundingInFlight.current = true;
    setBusy(true); setFailure(""); setSuccess("");
    try {
      const checkout = await api.request<{ authorization_url: string; reference: string }>("/api/admin/benefits/funding/checkout", { method: "POST", body: JSON.stringify({ amountKobo, idempotencyKey: keyFor("fund", String(amountKobo)) }) });
      const url = new URL(checkout.authorization_url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.flutterwave.com") throw new Error("The payment provider returned an unexpected checkout address.");
      window.location.assign(url.href);
    } catch (failure) { setFailure(failure instanceof Error ? failure.message : "Programme funding could not start."); fundingHistory.reload(); }
    finally { fundingInFlight.current = false; setBusy(false); }
  }
  async function quote(repair: Repair, event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setSuccess("");
    const draft = drafts[repair.id];
    const labourKobo = benefitAmountKobo(draft?.labour ?? "", true);
    const partsKobo = benefitAmountKobo(draft?.parts ?? "0", true);
    if (labourKobo === null || partsKobo === null || (labourKobo === 0 && partsKobo === 0) || !draft.partner || draft.scope.trim().length < 10) { setFailure("Enter labour, parts, a verified repair partner and a clear scope of work."); return; }
    const body = { labourKobo, partsKobo, scope: draft.scope.trim(), partnerOrgId: draft.partner };
    await mutate(`/api/admin/generator-repairs/${repair.id}/quote`, { ...body, idempotencyKey: keyFor(`quote:${repair.id}`, JSON.stringify(body)) }, "Repair quote recorded. Check its funding status before asking the customer to pay.");
  }
  function draftFor(id: string) { return drafts[id] ?? { labour: "", parts: "0", scope: "", partner: "" }; }
  function change(id: string, values: Partial<QuoteDraft>) { setDrafts(current => ({ ...current, [id]: { ...(current[id] ?? draftFor(id)), ...values } })); }
  const reviewOpen = repairs.data?.repairs.some(repair => repair.id === selectedRepairId);
  const feedback = <>
{(budget.status === "loading" || repairs.status === "loading" || fundingHistory.status === "loading") ? <StatusPopup tone="loading" message="Loading customer benefits…" /> : null}{busy ? <StatusPopup tone="pending" message="Processing the benefit action…" /> : null}
    {fundingHistory.error ? <StatusPopup tone="error" message={fundingHistory.error.message} onRetry={fundingHistory.reload} /> : null}
    {failure ? <StatusPopup tone="error" message={failure} /> : null}{budget.error ? <StatusPopup tone="error" message={budget.error.message} onRetry={budget.reload} /> : null}{repairs.error ? <StatusPopup tone="error" message={repairs.error.message} onRetry={repairs.reload} /> : null}{success ? <StatusPopup tone="success" title="Benefit update" message={success} /> : null}
  </>;
  return <section className="admin-page mx-auto w-full min-w-0 max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
    {!reviewOpen && !confirm ? feedback : null}
    <p className="text-xs font-bold uppercase tracking-wider text-obligon-green">Customer programme</p><h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-obligon-navy">Customer benefits</h1><p className="mt-4 max-w-3xl text-sm leading-6 text-obligon-text">Fund cashback and labour subsidies from verified Obligon programme funds. Customer fuel balances do not fund the programme.</p>
    <section className="admin-panel mt-8 rounded-2xl border border-obligon-border bg-white p-5 sm:p-7" aria-label="Programme funding">
      <h2 className="font-display text-xl font-bold text-obligon-navy">Programme balance</h2>
      {budget.data ? <><div className="mt-5 grid gap-5 border-y border-obligon-border py-5 sm:grid-cols-3">{[["Available funds", budget.data.availableKobo], ["Pending cashback", budget.data.pendingCashbackKobo], ["Reserved repair subsidies", budget.data.reservedRepairKobo]].map(([label, value]) => <div key={label} className="min-w-0"><p className="text-xs font-semibold text-obligon-text">{label}</p><p className="mt-2 break-words text-2xl font-bold tabular-nums text-obligon-navy [overflow-wrap:anywhere]">{benefitMoney(value)}</p></div>)}</div><form onSubmit={startFunding} className="mt-5 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="block min-w-0 text-sm font-semibold text-obligon-navy">Fund programme (₦)<input type="text" inputMode="numeric" required value={funding} disabled={busy || !budget.data.fundingAvailable || fundingHistory.status !== "success" || Boolean(fundingHistory.error)} onChange={event => setFunding(event.target.value)} className={inputClass} /></label><button type="submit" disabled={busy || !budget.data.fundingAvailable || fundingHistory.status !== "success" || Boolean(fundingHistory.error)} className={`${buttonClass} min-h-12 w-full sm:w-auto`}>Continue to secure funding</button></form>{budget.data.fundingBlockReason ? <p className="mt-4 text-sm leading-6 text-obligon-text">{budget.data.fundingBlockReason}</p> : null}<p className="mt-4 text-xs leading-5 text-obligon-text">A successful checkout is not enough to fund the programme. The server must verify the payment and its net settlement amount. Uncertain payments remain under review.</p></> : null}
      {fundingHistory.data?.funding.length ? <div className="mt-6 border-t border-obligon-border pt-5"><h3 className="text-sm font-bold text-obligon-navy">Funding history and recovery</h3><ul className="mt-3 divide-y divide-obligon-border">{fundingHistory.data.funding.map(intent => <li key={intent.id} className="py-4"><div className="flex flex-wrap justify-between gap-3"><span className="break-all text-sm font-bold text-obligon-navy">{intent.reference}</span><span className="text-sm font-bold text-obligon-green">{benefitMoney(intent.amountKobo)} · {intent.status.replaceAll("_", " ")}</span></div><p className="mt-2 text-xs leading-5 text-obligon-text">{intent.verifiedNetKobo !== null ? `Verified net funding: ${benefitMoney(intent.verifiedNetKobo)}.` : "No net settlement has been credited."} {intent.reviewReason ?? ""}</p>{intent.status !== "paid" ? <button type="button" disabled={busy} onClick={() => void mutate("/api/admin/benefits/funding/confirm", { reference: intent.reference }, "Funding verification updated. Check the recorded status and programme balance.")} className={`${buttonClass} mt-3`}>Check this funding payment</button> : null}{intent.status === "pending" && intent.checkoutState === "ready" && intent.checkoutUrl && (() => { try { const url = new URL(intent.checkoutUrl); return url.protocol === "https:" && url.hostname === "checkout.flutterwave.com"; } catch { return false; } })() ? <a href={intent.checkoutUrl} className="ml-3 inline-flex min-h-11 items-center text-sm font-bold text-obligon-green underline">Resume existing checkout</a> : null}</li>)}</ul></div> : fundingHistory.status === "success" && !fundingHistory.error ? <p className="mt-5 text-sm text-obligon-text">No programme funding payments yet.</p> : null}
    </section>
    <section className="admin-panel mt-8 rounded-2xl border border-obligon-border bg-white p-5 sm:p-7" aria-label="Generator repair reviews"><h2 className="font-display text-xl font-bold text-obligon-navy">Generator repair reviews</h2><p className="mt-3 text-sm leading-6 text-obligon-text">Quote labour and parts separately. Only labour receives the customer’s plan discount. Completion records an amount payable to the repair partner; it does not confirm an external payout.</p>
      {repairs.data?.repairs.length ? <ul className="mt-6 divide-y divide-obligon-border">{repairs.data.repairs.map(repair => {
        const draft = draftFor(repair.id);
        return <li key={repair.id} className="py-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="min-w-0"><h3 className="break-words text-sm font-bold text-obligon-navy">{repair.reference}</h3><p className="mt-1 text-sm text-obligon-text">{repair.customerName ?? "Customer"} · {repair.status.replaceAll("_", " ")}</p><p className="mt-2 text-xs text-obligon-text">{repair.planCode} · {repair.labourDiscountPercent}% labour subsidy</p></div><button type="button" disabled={busy} className={buttonClass} onClick={() => { if (busy) return; setFailure(""); setSuccess(""); setSelectedRepairId(repair.id); }}>Review record<span className="sr-only"> for {repair.reference}</span></button></div><AdminDialog open={selectedRepairId === repair.id} title={`Repair ${repair.reference}`} description="Customer benefit request" onClose={() => setSelectedRepairId(null)} wide>{selectedRepairId === repair.id && !confirm ? feedback : null}<div className="flex flex-wrap justify-between gap-3"><h3 className="text-sm font-bold text-obligon-navy">{repair.reference} · {repair.customerName ?? "Customer"}</h3><span className="text-xs font-bold capitalize text-obligon-green">{repair.status.replaceAll("_", " ")}</span></div><p className="mt-3 text-sm leading-6 text-obligon-text">{repair.description}</p><p className="mt-2 text-xs font-semibold text-obligon-green">{repair.planCode} · {repair.labourDiscountPercent}% labour subsidy</p>
          {["requested", "quoted", "awaiting_funding"].includes(repair.status) ? <form onSubmit={event => void quote(repair, event)} className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-obligon-navy">Labour (₦)<input required type="text" inputMode="decimal" value={draft.labour} disabled={busy} onChange={event => change(repair.id, { labour: event.target.value })} className={inputClass} /></label><label className="text-sm font-semibold text-obligon-navy">Parts (₦)<input required type="text" inputMode="decimal" value={draft.parts} disabled={busy} onChange={event => change(repair.id, { parts: event.target.value })} className={inputClass} /></label><label className="text-sm font-semibold text-obligon-navy sm:col-span-2">Verified repair partner<select required value={draft.partner} disabled={busy} onChange={event => change(repair.id, { partner: event.target.value })} className={inputClass}><option value="">Choose a verified partner</option>{repairs.data?.partners.map(partner => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label><label className="text-sm font-semibold text-obligon-navy sm:col-span-2">Scope of work<textarea required minLength={10} maxLength={4000} value={draft.scope} disabled={busy} onChange={event => change(repair.id, { scope: event.target.value })} className={`${inputClass} min-h-24 py-3`} /></label><button type="submit" disabled={busy} className={`${buttonClass} sm:col-span-2`}>Record itemized quote</button></form> : null}
          {repair.quote ? <div className="mt-5 border-t border-obligon-border pt-4"><p className="text-sm font-bold text-obligon-navy">Quote {repair.quote.version} · {repair.quote.partnerName}</p><p className="mt-2 text-sm leading-6 text-obligon-text">Labour {benefitMoney(repair.quote.labourKobo)} · Parts {benefitMoney(repair.quote.partsKobo)} · Programme {benefitMoney(repair.quote.subsidyKobo)} · Customer {benefitMoney(repair.quote.customerPayableKobo)}</p><p className="mt-2 text-xs text-obligon-text">Funding: {repair.quote.fundingStatus}</p><div className="mt-4 flex flex-wrap gap-3">{repair.status === "awaiting_funding" ? <button type="button" disabled={busy} className={buttonClass} onClick={() => void mutate(`/api/admin/generator-repairs/${repair.id}/fund`, { quoteVersion: repair.quote!.version }, "Repair funding checked.")}>Reserve programme funding</button> : null}{repair.status === "accepted" ? <button type="button" disabled={busy} className={buttonClass} onClick={() => void mutate(`/api/admin/generator-repairs/${repair.id}/start`, { quoteVersion: repair.quote!.version }, "Repair marked in progress.")}>Start work</button> : null}{repair.status === "in_progress" ? <button type="button" disabled={busy} className={buttonClass} onClick={() => { if (busy) return; setFailure(""); setSuccess(""); setConfirm({ title: "Complete this repair?", message: "Confirm that the quoted work was completed. This releases held funds to the recorded repair-partner liability, and records the amount payable. It does not send an external payout.", run: () => void mutate(`/api/admin/generator-repairs/${repair.id}/complete`, { quoteVersion: repair.quote!.version, completionNote: "Administrator confirmed the quoted work was completed." }, "Repair completed. Partner payment is now recorded as payable.") }); }}>Confirm completed work</button> : null}</div></div> : null}
          {!["in_progress", "completed", "cancelled"].includes(repair.status) ? <button type="button" disabled={busy} className={`${buttonClass} mt-4`} onClick={() => { if (busy) return; setFailure(""); setSuccess(""); setConfirm({ title: "Cancel this repair?", message: "Any held customer payment will be refunded and unused programme funding released.", run: () => void mutate(`/api/admin/generator-repairs/${repair.id}/cancel`, { reason: "Administrator cancelled before work started." }, "Repair cancelled and held funds released.") }); }}>Cancel repair</button> : null}
          {repair.receipt ? <p className="mt-4 break-all text-xs leading-5 text-obligon-text">Receipt {repair.receipt.reference} · {repair.receipt.paymentState.replaceAll("_", " ")}</p> : null}
        </AdminDialog></li>;
      })}</ul> : repairs.status === "success" && !repairs.error ? <p className="mt-5 text-sm text-obligon-text">No generator repair requests yet.</p> : null}
    </section>
    <AdminDialog open={Boolean(confirm)} title={confirm?.title ?? "Confirm repair action"} onClose={() => setConfirm(null)}>{confirm ? feedback : null}{confirm ? <><p className="text-sm leading-6 text-obligon-text">{confirm.message}</p><div className="admin-actions mt-6 flex flex-wrap gap-3"><button type="button" className={buttonClass} onClick={() => { confirm.run(); setConfirm(null); }}>Confirm</button><button type="button" className={buttonClass} onClick={() => setConfirm(null)}>Cancel</button></div></> : null}</AdminDialog>
  </section>;
}
