"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  Filter,
  Fuel,
  MapPin,
  MoreVertical,
  Plus,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  X,
  Building2,
  Loader2,
  Printer,
  Upload,
  UserPlus,
  Wrench
} from "lucide-react";
import {
  disputeRows,
  notificationGroups,
  overviewMetrics,
  overviewTransactions,
  pageCopy,
  payoutRows,
  priceRows,
  quickStats,
  reportRows,
  staffRows,
  transactionRows,
  type DashboardPageKey,
  type Metric,
  type StatusTone,
  type TableRow
} from "@/lib/mock/dashboard-data";
import { MobileDashboardNav } from "./MobileDashboardNav";
import { useToast } from "@/components/shared/Toast";

const toneStyles: Record<StatusTone, string> = {
  success: "bg-[#eaf7db] text-[#315d00]",
  pending: "bg-[#fff5d8] text-[#875b00]",
  failed: "bg-[#ffecef] text-[#9f1027]",
  info: "bg-[#e9efff] text-[#011554]",
  neutral: "bg-[#eef0f6] text-[#454650]"
};

const iconTile: Record<StatusTone, string> = {
  success: "bg-[#ecfbd7] text-obligon-green",
  pending: "bg-[#fff5d8] text-[#986700]",
  failed: "bg-[#ffecef] text-[#b5162d]",
  info: "bg-[#e9efff] text-obligon-blue",
  neutral: "bg-[#f0f1f7] text-[#454650]"
};

function DashboardCanvas({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileDashboardNav />
      <section className="px-5 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</section>
    </>
  );
}

