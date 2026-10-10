"use client";

import React, { useState } from "react";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Download,
  FileWarning,
  Fuel,
  Grid2X2,
  HeartHandshake,
  History,
  LockKeyhole,
  MapPinned,
  MessageCircle,
  Pencil,
  Receipt,
  ShieldCheck,
  Snowflake,
  Upload,
  WalletCards,
  Send,
  Loader2,
  CheckCircle2,
  SlidersHorizontal,
  type LucideProps
} from "lucide-react";
import { useRouter } from "next/navigation";
import { customerFeatureAvailable, type CustomerEntitlementState } from "@/lib/customer-entitlements";
import {
  type CustomerPageKey,
  type CustomerTone
} from "@/lib/mock/customer-data";
import { api, mutationsApi, DEFAULT_NOTIFICATION_PREFS, ApiError, type CardCheckout, type CardPlan, type CardRequest, type CardRequestProgress, type CustomerMoneyEvent, type CustomerTransaction, type NotificationPrefs, type OpenCardRequest } from "@/lib/services";
import { AsyncBoundary } from "@/components/shared/States";
import { useAsync } from "@/components/shared/useAsync";
import { usePolling } from "@/components/shared/usePolling";
import { useSession } from "@/components/shared/AuthContext";
import { useToast } from "@/components/shared/Toast";
import { Toggle } from "@/components/shared/Toggle";
import { currentPushState, disableWebPush, enableWebPush, pushSupported } from "@/lib/push-subscription";
import { CustomerModals, ModalFrame, type CustomerModalType } from "./CustomerModals";
import { CardDetailsModal, CardPlanModal, CardSubmittedModal, PendingPaymentModal, CardVerificationProgressModal } from "./CardRequestModals";
import { ConfirmModal, PinModal } from "../shared/Dialogs";
import { StationMap } from "../shared/StationMap";
import { routes } from "../site/routes";

// Short enough that a customer watching a bank transfer does not conclude it
// failed, long enough that the API and the render free tier are not the reason
// it is slow. "A couple of seconds" was the ask; this is the value that
// satisfies it without a request per second per open tab.
const BALANCE_POLL_MS = 4000;

const toneClasses: Record<CustomerTone, string> = {
  green: "bg-[#e8fbd7] text-obligon-green",
  blue: "bg-[#e8efff] text-obligon-blue",
  red: "bg-[#ffe8e8] text-[#c1121f]",
  amber: "bg-[#fff3d8] text-[#9a6300]",
  muted: "bg-[#eef3ee] text-obligon-text",
  dark: "bg-[#20251f] text-white"
};

function Canvas({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return <section className={`px-5 pb-28 pt-10 sm:px-8 lg:px-16 lg:pb-16 ${compact ? "lg:pt-9" : "lg:pt-16"}`}>{children}</section>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <article className={`rounded-2xl border border-[#dbe2d8] bg-white ${className}`}>{children}</article>;
}

function MiniIcon({ tone = "green", children }: { tone?: CustomerTone; children: React.ReactNode }) {
  return <span className={`grid size-10 place-items-center rounded-full ${toneClasses[tone]}`}>{children}</span>;
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="font-display text-2xl font-extrabold tracking-normal text-obligon-navy">{title}</h2>
      {action}
    </div>
  );
}

function TrendChart() {
  return (
    <svg viewBox="0 0 320 260" className="h-[300px] w-full lg:h-[250px]" role="img" aria-label="Fuel spend trend">
      <line x1="24" x2="24" y1="16" y2="238" stroke="#e5ebe2" />
      <line x1="24" x2="304" y1="238" y2="238" stroke="#e5ebe2" />
      <path d="M24 214 C58 188 82 180 120 188 C158 196 172 180 178 136 C184 92 196 62 226 82 C250 98 262 150 286 162 C306 172 312 120 304 58" fill="none" stroke="#63b800" strokeWidth="9" strokeLinecap="round" />
      {[24, 82, 138, 198, 258, 304].map((x, index) => (
        <circle key={x} cx={x} cy={[214, 176, 188, 106, 135, 58][index]} r="5.5" fill="#061958" />
      ))}
      {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month, index) => (
        <text key={month} x={24 + index * 56} y="256" textAnchor="middle" fontSize="12" fill="#3f463d">{month}</text>
      ))}
    </svg>
  );
}

