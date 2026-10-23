"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SubscriptionPanel } from "@/components/shared/SubscriptionPanel";
import { sellingUnitLabel } from "../../../../packages/shared/partner-access.mjs";
import { CustomerFuelCheckout } from "./CustomerFuelCheckout";
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
import { stationFuelName } from "@/lib/station-fuels";
import { customerCardPresentation, customerReceiptRows, customerReceiptText, customerWalletHint } from "@/lib/customer-presentation";
import {
  type CustomerPageKey,
  type CustomerTone
} from "@/lib/mock/customer-data";
import { api, mutationsApi, DEFAULT_NOTIFICATION_PREFS, ApiError, type CardCheckout, type CardPlan, type CardRequest, type CardRequestProgress, type CustomerMoneyEvent, type CustomerTransaction, type NotificationPrefs, type OpenCardRequest } from "@/lib/services";
import { AsyncBoundary } from "@/components/shared/States";
import { useAsync } from "@/components/shared/useAsync";
import { usePolling } from "@/components/shared/usePolling";
import { DashboardSearchQuery } from "@/components/shared/DashboardSearchQuery";
import type { Station } from "@/lib/services/types";
import { useSession } from "@/components/shared/AuthContext";
import { useToast } from "@/components/shared/Toast";
import { Toggle } from "@/components/shared/Toggle";
import { currentPushState, disableWebPush, enableWebPush, type PushState } from "@/lib/push-subscription";
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
  return <section className={`mx-auto w-full max-w-[1440px] min-w-0 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-8 sm:pt-8 lg:px-12 lg:pb-12 ${compact ? "lg:pt-8" : "lg:pt-10"}`}>{children}</section>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <article className={`min-w-0 rounded-2xl border border-obligon-border bg-white ${className}`}>{children}</article>;
}

function MiniIcon({ tone = "green", children }: { tone?: CustomerTone; children: React.ReactNode }) {
  return <span className={`grid size-10 place-items-center rounded-full ${toneClasses[tone]}`}>{children}</span>;
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl text-obligon-navy">{title}</h2>
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6 border-b border-[#eef3ee]">
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl text-obligon-navy">Vehicle Performance</h2>
          <button onClick={() => router.push("/customer/transactions")} className="text-sm font-extrabold text-obligon-green hover:underline" type="button">
            View All
          </button>
        </div>
        <div tabIndex={0} role="region" aria-label="Vehicle performance table, scroll horizontally to see all columns" className="overflow-x-auto overscroll-x-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-obligon-green">
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
                <tr key={id} className="hover:bg-obligon-mist/60 transition">
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6 border-b border-[#eef3ee]">
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl text-obligon-navy">{desktop ? "Recent Activity" : "Recent Transactions"}</h2>
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
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.link || "/customer/transactions")}
              className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-obligon-mist/60 transition"
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
            </button>
          ))}
        </div>
      </Card>
    </AsyncBoundary>
  );
}

function metricValue(metrics: { label: string; value: string; helper?: string }[] | null, label: string, fallback = "N/A") {
  return metrics?.find((item) => item.label === label)?.value ?? fallback;
}

function metricHelper(metrics: { label: string; value: string; helper?: string }[] | null, label: string) {
  return metrics?.find((item) => item.label === label)?.helper;
}

