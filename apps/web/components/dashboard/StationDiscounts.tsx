"use client";

import { StatusPopup } from "@/components/shared/StatusPopup";
import * as React from "react";
import { priceSellingUnit } from "@/lib/partner-selling-unit";
import { authenticatedRequest } from "@/lib/services";
import { DateTimeField } from "@/components/shared/Calendar/DateField";

interface Pricing {
  stations: Array<{ id: string; name: string }>;
  prices: Array<{ stationId: string; fuelType: string; price: number; sellingUnit?: "litre" | "kg" | "scm" }>;
  discounts: Array<{ id: string; station_id: string; fuel_type: string; rate_bp: number; starts_at: string; ends_at: string; effective_ends_at?: string | null; status: string; review_reason: string | null }>;
}

const fieldClass = "mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-obligon-border bg-white px-3 py-3 text-sm font-normal text-obligon-navy disabled:opacity-60";

function discountStatus(discount: Pricing["discounts"][number], now: number) {
  if (discount.status === "rejected") return "Rejected";
  if (discount.status === "superseded") return "Superseded";
  if (new Date(discount.effective_ends_at ?? discount.ends_at).getTime() <= now || discount.status === "expired") return "Expired";
  if (discount.status === "approved") return new Date(discount.starts_at).getTime() > now ? "Scheduled" : "Active";
  return discount.status === "pending" ? "Awaiting review" : discount.status.replaceAll("_", " ");
}

