"use client";

import * as React from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
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
  type LucideProps
} from "lucide-react";
import {
  desktopTopUps,
  mobileHistory,
  notifications,
  overviewMetrics,
  recentActivity,
  topUpHistory,
  transactionHistory,
  vehicles,
  type CustomerPageKey,
  type CustomerTone,
  type CustomerTransaction
} from "@/lib/mock/customer-data";
import { api } from "@/lib/services";
import type { Station } from "@/lib/services/types";
import { AsyncBoundary } from "@/components/shared/States";
import { useAsync } from "@/components/shared/useAsync";
import { CustomerModals, ModalFrame, type CustomerModalType } from "./CustomerModals";
import { ConfirmModal, PinModal } from "../shared/Dialogs";

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
  return <article className={`rounded-lg border border-[#dbe2d8] bg-white ${className}`}>{children}</article>;
}

function MiniIcon({ tone = "green", children }: { tone?: CustomerTone; children: React.ReactNode }) {
  return <span className={`grid size-10 place-items-center rounded-full ${toneClasses[tone]}`}>{children}</span>;
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="font-display text-2xl font-extrabold tracking-normal">{title}</h2>
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
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-6 py-6">
        <h2 className="font-display text-2xl font-extrabold">Vehicle Performance</h2>
        <button onClick={() => router.push("/customer/transactions")} className="text-sm font-extrabold text-obligon-green" type="button">View All</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead className="bg-[#f0f4f0] text-xs uppercase tracking-[0.8px] text-[#3f463d]">
            <tr><th className="px-6 py-4">Vehicle ID</th><th>Spend</th><th>Volume</th><th>Efficiency</th></tr>
          </thead>
          <tbody className="divide-y divide-[#eef3ee]">
            {vehicles.map(([id, spend, volume, efficiency]) => (
              <tr key={id}>
                <td className="px-6 py-4 font-bold text-obligon-green">{id}</td>
                <td>{spend}</td>
                <td>{volume}</td>
                <td className={efficiency === "76%" ? "text-[#d71920]" : "text-obligon-green"}>{efficiency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ActivityList({ desktop = false }: { desktop?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-6 py-6">
        <h2 className="font-display text-2xl font-extrabold">{desktop ? "Recent Activity" : "Recent Transactions"}</h2>
        <a href="/customer/transactions" className="text-sm font-bold text-obligon-green">View All</a>
      </div>
      <div className="divide-y divide-[#eef3ee]">
        {recentActivity.map((item) => (
          <a key={`${item.station}-${item.amount}`} href="/customer/transaction-detail" className="flex items-center gap-4 px-6 py-4">
            <MiniIcon tone="muted"><Fuel size={18} /></MiniIcon>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{item.station}</p>
              <p className="text-sm text-obligon-text">{desktop ? item.time : item.meta}</p>
            </div>
            <p className="font-extrabold">{item.amount}</p>
          </a>
        ))}
      </div>
    </Card>
  );
}

function OverviewPage() {
  return (
    <Canvas>
      <div className="lg:hidden">
        <h1 className="font-display text-[34px] font-extrabold leading-tight text-obligon-green">Good afternoon, Matt</h1>
        <p className="mt-3 text-base text-[#3f463d]">Here is your fleet overview for today.</p>
      </div>

      <div className="mt-8 grid gap-6 lg:mt-0 lg:grid-cols-[1fr_282px]">
        <Card className="p-6 lg:p-8">
          <div className="flex justify-between">
            <p className="text-xs font-extrabold uppercase tracking-[0.8px] text-[#3f463d]">Total Account Balance</p>
            <WalletCards size={20} className="text-obligon-green" />
          </div>
          <p className="mt-5 font-display text-[40px] font-extrabold leading-none lg:text-[64px]">₦485,000</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <span className="rounded-lg border border-[#b6d894] bg-[#e8fbd7] px-4 py-3">
              <span className="block text-xs font-extrabold uppercase text-obligon-green">MTD Savings</span>
              <span className="mt-1 block text-2xl font-extrabold text-obligon-lime">₦18,450</span>
            </span>
            <span className="hidden rounded-lg bg-[#e1e5e1] px-4 py-3 lg:block">
              <span className="block text-xs font-extrabold uppercase text-[#3f463d]">Lifetime Savings</span>
              <span className="mt-1 block text-2xl font-extrabold">₦245,780</span>
            </span>
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.8px] text-[#3f463d]">MTD Spend</p>
          <p className="mt-4 font-display text-[32px] font-extrabold text-[#b51f24]">₦215,600</p>
          <div className="mt-7 flex justify-between text-sm"><span className="font-bold text-[#3f463d]">Budget Usage</span><span>43%</span></div>
          <div className="mt-2 h-2 rounded-full bg-[#dce5da]"><span className="block h-full w-[43%] rounded-full bg-obligon-green" /></div>
          <p className="mt-3 text-right text-xs font-extrabold text-[#3f463d]">₦500,000 Limit</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[206px_206px_1fr]">
        <Card className="p-5"><Fuel className="text-obligon-green" size={20} /><p className="mt-2 text-sm font-bold text-[#3f463d]">Litres Consumed</p><p className="text-2xl font-extrabold">1,245 L</p></Card>
        <Card className="p-5"><History className="text-[#3754a5]" size={20} /><p className="mt-2 text-sm font-bold text-[#3f463d]">Transactions</p><p className="text-2xl font-extrabold">87</p></Card>
        <Card className="p-5"><p className="text-sm font-bold text-[#3f463d]">Security Status</p><p className="mt-4 text-sm"><span className="text-[#c1121f]">●</span> 2 Alerts <span className="ml-3 text-[#3754a5]">●</span> 1 Blocked <span className="ml-3 text-[#7a816f]">●</span> 0 Suspicious</p></Card>
      </div>

      <div className="mt-6 grid gap-6 lg:hidden">
        <Card className="p-6"><SectionTitle title="Fuel Spend Trend" action={<span className="rounded-full bg-[#eef3ee] px-4 py-2 text-sm">Jan - Jun</span>} /><TrendChart /></Card>
        <Card className="p-6 text-center"><h2 className="text-left font-display text-2xl font-extrabold">Fuel Efficiency</h2><div className="mx-auto mt-8 grid size-32 place-items-center rounded-full border-[12px] border-[#63b800]"><p className="text-3xl font-extrabold">87<br /><span className="text-xs font-normal">/100</span></p></div><div className="mt-8 space-y-4 text-left"><p>Average Consumption <span className="float-right font-extrabold">7.8 km/L</span></p><p>Average Cost/Litre <span className="float-right font-extrabold">₦1,025</span></p></div></Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_282px]">
        <VehicleTable />
        <ActivityList desktop />
      </div>
      <div className="mt-6 grid gap-4 lg:hidden">
        <Card className="border-l-4 border-l-[#c1121f] p-6"><div className="flex items-center gap-4"><MiniIcon tone="red"><ShieldCheck size={20} /></MiniIcon><div><p className="text-xs font-extrabold uppercase text-[#3f463d]">Security Status</p><p>2 Alerts | 1 Blocked | 0 Suspicious</p></div></div></Card>
        <Card className="border-l-4 border-l-obligon-green p-6"><div className="flex items-center gap-4"><MiniIcon tone="green"><HeartHandshake size={20} /></MiniIcon><div><p className="text-xs font-extrabold uppercase text-[#3f463d]">Lifetime Savings</p><p className="font-extrabold">₦245,780</p></div></div></Card>
      </div>
    </Canvas>
  );
}

function TransactionsPage() {
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [filters, setFilters] = React.useState({ dateRange: "All", station: "All Stations", vehicle: "All Vehicles", fuel: "All Fuels" });
  const [applied, setApplied] = React.useState(filters);
  const [selectedTxn, setSelectedTxn] = React.useState<CustomerTransaction | null>(null);

  const stations = Array.from(new Set(transactionHistory.map((row) => row.station)));
  const vehicles = Array.from(new Set(transactionHistory.map((row) => row.vehicle ?? ""))).filter(Boolean);
  const fuels = Array.from(new Set(transactionHistory.map((row) => row.fuel ?? "").filter(Boolean)));

  const filtered = transactionHistory.filter((row) => {
    if (applied.dateRange !== "All" && !(row.time ?? "").startsWith(applied.dateRange)) return false;
    if (applied.station !== "All Stations" && row.station !== applied.station) return false;
    if (applied.vehicle !== "All Vehicles" && row.vehicle !== applied.vehicle) return false;
    if (applied.fuel !== "All Fuels" && row.fuel !== applied.fuel) return false;
    return true;
  });

  const hasActiveFilters =
    applied.dateRange !== "All" || applied.station !== "All Stations" || applied.vehicle !== "All Vehicles" || applied.fuel !== "All Fuels";

  function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
    return (
      <label className="block">
        <span className="text-xs font-extrabold uppercase text-obligon-text">{label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 h-12 w-full rounded-lg border border-[#cfd8cc] bg-white px-3 text-sm font-bold outline-none"
        >
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <Canvas compact>
      <div className="lg:hidden">
        <h1 className="font-display text-3xl font-extrabold">Transaction History</h1>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {["Date Range", "Station", "Vehicle"].map((item) => (
            <button key={item} onClick={() => setFiltersOpen(true)} className="h-10 rounded-lg border border-[#dbe2d8] bg-white text-xs font-bold" type="button">{item}</button>
          ))}
        </div>
        <div className="mt-6 space-y-7">
          {mobileHistory.map((group) => <section key={group.group}><p className="mb-3 text-sm font-extrabold text-obligon-green">{group.group}</p><div className="space-y-3">{group.items.map((item) => <button key={item.station + item.time} type="button" onClick={() => setSelectedTxn({ station: item.station, meta: item.meta, amount: item.amount, time: item.time })} className="flex w-full rounded-lg bg-white p-4 text-left shadow-sm"><div className="flex-1"><p className="font-extrabold">{item.station}</p><p className="text-sm text-obligon-text">{item.meta}</p></div><div className="text-right"><p className="font-extrabold">{item.amount}</p><p className="text-sm text-obligon-text">{item.time}</p></div></button>)}</div></section>)}
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="mb-7 flex flex-wrap items-center gap-4 rounded-lg border border-[#dbe2d8] bg-white p-5">
          <div className="flex flex-wrap gap-3 text-sm font-bold">
            <span className="rounded-lg border border-[#dbe2d8] px-4 py-3">Date: {applied.dateRange}</span>
            <span className="rounded-lg border border-[#dbe2d8] px-4 py-3">Station: {applied.station}</span>
            <span className="rounded-lg border border-[#dbe2d8] px-4 py-3">Vehicle: {applied.vehicle}</span>
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className="ml-auto h-11 rounded-lg bg-obligon-green px-5 text-sm font-extrabold text-white"
            type="button"
          >
            Apply Filters
          </button>
          {hasActiveFilters ? (
            <button
              onClick={() => {
                const cleared = { dateRange: "All", station: "All Stations", vehicle: "All Vehicles", fuel: "All Fuels" };
                setFilters(cleared);
                setApplied(cleared);
              }}
              className="h-11 rounded-lg border border-[#20251f] px-5 text-sm font-extrabold"
              type="button"
            >
              Clear
            </button>
          ) : null}
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-[#f0f4f0] text-xs uppercase text-[#3f463d]">
              <tr>{["Station Name", "Vehicle ID", "Fuel Type", "Amount", "Timestamp"].map((h) => <th key={h} className="px-6 py-4">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#eef3ee]">
              {filtered.length > 0 ? (
                filtered.map((row) => (
                  <tr
                    key={`${row.station}-${row.time}`}
                    onClick={() => setSelectedTxn(row)}
                    className="cursor-pointer transition hover:bg-[#f7fbf8]"
                  >
                    <td className="px-6 py-5"><p className="font-extrabold">{row.station}</p><p className="text-sm text-obligon-text">{row.meta}</p></td>
                    <td>{row.vehicle}</td>
                    <td>{row.fuel}</td>
                    <td className="font-extrabold">{row.amount}</td>
                    <td>{row.time}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-sm font-bold text-obligon-text">No transactions match your filters.</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex justify-between border-t border-[#eef3ee] p-5 text-sm">
            <span>Showing 1-{filtered.length} of {filtered.length} transaction{filtered.length === 1 ? "" : "s"}</span>
            <span className="space-x-3"><button>Previous</button><button>Next</button></span>
          </div>
        </Card>
      </div>

      {filtersOpen ? (
        <ModalFrame onClose={() => setFiltersOpen(false)}>
          <div className="p-6">
            <h2 className="font-display text-2xl font-extrabold">Filter Transactions</h2>
            <p className="mt-2 text-sm text-obligon-text">Narrow your transaction history by date, station, vehicle and fuel.</p>
            <div className="mt-6 space-y-5">
              <Select
                label="Date Range"
                value={filters.dateRange}
                options={["All", "Oct 24", "Oct 23", "Oct 22"]}
                onChange={(value) => setFilters((prev) => ({ ...prev, dateRange: value }))}
              />
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
                  const cleared = { dateRange: "All", station: "All Stations", vehicle: "All Vehicles", fuel: "All Fuels" };
                  setFilters(cleared);
                  setApplied(cleared);
                }}
                className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  setApplied(filters);
                  setFiltersOpen(false);
                }}
                className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {selectedTxn ? (
        <ModalFrame onClose={() => setSelectedTxn(null)}>
          <div className="p-6">
            <span className="grid size-12 place-items-center rounded-full bg-[#eef3ff] text-obligon-blue"><Receipt size={22} /></span>
            <h2 className="mt-4 font-display text-3xl font-extrabold">Transaction Detail</h2>
            <p className="mt-1 text-sm text-obligon-text">Reference <span className="font-extrabold text-obligon-navy">TXN-{Math.abs(hashString(selectedTxn.station + (selectedTxn.time ?? ""))).toString().slice(0, 8)}</span></p>

            <div className="mt-6 rounded-lg bg-[#f7fbf8] p-5">
              <p className="text-xs font-bold uppercase text-obligon-text">Amount</p>
              <p className="mt-1 font-display text-4xl font-extrabold text-obligon-green">{selectedTxn.amount}</p>
            </div>

            <div className="mt-5 space-y-4">
              <DetailRow label="Station" value={selectedTxn.station} />
              <DetailRow label="Location" value={selectedTxn.meta ?? "—"} />
              <DetailRow label="Vehicle" value={selectedTxn.vehicle ?? "—"} />
              <DetailRow label="Fuel Type" value={selectedTxn.fuel ?? "—"} />
              <DetailRow label="Timestamp" value={selectedTxn.time ?? "—"} />
            </div>

            <button
              type="button"
              onClick={() => setSelectedTxn(null)}
              className="mt-7 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white"
            >
              Close
            </button>
          </div>
        </ModalFrame>
      ) : null}
    </Canvas>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#eef3ee] pb-3 last:border-0">
      <span className="text-sm font-bold text-obligon-text">{label}</span>
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
    ? { label: "BLOCKED", className: "bg-[#ffe8e8] px-3 py-1 text-xs font-extrabold text-[#c1121f]", bg: "bg-[#1a0808]" }
    : frozen
      ? { label: "FROZEN", className: "bg-[#fff3d8] px-3 py-1 text-xs font-extrabold text-[#9a6300]" }
      : { label: "ACTIVE STATUS", className: "bg-[#e8fbd7] px-3 py-1 text-xs font-extrabold text-obligon-green" };

  const freezeLabel = frozen ? "Unfreeze Card" : "Freeze Card";
  const freezeBody = frozen ? "Resume transactions on this card" : "Temporarily lock transactions";

  const cardActions: Array<{ title: string; body: string; Icon: ComponentType<LucideProps>; tone: CustomerTone; modal: CustomerModalType }> = [
    { title: "Replace Card", body: "Request a new physical card", Icon: CreditCard, tone: "green", modal: "replaceCard" },
    { title: "Report Lost", body: blocked ? "Card already blocked" : "Block and report stolen card", Icon: FileWarning, tone: "red", modal: "lostCard" },
    { title: freezeLabel, body: freezeBody, Icon: Snowflake, tone: "green", modal: "freezeCard" }
  ];

  const [pinAction, setPinAction] = React.useState<"lostCard" | "freezeCard" | null>(null);

  return (
    <Canvas>
      <div className="lg:hidden"><h1 className="font-display text-3xl font-extrabold">Card Management</h1><p className="mt-2 text-obligon-text">View and manage your active fleet subscription card.</p></div>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <article
          className={`relative min-h-[280px] overflow-hidden rounded-lg p-8 text-white ${
            blocked
              ? "bg-[linear-gradient(135deg,#2a0606,#1a0808)]"
              : "bg-[linear-gradient(135deg,#061958,#050816)]"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(170,248,87,.32),transparent_28%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex justify-between"><p className="font-display text-3xl font-extrabold">Obligon LTD</p><span className={`rounded-full ${status.className}`}>{status.label}</span></div>
            <div><p className="font-mono text-2xl tracking-[3px]">•••• •••• •••• 4092</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-white/60">CARDHOLDER NAME</p><p className="font-extrabold">Obligon LTD Enterprise Fleet</p></div><div><p className="text-xs text-white/60">AVAILABLE BALANCE</p><p className="font-extrabold">₦12,450.00</p></div></div></div>
          </div>
        </article>
        <div className="space-y-4">
          {cardActions.map(({ title, body, Icon, tone, modal }) => {
            const disabled = modal === "lostCard" && blocked;
            return (
              <button
                key={title}
                type="button"
                disabled={disabled}
                onClick={() => (modal === "lostCard" || modal === "freezeCard" ? setPinAction(modal) : onModal(modal))}
                className={`w-full rounded-lg border border-[#dbe2d8] bg-white p-5 text-left transition hover:border-obligon-green hover:bg-[#f3ffe8] ${
                  disabled ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                <div className="flex gap-4">
                  <MiniIcon tone={tone}><Icon size={19} /></MiniIcon>
                  <div>
                    <h2 className="font-extrabold">{title}</h2>
                    <p className="text-sm text-obligon-text">{body}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {pinAction ? (
        <PinModal
          open
          onClose={() => setPinAction(null)}
          onConfirm={() => onModal(pinAction)}
          title={pinAction === "lostCard" ? "Confirm Card Block" : "Confirm Card Freeze"}
          message={
            pinAction === "lostCard"
              ? "Enter your transaction PIN to permanently block this card. This action immediately stops all transactions."
              : "Enter your transaction PIN to freeze this card. You can unfreeze it anytime from this screen."
          }
          confirmLabel={pinAction === "lostCard" ? "Block Card" : "Freeze Card"}
        />
      ) : null}
    </Canvas>
  );
}

function WalletPage({ onModal }: { onModal: (modal: CustomerModalType) => void }) {
  const router = useRouter();
  return (
    <Canvas>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="font-display text-3xl font-extrabold">Wallet Management</h1><p className="mt-2 text-obligon-text">Top up and manage your fleet balance.</p></div><button onClick={() => onModal("topup")} className="h-12 rounded-lg bg-obligon-green px-6 font-extrabold text-white" type="button">Add Funds</button></div>
      <Card className="mt-8 p-7"><p className="text-xs font-extrabold uppercase text-obligon-text">Available Balance</p><p className="mt-3 font-display text-5xl font-extrabold">₦24,500.00</p><p className="mt-3 text-sm font-bold text-obligon-green">+12% • Auto-recharge enabled at ₦5,000</p></Card>
      <Card className="mt-8 overflow-hidden"><div className="flex items-center justify-between px-6 py-5"><h2 className="font-display text-2xl font-extrabold">Recent Transactions</h2><button onClick={() => router.push("/customer/transactions")} className="text-sm font-bold text-obligon-green" type="button">View All</button></div><div className="hidden lg:block"><table className="w-full text-left"><thead className="bg-[#f0f4f0] text-xs uppercase"><tr>{["Date","Reference","Method","Amount"].map(h=><th className="px-6 py-4" key={h}>{h}</th>)}</tr></thead><tbody>{desktopTopUps.map(row=><tr className="border-t border-[#eef3ee]" key={row[1]}>{row.map(cell=><td className="px-6 py-4" key={cell}>{cell}</td>)}</tr>)}</tbody></table></div><div className="divide-y divide-[#eef3ee] lg:hidden">{topUpHistory.map(([method,date,amount])=><div key={date} className="flex justify-between p-5"><div><p className="font-extrabold">{method}</p><p className="text-sm text-obligon-text">{date}</p></div><p className="font-extrabold text-obligon-green">{amount}</p></div>)}</div></Card>
    </Canvas>
  );
}

function buildMapUrl(list: Array<{ lat: number; lng: number }>) {
  if (list.length === 0) return "https://www.openstreetmap.org/export/embed.html?bbox=-74.05,40.69,-73.97,40.76&layer=mapnik";
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
  const [detail, setDetail] = React.useState<Station | null>(null);
  const [directionTarget, setDirectionTarget] = React.useState<Station | null>(null);

  const allFuels = Array.from(new Set(stations?.flatMap((station) => station.fuels) ?? []));

  const visible = stations?.filter((station) => {
    const matchesQuery =
      query.trim() === "" ||
      station.name.toLowerCase().includes(query.toLowerCase()) ||
      station.address.toLowerCase().includes(query.toLowerCase());
    const matchesFuel = selectedFuels.length === 0 || selectedFuels.some((fuel) => station.fuels.includes(fuel));
    return matchesQuery && matchesFuel;
  }) ?? [];

  function toggleFuel(fuel: string) {
    setSelectedFuels((current) => (current.includes(fuel) ? current.filter((item) => item !== fuel) : [...current, fuel]));
  }

  return (
    <AsyncBoundary
      status={status}
      error={error?.message ?? null}
      isEmpty={!stations || stations.length === 0}
      onRetry={reload}
      loadingLabel="Loading stations…"
      empty={{ title: "No stations available", message: "We couldn't load station locations for your network right now." }}
    >
      <Canvas>
      <div className="mb-6 flex gap-3 rounded-lg border border-[#dbe2d8] bg-white p-3">
        <div className="flex flex-1 items-center gap-2">
          <MapPinned size={18} className="text-obligon-green" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent px-2 outline-none"
            placeholder="Search locations or routes..."
          />
        </div>
        <button
          onClick={() => setFuelsOpen(true)}
          className={`rounded-lg px-4 font-extrabold text-white ${selectedFuels.length > 0 ? "bg-obligon-green" : "bg-obligon-green/80"}`}
          type="button"
        >
          {selectedFuels.length > 0 ? `Fuels (${selectedFuels.length})` : "All Fuels"}
        </button>
      </div>

      {selectedFuels.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {selectedFuels.map((fuel) => (
            <button
              key={fuel}
              type="button"
              onClick={() => toggleFuel(fuel)}
              className="rounded-full bg-[#e8fbd7] px-3 py-1 text-xs font-extrabold text-obligon-green"
            >
              {fuel} ✕
            </button>
          ))}
          <button type="button" onClick={() => setSelectedFuels([])} className="rounded-full border border-[#dbe2d8] px-3 py-1 text-xs font-extrabold text-obligon-text">
            Clear
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <Card className="relative min-h-[520px] overflow-hidden bg-[#dfe8ed]">
          <iframe
            title="Obligon LTD station map"
            src={buildMapUrl(stations ?? [])}
            className="h-full min-h-[520px] w-full border-0"
            loading="lazy"
          />
          <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-white/90 px-4 py-2 text-sm font-extrabold text-obligon-green shadow-sm">
            ₦3.45 avg • {visible.length} location{visible.length === 1 ? "" : "s"}
          </div>
        </Card>
        <div className="space-y-4">
          {visible.length > 0 ? (
            visible.map((station) => (
              <Card key={station.name} className="p-5">
                <div className="flex justify-between">
                  <div>
                    <h2 className="font-display text-xl font-extrabold">{station.name}</h2>
                    <p className="text-sm text-obligon-text">{station.distance}</p>
                    <p className="mt-1 text-sm text-obligon-text">{station.address}</p>
                  </div>
                  <MapPinned className="text-obligon-green" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <p className="rounded-lg bg-[#f7fbf8] p-3 text-sm"><span className="block text-xs font-bold">DIESEL</span><span className="font-extrabold">{station.diesel}</span> /gal</p>
                  <p className="rounded-lg bg-[#f7fbf8] p-3 text-sm"><span className="block text-xs font-bold">UNLEADED</span><span className="font-extrabold">{station.unleaded}</span> /gal</p>
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => setDirectionTarget(station)}
                    className="h-10 flex-1 rounded-lg bg-obligon-green font-extrabold text-white"
                    type="button"
                  >
                    Directions
                  </button>
                  <button
                    onClick={() => setDetail(station)}
                    className="h-10 flex-1 rounded-lg border border-[#dbe2d8] font-extrabold"
                    type="button"
                  >
                    Details
                  </button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center"><p className="font-extrabold text-obligon-text">No stations match your search.</p></Card>
          )}
        </div>
      </div>

      {fuelsOpen ? (
        <ModalFrame onClose={() => setFuelsOpen(false)}>
          <div className="p-6">
            <h2 className="font-display text-2xl font-extrabold">Filter by Fuel</h2>
            <p className="mt-2 text-sm text-obligon-text">Show only stations that offer the selected fuel types.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {allFuels.map((fuel) => {
                const selected = selectedFuels.includes(fuel);
                return (
                  <button
                    key={fuel}
                    type="button"
                    onClick={() => toggleFuel(fuel)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-extrabold transition ${
                      selected ? "border-obligon-green bg-obligon-green/10 text-obligon-green" : "border-[#dbe2d8] bg-white text-obligon-text"
                    }`}
                  >
                    {selected ? <Check size={14} /> : null}{fuel}
                  </button>
                );
              })}
            </div>
            <div className="mt-7 flex gap-3">
              <button type="button" onClick={() => setSelectedFuels([])} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">Reset</button>
              <button type="button" onClick={() => setFuelsOpen(false)} className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white">Show Results</button>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {detail ? (
        <ModalFrame onClose={() => setDetail(null)}>
          <div className="p-6">
            <span className="grid size-12 place-items-center rounded-full bg-[#eef3ff] text-obligon-blue"><MapPinned size={22} /></span>
            <h2 className="mt-4 font-display text-3xl font-extrabold">{detail.name}</h2>
            <p className="mt-1 text-sm text-obligon-text">{detail.address}</p>
            <p className="mt-1 text-sm font-bold text-obligon-green">{detail.distance} away • {detail.hours}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-[#f7fbf8] p-4"><p className="text-xs font-bold uppercase">Diesel</p><p className="mt-1 font-extrabold text-xl">{detail.diesel}</p></div>
              <div className="rounded-lg bg-[#f7fbf8] p-4"><p className="text-xs font-bold uppercase">Unleaded</p><p className="mt-1 font-extrabold text-xl">{detail.unleaded}</p></div>
            </div>

            <p className="mt-5 text-xs font-extrabold uppercase text-obligon-text">Available Fuels</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.fuels.map((fuel) => (
                <span key={fuel} className="rounded-full bg-[#e8fbd7] px-3 py-1 text-xs font-extrabold text-obligon-green">{fuel}</span>
              ))}
            </div>

            <iframe
              title={`Map of ${detail.name}`}
              src={buildMapUrl([detail])}
              className="mt-5 h-48 w-full rounded-lg border-0"
              loading="lazy"
            />

            <div className="mt-7 flex gap-3">
              <button type="button" onClick={() => { setDetail(null); setDirectionTarget(detail); }} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">Get Directions</button>
              <button type="button" onClick={() => setDetail(null)} className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white">Close</button>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {directionTarget ? (
        <ModalFrame onClose={() => setDirectionTarget(null)}>
          <div className="p-6">
            <h2 className="font-display text-2xl font-extrabold">Directions</h2>
            <p className="mt-2 text-sm text-obligon-text">Route to <span className="font-extrabold text-obligon-navy">{directionTarget.name}</span>.</p>
            <div className="mt-5 overflow-hidden rounded-lg">
              <iframe
                title={`Route to ${directionTarget.name}`}
                src={buildMapUrl([directionTarget])}
                className="h-44 w-full border-0"
                loading="lazy"
              />
            </div>
            <div className="mt-5 space-y-3 text-sm font-bold">
              <div className="flex items-center justify-between rounded-lg bg-[#f7fbf8] p-3"><span>Distance</span><span className="text-obligon-green">{directionTarget.distance}</span></div>
              <div className="flex items-center justify-between rounded-lg bg-[#f7fbf8] p-3"><span>Estimated arrival</span><span className="text-obligon-green">~6 min</span></div>
              <div className="flex items-center justify-between rounded-lg bg-[#f7fbf8] p-3"><span>Address</span><span className="text-obligon-navy">{directionTarget.address}</span></div>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionTarget.address)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-obligon-green font-extrabold text-white"
            >
                Open in Maps
              </a>
            </div>
          </ModalFrame>
        ) : null}
      </Canvas>
    </AsyncBoundary>
  );
}

function SupportPage({ onModal }: { onModal: (modal: CustomerModalType) => void }) {
  const [reportOpen, setReportOpen] = React.useState(false);
  const [conversationStarted, setConversationStarted] = React.useState(false);
  const [openFaq, setOpenFaq] = React.useState<string | null>(null);
  const faqs = [
    { question: "How to freeze my card", answer: "Open the Card page, choose Freeze Card, and confirm the request with your transaction PIN. You can return to the same page to unfreeze the card when needed." },
    { question: "Where can I use my card?", answer: "Use your card at participating Obligon LTD network stations. Open Station Locator to search nearby locations, view fuel availability, and get directions." },
    { question: "Reporting a transaction issue", answer: "Select Report a transaction issue, choose the issue type, and provide the relevant details. You can attach a supporting document before submitting the report." }
  ];
  return (
    <Canvas>
      <h1 className="font-display text-4xl font-extrabold">Support Center</h1><p className="mt-3 text-lg text-obligon-text">How can we help you accelerate your fleet operations today?</p>
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card className="p-6"><MessageCircle className="text-obligon-green" /><h2 className="mt-5 font-display text-2xl font-extrabold">Chat with us</h2><p className="mt-2 text-obligon-text">Connect with a support agent instantly for real-time assistance.</p><button onClick={() => setConversationStarted(true)} className="mt-6 h-11 rounded-lg bg-obligon-green px-5 font-extrabold text-white" type="button">{conversationStarted ? "CONVERSATION REQUESTED" : "START CONVERSATION"}</button>{conversationStarted ? <p className="mt-3 rounded-lg bg-[#e8fbd7] p-3 text-sm font-bold text-obligon-green" role="status">Your support conversation is queued for this frontend session. A live-support service is required to connect an agent.</p> : null}</Card>
        <Card className="p-6"><AlertTriangle className="text-[#c1121f]" /><h2 className="mt-5 font-display text-2xl font-extrabold">Report a transaction issue</h2><p className="mt-2 text-obligon-text">Dispute a charge or report anomalies in your billing statement.</p><button onClick={() => setReportOpen(true)} className="mt-6 h-11 rounded-lg bg-[#20251f] px-5 font-extrabold text-white" type="button">FILE REPORT</button></Card>
      </div>
      <Card className="mt-8 overflow-hidden"><h2 className="px-6 pb-2 pt-6 font-display text-2xl font-extrabold">Frequently Asked Questions</h2>{faqs.map(({ question, answer }) => { const open = openFaq === question; const answerId = `faq-${question.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`; return <article key={question} className="border-t border-[#eef3ee] first:mt-4"><button type="button" onClick={() => setOpenFaq((current) => current === question ? null : question)} aria-expanded={open} aria-controls={answerId} className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left font-bold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-obligon-green"><span>{question}</span><ChevronDown size={20} className={`shrink-0 text-obligon-green transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" /></button>{open ? <div id={answerId} className="px-6 pb-5 text-sm leading-6 text-obligon-text">{answer}</div> : null}</article>; })}</Card>

      <ConfirmModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onConfirm={() => onModal("report")}
        title="Report a transaction issue?"
        message="This will open a formal dispute for our support team to review. Continue?"
        confirmLabel="Open Report"
        tone="red"
      />
    </Canvas>
  );
}

function TransactionDetailPage({ onModal }: { onModal: (modal: CustomerModalType) => void }) {
  const [reportOpen, setReportOpen] = React.useState(false);
  const [receiptPrepared, setReceiptPrepared] = React.useState(false);
  function downloadReceipt() {
    const content = "Obligon LTD receipt summary\nMerchant: Pilot Travel Center #492\nDate: Oct 24, 2023, 2:15 PM\nAmount: ₦342.50\nFuel: Diesel #2, 75.000 gal\nAuthorization: AUTH-88392-XT\n\nThis is a frontend-generated receipt summary. A backend service is required for an official receipt.";
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "obligon-receipt-summary.txt";
    link.click();
    URL.revokeObjectURL(url);
    setReceiptPrepared(true);
  }
  return (
    <Canvas>
      <Card className="mx-auto max-w-3xl p-7"><p className="text-xs font-extrabold uppercase text-obligon-text">Transaction Detail</p><h1 className="mt-2 font-display text-3xl font-extrabold">Pilot Travel Center #492</h1><p className="mt-1 text-obligon-text">Oct 24, 2023 • 2:15 PM</p><div className="mt-7 rounded-lg bg-[#f7fbf8] p-6 text-center"><p className="text-sm font-bold text-obligon-text">Total Amount</p><p className="font-display text-5xl font-extrabold">₦342.50</p><Status status="Completed" /></div><div className="mt-7 grid gap-5 sm:grid-cols-2">{[["FUEL TYPE","Diesel #2"],["GALLONS","75.000 gal"],["PRICE PER GALLON","₦4.569"],["AUTH CODE","AUTH-88392-XT"],["CARD USED","•••• •••• •••• 4092"],["PAYMENT METHOD","•••• 4289"]].map(([l,v])=><div key={l}><p className="text-xs font-extrabold uppercase text-obligon-text">{l}</p><p className="mt-1 font-extrabold">{v}</p></div>)}</div><div className="mt-8 flex gap-3"><button onClick={downloadReceipt} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold" type="button"><Download className="inline" size={17}/> Download Receipt</button><button onClick={()=>setReportOpen(true)} className="h-12 flex-1 rounded-lg bg-[#20251f] font-extrabold text-white" type="button">Report a Problem</button></div>{receiptPrepared ? <p className="mt-4 rounded-lg bg-[#e8fbd7] p-3 text-sm font-bold text-obligon-green" role="status">A local receipt summary was downloaded. An official receipt requires the transaction service.</p> : null}</Card>

      <ConfirmModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onConfirm={() => onModal("report")}
        title="Report a problem with this transaction?"
        message="Our team will investigate this charge. You can track the report from the Support Center."
        confirmLabel="Report"
        tone="red"
      />
    </Canvas>
  );
}

function Status({ status }: { status: string }) {
  return <span className="mt-3 inline-flex rounded-full bg-[#e8fbd7] px-3 py-1 text-xs font-extrabold text-obligon-green">{status}</span>;
}

function ReportPage({ onModal }: { onModal: (modal: CustomerModalType) => void }) {
  const [reportOpen, setReportOpen] = React.useState(false);
  return (
    <Canvas>
      <Card className="mx-auto max-w-2xl p-7"><h1 className="font-display text-3xl font-extrabold">Report a Problem</h1><p className="mt-2 text-obligon-text">Transaction at Station #4092</p><button onClick={()=>setReportOpen(true)} className="mt-8 h-12 rounded-lg bg-obligon-green px-6 font-extrabold text-white" type="button">Open Report Form</button></Card>

      <ConfirmModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onConfirm={() => onModal("report")}
        title="Open a problem report?"
        message="This starts a support ticket tied to this transaction. Continue?"
        confirmLabel="Open Report"
        tone="red"
      />
    </Canvas>
  );
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-obligon-green" : "bg-[#cfd8cc]"}`}
    >
      <span
        className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`}
      />
    </button>
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
  const personalFields = [
    ["Full Name", "Fleet Manager"],
    ["Job Title", "Logistics Director"],
    ["Email Address", "manager@obligon.enterprise.com"],
    ["Phone Number", "+1 (555) 019-8472"]
  ];
  const [notificationPrefs, setNotificationPrefs] = React.useState({
    push: true,
    transactions: true,
    marketing: false
  });
  const notificationOptions: Array<{ key: keyof typeof notificationPrefs; label: string }> = [
    { key: "push", label: "Push Notifications" },
    { key: "transactions", label: "Transaction Alerts" },
    { key: "marketing", label: "Marketing Updates" }
  ];
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  return (
    <Canvas>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <Card className="p-7">
          <h1 className="font-display text-3xl font-extrabold">Personal Information</h1>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {personalFields.map(([label, value]) => (
              <label key={label}>
                <span className="text-xs font-extrabold uppercase text-obligon-text">{label}</span>
                <input className="mt-2 h-12 w-full rounded-lg border border-[#dbe2d8] px-4 font-bold outline-none" defaultValue={value} />
              </label>
            ))}
          </div>
          <h2 className="mt-8 font-display text-2xl font-extrabold">Notification Preferences</h2>
          {notificationOptions.map(({ key, label }) => (
            <div key={key} className="mt-4 flex items-center justify-between rounded-lg bg-[#f7fbf8] p-4 font-bold">
              <span>{label}</span>
              <ToggleSwitch
                label={label}
                checked={notificationPrefs[key]}
                onChange={(checked) => setNotificationPrefs((prefs) => ({ ...prefs, [key]: checked }))}
              />
            </div>
          ))}
          <button onClick={() => setSaved(true)} className="mt-8 h-12 rounded-lg bg-obligon-green px-6 font-extrabold text-white" type="button">Save Changes</button>{saved ? <p className="mt-4 rounded-lg bg-[#e8fbd7] p-3 text-sm font-bold text-obligon-green" role="status">Changes are saved for this frontend session. A profile service is required to persist them.</p> : null}
        </Card>
        <Card className="p-7">
          <h2 className="font-display text-2xl font-extrabold">Security Settings</h2>

          <button
            type="button"
            onClick={() => onModal("changePin")}
            className="mt-5 flex w-full items-center gap-4 rounded-lg p-3 text-left transition hover:bg-[#f7fbf8]"
          >
            <MiniIcon tone="green"><LockKeyhole size={18} /></MiniIcon>
            <span className="flex-1">
              <span className="block font-extrabold">Change PIN</span>
              <span className="block text-sm text-obligon-text">Update your 4-digit access code</span>
            </span>
            <ArrowRight size={18} className="text-obligon-text" />
          </button>

          <button
            type="button"
            onClick={() => onModal("biometrics")}
            className="mt-3 flex w-full items-center gap-4 rounded-lg p-3 text-left transition hover:bg-[#f7fbf8]"
          >
            <MiniIcon tone={biometrics ? "green" : "muted"}><ShieldCheck size={18} /></MiniIcon>
            <span className="flex-1">
              <span className="block font-extrabold">{biometrics ? "Biometrics Enabled" : "Enable Biometrics"}</span>
              <span className="block text-sm text-obligon-text">Use FaceID or Fingerprint to login</span>
            </span>
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ${
                biometrics ? "bg-[#e8fbd7] text-obligon-green" : "bg-[#eef3ee] text-obligon-text"
              }`}
            >
              {biometrics ? "On" : "Off"}
            </span>
          </button>

          <button onClick={() => setLogoutOpen(true)} className="mt-8 h-11 w-full rounded-lg border border-[#20251f] font-extrabold" type="button">Log Out</button>
        </Card>
      </div>

      <ConfirmModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => router.push("/login")}
        title="Log Out?"
        message="You will be signed out of your Obligon LTD account on this device. Any unsaved changes will be lost."
        confirmLabel="Log Out"
        tone="red"
      />
    </Canvas>
  );
}

function NotificationsPage() {
  return (
    <Canvas><h1 className="font-display text-3xl font-extrabold">Notifications</h1><p className="mt-2 text-obligon-text">Stay updated with your latest alerts and system messages.</p><Card className="mt-8 overflow-hidden">{["TODAY","YESTERDAY","OLDER"].map(group=><section key={group} className="border-b border-[#eef3ee] p-5 last:border-0"><p className="mb-3 text-xs font-extrabold uppercase text-obligon-green">{group}</p>{notifications.filter(n=>n.group===group).map(n=><article key={n.title} className="flex gap-4 py-3"><MiniIcon tone={n.title.includes("Security")?"red":"green"}><Bell size={17}/></MiniIcon><div className="flex-1"><h2 className="font-extrabold">{n.title}</h2><p className="text-sm text-obligon-text">{n.body}</p></div><p className="text-xs text-obligon-text">{n.time}</p></article>)}</section>)}</Card></Canvas>
  );
}

export function CustomerScreen({ pageKey }: { pageKey: CustomerPageKey }) {
  const [modal, setModal] = React.useState<CustomerModalType>(null);
  const [biometrics, setBiometrics] = React.useState(false);
  const [cardFrozen, setCardFrozen] = React.useState(false);
  const [cardBlocked, setCardBlocked] = React.useState(false);
  const pages: Record<CustomerPageKey, React.ReactNode> = {
    overview: <OverviewPage />,
    transactions: <TransactionsPage />,
    card: <CardPage onModal={setModal} frozen={cardFrozen} blocked={cardBlocked} />,
    wallet: <WalletPage onModal={setModal} />,
    stations: <StationsPage />,
    support: <SupportPage onModal={setModal} />,
    transactionDetail: <TransactionDetailPage onModal={setModal} />,
    reportProblem: <ReportPage onModal={setModal} />,
    profile: (
      <ProfilePage onModal={setModal} biometrics={biometrics} onBiometricsChange={setBiometrics} />
    ),
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
      />
    </>
  );
}
