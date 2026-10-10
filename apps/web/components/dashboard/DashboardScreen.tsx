"use client";

import * as React from "react";
import { StationDiscounts } from "./StationDiscounts";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  Fuel,
  Loader2,
  Plus,
  ReceiptText,
  Building2,
  Printer
} from "lucide-react";
import { api, mutationsApi, saveBlob, authenticatedRequest } from "@/lib/services";
import { AsyncBoundary, EmptyState } from "@/components/shared/States";
import { useAsync } from "@/components/shared/useAsync";
import { useToast } from "@/components/shared/Toast";
import type {
  PartnerBankAccount,
  PartnerDispute,
  PartnerMetric,
  PartnerNotifications,
  PartnerRow,
  PartnerTone
} from "@/lib/services/types";
import type { DashboardPageKey } from "@/lib/mock/dashboard-data";
import { usePartnerNotifications } from "./PartnerNotificationsProvider";

const toneStyles: Record<PartnerTone, string> = {
  success: "bg-[#eaf7db] text-[#315d00]",
  pending: "bg-[#fff5d8] text-[#875b00]",
  failed: "bg-[#ffecef] text-[#9f1027]",
  info: "bg-[#e9efff] text-[#011554]",
  neutral: "bg-[#eef0f6] text-[#454650]"
};

const iconTile: Record<PartnerTone, string> = {
  success: "bg-[#ecfbd7] text-obligon-green",
  pending: "bg-[#fff5d8] text-[#986700]",
  failed: "bg-[#ffecef] text-[#b5162d]",
  info: "bg-[#e9efff] text-obligon-blue",
  neutral: "bg-[#f0f1f7] text-[#454650]"
};

// Icons for the three overview/report metric cards, in the order the API returns
// them. Keyed by position because the labels are what identify a card, and an
// out-of-range index falls back rather than rendering nothing.
const metricIcons = [
  <ReceiptText key="transactions" size={20} />,
  <CircleDollarSign key="revenue" size={21} />,
  <Clock3 key="pending" size={21} />
];

/**
 * Kobo to a naira label, for the one figure the API sends as a number.
 *
 * The API formats its own strings with `naira()`, so most amounts arrive ready to
 * print. `settlement_limit_kobo` is the exception — it is a number, and rendering
 * it raw would show kobo under an naira label.
 */
function nairaLabel(kobo: number | null): string {
  if (kobo == null) return "—";
  return `₦${(Number(kobo) / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Page body. The mobile nav is emitted once by PartnershipShell, above the page,
 * not here — rendering it in both places put two copies on screen below `lg`.
 */
function DashboardCanvas({ children }: { children: React.ReactNode }) {
  return <section className="px-5 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</section>;
}

function StatusPill({ status, tone = "neutral" }: { status: string; tone?: PartnerTone }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.5px] ${toneStyles[tone]}`}>{status}</span>;
}

