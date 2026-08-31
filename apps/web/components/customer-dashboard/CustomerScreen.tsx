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
import {
  type CustomerPageKey,
  type CustomerTone,
  type CustomerTransaction
} from "@/lib/mock/customer-data";
import { api } from "@/lib/services";
import { AsyncBoundary } from "@/components/shared/States";
import { useAsync } from "@/components/shared/useAsync";
import { useSession } from "@/components/shared/AuthContext";
import { useToast } from "@/components/shared/Toast";
import { CustomerModals, ModalFrame, type CustomerModalType } from "./CustomerModals";
import { ConfirmModal, PinModal } from "../shared/Dialogs";
import { routes } from "../site/routes";

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
  const { status, data: recentActivity, error, reload } = useAsync(() => api.getCustomerRecentActivity());
  return (
    <AsyncBoundary
      status={status}
      error={error?.message ?? null}
      isEmpty={!recentActivity || recentActivity.length === 0}
      onRetry={reload}
      loadingLabel="Loading activity…"
      empty={{ title: "No recent activity", message: "Your recent transactions will appear here." }}
    >
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-6 border-b border-[#eef3ee]">
          <h2 className="font-display text-2xl font-extrabold text-obligon-navy">{desktop ? "Recent Activity" : "Recent Transactions"}</h2>
          <button onClick={() => router.push("/customer/transactions")} className="text-sm font-bold text-obligon-green hover:underline" type="button">
            View All
          </button>
        </div>
        <div className="divide-y divide-[#eef3ee]">
          {(recentActivity ?? []).map((item) => (
            <div key={`${item.station}-${item.amount}`} onClick={() => router.push("/customer/transactions")} className="flex items-center gap-4 px-6 py-4 hover:bg-[#f7fbf8] transition cursor-pointer">
              <MiniIcon tone="muted"><Fuel size={18} /></MiniIcon>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-obligon-navy">{item.station}</p>
                <p className="text-sm text-obligon-text">{desktop ? item.time : item.meta}</p>
              </div>
              <p className="font-extrabold text-obligon-green">{item.amount}</p>
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

function OverviewPage({ walletBalance }: { walletBalance: number }) {
  const { user } = useSession();
  const router = useRouter();
  const { status, data: metrics, error, reload } = useAsync(() => api.getCustomerOverviewMetrics());
  const firstName = user?.name?.split(" ")[0] ?? "Driver";
  const mtdSpend = metricValue(metrics, "MTD Spend", "₦215,600");
  const budgetUsage = metricValue(metrics, "Budget Usage", "43%");
  const budgetLimit = metricHelper(metrics, "Budget Usage") ?? "₦500,000 Limit";
  const litres = metricValue(metrics, "Litres Consumed", "1,245 L");
  const txnCount = metricValue(metrics, "Transactions", "87");
  const security = metricValue(metrics, "Security Status", "2 Alerts");
  const securityHelper = metricHelper(metrics, "Security Status") ?? "1 Blocked | 0 Suspicious";
  const lifetime = metricValue(metrics, "Lifetime Savings", "₦245,780");
  const mtdSavings = metricHelper(metrics, "MTD Spend")?.replace("MTD Savings: ", "") ?? "₦18,450";
  const usagePercent = Number.parseInt(budgetUsage, 10) || 43;

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
              ₦{walletBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <span className="rounded-xl border border-[#b6d894] bg-[#e8fbd7] px-4 py-3">
                <span className="block text-xs font-extrabold uppercase text-obligon-green">MTD Savings</span>
                <span className="mt-1 block text-2xl font-extrabold text-obligon-green">{mtdSavings}</span>
              </span>
              <span className="rounded-xl bg-[#eef3ee] px-4 py-3">
                <span className="block text-xs font-extrabold uppercase text-[#3f463d]">Lifetime Savings</span>
                <span className="mt-1 block text-2xl font-extrabold text-obligon-navy">{lifetime}</span>
              </span>
            </div>
          </Card>
          <Card className="p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.8px] text-[#3f463d]">MTD Spend</p>
            <p className="mt-4 font-display text-[32px] font-extrabold text-[#b51f24]">{mtdSpend}</p>
            <div className="mt-6 flex justify-between text-sm">
              <span className="font-bold text-[#3f463d]">Budget Usage</span>
              <span className="font-extrabold text-obligon-navy">{budgetUsage}</span>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-[#dce5da] overflow-hidden">
              <span className="block h-full rounded-full bg-obligon-green transition-all" style={{ width: `${Math.min(usagePercent, 100)}%` }} />
            </div>
            <p className="mt-3 text-right text-xs font-extrabold text-[#3f463d]">{budgetLimit}</p>
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
              <span className="size-2 rounded-full bg-obligon-green" /> All Cards Active
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
  const { status: txnStatus, data: transactionHistory, error: txnError, reload } = useAsync(() => api.getCustomerTransactions());
  const { data: mobileHistory } = useAsync(() => api.getMobileHistory());
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [filters, setFilters] = React.useState({ station: "All Stations", vehicle: "All Vehicles", fuel: "All Fuels" });
  const [applied, setApplied] = React.useState(filters);
  const [selectedTxn, setSelectedTxn] = React.useState<CustomerTransaction | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 5;
  const { success: toastSuccess } = useToast();
  const [downloadingReceipt, setDownloadingReceipt] = React.useState(false);

  const stations = Array.from(new Set((transactionHistory ?? []).map((row) => row.station)));
  const vehicles = Array.from(new Set((transactionHistory ?? []).map((row) => row.vehicle ?? ""))).filter(Boolean);
  const fuels = Array.from(new Set((transactionHistory ?? []).map((row) => row.fuel ?? "").filter(Boolean)));

  const filtered = (transactionHistory ?? []).filter((row) => {
    if (applied.station !== "All Stations" && row.station !== applied.station) return false;
    if (applied.vehicle !== "All Vehicles" && row.vehicle !== applied.vehicle) return false;
    if (applied.fuel !== "All Fuels" && row.fuel !== applied.fuel) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasActiveFilters =
    applied.station !== "All Stations" || applied.vehicle !== "All Vehicles" || applied.fuel !== "All Fuels";

  function handleDownloadReceipt(txn: CustomerTransaction) {
    setDownloadingReceipt(true);
    setTimeout(() => {
      const ref = txn.reference ?? `TXN-${Math.abs(hashString(txn.station + (txn.time ?? ""))).toString().slice(0, 8)}`;
      const receiptContent = `====================================================
               OBLIGON LTD OFFICIAL RECEIPT
====================================================
Reference:     ${ref}
Station:       ${txn.station}
Location:      ${txn.meta ?? "Main Station Hub"}
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
      isEmpty={(transactionHistory?.length ?? 0) === 0 && (mobileHistory?.length ?? 0) === 0}
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
                  {["Station & Location", "Vehicle ID", "Fuel Type", "Amount", "Timestamp", "Action"].map((h) => (
                    <th key={h} className="px-6 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3ee]">
                {paginated.length > 0 ? (
                  paginated.map((row) => (
                    <tr
                      key={`${row.station}-${row.time}`}
                      className="transition hover:bg-[#f7fbf8]"
                    >
                      <td className="px-6 py-4">
                        <p className="font-extrabold text-obligon-navy">{row.station}</p>
                        <p className="text-xs text-obligon-text">{row.meta}</p>
                      </td>
                      <td className="px-6 py-4 font-bold text-obligon-green">{row.vehicle ?? "FLT-8492"}</td>
                      <td className="px-6 py-4 text-sm text-obligon-navy">{row.fuel ?? "PMS Petrol"}</td>
                      <td className="px-6 py-4 font-extrabold text-obligon-navy">{row.amount}</td>
                      <td className="px-6 py-4 text-xs text-obligon-text">{row.time}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedTxn(row as CustomerTransaction)}
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
                <span className="rounded-full bg-[#e8fbd7] px-3 py-1 text-xs font-extrabold text-obligon-green">
                  APPROVED
                </span>
              </div>
              <h2 className="mt-4 font-display text-3xl font-extrabold text-obligon-navy">Transaction Receipt</h2>
              <p className="mt-1 text-xs text-obligon-text">
                Reference: <span className="font-mono font-extrabold text-obligon-navy">
                  TXN-{Math.abs(hashString(selectedTxn.station + (selectedTxn.time ?? ""))).toString().slice(0, 8)}
                </span>
              </p>

              <div className="mt-6 rounded-2xl bg-[#f7fbf8] p-5 border border-obligon-border">
                <p className="text-xs font-bold uppercase text-obligon-text">Amount Settled</p>
                <p className="mt-1 font-display text-4xl font-extrabold text-obligon-green">{selectedTxn.amount}</p>
              </div>

              <div className="mt-5 space-y-3.5 text-sm divide-y divide-[#eef3ee]">
                <DetailRow label="Merchant / Station" value={selectedTxn.station} />
                <DetailRow label="Location" value={selectedTxn.meta ?? "Main Highway Hub"} />
                <DetailRow label="Vehicle ID" value={selectedTxn.vehicle ?? "FLT-8492"} />
                <DetailRow label="Fuel Type" value={selectedTxn.fuel ?? "Premium Diesel"} />
                <DetailRow label="Timestamp" value={selectedTxn.time ?? "Oct 24, 14:32"} />
                <DetailRow label="Card Number" value="•••• •••• •••• 4092" />
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

function CardPage({
  onModal,
  frozen,
  blocked
}: {
  onModal: (modal: CustomerModalType) => void;
  frozen: boolean;
  blocked: boolean;
}) {
  const status = blocked
    ? { label: "BLOCKED", className: "bg-[#ffe8e8] px-3 py-1 text-xs font-extrabold text-[#c1121f]" }
    : frozen
      ? { label: "FROZEN", className: "bg-[#fff3d8] px-3 py-1 text-xs font-extrabold text-[#9a6300]" }
      : { label: "ACTIVE STATUS", className: "bg-[#e8fbd7] px-3 py-1 text-xs font-extrabold text-obligon-green" };

  const freezeLabel = frozen ? "Unfreeze Card" : "Freeze Card";
  const freezeBody = frozen ? "Resume transactions on this card" : "Temporarily lock fuel card";

  const cardActions: Array<{ title: string; body: string; Icon: ComponentType<LucideProps>; tone: CustomerTone; modal: CustomerModalType }> = [
    { title: "Replace Physical Card", body: "Order a replacement card shipped to your address", Icon: CreditCard, tone: "green", modal: "replaceCard" },
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

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
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
              <p className="font-mono text-2xl tracking-[4px] text-white/90">•••• •••• •••• 4092</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-white/60">CARDHOLDER NAME</p>
                  <p className="font-extrabold text-sm text-white">Obligon LTD Enterprise Fleet</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-white/60">DAILY SPEND LIMIT</p>
                  <p className="font-extrabold text-sm text-obligon-lime">₦150,000.00</p>
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
      </div>
    </Canvas>
  );
}

function WalletPage({
  onModal,
  walletBalance
}: {
  onModal: (modal: CustomerModalType) => void;
  walletBalance: number;
}) {
  const router = useRouter();
  const { status: topUpsStatus, data: desktopTopUps, error: topUpsError, reload: reloadTopUps } = useAsync(() => api.getCustomerDesktopTopUps());
  const { data: topUpHistory } = useAsync(() => api.getCustomerTopUpHistory());

  return (
    <AsyncBoundary
      status={topUpsStatus}
      error={topUpsError?.message ?? null}
      isEmpty={!desktopTopUps || desktopTopUps.length === 0}
      onRetry={reloadTopUps}
      loadingLabel="Loading wallet…"
      empty={{ title: "No top-up history", message: "Your wallet transactions will appear here." }}
    >
      <Canvas>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Wallet Management</h1>
            <p className="mt-1 text-obligon-text">Fund and manage your corporate prepaid balance.</p>
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
            <p className="text-xs font-extrabold uppercase text-obligon-text">Available Fleet Balance</p>
            <span className="rounded-full bg-[#e8fbd7] px-3 py-1 text-xs font-extrabold text-obligon-green">
              Auto-Recharge Active
            </span>
          </div>
          <p className="mt-3 font-display text-5xl font-extrabold text-obligon-navy">
            ₦{walletBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-3 text-sm font-bold text-obligon-green">
            Auto-recharges ₦50,000 when balance falls below ₦10,000
          </p>
        </Card>

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
      </Canvas>
    </AsyncBoundary>
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
  const { status, data: stations, error, reload } = useAsync(() => api.getStations());
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
            <iframe
              title="Station map"
              src={buildMapUrl(stations ?? [])}
              className="h-full min-h-[500px] w-full border-0"
              loading="lazy"
            />
          </Card>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {visible.map((st) => (
              <Card key={st.name} className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-obligon-navy">{st.name}</h3>
                    <p className="text-xs font-bold text-obligon-green">{st.distance} away • {st.hours}</p>
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
  );
}

function SupportPage({ onModal }: { onModal: (modal: CustomerModalType) => void }) {
  const [chatOpen, setChatOpen] = React.useState(false);
  const [chatMessages, setChatMessages] = React.useState<Array<{ from: "agent" | "user"; text: string; time: string }>>([
    { from: "agent", text: "Hello! Welcome to Obligon LTD 24/7 Fleet Support. How can we help you today?", time: "Just now" }
  ]);
  const [inputMsg, setInputMsg] = React.useState("");

  function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    const msg = inputMsg;
    setInputMsg("");
    setChatMessages((prev) => [...prev, { from: "user", text: msg, time: "Just now" }]);
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        { from: "agent", text: "Thank you for reaching out. An operations officer is reviewing your account.", time: "Just now" }
      ]);
    }, 1000);
  }

  return (
    <Canvas>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Customer Support Center</h1>
        <p className="mt-1 text-obligon-text">24/7 technical, billing, and card dispute assistance.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <MessageCircle className="text-obligon-green" size={28} />
          <h2 className="mt-4 font-display text-2xl font-extrabold text-obligon-navy">Live Support Chat</h2>
          <p className="mt-1 text-sm text-obligon-text">Chat with a dedicated logistics specialist in real time.</p>
          <button
            onClick={() => setChatOpen(true)}
            className="mt-6 h-11 rounded-xl bg-obligon-green px-5 text-sm font-bold text-white shadow-green hover:bg-obligon-green/90 transition"
            type="button"
          >
            Start Live Chat
          </button>
        </Card>

        <Card className="p-6">
          <AlertTriangle className="text-[#c1121f]" size={28} />
          <h2 className="mt-4 font-display text-2xl font-extrabold text-obligon-navy">Transaction Dispute</h2>
          <p className="mt-1 text-sm text-obligon-text">File an official report regarding pump discrepancy or double charges.</p>
          <button
            onClick={() => onModal("report")}
            className="mt-6 h-11 rounded-xl bg-[#20251f] px-5 text-sm font-bold text-white hover:bg-[#323930] transition"
            type="button"
          >
            File Issue Report
          </button>
        </Card>
      </div>

      {chatOpen ? (
        <ModalFrame onClose={() => setChatOpen(false)}>
          <div className="flex flex-col h-[520px]">
            <div className="border-b border-[#eef3ee] p-4 bg-[#f7fbf8] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="size-3 rounded-full bg-obligon-green animate-pulse" />
                <span className="text-sm font-extrabold text-obligon-navy">Obligon Support Agent Online</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${msg.from === "user" ? "bg-obligon-green text-white" : "bg-[#f0f4f0] text-obligon-navy"}`}>
                    <p>{msg.text}</p>
                    <span className="text-[10px] opacity-70 block mt-1 text-right">{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} className="border-t border-[#eef3ee] p-3 flex gap-2 bg-white">
              <input
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 h-11 rounded-xl border border-[#cfd8cc] px-4 text-sm outline-none focus:border-obligon-green"
              />
              <button type="submit" className="h-11 px-4 rounded-xl bg-obligon-green text-white font-bold">
                <Send size={16} />
              </button>
            </form>
          </div>
        </ModalFrame>
      ) : null}
    </Canvas>
  );
}

function ProfilePage({
  onModal,
  biometrics,
  onBiometricsChange
}: {
  onModal: (modal: CustomerModalType) => void;
  biometrics: boolean;
  onBiometricsChange: (enabled: boolean) => void;
}) {
  const { user, updateProfile } = useSession();
  const { success: toastSuccess } = useToast();
  const router = useRouter();

  const [name, setName] = useState(user?.name ?? "Fleet Manager");
  const [email, setEmail] = useState(user?.email ?? "manager@obligon.enterprise.com");
  const [phone, setPhone] = useState(user?.phone ?? "+234 801 000 0000");
  const [address, setAddress] = useState(user?.address ?? "14 Marina Road, Lagos Island, Lagos");
  const [saving, setSaving] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const [notificationPrefs, setNotificationPrefs] = useState({
    emailAlerts: true,
    smsAlerts: true,
    pushNotifications: true
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    updateProfile({ name, email, phone, address });
    setSaving(false);
    toastSuccess("Profile information updated successfully.");
  }

  return (
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
              <h2 className="font-display text-xl font-extrabold text-obligon-navy mb-3">Notification Preferences</h2>
              <div className="space-y-3">
                {[
                  { key: "emailAlerts" as const, label: "Email Transaction Receipts & Statements" },
                  { key: "smsAlerts" as const, label: "Instant SMS Dispatch Alerts" },
                  { key: "pushNotifications" as const, label: "Mobile Push Notifications" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between p-3.5 rounded-xl bg-[#f7fbf8] border border-obligon-border cursor-pointer">
                    <span className="text-xs font-bold text-obligon-navy">{label}</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs[key]}
                      onChange={(e) => setNotificationPrefs((prev) => ({ ...prev, [key]: e.target.checked }))}
                      className="size-4 text-obligon-green accent-obligon-green rounded"
                    />
                  </label>
                ))}
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
                onClick={() => onModal("changePin")}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-obligon-border hover:bg-[#f7fbf8] transition text-left"
              >
                <div className="flex items-center gap-3">
                  <LockKeyhole size={18} className="text-obligon-green" />
                  <div>
                    <p className="text-xs font-extrabold text-obligon-navy">Change PIN</p>
                    <p className="text-[11px] text-obligon-text">Update 4-digit security PIN</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-obligon-text" />
              </button>

              <button
                type="button"
                onClick={() => onModal("biometrics")}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-obligon-border hover:bg-[#f7fbf8] transition text-left"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-obligon-green" />
                  <div>
                    <p className="text-xs font-extrabold text-obligon-navy">Biometrics</p>
                    <p className="text-[11px] text-obligon-text">{biometrics ? "Active (Face/Fingerprint)" : "Disabled"}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${biometrics ? "bg-[#e8fbd7] text-obligon-green" : "bg-[#f0f4f0] text-obligon-text"}`}>
                  {biometrics ? "ON" : "OFF"}
                </span>
              </button>
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
  );
}

function NotificationsPage() {
  const { status, data: notifications, error, reload } = useAsync(() => api.getNotifications());
  const { success: toastSuccess } = useToast();
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
  const [biometrics, setBiometrics] = React.useState(false);
  const [cardFrozen, setCardFrozen] = React.useState(false);
  const [cardBlocked, setCardBlocked] = React.useState(false);
  const [walletBalance, setWalletBalance] = React.useState(485000);

  const handleTopUpSuccess = (amt: number) => {
    setWalletBalance((prev) => prev + amt);
  };

  const pages: Record<CustomerPageKey, React.ReactNode> = {
    overview: <OverviewPage walletBalance={walletBalance} />,
    transactions: <TransactionsPage />,
    card: <CardPage onModal={setModal} frozen={cardFrozen} blocked={cardBlocked} />,
    wallet: <WalletPage onModal={setModal} walletBalance={walletBalance} />,
    stations: <StationsPage />,
    support: <SupportPage onModal={setModal} />,
    transactionDetail: <TransactionsPage />,
    reportProblem: <SupportPage onModal={setModal} />,
    profile: <ProfilePage onModal={setModal} biometrics={biometrics} onBiometricsChange={setBiometrics} />,
    notifications: <NotificationsPage />
  };

  return (
    <>
      {pages[pageKey]}
      <CustomerModals
        modal={modal}
        onClose={() => setModal(null)}
        biometrics={biometrics}
        onBiometricsChange={setBiometrics}
        cardFrozen={cardFrozen}
        onCardFrozenChange={setCardFrozen}
        cardBlocked={cardBlocked}
        onCardBlockedChange={setCardBlocked}
        onTopUpSuccess={handleTopUpSuccess}
      />
    </>
  );
}
