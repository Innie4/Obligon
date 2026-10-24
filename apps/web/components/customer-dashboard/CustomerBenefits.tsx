"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BellRing, ChartNoAxesCombined, Gift, Wrench } from "lucide-react";
import { api } from "@/lib/services";
import { customerFeatureAvailable } from "@/lib/customer-entitlements";
import { benefitAmountKobo, benefitMoney } from "@/lib/benefit-money";
import { useAsync } from "@/components/shared/useAsync";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { ConfirmModal } from "@/components/shared/Dialogs";
import { useCustomerAccess } from "./CustomerAccess";
import { useSession } from "@/components/shared/AuthContext";
import { readCashbackIntent, saveCashbackIntent, clearCashbackIntent, type CashbackIntent } from "@/lib/cashback-intent";

export type Repair = {
  id: string; reference: string; description: string; status: string; planCode: string; labourDiscountPercent: number; createdAt: string;
  customerName?: string;
  quote: null | { version: number; scope: string; labourKobo: number; partsKobo: number; subsidyKobo: number; customerPayableKobo: number; totalKobo: number; partnerOrgId: string; partnerName: string; fundingStatus: string };
  receipt: null | { reference: string; customerPaidKobo: number; subsidyKobo: number; totalKobo: number; paymentState: string; paidAt: string; completionNote?: string };
};
type Analytics = { range: string; timeZone: string; spendKobo: string; purchaseCount: number; quantities: Record<string, string>; byFuel: Array<{ fuelType: string; sellingUnit: string; quantity: string; spendKobo: string; purchaseCount: number }>; days: Array<{ date: string; spendKobo: string; purchaseCount: number }> };
type Rewards = { ratePercent: number; availableKobo: number; pendingKobo: number | string; recoveryKobo: number; programmeFunded: boolean; terms: string | string[]; redemptions: Array<{ id: string; amountKobo: number; reference: string; idempotencyKey: string; createdAt: string }> };
type AlertSettings = { enabled: boolean; thresholds: number[]; budgetKobo: string | null; spendKobo: string; delivery: Record<string, string> };
const sectionClass = "mt-8 min-w-0 rounded-2xl border border-obligon-border bg-white p-5 sm:p-7";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-obligon-border px-4 py-2 text-sm font-bold text-obligon-green disabled:opacity-50";
const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-obligon-border bg-white px-3 text-sm text-obligon-navy";

function BenefitHeading({ icon: Icon, title, children }: { icon: typeof Gift; title: string; children: React.ReactNode }) {
  return <div><div className="flex items-center gap-3"><Icon size={22} className="shrink-0 text-obligon-green" aria-hidden="true" /><h2 className="font-display text-xl font-bold tracking-tight text-obligon-navy">{title}</h2></div><p className="mt-3 max-w-2xl text-sm leading-6 text-obligon-text">{children}</p></div>;
}