function StatusPill({ status, tone = "neutral" }: { status: string; tone?: StatusTone }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.5px] ${toneStyles[tone]}`}>{status}</span>;
}

function SmallMetric({ metric, icon }: { metric: Metric; icon: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-[#d7d8e4] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <span className={`grid size-11 place-items-center rounded-xl ${iconTile[metric.tone ?? "neutral"]}`}>{icon}</span>
        {metric.delta ? <StatusPill status={metric.delta} tone={metric.tone} /> : null}
      </div>
      <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">{metric.label}</p>
      <p className="mt-2 font-display text-[28px] font-extrabold leading-tight text-obligon-navy">{metric.value}</p>
      {metric.helper ? <p className="mt-3 text-xs font-bold uppercase text-[#737582]">{metric.helper}</p> : <div className="mt-4 h-1 rounded-full bg-[#ecfbd7]" />}
    </article>
  );
}

function DataTable({
  title,
  subtitle,
  columns,
  rows,
  actionLabel,
  onAction
}: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: TableRow[];
  actionLabel?: string;
  onAction?: (row?: TableRow) => void;
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
              <tr key={`${row.cells[0]}-${rowIndex}`} className="hover:bg-[#fbfbff] transition">
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

function OverviewPage({ onOpenPayout }: { onOpenPayout: () => void }) {
  const [range, setRange] = React.useState("Today");

  return (
    <DashboardCanvas>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Station Operator Console</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-obligon-navy">Mainland Energy Station #492</h1>
        </div>
        <button
          onClick={onOpenPayout}
          className="h-11 rounded-xl bg-obligon-green px-5 text-sm font-extrabold text-white shadow-green hover:bg-obligon-green/90 transition"
        >
          Request Settlement Payout
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SmallMetric metric={overviewMetrics[0]} icon={<ReceiptText size={20} />} />
        <SmallMetric metric={overviewMetrics[1]} icon={<CircleDollarSign size={21} />} />
        <article className="relative overflow-hidden rounded-xl border border-[#d7d8e4] bg-white p-6 shadow-sm">
          <span className="grid size-11 place-items-center rounded-xl bg-[#fff5d8] text-[#986700]">
            <Clock3 size={21} />
          </span>
          <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">PENDING SETTLEMENT</p>
          <p className="mt-2 font-display text-[28px] font-extrabold leading-tight text-obligon-navy">₦3,120,440.00</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-obligon-text">
            <span className="size-2 rounded-full bg-obligon-green animate-pulse" />
            Direct NUBAN ACH Batch processing
          </div>
        </article>
      </div>

      <section className="mt-8 grid rounded-xl border border-[#d7d8e4] bg-white sm:grid-cols-2 xl:grid-cols-4 shadow-sm">
        {quickStats.map(([label, value], index) => (
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
          title="Live Dispenser Authorizations"
          columns={["Reference", "Vehicle / Driver", "Station Hub", "Amount Dispensed", "Status", "Time"]}
          rows={overviewTransactions}
          actionLabel="View All Ledger"
        />
      </div>
    </DashboardCanvas>
  );
}

function FuelPricingPage() {
  const { success: toastSuccess } = useToast();
  const [pms, setPms] = React.useState("1020");
  const [ago, setAgo] = React.useState("1180");
  const [cng, setCng] = React.useState("280");
  const [syncing, setSyncing] = React.useState(false);

  async function handleSync(e: React.FormEvent) {
    e.preventDefault();
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 700));
    setSyncing(false);
    toastSuccess("Fuel pricing updated and broadcast to all digital dispensers.");
  }

  return (
    <DashboardCanvas>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Station Fuel Pricing</h1>
        <p className="mt-1 text-sm text-obligon-text">Configure live pump rates and sync prices directly with smart dispenser meters.</p>
      </div>

      <form onSubmit={handleSync} className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-xl border border-[#d7d8e4] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Fuel className="text-obligon-green" size={24} />
            <h2 className="font-display text-xl font-extrabold text-obligon-navy">PMS Petrol</h2>
          </div>
          <p className="mt-1 text-xs text-obligon-text">Premium Motor Spirit (Dispenser Pumps 1-6)</p>
          <div className="mt-6 flex items-center rounded-xl border border-[#cfd8cc] bg-[#f7fbf8] px-4">
            <span className="font-extrabold text-xl text-obligon-navy">₦</span>
            <input
              value={pms}
              onChange={(e) => setPms(e.target.value)}
              className="h-12 w-full bg-transparent px-2 font-display text-2xl font-extrabold text-obligon-navy outline-none"
              required
            />
            <span className="text-xs font-bold text-obligon-text">/ Litre</span>
          </div>
        </article>

        <article className="rounded-xl border border-[#d7d8e4] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Fuel className="text-obligon-blue" size={24} />
            <h2 className="font-display text-xl font-extrabold text-obligon-navy">AGO Diesel</h2>
          </div>
          <p className="mt-1 text-xs text-obligon-text">Automotive Gas Oil (Dispenser Pumps 7-10)</p>
          <div className="mt-6 flex items-center rounded-xl border border-[#cfd8cc] bg-[#f7fbf8] px-4">
            <span className="font-extrabold text-xl text-obligon-navy">₦</span>
            <input
              value={ago}
              onChange={(e) => setAgo(e.target.value)}
              className="h-12 w-full bg-transparent px-2 font-display text-2xl font-extrabold text-obligon-navy outline-none"
              required
            />
            <span className="text-xs font-bold text-obligon-text">/ Litre</span>
          </div>
        </article>

        <article className="rounded-xl border border-[#d7d8e4] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Fuel className="text-[#875b00]" size={24} />
            <h2 className="font-display text-xl font-extrabold text-obligon-navy">CNG Gas</h2>
          </div>
          <p className="mt-1 text-xs text-obligon-text">Compressed Natural Gas (Dispenser Bay 3)</p>
          <div className="mt-6 flex items-center rounded-xl border border-[#cfd8cc] bg-[#f7fbf8] px-4">
            <span className="font-extrabold text-xl text-obligon-navy">₦</span>
            <input
              value={cng}
              onChange={(e) => setCng(e.target.value)}
              className="h-12 w-full bg-transparent px-2 font-display text-2xl font-extrabold text-obligon-navy outline-none"
              required
            />
            <span className="text-xs font-bold text-obligon-text">/ SCm</span>
          </div>
        </article>

        <div className="lg:col-span-3 flex justify-end">
          <button
            disabled={syncing}
            type="submit"
            className="h-12 rounded-xl bg-obligon-green px-8 font-extrabold text-white shadow-green hover:bg-obligon-green/90 transition flex items-center gap-2"
          >
            {syncing ? <Loader2 size={18} className="animate-spin" /> : "Broadcast & Sync to Dispensers"}
          </button>
        </div>
      </form>
    </DashboardCanvas>
  );
}

function POSTerminalPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [code, setCode] = React.useState("");
  const [pump, setPump] = React.useState("Pump #04 (PMS)");
  const [amount, setAmount] = React.useState("25000");
  const [verifying, setVerifying] = React.useState(false);
  const [authReceipt, setAuthReceipt] = React.useState<{ code: string; vehicle: string; amount: number; driver: string; ref: string } | null>(null);

  async function handleAuthorize(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) {
      toastError("Please enter the complete 6-digit fleet authorization code.");
      return;
    }
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 800));
    setVerifying(false);
    const receipt = {
      code,
      vehicle: "Toyota Hilux (LND-234-XY)",
      amount: Number(amount) || 25000,
      driver: "Emeka Okafor (DRV-104)",
      ref: `POS-${Math.floor(100000 + Math.random() * 899999)}`
    };
    setAuthReceipt(receipt);
    toastSuccess(`Authorization ${receipt.ref} APPROVED. Pump activated.`);
  }

  return (
    <DashboardCanvas>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-extrabold text-obligon-navy">POS Authorization Terminal</h1>
          <p className="mt-1 text-sm text-obligon-text">Enter driver's 6-digit OTC code or tap NFC Fuelvista card to unlock dispenser.</p>
        </div>

        {authReceipt ? (
          <div className="rounded-2xl border border-obligon-border bg-white p-8 shadow-hero text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
              <Check size={32} />
            </span>
            <h2 className="mt-5 font-display text-3xl font-extrabold text-obligon-navy">Dispense Authorized</h2>
            <p className="mt-1 text-sm text-obligon-text">
              Reference: <strong className="font-mono font-extrabold text-obligon-navy">{authReceipt.ref}</strong>
            </p>

            <div className="mt-6 rounded-xl bg-[#f7fbf8] p-5 border border-obligon-border space-y-2 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-obligon-text">Fleet Vehicle</span>
                <span className="font-bold text-obligon-navy">{authReceipt.vehicle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-obligon-text">Driver</span>
                <span className="font-bold text-obligon-navy">{authReceipt.driver}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-obligon-text">Total Approved</span>
                <span className="font-extrabold text-obligon-green">₦{authReceipt.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-obligon-text">Dispenser Pump</span>
                <span className="font-bold text-obligon-navy">{pump}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  toastSuccess("Receipt sent to station thermal printer.");
                }}
                className="h-12 flex-1 rounded-xl border border-obligon-border font-bold text-obligon-navy flex items-center justify-center gap-2 hover:bg-obligon-mist transition"
              >
                <Printer size={18} />
                Print Receipt
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
                6-Digit Driver OTC Authorization Code
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
                  Select Pump Meter
                </label>
                <select
                  value={pump}
                  onChange={(e) => setPump(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#cfd8cc] bg-white px-3 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                >
                  <option>Pump #01 (PMS Petrol)</option>
                  <option>Pump #02 (PMS Petrol)</option>
                  <option>Pump #03 (PMS Petrol)</option>
                  <option>Pump #04 (PMS Petrol)</option>
                  <option>Pump #07 (AGO Diesel)</option>
                  <option>Pump #08 (AGO Diesel)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-extrabold uppercase text-obligon-text block mb-1.5">
                  Amount Requested (₦)
                </label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="numeric"
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

function SettlementsPage({ onOpenPayout }: { onOpenPayout: () => void }) {
  const { success: toastSuccess } = useToast();

  return (
    <DashboardCanvas>
      <div className="grid gap-8 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-5">
          <article className="rounded-xl border border-[#d7d8e4] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold text-obligon-navy">Linked Settlement Account</h2>
              <button
                type="button"
                className="text-xs font-extrabold text-obligon-green hover:underline"
                onClick={() => toastSuccess("Bank account update requested.")}
              >
                EDIT
              </button>
            </div>
            <div className="mt-5 rounded-xl bg-[#f7fbf8] p-4 border border-obligon-border">
              <p className="font-extrabold text-obligon-navy">Guaranty Trust Bank (GTBank)</p>
              <p className="mt-1 font-mono text-sm text-obligon-text">NUBAN: 0128492014</p>
              <p className="mt-1 text-xs font-bold text-obligon-green">MAINLAND ENERGY ENTERPRISE LTD</p>
            </div>
            <button
              onClick={onOpenPayout}
              className="mt-6 w-full h-11 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green hover:bg-obligon-green/90 transition"
            >
              Request Direct Payout
            </button>
          </article>
        </aside>

        <main>
          <DataTable
            title="Settlement Payout History"
            subtitle="Automated NUBAN disbursements and merchant clearing ledgers."
            columns={["Batch ID", "Settlement Period", "Gross Sales", "Net Payout", "Status", "Settled Date"]}
            rows={payoutRows}
            actionLabel="Export CSV"
            onAction={() => toastSuccess("Settlement history exported.")}
          />
        </main>
      </div>
    </DashboardCanvas>
  );
}

function DisputesPage() {
  const { success: toastSuccess } = useToast();

  return (
    <DashboardCanvas>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Disputes &amp; Reconciliations</h1>
        <p className="mt-1 text-sm text-obligon-text">Manage customer charge disputes, pump meter adjustments, and proof of dispensing.</p>
      </div>
      <DataTable
        title="Dispute Cases"
        columns={["Case ID", "Customer / Vehicle", "Claim Reason", "Amount Disputed", "Status", "Filed Date"]}
        rows={disputeRows}
        actionLabel="Review All"
        onAction={(row) => toastSuccess(`Opened dispute case review for ${row?.cells[0] ?? "case"}`)}
      />
    </DashboardCanvas>
  );
}

function StationProfilePage() {
  const { success: toastSuccess } = useToast();
  const [stationName, setStationName] = React.useState("Mainland Energy Station #492");
  const [address, setAddress] = React.useState("Plot 14, Commercial Avenue, Ikeja, Lagos");
  const [phone, setPhone] = React.useState("+234 803 456 7890");
  const [pumps, setPumps] = React.useState("12");
  const [amenities, setAmenities] = React.useState({
    restrooms: true,
    atm: true,
    carWash: true,
    cngBay: true,
    evCharger: false
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    toastSuccess("Station amenities and location profile saved.");
  }

  return (
    <DashboardCanvas>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Station Profile &amp; Amenities</h1>
        <p className="mt-1 text-sm text-obligon-text">Configure public station locator listings, available amenities, and manager contacts.</p>
      </div>

      <form onSubmit={handleSave} className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <article className="rounded-xl border border-[#d7d8e4] bg-white p-7 shadow-sm space-y-4">
          <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Location Details</h2>
          <label className="block">
            <span className="text-xs font-extrabold uppercase text-obligon-text">Station Brand &amp; Name</span>
            <input value={stationName} onChange={(e) => setStationName(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 font-bold text-obligon-navy outline-none focus:border-obligon-green" required />
          </label>
          <label className="block">
            <span className="text-xs font-extrabold uppercase text-obligon-text">Physical Address</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 font-bold text-obligon-navy outline-none focus:border-obligon-green" required />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-extrabold uppercase text-obligon-text">Manager Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 font-bold text-obligon-navy outline-none focus:border-obligon-green" required />
            </label>
            <label className="block">
              <span className="text-xs font-extrabold uppercase text-obligon-text">Active Fuel Pumps</span>
              <input value={pumps} onChange={(e) => setPumps(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 font-bold text-obligon-navy outline-none focus:border-obligon-green" required />
            </label>
          </div>
          <button type="submit" className="mt-6 h-12 rounded-xl bg-obligon-green px-8 font-extrabold text-white shadow-green">
            Save Profile
          </button>
        </article>

        <article className="rounded-xl border border-[#d7d8e4] bg-white p-7 shadow-sm">
          <h2 className="font-display text-2xl font-extrabold text-obligon-navy">On-Site Amenities</h2>
          <div className="mt-6 space-y-3">
            {[
              { key: "restrooms" as const, label: "Clean Customer Restrooms" },
              { key: "atm" as const, label: "24/7 ATM Gallery" },
              { key: "carWash" as const, label: "Automated Car Wash Bay" },
              { key: "cngBay" as const, label: "CNG Fast-Fill Nozzles" },
              { key: "evCharger" as const, label: "DC Fast EV Charger (50kW)" }
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between p-3.5 rounded-xl bg-[#f7fbf8] border border-obligon-border cursor-pointer">
                <span className="text-xs font-bold text-obligon-navy">{label}</span>
                <input
                  type="checkbox"
                  checked={amenities[key]}
                  onChange={(e) => setAmenities((p) => ({ ...p, [key]: e.target.checked }))}
                  className="size-4 text-obligon-green accent-obligon-green rounded"
                />
              </label>
            ))}
          </div>
        </article>
      </form>
    </DashboardCanvas>
  );
}

function StaffPage() {
  const { success: toastSuccess } = useToast();

  return (
    <DashboardCanvas>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-obligon-navy">Station Pump Staff</h1>
          <p className="mt-1 text-sm text-obligon-text">Manage attendant credentials, assigned shifts, and POS transaction limits.</p>
        </div>
        <button
          onClick={() => toastSuccess("Add Staff modal opened.")}
          className="h-11 rounded-xl bg-obligon-green px-5 text-sm font-extrabold text-white shadow-green"
        >
          + Add Attendant
        </button>
      </div>
      <DataTable
        title="Active Attendants &amp; Supervisors"
        columns={["Staff Member", "Role", "Shift Schedule", "Pumps Assigned", "Status", "Last Active"]}
        rows={staffRows}
        actionLabel="Permissions"
        onAction={(r) => toastSuccess(`Managing staff member ${r?.cells[0] ?? ""}`)}
      />
    </DashboardCanvas>
  );
}

export function DashboardScreen({ pageKey }: { pageKey: DashboardPageKey }) {
  const { success: toastSuccess } = useToast();
  const [payoutModalOpen, setPayoutModalOpen] = React.useState(false);
  const [payoutAmount, setPayoutAmount] = React.useState("1500000");

  function handlePayoutSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPayoutModalOpen(false);
    toastSuccess(`Payout request for ₦${Number(payoutAmount).toLocaleString()} submitted to bank.`);
  }

  const pages: Record<DashboardPageKey, React.ReactNode> = {
    overview: <OverviewPage onOpenPayout={() => setPayoutModalOpen(true)} />,
    pricing: <FuelPricingPage />,
    pos: <POSTerminalPage />,
    settlements: <SettlementsPage onOpenPayout={() => setPayoutModalOpen(true)} />,
    disputes: <DisputesPage />,
    profile: <StationProfilePage />,
    station: <StationProfilePage />,
    staff: <StaffPage />,
    transactions: <OverviewPage onOpenPayout={() => setPayoutModalOpen(true)} />,
    reports: <OverviewPage onOpenPayout={() => setPayoutModalOpen(true)} />,
    verification: <OverviewPage onOpenPayout={() => setPayoutModalOpen(true)} />,
    notifications: <OverviewPage onOpenPayout={() => setPayoutModalOpen(true)} />,
    settings: <StationProfilePage />
  };

  return (
    <>
      {pages[pageKey] ?? <OverviewPage onOpenPayout={() => setPayoutModalOpen(true)} />}

      {payoutModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#071853]/65 px-5 backdrop-blur-sm">
          <form onSubmit={handlePayoutSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-hero">
            <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Request Settlement Payout</h2>
            <p className="mt-1 text-sm text-obligon-text">Funds will be disbursed to GTBank NUBAN ending in 2014.</p>

            <label className="mt-5 block">
              <span className="text-xs font-extrabold uppercase text-obligon-text">Payout Amount (₦)</span>
              <input
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                inputMode="numeric"
                className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 font-display text-xl font-extrabold text-obligon-navy outline-none focus:border-obligon-green"
                required
              />
            </label>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setPayoutModalOpen(false)}
                className="h-11 flex-1 rounded-xl border border-[#071853] text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-11 flex-1 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green"
              >
                Confirm Payout
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