function VehicleTable() {
  const router = useRouter();
  const { status, data: vehicles, error, reload } = useAsync(() => api.getCustomerVehiclePerformance());
  return (
    <AsyncBoundary
      status={status}
      error={error?.message ?? null}
      isEmpty={!vehicles || vehicles.length === 0}
      onRetry={reload}
      loadingLabel="Loading vehicles…"
      empty={{ title: "No vehicle data", message: "Vehicle performance metrics will appear here." }}
    >
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-6 border-b border-[#eef3ee]">
          <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Vehicle Performance</h2>
          <button onClick={() => router.push("/customer/transactions")} className="text-sm font-extrabold text-obligon-green hover:underline" type="button">
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead className="bg-[#f0f4f0] text-xs uppercase tracking-[0.8px] text-[#3f463d]">
              <tr>
                <th className="px-6 py-4">Vehicle ID</th>
                <th>Spend</th>
                <th>Volume</th>
                <th>Efficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3ee]">
              {(vehicles ?? []).map(([id, spend, volume, efficiency]) => (
                <tr key={id} className="hover:bg-[#f7fbf8] transition">
                  <td className="px-6 py-4 font-bold text-obligon-green">{id}</td>
                  <td className="font-semibold text-obligon-navy">{spend}</td>
                  <td className="text-obligon-text">{volume}</td>
                  <td className={efficiency === "76%" ? "text-[#d71920] font-bold" : "text-obligon-green font-bold"}>{efficiency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AsyncBoundary>
  );
}

function ActivityList({ desktop = false }: { desktop?: boolean }) {
  const router = useRouter();
  const { status, data: recentActivity, error, reload, refresh } = useAsync(() => api.getCustomerRecentActivity());
  // The feed carries fuel transactions and account notifications, and either can
  // change without this page being touched: a transfer landing credits a wallet
  // and raises a notification at the same moment.
  usePolling(refresh, { intervalMs: BALANCE_POLL_MS });
  return (
    <AsyncBoundary
      status={status}
      error={error?.message ?? null}
      isEmpty={!recentActivity || recentActivity.length === 0}
      onRetry={reload}
      loadingLabel="Loading activity…"
      empty={{
        title: "No recent activity",
        message: "Your transactions and account alerts will appear here."
      }}
    >
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-6 border-b border-[#eef3ee]">
          <h2 className="font-display text-2xl font-extrabold text-obligon-navy">{desktop ? "Recent Activity" : "Recent Transactions"}</h2>
          {/* Notifications, not the transaction page. This panel lists account
              events as well as purchases, so sending someone to a page that only
              showed fuel dispenses lost most of what they were looking at — and
              for a customer who had only ever topped up, it landed on an empty
              screen. */}
          <button onClick={() => router.push("/customer/notifications")} className="text-sm font-bold text-obligon-green hover:underline" type="button">
            View All
          </button>
        </div>
        <div className="divide-y divide-[#eef3ee]">
          {(recentActivity ?? []).map((item) => (
            <div
              key={item.id}
              onClick={() => router.push(item.link || "/customer/transactions")}
              className="flex items-center gap-4 px-6 py-4 hover:bg-[#f7fbf8] transition cursor-pointer"
            >
              <MiniIcon tone={item.kind === "notification" ? "blue" : "muted"}>
                {item.kind === "notification" ? <Bell size={18} /> : <Fuel size={18} />}
              </MiniIcon>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-obligon-navy">{item.title}</p>
                <p className="truncate text-sm text-obligon-text">{desktop ? item.time : item.subtitle}</p>
                {/* The timestamp was replacing the description on the desktop feed,
                    which is how a notification's body — the only part that says
                    what happened — never appeared anywhere. Both are shown, and
                    the description is kept when there is one. */}
                {desktop && item.subtitle ? (
                  <p className="truncate text-sm text-obligon-text">{item.subtitle}</p>
                ) : null}
              </div>
              {/* No amount for a notification: it is not a monetary event, and a
                  currency figure here would be invented. */}
              {item.amount ? (
                <p className="shrink-0 font-extrabold text-obligon-green">{item.amount}</p>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    </AsyncBoundary>
  );
}

function metricValue(metrics: { label: string; value: string; helper?: string }[] | null, label: string, fallback = "—") {
  return metrics?.find((item) => item.label === label)?.value ?? fallback;
}

function metricHelper(metrics: { label: string; value: string; helper?: string }[] | null, label: string) {
  return metrics?.find((item) => item.label === label)?.helper;
}

function greetingHour() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function OverviewPage({
  balanceRefreshKey,
  onEditProjection,
  canEditProjection
}: {
  balanceRefreshKey: number;
  onEditProjection: () => void;
  canEditProjection: boolean;
}) {
  const { user } = useSession();
  const router = useRouter();
  const { status, data: metrics, error, reload, refresh } = useAsync(
    () => api.getCustomerOverviewMetrics(),
    [balanceRefreshKey]
  );
  // A fuel purchase in another tab, or a bank transfer that has just settled,
  // changes the balance without touching this page. Polling is what stops the
  // customer concluding their money went missing.
  usePolling(refresh, { intervalMs: BALANCE_POLL_MS });
  const { data: cardData, status: cardLoadStatus, refresh: refreshCard } = useAsync(
    () => api.request<{ card: CustomerCard | null }>("/api/customer/card"), [balanceRefreshKey]
  );
  usePolling(refreshCard, { intervalMs: BALANCE_POLL_MS });
  const cardSummary = cardLoadStatus === "loading" ? "Loading card status…"
    : cardLoadStatus === "error" ? "Card status unavailable"
    : !cardData?.card ? "No card issued"
    : `Card ${cardData.card.status}`;
  const firstName = user?.name?.split(" ")[0] ?? "Driver";
  const totalBalance = metricValue(metrics, "Total Account Balance", "₦0.00");
  const mtdSpend = metricValue(metrics, "MTD Spend", "₦0.00");
  const mtdSpendHelper = metricHelper(metrics, "MTD Spend") ?? "";
  // The projection is what the MTD Spend card is measured against, and it is
  // also how the customer changes it: the whole card is the control. Showing the
  // figure and the edit in one place is why the prompt at the start of a month
  // does not need to explain where to go afterwards.
  const projectedSpend = metricValue(metrics, "Projected Spend", "Not set");
  const projectedHelper = metricHelper(metrics, "Projected Spend") ?? "Tap to set this month";
  const budgetUsage = metricValue(metrics, "Budget Usage", "-");
  const budgetLimit = metricHelper(metrics, "Budget Usage") ?? "Not set";
  const litres = metricValue(metrics, "Litres Consumed", "0 L");
  const txnCount = metricValue(metrics, "Transactions", "0");
  const security = metricValue(metrics, "Security Status", "0 Alerts");
  const securityHelper = metricHelper(metrics, "Security Status") ?? "0 Blocked | 0 Suspicious";
  // The bar caps at 100% because that is all the width can show, but the number
  // beside it stays the real one: clamping a 140% figure to 100% would hide the
  // only part of this card the customer actually needs to read.
  const usagePercent = Math.min(100, Math.max(0, Number.parseInt(budgetUsage, 10) || 0));
  const hasProjection = projectedSpend !== "Not set";

  return (
    <Canvas>
      <div className="lg:hidden">
        <h1 className="font-display text-[34px] font-extrabold leading-tight text-obligon-green">{greetingHour()}, {firstName}</h1>
        <p className="mt-2 text-base text-[#3f463d]">Here is your live fleet overview for today.</p>
      </div>

      <AsyncBoundary
        status={status}
        error={error?.message ?? null}
        isEmpty={!metrics || metrics.length === 0}
        onRetry={reload}
        loadingLabel="Loading overview…"
        empty={{ title: "No overview data", message: "Account metrics will appear here once available." }}
      >
        <div className="mt-8 grid gap-6 lg:mt-0 lg:grid-cols-[1fr_282px]">
          <Card className="p-6 lg:p-8">
            <div className="flex justify-between items-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.8px] text-[#3f463d]">Total Account Balance</p>
              <WalletCards size={22} className="text-obligon-green" />
            </div>
            <p className="mt-4 font-display text-[40px] font-extrabold leading-none text-obligon-navy lg:text-[56px]">
              {totalBalance}
            </p>
          </Card>
          {/* The whole card is the control for this month's projection. It was a
              read-only figure before, so the MTD Spend bar was driven by a limit
              set in a page the customer was never sent to, and read "-"
              forever. Clicking the card is the affordance, and the label says so
              rather than leaving it to be discovered. */}
          <Card className="p-6 text-left">
            <button
              type="button"
              onClick={onEditProjection}
              disabled={!canEditProjection}
              className="block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-obligon-green"
              aria-label={canEditProjection ? "Set or change your projected spend for this month" : "Budget management requires an active subscription"}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-extrabold uppercase tracking-[0.8px] text-[#3f463d]">MTD Spend</p>
                {mtdSpendHelper ? (
                  <p className="text-[11px] font-semibold text-obligon-text">{mtdSpendHelper}</p>
                ) : null}
              </div>
              <p className="mt-4 font-display text-[32px] font-extrabold text-[#b51f24]">{mtdSpend}</p>
              <div className="mt-6 flex justify-between text-sm">
                <span className="font-bold text-[#3f463d]">Budget Usage</span>
                <span className="font-extrabold text-obligon-navy">{budgetUsage}</span>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-[#dce5da] overflow-hidden">
                <span
                  className={`block h-full rounded-full transition-all ${usagePercent >= 100 ? "bg-[#b51f24]" : "bg-obligon-green"}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-right text-xs font-extrabold text-[#3f463d]">{budgetLimit}</p>
                <p className="flex items-center gap-1 text-xs font-extrabold text-obligon-green">
                  <Pencil size={13} aria-hidden />
                  {projectedHelper}
                </p>
              </div>
              <p className="mt-2 border-t border-[#eef3ee] pt-3 text-xs font-bold text-obligon-text">
                Projected this month:{" "}
                <span className={hasProjection ? "font-extrabold text-obligon-navy" : "text-obligon-green"}>
                  {projectedSpend}
                </span>
              </p>
            </button>
            {!canEditProjection ? <a href="/customer/subscription" className="mt-3 inline-block text-xs font-bold text-obligon-green underline">Subscribe or renew to manage your fuel budget</a> : null}
          </Card>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <Card className="p-5">
            <Fuel className="text-obligon-green" size={22} />
            <p className="mt-2 text-xs font-bold uppercase text-[#3f463d]">Litres Consumed</p>
            <p className="mt-1 text-2xl font-extrabold text-obligon-navy">{litres}</p>
          </Card>
          <Card className="p-5">
            <History className="text-obligon-blue" size={22} />
            <p className="mt-2 text-xs font-bold uppercase text-[#3f463d]">Transactions</p>
            <p className="mt-1 text-2xl font-extrabold text-obligon-navy">{txnCount}</p>
          </Card>
          <Card className="p-5">
            <ShieldCheck className="text-obligon-green" size={22} />
            <p className="mt-2 text-xs font-bold uppercase text-[#3f463d]">Security Status</p>
            <p className="mt-1 text-sm font-bold text-obligon-navy flex items-center gap-2">
              <span className={`size-2 rounded-full ${cardData?.card?.status === "active" ? "bg-obligon-green" : "bg-[#939a91]"}`} /> {cardSummary}
            </p>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_282px]">
          <VehicleTable />
          <ActivityList desktop />
        </div>
      </AsyncBoundary>
    </Canvas>
  );
}

function TransactionsPage() {
  const { status: txnStatus, data: history, error: txnError, reload, refresh } = useAsync(
    () => api.getCustomerMoneyHistory()
  );
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [filters, setFilters] = React.useState({ station: "All Stations", vehicle: "All Vehicles", fuel: "All Fuels" });
  const [applied, setApplied] = React.useState(filters);
  const [selectedTxn, setSelectedTxn] = React.useState<CustomerMoneyEvent | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 5;
  const { success: toastSuccess, error: toastError } = useToast();
  const [downloadingReceipt, setDownloadingReceipt] = React.useState(false);
  // A purchase or a top-up can land while this page is open, so it settles and
  // redraws on the same tick as the wallet and the overview.
  usePolling(refresh, { intervalMs: BALANCE_POLL_MS });

  const rows = history ?? [];
  // Filter options come from dispenses only. A top-up has no vehicle and no fuel
  // type, so including them would offer a filter that can only ever return
  // nothing, and "PMS Petrol" must not match a bank transfer.
  const dispenses = rows.filter((r) => r.kind === "dispense");
  const stations = Array.from(new Set(dispenses.map((r) => r.station)));
  const vehicles = Array.from(new Set(dispenses.map((r) => r.vehicle ?? ""))).filter((v): v is string => Boolean(v));
  const fuels = Array.from(new Set(dispenses.map((r) => r.fuel ?? ""))).filter((f): f is string => Boolean(f));

  const filtered = rows.filter((row) => {
    if (applied.station !== "All Stations" && row.station !== applied.station) return false;
    if (applied.vehicle !== "All Vehicles" && (row.vehicle ?? "") !== applied.vehicle) return false;
    if (applied.fuel !== "All Fuels" && (row.fuel ?? "") !== applied.fuel) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasActiveFilters =
    applied.station !== "All Stations" || applied.vehicle !== "All Vehicles" || applied.fuel !== "All Fuels";

  function handleDownloadReceipt(txn: CustomerMoneyEvent) {
    setDownloadingReceipt(true);
    setTimeout(() => {
      const ref = txn.reference ?? `TXN-${Math.abs(hashString(txn.title + (txn.time ?? ""))).toString().slice(0, 8)}`;
      const receiptContent = `====================================================
               OBLIGON LTD OFFICIAL RECEIPT
====================================================
Reference:     ${ref}
Station:       ${txn.station}
Location:      ${txn.subtitle ?? "Main Station Hub"}
Vehicle ID:    ${txn.vehicle ?? "FLT-8492"}
Fuel Type:     ${txn.fuel ?? "Premium Diesel"}
Amount Paid:   ${txn.amount}
Timestamp:     ${txn.time ?? new Date().toLocaleString()}
Status:        APPROVED / SETTLED
Payment Card:  •••• •••• •••• 4092
Terminal ID:   POS-OBL-0842
====================================================
Thank you for powering with Obligon LTD Network.
Support: support@obligon.energy | +234 800 OBLIGON
====================================================`;

      const blob = new Blob([receiptContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Obligon_Receipt_${ref}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadingReceipt(false);
      toastSuccess(`Receipt downloaded for ${ref}`);
    }, 600);
  }

  function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
    return (
      <label className="block">
        <span className="text-xs font-extrabold uppercase text-obligon-text">{label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 h-12 w-full rounded-xl border border-[#cfd8cc] bg-white px-3 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
        >
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <AsyncBoundary
      status={txnStatus}
      error={txnError?.message ?? null}
      isEmpty={rows.length === 0}
      onRetry={reload}
      loadingLabel="Loading transactions…"
      empty={{ title: "No transactions found", message: "Your transaction history will appear here once activity is recorded." }}
    >
      <Canvas compact>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Transaction History</h1>
            <p className="mt-1 text-sm text-obligon-text">Complete ledger of fuel card dispenses and wallet top-ups.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-2 h-11 rounded-xl border border-obligon-border bg-white px-4 text-xs font-bold text-obligon-navy hover:border-obligon-green transition"
              type="button"
            >
              <SlidersHorizontal size={15} />
              Filter Records ({filtered.length})
            </button>
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl bg-[#f7fbf8] p-3 border border-obligon-border">
            <span className="text-xs font-extrabold uppercase text-obligon-text mr-2">Active Filters:</span>
            {applied.station !== "All Stations" && (
              <span className="rounded-lg bg-white border px-3 py-1 text-xs font-bold text-obligon-green">
                Station: {applied.station}
              </span>
            )}
            {applied.vehicle !== "All Vehicles" && (
              <span className="rounded-lg bg-white border px-3 py-1 text-xs font-bold text-obligon-green">
                Vehicle: {applied.vehicle}
              </span>
            )}
            {applied.fuel !== "All Fuels" && (
              <span className="rounded-lg bg-white border px-3 py-1 text-xs font-bold text-obligon-green">
                Fuel: {applied.fuel}
              </span>
            )}
            <button
              onClick={() => {
                const cleared = { station: "All Stations", vehicle: "All Vehicles", fuel: "All Fuels" };
                setFilters(cleared);
                setApplied(cleared);
                setCurrentPage(1);
              }}
              className="text-xs font-bold text-[#c1121f] hover:underline ml-2"
              type="button"
            >
              Clear all
            </button>
          </div>
        ) : null}

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead className="bg-[#f0f4f0] text-xs uppercase text-[#3f463d]">
                <tr>
                  {["Activity", "Reference", "Amount", "Balance After", "Timestamp", "Action"].map((h) => (
                    <th key={h} className="px-6 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3ee]">
                {paginated.length > 0 ? (
                  paginated.map((row) => (
                    <tr key={row.id} className="transition hover:bg-[#f7fbf8]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <MiniIcon tone={row.kind === "dispense" ? "muted" : "green"}>
                            {row.kind === "dispense" ? <Fuel size={16} /> : <WalletCards size={16} />}
                          </MiniIcon>
                          <div className="min-w-0">
                            <p className="font-extrabold text-obligon-navy">{row.title}</p>
                            {row.subtitle ? (
                              <p className="truncate text-xs text-obligon-text">{row.subtitle}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-obligon-text">
                        {row.reference ?? "—"}
                      </td>
                      <td className={`px-6 py-4 font-extrabold ${row.signedKobo >= 0 ? "text-obligon-green" : "text-obligon-navy"}`}>
                        {row.amount}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-obligon-text">
                        {row.balanceAfterLabel ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-xs text-obligon-text">{row.time}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedTxn(row)}
                          className="rounded-lg bg-obligon-mist border border-obligon-border px-3 py-1.5 text-xs font-bold text-obligon-navy hover:bg-obligon-green hover:text-white transition"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm font-bold text-obligon-text">
                      No transactions match your active filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#eef3ee] p-5 text-sm">
            <span className="text-xs font-bold text-obligon-text">
              Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} transactions
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-9 px-3 rounded-lg border border-[#cfd8cc] text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-obligon-mist"
              >
                Previous
              </button>
              <span className="text-xs font-bold text-obligon-navy px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-9 px-3 rounded-lg border border-[#cfd8cc] text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-obligon-mist"
              >
                Next
              </button>
            </div>
          </div>
        </Card>

        {/* Filter Modal */}
        {filtersOpen ? (
          <ModalFrame onClose={() => setFiltersOpen(false)}>
            <div className="p-6">
              <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Filter Transactions</h2>
              <p className="mt-1 text-sm text-obligon-text">Narrow your transaction history by station, vehicle, or fuel type.</p>
              <div className="mt-6 space-y-4">
                <Select
                  label="Station"
                  value={filters.station}
                  options={["All Stations", ...stations]}
                  onChange={(value) => setFilters((prev) => ({ ...prev, station: value }))}
                />
                <Select
                  label="Vehicle"
                  value={filters.vehicle}
                  options={["All Vehicles", ...vehicles]}
                  onChange={(value) => setFilters((prev) => ({ ...prev, vehicle: value }))}
                />
                <Select
                  label="Fuel Type"
                  value={filters.fuel}
                  options={["All Fuels", ...fuels]}
                  onChange={(value) => setFilters((prev) => ({ ...prev, fuel: value }))}
                />
              </div>
              <div className="mt-7 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const cleared = { station: "All Stations", vehicle: "All Vehicles", fuel: "All Fuels" };
                    setFilters(cleared);
                    setApplied(cleared);
                    setCurrentPage(1);
                  }}
                  className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold text-obligon-navy"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApplied(filters);
                    setCurrentPage(1);
                    setFiltersOpen(false);
                  }}
                  className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white shadow-green"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </ModalFrame>
        ) : null}

        {/* Transaction Detail & Receipt Modal */}
        {selectedTxn ? (
          <ModalFrame onClose={() => setSelectedTxn(null)}>
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-full bg-[#eef3ff] text-obligon-blue">
                  <Receipt size={24} />
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                  selectedTxn.status === "failed" || selectedTxn.status === "disputed"
                    ? "bg-[#ffe8e8] text-[#c1121f]"
                    : selectedTxn.status === "pending"
                      ? "bg-[#fff3d8] text-[#9a6300]"
                      : "bg-[#e8fbd7] text-obligon-green"
                }`}>
                  {selectedTxn.status ? selectedTxn.status.toUpperCase() : "APPROVED"}
                </span>
              </div>
              <h2 className="mt-4 font-display text-3xl font-extrabold text-obligon-navy">Transaction Receipt</h2>
              <p className="mt-1 text-xs text-obligon-text">
                Reference: <span className="font-mono font-extrabold text-obligon-navy">
                  {selectedTxn.reference ?? `TXN-${Math.abs(hashString(selectedTxn.station + (selectedTxn.time ?? ""))).toString().slice(0, 8)}`}
                </span>
              </p>

              <div className="mt-6 rounded-2xl bg-[#f7fbf8] p-5 border border-obligon-border">
                <p className="text-xs font-bold uppercase text-obligon-text">Amount Settled</p>
                <p className="mt-1 font-display text-4xl font-extrabold text-obligon-green">{selectedTxn.amount}</p>
              </div>

              <div className="mt-5 space-y-3.5 text-sm divide-y divide-[#eef3ee]">
<DetailRow label="Type" value={selectedTxn.kind === "dispense" ? "Fuel purchase" : "Wallet top-up"} />
                <DetailRow label="Merchant / Station" value={selectedTxn.station} />
                {/* Only meaningful for a purchase. Showing "Main Highway Hub" beside
                    a bank transfer would be a fabricated place of business. */}
                {selectedTxn.kind === "dispense" ? (
                  <>
                    <DetailRow label="Vehicle ID" value={selectedTxn.vehicle ?? "FLT-8492"} />
                    <DetailRow label="Fuel Type" value={selectedTxn.fuel ?? "Premium Diesel"} />
                  </>
                ) : (
                  <DetailRow label="Description" value={selectedTxn.subtitle ?? "Credited to fuel wallet"} />
                )}
                <DetailRow label="Timestamp" value={selectedTxn.time ?? "Oct 24, 14:32"} />
                {selectedTxn.balanceAfterLabel ? (
                  <DetailRow label="Balance After" value={selectedTxn.balanceAfterLabel} />
                ) : null}
                {selectedTxn.kind === "dispense" ? <DetailRow label="Card Number" value="•••• •••• •••• 4092" /> : null}
              </div>

              <div className="mt-7 flex gap-3">
                <button
                  type="button"
                  disabled={downloadingReceipt}
                  onClick={() => handleDownloadReceipt(selectedTxn)}
                  className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white shadow-green flex items-center justify-center gap-2"
                >
                  {downloadingReceipt ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  Download Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTxn(null)}
                  className="h-12 px-6 rounded-lg border border-[#20251f] font-extrabold text-obligon-navy"
                >
                  Close
                </button>
              </div>
            </div>
          </ModalFrame>
        ) : null}
      </Canvas>
    </AsyncBoundary>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 pt-3 first:pt-0">
      <span className="text-sm font-medium text-obligon-text">{label}</span>
      <span className="text-right text-sm font-extrabold text-obligon-navy">{value}</span>
    </div>
  );
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

interface CustomerCard {
  id: string;
  label?: string;
  holder?: string;
  maskedPan?: string;
  brand?: string;
  expiry?: string;
  status: string;
  dailyLimitLabel?: string;
  monthlyLimitLabel?: string;
  balanceLabel?: string;
  spendTodayLabel?: string;
}

function CardPage({
  onModal,
  refreshKey,
  onCardChange
}: {
  onModal: (modal: CustomerModalType) => void;
  refreshKey: number;
  onCardChange?: (card: CustomerCard | null) => void;
}) {
  const { success: toastSuccess, error: toastError } = useToast();
  const { user } = useSession();
  const [hasCard, setHasCard] = React.useState<boolean | null>(null);
  const [card, setCard] = React.useState<CustomerCard | null>(null);
  const [cardRequest, setCardRequest] = React.useState<CardRequest | null>(null);

  const { status: plansStatus, data: plans } = useAsync(() => api.getCardPlans());
  const [planModalOpen, setPlanModalOpen] = React.useState(false);
  const [busyPlan, setBusyPlan] = React.useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = React.useState(false);
  const [submittingDetails, setSubmittingDetails] = React.useState(false);
  const [submittedModalOpen, setSubmittedModalOpen] = React.useState(false);
  const [progressOpen, setProgressOpen] = React.useState(false);
  const [progress, setProgress] = React.useState<CardRequestProgress | null>(null);
  const [progressLoading, setProgressLoading] = React.useState(false);
  const [checkout, setCheckout] = useState<CardCheckout | null>(null);
  // A request already in flight. Checkout answers 409 when one exists, so this
  // is what turns that dead end into a choice: finish paying, or cancel.
  const [pendingResume, setPendingResume] = React.useState<{
    open: OpenCardRequest;
    attemptedPlan: CardPlan | null;
  } | null>(null);
  const [resuming, setResuming] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);

  const onCardChangeRef = React.useRef(onCardChange);
  onCardChangeRef.current = onCardChange;

  const loadRequest = React.useCallback(async () => {
    const data = await mutationsApi.getCardRequest();
    setCardRequest(data.request ?? null);
    return data.request ?? null;
  }, []);

  React.useEffect(() => {
    void Promise.all([api.request<{ card: CustomerCard | null }>("/api/customer/card"), loadRequest()])
      .then(([cardData, request]) => {
        setHasCard(Boolean(cardData.card));
        setCard(cardData.card);
        onCardChangeRef.current?.(cardData.card);
        // A paid request still needs the customer's identity details.
        if (request?.paymentStatus === "paid" && request.verificationStatus === "not_started") {
          setDetailsModalOpen(true);
        }
      })
      .catch(() => setHasCard(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // An unpaid request in flight is offered straight away rather than waiting for
  // the customer to click a plan and be told they are blocked. Without this the
  // only way to discover a pending payment is to hit the 409.
  React.useEffect(() => {
    // Returning from the processor means a payment is being confirmed right now.
    // Reading the open request during that window reports a request as still
    // awaiting payment when it has in fact just been paid, so the customer was
    // met with "You have a plan awaiting payment" immediately after paying.
    const params = new URLSearchParams(window.location.search);
    if (params.get("plan") ?? params.get("tx_ref")) return;

    let cancelled = false;
    void mutationsApi.getOpenCardRequest().then((open) => {
      if (cancelled) return;
      if (open.request && open.reference && open.canResume) {
        setPendingResume({ open, attemptedPlan: null });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Returning from the payment provider: confirm the charge, then ask for details.
  // Flutterwave redirects back with `status`, `tx_ref` and `transaction_id`; the
  // server re-verifies with the provider rather than trusting these parameters.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("plan") ?? params.get("tx_ref");
    if (!ref) return;
    const transactionId = params.get("transaction_id");
    const returnedStatus = params.get("status");

    void (async () => {
      try {
        const paid = await mutationsApi.verifyCardPayment(ref, false, transactionId);
        setCardRequest(paid.request);
        // The request is settled now, so any "awaiting payment" prompt is stale.
        // Clearing it here is what stops the customer being told they still owe
        // money on the page they land on straight after paying.
        setPendingResume(null);
        if (paid.paid) {
          setDetailsModalOpen(true);
          toastSuccess("Payment confirmed.");
        } else {
          toastError(returnedStatus === "failed" ? "That payment did not complete. Please try again." : "We could not confirm your payment yet.");
        }
      } catch (err) {
        toastError(
          err instanceof Error
            ? err.message
            : "We could not confirm your payment. Please try again."
        );
      } finally {
        window.history.replaceState({}, "", "/customer/card");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelectPlan(plan: CardPlan) {
    setBusyPlan(plan.code);
    try {
      const result = await mutationsApi.startCardCheckout(plan.code);
      setCheckout(result);
      setCardRequest(result.request);
      if (result.simulated) {
        // No processor configured locally: confirm the simulated charge so the
        // request reaches the paid state, then collect identity details.
        const paid = await mutationsApi.verifyCardPayment(result.reference, true);
        setCardRequest(paid.request);
        setPlanModalOpen(false);
        setDetailsModalOpen(true);
        toastSuccess("Payment confirmed. Complete your details to continue.");
        return;
      }
      if (result.paymentUrl) {
        window.location.assign(result.paymentUrl);
        return;
      }
      setPlanModalOpen(false);
      toastError("We could not start the payment. Please try again.");
    } catch (err) {
      // A 409 means a request is already in flight. Telling the customer only
      // that they are blocked leaves them stuck, so fetch the pending request
      // and offer the two real ways out of it.
      if (err instanceof ApiError && err.status === 409) {
        const open = await mutationsApi.getOpenCardRequest();
        if (open.request && (open.canResume || open.canCancel)) {
          setPlanModalOpen(false);
          setPendingResume({ open, attemptedPlan: plan });
          return;
        }
      }
      toastError(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setBusyPlan(null);
    }
  }

  /** Take the customer back to the payment they already started. */
  async function handleResumePending() {
    const target = pendingResume;
    if (!target?.open.reference) return;
    setResuming(true);
    try {
      const result = await mutationsApi.resumeCardCheckout(target.open.reference);
      setCheckout(result);
      setCardRequest(result.request);
      setPendingResume(null);
      if (result.simulated) {
        const paid = await mutationsApi.verifyCardPayment(result.reference, true);
        setCardRequest(paid.request);
        setDetailsModalOpen(true);
        toastSuccess("Payment confirmed. Complete your details to continue.");
        return;
      }
      if (result.paymentUrl) {
        window.location.assign(result.paymentUrl);
        return;
      }
      toastError("We could not reopen the payment. Please try again.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not reopen the payment.");
    } finally {
      setResuming(false);
    }
  }

  /** Open the tracker against the live record rather than a static description. */
  async function handleViewVerificationStatus() {
    setProgressOpen(true);
    setProgressLoading(true);
    try {
      setProgress(await mutationsApi.getCardRequestProgress());
    } catch {
      setProgress(null);
      toastError("We could not load your verification status. Please try again.");
    } finally {
      setProgressLoading(false);
    }
  }

  /**
   * Cancel the pending request. If the customer was trying to start a different
   * plan, that request is started immediately afterwards so the click they made
   * is not swallowed.
   */
  async function handleCancelPending() {
    const target = pendingResume;
    if (!target?.open.reference) return;
    setCancelling(true);
    try {
      await mutationsApi.cancelCardRequest(target.open.reference);
      const nextPlan = target.attemptedPlan;
      setPendingResume(null);
      await loadRequest();
      if (nextPlan) {
        toastSuccess("Previous request cancelled. Starting your new plan.");
        await handleSelectPlan(nextPlan);
        return;
      }
      toastSuccess("The pending plan request was cancelled.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not cancel the request.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleSubmitDetails(details: {
    fullName: string;
    bvn: string;
    address: string;
    city: string;
    state: string;
    dateOfBirth:string;postalCode:string;phone:string;
  }) {
    if (!checkout?.reference && !cardRequest?.paymentReference) return;
    setSubmittingDetails(true);
    try {
      const result = await mutationsApi.submitCardRequestDetails({
        reference: (checkout?.reference ?? cardRequest?.paymentReference) as string,
        ...details
      });
      setCardRequest(result.request);
      setDetailsModalOpen(false);
      setSubmittedModalOpen(true);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not submit your details.");
    } finally {
      setSubmittingDetails(false);
    }
  }

  const frozen = card?.status === "frozen";
  const blocked = card?.status === "blocked";

  const status = blocked
    ? { label: "BLOCKED", className: "bg-[#ffe8e8] px-3 py-1 text-xs font-extrabold text-[#c1121f]" }
    : frozen
      ? { label: "FROZEN", className: "bg-[#fff3d8] px-3 py-1 text-xs font-extrabold text-[#9a6300]" }
      : { label: "ACTIVE STATUS", className: "bg-[#e8fbd7] px-3 py-1 text-xs font-extrabold text-obligon-green" };

  const freezeLabel = frozen ? "Unfreeze Card" : "Freeze Card";
  const freezeBody = frozen ? "Resume transactions on this card" : "Temporarily lock fuel card";

  const cardActions: Array<{ title: string; body: string; Icon: ComponentType<LucideProps>; tone: CustomerTone; modal: CustomerModalType }> = [
    { title: "Replace Virtual Card", body: "Replace an empty virtual card after issuer termination", Icon: CreditCard, tone: "green", modal: "replaceCard" },
    { title: "Report Lost or Stolen", body: blocked ? "Card already permanently blocked" : "Permanently block card and report fraud", Icon: FileWarning, tone: "red", modal: "lostCard" },
    { title: freezeLabel, body: freezeBody, Icon: Snowflake, tone: "green", modal: "freezeCard" },
    { title: "Update Transaction PIN", body: "Change 4-digit authorization security code", Icon: LockKeyhole, tone: "blue", modal: "changePin" }
  ];

  return (
    <Canvas>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Card Management</h1>
        <p className="mt-1 text-obligon-text">View and manage your active Fuelvista fleet subscription card.</p>
      </div>

      {hasCard === false ? (
        <Card className="mb-8 border-obligon-green/30 bg-[#f7fbf8] p-6">
          <h2 className="font-display text-xl font-extrabold text-obligon-navy">Get your Fuelvista Card</h2>
          <p className="mt-1 text-sm text-obligon-text">
            Choose a subscription plan, pay for it, then verify your identity. We issue your card once
            verification completes.
          </p>

          {cardRequest ? (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-obligon-blue/10 px-3 py-1 text-[10px] font-extrabold uppercase text-obligon-blue">
                  {cardRequest.planName ?? "Plan"} {cardRequest.planAmountLabel ?? ""}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ${
                    cardRequest.paymentStatus === "paid"
                      ? "bg-[#e8fbd7] text-obligon-green"
                      : cardRequest.paymentStatus === "failed"
                        ? "bg-[#ffe8e8] text-[#c1121f]"
                        : "bg-[#fff3d8] text-[#9a6300]"
                  }`}
                >
                  {cardRequest.paymentStatus === "paid"
                    ? "Payment confirmed"
                    : cardRequest.paymentStatus === "failed"
                      ? "Payment failed"
                      : "Awaiting payment"}
                </span>
              </div>

              {cardRequest.paymentStatus !== "paid" ? (
                <>
                  <p className="text-sm font-bold text-obligon-navy">
                    Your {cardRequest.planName ?? "plan"} selection is waiting for payment.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPlanModalOpen(true)}
                    className="h-11 rounded-xl bg-obligon-green px-5 text-sm font-extrabold text-white"
                  >
                    {cardRequest.paymentStatus === "failed" ? "Try payment again" : "Complete payment"}
                  </button>
                </>
              ) : cardRequest.verificationStatus === "not_started" ? (
                <>
                  <p className="text-sm font-bold text-obligon-navy">
                    Payment received. Tell us who the card belongs to so we can verify you.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDetailsModalOpen(true)}
                    className="h-11 rounded-xl bg-obligon-green px-5 text-sm font-extrabold text-white"
                  >
                    Enter verification details
                  </button>
                </>
              ) : cardRequest.verificationStatus === "rejected" ? (
                <>
                  <p role="alert" className="text-sm font-bold text-red-700">Verification rejected: {cardRequest.rejectionReason ?? "Contact support for the reason"}</p>
                  <button type="button" className="h-11 rounded-xl border border-obligon-border px-5 font-bold" onClick={async () => {
                    try { await api.request("/api/customer/card-request/withdraw", { method: "POST", body: JSON.stringify({ reference: cardRequest.paymentReference, reason: "Identity application rejected" }) }); await loadRequest(); toastSuccess("Refund requested. The payment provider will process it."); } catch(e) { toastError(e instanceof Error ? e.message : "Unable to request refund"); }
                  }}>Withdraw application & request refund</button>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-obligon-navy">
                    We are verifying your details. Verification takes {cardRequest.verificationEta ?? "1-3 business days"}.
                  </p>
                  <p className="text-xs text-obligon-text">
                    Name: {cardRequest.fullName} · BVN: {cardRequest.bvnLastFour}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleViewVerificationStatus()}
                    className="h-11 rounded-xl border border-obligon-border bg-white px-5 text-sm font-extrabold text-obligon-navy"
                  >
                    View verification status
                  </button>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPlanModalOpen(true)}
              className="mt-5 h-11 rounded-xl bg-obligon-green px-5 text-sm font-extrabold text-white"
            >
              Choose a plan
            </button>
          )}
        </Card>
      ) : null}

      {planModalOpen ? (
        <CardPlanModal
          plans={plans ?? []}
          loading={plansStatus === "loading"}
          busyPlan={busyPlan}
          onSelect={(plan) => void handleSelectPlan(plan)}
          onClose={() => setPlanModalOpen(false)}
        />
      ) : null}

      {progressOpen ? (
        <CardVerificationProgressModal
          progress={progress}
          loading={progressLoading}
          onClose={() => setProgressOpen(false)}
        />
      ) : null}

      {pendingResume?.open.request && pendingResume.open.reference ? (
        <PendingPaymentModal
          request={pendingResume.open.request}
          reference={pendingResume.open.reference}
          attemptedPlanName={pendingResume.attemptedPlan?.name ?? null}
          resuming={resuming}
          cancelling={cancelling}
          onResume={() => void handleResumePending()}
          onCancel={() => void handleCancelPending()}
          onClose={() => setPendingResume(null)}
        />
      ) : null}

      {detailsModalOpen ? (
        <CardDetailsModal
          defaultName={user?.name ?? ""}
          defaultPhone={user?.phone ?? ""}
          busy={submittingDetails}
          onSubmit={(details) => void handleSubmitDetails(details)}
          onClose={() => setDetailsModalOpen(false)}
        />
      ) : null}

      {submittedModalOpen ? (
        <CardSubmittedModal
          request={cardRequest}
          eta={cardRequest?.verificationEta ?? "1-3 business days"}
          onClose={() => setSubmittedModalOpen(false)}
        />
      ) : null}

      {hasCard !== false ? <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <article
          className={`relative min-h-[290px] overflow-hidden rounded-2xl p-8 text-white shadow-xl ${
            blocked
              ? "bg-[linear-gradient(135deg,#2a0606,#1a0808)]"
              : frozen
                ? "bg-[linear-gradient(135deg,#232733,#111520)]"
                : "bg-[linear-gradient(135deg,#061958,#050816)]"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(170,248,87,.32),transparent_28%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex justify-between items-center">
              <p className="font-display text-3xl font-extrabold tracking-tight">Obligon LTD</p>
              <span className={`rounded-full ${status.className}`}>{status.label}</span>
            </div>
            <div className="mt-8">
              <p className="font-mono text-2xl tracking-[4px] text-white/90">{card?.maskedPan ?? "•••• •••• •••• ••••"}</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-white/60">CARDHOLDER NAME</p>
                  <p className="font-extrabold text-sm text-white">{card?.holder ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-white/60">DAILY SPEND LIMIT</p>
                  <p className="font-extrabold text-sm text-obligon-lime">{card?.dailyLimitLabel ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <div className="space-y-3.5">
          {cardActions.map(({ title, body, Icon, tone, modal }) => {
            const disabled = modal === "lostCard" && blocked;
            return (
              <button
                key={title}
                type="button"
                disabled={disabled}
                onClick={() => onModal(modal)}
                className={`w-full rounded-2xl border border-[#dbe2d8] bg-white p-4 text-left transition hover:border-obligon-green hover:bg-[#f7fbf8] ${
                  disabled ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <MiniIcon tone={tone}><Icon size={19} /></MiniIcon>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-extrabold text-obligon-navy">{title}</h2>
                    <p className="text-xs text-obligon-text truncate">{body}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div> : null}
    </Canvas>
  );
}

function WalletPage({
  onModal,
  balanceRefreshKey
}: {
  onModal: (modal: CustomerModalType) => void;
  balanceRefreshKey: number;
}) {
  const router = useRouter();
  // One request, not three. The balance, the ledger and the processor's record
  // of the last top-up are three views of the same wallet, and asking for them
  // separately on a 4-second poll is three round trips to render one screen.
  const {
    status: walletStatus,
    data: wallet,
    error: walletError,
    reload: reloadWallet,
    refresh: refreshWallet
  } = useAsync(() => api.getCustomerWallet(), [balanceRefreshKey]);
  const { data: topUpHistory } = useAsync(() => api.getCustomerTopUpHistory());
  // The overview carries the MTD figures the wallet page reuses, and it is a
  // separate aggregate, so it is refreshed on the same tick rather than folded
  // into the wallet response.
  const { data: overviewMetrics, refresh: refreshBalance } = useAsync(
    () => api.getCustomerOverviewMetrics(),
    [balanceRefreshKey]
  );
  // Both the balance and the ledger move when money arrives, so both are
  // refreshed together. Polling only the balance would leave the amount correct
  // and the transaction list behind it, which is its own kind of wrong.
  usePolling(() => {
    refreshBalance();
    refreshWallet();
  }, { intervalMs: BALANCE_POLL_MS });
  const desktopTopUps = wallet?.desktopTopUps ?? null;
  const topUpsStatus = walletStatus;
  const topUpsError = walletError;
  const reloadTopUps = reloadWallet;
  // Taken from the wallet response rather than the overview metric: this is the
  // same number the ledger that produced it reports, so the figure on this page
  // and the entries beneath it cannot disagree.
  const totalBalance = wallet?.balanceLabel ?? "₦0.00";
  const lastTopUp = wallet?.lastTopUp ?? null;
  // The real budget limit, or nothing. Showing a badge only when there is an
  // actual limit avoids implying a facility that was never set.
  const budgetLimit = metricHelper(overviewMetrics, "Budget Usage") ?? "";
  const budgetLabel = /Limit/i.test(budgetLimit) ? budgetLimit.replace(/\s*Limit\s*$/i, " budget") : "";
  const hasHistory = Boolean(desktopTopUps && desktopTopUps.length > 0);

  return (
    <Canvas>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Wallet Management</h1>
          <p className="mt-1 text-obligon-text">Fund your prepaid fuel balance and manage your spending.</p>
        </div>
        <button
          onClick={() => onModal("topup")}
          className="h-12 rounded-xl bg-obligon-green px-6 font-extrabold text-white shadow-green hover:bg-obligon-green/90 transition"
          type="button"
        >
          + Add Funds to Wallet
        </button>
      </div>

      <Card className="mt-8 p-8">
        <div className="flex justify-between items-center">
          <p className="text-xs font-extrabold uppercase text-obligon-text">Available Fuel Balance</p>
          {/* The real budget, not a claim about auto-recharging. The previous
              copy asserted an auto-recharge threshold that no code implemented,
              so a customer with an empty wallet was told it would be topped up
              automatically and never was. */}
          {budgetLabel ? (
            <span className="rounded-full bg-obligon-lime/30 px-3 py-1 text-xs font-extrabold text-obligon-navy">
              {budgetLabel}
            </span>
          ) : null}
        </div>
        <p className="mt-3 font-display text-5xl font-extrabold text-obligon-navy">
          {totalBalance}
        </p>
        <p className="mt-3 text-sm font-bold text-obligon-green">
          {hasHistory ? "Fund your wallet to keep paying for fuel anywhere on the network." : "Add funds to start paying for fuel."}
        </p>
        {/* What the processor says about the last payment, next to our figure.
            A customer who is told a transaction succeeded and sees nothing change
            has no way to tell a missed credit from a stale screen. Naming the
            reference, what was collected and the processor's own transaction id
            lets them check both sides of that claim. The balance itself cannot
            come from the processor: it holds no fuel balance, only payments. */}
        {/* The processor's own figure, next to ours.
            The balance above is a running total of payments the processor
            confirmed as successful, added once each — a fuel balance is not a
            thing Flutterwave holds, so it cannot be read from there. What
            Flutterwave can be asked is how much it has collected, and that is
            stated here so the two can be reconciled by eye instead of taken on
            trust. It is the sum of the charges that were actually taken, which is
            the number a customer will recognise from their bank statement. */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-obligon-border bg-[#f7fbf8] p-4">
            <p className="text-xs font-extrabold uppercase text-obligon-text">Settled with Flutterwave</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-obligon-navy">
              {wallet?.settledInLabel ?? "₦0.00"}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-obligon-text">
              {wallet?.settledCount
                ? `${wallet.settledCount} confirmed payment${wallet.settledCount === 1 ? "" : "s"}`
                : "No confirmed payments yet"}
            </p>
          </div>
          {lastTopUp ? (
            <div className="rounded-xl border border-obligon-border bg-[#f7fbf8] p-4">
              <p className="text-xs font-extrabold uppercase text-obligon-text">Last top-up</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-obligon-navy">{lastTopUp.chargedLabel}</p>
              <p className="mt-1 text-[11px] font-semibold text-obligon-text">
                <span className="font-extrabold text-obligon-navy">{lastTopUp.reference}</span>
                {" · "}
                {lastTopUp.status === "success" ? (
                  <span className="font-extrabold text-obligon-green">confirmed {lastTopUp.confirmedLabel}</span>
                ) : (
                  <span className="font-extrabold text-[#b51f24]">{lastTopUp.status}</span>
                )}
              </p>
              {lastTopUp.providerTransactionId ? (
                <p className="mt-1 text-[11px] font-semibold text-obligon-text">
                  Transaction {lastTopUp.providerTransactionId} on {lastTopUp.provider}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      {/* Only the history is gated. Previously the whole page, including the
          balance and the add-funds button, was replaced by an empty state, so a
          customer with nothing in their wallet — exactly the person who needs to
          add funds — could not reach the action at all. */}
      <AsyncBoundary
        status={topUpsStatus}
        error={topUpsError?.message ?? null}
        isEmpty={!hasHistory}
        onRetry={reloadTopUps}
        loadingLabel="Loading wallet history…"
        empty={{
          title: "No top-up history yet",
          message: "Once you add funds, your funding records will appear here.",
          action: (
            <button
              onClick={() => onModal("topup")}
              className="h-12 rounded-xl bg-obligon-green px-6 font-extrabold text-white"
              type="button"
            >
              + Add Funds to Wallet
            </button>
          )
        }}
      >
        <Card className="mt-8 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#eef3ee]">
            <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Recent Funding Records</h2>
            <button onClick={() => router.push("/customer/transactions")} className="text-sm font-bold text-obligon-green hover:underline" type="button">
              View All
            </button>
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f0f4f0] text-xs uppercase text-obligon-text">
                <tr>{["Date", "Reference", "Method", "Amount"].map((h) => <th className="px-6 py-4" key={h}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[#eef3ee]">
                {(desktopTopUps ?? []).map((row) => (
                  <tr className="hover:bg-[#f7fbf8] transition" key={row[1]}>
                    {row.map((cell, idx) => (
                      <td className={`px-6 py-4 ${idx === 3 ? "font-extrabold text-obligon-green" : "text-sm text-obligon-navy"}`} key={cell}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-[#eef3ee] lg:hidden">
            {(topUpHistory ?? []).map(([method, date, amount]) => (
              <div key={date} className="flex justify-between p-5">
                <div>
                  <p className="font-extrabold text-obligon-navy">{method}</p>
                  <p className="text-xs text-obligon-text">{date}</p>
                </div>
                <p className="font-extrabold text-obligon-green">{amount}</p>
              </div>
            ))}
          </div>
        </Card>
      </AsyncBoundary>
    </Canvas>
  );
}

function buildMapUrl(list: Array<{ lat: number; lng: number }>) {
  if (list.length === 0) return "https://www.openstreetmap.org/export/embed.html?bbox=3.30,6.45,3.45,6.60&layer=mapnik";
  const lats = list.map((item) => item.lat);
  const lngs = list.map((item) => item.lng);
  const pad = list.length === 1 ? 0.01 : 0.02;
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad;
  const maxLng = Math.max(...lngs) + pad;
  const marker = list.length === 1 ? `&marker=${list[0].lat},${list[0].lng}` : "";
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik${marker}`;
}

function StationsPage() {
  const router = useRouter();
  const [location, setLocation] = React.useState<{ lat: number; lng: number }>();
  const [locationMessage, setLocationMessage] = React.useState("Share your location to see the closest stations first.");
  const [coordinates, setCoordinates] = React.useState({ lat: "", lng: "" });
  const watchId = React.useRef<number | null>(null);
  const startLocation = React.useCallback(() => {
    if (!navigator.geolocation) { setLocationMessage("Location is unavailable. Enter coordinates below."); return; }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    setLocationMessage("Finding your location…");
    watchId.current = navigator.geolocation.watchPosition(({ coords }) => {
      setLocation({ lat: coords.latitude, lng: coords.longitude });
      setLocationMessage("Closest stations first · distances are in a straight line.");
    }, () => { setLocation(undefined); setLocationMessage("Location could not be obtained. Enable location access or enter coordinates below."); },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }, []);
  React.useEffect(() => {
    let active = true;
    navigator.permissions?.query({ name: "geolocation" }).then(result => {
      if (active && result.state === "granted") startLocation();
    }).catch(() => {});
    return () => { active = false; if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
  }, [startLocation]);
  const { status, data: stations, error, reload, refresh } = useAsync(() => api.getStations(location), [location?.lat, location?.lng]);
  const refreshRef = React.useRef(refresh);
  refreshRef.current = refresh;
  React.useEffect(() => {
    const update = () => { if (document.visibilityState === "visible") refreshRef.current(); };
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  const [query, setQuery] = React.useState("");
  const [fuelsOpen, setFuelsOpen] = React.useState(false);
  const [selectedFuels, setSelectedFuels] = React.useState<string[]>([]);
  const [detail, setDetail] = React.useState<{ name: string; address: string; distance: string; hours?: string; diesel?: string; unleaded?: string; fuels?: string[] } | null>(null);
  const [directionTarget, setDirectionTarget] = React.useState<{ name: string; address: string; distance: string } | null>(null);

  const allFuels = Array.from(new Set(stations?.flatMap((station) => station.fuels) ?? []));

  const visible = stations?.filter((station) => {
    const matchesQuery =
      query.trim() === "" ||
      station.name.toLowerCase().includes(query.toLowerCase()) ||
      station.address.toLowerCase().includes(query.toLowerCase());
    const matchesFuel = selectedFuels.length === 0 || selectedFuels.some((fuel) => station.fuels.includes(fuel));
    return matchesQuery && matchesFuel;
  }) ?? [];

  return (
    <>
      <div className="mb-4 rounded-xl border border-[#dbe2d8] bg-white p-4">
        <p role="status" className="text-sm text-obligon-text">{locationMessage}</p>
        <button type="button" onClick={startLocation} className="mt-2 font-bold text-obligon-green">Use my location</button>
        <details className="mt-2 text-sm">
          <summary>Set location manually</summary>
          <form className="mt-2 flex flex-wrap gap-2" onSubmit={e => {
            e.preventDefault();
            if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
            setLocation({ lat: Number(coordinates.lat), lng: Number(coordinates.lng) });
            setLocationMessage("Closest stations first · using your selected location.");
          }}>
            <label>Latitude<input required type="number" step="any" min="-90" max="90" value={coordinates.lat} onChange={e => setCoordinates({ ...coordinates, lat: e.target.value })} className="mx-2 w-36 rounded border p-2" /></label>
            <label>Longitude<input required type="number" step="any" min="-180" max="180" value={coordinates.lng} onChange={e => setCoordinates({ ...coordinates, lng: e.target.value })} className="mx-2 w-36 rounded border p-2" /></label>
            <button type="submit" className="font-bold text-obligon-green">Find closest stations</button>
          </form>
        </details>
      </div>
    <AsyncBoundary
      status={status}
      error={error?.message ?? null}
      isEmpty={!stations || stations.length === 0}
      onRetry={reload}
      loadingLabel="Loading station network…"
      empty={{ title: "No stations found", message: "Station locations will appear here." }}
    >
      <Canvas>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-[#dbe2d8] bg-white p-3">
            <MapPinned size={18} className="text-obligon-green shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-obligon-navy outline-none"
              placeholder="Search by station name, street or city..."
            />
          </div>
          <button
            onClick={() => setFuelsOpen(true)}
            className="h-12 rounded-xl bg-obligon-green px-5 font-bold text-white shadow-green hover:bg-obligon-green/90 transition text-sm"
            type="button"
          >
            {selectedFuels.length > 0 ? `Fuels (${selectedFuels.length})` : "Filter Fuels"}
          </button>
        </div>

        {selectedFuels.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-obligon-text">Filtering:</span>
            {selectedFuels.map((fuel) => (
              <button
                key={fuel}
                type="button"
                onClick={() => setSelectedFuels((prev) => prev.filter((f) => f !== fuel))}
                className="rounded-full bg-[#e8fbd7] px-3 py-1 text-xs font-bold text-obligon-green"
              >
                {fuel} ✕
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedFuels([])}
              className="text-xs font-bold text-[#c1121f] hover:underline ml-2"
            >
              Reset
            </button>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <Card className="relative min-h-[500px] overflow-hidden bg-[#dfe8ed]">
            <StationMap
              points={visible.flatMap(st => st.lat !== null && st.lng !== null ? [{ id: st.id ?? st.name, name: st.name, lat: st.lat, lng: st.lng }] : [])}
              onSelect={(point) => router.push(`/customer/stations?station=${encodeURIComponent(point.name)}`)}
              height="h-[500px]"
            />
          </Card>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {visible.map((st) => (
              <Card key={st.id ?? st.name} className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-obligon-navy">{st.name}</h3>
                    <p className="text-xs font-bold text-obligon-green">{st.distanceKm != null ? `${st.distance} away` : "Distance unavailable"} • {st.hours}</p>
                    <p className="text-xs text-obligon-text mt-1">{st.address}</p>
                  </div>
                  <MiniIcon tone="green"><MapPinned size={18} /></MiniIcon>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDirectionTarget({ name: st.name, address: st.address, distance: st.distance })}
                    className="h-9 flex-1 rounded-lg bg-obligon-green text-xs font-bold text-white"
                  >
                    Directions
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetail(st)}
                    className="h-9 flex-1 rounded-lg border border-[#cfd8cc] text-xs font-bold text-obligon-navy"
                  >
                    Station Details
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Station Detail Modal */}
        {detail ? (
          <ModalFrame onClose={() => setDetail(null)}>
            <div className="p-6 sm:p-8">
              <h2 className="font-display text-3xl font-extrabold text-obligon-navy">{detail.name}</h2>
              <p className="mt-1 text-sm text-obligon-text">{detail.address}</p>
              <p className="mt-1 text-xs font-bold text-obligon-green">{detail.distance} away • {detail.hours}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#f7fbf8] p-4">
                  <p className="text-xs font-bold uppercase text-obligon-text">Diesel (AGO)</p>
                  <p className="mt-1 font-extrabold text-xl text-obligon-navy">{detail.diesel}</p>
                </div>
                <div className="rounded-xl bg-[#f7fbf8] p-4">
                  <p className="text-xs font-bold uppercase text-obligon-text">Petrol (PMS)</p>
                  <p className="mt-1 font-extrabold text-xl text-obligon-navy">{detail.unleaded}</p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const target = { name: detail.name, address: detail.address, distance: detail.distance };
                    setDetail(null);
                    setDirectionTarget(target);
                  }}
                  className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white"
                >
                  Get Directions
                </button>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="h-12 px-6 rounded-lg border border-[#20251f] font-extrabold"
                >
                  Close
                </button>
              </div>
            </div>
          </ModalFrame>
        ) : null}

        {/* Directions Modal */}
        {directionTarget ? (
          <ModalFrame onClose={() => setDirectionTarget(null)}>
            <div className="p-6 sm:p-8">
              <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Route Directions</h2>
              <p className="mt-1 text-sm text-obligon-text">Navigating to {directionTarget.name}</p>
              <div className="mt-4 rounded-xl bg-[#f7fbf8] p-4 space-y-2 text-sm font-bold text-obligon-navy">
                <p>📍 Destination: {directionTarget.address}</p>
                <p>📏 Distance: {directionTarget.distance}</p>
                <p>⏱️ Estimated arrival: ~8 mins</p>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionTarget.address)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-obligon-green font-extrabold text-white shadow-green"
              >
                Open in Google Maps ↗
              </a>
            </div>
          </ModalFrame>
        ) : null}
      </Canvas>
    </AsyncBoundary>
    </>
  );
}

function SupportPage({ onModal }: { onModal: (modal: CustomerModalType) => void }) {
  type Ticket = { id: string; reference: string; subject: string; status: string };
  type Message = { id: string; role: string; body: string; time: string; sender: string };
  const { error: toastError } = useToast();
  const [chatOpen, setChatOpen] = React.useState(false);
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [ticketId, setTicketId] = React.useState("");
  const [ticketStatus, setTicketStatus] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [inputMsg, setInputMsg] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const loadTickets = React.useCallback(async () => {
    const data = await api.request<{ tickets: Ticket[] }>("/api/customer/support/tickets");
    setTickets(data.tickets);
    return data.tickets;
  }, []);
  React.useEffect(() => {
    if (!chatOpen) return;
    setLoading(true);
    setLoadError(null);
    void loadTickets().catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load support requests.")).finally(() => setLoading(false));
  }, [chatOpen, loadTickets]);

  React.useEffect(() => {
    if (!chatOpen || !ticketId) { setMessages([]); return; }
    let active = true;
    async function loadMessages() {
      try {
        const data = await api.request<{ messages: Message[]; status: string }>(`/api/customer/support/tickets/${ticketId}/messages`);
        if (active) { setMessages(data.messages); setTicketStatus(data.status); setLoadError(null); }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load messages.");
      }
    }
    void loadMessages();
    const timer = setInterval(() => void loadMessages(), 10000);
    return () => { active = false; clearInterval(timer); };
  }, [chatOpen, ticketId]);

  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    const body = inputMsg.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      let id = ticketId;
      if (!id) {
        const result = await api.request<{ ticketId: string; reference: string; status: string }>("/api/customer/support/tickets", {
          method: "POST", body: JSON.stringify({ subject: body.slice(0, 100), category: "general", message: body })
        });
        id = result.ticketId;
        setTicketId(id);
        setTicketStatus(result.status);
      } else {
        await api.request(`/api/customer/support/tickets/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) });
      }
      setInputMsg("");
      const data = await api.request<{ messages: Message[]; status: string }>(`/api/customer/support/tickets/${id}/messages`);
      setMessages(data.messages);
      setTicketStatus(data.status);
      await loadTickets();
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Your message could not be sent. Please try again.");
    } finally { setSending(false); }
  }

  return (
    <Canvas>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Customer Support Center</h1>
        <p className="mt-1 text-obligon-text">Billing, card, and transaction assistance.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <MessageCircle className="text-obligon-green" size={28} />
          <h2 className="mt-4 font-display text-2xl font-extrabold text-obligon-navy">Support Messages</h2>
          <p className="mt-1 text-sm text-obligon-text">Send a request and follow real replies from the support team. Messages are saved to your account.</p>
          <button onClick={() => setChatOpen(true)} className="mt-6 h-11 rounded-xl bg-obligon-green px-5 text-sm font-bold text-white" type="button">Open Support Messages</button>
        </Card>
        <Card className="p-6">
          <AlertTriangle className="text-[#c1121f]" size={28} />
          <h2 className="mt-4 font-display text-2xl font-extrabold text-obligon-navy">Transaction Dispute</h2>
          <p className="mt-1 text-sm text-obligon-text">File an official report regarding pump discrepancy or double charges.</p>
          <button onClick={() => onModal("report")} className="mt-6 h-11 rounded-xl bg-[#20251f] px-5 text-sm font-bold text-white" type="button">File Issue Report</button>
        </Card>
      </div>
      {chatOpen ? (
        <ModalFrame onClose={() => setChatOpen(false)}>
          <div className="flex h-[560px] flex-col">
            <div className="border-b border-[#eef3ee] bg-[#f7fbf8] p-4">
              <h2 className="text-sm font-extrabold text-obligon-navy">Support Messages</h2>
              <label htmlFor="support-ticket" className="sr-only">Support request</label>
              <select id="support-ticket" value={ticketId} disabled={sending || loading} onChange={(e) => { setTicketId(e.target.value); setMessages([]); setTicketStatus(""); }} className="mt-2 w-full rounded-lg border p-2 text-sm">
                <option value="">New support request</option>
                {tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.reference} — {ticket.subject}</option>)}
              </select>
              <p className="mt-2 text-xs text-obligon-text">{ticketId ? `Request ${ticketStatus || "loading"}. Replies appear here when the team responds.` : "Your first message opens a support request. The team will reply here."}</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
              {loadError ? <p role="alert" className="text-sm text-[#c1121f]">{loadError}</p> : null}
              {loading ? <p className="text-sm text-obligon-text">Loading requests…</p> : null}
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "customer" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${message.role === "customer" ? "bg-obligon-green text-white" : "bg-[#f0f4f0] text-obligon-navy"}`}>
                    <p className="mb-1 text-xs font-bold">{message.role === "customer" ? "You" : message.sender}</p>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <span className="mt-1 block text-right text-[10px] opacity-70">{message.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} className="flex gap-2 border-t border-[#eef3ee] bg-white p-3">
              <label htmlFor="support-message" className="sr-only">Message</label>
              <input id="support-message" value={inputMsg} disabled={sending} maxLength={4000} onChange={(e) => setInputMsg(e.target.value)} placeholder="Type your message…" className="h-11 min-w-0 flex-1 rounded-xl border border-[#cfd8cc] px-4 text-sm" />
              <button aria-label="Send message" disabled={sending || !inputMsg.trim()} type="submit" className="h-11 rounded-xl bg-obligon-green px-4 font-bold text-white disabled:opacity-50">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
            </form>
          </div>
        </ModalFrame>
      ) : null}
    </Canvas>
  );
}

function ProfilePage({ onModal }: { onModal: (modal: CustomerModalType) => void }) {
  const { user, updateProfile } = useSession();
  const { success: toastSuccess, error: toastError } = useToast();
  const router = useRouter();

  const { status: profileStatus, data: profile, error: profileError, reload } = useAsync(
    () => api.getCustomerProfile()
  );

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushAvailable, setPushAvailable] = useState(true);

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [hydrated, setHydrated] = useState(false);

  // Seed the form from the server once, so we never show a hardcoded default
  // that disagrees with what is actually stored.
  React.useEffect(() => {
    if (!profile || hydrated) return;
    setName(profile.user.name ?? "");
    setEmail(profile.user.email ?? "");
    setPhone(profile.user.phone ?? "");
    setAddress(profile.user.address ?? "");
    setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...(profile.user.notificationPrefs ?? {}) });
    setHydrated(true);
  }, [profile, hydrated]);

  // Reflect the browser's real push state so the toggle cannot claim push is on
  // when the browser has never been subscribed.
  React.useEffect(() => {
    let active = true;
    setPushAvailable(pushSupported());
    void currentPushState().then((state) => {
      if (!active) return;
      if (state.permission === "denied") setPushAvailable(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const twoFactor = Boolean(profile?.user.twoFactorEnabled);

  async function savePrefs(next: NotificationPrefs, message = "Notification preferences updated.") {
    const previous = prefs;
    setPrefs(next);
    setPrefsSaving(true);
    try {
      await mutationsApi.updateProfile({ notificationPrefs: next });
      updateProfile({ notificationPrefs: next });
      toastSuccess(message);
      return true;
    } catch (err) {
      setPrefs(previous);
      toastError(err instanceof Error ? err.message : "Could not save your notification preferences.");
      return false;
    } finally {
      setPrefsSaving(false);
    }
  }

  async function handleToggle(channel: "inApp" | "email" | "sms" | "push", next: boolean) {
    const previous = prefs;

    if (channel === "push") {
      if (!pushAvailable) {
        toastError("Push notifications are blocked or unsupported in this browser.");
        return;
      }
      setPushBusy(true);
      try {
        const state = next ? await enableWebPush() : await disableWebPush();
        const result = await savePrefs(
          { ...previous, push: next },
          state.reason ?? (next ? "Mobile push notifications enabled." : "Mobile push notifications disabled.")
        );
        if (result === false) setPrefs(previous);
      } finally {
        setPushBusy(false);
      }
      return;
    }

    if (channel === "sms" && next && !(profile?.user.phoneVerified ?? false)) {
      toastError("Verify your phone number before enabling SMS alerts.");
      return;
    }

    await savePrefs({ ...previous, [channel]: next });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await mutationsApi.updateProfile({ fullName: name, phone, address });
      updateProfile({ name, phone, address });
      toastSuccess("Profile information updated successfully.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }


  return (
    <AsyncBoundary
      status={profileStatus}
      error={profileError?.message ?? null}
      onRetry={reload}
      loadingLabel="Loading your profile…"
    >
      <Canvas>
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <Card className="p-6 sm:p-8">
          <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Profile &amp; Settings</h1>
          <p className="mt-1 text-sm text-obligon-text">Manage your personal details and communication preferences.</p>

          <form onSubmit={handleSave} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-extrabold uppercase text-obligon-text">Full Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-extrabold uppercase text-obligon-text">Email Address</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-extrabold uppercase text-obligon-text">Phone Number</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-extrabold uppercase text-obligon-text">Primary Address</span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                  required
                />
              </label>
            </div>

            <div className="pt-6 border-t border-[#eef3ee]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-extrabold text-obligon-navy">Notification Preferences</h2>
                {prefsSaving ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-obligon-text">
                    <Loader2 size={12} className="animate-spin" /> Saving
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-obligon-text">
                Choose how Obligon LTD reaches you. Changes save immediately.
              </p>

              <div className="mt-4 space-y-3">
                {(
                  [
                    { key: "inApp" as const, label: "In-App Notifications", description: "Activity and alerts inside the dashboard." },
                    { key: "email" as const, label: "Email Transaction Receipts & Statements", description: "Receipts, statements and monthly summaries." },
                    {
                      key: "sms" as const,
                      label: "Instant SMS Dispatch Alerts",
                      description: profile?.user.phoneVerified
                        ? "Time-sensitive alerts to your verified number."
                        : "Verify your phone number to enable SMS alerts."
                    },
                    {
                      key: "push" as const,
                      label: "Mobile Push Notifications",
                      description: !pushAvailable
                        ? "Blocked or unsupported in this browser. Enable it in your browser site settings."
                        : pushBusy
                          ? "Contacting your browser…"
                          : "Real-time alerts on this device, even when the dashboard is closed."
                    }
                  ] as const
                ).map((row) => (
                  <div key={row.key} className="rounded-xl border border-obligon-border bg-[#f7fbf8] p-3.5">
                    <Toggle
                      label={row.label}
                      description={row.description}
                      checked={prefs[row.key]}
                      disabled={prefsSaving || (row.key === "push" && pushBusy) || (row.key === "sms" && !profile?.user.phoneVerified)}
                      onCheckedChange={(next) => void handleToggle(row.key, next)}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-obligon-border bg-white p-3.5">
                <p className="text-xs font-bold text-obligon-navy">Alert Categories</p>
                <p className="mt-1 text-[11px] leading-4 text-obligon-text">
                  Turn off whole categories you never want to hear about.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {Object.keys(prefs.categories).map((category) => (
                    <Toggle
                      key={category}
                      label={category.charAt(0).toUpperCase() + category.slice(1)}
                      checked={prefs.categories[category]}
                      disabled={prefsSaving}
                      onCheckedChange={(next) => {
                        const categories = { ...prefs.categories, [category]: next };
                        setPrefs((current) => ({ ...current, categories }));
                        void mutationsApi
                          .updateProfile({ notificationPrefs: { ...prefs, categories } })
                          .then(() => toastSuccess("Notification preferences updated."))
                          .catch((err) => {
                            setPrefs((current) => ({ ...current, categories: prefs.categories }));
                            toastError(err instanceof Error ? err.message : "Could not save your preferences.");
                          });
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              disabled={saving}
              type="submit"
              className="mt-6 h-12 rounded-xl bg-obligon-green px-8 font-extrabold text-white shadow-green hover:bg-obligon-green/90 transition flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : "Save Changes"}
            </button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-xl font-extrabold text-obligon-navy">Security Settings</h2>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => onModal("changePassword")}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-obligon-border hover:bg-[#f7fbf8] transition text-left"
              >
                <div className="flex items-center gap-3">
                  <LockKeyhole size={18} className="text-obligon-green" />
                  <div>
                    <p className="text-xs font-extrabold text-obligon-navy">Change Password</p>
                    <p className="text-[11px] text-obligon-text">Update your account password</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-obligon-text" />
              </button>

              <button
                type="button"
                onClick={() => onModal("changePin")}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-obligon-border hover:bg-[#f7fbf8] transition text-left"
              >
                <div className="flex items-center gap-3">
                  <CreditCard size={18} className="text-obligon-green" />
                  <div>
                    <p className="text-xs font-extrabold text-obligon-navy">Transaction PIN</p>
                    <p className="text-[11px] text-obligon-text">Update 4-digit card authorization PIN</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-obligon-text" />
              </button>

              <button
                type="button"
                onClick={() => onModal("twoFactor")}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-obligon-border hover:bg-[#f7fbf8] transition text-left"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-obligon-green" />
                  <div>
                    <p className="text-xs font-extrabold text-obligon-navy">Two-Factor Authentication</p>
                    <p className="text-[11px] text-obligon-text">
                      {twoFactor ? "Enabled — a code is required at sign-in" : "Add a verification code at sign-in"}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                    twoFactor ? "bg-[#e8fbd7] text-obligon-green" : "bg-[#f0f4f0] text-obligon-text"
                  }`}
                >
                  {twoFactor ? "ON" : "OFF"}
                </span>
              </button>

              <div className="rounded-xl border border-obligon-border p-3.5">
                <p className="text-sm font-bold text-obligon-navy">Biometric Sign-In — Coming soon</p>
                <p className="mt-1 text-xs text-obligon-text">Biometric transaction approval is not yet available. Use your password, card PIN, and two-factor authentication.</p>
              </div>
            </div>

            <button
              onClick={() => setLogoutOpen(true)}
              className="mt-6 h-11 w-full rounded-xl border border-[#c1121f] text-[#c1121f] font-bold hover:bg-[#ffecef] transition text-xs"
              type="button"
            >
              Sign Out of Account
            </button>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => router.push(routes.logout)}
        title="Sign out of Obligon?"
        message="Are you sure you want to log out of your session on this device?"
        confirmLabel="Log Out"
        tone="red"
      />
      </Canvas>
    </AsyncBoundary>
  );
}

function NotificationsPage() {
  const { status, data: notifications, error, reload } = useAsync(() => api.getNotifications());
  const { success: toastSuccess, error: toastError } = useToast();
  const [readItems, setReadItems] = useState<Set<string>>(new Set());

  function handleMarkAll() {
    const all = new Set((notifications ?? []).map((n) => n.title));
    setReadItems(all);
    toastSuccess("All notifications marked as read.");
  }

  return (
    <AsyncBoundary
      status={status}
      error={error?.message ?? null}
      isEmpty={!notifications || notifications.length === 0}
      onRetry={reload}
      loadingLabel="Loading notifications…"
      empty={{ title: "No notifications", message: "You're all caught up. Alerts will appear here." }}
    >
      <Canvas>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Notifications</h1>
            <p className="mt-1 text-obligon-text">Security alerts, transaction confirmations, and system notices.</p>
          </div>
          <button
            onClick={handleMarkAll}
            className="h-10 rounded-xl border border-obligon-border bg-white px-4 text-xs font-bold text-obligon-green hover:bg-obligon-mist transition"
            type="button"
          >
            Mark all as read
          </button>
        </div>

        <Card className="overflow-hidden divide-y divide-[#eef3ee]">
          {(notifications ?? []).map((n) => {
            const isRead = readItems.has(n.title);
            return (
              <article
                key={n.title}
                onClick={() => setReadItems((prev) => new Set(prev).add(n.title))}
                className={`flex items-start gap-4 p-5 transition cursor-pointer ${isRead ? "bg-white opacity-70" : "bg-[#f7fbf8]"}`}
              >
                <MiniIcon tone={n.title.includes("Security") ? "red" : "green"}>
                  <Bell size={18} />
                </MiniIcon>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-extrabold text-obligon-navy">{n.title}</h2>
                    <span className="text-xs text-obligon-text">{n.time}</span>
                  </div>
                  <p className="text-xs text-obligon-text mt-1">{n.body}</p>
                </div>
              </article>
            );
          })}
        </Card>
      </Canvas>
    </AsyncBoundary>
  );
}

export function CustomerScreen({ pageKey }: { pageKey: CustomerPageKey }) {
  const [modal, setModal] = React.useState<CustomerModalType>(null);
  const { data: subscription, refresh: refreshSubscription } = useAsync(
    () => api.request<CustomerEntitlementState>("/api/customer/subscription")
  );
  usePolling(refreshSubscription, { intervalMs: BALANCE_POLL_MS });
  const canEditProjection = customerFeatureAvailable(subscription, "Fuel Budget Management");
  const [cardStatus, setCardStatus] = React.useState<string | null>(null);
  const [cardRefreshKey, setCardRefreshKey] = React.useState(0);
  const [balanceRefreshKey, setBalanceRefreshKey] = React.useState(0);
  // The projection lives here rather than in the overview page because the
  // prompt has to be able to open from any customer page: a new account lands on
  // the overview, but someone who signs in straight to their wallet should be
  // asked there too.
  const { data: projection, refresh: refreshProjection } = useAsync(
    () => api.getCustomerSpendProjection()
  );
  // Which month the prompt has already been raised for this session. Without it
  // the modal reopens on every navigation, because a customer who chose "Not
  // now" would be asked again the moment they closed it. Setting a projection
  // clears the need entirely, since the server then reports one exists.
  const [promptedForMonth, setPromptedForMonth] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!canEditProjection || !projection?.needsProjection) return;
    // Never displace something the customer opened deliberately.
    if (modal) return;
    if (promptedForMonth === projection.month) return;
    setPromptedForMonth(projection.month);
    setModal("spendProjection");
  }, [projection, modal, promptedForMonth, canEditProjection]);

  const handleTopUpSuccess = () => {
    setBalanceRefreshKey((key) => key + 1);
  };

  const handleCardStatusChange = () => {
    setCardRefreshKey((key) => key + 1);
  };

  const handleSpendProjectionSaved = () => {
    // The MTD Spend card reads its bar from the overview response, so the card
    // and the saved figure have to be refreshed together or the bar would still
    // show the old projection until the next page load.
    setBalanceRefreshKey((key) => key + 1);
    void refreshProjection();
  };

  const openSpendProjection = React.useCallback(() => {
    if (canEditProjection) setModal("spendProjection");
  }, [canEditProjection]);

  const pages: Record<CustomerPageKey, React.ReactNode> = {
    overview: <OverviewPage balanceRefreshKey={balanceRefreshKey} onEditProjection={openSpendProjection} canEditProjection={canEditProjection} />,
    transactions: <TransactionsPage />,
    card: <CardPage onModal={setModal} refreshKey={cardRefreshKey} onCardChange={(card) => setCardStatus(card?.status ?? null)} />,
    wallet: <WalletPage onModal={setModal} balanceRefreshKey={balanceRefreshKey} />,
    stations: <StationsPage />,
    support: <SupportPage onModal={setModal} />,
    transactionDetail: <TransactionsPage />,
    reportProblem: <SupportPage onModal={setModal} />,
    profile: <ProfilePage onModal={setModal} />,
    notifications: <NotificationsPage />
  };

  return (
    <>
      {pages[pageKey]}
      <CustomerModals
        modal={modal === "spendProjection" && !canEditProjection ? null : modal}
        onClose={() => setModal(null)}
        onTwoFactorChange={() => setModal(null)}
        cardFrozen={cardStatus === "frozen"}
        onCardFrozenChange={handleCardStatusChange}
        cardBlocked={cardStatus === "blocked"}
        onCardBlockedChange={handleCardStatusChange}
        onTopUpSuccess={handleTopUpSuccess}
        spendProjection={projection}
        onSpendProjectionSaved={handleSpendProjectionSaved}
      />
    </>
  );
}