export function StationDiscounts({ canManage = false }: { canManage?: boolean }) {
  const [starts, setStarts] = React.useState("");
  const [ends, setEnds] = React.useState("");
  const [data, setData] = React.useState<Pricing | null>(null);
  const [station, setStation] = React.useState("");
  const [fuel, setFuel] = React.useState("");
  const [error, setError] = React.useState("");
  const [loadError, setLoadError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await authenticatedRequest<Pricing>("/api/partner/pricing");
      setData(result);
      setNow(Date.now());
      setStation(current => current || result.stations[0]?.id || "");
      setLoadError("");
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Station discounts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const prices = data?.prices.filter(price => price.stationId === station) ?? [];
  const selectedPrice = prices.find(price => price.fuelType === (fuel || prices[0]?.fuelType));
  const sellingUnit = selectedPrice ? priceSellingUnit(selectedPrice.fuelType, selectedPrice.sellingUnit) : undefined;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !sellingUnit || busy || loading || loadError) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await authenticatedRequest("/api/partner/discounts", {
        method: "POST",
        body: JSON.stringify({
          stationId: station,
          fuelType: fuel || prices[0]?.fuelType,
          sellingUnit,
          discountPercent: Number(form.get("rate")),
          startsAt: new Date(String(form.get("starts"))).toISOString(),
          endsAt: new Date(String(form.get("ends"))).toISOString()
        })
      });
      setNotice("Discount request submitted for admin review.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your discount request could not be submitted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-8 min-w-0 rounded-2xl border border-obligon-border bg-white p-5 sm:p-6">
      {(busy) ? <StatusPopup tone="pending" message="Submitting discount request…" /> : null}
    <h2 className="font-display text-xl font-bold tracking-tight text-obligon-navy">Scheduled station discounts</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-obligon-text">Admin approval is required before a discount applies. Adjust or extend a discount by submitting a new date range. Customers receive a price reduction; the same discount amount is paid to Obligon from your revenue.</p>
    {error ? <StatusPopup tone="error" message={error} /> : null}
    {notice ? <StatusPopup tone="info" message={notice} /> : null}
    {loading ? <StatusPopup tone="loading" message="Loading station prices and discounts…" /> : null}
    {loadError ? <StatusPopup tone="error" message={[loadError, data ? " Showing the last loaded discounts." : ""].join(" ").trim()} action={<button type="button" disabled={loading || busy} onClick={() => void load()} className="mt-2 min-h-11 rounded-lg px-2 font-semibold underline disabled:opacity-60">Retry loading discounts</button>} /> : null}
    {data ? <>
    {!canManage ? <p className="mt-5 text-sm text-obligon-text">You can view discounts. An owner, administrator or manager can request changes.</p> : null}
      {!data.stations.length ? <p className="mt-5 rounded-xl bg-obligon-mist/60 p-4 text-sm text-obligon-text">Add a station in Station Profile before requesting a discount.</p> : <form onSubmit={submit} className="mt-6">
        <fieldset disabled={!canManage || busy || loading || Boolean(loadError)} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <legend className="sr-only">Request a station discount</legend>
          <label className="min-w-0 text-sm font-semibold text-obligon-navy">Station
            <select className={fieldClass} value={station} onChange={event => { setStation(event.target.value); setFuel(""); }} required>{data.stations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
          <label className="min-w-0 text-sm font-semibold text-obligon-navy">Fuel
            <select className={fieldClass} value={fuel || prices[0]?.fuelType || ""} onChange={event => setFuel(event.target.value)} required>{!prices.length ? <option value="">No published fuels</option> : null}{prices.map(price => <option key={price.fuelType}>{price.fuelType}</option>)}</select>
          </label>
          {!prices.length && !loading && !loadError ? <p className="text-sm leading-6 text-obligon-text sm:col-span-2">Publish an approved fuel price for this station before requesting a discount.</p> : null}
          <label className="min-w-0 text-sm font-semibold text-obligon-navy">Discount (%)<input className={fieldClass} name="rate" type="number" min="0.01" max="49.99" step="0.01" required /></label>
          <DateTimeField label="Starts (local time)" name="starts" value={starts} onChange={setStarts} required disabled={!canManage || busy || loading || Boolean(loadError)} />
          <DateTimeField label="Ends (local time)" name="ends" value={ends} onChange={setEnds} required disabled={!canManage || busy || loading || Boolean(loadError)} />
          <button type="submit" className="min-h-12 self-end rounded-xl bg-obligon-green px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-obligon-green/90 disabled:opacity-60" disabled={!canManage || busy || loading || Boolean(loadError) || !prices.length || !sellingUnit}>{busy ? "Submitting request…" : "Request admin approval"}</button>
        </fieldset>
      </form>}
      <div className="mt-8 border-t border-obligon-border pt-6">
        <h3 className="text-sm font-semibold text-obligon-navy">Discount requests</h3>
        {data.discounts.length ? <div tabIndex={0} role="region" aria-label="Station discount requests table, scroll horizontally to see all columns" className="mt-3 overflow-x-auto overscroll-x-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-obligon-green">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-obligon-mist/60 text-xs text-obligon-text"><tr>{["Station / fuel", "Discount", "Date range", "Review"].map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-obligon-border">{data.discounts.map(discount => <tr key={discount.id}>
              <td className="px-4 py-4 font-medium text-obligon-navy">{data.stations.find(item => item.id === discount.station_id)?.name || "Recorded station"} / {discount.fuel_type}</td>
              <td className="px-4 py-4 tabular-nums">{discount.rate_bp / 100}%</td>
              <td className="px-4 py-4 text-obligon-text"><span className="block">{new Date(discount.starts_at).toLocaleString()} to {new Date(discount.effective_ends_at ?? discount.ends_at).toLocaleString()}</span>{discount.effective_ends_at ? <span className="mt-1 block text-xs leading-5">Requested end: {new Date(discount.ends_at).toLocaleString()}. Shortened by an approved replacement.</span> : null}</td>
              <td className="px-4 py-4"><span className="font-semibold text-obligon-navy">{discountStatus(discount, now)}</span>{discount.review_reason ? <p className="mt-1 max-w-xs text-xs leading-5 text-obligon-text">{discount.review_reason}</p> : null}</td>
            </tr>)}</tbody>
          </table>
        </div> : !loading && !loadError ? <p className="mt-3 rounded-xl bg-obligon-mist/60 p-4 text-sm text-obligon-text">No discount requests yet. Submitted requests and admin decisions will appear here.</p> : null}
      </div>
    </> : null}
  </section>;
}