export function CustomerPurchaseAnalytics() {
  const [range, setRange] = React.useState("30");
  const { data, status, error, reload } = useAsync(() => api.request<{ analytics: Analytics }>(`/api/customer/benefits/analytics?range=${range}`), [range]);
  const analytics = status === "success" && !error ? data?.analytics : null;
  return <section className={sectionClass} aria-label="Fuel purchase analytics">
    {status === "loading" ? <StatusPopup tone="loading" message="Loading fuel purchase analytics…" /> : null}
    {error ? <StatusPopup tone="error" message={error.message} onRetry={reload} /> : null}
    <div className="flex flex-wrap items-start justify-between gap-4"><BenefitHeading icon={ChartNoAxesCombined} title="Fuel purchase analytics">See what you bought, what you spent and how quantities changed. Litres, kilograms and standard cubic metres stay separate.</BenefitHeading><label className="text-xs font-bold text-obligon-text">Period<select value={range} onChange={event => setRange(event.target.value)} className={inputClass}>{[7, 30, 90, 365].map(days => <option key={days} value={days}>Last {days} days</option>)}</select></label></div>
    {analytics ? <>
      <div className="mt-6 grid gap-5 border-y border-obligon-border py-5 sm:grid-cols-3"><div><p className="text-xs font-semibold text-obligon-text">Fuel spend</p><p className="mt-2 text-2xl font-bold text-obligon-navy">{benefitMoney(analytics.spendKobo)}</p></div><div><p className="text-xs font-semibold text-obligon-text">Completed purchases</p><p className="mt-2 text-2xl font-bold text-obligon-navy">{analytics.purchaseCount}</p></div><div><p className="text-xs font-semibold text-obligon-text">Recorded quantities</p><p className="mt-2 text-sm font-bold leading-6 text-obligon-navy">{Object.entries(analytics.quantities).map(([unit, value]) => `${value} ${unit}`).join(" · ")}</p></div></div>
      {analytics.purchaseCount ? <div className="mt-5 grid gap-6 lg:grid-cols-2"><div><h3 className="text-sm font-bold text-obligon-navy">By fuel</h3><ul className="mt-3 divide-y divide-obligon-border">{analytics.byFuel.map((fuel, index) => <li key={`${fuel.fuelType}-${fuel.sellingUnit}-${index}`} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span className="text-obligon-text">{fuel.fuelType} · {fuel.quantity} {fuel.sellingUnit}</span><strong className="text-obligon-navy">{benefitMoney(fuel.spendKobo)}</strong></li>)}</ul></div><div><h3 className="text-sm font-bold text-obligon-navy">Purchase days</h3><ul className="mt-3 divide-y divide-obligon-border">{analytics.days.filter(day => day.purchaseCount > 0).slice(-7).map(day => <li key={day.date} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span className="text-obligon-text">{day.date} · {day.purchaseCount} purchases</span><strong className="text-obligon-navy">{benefitMoney(day.spendKobo)}</strong></li>)}</ul></div></div> : <p className="mt-5 text-sm leading-6 text-obligon-text">No completed fuel purchases in this period. Your recorded purchases will appear here.</p>}
      <p className="mt-5 text-xs leading-5 text-obligon-text">Dates use {analytics.timeZone}. This is purchased fuel, not a vehicle-efficiency estimate.</p>
    </> : null}
  </section>;
}

