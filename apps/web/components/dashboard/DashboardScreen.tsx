"use client";

import * as React from "react";
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
import { api, mutationsApi } from "@/lib/services";
import { MobileDashboardNav } from "./MobileDashboardNav";
import { AsyncBoundary, EmptyState } from "@/components/shared/States";
import { useAsync } from "@/components/shared/useAsync";
import { useToast } from "@/components/shared/Toast";
import type {
  PartnerMetric,
  PartnerNotifications,
  PartnerRow,
  PartnerTone
} from "@/lib/services/types";
import type { DashboardPageKey } from "@/lib/mock/dashboard-data";

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

function DashboardCanvas({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileDashboardNav />
      <section className="px-5 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</section>
    </>
  );
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

function DataTable({
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
  rows: PartnerRow[];
  actionLabel?: string;
  onAction?: (row?: PartnerRow) => void;
  rowKey?: (row: PartnerRow, index: number) => string;
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
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ececf5]">
            {rows.map((row, rowIndex) => (
              <tr key={rowKey(row, rowIndex)} className="hover:bg-[#fbfbff] transition">
                {row.cells.map((cell, cellIndex) => {
                  const parts = cell.split("\n");
                  return (
                    <td key={`${cell}-${cellIndex}`} className="px-6 py-4 align-middle text-sm">
                      <p className="font-bold text-obligon-navy">{parts[0]}</p>
                      {parts.slice(1).map((part) => (
                        <p key={part} className="mt-0.5 text-xs font-medium text-obligon-text">{part}</p>
                      ))}
                    </td>
                  );
                })}
                <td className="px-6 py-4">{row.status ? <StatusPill status={row.status} tone={row.tone} /> : null}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onAction?.(row)}
                    className="text-xs font-extrabold text-obligon-green hover:underline"
                  >
                    {row.action ?? "Details"}
                  </button>
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
  const [syncing, setSyncing] = React.useState(false);

  // The rows come from the prices the station actually has, rather than three
  // fixed fuel types with made-up starting values. Drafts stay null until the
  // fetch lands so a re-render never briefly shows the previous station's rates.
  const rows: PriceDraft[] =
    drafts ?? (data?.prices ?? []).map((price) => ({ fuelType: price.fuelType, price: String(price.price) }));

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
      await mutationsApi.updatePrices(updates);
      toastSuccess(`${updates.length} price${updates.length === 1 ? "" : "s"} published to your dispensers.`);
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
        <p className="mt-1 text-sm text-obligon-text">Configure live pump rates and sync prices directly with smart dispenser meters.</p>
      </div>

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
                <article key={row.fuelType} className="rounded-xl border border-[#d7d8e4] bg-white p-6 shadow-sm">
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
                  message="Add your first pump rate. It is published to your dispensers and recorded in the price history."
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
                {syncing ? <Loader2 size={18} className="animate-spin" /> : "Broadcast & Sync to Dispensers"}
              </button>
            </div>
          </form>
        ) : null}
      </AsyncBoundary>
    </DashboardCanvas>
  );
}