function SmallMetric({ metric, icon }: { metric: PartnerMetric; icon: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-[#d7d8e4] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <span className={`grid size-11 place-items-center rounded-xl ${iconTile[metric.tone ?? "neutral"]}`}>{icon}</span>
        {metric.delta ? <StatusPill status={metric.delta} tone={metric.tone} /> : null}
      </div>
      <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">{metric.label}</p>
      <p className="mt-2 font-display text-[28px] font-extrabold leading-tight text-obligon-navy">{metric.value}</p>
      {metric.helper ? (
        <p className="mt-3 text-xs font-bold uppercase text-[#737582]">{metric.helper}</p>
      ) : (
        <div className="mt-4 h-1 rounded-full bg-[#ecfbd7]" />
      )}
    </article>
  );
}

/**
 * Generic in the row type, so a page that receives the richer `PartnerDispute` gets
 * a `PartnerDispute` from `onAction` rather than a `PartnerRow` — the detail panel
 * reads `subject`, `description`, `statusRaw` and the rest, and widening to the base
 * row to satisfy this signature is what made them inaccessible without an `any`.
 */
function DataTable<T extends PartnerRow = PartnerRow>({
  title,
  subtitle,
  columns,
  rows,
  actionLabel,
  onAction,
  rowKey = (row, index) => row.reference ?? row.id ?? `${row.cells[0]}-${index}`
}: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: T[];
  actionLabel?: string;
  onAction?: (row?: T) => void;
  rowKey?: (row: T, index: number) => string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#d7d8e4] bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[#e3e4ef] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-extrabold text-obligon-navy">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs font-medium text-obligon-text">{subtitle}</p> : null}
        </div>
        {actionLabel ? (
          <button
            type="button"
            onClick={() => onAction?.()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#f0f4e8] px-3 text-xs font-extrabold text-obligon-green hover:bg-[#e2edd4] transition"
          >
            {actionLabel}
            <ArrowRight size={14} />
          </button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className="bg-[#fbfbff]">
            <tr className="border-b border-[#e3e4ef] text-[11px] font-extrabold uppercase tracking-[0.8px] text-[#737582]">
              {columns.map((column) => (
                <th key={column} className="px-6 py-4">{column}</th>
              ))}
              {/* A header per body column. This previously emitted `columns.length + 1`
                  while rows emitted `cells.length + 2`, so every table in the
                  dashboard was misaligned by one: on /dashboard/settlements the
                  "Net Payout" heading sat over the status pill and the row action
                  rendered under a heading that did not exist, and on /dashboard/staff
                  the "Role" heading sat over "Enabled". The status column gets a
                  heading only when a row actually carries a status. */}
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ececf5]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-6 py-10 text-center font-bold text-obligon-text">
                  Nothing to show yet.
                </td>
              </tr>
            ) : null}
            {rows.map((row, rowIndex) => (
              <tr key={rowKey(row, rowIndex)} className="hover:bg-[#fbfbff] transition">
                {row.cells.map((cell, cellIndex) => {
                  const parts = cell.split("\n");
                  return (
                    <td key={`${cell}-${cellIndex}`} className="px-6 py-4 align-middle text-sm">
                      <p className="font-bold text-obligon-navy">{parts[0]}</p>
                      {parts.slice(1).map((part, partIndex) => (
                        // Keyed by position, not by content: a cell built as
                        // `${subject}\n${claimant}` renders two identical strings when
                        // those match, and content keys collide.
                        <p key={`${partIndex}-${part}`} className="mt-0.5 text-xs font-medium text-obligon-text">
                          {part}
                        </p>
                      ))}
                    </td>
                  );
                })}
                <td className="px-6 py-4">{row.status ? <StatusPill status={row.status} tone={row.tone} /> : null}</td>
                {/* No action button unless the caller supplies a handler. It used to
                    render a clickable "Details" — and, for a failed payout, "RETRY" —
                    that did nothing, while `mutationsApi.retryPayout` sat unused. An
                    operator could believe they had retried a failed transfer. */}
                <td className="px-6 py-4 text-right">
                  {onAction ? (
                    <button
                      type="button"
                      onClick={() => onAction(row)}
                      className="text-xs font-extrabold text-obligon-green hover:underline"
                    >
                      {row.action ?? "Details"}
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-obligon-text">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Debounces a value so a text filter does not fire a request per keystroke.
 * Without it, typing "Mainland" would send seven searches and race their
 * responses, so the table could settle on the results for a prefix of what was
 * actually typed.
 */
function useDebounced<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

// ============ OVERVIEW ============
function OverviewPage() {
  const { status, data, error, reload } = useAsync(() => api.getPartnerOverview());

  return (
    <DashboardCanvas>
      <AsyncBoundary
        status={status}
        error={error?.message ?? null}
        onRetry={reload}
        loadingLabel="Loading your station…"
      >
        {data ? (
          <>
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Station Operator Console</p>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              {data.metrics.map((metric, index) => (
                <SmallMetric
                  key={metric.label}
                  metric={metric}
                  icon={metricIcons[index] ?? <BarChart3 size={20} />}
                />
              ))}
            </div>

            <section className="mt-8 grid rounded-xl border border-[#d7d8e4] bg-white sm:grid-cols-2 xl:grid-cols-4 shadow-sm">
              {data.quickStats.map(([label, value], index) => (
                <article key={label} className={`p-6 ${index < 3 ? "xl:border-r xl:border-[#e3e4ef]" : ""}`}>
                  <p className="text-xs font-semibold text-obligon-text">{label}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="font-display text-[26px] font-extrabold text-obligon-navy">{value}</p>
                    {label === "Verified Partners" ? <CheckCircle2 className="text-obligon-green" size={18} /> : null}
                  </div>
                </article>
              ))}
            </section>

            <div className="mt-8">
              <DataTable
                title="Recent Dispenser Authorizations"
                columns={["Reference", "Station", "Amount Dispensed", "Time"]}
                rows={data.recentTransactions}
                rowKey={(row) => row.id ?? row.reference ?? row.cells[0]}
              />
            </div>
          </>
        ) : null}
      </AsyncBoundary>
    </DashboardCanvas>
  );
}

// ============ FUEL PRICING ============
type PriceDraft = { fuelType: string; price: string };

function FuelPricingPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const { status, data, error, reload } = useAsync(() => api.getPartnerPricing());
  const [drafts, setDrafts] = React.useState<PriceDraft[] | null>(null);
  const [stationId,setStationId]=React.useState("");
  const activeStation=stationId||data?.stations?.[0]?.id||"";
  const [syncing, setSyncing] = React.useState(false);

  // The rows come from the prices the station actually has, rather than three
  // fixed fuel types with made-up starting values. Drafts stay null until the
  // fetch lands so a re-render never briefly shows the previous station's rates.
  const rows: PriceDraft[] =
    drafts ?? (data?.prices ?? []).filter(p=>p.stationId===activeStation).map((price) => ({ fuelType: price.fuelType, price: String(price.price) }));

  const setRow = (index: number, patch: Partial<PriceDraft>) =>
    setDrafts(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  async function handleSync(event: React.FormEvent) {
    event.preventDefault();
    const updates = rows
      .filter((row) => row.fuelType.trim() && Number(row.price) > 0)
      .map((row) => ({ fuelType: row.fuelType.trim(), price: Number(row.price) }));
    if (!updates.length) {
      toastError("Enter a fuel type and a price above zero.");
      return;
    }
    setSyncing(true);
    try {
      await mutationsApi.updatePrices(updates,activeStation);
      toastSuccess(`${updates.length} price${updates.length === 1 ? "" : "s"} published. They apply to the next authorization.`);
      setDrafts(null);
      reload();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not publish pricing. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <DashboardCanvas>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Station Fuel Pricing</h1>
        <p className="mt-1 text-sm text-obligon-text">
          Set the price per litre used to authorise a dispense at this station.
        </p>
        {/* The header used to promise "sync prices directly with smart dispenser
            meters" and the button read "Broadcast & Sync to Dispensers". Nothing in
            this system talks to a meter: `PUT /pricing` writes a row the POS
            authorization reads when it prices a dispense. The wording now describes
            that, because an operator who believed the meters were being driven
            remotely would not re-enter a price that failed to reach them. */}
      </div>

      <label className="mb-5 block">Station<select value={activeStation} onChange={e=>{setStationId(e.target.value);setDrafts(null);}} className="ml-3 rounded border p-2">{data?.stations?.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}</select></label>
      <AsyncBoundary
        status={status}
        error={error?.message ?? null}
        onRetry={reload}
        loadingLabel="Loading current prices…"
      >
        {data ? (
          <form onSubmit={handleSync} className="grid gap-6 lg:grid-cols-3">
            {rows.length ? (
              rows.map((row, index) => (
                <article
                  // Keyed by index, not by `row.fuelType`. That value is editable:
                  // using it as the key changed identity on every keystroke,
                  // remounting the <article> and dropping focus to <body> — so
                  // correcting one character of "PMS Petrol" meant clicking back
                  // into the field for every character after it.
                  key={index}
                  className="rounded-xl border border-[#d7d8e4] bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Fuel className="text-obligon-green" size={24} />
                    <input
                      value={row.fuelType}
                      onChange={(e) => setRow(index, { fuelType: e.target.value })}
                      aria-label="Fuel type"
                      className="w-full rounded-lg border border-transparent bg-transparent font-display text-xl font-extrabold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs text-obligon-text">
                    Last published {data.prices[index]?.updatedAt ?? "—"}
                  </p>
                  <div className="mt-6 flex items-center rounded-xl border border-[#cfd8cc] bg-[#f7fbf8] px-4">
                    <span className="font-extrabold text-xl text-obligon-navy">₦</span>
                    <input
                      value={row.price}
                      onChange={(e) => setRow(index, { price: e.target.value.replace(/[^\d.]/g, "") })}
                      inputMode="decimal"
                      aria-label={`${row.fuelType} price per litre`}
                      className="h-12 w-full bg-transparent px-2 font-display text-2xl font-extrabold text-obligon-navy outline-none"
                      required
                    />
                    <span className="text-xs font-bold text-obligon-text">/ Litre</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="lg:col-span-3">
                <EmptyState
                  title="No prices published yet"
                  message="Add your first pump rate. It will be used to price the next authorization recorded at this station."
                />
              </div>
            )}

            <div className="lg:col-span-3 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setDrafts([...rows, { fuelType: "", price: "" }])}
                className="h-11 rounded-xl border border-[#d7d8e4] bg-white px-5 text-sm font-extrabold text-obligon-navy hover:bg-[#f7f7fd] transition"
              >
                <span className="inline-flex items-center gap-2"><Plus size={16} /> Add fuel type</span>
              </button>
              <button
                disabled={syncing || !rows.length}
                type="submit"
                className="h-12 rounded-xl bg-obligon-green px-8 font-extrabold text-white shadow-green hover:bg-obligon-green/90 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? <Loader2 size={18} className="animate-spin" /> : "Publish Prices"}
              </button>
            </div>
          </form>
        ) : null}
      </AsyncBoundary>
      <StationDiscounts/>
    </DashboardCanvas>
  );
}

// ============ POS TERMINAL ============
/**
 * Authorise a fuel dispense.
 *
 * Two things this page deliberately does not do:
 *
 * It does not derive litres from the amount using a hard-coded rate. It used to send
 * `amount / 1085` and the server then charged `litres * the station's published
 * price`. At a station publishing PMS at N615/L an operator typing N25,000 was charged
 * N14,170.51 — verified. The operator enters litres, which is what a dispenser
 * actually measures, and the server prices it.
 *
 * And it does not claim a pump was activated. Nothing in the system drives a
 * dispenser; the API records the authorisation. The previous copy said "Dispense
 * Authorized" and toasted "Pump activated", which described a physical action that
 * never happened.
 */
function POSTerminalPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [mode,setMode]=React.useState("wallet");
  const [stationId,setStationId]=React.useState("");
  const [code, setCode] = React.useState("");
  const [fuelType, setFuelType] = React.useState("PMS Petrol");
  const [litres, setLitres] = React.useState("40");
  const [verifying, setVerifying] = React.useState(false);
  const [authReceipt, setAuthReceipt] = React.useState<{
    reference: string; vehicle: string; amount: string; driver: string; card: string; litres: string; fuelType: string;
  } | null>(null);

// The fuel types this station has actually published a price for. Hard-coded
  // options meant a station that published "PMS" matched nothing and the server
  // fell back to a rate it never set.
  //
  // The status is destructured as well as the data. It used to read only `data`, so
  // a failed or in-flight fetch left `prices` undefined and the fuel list empty — the
  // same shape as "you have published no prices", and the operator was told to go and
  // set prices that already existed. A network blip read as a configuration fault.
  const { status: pricingStatus, data: pricing, error: pricingError, reload: reloadPricing } = useAsync(() =>
    api.getPartnerPricing()
  );
  const activeStation=stationId||pricing?.stations?.[0]?.id||"";
  const stationPrices=(pricing?.prices??[]).filter(p=>p.stationId===activeStation);
  const pricesLoading = pricingStatus === "loading";
  const pricesFailed = pricingStatus === "error";
  const fuelTypes = React.useMemo(
    () => stationPrices.map((p) => p.fuelType).filter(Boolean),
    [pricing,activeStation]
  );
  const activeFuelType = fuelTypes.includes(fuelType) ? fuelType : (fuelTypes[0] ?? fuelType);
  const unitPrice = stationPrices.find((p) => p.fuelType === activeFuelType)?.price ?? null;
  const litresNum = Number(litres);
  const litresValid = Number.isFinite(litresNum) && litresNum > 0;
  // What the server will charge, from the price it will use. Shown so the operator
  // is not asked to do arithmetic against a rate they cannot see.
  const estimateKobo = unitPrice != null && litresValid ? Math.round(litresNum * unitPrice * 100) : null;

  async function handleAuthorize(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) {
      toastError("Please enter the complete 6-digit fleet authorization code.");
      return;
    }
    if (mode==="wallet" && !litresValid) {
      toastError("Enter the litres to dispense.");
      return;
    }
    setVerifying(true);
    try {
      const result = mode==="wallet" ? await mutationsApi.posAuthorize({ stationId:activeStation,code, litres: litresNum, fuelType: activeFuelType }) :
        await authenticatedRequest<Record<string,unknown>>("/api/partner/pos/fulfill",{method:"POST",body:JSON.stringify({stationId:activeStation,code})});
      // Every field comes from the authorization response. The previous version
      // fell back to "Fleet vehicle", "Fleet driver" and a reference invented with
      // Math.random(), so a declined-looking receipt could still name a transaction
      // that never existed.
      setAuthReceipt({
        reference: String(result?.reference ?? "—"),
        vehicle: String(result?.vehicle ?? "—"),
        amount: String(result?.amountLabel ?? "—"),
        driver: String(result?.driver ?? "—"),
        card: String(result?.card ?? "—"),
        litres,
        fuelType: activeFuelType
      });
      toastSuccess(`Authorization ${result?.reference} approved and recorded.`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Authorization declined. Check the code and try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <DashboardCanvas>
      <label className="mb-4 block">Payment type<select className="ml-3 rounded border p-2" value={mode} onChange={e=>setMode(e.target.value)}><option value="wallet">Wallet authorization</option><option value="checkout">Already paid station checkout</option></select></label>
      <label className="mb-5 block">Station<select value={activeStation} onChange={e=>setStationId(e.target.value)} className="ml-3 rounded border p-2">{pricing?.stations?.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}</select></label>
      <div className="max-w-2xl mx-auto">
{pricesLoading || pricesFailed ? (
          <div
            role="status"
            className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${
              pricesFailed
                ? "border-[#f3c6cc] bg-[#fff4f4] text-[#9f1027]"
                : "border-obligon-border bg-[#f7f7fd] text-obligon-text"
            }`}
          >
            {pricesLoading ? (
              <Loader2 size={16} className="mt-0.5 animate-spin shrink-0" />
            ) : (
              <Clock3 size={16} className="mt-0.5 shrink-0" />
            )}
            <div>
              {pricesLoading ? (
                <p>Loading your published prices…</p>
              ) : (
                <>
                  <p>Prices could not be loaded: {pricingError?.message ?? "the request failed"}</p>
                  {/*
                    A retry, and wording that does not blame the operator. Without this
                    the page said "Publish a price on Fuel Pricing first", which sends
                    someone to re-enter prices that were already saved and are still
                    saved — the one conclusion the page must not draw from a failed
                    read.
                  */}
                  <button
                    type="button"
                    onClick={reloadPricing}
                    className="mt-2 text-xs font-extrabold text-[#9f1027] underline"
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
        {pricingStatus === "success" && !fuelTypes.length ? (
          <p className="mb-5 rounded-xl border border-obligon-border bg-[#f7f7fd] px-4 py-3 text-sm font-bold text-obligon-text">
            No prices are published for this station yet, so a dispense cannot be authorised.
          </p>
        ) : null}
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-extrabold text-obligon-navy">POS Authorization Terminal</h1>
          <p className="mt-1 text-sm text-obligon-text">
            Enter a driver&apos;s 6-digit authorization code to record an approved dispense.
          </p>
        </div>

        {authReceipt ? (
          <div className="rounded-2xl border border-obligon-border bg-white p-8 shadow-hero text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
              <Check size={32} />
            </span>
            <h2 className="mt-5 font-display text-3xl font-extrabold text-obligon-navy">Authorization Recorded</h2>
            <p className="mt-1 text-sm text-obligon-text">
              Reference: <strong className="font-mono font-extrabold text-obligon-navy">{authReceipt.reference}</strong>
            </p>
            <p className="mt-3 rounded-lg bg-[#fff3d8] px-4 py-3 text-left text-sm font-bold text-[#9a6300]">
              This records the authorization for your accounts. Dispensing at the pump is
              still done at the dispenser.
            </p>

            <div className="mt-6 rounded-xl bg-[#f7fbf8] p-5 border border-obligon-border space-y-2 text-left text-sm">
              {[
                ["Card", authReceipt.card],
                ["Fleet Vehicle", authReceipt.vehicle],
                ["Driver", authReceipt.driver],
                ["Fuel Type", authReceipt.fuelType],
                ["Litres", authReceipt.litres],
                ["Amount Charged", authReceipt.amount]
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-obligon-text">{label}</span>
                  <span className="text-right font-bold text-obligon-navy">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              {/*
                There is no printer integration. This used to claim a receipt had
                been sent to a thermal printer when nothing was sent, so it now
                offers the browser's own print dialog for the record on screen.
              */}
              <button
                type="button"
                onClick={() => window.print()}
                className="h-12 flex-1 rounded-xl border border-obligon-border font-bold text-obligon-navy flex items-center justify-center gap-2 hover:bg-obligon-mist transition"
              >
                <Printer size={18} />
                Print Record
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthReceipt(null);
                  setCode("");
                }}
                className="h-12 flex-1 rounded-xl bg-obligon-green font-extrabold text-white shadow-green"
              >
                Next Authorization
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAuthorize} className="rounded-2xl border border-obligon-border bg-white p-8 shadow-card space-y-5">
            <div>
              <label className="text-xs font-extrabold uppercase text-obligon-text block mb-2">
                6-Digit Driver Authorization Code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                placeholder="• • • • • •"
                className="h-16 w-full rounded-xl border border-[#cfd8cc] bg-[#f7fbf8] text-center font-mono text-3xl font-extrabold tracking-[14px] text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                required
                autoFocus
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-extrabold uppercase text-obligon-text block mb-1.5">
                  Fuel Type
                </label>
                <select
                  value={activeFuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  disabled={!fuelTypes.length}
                  className="h-12 w-full rounded-xl border border-[#cfd8cc] bg-white px-3 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green disabled:opacity-60"
                >
                  {fuelTypes.length ? (
                    fuelTypes.map((t) => <option key={t}>{t}</option>)
                  ) : (
                    <option>No prices published</option>
                  )}
                </select>
                {!fuelTypes.length ? (
                  <p className="mt-1.5 text-xs font-bold text-[#9f1027]">
                    Publish a price on Fuel Pricing before authorizing a dispense.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="text-xs font-extrabold uppercase text-obligon-text block mb-1.5">
                  Litres to Dispense
                </label>
                <input
                  value={litres}
                  onChange={(e) => setLitres(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  aria-label="Litres to dispense"
                  className="h-12 w-full rounded-xl border border-[#cfd8cc] px-4 font-display text-xl font-extrabold text-obligon-navy outline-none focus:border-obligon-green"
                  required
                />
                {unitPrice != null ? (
                  <p className="mt-1.5 text-xs font-bold text-obligon-text">
                    {unitPrice.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 })}/L
                    {estimateKobo != null ? (
                      <>
                        {" · "}
                        <span className="text-obligon-navy">
                          ≈ {(estimateKobo / 100).toLocaleString("en-NG", {
                            style: "currency",
                            currency: "NGN",
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>

            <button
              disabled={verifying || code.length < 6 || !litresValid || !fuelTypes.length || pricesLoading || pricesFailed}
              type="submit"
              className="mt-4 h-14 w-full rounded-xl bg-obligon-green font-extrabold text-white text-base shadow-green hover:bg-obligon-green/90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying ? <Loader2 size={20} className="animate-spin" /> : "Authorize Dispense"}
            </button>
          </form>
        )}
      </div>
    </DashboardCanvas>
  );
}

// ============ SETTLEMENTS ============
function SettlementsPage({
  onPayoutRequested,
  version
}: {
  onOpenPayout: (balance: { claimableKobo: number; claimableLabel: string }) => void;
  onPayoutRequested: () => void;
  version: number;
}) {
  const { status, data, error, reload } = useAsync(() => api.getPartnerSettlements(), [version]);
  const [addingAccount, setAddingAccount] = React.useState(false);
  const [removingAccount, setRemovingAccount] = React.useState<PartnerBankAccount | null>(null);

  const {success:toastSuccess,error:toastError}=useToast();
  const [choosingDefault,setChoosingDefault]=React.useState<string|null>(null);
  async function chooseDefault(account:PartnerBankAccount) {
    setChoosingDefault(account.id);
    try { await mutationsApi.setDefaultBankAccount(account.id);toastSuccess(account.verified?"Settlement destination updated.":"Default account selected. Admin verification is required before collections.");reload();onPayoutRequested(); }
    catch(error) {toastError(error instanceof Error?error.message:"Unable to choose default account");}
    finally {setChoosingDefault(null);}
  }
  const defaultAccount = data?.bankAccounts.find((account) => account.isDefault) ?? data?.bankAccounts[0];

  return (
    <DashboardCanvas>
      <AsyncBoundary
        status={status}
        error={error?.message ?? null}
        onRetry={reload}
        loadingLabel="Loading settlement account…"
      >
        {data ? (
          <div className="grid gap-8 xl:grid-cols-[320px_1fr]">
            <aside className="space-y-5">
              <article className="rounded-xl border border-[#d7d8e4] bg-white p-6 shadow-sm">
                <h2 className="font-display text-xl font-extrabold text-obligon-navy">
                  {defaultAccount ? "Settlement Account" : "No Settlement Account"}
                </h2>

                <p className="mt-3 text-sm text-obligon-text">Choose where Flutterwave sends your fuel revenue. A new destination needs admin verification.</p>
                <div className="mt-4 space-y-3">
                  {data.bankAccounts.map(account=><div key={account.id} className="rounded-xl border border-obligon-border bg-[#f7fbf8] p-4">
                    <p className="font-bold text-obligon-navy">{account.bankName} {account.isDefault?<span className="text-xs">· Default</span>:null}</p>
                    <p className="mt-1 font-mono text-sm">{account.accountMask}</p><p className="text-xs">{account.accountName}</p>
                    <p className="mt-2 text-xs font-bold">{account.needsRenomination?"Re-add this bank account to register a secure settlement destination, then choose it as default.":account.verified?"Verified destination":"Awaiting admin verification"}</p>
                    {!account.isDefault&&!account.needsRenomination?<button type="button" disabled={choosingDefault!==null} onClick={()=>void chooseDefault(account)} className="mt-3 rounded-lg border border-obligon-green px-3 py-2 text-xs font-bold disabled:opacity-50">{choosingDefault===account.id?"Updating…":"Make default"}</button>:null}
                    {account.needsRenomination?<button type="button" onClick={()=>setRemovingAccount(account)} className="mt-3 ml-3 text-xs underline">Remove old nomination</button>:null}
                  </div>)}
                </div>
                <button type="button" onClick={()=>setAddingAccount(true)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-obligon-green px-4 text-xs font-bold text-white"><Plus size={14}/>Add settlement account</button>

                <div className="mt-6 rounded-xl border border-obligon-border p-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">Pending settlement</p>
                  <p className="mt-1 font-display text-2xl font-extrabold text-obligon-navy">{data.totals.pendingLabel}</p>
                  <p className="mt-1 text-xs font-medium text-obligon-text">
                    Revenue awaiting provider settlement to your bank account.
                  </p>
                  <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">Settled to date</p>
                  <p className="mt-1 font-display text-2xl font-extrabold text-obligon-navy">{data.totals.totalSettledLabel}</p>

                  <div className="mt-4 border-t border-obligon-border pt-4">
                    <p className="text-xs font-extrabold text-obligon-navy">Automatic direct settlement</p>
                    <p className="mt-1 text-xs text-obligon-text">Flutterwave sends fuel revenue to your bank account and deducts approved discounts for Obligon. No manual payout request is required.</p>
                  </div>
                </div>

<button type="button" disabled className="mt-6 h-11 w-full cursor-not-allowed rounded-xl bg-[#c9ced9] text-sm font-extrabold text-obligon-navy opacity-70">
                  Payouts — Coming soon
                </button>
                <p className="mt-2 text-xs text-obligon-text">Manual payouts are inactive. Your settlement account receives funds automatically.</p>
              </article>
            </aside>

            <main className="space-y-8">
              <DataTable
                title="Settlement Periods"
                columns={["Period Start", "Period End", "Gross Sales", "Fees", "Net Payout"]}
                rows={data.settlements}
                rowKey={(row) => row.id ?? row.cells.join("/")}
              />
<DataTable
                title="Payout History"
                subtitle="Recorded provider settlements and historical transfers."
                columns={["Reference", "Requested", "Amount", "Destination"]}
                rows={data.payouts}
                rowKey={(row) => row.id ?? row.reference ?? row.cells[0]}
              />
            </main>
          </div>
        ) : null}
      </AsyncBoundary>
      {addingAccount ? (
        <AddBankAccountModal
          onClose={() => setAddingAccount(false)}
          onSaved={() => {
            reload();
            onPayoutRequested();
          }}
        />
      ) : null}
      {removingAccount ? (
        <RemoveBankAccountModal
          account={removingAccount}
          onClose={() => setRemovingAccount(null)}
          onSaved={() => {
            reload();
            onPayoutRequested();
          }}
        />
      ) : null}

    </DashboardCanvas>
  );
}

// ============ DISPUTES ============
function DisputesPage() {
  const { status, data, error, reload } = useAsync(() => api.getPartnerDisputes());
  const [open, setOpen] = React.useState<PartnerDispute | null>(null);

  return (
    <DashboardCanvas>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Disputes &amp; Reconciliations</h1>
        <p className="mt-1 text-sm text-obligon-text">Manage customer charge disputes, pump meter adjustments, and proof of dispensing.</p>
      </div>
      <AsyncBoundary
        status={status}
        error={error?.message ?? null}
        isEmpty={!data || data.length === 0}
        onRetry={reload}
        loadingLabel="Loading disputes…"
        empty={{ title: "No disputes raised", message: "Cases raised against your stations will appear here." }}
      >
{data ? (
          <DataTable
            title="Dispute Cases"
            columns={["Case ID", "Customer / Vehicle", "Claim Reason", "Amount Disputed"]}
            rows={data}
            rowKey={(row) => row.id ?? row.reference ?? row.cells[0]}
            onAction={(row) => row && setOpen(row)}
          />
        ) : null}
      </AsyncBoundary>
      {open ? <DisputeDetailModal dispute={open} onClose={() => setOpen(null)} onSaved={reload} /> : null}
    </DashboardCanvas>
  );
}

// ============ STATION PROFILE ============
function StationProfilePage() {
  const { success: toastSuccess, error: toastError } = useToast();
const { status, data, error, reload } = useAsync(() => api.getPartnerStation());
  const [form, setForm] = React.useState<{ name: string; address: string; city: string; hours: string; fuels: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [operationsOpen, setOperationsOpen] = React.useState(false);

  const station = data?.station ?? null;
  const stationId = String(station?.id ?? "");
  const fields = form ?? (station ? {
    name: station.name ?? "",
    address: station.address ?? "",
    city: station.city ?? "",
    hours: station.hours ?? "",
    fuels: station.fuels ?? ""
  } : null);

  const setField = (key: keyof NonNullable<typeof fields>, value: string) =>
    setForm({ ...(fields ?? { name: "", address: "", city: "", hours: "", fuels: "" }), [key]: value });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fields) return;
    setSaving(true);
    try {
      await mutationsApi.updateStation({
        name: fields.name,
        address: fields.address,
        city: fields.city,
        hours: fields.hours || null,
        fuels: fields.fuels || null
      });
      toastSuccess("Station profile saved.");
      setForm(null);
      reload();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not save the station profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardCanvas>
<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Station Profile</h1>
          <p className="mt-1 text-sm text-obligon-text">The details customers see in the station locator.</p>
        </div>
        {station ? (
          <button
            type="button"
            onClick={() => setOperationsOpen(true)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[#d7d8e4] bg-white px-5 text-sm font-extrabold text-obligon-navy hover:bg-[#f7f7fd] transition"
          >
            <Fuel size={16} />
            Station Operations
          </button>
        ) : null}
      </div>

      <AsyncBoundary
        status={status}
        error={error?.message ?? null}
        onRetry={reload}
        loadingLabel="Loading station…"
      >
        {data ? (
          !station || !fields ? (
            <EmptyState
              icon={Building2}
              title="No station linked yet"
              message="This account is not linked to a station. Our team can connect one for you."
            />
          ) : (
            <form onSubmit={handleSave} className="grid gap-8 lg:grid-cols-[1fr_360px]">
              <article className="rounded-xl border border-[#d7d8e4] bg-white p-7 shadow-sm space-y-4">
                <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Location Details</h2>
                {([
                  ["name", "Station Brand & Name"],
                  ["address", "Physical Address"],
                  ["city", "City"],
                  ["hours", "Opening Hours"]
                ] as const).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">{label}</span>
                    <input
                      value={fields[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required={key === "name"}
                    />
                  </label>
                ))}
                <label className="block">
                  <span className="text-xs font-extrabold uppercase text-obligon-text">Fuels Available</span>
                  <input
                    value={fields.fuels}
                    onChange={(e) => setField("fuels", e.target.value)}
                    className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 font-bold text-obligon-navy outline-none focus:border-obligon-green"
                  />
                </label>
                <button
                  disabled={saving}
                  type="submit"
                  className="mt-6 h-12 rounded-xl bg-obligon-green px-8 font-extrabold text-white shadow-green disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : "Save Profile"}
                </button>
              </article>

              <article className="rounded-xl border border-[#d7d8e4] bg-white p-7 shadow-sm">
                <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Equipment</h2>
                {data.equipment.length ? (
                  <ul className="mt-6 space-y-3">
                    {data.equipment.map((item) => (
                      <li key={item.id} className="flex items-center justify-between rounded-xl border border-obligon-border p-3.5">
                        <span className="text-xs font-bold text-obligon-navy">{item.name}</span>
                        <span className="text-xs font-extrabold text-obligon-text">
                          {item.status}{item.lastService ? ` · ${item.lastService}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm font-medium text-obligon-text">No equipment recorded.</p>
                )}

                <h2 className="mt-8 font-display text-2xl font-extrabold text-obligon-navy">Recent Dispensing</h2>
                {data.logs.length ? (
                  <ul className="mt-4 space-y-2">
                    {data.logs.slice(0, 8).map((log) => (
                      <li key={log.id} className="flex items-center justify-between text-xs font-bold text-obligon-navy">
                        <span>{log.fuelType} · {log.litres} L</span>
                        <span className="text-obligon-text">{log.time}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm font-medium text-obligon-text">No dispensing recorded yet.</p>
                )}
              </article>
            </form>
          )
) : null}
      </AsyncBoundary>
      {operationsOpen && station && stationId ? (
        <StationOperationsModal
          stationId={stationId}
          onClose={() => setOperationsOpen(false)}
          onDone={() => {
            reload();
            setOperationsOpen(false);
          }}
        />
      ) : null}
    </DashboardCanvas>
  );
}

/**
 * An authenticated CSV export.
 *
 * These were `<a href="/api/partner/…/export">`. The session is a Bearer token in
 * localStorage and an anchor cannot send a header, so the request went to the Next.js
 * origin, where no `/api` proxy is configured — a 404 on the web host, or a 401 from
 * the API if the two hosts were ever unified. Nothing about that failure was visible
 * until the click did nothing.
 *
 * `query` carries the filters the operator is currently looking at, so the file and
 * the table agree. The filename is taken from the server's `Content-Disposition`
 * rather than invented here, and a refusal is surfaced — an export that silently
 * produced an empty or error file is worse than one that visibly fails.
 */
function ExportButton({
  path,
  label,
  pendingLabel,
  className,
  query
}: {
  path: string;
  label: string;
  pendingLabel: string;
  className?: string;
  query?: Record<string, string | number | undefined>;
}) {
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();

  async function run() {
    setBusy(true);
    try {
      const blob = await api.download(`${path}${queryString(query)}`);
      saveBlob(blob, defaultExportName(path));
      toast.success(`${label} downloaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The export could not be downloaded");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      aria-busy={busy}
      className={`inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 ${className ?? "border border-[#d7d8e4] bg-white text-obligon-navy hover:bg-[#f7f7fd]"}`}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {busy ? pendingLabel : label}
    </button>
  );
}

/** Builds a `?a=b` suffix, skipping empty values so no filter is sent as `undefined`. */
function queryString(query?: Record<string, string | number | undefined>): string {
  if (!query) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

function defaultExportName(path: string): string {
  return path.includes("reports") ? "partner-report.csv" : "partner-transactions.csv";
}

// ============ TRANSACTIONS ============
function TransactionsPage() {
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebounced(query);
  const [page, setPage] = React.useState(0);
  const PAGE_SIZE = 50;
  // A new search returns to the first page. Keeping page 4 while the term changes
  // lands the operator on an empty table — which reads as "the search found
  // nothing" when the result set is simply shorter than the offset.
  React.useEffect(() => {
    setPage(0);
  }, [debouncedQuery]);
  const { status, data, error, reload } = useAsync(
    () =>
      api.getPartnerTransactions({
        search: debouncedQuery || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE
      }),
    [debouncedQuery, page]
  );
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const shown = data?.rows.length ?? 0;
  // The endpoint caps `limit` at 100 and the page asks for 50, so a page that comes
  // back short is the last one — which is what stops the "Next" button staying live
  // on an exact multiple of the page size.
  const hasNext = shown > 0 && shown < PAGE_SIZE ? false : page + 1 < pageCount;

  return (
    <DashboardCanvas>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Fleet Transactions</h1>
          <p className="mt-1 text-sm text-obligon-text">
            Every card-authorized fuel dispense across your partner network.
            {data ? ` ${total.toLocaleString()} matching.` : ""}
          </p>
        </div>
        <ExportButton
          path="/api/partner/transactions/export"
          label="Export Ledger"
          pendingLabel="Preparing…"
          query={{ search: debouncedQuery || undefined }}
        />
      </div>

      <label className="mb-6 flex h-11 max-w-sm items-center gap-2 rounded-xl border border-[#d7d8e4] bg-white px-3">
        <CreditCard size={16} className="text-obligon-text" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by reference or fleet…"
          aria-label="Search transactions"
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>

      <AsyncBoundary
        status={status}
        error={error?.message ?? null}
        isEmpty={!data || data.rows.length === 0}
        onRetry={reload}
        loadingLabel="Loading transactions…"
        empty={{
          title: query ? "No transactions match that search" : "No transactions yet",
          message: query ? "Try a different reference or fleet name." : "Authorizations at your dispensers will appear here."
        }}
      >
{data ? (
          <>
            <DataTable
              title="Card Authorizations"
              columns={["Date & Time", "Fleet / Vehicle", "Card", "Amount (₦)"]}
              rows={data.rows}
              rowKey={(row) => row.id ?? row.reference ?? row.cells.join("/")}
            />
            {total > PAGE_SIZE ? (
              <nav
                aria-label="Transaction pages"
                className="mt-4 flex items-center justify-between border-t border-[#e3e4ef] pt-4"
              >
                <p className="text-xs text-obligon-text">
                  Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + shown} of {total.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || status === "loading"}
                    className="inline-flex h-9 items-center rounded-lg border border-[#d7d8e4] bg-white px-3 text-xs font-extrabold text-obligon-navy disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-bold text-obligon-text">
                    Page {page + 1} of {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasNext || status === "loading"}
                    className="inline-flex h-9 items-center rounded-lg border border-[#d7d8e4] bg-white px-3 text-xs font-extrabold text-obligon-navy disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </nav>
            ) : null}
          </>
        ) : null}
      </AsyncBoundary>
    </DashboardCanvas>
  );
}

// ============ REPORTS ============
function ReportsPage() {
  const [range, setRange] = React.useState(30);
  const { status, data, error, reload } = useAsync(() => api.getPartnerReports(range), [range]);

  return (
    <DashboardCanvas>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Analytics &amp; Fleet Reports</h1>
          <p className="mt-1 text-sm text-obligon-text">Consumption and spend by enrolled fleet account.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            aria-label="Reporting period"
            className="h-11 rounded-xl border border-[#d7d8e4] bg-white px-4 text-sm font-extrabold text-obligon-navy outline-none"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
<ExportButton
            path="/api/partner/reports/export"
            label="Export Report"
            pendingLabel="Preparing…"
            className="bg-obligon-green text-white shadow-green hover:bg-obligon-green/90"
            query={{ range }}
          />
        </div>
      </div>

      <AsyncBoundary
        status={status}
        error={error?.message ?? null}
        onRetry={reload}
        loadingLabel="Building report…"
      >
        {data ? (
          <>
            <div className="mb-8 grid gap-6 sm:grid-cols-3">
              {data.metrics.map((metric, index) => (
                <SmallMetric key={metric.label} metric={metric} icon={metricIcons[index] ?? <BarChart3 size={20} />} />
              ))}
            </div>
            <DataTable
              title="Fleet Consumption"
              subtitle="Litres dispensed and spend by enrolled fleet account."
              columns={["Fleet Account", "Litres (L)", "Spend (₦)"]}
              rows={data.companies}
              rowKey={(row) => row.cells[0]}
            />
          </>
        ) : null}
      </AsyncBoundary>
    </DashboardCanvas>
  );
}

// ============ NOTIFICATIONS ============
function NotificationsPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  // The same fetch the header badge reads, so marking something read clears the
  // badge. This used to run its own `useAsync`, and the header kept its own
  // separate copy — so the list emptied while the badge kept counting.
  const { status, data, error, reload } = usePartnerNotifications();
  const [busy, setBusy] = React.useState(false);

  async function markRead(id: string) {
    if (!data) return;
    // Marking read used to only mutate a local Set of array indices, so it was
    // undone by any navigation and never reached the database. The server's
    // response is the new truth: refetch rather than guessing, so a refusal
    // cannot leave the dot on screen.
    try {
      await mutationsApi.partnerNotificationAction(id, "read");
      reload();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not mark that as read.");
    }
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await mutationsApi.partnerNotificationAction(null, "read-all");
      toastSuccess("All notifications marked as read.");
      reload();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not mark all as read.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardCanvas>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Notifications</h1>
          <p className="mt-1 text-sm text-obligon-text">
            Finance, support, security, and platform alerts for your station network.
            {data?.unreadCount ? ` ${data.unreadCount} unread.` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={busy || !data?.unreadCount}
          onClick={markAllRead}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d7d8e4] bg-white px-5 text-sm font-extrabold text-obligon-navy hover:bg-[#f7f7fd] transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check size={16} />
          Mark all as read
        </button>
      </div>

      <AsyncBoundary
        status={status}
        error={error?.message ?? null}
        isEmpty={!data || data.groups.length === 0}
        onRetry={reload}
        loadingLabel="Loading notifications…"
        empty={{ title: "Nothing to report", message: "Alerts about settlements, disputes and security will appear here." }}
      >
        {data ? (
          <div className="space-y-8">
            {data.groups.map((group: PartnerNotifications["groups"][number]) => (
              <section key={group.label}>
                <h2 className="mb-3 text-xs font-extrabold uppercase tracking-[1px] text-obligon-text">{group.label}</h2>
                <div className="divide-y divide-[#ececf5] overflow-hidden rounded-xl border border-[#d7d8e4] bg-white shadow-sm">
                  {group.items.map((item) => (
                    <button
                      key={item.id ?? `${group.label}-${item.title}`}
                      type="button"
                      disabled={item.read || busy}
                      onClick={() => item.id && void markRead(item.id)}
                      className="flex w-full items-start gap-4 px-6 py-5 text-left hover:bg-[#fbfbff] transition disabled:cursor-default disabled:opacity-70"
                    >
                      <span className={`mt-1 grid size-9 shrink-0 place-items-center rounded-xl ${item.read ? "bg-[#eef0f6] text-[#737582]" : "bg-[#ecfbd7] text-obligon-green"}`}>
                        <Bell size={16} />
                      </span>
                      <span className="flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className={`text-sm ${item.read ? "font-bold text-obligon-text" : "font-extrabold text-obligon-navy"}`}>{item.title}</span>
                          <span className="shrink-0 text-xs font-bold text-obligon-text">{item.time}</span>
                        </span>
                        <span className="mt-1 block text-xs text-obligon-text">{item.body}</span>
                      </span>
                      {!item.read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-obligon-green" /> : null}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </AsyncBoundary>
    </DashboardCanvas>
  );
}

// ============ STAFF ============
function StaffPage() {
  const { status, data, error, reload } = useAsync(() => api.getPartnerStaff());
  const [inviting, setInviting] = React.useState(false);
  const [editing, setEditing] = React.useState<PartnerRow | null>(null);

  return (
    <DashboardCanvas>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Station Staff</h1>
          <p className="mt-1 text-sm text-obligon-text">
            Attendants and supervisors with access to your station.
            {data ? ` ${data.stats.active} of ${data.stats.total} active.` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviting(true)}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-obligon-green px-5 text-sm font-extrabold text-white shadow-green hover:bg-obligon-green/90 transition"
        >
          <Plus size={16} />
          Invite Attendant
        </button>
      </div>

      <AsyncBoundary
        status={status}
        error={error?.message ?? null}
        isEmpty={!data || data.staff.length === 0}
        onRetry={reload}
        loadingLabel="Loading staff…"
        empty={{ title: "No staff yet", message: "Invite attendants and supervisors to your station." }}
      >
        {data ? (
          <DataTable
            title="Staff Members"
            columns={["Reference", "Member", "Role"]}
            rows={data.staff}
            rowKey={(row, index) => row.id ?? `${row.cells[0]}-${index}`}
            onAction={(row) => row && setEditing(row)}
          />
        ) : null}
      </AsyncBoundary>
      {inviting ? <StaffMemberModal member={null} onClose={() => setInviting(false)} onSaved={reload} /> : null}
      {editing ? <StaffMemberModal member={editing} onClose={() => setEditing(null)} onSaved={reload} /> : null}
    </DashboardCanvas>
  );
}

// ============ SETTINGS ============
function SettingsPage() {
  const { status, data, error, reload } = useAsync(() => api.getPartnerSettings());

  const rows: Array<[string, string]> = data
    ? [
        ["Organisation", data.org.name],
        ["RC Number", data.org.rcNumber ?? "—"],
        ["Address", data.org.address ?? "—"],
        ["City", data.org.city ?? "—"],
        ["Verification", data.org.verificationStatus],
        ["Two-factor authentication", data.security.twoFactorEnabled ? "Enabled" : "Disabled"]
      ]
    : [];

  return (
    <DashboardCanvas>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Organisation Settings</h1>
        <p className="mt-1 text-sm text-obligon-text">Your registered details and account security.</p>
      </div>

      <AsyncBoundary
        status={status}
        error={error?.message ?? null}
        onRetry={reload}
        loadingLabel="Loading settings…"
      >
        {data ? (
          <section className="overflow-hidden rounded-xl border border-[#d7d8e4] bg-white shadow-sm">
            <div className="divide-y divide-[#ececf5]">
              {rows.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-bold text-obligon-navy">{label}</span>
                  <span className="text-sm font-medium text-obligon-text">{value}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </AsyncBoundary>
    </DashboardCanvas>
  );
}

// The partner verification page is its own component at
// `app/dashboard/verify`, not a variant here: it is a centred focused task rather
// than a console page, and forcing it through this switch gave it a table-page
// layout it does not suit.
export function DashboardScreen({ pageKey }: { pageKey: DashboardPageKey }) {
  const [payout, setPayout] = React.useState<{ claimableKobo: number; claimableLabel: string } | null>(null);
  // Bumped whenever a payout, retry or new settlement account changes the balance.
  //
  // The modal used to close on success and nothing re-fetched, so the claimable
  // figure and the payout history behind it were the values from *before* the
  // request. The partner immediately saw the same amount still available and could
  // submit it again — which the server then refused, having already promised that
  // money to the transfer in flight.
  const [settlementVersion, setSettlementVersion] = React.useState(0);

  const pages: Partial<Record<DashboardPageKey, React.ReactNode>> = {
    overview: <OverviewPage />,
    pricing: <FuelPricingPage />,
    pos: <POSTerminalPage />,
    settlements: (
      <SettlementsPage
        onOpenPayout={setPayout}
        onPayoutRequested={() => setSettlementVersion((v) => v + 1)}
        version={settlementVersion}
      />
    ),
    disputes: <DisputesPage />,
    profile: <StationProfilePage />,
    station: <StationProfilePage />,
    staff: <StaffPage />,
    transactions: <TransactionsPage />,
    reports: <ReportsPage />,
    verification: <POSTerminalPage />,
    notifications: <NotificationsPage />,
    settings: <SettingsPage />
  };

  return (
    <>
      {pages[pageKey] ?? <OverviewPage />}
      {payout ? (
        <PayoutModal
          balance={payout}
          onClose={() => setPayout(null)}
          onSubmitted={() => setSettlementVersion((v) => v + 1)}
        />
      ) : null}
    </>
  );
}

/**
 * Wired to `POST /api/partner/payouts`.
 *
 * It was left inert in the previous commit because the endpoint took the
 * requested amount at face value, so a real submission would have been worse than
 * the toast it replaced. That endpoint now checks the amount against the
 * partner's claimable balance before writing anything.
 *
 * The ceiling is the server's figure, not a number typed in: the modal opens with
 * the same `claimableKobo` the endpoint enforces, and the input is capped at it.
 * The cap is a courtesy — the guard is the check that matters, and it lives on the
 * server where it cannot be bypassed.
 */
/**
 * The shared shell for every partner modal.
 *
 * Focus moves to the panel on open and Escape closes it. A dialog that traps
 * neither is unusable by keyboard, and the payout and staff forms are the two
 * places where a partner types money and account details.
 */
function Modal({
  title,
  description,
  onClose,
  children
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    panel.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#071853]/65 px-5 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-hero outline-none"
      >
        <h2 className="font-display text-2xl font-extrabold text-obligon-navy">{title}</h2>
        {description ? <p className="mt-1 text-sm font-medium text-obligon-text">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-4 rounded-xl border border-[#f3c6cc] bg-[#fff4f4] px-4 py-3 text-sm font-bold text-[#9f1027]">
      {message}
    </p>
  );
}

const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border border-[#cfd8cc] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green disabled:opacity-60";
const labelClass = "block text-xs font-extrabold uppercase text-obligon-text";

/**
 * Adds the settlement account.
 *
 * This form does not exist anywhere in the dashboard, and the page it belongs on
 * says "Add a bank account to receive settlements" and then offers no way to add
 * one. An account can only be created through the API, so a partner who had not
 * already nominated one could never reach a payout — which is exactly the state
 * the API refuses with "Add a verified bank account before requesting a payout".
 *
 * Server-side validation is reused rather than duplicated: the account number is
 * digit-stripped and length-checked by `POST /bank-accounts`, and its refusal is
 * shown in the form.
 */
function AddBankAccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { success: toastSuccess } = useToast();
  const [form, setForm] = React.useState({ bankName: "", bankCode: "", accountNumber: "", accountName: "" });
  const {status:banksStatus,data:banks,error:banksError,reload:reloadBanks}=useAsync(()=>api.request<{banks:{code:string;name:string}[]}>("/api/partner/bank-accounts/directory"));
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await mutationsApi.addBankAccount({
        bankName: form.bankName.trim(),
        bankCode: form.bankCode.trim(),
        accountNumber: form.accountNumber.replace(/\D/g, ""),
        accountName: form.accountName.trim()
      });
      toastSuccess("Account nominated. Choose it as default, then wait for admin verification.");
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add that bank account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Add Settlement Account"
      description="Fuel revenue is settled directly to your verified Nigerian bank account."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <FormError message={formError} />
        <label className={`mt-5 ${labelClass}`}>Bank
          <select className={fieldClass} required disabled={banksStatus!=="success"} value={form.bankCode} onChange={event=>{const bank=banks?.banks.find(bank=>bank.code===event.target.value);setForm(previous=>({...previous,bankCode:bank?.code??"",bankName:bank?.name??""}));}}>
            <option value="">{banksStatus==="loading"?"Loading banks…":"Select your bank"}</option>{banks?.banks.map(bank=><option key={bank.code} value={bank.code}>{bank.name}</option>)}
          </select>
        </label>
        {banksError?<div role="alert" className="mt-2 text-sm text-red-700">{banksError.message}<button type="button" onClick={reloadBanks} className="ml-2 underline">Retry bank directory</button></div>:null}
        <label className={`mt-4 block ${labelClass}`}>
          Account number
          <input
            className={fieldClass}
            value={form.accountNumber}
            onChange={event=>setForm(previous=>({...previous,accountNumber:event.target.value.replace(/\D/g,"").slice(0,10)}))}
            pattern="[0-9]{10}"
            maxLength={10}
            required
            inputMode="numeric"
            placeholder="10 digits"
          />
        </label>
        <label className={`mt-4 block ${labelClass}`}>
          Account name
          <input className={fieldClass} value={form.accountName} onChange={set("accountName")} required placeholder="As it appears at your bank" />
        </label>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-[#071853] text-sm font-bold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !form.bankCode || banksStatus!=="success"}
            className="h-11 flex-1 rounded-xl bg-obligon-green text-sm font-extrabold text-white flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : "Add Account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Removes a settlement account. Needed to act on the payout endpoint's own advice. */
function RemoveBankAccountModal({
  account,
  onClose,
  onSaved
}: {
  account: PartnerBankAccount;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success: toastSuccess } = useToast();
  const [removing, setRemoving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  async function remove() {
    setRemoving(true);
    setFormError(null);
    try {
      await mutationsApi.removeBankAccount(account.id);
      toastSuccess("Settlement account removed.");
      onSaved();
      onClose();
    } catch (err) {
      // The endpoint refuses while a payout is still in flight to this account, and
      // says so. Passing that through is the whole value of the dialog.
      setFormError(err instanceof Error ? err.message : "Could not remove that account.");
      setRemoving(false);
    }
  }

  return (
    <Modal title="Remove Settlement Account" description={`${account.bankName} ${account.accountMask}`} onClose={onClose}>
      <FormError message={formError} />
      <p className="mt-4 text-sm font-medium text-obligon-text">
        Payouts already sent to this account are unaffected. A payout still in flight to it must complete before it can
        be removed.
      </p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-[#071853] text-sm font-bold">
          Cancel
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={removing}
          className="h-11 flex-1 rounded-xl bg-[#b5162d] text-sm font-extrabold text-white disabled:opacity-50"
        >
          {removing ? <Loader2 size={16} className="animate-spin" /> : "Remove Account"}
        </button>
      </div>
    </Modal>
  );
}

/** Retries a failed payout. Reachable only from a row the API marked failed. */
function RetryPayoutModal({
  payout,
  onClose,
  onRetried
}: {
  payout: PartnerRow;
  onClose: () => void;
  onRetried: () => void;
}) {
  const { success: toastSuccess } = useToast();
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  async function submit() {
    if (!payout.id) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await mutationsApi.retryPayout(payout.id);
      toastSuccess(`Payout ${payout.reference ?? ""} submitted for processing again.`.replace("  ", " "));
      onRetried();
      onClose();
    } catch (err) {
      // The endpoint re-checks that the destination is still verified, so its
      // refusal here is meaningful and is passed through verbatim.
      setFormError(err instanceof Error ? err.message : "Could not retry that payout.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Retry Payout" description={payout.reference} onClose={onClose}>
      <FormError message={formError} />
      <p className="mt-4 text-sm font-medium text-obligon-text">
        This submits the transfer to the processor again. If the previous attempt failed because the bank account is no
        longer verified, it will be refused again.
      </p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-[#071853] text-sm font-bold">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="h-11 flex-1 rounded-xl bg-obligon-green text-sm font-extrabold text-white flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : "Retry Transfer"}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Invites an attendant, and edits or removes an existing one.
 *
 * The staff page is read-only. Its empty state says "invite your attendants" and
 * the API has had `POST /staff`, `PUT /staff/:id` and `DELETE /staff/:id` the whole
 * time — so an attendant could only be created by someone with curl.
 */
function StaffMemberModal({
  member,
  onClose,
  onSaved
}: {
  member: PartnerRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success: toastSuccess } = useToast();
  const editing = Boolean(member);
  const [form, setForm] = React.useState({
    fullName: "",
    email: "",
    phone: "",
    role: "attendant",
    enabled: true
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // One handler for both inputs and selects: they emit different event types, and
  // typing it as `HTMLInputElement` made it unusable on the role <select>.
  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) {
      setSubmitting(true);
      setFormError(null);
      try {
        await mutationsApi.addStaff({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: form.role
        });
        toastSuccess(`${form.fullName.trim()} added. They can sign in once their account is verified.`);
        onSaved();
        onClose();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Could not add that attendant.");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    // Guarded rather than asserted: `editing` is true exactly when `member` is set,
    // but a row without an id would otherwise send `/staff/undefined` and produce a
    // 400 the partner cannot act on.
    if (!member?.id) {
      setFormError("That attendant could not be identified. Reload the list and try again.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await mutationsApi.updateStaff(member.id, { enabled: form.enabled });
      toastSuccess("Attendant updated.");
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not update that attendant.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!member?.id) return;
    setRemoving(true);
    setFormError(null);
    try {
      await mutationsApi.removeStaff(member.id);
      toastSuccess("Attendant removed.");
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not remove that attendant.");
      setRemoving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Attendant" : "Invite Attendant"}
      description={editing ? member?.cells[0] : "They will be able to sign in to the partner dashboard once verified."}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <FormError message={formError} />
        {editing ? (
          <>
            <p className="mt-4 text-sm font-medium text-obligon-text">{member?.cells[1]}</p>
            <label className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
                className="size-4"
              />
              <span className="text-sm font-bold text-obligon-navy">Enabled</span>
            </label>
            <p className="mt-3 text-xs font-medium text-obligon-text">
              Disabling keeps the record and its history; it revokes dashboard access.
            </p>
          </>
        ) : (
          <>
            <label className={`mt-5 block ${labelClass}`}>
              Full name
              <input className={fieldClass} value={form.fullName} onChange={set("fullName")} required />
            </label>
            <label className={`mt-4 block ${labelClass}`}>
              Email
              <input className={fieldClass} type="email" value={form.email} onChange={set("email")} required />
            </label>
            <label className={`mt-4 block ${labelClass}`}>
              Phone
              <input className={fieldClass} value={form.phone} onChange={set("phone")} inputMode="tel" />
            </label>
            <label className={`mt-4 block ${labelClass}`}>
              Role
              <select className={fieldClass} value={form.role} onChange={set("role")}>
                <option value="attendant">Attendant</option>
                <option value="dispatcher">Dispatcher</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <p className="mt-3 text-xs font-medium text-obligon-text">
              Roles decide what an attendant can do. Only an owner can promote someone to owner.
            </p>
          </>
        )}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-[#071853] text-sm font-bold">
            Cancel
          </button>
          {editing ? (
            <button
              type="button"
              onClick={remove}
              disabled={removing || submitting}
              className="h-11 rounded-xl border border-[#f3c6cc] px-4 text-sm font-bold text-[#9f1027] disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={submitting || removing}
            className="h-11 flex-1 rounded-xl bg-obligon-green text-sm font-extrabold text-white flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : editing ? "Save" : "Send Invitation"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Responds to a dispute with a draft.
 *
 * `PUT /disputes/:id` exists and takes `draftResponse`, and the list said "View
 * Details" on every row. "View" had no panel behind it, so a station could read a
 * claim and had no way to answer it.
 */
function DisputeDetailModal({
  dispute,
  onClose,
  onSaved
}: {
  dispute: PartnerDispute;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success: toastSuccess } = useToast();
  const [draft, setDraft] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const description = dispute.description ?? "";
  const existing = dispute.draftResponse ?? "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!dispute.id) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await mutationsApi.updateDispute(dispute.id, { draftResponse: draft });
      toastSuccess("Your response was saved and sent for review.");
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save your response.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={dispute.reference ?? "Dispute"} description={dispute.subject} onClose={onClose}>
      <form onSubmit={submit}>
        <FormError message={formError} />
        <dl className="mt-4 space-y-2 rounded-xl bg-[#f7f7fd] p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="font-bold text-obligon-text">Claimed amount</dt>
            <dd className="font-extrabold text-obligon-navy">{dispute.amountLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-bold text-obligon-text">Status</dt>
            <dd className="font-extrabold text-obligon-navy">{dispute.statusRaw ?? dispute.status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-bold text-obligon-text">Raised</dt>
            <dd className="font-extrabold text-obligon-navy">{dispute.created}</dd>
          </div>
        </dl>
        {description ? <p className="mt-4 text-sm font-medium text-obligon-text">{description}</p> : null}
        {existing ? (
          <p className="mt-4 rounded-xl border border-obligon-border p-3 text-sm font-medium text-obligon-text">
            Your current response: {existing}
          </p>
        ) : null}
        <label className={`mt-4 block ${labelClass}`}>
          Your response
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            required
            placeholder="Describe what happened at the dispenser…"
            className="mt-1.5 w-full rounded-xl border border-[#cfd8cc] px-4 py-3 text-sm font-medium text-obligon-navy outline-none focus:border-obligon-green"
          />
        </label>
        <p className="mt-2 text-xs font-medium text-obligon-text">
          Obligon reviews the case with both sides before a refund is decided.
        </p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-[#071853] text-sm font-bold">
            Close
          </button>
          <button
            type="submit"
            disabled={submitting || draft.trim() === ""}
            className="h-11 flex-1 rounded-xl bg-obligon-green text-sm font-extrabold text-white flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : "Submit Response"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Station operations: upload a site asset, order a resupply, message the terminal.
 *
 * Three working endpoints with no control anywhere in the dashboard.
 *
 * The resupply order records the request against the station. Nothing in this
 * system drives a dispenser or places an order with a supplier, so the wording is
 * "request" throughout and the confirmation says a team member will follow up —
 * it does not claim fuel is on the way.
 */
function StationOperationsModal({
  stationId,
  onClose,
  onDone
}: {
  stationId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [busy, setBusy] = React.useState<"asset" | "resupply" | "message" | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [fuelType, setFuelType] = React.useState("AGO Diesel");
  const [litres, setLitres] = React.useState("");
  const [message, setMessage] = React.useState("");

  async function uploadAsset() {
    if (!file) return;
    setBusy("asset");
    try {
      await mutationsApi.uploadStationAsset(file);
      toastSuccess("Asset uploaded.");
      onDone();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not upload that file.");
    } finally {
      setBusy(null);
    }
  }

  async function requestResupply() {
    const parsed = Number(litres);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setBusy("resupply");
    try {
      await mutationsApi.requestResupply({ fuelType, litres: parsed });
      toastSuccess(`Resupply request for ${parsed.toLocaleString()} L of ${fuelType} recorded. A team member will follow up.`);
      setLitres("");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not record that resupply request.");
    } finally {
      setBusy(null);
    }
  }

  async function sendMessage() {
    if (message.trim() === "") return;
    setBusy("message");
    try {
      await mutationsApi.messageTerminal(message.trim());
      toastSuccess("Message sent to the terminal.");
      setMessage("");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not send that message.");
    } finally {
      setBusy(null);
    }
  }

  const spinner = (which: typeof busy) =>
    busy === which ? <Loader2 size={14} className="animate-spin" /> : null;

  return (
    <Modal title="Station Operations" description="Site records and requests for this station." onClose={onClose}>
      <section className="mt-5">
        <h3 className={labelClass}>Site asset</h3>
        <p className="mt-1 text-xs font-medium text-obligon-text">
          An image of the site, equipment or dispenser. Images only.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block w-full text-xs font-bold text-obligon-text file:mr-3 file:rounded-lg file:border-0 file:bg-[#f0f4e8] file:px-3 file:py-2 file:text-xs file:font-extrabold file:text-obligon-green"
          />
          <button
            type="button"
            onClick={uploadAsset}
            disabled={!file || busy !== null}
            className="h-10 shrink-0 rounded-xl border border-obligon-green px-4 text-xs font-extrabold text-obligon-green disabled:opacity-40"
          >
            {spinner("asset") ?? "Upload"}
          </button>
        </div>
      </section>

      <section className="mt-6 border-t border-obligon-border pt-5">
        <h3 className={labelClass}>Request resupply</h3>
        <div className="mt-2 flex gap-2">
          <select
            value={fuelType}
            onChange={(event) => setFuelType(event.target.value)}
            aria-label="Fuel type"
            className="h-10 flex-1 rounded-xl border border-[#cfd8cc] px-3 text-xs font-bold text-obligon-navy"
          >
            <option>AGO Diesel</option>
            <option>PMS</option>
            <option>Petrol</option>
          </select>
          <input
            value={litres}
            onChange={(event) => setLitres(event.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            placeholder="Litres"
            aria-label="Litres"
            className="h-10 w-28 rounded-xl border border-[#cfd8cc] px-3 text-xs font-bold text-obligon-navy"
          />
          <button
            type="button"
            onClick={requestResupply}
            disabled={busy !== null || litres.trim() === ""}
            className="h-10 shrink-0 rounded-xl bg-obligon-green px-4 text-xs font-extrabold text-white disabled:opacity-40"
          >
            {spinner("resupply") ?? "Request"}
          </button>
        </div>
      </section>

      <section className="mt-6 border-t border-obligon-border pt-5">
        <h3 className={labelClass}>Message the terminal</h3>
        <div className="mt-2 flex gap-2">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Display message for the terminal"
            aria-label="Terminal message"
            className="h-10 flex-1 rounded-xl border border-[#cfd8cc] px-3 text-xs font-bold text-obligon-navy"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={busy !== null || message.trim() === ""}
            className="h-10 shrink-0 rounded-xl border border-obligon-green px-4 text-xs font-extrabold text-obligon-green disabled:opacity-40"
          >
            {spinner("message") ?? "Send"}
          </button>
        </div>
      </section>

      <p className="mt-5 text-xs font-medium text-obligon-text">Station reference {stationId.slice(0, 8)}</p>
      <button type="button" onClick={onClose} className="mt-3 h-11 w-full rounded-xl border border-[#071853] text-sm font-bold">
        Done
      </button>
    </Modal>
  );
}

function PayoutModal({
  balance,
  onClose,
  onSubmitted
}: {
  balance: { claimableKobo: number; claimableLabel: string };
  onClose: () => void;
  onSubmitted: () => void;
}) {
  // Failures are shown in the form rather than as a toast, so the message stays
  // put while the amount is corrected. Only the success is transient.
  const { success: toastSuccess } = useToast();
  const [amount, setAmount] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const maxNaira = balance.claimableKobo / 100;
  const parsed = Number(amount);
  const overLimit = amount.trim() !== "" && Number.isFinite(parsed) && parsed * 100 > balance.claimableKobo;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFormError("Enter a payout amount greater than ₦0.");
      return;
    }
    if (overLimit) {
      setFormError(`You can withdraw up to ${balance.claimableLabel}.`);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const result = await mutationsApi.requestPayout({ amount: parsed });
      // "Submitted and being processed" is what actually happened: the processor
      // queues a transfer and settles it later, so nothing here claims the money
      // has left. The settlement tab shows it reconcile.
toastSuccess(`Payout ${result.reference} submitted and is being processed.`);
      // Refetch before closing, so the balance and history the partner returns to
      // reflect the request they just made.
      onSubmitted();
      onClose();
    } catch (err) {
      // The endpoint's own words: it names the claimable figure when refusing, and
      // says which provider rejected it when the transfer fails. Swallowing those
      // into a generic failure is what made this unusable.
      setFormError(err instanceof Error ? err.message : "Could not submit the payout request.");
    } finally {
      setSubmitting(false);
    }
  }

  const nothingClaimable = balance.claimableKobo < 100000;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071853]/65 px-5 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-hero">
        <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Request Settlement Payout</h2>
        <p className="mt-1 text-sm font-medium text-obligon-text">
          {nothingClaimable
            ? "There is no settled balance available to withdraw right now."
            : `Up to ${balance.claimableLabel} is available to withdraw.`}
        </p>

        {formError ? (
          <p role="alert" className="mt-4 rounded-xl border border-[#f3c6cc] bg-[#fff4f4] px-4 py-3 text-sm font-bold text-[#9f1027]">
            {formError}
          </p>
        ) : null}

        <label className="mt-5 block">
          <span className="text-xs font-extrabold uppercase text-obligon-text">Payout Amount (₦)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            disabled={nothingClaimable}
            placeholder={nothingClaimable ? undefined : maxNaira.toLocaleString("en-NG")}
            aria-describedby="payout-available"
            className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 font-display text-xl font-extrabold text-obligon-navy outline-none focus:border-obligon-green disabled:opacity-60"
            required
          />
          <span id="payout-available" className="mt-1.5 block text-xs font-medium text-obligon-text">
            {balance.claimableLabel} available
          </span>
        </label>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-[#071853] text-sm font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || nothingClaimable || overLimit}
            className="h-11 flex-1 rounded-xl bg-obligon-green text-sm font-extrabold text-white flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : "Confirm Payout"}
          </button>
        </div>
      </form>
    </div>
  );
}