export function CustomerRewards() {
  const { user } = useSession();
  const { data, status, error, reload } = useAsync(() => api.request<Rewards>("/api/customer/rewards"));
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false), [failure, setFailure] = React.useState(""), [success, setSuccess] = React.useState("");
  const [intent, setIntent] = React.useState<CashbackIntent | null>(null);
  const [intentReady, setIntentReady] = React.useState(false);
  const inFlight = React.useRef(false);
  React.useEffect(() => {
    if (!user?.id) return;
    try { setIntent(readCashbackIntent(localStorage, user.id)); setIntentReady(true); }
    catch { setFailure("Your pending cashback request could not be read. Check browser storage before redeeming again."); }
  }, [user?.id]);
  React.useEffect(() => {
    if (!intent || !user?.id || !data) return;
    const confirmed = data.redemptions.find(redemption => redemption.idempotencyKey === intent.idempotencyKey);
    if (!confirmed) return;
    try { clearCashbackIntent(localStorage, user.id); setIntent(null); setSuccess(`Your cashback redemption is confirmed. Reference: ${confirmed.reference}`); }
    catch { setFailure("The redemption is confirmed, but its local recovery record could not be cleared. Check browser storage."); }
  }, [data, intent, user?.id]);
  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    if (!user?.id || !intentReady || inFlight.current) return;
    let savedIntent: CashbackIntent | null;
    try { savedIntent = readCashbackIntent(localStorage, user.id); }
    catch { setFailure("Your pending cashback request could not be read. Check browser storage before redeeming again."); return; }
    const currentIntent = savedIntent ?? intent;
    const amountKobo = currentIntent?.amountKobo ?? benefitAmountKobo(amount);
    if (currentIntent) setIntent(currentIntent);
    if (!amountKobo || !data || (!currentIntent && amountKobo > data.availableKobo)) { setFailure("Enter an amount within your available cashback."); return; }
    const request = currentIntent ?? { amountKobo, idempotencyKey: crypto.randomUUID() };
    inFlight.current = true;
    try { saveCashbackIntent(localStorage, user.id, request); setIntent(request); }
    catch { inFlight.current = false; setFailure("The recovery key could not be saved. Check browser storage before redeeming."); return; }
    setBusy(true); setFailure(""); setSuccess("");
    try {
      const result = await api.request<{ reference: string }>("/api/customer/rewards/redeem", { method: "POST", body: JSON.stringify(request) });
      clearCashbackIntent(localStorage, user.id); setIntent(null);
      setSuccess(`Cashback added to your fuel wallet. Reference: ${result.reference}`); setAmount(""); reload();
    } catch (failure) {
      const status = (failure as { status?: number }).status;
      const definitiveDecline = (failure as { details?: { code?: string[] } }).details?.code?.includes("cashback_not_redeemed");
      if (definitiveDecline || (!currentIntent && status && status >= 400 && status < 500 && status !== 408 && status !== 409)) {
        try { clearCashbackIntent(localStorage, user.id); setIntent(null); } catch { /* Keep the recovery key when storage is unavailable. */ }
      }
      setFailure(failure instanceof Error ? failure.message : "Redemption could not be confirmed. Retry the saved request to check it safely.");
      reload();
    }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section id="cashback" className={sectionClass} aria-label="Cashback rewards">
    {status === "loading" ? <StatusPopup tone="loading" message="Loading cashback rewards…" /> : null}
    {busy ? <StatusPopup tone="pending" message="Confirming your cashback redemption…" /> : null}
    {failure || error ? <StatusPopup tone="error" message={failure || error?.message} onRetry={error ? reload : undefined} /> : null}
    {success ? <StatusPopup tone="success" message={success} /> : null}
    <BenefitHeading icon={Gift} title="Cashback rewards">Gold and Platinum earn 5% on eligible completed personal fuel purchases, after discounts and excluding fees. Earned rewards have no expiry.</BenefitHeading>
    {data ? <><div className="mt-6 grid gap-5 border-y border-obligon-border py-5 sm:grid-cols-3">{[["Available", data.availableKobo], ["Awaiting programme funding", data.pendingKobo], ["Refund recovery", data.recoveryKobo]].map(([label, value]) => <div key={label}><p className="text-xs font-semibold text-obligon-text">{label}</p><p className="mt-2 text-2xl font-bold text-obligon-navy">{benefitMoney(value)}</p></div>)}</div>
      {!data.ratePercent ? <p className="mt-4 text-sm leading-6 text-obligon-text">Your current plan does not earn new cashback. Previously earned rewards remain available.</p> : null}
      <form onSubmit={redeem} className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-semibold text-obligon-navy">Redeem to fuel wallet (₦)<input type="text" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} required disabled={busy || status !== "success" || Boolean(error) || Boolean(intent) || !intentReady || !data.availableKobo} className={inputClass} /></label><button type="submit" disabled={busy || status !== "success" || Boolean(error) || !intentReady || (!intent && !data.availableKobo)} className={`${buttonClass} min-h-12`}>{intent ? `Check saved redemption (${benefitMoney(intent.amountKobo)})` : "Redeem cashback"} <ArrowRight size={17} aria-hidden="true" /></button></form>
      <p className="mt-4 text-xs leading-5 text-obligon-text">Obligon funds these rewards. Pending rewards become available when funding is reserved. Refunds reverse the related cashback; any cashback already used is recovered from future rewards.</p>
      {data.redemptions.length ? <ul className="mt-5 divide-y divide-obligon-border" aria-label="Cashback redemptions">{data.redemptions.slice(0, 5).map(item => <li key={item.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span className="break-all text-obligon-text">{item.reference}</span><strong className="text-obligon-navy">{benefitMoney(item.amountKobo)}</strong></li>)}</ul> : <p className="mt-5 text-sm text-obligon-text">Your cashback redemptions will appear here.</p>}
    </> : null}
  </section>;
}