// ============ POS TERMINAL ============
function POSTerminalPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [code, setCode] = React.useState("");
  const [pump, setPump] = React.useState("PMS Petrol");
  const [amount, setAmount] = React.useState("25000");
  const [verifying, setVerifying] = React.useState(false);
  const [authReceipt, setAuthReceipt] = React.useState<{
    reference: string; vehicle: string; amount: string; driver: string; card: string;
  } | null>(null);

  async function handleAuthorize(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) {
      toastError("Please enter the complete 6-digit fleet authorization code.");
      return;
    }
    setVerifying(true);
    try {
      const result = await mutationsApi.posAuthorize({
        code,
        litres: Number(amount) ? Number(amount) / 1085 : undefined,
        fuelType: pump
      });
      // Every field comes from the authorization response. The previous version
      // fell back to "Fleet vehicle", "Fleet driver" and a reference invented with
      // Math.random(), so a declined-looking receipt could still show a
      // transaction that never existed.
      setAuthReceipt({
        reference: String(result?.reference ?? "—"),
        vehicle: String(result?.vehicle ?? "—"),
        amount: String(result?.amountLabel ?? "—"),
        driver: String(result?.driver ?? "—"),
        card: String(result?.card ?? "—")
      });
      toastSuccess(`Authorization ${result?.reference} approved. Pump activated.`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Authorization declined. Check the code and try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <DashboardCanvas>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-extrabold text-obligon-navy">POS Authorization Terminal</h1>
          <p className="mt-1 text-sm text-obligon-text">Enter a driver&apos;s 6-digit authorization code to unlock the dispenser.</p>
        </div>

        {authReceipt ? (
          <div className="rounded-2xl border border-obligon-border bg-white p-8 shadow-hero text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
              <Check size={32} />
            </span>
            <h2 className="mt-5 font-display text-3xl font-extrabold text-obligon-navy">Dispense Authorized</h2>
            <p className="mt-1 text-sm text-obligon-text">
              Reference: <strong className="font-mono font-extrabold text-obligon-navy">{authReceipt.reference}</strong>
            </p>

            <div className="mt-6 rounded-xl bg-[#f7fbf8] p-5 border border-obligon-border space-y-2 text-left text-sm">
              {[
                ["Card", authReceipt.card],
                ["Fleet Vehicle", authReceipt.vehicle],
                ["Driver", authReceipt.driver],
                ["Total Approved", authReceipt.amount],
                ["Fuel Type", pump]
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
                  value={pump}
                  onChange={(e) => setPump(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#cfd8cc] bg-white px-3 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                >
                  <option>PMS Petrol</option>
                  <option>AGO Diesel</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-extrabold uppercase text-obligon-text block mb-1.5">
                  Amount Requested (₦)
                </label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  className="h-12 w-full rounded-xl border border-[#cfd8cc] px-4 font-display text-xl font-extrabold text-obligon-navy outline-none focus:border-obligon-green"
                  required
                />
              </div>
            </div>

            <button
              disabled={verifying || code.length < 6}
              type="submit"
              className="mt-4 h-14 w-full rounded-xl bg-obligon-green font-extrabold text-white text-base shadow-green hover:bg-obligon-green/90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying ? <Loader2 size={20} className="animate-spin" /> : "Authorize & Activate Dispenser"}
            </button>
          </form>
        )}
      </div>
    </DashboardCanvas>
  );
}

// ============ SETTLEMENTS ============
function SettlementsPage({ onOpenPayout }: { onOpenPayout: () => void }) {
  const { status, data, error, reload } = useAsync(() => api.getPartnerSettlements());

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

                {defaultAccount ? (
                  <div className="mt-5 rounded-xl bg-[#f7fbf8] p-4 border border-obligon-border">
                    <p className="font-extrabold text-obligon-navy">{defaultAccount.bankName}</p>
                    <p className="mt-1 font-mono text-sm text-obligon-text">{defaultAccount.accountMask}</p>
                    <p className="mt-1 text-xs font-bold text-obligon-navy">{defaultAccount.accountName}</p>
                    {!defaultAccount.verified ? (
                      <p className="mt-2 text-xs font-extrabold text-[#b5162d]">Awaiting verification</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 text-sm font-medium text-obligon-text">
                    Add a bank account to receive settlements. Payouts cannot be requested without one.
                  </p>
                )}

                <div className="mt-6 rounded-xl border border-obligon-border p-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">Pending</p>
                  <p className="mt-1 font-display text-2xl font-extrabold text-obligon-navy">{data.totals.pendingLabel}</p>
                  <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">Settled to date</p>
                  <p className="mt-1 font-display text-2xl font-extrabold text-obligon-navy">{data.totals.totalSettledLabel}</p>
                  <p className="mt-3 text-xs font-bold text-obligon-text">
                    Auto-settlement is {data.config.autoSettlement ? "on" : "off"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onOpenPayout}
                  className="mt-6 w-full h-11 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green hover:bg-obligon-green/90 transition"
                >
                  Request Direct Payout
                </button>
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
                subtitle="Automated NUBAN disbursements and manual payout requests."
                columns={["Reference", "Requested", "Amount", "Destination"]}
                rows={data.payouts}
                rowKey={(row) => row.id ?? row.reference ?? row.cells[0]}
              />
            </main>
          </div>
        ) : null}
      </AsyncBoundary>
    </DashboardCanvas>
  );
}

// ============ DISPUTES ============
function DisputesPage() {
  const { status, data, error, reload } = useAsync(() => api.getPartnerDisputes());

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
          />
        ) : null}
      </AsyncBoundary>
    </DashboardCanvas>
  );
}