function OverviewPage({ balanceRefreshKey }: { balanceRefreshKey: number }) {
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
  const totalBalance = metricValue(metrics, "Total Account Balance", "₦0.00");
  const mtdSpend = metricValue(metrics, "MTD Spend", "₦0.00");
  const mtdSpendHelper = metricHelper(metrics, "MTD Spend") ?? "";
  // Overview summarizes spend; subscription access and budget editing live in My Card.
  const projectedSpend = metricValue(metrics, "Projected Spend", "Not set");
  const projectedHelper = "Manage in My Card";
  const budgetUsage = metricValue(metrics, "Budget Usage", "-");
  const budgetLimit = metricHelper(metrics, "Budget Usage") ?? "Not set";
  const litres = metricValue(metrics, "Fuel quantities", metricValue(metrics, "Litres Consumed", "No quantity recorded"));
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
      <div className="mb-6 lg:hidden"><h2 className="font-display text-2xl font-bold tracking-tight text-obligon-navy">Overview</h2><p className="mt-2 text-sm text-obligon-text">Your balance and recent activity.</p></div>

      <AsyncBoundary
        status={status}
        error={error?.message ?? null}
        isEmpty={!metrics || metrics.length === 0}
        onRetry={reload}
        loadingLabel="Loading overview…"
        empty={{ title: "No overview data", message: "Account metrics will appear here once available." }}
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="flex flex-col justify-between p-5 sm:p-6">
            <div className="flex justify-between items-center">
              <p className="text-xs font-semibold uppercase tracking-[0.8px] text-[#3f463d]">Total Account Balance</p>
              <WalletCards size={22} className="text-obligon-green" />
            </div>
            <p className="mt-4 font-display break-words text-[36px] font-bold leading-tight tracking-tight text-obligon-navy sm:text-[44px] xl:text-[52px]">
              {totalBalance}
            </p>
            <div className="mt-6 border-t border-obligon-border pt-4">
              <p className="text-sm text-obligon-text">Manage your balance and fuel card.</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href="/customer/wallet" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-obligon-green px-4 text-sm font-semibold text-white">Open Wallet</Link>
                <Link href="/customer/card" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-obligon-border px-4 text-sm font-semibold text-obligon-navy">Manage My Card</Link>
              </div>
            </div>
          </Card>
          {/* Keep the spend summary available to everyone and send edits to My Card. */}
          <Card className="p-6 text-left">
            <button
              type="button"
              onClick={() => router.push("/customer/card")}
              className="block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-obligon-green"
              aria-label="Manage your fuel budget in My Card"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.8px] text-[#3f463d]">MTD Spend</p>
                {mtdSpendHelper ? (
                  <p className="text-xs font-semibold text-obligon-text">{mtdSpendHelper}</p>
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
          </Card>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <Card className="p-5">
            <Fuel className="text-obligon-green" size={22} />
            <p className="mt-2 text-xs font-bold uppercase text-[#3f463d]">Fuel quantities</p>
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

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
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
  const receiptLinkConsumed = React.useRef<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [query, setQuery] = React.useState("");
  const pageSize = 5;
  const { success: toastSuccess, error: toastError } = useToast();
  const [downloadingReceipt, setDownloadingReceipt] = React.useState(false);
  // A purchase or a top-up can land while this page is open, so it settles and
  // redraws on the same tick as the wallet and the overview.
  usePolling(refresh, { intervalMs: BALANCE_POLL_MS });

  React.useEffect(() => {
    if (!history) return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id || receiptLinkConsumed.current === id) return;
    receiptLinkConsumed.current = id;
    setSelectedTxn(history.find(row => row.id === id) ?? null);
  }, [history]);
  const rows = history ?? [];
  // Filter options come from dispenses only. A top-up has no vehicle and no fuel
  // type, so including them would offer a filter that can only ever return
  // nothing, and "PMS Petrol" must not match a bank transfer.
  const dispenses = rows.filter((r) => r.kind === "dispense");
  const stations = Array.from(new Set(dispenses.map((r) => r.station)));
  const vehicles = Array.from(new Set(dispenses.map((r) => r.vehicle ?? ""))).filter((v): v is string => Boolean(v));
  const fuels = Array.from(new Set(dispenses.map((r) => r.fuel ?? ""))).filter((f): f is string => Boolean(f));

  const filtered = rows.filter((row) => {
    if (query.trim() && ![row.reference, row.title, row.subtitle, row.station, row.vehicle, row.fuel].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase())) return false;
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
    try {
      const blob = new Blob([customerReceiptText(txn)], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Obligon_Receipt_${(txn.reference || txn.id).replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toastSuccess("Receipt downloaded.");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Could not download this receipt.");
    } finally {
      setDownloadingReceipt(false);
    }
  }

  function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
    return (
      <label className="block">
        <span className="text-xs font-semibold uppercase text-obligon-text">{label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 h-12 w-full rounded-xl border border-obligon-border bg-white px-3 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
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
        <DashboardSearchQuery onSearch={value => {
          setQuery(value); setCurrentPage(1);
          if (value) {
            const cleared = { station: "All Stations", vehicle: "All Vehicles", fuel: "All Fuels" };
            setFilters(cleared); setApplied(cleared);
          }
        }} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-obligon-navy">Transaction History</h2>
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

        <label className="mb-5 block max-w-lg text-sm font-bold text-obligon-navy">Search transactions
          <input type="search" value={query} maxLength={254} onChange={event => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Reference, station, vehicle or fuel" className="mt-2 h-12 w-full rounded-xl border border-obligon-border bg-white px-3 text-sm font-medium outline-none focus:border-obligon-green" />
        </label>

        {hasActiveFilters ? (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl bg-obligon-mist/60 p-3 border border-obligon-border">
            <span className="text-xs font-semibold uppercase text-obligon-text mr-2">Active Filters:</span>
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
          <p className="border-b border-obligon-border bg-obligon-mist/60 px-5 py-3 text-xs leading-5 text-obligon-text xl:hidden">Scroll horizontally to view amounts, balances and receipts.</p>
          <div tabIndex={0} role="region" aria-label="Transaction history table, scroll horizontally to see all columns" className="overflow-x-auto overscroll-x-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-obligon-green">
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
                    <tr key={row.id} className="transition hover:bg-obligon-mist/60">
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
                        {row.reference ?? "N/A"}
                      </td>
                      <td className={`whitespace-nowrap px-6 py-4 font-extrabold tabular-nums ${row.signedKobo >= 0 ? "text-obligon-green" : "text-obligon-navy"}`}>
                        {row.amount}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-bold tabular-nums text-obligon-text">
                        {row.balanceAfterLabel ?? "N/A"}
                      </td>
                      <td className="px-6 py-4 text-xs text-obligon-text">{row.time}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedTxn(row)}
                          className="min-h-11 whitespace-nowrap rounded-lg bg-obligon-mist border border-obligon-border px-3 py-2 text-sm font-semibold text-obligon-navy hover:bg-obligon-green hover:text-white transition"
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
                className="min-h-11 px-3 rounded-lg border border-obligon-border text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-obligon-mist"
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
                className="min-h-11 px-3 rounded-lg border border-obligon-border text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-obligon-mist"
              >
                Next
              </button>
            </div>
          </div>
        </Card>

        {/* Filter Modal */}
        {filtersOpen ? (
          <ModalFrame title="Filter transactions" onClose={() => setFiltersOpen(false)}>
            <div className="p-6">
              <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl text-obligon-navy">Filter Transactions</h2>
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
                  className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white shadow-none"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </ModalFrame>
        ) : null}

        {/* Transaction Detail & Receipt Modal */}
        {selectedTxn ? (
          <ModalFrame title="Transaction receipt" onClose={() => setSelectedTxn(null)}>
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
                  {selectedTxn.status ? selectedTxn.status.toUpperCase() : "UNKNOWN"}
                </span>
              </div>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl text-obligon-navy">Transaction Receipt</h2>
              <p className="mt-1 text-xs text-obligon-text">
                {selectedTxn.reference ? "Reference" : "Record ID"}: <span className="font-mono font-extrabold text-obligon-navy">
                  {selectedTxn.reference ?? selectedTxn.id}
                </span>
              </p>

              <div className="mt-6 rounded-2xl bg-obligon-mist/60 p-5 border border-obligon-border">
                <p className="text-xs font-bold uppercase text-obligon-text">Recorded Amount</p>
                <p className="mt-1 font-display text-4xl font-extrabold text-obligon-green">{selectedTxn.amount}</p>
              </div>

              <div className="mt-5 space-y-3.5 text-sm divide-y divide-[#eef3ee]">
                {customerReceiptRows(selectedTxn)
                  .filter(([label]) => !["Record ID", "Reference", "Status", "Amount"].includes(label))
                  .map(([label, value]) => <DetailRow key={label} label={label} value={value} />)}
              </div>

              <div className="mt-7 flex gap-3">
                <button
                  type="button"
                  disabled={downloadingReceipt}
                  onClick={() => handleDownloadReceipt(selectedTxn)}
                  className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white shadow-none flex items-center justify-center gap-2"
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
  onCardChange,
  subscription,
  onSubscriptionChange,
  canEditProjection,
  projectionLabel,
  onEditProjection
}: {
  onModal: (modal: CustomerModalType) => void;
  refreshKey: number;
  onCardChange?: (card: CustomerCard | null) => void;
  subscription: CustomerEntitlementState | null;
  onSubscriptionChange: () => void;
  canEditProjection: boolean;
  projectionLabel: string;
  onEditProjection: () => void;
}) {
  const { success: toastSuccess, error: toastError } = useToast();
  const { user } = useSession();
  function requestClosed(request: CardRequest | null) {
    return Boolean(request && (["cancelled", "withdrawn", "refunded"].includes(request.status) ||
      request.paymentStatus === "refunded" || request.issuanceState === "refund_pending"));
  }
  function requestNeedsDetails(request: CardRequest | null) {
    return Boolean(request && !requestClosed(request) && request.paymentStatus === "paid" &&
      request.verificationStatus === "not_started" && (!request.issuanceState || request.issuanceState === "not_started"));
  }
  const [hasCard, setHasCard] = React.useState<boolean | null>(null);
  const [card, setCard] = React.useState<CustomerCard | null>(null);
  const [cardRequest, setCardRequest] = React.useState<CardRequest | null>(null);
  const [cardLoading, setCardLoading] = React.useState(true);
  const [cardLoadError, setCardLoadError] = React.useState("");
  const [openRequestError, setOpenRequestError] = React.useState("");
  const [cardLoadRevision, setCardLoadRevision] = React.useState(0);

  const { status: plansStatus, data: plans, error: plansError, reload: reloadPlans } = useAsync(() => api.getCardPlans());
  const [planModalOpen, setPlanModalOpen] = React.useState(false);
  const [preferredPlan,setPreferredPlan]=React.useState<string>();
  React.useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get("chosenPlan") ?? sessionStorage.getItem("obligon_selected_plan");
    if (plan) {
      setPreferredPlan(plan);
      sessionStorage.removeItem("obligon_selected_plan");
    }
  }, []);
  React.useEffect(() => {
    if (preferredPlan && hasCard === false) setPlanModalOpen(true);
  }, [preferredPlan, hasCard]);
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
  const [withdrawing, setWithdrawing] = React.useState(false);
  const withdrawalInFlight = React.useRef(false);
  const [refundInfo, setRefundInfo] = React.useState<{
    requestId: string; status: string | null; reviewRequired: boolean; message: string | null;
  } | null>(null);
  const [refundChecking, setRefundChecking] = React.useState(false);
  const [refundCheckError, setRefundCheckError] = React.useState("");
  const [refundCheckRevision, setRefundCheckRevision] = React.useState(0);

  const onCardChangeRef = React.useRef(onCardChange);
  onCardChangeRef.current = onCardChange;

  const loadRequest = React.useCallback(async () => {
    const data = await mutationsApi.getCardRequest();
    setCardRequest(data.request ?? null);
    return data.request ?? null;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setCardLoading(true);
    setCardLoadError("");
    void Promise.allSettled([api.request<{ card: CustomerCard | null }>("/api/customer/card"), mutationsApi.getCardRequest()])
      .then(([cardResult, requestResult]) => {
        if (cancelled) return;
        if (cardResult.status === "fulfilled") {
          const loadedCard = cardResult.value.card;
          // Do not offer a new plan when the absence of an existing request is unknown.
          setHasCard(loadedCard ? true : requestResult.status === "fulfilled" ? false : null);
          setCard(loadedCard);
          onCardChangeRef.current?.(loadedCard);
        }
        const request = requestResult.status === "fulfilled" ? requestResult.value.request ?? null : null;
        if (requestResult.status === "fulfilled") setCardRequest(request);
        // Closed requests cannot resume payment or identity collection, even
        // when their historical payment remains recorded as paid.
        if (requestResult.status === "fulfilled") setDetailsModalOpen(requestNeedsDetails(request));
        const failures = [cardResult, requestResult].filter((result) => result.status === "rejected");
        setCardLoadError(failures.map((result) => result.status === "rejected" && result.reason instanceof Error ? result.reason.message : "Could not load your card and request status.").join(" "));
        setCardLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setCardLoadError(error instanceof Error ? error.message : "Could not load your card and request status.");
        setCardLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, cardLoadRevision]);

  const closedRequest = requestClosed(cardRequest);
  const hasRefundRequest = Boolean(cardRequest && (cardRequest.issuanceState === "refund_pending" ||
    ["withdrawn", "refunded"].includes(cardRequest.status) || cardRequest.paymentStatus === "refunded"));
  React.useEffect(() => {
    const reference = cardRequest?.paymentReference;
    const requestId = cardRequest?.id;
    if (!hasRefundRequest || !reference || !requestId) return;
    let cancelled = false;
    setRefundChecking(true);
    setRefundCheckError("");
    void api.request<{ refund: { status: string; kind: string } | null }>(`/api/customer/card-request/refund?reference=${encodeURIComponent(reference)}`)
      .then(({ refund }) => {
        // A completed partial/excess refund does not settle this withdrawal.
        if (!cancelled) setRefundInfo((current) => ({ requestId,
          status: refund?.kind === "full" ? refund.status : current?.requestId === requestId ? current.status : null,
          reviewRequired: current?.requestId === requestId ? current.reviewRequired : false,
          message: current?.requestId === requestId ? current.message : null }));
      }).catch(() => {
        if (!cancelled) setRefundCheckError("Could not check the latest refund status. Check again or contact Support.");
      }).finally(() => {
        if (!cancelled) setRefundChecking(false);
      });
    return () => { cancelled = true; };
  }, [cardRequest?.id, cardRequest?.paymentReference, hasRefundRequest, refundCheckRevision]);

  // An unpaid request in flight is offered straight away rather than waiting for
  // the customer to click a plan and be told they are blocked. Without this the
  // only way to discover a pending payment is to hit the 409.
  React.useEffect(() => {
    // Returning from the processor means a payment is being confirmed right now.
    // Reading the open request during that window reports a request as still
    // awaiting payment when it has in fact just been paid, so the customer was
    // met with "You have a plan awaiting payment" immediately after paying.
    const params = new URLSearchParams(window.location.search);
    if (params.get("plan") ?? params.get("tx_ref") ?? params.get("paymentFlow")) return;

    let cancelled = false;
    setOpenRequestError("");
    void mutationsApi.getOpenCardRequest().then((open) => {
      if (cancelled) return;
      if (open.request && !requestClosed(open.request) && open.reference && open.canResume) {
        setPendingResume({ open, attemptedPlan: null });
      }
    }).catch((error) => {
      if (!cancelled) setOpenRequestError(error instanceof Error ? error.message : "Could not check your pending card payment.");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, cardLoadRevision]);

  // Returning from the payment provider: confirm the charge, then ask for details.
  // Flutterwave redirects back with `status`, `tx_ref` and `transaction_id`; the
  // server re-verifies with the provider rather than trusting these parameters.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("paymentFlow")) return;
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
        if (requestClosed(paid.request)) {
          setDetailsModalOpen(false);
          toastSuccess("This application is closed. Check the application and refund status below.");
        } else if (paid.paid) {
          setDetailsModalOpen(requestNeedsDetails(paid.request));
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
      if (requestClosed(result.request)) {
        setPlanModalOpen(false);
        toastError("This application is closed. Check its status before choosing another plan.");
        return;
      }
      if (result.simulated) {
        // No processor configured locally: confirm the simulated charge so the
        // request reaches the paid state, then collect identity details.
        const paid = await mutationsApi.verifyCardPayment(result.reference, true);
        setCardRequest(paid.request);
        setPlanModalOpen(false);
        setDetailsModalOpen(paid.paid && requestNeedsDetails(paid.request));
        if (requestClosed(paid.request)) toastSuccess("This application is closed. Check its status below.");
        else if (paid.paid) toastSuccess("Payment confirmed. Complete your details to continue.");
        else toastError("We could not confirm your payment yet.");
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
        try {
          const open = await mutationsApi.getOpenCardRequest();
          if (open.request && !requestClosed(open.request) && (open.canResume || open.canCancel)) {
            setPlanModalOpen(false);
            setPendingResume({ open, attemptedPlan: plan });
            return;
          }
        } catch (lookupError) {
          toastError(lookupError instanceof Error ? lookupError.message : "Could not check your pending card payment. Retry loading your card.");
          setOpenRequestError(lookupError instanceof Error ? lookupError.message : "Could not check your pending card payment.");
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
    if (!target?.open.reference || requestClosed(target.open.request)) return;
    setResuming(true);
    try {
      const result = await mutationsApi.resumeCardCheckout(target.open.reference);
      setCheckout(result);
      setCardRequest(result.request);
      setPendingResume(null);
      if (requestClosed(result.request)) {
        setDetailsModalOpen(false);
        toastError("This application is closed. Check its status before choosing another plan.");
        return;
      }
      if (result.simulated) {
        const paid = await mutationsApi.verifyCardPayment(result.reference, true);
        setCardRequest(paid.request);
        setDetailsModalOpen(paid.paid && requestNeedsDetails(paid.request));
        if (requestClosed(paid.request)) toastSuccess("This application is closed. Check its status below.");
        else if (paid.paid) toastSuccess("Payment confirmed. Complete your details to continue.");
        else toastError("We could not confirm your payment yet.");
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
    if (requestClosed(cardRequest) || (!checkout?.reference && !cardRequest?.paymentReference)) return;
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

  async function handleWithdrawApplication() {
    if (!cardRequest?.paymentReference || requestClosed(cardRequest) || withdrawalInFlight.current) return;
    withdrawalInFlight.current = true;
    setWithdrawing(true);
    try {
      const result = await api.request<{ request: CardRequest; message?: string; reviewRequired?: boolean; refundStatus?: string }>(
        "/api/customer/card-request/withdraw", { method: "POST", body: JSON.stringify({ reference: cardRequest.paymentReference, reason: "Identity application rejected" }) }
      );
      const message = result.message ?? (result.refundStatus === "succeeded"
        ? "Your withdrawal refund has been confirmed by the payment provider."
        : result.reviewRequired
          ? "Your withdrawal is recorded. The refund needs support review and has not been confirmed as paid."
          : "Your withdrawal is recorded. The refund has not yet been confirmed.");
      const request = result.request ?? { ...cardRequest, issuanceState: "refund_pending" };
      setCardRequest(request);
      setRefundInfo({ requestId: request.id, status: result.refundStatus ?? null, reviewRequired: result.reviewRequired === true, message });
      setDetailsModalOpen(false);
      setProgressOpen(false);
      setPendingResume(null);
      toastSuccess(message);
      try { await loadRequest(); }
      catch { setCardLoadError("Your withdrawal is recorded, but we could not refresh the application. Retry loading your card for the latest status."); }
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Could not confirm your withdrawal. Check the request status before trying again.");
    } finally {
      withdrawalInFlight.current = false;
      setWithdrawing(false);
    }
  }

  const currentRefund = refundInfo?.requestId === cardRequest?.id ? refundInfo : null;
  const refundConfirmed = Boolean(cardRequest?.paymentStatus === "refunded" ||
    (cardRequest && ["refunded"].includes(cardRequest.status)) || currentRefund?.status === "succeeded");
  const refundReviewRequired = !refundConfirmed && (currentRefund?.reviewRequired || ["failed", "review_required"].includes(currentRefund?.status ?? ""));
  const refundMessage = refundConfirmed ? "Your refund has been confirmed by the payment provider."
    : refundReviewRequired ? currentRefund?.reviewRequired && currentRefund.message
      ? currentRefund.message : "The refund needs support review and has not been confirmed as paid."
      : currentRefund?.message ?? "The refund has not yet been confirmed. Check Notifications for updates or contact Support.";

  const frozen = card?.status === "frozen";
  const blocked = card?.status === "blocked";

  const cardPresentation = customerCardPresentation(card?.status);
  const status = {
    label: cardPresentation.label,
    className: `px-3 py-1 text-xs font-extrabold ${toneClasses[cardPresentation.tone as CustomerTone]}`,
  };

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
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-obligon-navy">Card Management</h2>
        <p className="mt-1 text-obligon-text">View your Fuelvista card status and manage your subscription.</p>
      </div>

      {cardLoading ? <p role="status" className="mb-6 text-sm text-obligon-text">{hasCard === null ? "Loading your card and request status…" : "Refreshing your card and request status…"}</p> : null}
      {cardLoadError || openRequestError ? <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p>{cardLoadError || openRequestError}</p>
        <p className="mt-1">Your latest card or payment request status could not be checked.</p>
        <button type="button" disabled={cardLoading} onClick={() => setCardLoadRevision((revision) => revision + 1)} className="mt-3 min-h-11 rounded-lg border border-current px-4 font-bold disabled:opacity-50">Retry loading card</button>
      </div> : null}

      {hasCard === false ? (
        <Card className="mb-8 border-obligon-green/30 bg-obligon-mist/60 p-6">
          <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl text-obligon-navy">Get your Fuelvista Card</h2>
          <p className="mt-1 text-sm text-obligon-text">
            Choose a subscription plan, pay for it, then verify your identity. We issue your card once
            verification completes.
          </p>

          {cardRequest ? (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-obligon-blue/10 px-3 py-1 text-xs font-semibold uppercase text-obligon-blue">
                  {cardRequest.planName ?? "Plan"} {cardRequest.planAmountLabel ?? ""}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                    closedRequest
                      ? refundConfirmed ? "bg-[#e8fbd7] text-obligon-green" : "bg-[#fff3d8] text-[#9a6300]"
                      : cardRequest.paymentStatus === "paid"
                      ? "bg-[#e8fbd7] text-obligon-green"
                      : cardRequest.paymentStatus === "failed"
                        ? "bg-[#ffe8e8] text-[#c1121f]"
                        : "bg-[#fff3d8] text-[#9a6300]"
                  }`}
                >
                  {closedRequest
                    ? refundConfirmed ? "Refund confirmed" : hasRefundRequest ? "Refund not confirmed" : "Application closed"
                    : cardRequest.paymentStatus === "paid"
                    ? "Payment confirmed"
                    : cardRequest.paymentStatus === "failed"
                      ? "Payment failed"
                      : "Awaiting payment"}
                </span>
              </div>

              {closedRequest ? (
                <>
                  <p className="text-sm font-bold text-obligon-navy">
                    {["cancelled"].includes(cardRequest.status) ? "This card application was cancelled."
                      : ["withdrawn"].includes(cardRequest.status) ? "This card application was withdrawn."
                      : "This card application is closed."}
                  </p>
                  <p className="text-sm text-obligon-text">Payment and identity verification cannot continue for this request.</p>
                  {hasRefundRequest ? (
                    <>
                      <p role={refundReviewRequired ? "alert" : "status"} className="text-sm text-obligon-text">{refundMessage}</p>
                      {refundCheckError ? <p role="alert" className="text-sm text-red-700">{refundCheckError}</p> : null}
                      <button type="button" disabled={refundChecking} onClick={() => setRefundCheckRevision((revision) => revision + 1)} className="min-h-11 rounded-xl border border-obligon-border px-4 text-sm font-bold disabled:opacity-50">
                        {refundChecking ? "Checking refund status…" : "Check refund status"}
                      </button>
                    </>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <a href="/customer/notifications" className="inline-flex min-h-11 items-center text-sm font-bold text-obligon-navy underline">Notifications</a>
                    <a href="/customer/support" className="inline-flex min-h-11 items-center text-sm font-bold text-obligon-navy underline">Contact Support</a>
                    <button type="button" onClick={() => setPlanModalOpen(true)} className="min-h-11 rounded-xl border border-obligon-border px-4 text-sm font-bold">Choose another plan</button>
                  </div>
                </>
              ) : cardRequest.paymentStatus !== "paid" ? (
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
              ) : requestNeedsDetails(cardRequest) ? (
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
                  <button type="button" disabled={withdrawing} className="h-11 rounded-xl border border-obligon-border px-5 font-bold disabled:opacity-50" onClick={handleWithdrawApplication}>
                    {withdrawing ? "Recording withdrawal…" : "Withdraw application & request refund"}
                  </button>
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
          plans={[...(plans ?? [])].sort((a,b)=>Number(b.code===preferredPlan)-Number(a.code===preferredPlan))}
          loading={plansStatus === "loading"}
          error={plansError?.message ?? null}
          onRetry={reloadPlans}
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

      {pendingResume?.open.request && !requestClosed(pendingResume.open.request) && pendingResume.open.reference ? (
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

      {detailsModalOpen && !closedRequest ? (
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

      {hasCard === true ? <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <article
          className={`relative min-h-[260px] overflow-hidden rounded-2xl p-5 text-white shadow-sm sm:min-h-[290px] sm:p-8 ${
            blocked
              ? "bg-[linear-gradient(135deg,#2a0606,#1a0808)]"
              : frozen
                ? "bg-[linear-gradient(135deg,#232733,#111520)]"
                : "bg-[linear-gradient(135deg,#061958,#050816)]"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(170,248,87,.32),transparent_28%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Obligon LTD</p>
              <span className={`rounded-full ${status.className}`}>{status.label}</span>
            </div>
            <div className="mt-8">
              <p className="break-words font-mono text-lg tracking-[2px] text-white/90 sm:text-2xl sm:tracking-[4px]">{card?.maskedPan ?? "•••• •••• •••• ••••"}</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase font-bold tracking-wider text-white/60">CARDHOLDER NAME</p>
                  <p className="font-extrabold text-sm text-white">{card?.holder ?? "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase font-bold tracking-wider text-white/60">DAILY SPEND LIMIT</p>
                  <p className="font-extrabold text-sm text-obligon-lime">{card?.dailyLimitLabel ?? "N/A"}</p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <div className="space-y-3.5">
          {cardActions.map(({ title, body, Icon, tone, modal }) => {
            const disabled = modal === "freezeCard" ? !cardPresentation.canFreeze
              : modal === "changePin" ? !cardPresentation.canChangePin
              : modal === "lostCard" ? !cardPresentation.canReportLost
              : modal === "replaceCard" ? !cardPresentation.canReplace : false;
            return (
              <button
                key={title}
                type="button"
                disabled={disabled}
                onClick={() => onModal(modal)}
                className={`w-full rounded-2xl border border-obligon-border bg-white p-4 text-left transition hover:border-obligon-green hover:bg-obligon-mist/60 ${
                  disabled ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <MiniIcon tone={tone}><Icon size={19} /></MiniIcon>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-extrabold text-obligon-navy">{title}</h2>
                    <p className="mt-1 text-xs leading-5 text-obligon-text">{body}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div> : null}

      {hasCard === true ? (
        <section id="subscription" className="mt-8 scroll-mt-24">
          <SubscriptionPanel kind="customer" embedded preferredPlan={preferredPlan} onSubscriptionChange={onSubscriptionChange} />
        </section>
      ) : null}

      <Card className="mt-8 p-6">
        <SectionTitle title="Fuel Budget" />
        <p className="mt-2 text-sm text-obligon-text">Set your projected fuel spend for this month and track it in Overview.</p>
        <p className="mt-4 text-2xl font-extrabold text-obligon-navy">{projectionLabel}</p>
        <button type="button" disabled={!canEditProjection} onClick={onEditProjection} className="mt-4 rounded-xl bg-obligon-green px-5 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">
          Set or change projected spend
        </button>
        {!canEditProjection ? <p className="mt-3 text-sm text-obligon-text">Choose or renew a plan that includes Fuel Budget Management to use this feature.</p> : null}
      </Card>

      <CustomerFuelCheckout subscriptionActive={subscription?.active === true} refreshKey={refreshKey} embedded />
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
  const [walletLoadedAt, setWalletLoadedAt] = React.useState<number | null>(null);
  React.useEffect(() => { if (wallet) setWalletLoadedAt(Date.now()); }, [wallet]);
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
  const unknownBalanceLabel = walletStatus === "loading" ? "Loading balance…" : "Balance unavailable";
  const totalBalance = wallet?.balanceLabel ?? unknownBalanceLabel;
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
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-obligon-navy">Wallet Management</h2>
          <p className="mt-1 text-obligon-text">Fund your prepaid fuel balance and manage your spending.</p>
        </div>
        <button
          onClick={() => onModal("topup")}
          className="h-12 rounded-xl bg-obligon-green px-6 font-extrabold text-white shadow-none hover:bg-obligon-green/90 transition"
          type="button"
        >
          + Add Funds to Wallet
        </button>
      </div>

      <Card className="mt-8 p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-obligon-text">Available Fuel Balance</p>
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
        <p className="mt-3 break-words font-display text-[clamp(1.5rem,7vw,3rem)] font-extrabold leading-tight text-obligon-navy sm:text-5xl">
          {totalBalance}
        </p>
        <p className="mt-3 text-sm font-bold text-obligon-green">
          {customerWalletHint(wallet?.balanceKobo)}
        </p>
        {walletError ? <div role="alert" className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          <p>{wallet ? "Showing your last known balance. We could not refresh the latest balance." : "We could not load your balance. Check again before making a fuel payment."}{walletLoadedAt ? ` Last updated ${new Date(walletLoadedAt).toLocaleString("en-NG")}.` : ""}</p>
          <button type="button" onClick={reloadWallet} className="mt-3 min-h-11 rounded-lg border border-current px-4 font-bold">Retry wallet balance</button>
        </div> : null}
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
          <div className="rounded-xl border border-obligon-border bg-obligon-mist/60 p-4">
            <p className="text-xs font-semibold uppercase text-obligon-text">Settled with Flutterwave</p>
            <p className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl text-obligon-navy">
              {wallet?.settledInLabel ?? (walletStatus === "loading" ? "Loading payments…" : "Payments unavailable")}
            </p>
            <p className="mt-1 text-xs font-semibold text-obligon-text">
              {!wallet ? "Confirmed payment history has not loaded." : wallet.settledCount
                ? `${wallet.settledCount} confirmed payment${wallet.settledCount === 1 ? "" : "s"}`
                : "No confirmed payments yet"}
            </p>
          </div>
          {lastTopUp ? (
            <div className="rounded-xl border border-obligon-border bg-obligon-mist/60 p-4">
              <p className="text-xs font-semibold uppercase text-obligon-text">Last top-up</p>
              <p className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl text-obligon-navy">{lastTopUp.chargedLabel}</p>
              <p className="mt-1 text-xs font-semibold text-obligon-text">
                <span className="font-extrabold text-obligon-navy">{lastTopUp.reference}</span>
                {" · "}
                {lastTopUp.status === "success" ? (
                  <span className="font-extrabold text-obligon-green">confirmed {lastTopUp.confirmedLabel}</span>
                ) : (
                  <span className="font-extrabold text-[#b51f24]">{lastTopUp.status}</span>
                )}
              </p>
              {lastTopUp.providerTransactionId ? (
                <p className="mt-1 text-xs font-semibold text-obligon-text">
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
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl text-obligon-navy">Recent Funding Records</h2>
            <button onClick={() => router.push("/customer/transactions")} className="text-sm font-bold text-obligon-green hover:underline" type="button">
              View All
            </button>
          </div>
          <div tabIndex={0} role="region" aria-label="Wallet history table, scroll horizontally to see all columns" className="hidden overflow-x-auto overscroll-x-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-obligon-green lg:block">
            <table className="w-full text-left">
              <thead className="bg-[#f0f4f0] text-xs uppercase text-obligon-text">
                <tr>{["Date", "Reference", "Method", "Amount"].map((h) => <th className="px-6 py-4" key={h}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[#eef3ee]">
                {(desktopTopUps ?? []).map((row) => (
                  <tr className="hover:bg-obligon-mist/60 transition" key={row[1]}>
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
            {(desktopTopUps ?? []).map(([date, reference, method, amount]) => (
              <div key={reference} className="flex flex-wrap justify-between gap-3 p-5">
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
  const [query, setQuery] = React.useState("");
  const { status, data: stations, error, reload, refresh } = useAsync(() => {
    if (!query.trim()) return api.getStations(location);
    const params = new URLSearchParams({ search: query.trim() });
    if (location) { params.set("lat", String(location.lat)); params.set("lng", String(location.lng)); }
    return api.request<{ stations: Station[] }>(`/api/customer/stations?${params}`).then(result => result.stations);
  }, [query, location?.lat, location?.lng]);
  const refreshRef = React.useRef(refresh);
  refreshRef.current = refresh;
  React.useEffect(() => {
    const update = () => { if (document.visibilityState === "visible") refreshRef.current(); };
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  const [fuelsOpen, setFuelsOpen] = React.useState(false);
  const [selectedFuels, setSelectedFuels] = React.useState<string[]>([]);
  const [detail, setDetail] = React.useState<{ name: string; address: string; distance: string; distanceKm?: number | null; hours?: string; diesel?: string; unleaded?: string; fuels?: string[]; prices?: Array<{fuelType:string;priceLabel:string;sellingUnit:"litre"|"kg"|"scm"}> } | null>(null);
  const [directionTarget, setDirectionTarget] = React.useState<{ name: string; address: string; distance: string } | null>(null);

  const allFuels = Array.from(new Set(stations?.flatMap((station) => station.fuels.map(stationFuelName)) ?? []));

  const visible = stations?.filter((station) => {
    const matchesQuery =
      query.trim() === "" ||
      station.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      station.address.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFuel = selectedFuels.length === 0 || station.fuels.some((fuel) => selectedFuels.includes(stationFuelName(fuel)));
    return matchesQuery && matchesFuel;
  }) ?? [];

  return (
    <Canvas>
      <div className="mb-6"><h2 className="font-display text-2xl font-bold tracking-tight text-obligon-navy">Find a station</h2><p className="mt-2 text-sm text-obligon-text">Search locations, view fuel prices and get directions.</p></div>
      <DashboardSearchQuery onSearch={value => { setQuery(value); if (value) setSelectedFuels([]); }} />
      <div className="mb-4 rounded-xl border border-obligon-border bg-white p-4">
        <p role="status" className="text-sm text-obligon-text">{locationMessage}</p>
        <button type="button" onClick={startLocation} className="mt-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-obligon-green">Use my location</button>
        <details className="mt-2 text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-medium">Set location manually</summary>
          <form className="mt-2 flex flex-wrap gap-2" onSubmit={e => {
            e.preventDefault();
            if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
            setLocation({ lat: Number(coordinates.lat), lng: Number(coordinates.lng) });
            setLocationMessage("Closest stations first · using your selected location.");
          }}>
            <label>Latitude<input required type="number" step="any" min="-90" max="90" value={coordinates.lat} onChange={e => setCoordinates({ ...coordinates, lat: e.target.value })} className="mx-2 min-h-11 w-36 rounded-lg border border-obligon-border p-2" /></label>
            <label>Longitude<input required type="number" step="any" min="-180" max="180" value={coordinates.lng} onChange={e => setCoordinates({ ...coordinates, lng: e.target.value })} className="mx-2 min-h-11 w-36 rounded-lg border border-obligon-border p-2" /></label>
            <button type="submit" className="min-h-11 rounded-lg px-3 font-semibold text-obligon-green">Find closest stations</button>
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
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-obligon-border bg-white p-3">
            <MapPinned size={18} className="text-obligon-green shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={254}
              className="w-full bg-transparent text-sm text-obligon-navy outline-none"
              placeholder="Search by station name, street or city..."
              aria-label="Search stations"
            />
          </div>
          <button
            onClick={() => setFuelsOpen(true)}
            className="h-12 rounded-xl bg-obligon-green px-5 font-bold text-white shadow-none hover:bg-obligon-green/90 transition text-sm"
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

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
          <div aria-label="Available stations" className="grid gap-4 sm:grid-cols-2 xl:max-h-[560px] xl:grid-cols-1 xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
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
                    className="min-h-11 flex-1 rounded-lg bg-obligon-green text-xs font-bold text-white"
                  >
                    Directions
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetail(st)}
                    className="min-h-11 flex-1 rounded-lg border border-obligon-border text-xs font-bold text-obligon-navy"
                  >
                    Station Details
                  </button>
                </div>
              </Card>
            ))}
          </div>
          <Card className="h-fit overflow-hidden p-4">
            <h2 className="mb-3 text-sm font-semibold text-obligon-navy">Station map</h2>
            <StationMap
              points={visible.flatMap(st => st.lat !== null && st.lng !== null ? [{ id: st.id ?? st.name, name: st.name, lat: st.lat, lng: st.lng }] : [])}
              onSelect={(point) => setDetail(visible.find(st => (st.id ?? st.name) === point.id) ?? null)}
              height="h-[260px] sm:h-[320px] xl:h-[360px]"
            />
          </Card>

        </div>

        {fuelsOpen && <ModalFrame title="Filter stations by fuel" onClose={() => setFuelsOpen(false)}><div className="p-6"><h2 className="text-2xl font-bold">Filter by fuel</h2>{allFuels.map(fuel => <label key={fuel} className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={selectedFuels.includes(fuel)} onChange={e => setSelectedFuels(prev => e.target.checked ? [...prev, fuel] : prev.filter(f => f !== fuel))} />{fuel}</label>)}<button type="button" className="mt-4 min-h-12 rounded-lg bg-obligon-green px-6 font-bold text-white" onClick={() => setFuelsOpen(false)}>Show stations</button></div></ModalFrame>}
        {!visible.length && <p role="status">No stations match your search. Clear the filters to see all available stations.</p>}
        {/* Station Detail Modal */}
        {detail ? (
          <ModalFrame title="Station details" onClose={() => setDetail(null)}>
            <div className="p-6 sm:p-8">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-obligon-navy">{detail.name}</h2>
              <p className="mt-1 text-sm text-obligon-text">{detail.address}</p>
              <p className="mt-1 text-xs font-bold text-obligon-green">{detail.distanceKm != null ? `${detail.distance} away` : "Distance unavailable"} • {detail.hours}</p>

              {detail.prices ? <div className="mt-6 grid gap-3 sm:grid-cols-2">{detail.prices.length ? detail.prices.map(price => <div key={price.fuelType} className="rounded-xl bg-obligon-mist/60 p-4"><p className="text-xs font-bold text-obligon-text">{price.fuelType}</p><p className="mt-1 text-xl font-extrabold text-obligon-navy">{price.priceLabel} / {sellingUnitLabel(price.sellingUnit)}</p></div>) : <p className="text-sm text-obligon-text">No approved prices are available yet.</p>}</div> : <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-obligon-mist/60 p-4">
                  <p className="text-xs font-bold uppercase text-obligon-text">Diesel (AGO)</p>
                  <p className="mt-1 font-extrabold text-xl text-obligon-navy">{detail.diesel}</p>
                </div>
                <div className="rounded-xl bg-obligon-mist/60 p-4">
                  <p className="text-xs font-bold uppercase text-obligon-text">Petrol (PMS)</p>
                  <p className="mt-1 font-extrabold text-xl text-obligon-navy">{detail.unleaded}</p>
                </div>
              </div>

              </>}
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
          <ModalFrame title="Station directions" onClose={() => setDirectionTarget(null)}>
            <div className="p-6 sm:p-8">
              <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl text-obligon-navy">Route Directions</h2>
              <p className="mt-1 text-sm text-obligon-text">Navigating to {directionTarget.name}</p>
              <div className="mt-4 rounded-xl bg-obligon-mist/60 p-4 space-y-2 text-sm font-bold text-obligon-navy">
                <p>📍 Destination: {directionTarget.address}</p>
                <p>📏 Distance: {directionTarget.distance}</p>
                <p>Open the route below for current travel times.</p>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(directionTarget.address)}${location ? `&origin=${location.lat},${location.lng}` : ""}`}
                target="_blank"
                rel="noreferrer"
                className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-obligon-green font-extrabold text-white shadow-none"
              >
                Open in Google Maps ↗
              </a>
            </div>
          </ModalFrame>
        ) : null}
    </AsyncBoundary>
    </Canvas>
  );
}

function SupportPage({ onModal }: { onModal: (modal: CustomerModalType) => void }) {
  const { data: services, status: servicesStatus, error: servicesError, reload: reloadServices } = useAsync(() => api.request<{ services: Array<{ label: string; available: boolean }>; message: string }>("/api/customer/services"));
  const [serviceReference,setServiceReference]=React.useState("");
  const [serviceError, setServiceError] = React.useState<string | null>(null);
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
  const [messageLoading, setMessageLoading] = React.useState(false);
  const [messageError, setMessageError] = React.useState<string | null>(null);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [sendNotice, setSendNotice] = React.useState<string | null>(null);
  const [ticketRevision, setTicketRevision] = React.useState(0);
  const [messageRevision, setMessageRevision] = React.useState(0);

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
  }, [chatOpen, loadTickets, ticketRevision]);

  React.useEffect(() => {
    if (!chatOpen || !ticketId) { setMessages([]); setMessageLoading(false); setMessageError(null); return; }
    let active = true;
    setMessageLoading(true);
    setMessageError(null);
    async function loadMessages() {
      try {
        const data = await api.request<{ messages: Message[]; status: string }>(`/api/customer/support/tickets/${ticketId}/messages`);
        if (active) { setMessages(data.messages); setTicketStatus(data.status); setMessageError(null); setSendNotice(null); }
      } catch (error) {
        if (active) setMessageError(error instanceof Error ? error.message : "Could not load messages.");
      } finally {
        if (active) setMessageLoading(false);
      }
    }
    void loadMessages();
    const timer = setInterval(() => void loadMessages(), 10000);
    return () => { active = false; clearInterval(timer); };
  }, [chatOpen, ticketId, messageRevision]);

  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    const body = inputMsg.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    setSendNotice(null);
    let accepted = false;
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
      accepted = true;
      setInputMsg("");
      const data = await api.request<{ messages: Message[]; status: string }>(`/api/customer/support/tickets/${id}/messages`);
      setMessages(data.messages);
      setTicketStatus(data.status);
      setMessageError(null);
      setSendNotice(null);
      await loadTickets();
    } catch (error) {
      const message = accepted ? "Your message was sent, but the conversation could not be refreshed. Use Refresh messages to check for replies." : error instanceof Error ? error.message : "Your message could not be sent. Please try again.";
      if (accepted) setSendNotice(message); else setSendError(message);
      toastError(message);
    } finally { setSending(false); }
  }

  return (
    <Canvas>
      <div className="mb-8">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-obligon-navy">Customer Support Center</h2>
        <p className="mt-1 text-obligon-text">Billing, card, and transaction assistance.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <MessageCircle className="text-obligon-green" size={28} />
          <h2 className="mt-4 font-display text-xl font-bold tracking-tight sm:text-2xl text-obligon-navy">Support Messages</h2>
          <p className="mt-1 text-sm text-obligon-text">Send a request and follow real replies from the support team. Messages are saved to your account.</p>
          <button onClick={() => { setLoading(true); setLoadError(null); setChatOpen(true); }} className="mt-6 h-11 rounded-xl bg-obligon-green px-5 text-sm font-bold text-white" type="button">Open Support Messages</button>
        </Card>
        <Card className="p-6">
          <AlertTriangle className="text-[#c1121f]" size={28} />
          <h2 className="mt-4 font-display text-xl font-bold tracking-tight sm:text-2xl text-obligon-navy">Transaction Dispute</h2>
          <p className="mt-1 text-sm text-obligon-text">File an official report regarding pump discrepancy or double charges.</p>
          <button onClick={() => onModal("report")} className="mt-6 h-11 rounded-xl bg-[#20251f] px-5 text-sm font-bold text-white" type="button">File Issue Report</button>
        </Card>
      </div>
      <section className="mt-6 min-w-0 rounded-2xl border border-obligon-border bg-white p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold tracking-tight text-obligon-navy">Request a plan service</h2>
        <AsyncBoundary status={servicesStatus} error={servicesError?.message ?? null} onRetry={reloadServices} loadingLabel="Loading included services…">
          {services ? <>
            <p className="mt-2 text-sm leading-6 text-obligon-text">{services.message}</p>
            {services.services.some(service => service.available) ? <form className="mt-5 space-y-5" onSubmit={async event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setSending(true); setServiceError(null); setServiceReference("");
              try {
                const result = await api.request<{ reference: string }>("/api/customer/services", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
                setServiceReference(result.reference);
                try { await loadTickets(); } catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Your support requests could not be refreshed."); }
              } catch (cause) {
                const message = cause instanceof Error ? cause.message : "Your service request could not be sent. Please try again.";
                setServiceError(message); toastError(message);
              } finally { setSending(false); }
            }}>
              <label className="block text-sm font-semibold text-obligon-navy">Service
                <select name="service" required disabled={sending} className="mt-2 block min-h-12 w-full rounded-xl border border-obligon-border bg-white p-3 font-normal disabled:opacity-60">
                  <option value="">Choose an included service</option>
                  {services.services.map(service => <option key={service.label} disabled={!service.available} value={service.label}>{service.label}{!service.available ? " · Not included / active plan required" : ""}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-obligon-navy">Location and requirements<textarea name="message" required disabled={sending} maxLength={5000} className="mt-2 block min-h-28 w-full rounded-xl border border-obligon-border bg-white p-3 font-normal disabled:opacity-60" /></label>
              <button type="submit" disabled={sending || !services.services.some(service => service.available)} className="min-h-12 rounded-xl bg-obligon-green px-5 text-sm font-semibold text-white disabled:opacity-60">{sending ? "Submitting…" : "Request coordination"}</button>
              {!services.services.some(service => service.available) ? <p className="text-sm text-obligon-text">Your current plan has no available coordination services. You can still contact Support below.</p> : null}
            </form> : <p className="mt-4 rounded-xl bg-obligon-mist/60 p-4 text-sm text-obligon-text">Coordination services require an eligible active plan. You can still send messages or report an issue above.</p>}
            {!services.services.some(service => service.available) ? <Link href="/customer/card#subscription" className="mt-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-obligon-green underline">View plans in My Card</Link> : null}
          </> : null}
        </AsyncBoundary>
        {serviceError ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{serviceError}</p> : null}
        {serviceReference ? <p role="status" className="mt-4 rounded-xl bg-obligon-mist p-4 text-sm text-obligon-green">Request {serviceReference} recorded. Use Open Support Messages above to follow the response.</p> : null}
      </section>
      {chatOpen ? (
        <ModalFrame title="Support chat" onClose={() => setChatOpen(false)}>
          <div className="flex h-[min(560px,calc(94dvh-88px))] min-h-[320px] flex-col">
            <div className="shrink-0 border-b border-obligon-border bg-obligon-mist/60 p-4">
              <h2 className="text-sm font-extrabold text-obligon-navy">Support Messages</h2>
              <label htmlFor="support-ticket" className="sr-only">Support request</label>
              <select id="support-ticket" value={ticketId} disabled={sending || loading} onChange={(e) => { setTicketId(e.target.value); setMessages([]); setTicketStatus(""); setMessageLoading(Boolean(e.target.value)); setSendError(null); setSendNotice(null); }} className="mt-2 min-h-12 w-full rounded-xl border border-obligon-border bg-white p-3 text-sm">
                <option value="">New support request</option>
                {tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.reference} · {ticket.subject}</option>)}
              </select>
              <p className="mt-2 text-xs text-obligon-text">{ticketId ? `Request ${ticketStatus || "loading"}. Replies appear here when the team responds.` : "Your first message opens a support request. The team will reply here."}</p>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite">
              {loadError ? <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800"><p>{loadError}</p><button type="button" disabled={loading} onClick={() => setTicketRevision(value => value + 1)} className="mt-1 min-h-11 rounded-lg px-2 font-semibold underline disabled:opacity-60">Retry loading requests</button></div> : null}
              {messageError ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{messageError}</p> : null}
              {sendError ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{sendError}</p> : null}
              {sendNotice ? <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{sendNotice}</p> : null}
              {loading ? <p role="status" className="text-sm text-obligon-text">Loading requests…</p> : null}
              {messageLoading ? <p role="status" className="text-sm text-obligon-text">Loading messages…</p> : null}
              {!loading && !messageLoading && !loadError && !messageError && !messages.length ? <p className="rounded-xl bg-obligon-mist/60 p-4 text-sm leading-6 text-obligon-text">{ticketId ? "There are no messages in this request yet." : tickets.length ? "Choose an existing request above, or send a message to start a new one." : "No support requests yet. Send your first message below."}</p> : null}
              {ticketId ? <button type="button" disabled={messageLoading || sending} onClick={() => setMessageRevision(value => value + 1)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-obligon-green underline disabled:opacity-60">Refresh messages</button> : null}
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "customer" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${message.role === "customer" ? "bg-obligon-green text-white" : "bg-[#f0f4f0] text-obligon-navy"}`}>
                    <p className="mb-1 text-xs font-bold">{message.role === "customer" ? "You" : message.sender}</p>
                    <p className="break-words whitespace-pre-wrap">{message.body}</p>
                    <span className="mt-1 block text-right text-xs opacity-70">{message.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} className="flex shrink-0 gap-2 border-t border-obligon-border bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <label htmlFor="support-message" className="sr-only">Message</label>
              <input id="support-message" value={inputMsg} disabled={sending} maxLength={4000} onChange={(e) => setInputMsg(e.target.value)} placeholder="Type your message…" className="h-11 min-w-0 flex-1 rounded-xl border border-obligon-border px-4 text-sm" />
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
  const [pushState, setPushState] = useState<PushState | null>(null);
  const [pushChecking, setPushChecking] = useState(true);
  const [pushCheckRevision, setPushCheckRevision] = useState(0);
  const [pushError, setPushError] = useState("");

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

  // An account preference can be enabled on another device. Check this browser
  // separately without requesting permission or changing the account preference.
  React.useEffect(() => {
    let active = true;
    setPushChecking(true);
    setPushError("");
    void currentPushState().then((state) => {
      if (!active) return;
      setPushState(state);
    }).catch(() => {
      if (active) {
        setPushState(null);
        setPushError("Could not check push notifications in this browser. Check this device again.");
      }
    }).finally(() => {
      if (active) setPushChecking(false);
    });
    return () => {
      active = false;
    };
  }, [pushCheckRevision, user?.id]);

  const pushDeviceStatus = pushChecking
    ? "Checking push setup in this browser…"
    : !pushState
      ? "Push setup is unknown in this browser."
      : pushState.permission === "unsupported"
        ? "This browser does not support push notifications."
        : pushState.permission === "denied"
          ? "Push notifications are blocked in this browser. Allow notifications in your browser site settings, then check this device again."
          : pushState.subscribed
            ? "This browser has a push subscription. Your account preference controls whether alerts are sent."
            : "Push is not set up in this browser. Other subscribed devices keep your account preference.";
  const canEnablePushDevice = prefs.push && pushState && !pushState.subscribed &&
    pushState.permission !== "denied" && pushState.permission !== "unsupported";

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
      if (pushBusy || prefsSaving) return;
      if (next && (!pushState || pushState.permission === "denied" || pushState.permission === "unsupported")) {
        const message = "Push notifications are blocked or unsupported in this browser. Check this site's notification settings in your browser.";
        setPushError(message);
        toastError(message);
        return;
      }
      setPushBusy(true);
      setPushError("");
      try {
        const state = next ? await enableWebPush() : await disableWebPush();
        setPushState(state);
        const result = await savePrefs(
          { ...previous, push: next },
          state.reason ?? (next ? "Mobile push notifications enabled." : "Mobile push notifications disabled.")
        );
        if (result === false) setPrefs(previous);
      } catch (error) {
        setPrefs(previous);
        const message = error instanceof Error ? error.message : "Could not change push notifications. Check your browser settings and try again.";
        setPushError(message);
        toastError(message);
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
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-obligon-navy">Profile &amp; Settings</h2>
          <p className="mt-1 text-sm text-obligon-text">Manage your personal details and communication preferences.</p>

          <form onSubmit={handleSave} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase text-obligon-text">Full Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-xl border border-obligon-border px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-obligon-text">Email Address</span><p id="profile-email-help" className="text-xs text-obligon-text">Your sign-in email. Contact support to change it securely.</p>
                <input
                  value={email}
                  readOnly aria-describedby="profile-email-help"
                  type="email"
                  className="mt-1.5 h-12 w-full rounded-xl border border-obligon-border px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-obligon-text">Phone Number</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-xl border border-obligon-border px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-obligon-text">Primary Address</span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-xl border border-obligon-border px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                  required
                />
              </label>
            </div>

            <div className="pt-6 border-t border-[#eef3ee]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl text-obligon-navy">Notification Preferences</h2>
                {prefsSaving ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-obligon-text">
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
                      description: "Allow push alerts on subscribed devices. Turning this off stops push alerts for your account."
                    }
                  ] as const
                ).map((row) => (
                  <div key={row.key} className="rounded-xl border border-obligon-border bg-obligon-mist/60 p-3.5">
                    <Toggle
                      label={row.label}
                      description={row.description}
                      checked={prefs[row.key]}
                      disabled={prefsSaving || (row.key === "push" && (pushBusy || pushChecking)) || (row.key === "sms" && !profile?.user.phoneVerified)}
                      onCheckedChange={(next) => void handleToggle(row.key, next)}
                    />
                    {row.key === "push" ? (
                      <div className="mt-3 border-t border-obligon-border pt-3">
                        <p role="status" aria-live="polite" className="text-xs leading-5 text-obligon-text">
                          {pushBusy ? "Contacting your browser…" : pushDeviceStatus}
                          {pushState?.reason ? ` ${pushState.reason}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {canEnablePushDevice ? (
                            <button
                              type="button"
                              disabled={pushBusy || pushChecking || prefsSaving}
                              onClick={() => handleToggle("push", true)}
                              className="min-h-11 rounded-lg border border-obligon-border bg-white px-3 py-2 text-xs font-bold text-obligon-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obligon-green focus-visible:ring-offset-2 disabled:opacity-50"
                            >
                              Enable on this device
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={pushBusy || pushChecking || prefsSaving}
                            onClick={() => setPushCheckRevision((revision) => revision + 1)}
                            className="min-h-11 rounded-lg border border-obligon-border bg-white px-3 py-2 text-xs font-bold text-obligon-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obligon-green focus-visible:ring-offset-2 disabled:opacity-50"
                          >
                            Check this device again
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {pushError ? <p role="alert" className="mt-3 text-sm text-red-700">{pushError}</p> : null}
              <div className="mt-4 rounded-xl border border-obligon-border bg-white p-3.5">
                <p className="text-xs font-bold text-obligon-navy">Alert Categories</p>
                <p className="mt-1 text-xs leading-4 text-obligon-text">
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
              className="mt-6 h-12 rounded-xl bg-obligon-green px-8 font-extrabold text-white shadow-none hover:bg-obligon-green/90 transition flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : "Save Changes"}
            </button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl text-obligon-navy">Security Settings</h2>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => onModal("changePassword")}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-obligon-border hover:bg-obligon-mist/60 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <LockKeyhole size={18} className="text-obligon-green" />
                  <div>
                    <p className="text-xs font-extrabold text-obligon-navy">Change Password</p>
                    <p className="text-xs text-obligon-text">Update your account password</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-obligon-text" />
              </button>

              <button
                type="button"
                onClick={() => onModal("changePin")}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-obligon-border hover:bg-obligon-mist/60 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <CreditCard size={18} className="text-obligon-green" />
                  <div>
                    <p className="text-xs font-extrabold text-obligon-navy">Transaction PIN</p>
                    <p className="text-xs text-obligon-text">Update 4-digit card authorization PIN</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-obligon-text" />
              </button>

              <button
                type="button"
                onClick={() => onModal("twoFactor")}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-obligon-border hover:bg-obligon-mist/60 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-obligon-green" />
                  <div>
                    <p className="text-xs font-extrabold text-obligon-navy">Two-Factor Authentication</p>
                    <p className="text-xs text-obligon-text">
                      {twoFactor ? "Enabled. A code is required at sign-in." : "Add a verification code at sign-in"}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${
                    twoFactor ? "bg-[#e8fbd7] text-obligon-green" : "bg-[#f0f4f0] text-obligon-text"
                  }`}
                >
                  {twoFactor ? "ON" : "OFF"}
                </span>
              </button>

              <Link href={routes.signInOptions} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-obligon-border p-3.5 text-left transition hover:bg-obligon-mist/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green">
                <div>
                  <p className="text-sm font-bold text-obligon-navy">Google and passkey sign-in</p>
                  <p className="mt-1 text-xs text-obligon-text">Manage Google sign-in or add a passkey. Your device may use fingerprint, face recognition, or its PIN. Transaction approvals still use your password, card PIN, and two-factor authentication.</p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-obligon-text" aria-hidden="true" />
              </Link>
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
  const { status, data: notifications, error, reload, refresh } = useAsync(() => api.getNotifications());
  const { success: toastSuccess, error: toastError } = useToast();
  const [readItems, setReadItems] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  usePolling(refresh, { intervalMs: BALANCE_POLL_MS });

  async function handleMarkAll() {
    if (saving) return;
    setSaving(true);
    try {
      await mutationsApi.markAllNotificationsRead();
      setReadItems(new Set((notifications ?? []).flatMap(n => n.id ? [n.id] : [])));
      refresh();
      toastSuccess("All notifications marked as read.");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Could not mark notifications as read.");
    } finally { setSaving(false); }
  }

  async function handleRead(id: string) {
    if (saving || readItems.has(id)) return;
    setSaving(true);
    try {
      await mutationsApi.markNotificationRead(id);
      setReadItems(previous => new Set(previous).add(id));
      refresh();
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Could not mark this notification as read.");
    } finally { setSaving(false); }
  }

  return (
    <Canvas>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-obligon-navy">Notifications</h2>
            <p className="mt-1 text-obligon-text">Security alerts, transaction confirmations, and system notices.</p>
          </div>
          <button
            onClick={handleMarkAll}
            disabled={saving || !(notifications ?? []).some(n => !n.read && (!n.id || !readItems.has(n.id)))}
            className="min-h-11 rounded-xl border border-obligon-border bg-white px-4 text-sm font-semibold text-obligon-green hover:bg-obligon-mist transition"
            type="button"
          >
            Mark all as read
          </button>
        </div>

    <AsyncBoundary
      status={status}
      error={error?.message ?? null}
      isEmpty={!notifications || notifications.length === 0}
      onRetry={reload}
      loadingLabel="Loading notifications…"
      empty={{ title: "No notifications", message: "You're all caught up. Alerts will appear here." }}
    >
        <Card className="overflow-hidden divide-y divide-[#eef3ee]">
          {(notifications ?? []).map((n) => {
            const isRead = Boolean(n.read || (n.id && readItems.has(n.id)));
            return (
              <button
                key={n.id ?? `${n.title}:${n.time}`}
                type="button"
                disabled={saving || isRead || !n.id}
                onClick={() => n.id && void handleRead(n.id)}
                aria-label={`${isRead ? "Read notification" : "Mark notification as read"}: ${n.title}`}
                aria-describedby={n.id ? `customer-notification-description-${n.id}` : undefined}
                className={`flex w-full items-start gap-4 p-5 text-left transition ${isRead ? "bg-white opacity-70" : "bg-obligon-mist/60"}`}
              >
                <MiniIcon tone={n.title.includes("Security") ? "red" : "green"}>
                  <Bell size={18} />
                </MiniIcon>
                <div id={n.id ? `customer-notification-description-${n.id}` : undefined} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-extrabold text-obligon-navy">{n.title}</h2>
                    <span className="text-xs text-obligon-text">{n.time}</span>
                  </div>
                  <p className="text-xs text-obligon-text mt-1">{n.body}</p>
                </div>
              </button>
            );
          })}
        </Card>
    </AsyncBoundary>
    </Canvas>
  );
}

export function CustomerScreen({ pageKey }: { pageKey: CustomerPageKey }) {
  const [modal, setModal] = React.useState<CustomerModalType>(null);
  React.useEffect(() => {if (pageKey === "reportProblem") setModal("report");},[pageKey]);
  const { data: subscription, refresh: refreshSubscription } = useAsync(
    () => api.request<CustomerEntitlementState>("/api/customer/subscription")
  );
  usePolling(refreshSubscription, { intervalMs: BALANCE_POLL_MS });
  const canEditProjection = customerFeatureAvailable(subscription, "Fuel Budget Management");
  const [cardStatus, setCardStatus] = React.useState<string | null>(null);
  const [cardRefreshKey, setCardRefreshKey] = React.useState(0);
  const [balanceRefreshKey, setBalanceRefreshKey] = React.useState(0);
  // My Card owns projection editing. Shared state lets a saved projection
  // refresh the Overview summary when the customer returns there.
  const { data: projection, refresh: refreshProjection } = useAsync(
    () => api.getCustomerSpendProjection()
  );
  // Which month the prompt has already been raised for this session. Without it
  // the modal reopens on every navigation, because a customer who chose "Not
  // now" would be asked again the moment they closed it. Setting a projection
  // clears the need entirely, since the server then reports one exists.
  const [promptedForMonth, setPromptedForMonth] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (pageKey !== "card" || !canEditProjection || !projection?.needsProjection) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("chosenPlan") || params.has("plan") || params.has("tx_ref") || params.has("reference")) return;
    // Never displace something the customer opened deliberately.
    if (modal) return;
    if (promptedForMonth === projection.month) return;
    setPromptedForMonth(projection.month);
    setModal("spendProjection");
  }, [pageKey, projection, modal, promptedForMonth, canEditProjection]);

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
    overview: <OverviewPage balanceRefreshKey={balanceRefreshKey} />,
    transactions: <TransactionsPage />,
    card: <CardPage onModal={setModal} refreshKey={cardRefreshKey} onCardChange={(card) => setCardStatus(card?.status ?? null)} subscription={subscription} onSubscriptionChange={refreshSubscription} canEditProjection={canEditProjection} projectionLabel={projection?.projectedLabel ?? "Not set"} onEditProjection={openSpendProjection} />,
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
        modal={modal === "spendProjection" && (pageKey !== "card" || !canEditProjection) ? null : modal}
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