export function CustomerSpendingAlerts({ embedded = false }: { embedded?: boolean }) {
  const { data, status, error, reload } = useAsync(() => api.request<{ spendingAlerts: AlertSettings }>("/api/customer/benefits/spending-alerts"));
  const [busy, setBusy] = React.useState(false), [failure, setFailure] = React.useState(""), [success, setSuccess] = React.useState("");
  const [thresholds, setThresholds] = React.useState("80, 100");
  React.useEffect(() => { if (data) setThresholds(data.spendingAlerts.thresholds.join(", ")); }, [data]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const values = thresholds.split(",").map(value => Number(value.trim()));
    if (!values.length || values.length > 5 || values.some(value => !Number.isInteger(value) || value < 1 || value > 100) || new Set(values).size !== values.length) { setFailure("Enter up to five different percentages between 1 and 100, separated by commas."); return; }
    setBusy(true); setFailure(""); setSuccess("");
    try { await api.request("/api/customer/benefits/spending-alerts", { method: "PATCH", body: JSON.stringify({ enabled: true, thresholds: values }) }); setSuccess("Spending alerts saved."); reload(); }
    catch (failure) { setFailure(failure instanceof Error ? failure.message : "Could not save spending alerts."); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setFailure(""); setSuccess("");
    try { await api.request("/api/customer/benefits/spending-alerts", { method: "PATCH", body: JSON.stringify({ enabled: false }) }); setSuccess("Spending alerts turned off."); reload(); }
    catch (failure) { setFailure(failure instanceof Error ? failure.message : "Could not turn off spending alerts."); }
    finally { setBusy(false); }
  }
  return <section id="spending-alerts" className={embedded ? "mt-7 border-b border-obligon-border pb-6" : sectionClass} aria-label="Spending alerts">
    {status === "loading" ? <StatusPopup tone="loading" message="Loading spending alerts…" /> : null}{busy ? <StatusPopup tone="pending" message="Saving spending alerts…" /> : null}{failure || error ? <StatusPopup tone="error" message={failure || error?.message} onRetry={error ? reload : undefined} /> : null}{success ? <StatusPopup tone="success" message={success} /> : null}
    <BenefitHeading icon={BellRing} title="Spending alerts">Choose when to hear that your monthly fuel spend has reached a percentage of your budget. Each threshold sends at most one alert per month.</BenefitHeading>
    {data ? <><p className="mt-4 text-sm font-semibold text-obligon-green">{data.spendingAlerts.enabled ? "On" : "Off"} · {data.spendingAlerts.budgetKobo ? `Projected fuel spend ${benefitMoney(data.spendingAlerts.budgetKobo)}` : "Set a fuel budget in My Card to receive threshold alerts."}</p><form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-semibold text-obligon-navy">Budget percentages<input type="text" value={thresholds} onChange={event => setThresholds(event.target.value)} className={inputClass} disabled={busy} /></label><button type="submit" disabled={busy} className={`${buttonClass} min-h-12`}>{data.spendingAlerts.enabled ? "Save alerts" : "Turn on alerts"}</button>{data.spendingAlerts.enabled ? <button type="button" disabled={busy} onClick={() => void disable()} className={buttonClass}>Turn off</button> : null}</form><p className="mt-4 text-xs leading-5 text-obligon-text">Dashboard: {data.spendingAlerts.delivery.inApp.replaceAll("_", " ")}. Email: {data.spendingAlerts.delivery.email.replaceAll("_", " ")}. These follow your notification preferences. SMS and push are not used for budget alerts.</p></> : null}
  </section>;
}

export function CustomerBenefitsOverview() {
  const { data } = useCustomerAccess();
  return <div className="mx-auto w-full max-w-[1440px] min-w-0 px-4 pb-10 sm:px-8 lg:px-12">
    {customerFeatureAvailable(data, "Fuel Consumption Analytics") ? <CustomerPurchaseAnalytics /> : null}
    <CustomerRewards />
  </div>;
}

export function CustomerGeneratorRepairs() {
  const { data, status, error, reload } = useAsync(() => api.request<{ repairs: Repair[] }>("/api/customer/generator-repairs"));
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false), [failure, setFailure] = React.useState(""), [success, setSuccess] = React.useState("");
  const requestIntent = React.useRef<{ description: string; key: string } | undefined>(undefined);
  const acceptIntents = React.useRef(new Map<string, string>());
  const [confirmRepair, setConfirmRepair] = React.useState<Repair | null>(null);
  async function request(event: React.FormEvent) {
    event.preventDefault();
    const message = description.trim();
    if (message.length < 10) { setFailure("Describe the generator issue in at least 10 characters."); return; }
    if (!requestIntent.current || requestIntent.current.description !== message) requestIntent.current = { description: message, key: crypto.randomUUID() };
    await mutate("", { description: message, idempotencyKey: requestIntent.current.key }, "Repair request sent for review.");
  }
  async function mutate(path: string, body: object, message: string) {
    setBusy(true); setFailure(""); setSuccess("");
    try { await api.request(`/api/customer/generator-repairs${path}`, { method: "POST", body: JSON.stringify(body) }); setSuccess(message); if (!path) { setDescription(""); requestIntent.current = undefined; } reload(); }
    catch (failure) { setFailure(failure instanceof Error ? failure.message : "Your repair request could not be updated."); }
    finally { setBusy(false); }
  }
  return <section id="generator-repairs" className={sectionClass} aria-label="Generator repair benefit">
    {status === "loading" ? <StatusPopup tone="loading" message="Loading generator repairs…" /> : null}{busy ? <StatusPopup tone="pending" message="Updating your generator repair…" /> : null}{failure || error ? <StatusPopup tone="error" message={failure || error?.message} onRetry={error ? reload : undefined} /> : null}{success ? <StatusPopup tone="success" message={success} /> : null}
    <BenefitHeading icon={Wrench} title="Generator repairs">Obligon covers 30% of labour on Bronze, 60% on Gold and 100% on Platinum. Parts are charged in full. An itemized quote and reserved programme funding are required before you pay.</BenefitHeading>
    <form onSubmit={request} className="mt-5"><label className="text-sm font-semibold text-obligon-navy">What needs repairing?<textarea required minLength={10} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} disabled={busy} className={`${inputClass} min-h-28 py-3`} /></label><button type="submit" disabled={busy} className={`${buttonClass} mt-4`}>Request a repair quote</button></form>
    {data?.repairs.length ? <ul className="mt-6 divide-y divide-obligon-border">{data.repairs.map(repair => <li key={repair.id} className="py-6"><div className="flex flex-wrap justify-between gap-3"><h3 className="text-sm font-bold text-obligon-navy">{repair.reference}</h3><span className="text-xs font-bold capitalize text-obligon-green">{repair.status.replaceAll("_", " ")}</span></div><p className="mt-3 text-sm leading-6 text-obligon-text">{repair.description}</p>{repair.quote ? <><p className="mt-3 text-sm font-semibold text-obligon-navy">{repair.quote.partnerName} · Quote {repair.quote.version}</p><p className="mt-2 text-sm leading-6 text-obligon-text">{repair.quote.scope}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><dt className="text-obligon-text">Labour</dt><dd className="text-right font-bold text-obligon-navy">{benefitMoney(repair.quote.labourKobo)}</dd><dt className="text-obligon-text">Parts</dt><dd className="text-right font-bold text-obligon-navy">{benefitMoney(repair.quote.partsKobo)}</dd><dt className="text-obligon-text">Obligon covers ({repair.labourDiscountPercent}% labour)</dt><dd className="text-right font-bold text-obligon-green">{benefitMoney(repair.quote.subsidyKobo)}</dd><dt className="font-bold text-obligon-navy">You pay</dt><dd className="text-right font-bold text-obligon-navy">{benefitMoney(repair.quote.customerPayableKobo)}</dd></dl>{repair.status === "awaiting_funding" ? <p className="mt-4 text-sm leading-6 text-obligon-text">The quote is awaiting Obligon funding. Payment is not available yet.</p> : null}{repair.status === "quoted" ? <button type="button" disabled={busy} className={`${buttonClass} mt-4`} onClick={() => {
      const quote = repair.quote!;
      const key = `${repair.id}:${quote.version}`;
      if (!acceptIntents.current.has(key)) acceptIntents.current.set(key, crypto.randomUUID());
      setConfirmRepair(repair);
    }}>{repair.quote.customerPayableKobo === 0 ? "Accept quote" : `Accept quote and pay ${benefitMoney(repair.quote.customerPayableKobo)}`}</button> : null}</> : null}{repair.receipt ? <p className="mt-4 break-words text-xs leading-5 text-obligon-text">Receipt {repair.receipt.reference} · {repair.receipt.paymentState.replaceAll("_", " ")}. {repair.receipt.paymentState === "partner_payable" ? "The repair is completed. Payment is due to the repair partner; this does not confirm an external payout." : ""}</p> : null}{["requested", "quoted", "awaiting_funding", "accepted"].includes(repair.status) ? <button type="button" disabled={busy} className={`${buttonClass} mt-4`} onClick={() => void mutate(`/${repair.id}/cancel`, { reason: "Customer cancelled before work started." }, "Repair cancelled. Any held wallet payment has been returned.")}>Cancel request</button> : null}</li>)}</ul> : status === "success" && !error ? <p className="mt-5 text-sm text-obligon-text">Your repair requests and quotes will appear here.</p> : null}
    {confirmRepair?.quote ? <ConfirmModal open title="Accept generator repair quote" message={confirmRepair.quote.customerPayableKobo === 0 ? `Accept quote ${confirmRepair.quote.version}? Obligon covers the labour. No wallet payment is due.` : `Pay ${benefitMoney(confirmRepair.quote.customerPayableKobo)} from your fuel wallet for quote ${confirmRepair.quote.version}? Funds are held until the service is completed.`} confirmLabel={confirmRepair.quote.customerPayableKobo === 0 ? "Accept quote" : "Accept and pay"} onClose={() => setConfirmRepair(null)} onConfirm={() => {
      const quote = confirmRepair.quote!;
      void mutate(`/${confirmRepair.id}/accept`, { quoteVersion: quote.version, idempotencyKey: acceptIntents.current.get(`${confirmRepair.id}:${quote.version}`) }, "Payment status updated. Review your repair receipt.");
    }} /> : null}
  </section>;
}