// ============ STATION PROFILE ============
function StationProfilePage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const { status, data, error, reload } = useAsync(() => api.getPartnerStation());
  const [form, setForm] = React.useState<{ name: string; address: string; city: string; hours: string; fuels: string } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const station = data?.station ?? null;
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
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Station Profile</h1>
        <p className="mt-1 text-sm text-obligon-text">The details customers see in the station locator.</p>
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
    </DashboardCanvas>
  );
}

// ============ TRANSACTIONS ============
function TransactionsPage() {
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebounced(query);
  const { status, data, error, reload } = useAsync(
    () => api.getPartnerTransactions({ search: debouncedQuery || undefined, limit: 50 }),
    [debouncedQuery]
  );

  return (
    <DashboardCanvas>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Fleet Transactions</h1>
          <p className="mt-1 text-sm text-obligon-text">
            Every card-authorized fuel dispense across your partner network.
            {data ? ` ${data.total.toLocaleString()} matching.` : ""}
          </p>
        </div>
        <a
          href="/api/partner/transactions/export"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d7d8e4] bg-white px-5 text-sm font-extrabold text-obligon-navy hover:bg-[#f7f7fd] transition"
        >
          <Download size={16} />
          Export Ledger
        </a>
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
          <DataTable
            title="Card Authorizations"
            columns={["Date & Time", "Fleet / Vehicle", "Card", "Amount (₦)"]}
            rows={data.rows}
            rowKey={(row) => row.id ?? row.reference ?? row.cells.join("/")}
          />
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
          <a
            href="/api/partner/reports/export"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-obligon-green px-5 text-sm font-extrabold text-white shadow-green hover:bg-obligon-green/90 transition"
          >
            <Download size={16} />
            Export Report
          </a>
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
  const { status, data, error, reload } = useAsync(() => api.getPartnerNotifications());
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
          />
        ) : null}
      </AsyncBoundary>
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

export function DashboardScreen({ pageKey }: { pageKey: DashboardPageKey }) {
  const [payoutModalOpen, setPayoutModalOpen] = React.useState(false);

  const openPayout = () => setPayoutModalOpen(true);

  const pages: Record<DashboardPageKey, React.ReactNode> = {
    overview: <OverviewPage />,
    pricing: <FuelPricingPage />,
    pos: <POSTerminalPage />,
    settlements: <SettlementsPage onOpenPayout={openPayout} />,
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

      {payoutModalOpen ? (
        <PayoutNotice onClose={() => setPayoutModalOpen(false)} />
      ) : null}
    </>
  );
}

/**
 * Deliberately not wired to `POST /api/partner/payouts`.
 *
 * The button used to validate an amount and then report "submitted to bank"
 * without making any request at all. Wiring it as-is would be worse than the
 * lie: `/payouts` has no balance check, so a real request for ₦50,000,000
 * against ₦0 pending is accepted and written to the payouts table before it
 * fails at the transfer. That endpoint needs its guard before this becomes a
 * real submission.
 */
function PayoutNotice({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071853]/65 px-5 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-hero">
        <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Payout requests are not open yet</h2>
        <p className="mt-3 text-sm font-medium text-obligon-text">
          Payouts cannot be requested from here at the moment. Our team is completing final checks on the
          settlement flow and will enable it once every request is guaranteed to be checked against your
          pending balance before any money moves.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-11 w-full rounded-xl bg-obligon-green text-sm font-extrabold text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}