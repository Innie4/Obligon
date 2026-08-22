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
  Filter,
  Fuel,
  MapPin,
  MoreVertical,
  Plus,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  X
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
} from "./dashboard-data";
import { MobileDashboardNav } from "./MobileDashboardNav";
import { ActionFeedback, type ActionState } from "@/components/shared/Dialogs";

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

type ActionPayload = {
  title: string;
  body: string;
  confirmLabel?: string;
  details?: string[];
  requiresNote?: boolean;
  viewOnly?: boolean;
};

function DashboardCanvas({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileDashboardNav />
      <section className="px-5 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</section>
    </>
  );
}

function ActionModal({ action, onClose }: { action: ActionPayload | null; onClose: () => void }) {
  const [note, setNote] = React.useState("");
  const [state, setState] = React.useState<ActionState>("idle");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (action) {
      setNote("");
      setState("idle");
      setError("");
    }
  }, [action]);

  if (!action) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!action) return;
    if (action.requiresNote && !note.trim()) {
      setError("Add a short reference note before continuing.");
      setState("error");
      return;
    }

    setError("");
    setState("loading");
    window.setTimeout(() => setState("success"), 450);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071853]/65 px-5 backdrop-blur-sm" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label={action.title} className="w-full max-w-md rounded-lg border border-[#d7d8e4] bg-white p-6 shadow-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[1.2px] text-obligon-green">Dashboard action</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-obligon-navy">{action.title}</h2>
          </div>
          <button className="grid size-9 place-items-center rounded-lg bg-[#f2f4fb] text-obligon-text focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2" onClick={onClose} type="button" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        <p className="mt-4 text-sm leading-6 text-obligon-text">{action.body}</p>
        {action.details?.length ? (
          <dl className="mt-5 divide-y divide-[#e3e4ef] rounded-lg border border-[#d7d8e4] bg-[#fbfbff] px-4">
            {action.details.map((detail) => {
              const [label, value] = detail.split(": ");
              return <div key={detail} className="py-3 text-sm"><dt className="font-bold text-obligon-navy">{label}</dt><dd className="mt-1 text-obligon-text">{value ?? label}</dd></div>;
            })}
          </dl>
        ) : null}
        {action.viewOnly ? null : (
          <form onSubmit={submit}>
            <label className="mt-6 block">
              <span className="text-[11px] font-extrabold uppercase tracking-[1px] text-obligon-text">Reference note{action.requiresNote ? " (required)" : " (optional)"}</span>
              <textarea value={note} onChange={(event) => { setNote(event.target.value); setError(""); if (state === "error") setState("idle"); }} aria-invalid={Boolean(error)} aria-describedby={error ? "dashboard-action-error" : undefined} className="mt-2 min-h-28 w-full rounded-lg border border-[#d7d8e4] px-4 py-3 text-sm outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20" placeholder="Add context for this action." />
            </label>
            <ActionFeedback state={state} loadingMessage="Preparing this frontend-only update…" successMessage="Completed for this session. A backend service is still required for permanent processing." errorMessage={error} />
            <p className="mt-3 text-xs leading-5 text-obligon-text">This action updates the current frontend session only. It does not claim that a server-side record, payment, message, or export has been completed.</p>
            <div className="mt-6 flex gap-3">
              {state === "success" ? (
                <button className="h-11 flex-1 rounded-lg bg-obligon-green text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2" onClick={onClose} type="button">Close</button>
              ) : (
                <>
                  <button className="h-11 flex-1 rounded-lg bg-obligon-green text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2" disabled={state === "loading"} type="submit">{state === "loading" ? "Working…" : action.confirmLabel ?? "Continue"}</button>
                  <button className="h-11 flex-1 rounded-lg border border-[#d7d8e4] text-sm font-bold text-obligon-navy focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2" onClick={onClose} type="button">Cancel</button>
                </>
              )}
            </div>
          </form>
        )}
        {action.viewOnly ? <button className="mt-6 h-11 w-full rounded-lg bg-obligon-green text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2" onClick={onClose} type="button">Close</button> : null}
      </section>
    </div>
  );
}

function FigmaHeader({
  pageKey,
  controls,
  onAction
}: {
  pageKey: DashboardPageKey;
  controls?: React.ReactNode;
  onAction: (action: ActionPayload) => void;
}) {
  const page = pageCopy[pageKey];

  return (
    <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-2xl">
        {page.kicker ? (
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-8 rounded-full bg-obligon-lime" />
            <p className="text-[11px] font-extrabold uppercase tracking-[1.2px] text-obligon-green">{page.kicker}</p>
          </div>
        ) : null}
        <h1 className="mt-3 font-display text-[34px] font-extrabold leading-[1.15] tracking-normal text-obligon-navy">{page.title}</h1>
        {page.description ? <p className="mt-2 max-w-xl text-[15px] leading-6 text-obligon-text">{page.description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {controls}
        {page.primaryAction ? (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-obligon-green px-4 text-xs font-extrabold uppercase tracking-[0.3px] text-white shadow-green"
            type="button"
            onClick={() =>
              onAction({
                title: page.primaryAction ?? "Dashboard Action",
                body: "Review the details below, then continue with this frontend-only workflow.",
                confirmLabel: page.primaryAction ?? "Continue"
              })
            }
          >
            <Plus size={15} />
            {page.primaryAction}
          </button>
        ) : null}
      </div>
    </header>
  );
}

function Tabs({ items }: { items: string[] }) {
  const [active, setActive] = React.useState(items[0]);

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setActive(item)}
          className={`h-10 rounded-lg px-4 text-xs font-extrabold ${
            active === item ? "bg-obligon-green text-white" : "border border-[#d7d8e4] bg-white text-obligon-text"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function StatusPill({ status, tone = "neutral" }: { status: string; tone?: StatusTone }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.5px] ${toneStyles[tone]}`}>{status}</span>;
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
  onAction: (action: ActionPayload) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#d7d8e4] bg-white">
      <div className="flex flex-col gap-4 border-b border-[#e3e4ef] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-extrabold text-obligon-navy">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs font-medium text-obligon-text">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {actionLabel ? (
            <button
              type="button"
              onClick={() => onAction({ title: actionLabel, body: `Review the ${actionLabel.toLowerCase()} workflow, then confirm the frontend-only action.`, confirmLabel: actionLabel })}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#f0f4e8] px-3 text-xs font-extrabold text-obligon-green"
            >
              {actionLabel}
              <ArrowRight size={14} />
            </button>
          ) : null}
          <button type="button" onClick={() => onAction({ title: `${title} options`, body: "No additional bulk actions are available in this frontend-only view.", viewOnly: true })} className="grid size-9 place-items-center rounded-lg border border-[#d7d8e4] text-obligon-text focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2" aria-label={`More ${title} actions`}>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className="bg-[#fbfbff]">
            <tr className="border-b border-[#e3e4ef] text-[11px] font-extrabold uppercase tracking-[0.8px] text-[#737582]">
              {columns.map((column) => (
                <th key={column} className="px-6 py-4">
                  {column}
                </th>
              ))}
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ececf5]">
            {rows.map((row, rowIndex) => (
              <tr key={`${row.cells[0]}-${rowIndex}`} className="hover:bg-[#fbfbff]">
                {row.cells.map((cell, cellIndex) => {
                  const parts = cell.split("\n");
                  return (
                    <td key={`${cell}-${cellIndex}`} className="px-6 py-4 align-middle text-sm">
                      <p className="font-bold text-obligon-navy">{parts[0]}</p>
                      {parts.slice(1).map((part) => (
                        <p key={part} className="mt-0.5 text-xs font-medium text-obligon-text">
                          {part}
                        </p>
                      ))}
                    </td>
                  );
                })}
                <td className="px-6 py-4">{row.status ? <StatusPill status={row.status} tone={row.tone} /> : null}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      const label = row.action ?? "View";
                      const isReadOnly = /view|details/i.test(label);
                      onAction({ title: label, body: isReadOnly ? `Details for ${row.cells[0]}.` : `Review and confirm ${label.toLowerCase()} for ${row.cells[0]}.`, details: [`Record: ${row.cells[0]}`, `Status: ${row.status ?? "Available"}`], confirmLabel: label, requiresNote: /dispute|reject|resolve/i.test(label), viewOnly: isReadOnly });
                    }}
                    className="text-xs font-extrabold text-obligon-green"
                  >
                    {row.action ?? "View"}
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

function SmallMetric({ metric, icon }: { metric: Metric; icon: React.ReactNode }) {
  return (
    <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
      <div className="flex items-start justify-between">
        <span className={`grid size-11 place-items-center rounded-lg ${iconTile[metric.tone ?? "neutral"]}`}>{icon}</span>
        {metric.delta ? <StatusPill status={metric.delta} tone={metric.tone} /> : null}
      </div>
      <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">{metric.label}</p>
      <p className="mt-2 font-display text-[28px] font-extrabold leading-tight text-obligon-navy">{metric.value}</p>
      {metric.helper ? <p className="mt-3 text-xs font-bold uppercase text-[#737582]">{metric.helper}</p> : <div className="mt-4 h-1 rounded-full bg-[#ecfbd7]" />}
    </article>
  );
}

function OverviewPage({ onAction }: { onAction: (action: ActionPayload) => void }) {
  const [range, setRange] = React.useState("Today");

  return (
    <DashboardCanvas>
      <FigmaHeader
        pageKey="overview"
        onAction={onAction}
        controls={
          <div className="flex rounded-lg border border-[#d7d8e4] bg-white p-1">
            {["Today", "Weekly", "Monthly"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className={`h-8 rounded-md px-4 text-xs font-extrabold ${range === item ? "bg-obligon-green text-white" : "text-obligon-text"}`}
              >
                {item}
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <SmallMetric metric={overviewMetrics[0]} icon={<ReceiptText size={20} />} />
        <SmallMetric metric={overviewMetrics[1]} icon={<CircleDollarSign size={21} />} />
        <article className="relative overflow-hidden rounded-lg border border-[#d7d8e4] bg-white p-6">
          <div className="absolute -right-7 -top-8 rotate-12 bg-obligon-lime px-10 py-3 text-[10px] font-extrabold text-[#182900] shadow-card">PRIORITY</div>
          <span className="grid size-11 place-items-center rounded-lg bg-[#fff5d8] text-[#986700]">
            <Clock3 size={21} />
          </span>
          <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">PENDING SETTLEMENTS</p>
          <p className="mt-2 font-display text-[28px] font-extrabold leading-tight text-obligon-navy">₦3,120,440.00</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-obligon-text">
            <span className="size-2 rounded-full bg-obligon-green" />
            Processing Cluster 04...
          </div>
        </article>
      </div>

      <section className="mt-8 grid rounded-lg border border-[#d7d8e4] bg-white sm:grid-cols-2 xl:grid-cols-4">
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

      <section className="mt-8 grid gap-8 xl:grid-cols-[358px_1fr]">
        <article className="relative min-h-[300px] overflow-hidden rounded-lg bg-[#05071a] p-8 text-white shadow-card">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(170,248,87,0.34),transparent_28%),linear-gradient(135deg,#071853,#05071a_58%,#0f163d)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Fuel size={18} className="text-obligon-lime" />
                <p className="font-display text-2xl font-extrabold">Fuelvista</p>
              </div>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[1.3px] text-white/55">FLEET SUBSCRIPTION CARD</p>
            </div>
            <div>
              <p className="font-mono text-xl tracking-[2px] text-white">5275 3100 4567 8901</p>
              <div className="mt-9 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase text-white/45">Card Holder</p>
                  <p className="mt-1 text-sm font-extrabold">OBLIGON LOGISTICS LTD</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-white/45">Expiry</p>
                  <p className="font-display text-2xl font-extrabold">09/28</p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="relative min-h-[300px] overflow-hidden rounded-lg border border-[#d7d8e4] bg-[#dbe7f1]">
          <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(30deg,rgba(1,21,84,.12)_12%,transparent_12.5%,transparent_87%,rgba(1,21,84,.12)_87.5%,rgba(1,21,84,.12)),linear-gradient(150deg,rgba(1,21,84,.12)_12%,transparent_12.5%,transparent_87%,rgba(1,21,84,.12)_87.5%,rgba(1,21,84,.12)),linear-gradient(30deg,rgba(1,21,84,.12)_12%,transparent_12.5%,transparent_87%,rgba(1,21,84,.12)_87.5%,rgba(1,21,84,.12)),linear-gradient(150deg,rgba(1,21,84,.12)_12%,transparent_12.5%,transparent_87%,rgba(1,21,84,.12)_87.5%,rgba(1,21,84,.12))] [background-position:0_0,0_0,24px_42px,24px_42px] [background-size:48px_84px]" />
          <div className="absolute left-6 top-6 rounded-lg border border-white/70 bg-white/80 px-4 py-3 backdrop-blur">
            <h3 className="text-xs font-extrabold text-obligon-navy">Live Fleet Location</h3>
            <div className="mt-2 flex gap-3 text-[11px] font-bold text-obligon-text">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-obligon-green" /> Active</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#f0ad00]" /> Transit</span>
            </div>
          </div>
          {[
            ["34%", "50%"],
            ["73%", "25%"],
            ["51%", "63%"]
          ].map(([left, top]) => (
            <span key={`${left}-${top}`} className="absolute size-3 rounded-full bg-obligon-green ring-8 ring-obligon-green/20" style={{ left, top }} />
          ))}
        </article>
      </section>

      <div className="mt-8">
        <DataTable
          title="Recent Transactions"
          columns={["Reference", "Partner", "Station", "Amount", "Status", "Time"]}
          rows={overviewTransactions}
          actionLabel="View All Report"
          onAction={onAction}
        />
      </div>
    </DashboardCanvas>
  );
}

function SettlementsPage({ onAction }: { onAction: (action: ActionPayload) => void }) {
  return (
    <DashboardCanvas>
      <div className="grid gap-8 xl:grid-cols-[310px_1fr]">
        <aside className="space-y-5">
          <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">Bank Details</h2>
              <button type="button" className="text-xs font-extrabold text-obligon-green" onClick={() => onAction({ title: "Change Bank Details", body: "Open the linked bank account update flow." })}>
                CHANGE
              </button>
            </div>
            {[
              ["ACCOUNT NAME", "OBLIGON LOGISTICS LTD"],
              ["BANK PROVIDER", "ZENITH BANK PLC"],
              ["ACCOUNT NUMBER", "1012938475"]
            ].map(([label, value]) => (
              <div key={label} className="mt-5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.7px] text-obligon-text">{label}</p>
                <p className="mt-1 text-sm font-extrabold text-obligon-navy">{value}</p>
              </div>
            ))}
            <p className="mt-5 rounded-lg bg-[#ecfbd7] p-3 text-xs font-semibold leading-5 text-[#315d00]">
              Your account is verified for tier-3 settlements. Max daily limit: ₦50M.
            </p>
          </article>
          <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
            <p className="text-[11px] font-extrabold uppercase tracking-[1px] text-obligon-text">TOTAL SETTLED (30D)</p>
            <p className="mt-3 font-display text-3xl font-extrabold">₦248,320,000</p>
            <p className="mt-2 text-xs font-bold text-obligon-green">+12.4% vs last month</p>
          </article>
          <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold">Auto-Settlement</h3>
              <span className="rounded-full bg-[#ecfbd7] px-3 py-1 text-[10px] font-extrabold text-obligon-green">Enabled</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-obligon-text">Payouts are automatically pushed to your account every Tuesday at 12:00 PM GMT.</p>
          </article>
        </aside>
        <section>
          <FigmaHeader pageKey="settlements" onAction={onAction} controls={<StatusPill status="INSTANT PAY" tone="success" />} />
          <article className="mt-8 rounded-lg bg-[#071853] p-7 text-white">
            <p className="text-xs font-extrabold uppercase tracking-[1px] text-white/55">PENDING PAYOUT BALANCE</p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <p className="font-display text-4xl font-extrabold">₦14,280,450 <span className="text-xl text-white/55">.00</span></p>
              <button type="button" onClick={() => onAction({ title: "Request Payout", body: "Submit this pending payout balance for instant pay processing." })} className="h-11 rounded-lg bg-obligon-lime px-5 text-xs font-extrabold uppercase text-[#182900]">
                Request Payout
              </button>
            </div>
          </article>
          <div className="mt-8">
            <DataTable title="Payout History" subtitle="128 Total" columns={["Transaction ID", "Date & Time", "Amount", "Method", "Status"]} rows={payoutRows} actionLabel="Export CSV" onAction={onAction} />
            <p className="mt-4 text-xs font-semibold text-obligon-text">Showing 1 to 10 of 128 entries</p>
          </div>
        </section>
      </div>
    </DashboardCanvas>
  );
}

function StationPage({ onAction }: { onAction: (action: ActionPayload) => void }) {
  const [selectedAsset, setSelectedAsset] = React.useState<string | null>(null);

  return (
    <DashboardCanvas>
      <FigmaHeader pageKey="station" controls={<Tabs items={pageCopy.station.tabs ?? []} />} onAction={onAction} />
      <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_280px]">
        <div className="space-y-8">
          <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
            <h2 className="font-display text-xl font-extrabold">General Information</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {[
                ["Station Brand Name", "Obligon LTD Lagos Central - Terminal 01"],
                ["Physical Address", "1024 Herbert Macaulay Way, Yaba, Lagos"],
                ["Operating Hours", "06 : 00 AM to 10 : 00 PM"],
                ["Active Pump Count", "12"]
              ].map(([label, value]) => (
                <label key={label} className="block">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">{label}</span>
                  <input className="mt-2 h-11 w-full rounded-lg border border-[#d7d8e4] bg-[#fbfbff] px-4 text-sm font-bold text-obligon-navy outline-none" defaultValue={value} />
                </label>
              ))}
            </div>
            <div className="mt-6">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">Available Fuel Types</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["PMS", "AGO", "DPK", "LPG", "CNG"].map((fuelType) => (
                  <span key={fuelType} className="rounded-full bg-[#ecfbd7] px-4 py-2 text-xs font-extrabold text-obligon-green">{fuelType}</span>
                ))}
              </div>
            </div>
          </article>
          <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">Station Asset Gallery</h2>
              <button type="button" onClick={() => onAction({ title: "Upload New Asset", body: "Select an asset slot, then add a note for the frontend-only upload request.", confirmLabel: "Prepare Upload", requiresNote: true })} className="text-xs font-extrabold text-obligon-green">UPLOAD NEW</button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {["Forecourt", "Pump Island", "+ ADD PHOTO"].map((item, index) => (
                <button key={item} type="button" onClick={() => { setSelectedAsset(item); onAction({ title: index === 2 ? "Add Station Photo" : `View ${item}`, body: index === 2 ? "Add a reference note before preparing a frontend-only photo request." : `${item} is selected for review in this frontend-only gallery.`, confirmLabel: index === 2 ? "Prepare Upload" : "Continue", requiresNote: index === 2, viewOnly: index !== 2, details: [`Selected asset: ${item}`] }); }} aria-pressed={selectedAsset === item} className={`h-32 rounded-lg border ${selectedAsset === item ? "ring-2 ring-obligon-green ring-offset-2" : ""} ${index === 2 ? "border-dashed border-obligon-green bg-[#f5ffe8] text-obligon-green" : "border-[#d7d8e4] bg-[#dfe6f3] text-obligon-navy"} text-xs font-extrabold`}>
                  {item}
                </button>
              ))}
            </div>
          </article>
        </div>
        <aside className="space-y-5">
          <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
            <h2 className="font-display text-xl font-extrabold">Primary Contact</h2>
            <p className="mt-4 text-lg font-extrabold">Adewale Oke</p>
            <p className="text-sm text-obligon-text">Terminal Operations Lead</p>
            <p className="mt-4 text-sm font-bold">a.oke@obligon.com</p>
            <p className="mt-1 text-sm font-bold">+234 812 345 6789</p>
            <button type="button" onClick={() => onAction({ title: "Message Terminal", body: "Open terminal contact modal." })} className="mt-5 h-10 w-full rounded-lg bg-obligon-green text-xs font-extrabold text-white">MESSAGE TERMINAL</button>
          </article>
          <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
            <div className="flex items-center gap-2 text-obligon-green"><MapPin size={18} /><p className="text-xs font-extrabold">OPEN IN MAPS</p></div>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-[10px] font-extrabold text-obligon-text">REGION</p><p className="font-extrabold">SW-Lagos</p></div>
              <div><p className="text-[10px] font-extrabold text-obligon-text">TIER</p><p className="font-extrabold">Enterprise</p></div>
              <div><p className="text-[10px] font-extrabold text-obligon-text">TRUCKS SERVICED</p><p className="font-extrabold">84/120</p></div>
              <div><p className="text-[10px] font-extrabold text-obligon-text">FUEL RESERVES</p><p className="font-extrabold text-[#9f1027]">12% LOW</p></div>
            </div>
            <button type="button" onClick={() => onAction({ title: "Order Resupply", body: "Confirm the fuel-resupply request for this station.", confirmLabel: "Submit Request", requiresNote: true })} className="mt-5 h-10 w-full rounded-lg bg-[#fff5d8] text-xs font-extrabold text-[#875b00]">ORDER RESUPPLY</button>
          </article>
        </aside>
      </section>
    </DashboardCanvas>
  );
}

function PricingPage({ onAction }: { onAction: (action: ActionPayload) => void }) {
  const prices = [
    ["PREMIUM MOTOR SPIRIT (PMS)", "₦", "617.00"],
    ["AUTOMOTIVE GAS OIL (AGO)", "₦", "1050.00"],
    ["DUAL PURPOSE KEROSENE (DPK)", "₦", "850.00"],
    ["LIQUEFIED PETROLEUM GAS (LPG)", "₦", "1200.00"]
  ];

  return (
    <DashboardCanvas>
      <FigmaHeader pageKey="pricing" controls={<Tabs items={pageCopy.pricing.tabs ?? []} />} onAction={onAction} />
      <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_286px]">
        <div className="space-y-8">
          <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-extrabold">Current Rate Adjustment</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-obligon-text">Adjust standard pricing for the nationwide fleet network. Rates are applied instantly upon confirmation.</p>
              </div>
              <StatusPill status="LIVE NETWORK SYNC" tone="success" />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {prices.map(([label, symbol, value]) => (
                <label key={label} className="rounded-lg border border-[#d7d8e4] bg-[#fbfbff] p-4">
                  <span className="text-[11px] font-extrabold uppercase text-obligon-text">{label}</span>
                  <div className="mt-3 flex h-12 items-center rounded-lg border border-[#d7d8e4] bg-white px-4">
                    <span className="mr-3 font-extrabold text-obligon-text">{symbol}</span>
                    <input className="w-full bg-transparent font-display text-xl font-extrabold outline-none" defaultValue={value} />
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => onAction({ title: "Discard Price Changes", body: "Your current unsaved price adjustments will be discarded in this frontend-only session.", confirmLabel: "Discard Changes" })} className="h-10 rounded-lg border border-[#d7d8e4] px-4 text-xs font-extrabold">CANCEL CHANGES</button>
              <button type="button" onClick={() => onAction({ title: "Update Prices", body: "Review the price changes before preparing the frontend-only network-sync request.", confirmLabel: "Prepare Update", requiresNote: true })} className="h-10 rounded-lg bg-obligon-green px-4 text-xs font-extrabold text-white">UPDATE PRICES</button>
            </div>
          </article>
          <DataTable title="Price Adjustment History" columns={["Date & Time", "Fuel Type", "Old Price", "New Price", "Change %", "Status"]} rows={priceRows} onAction={onAction} />
        </div>
        <aside className="space-y-5">
          {[
            ["+4.2%", "PMS Volatility Index", "Historical price variance across the current month.", "VOLATILE"],
            ["842", "Depots Connected", "98.2% updated within 5 minutes.", "SYNCED"],
            ["SHA-256", "Audit Trail Secure", "ENCRYPTED LOGS", "ACTIVE"]
          ].map(([value, title, body, badge]) => (
            <article key={title} className="rounded-lg border border-[#d7d8e4] bg-white p-6">
              <p className="font-display text-3xl font-extrabold">{value}</p>
              <h3 className="mt-3 font-display text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-obligon-text">{body}</p>
              <div className="mt-4"><StatusPill status={badge} tone="info" /></div>
            </article>
          ))}
        </aside>
      </section>
    </DashboardCanvas>
  );
}

function TransactionsPage({ onAction }: { onAction: (action: ActionPayload) => void }) {
  return (
    <DashboardCanvas>
      <FigmaHeader pageKey="transactions" controls={<Tabs items={pageCopy.transactions.tabs ?? []} />} onAction={onAction} />
      <div className="mt-8 flex flex-wrap gap-3 rounded-lg border border-[#d7d8e4] bg-white p-4">
        {["DATE Last 30 Days", "CARD All Cards", "More Filters", "Export CSV"].map((filter) => (
          <button key={filter} type="button" onClick={() => onAction({ title: filter, body: `Choose criteria for ${filter.toLowerCase()} in this frontend-only view.`, confirmLabel: "Apply" })} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d7d8e4] px-4 text-xs font-extrabold text-obligon-text">
            {filter.includes("Filter") ? <SlidersHorizontal size={15} /> : <Filter size={15} />}
            {filter}
          </button>
        ))}
      </div>
      <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_320px]">
        <DataTable title="Transaction Ledger" subtitle="Showing 1-10 of 1,240 transactions" columns={["Date & Time", "Company / Fleet", "Card Number", "Amount (₦)", "Status"]} rows={transactionRows} onAction={onAction} />
        <aside className="rounded-lg border border-[#d7d8e4] bg-white p-6">
          <h2 className="font-display text-xl font-extrabold">Transaction Details</h2>
          <p className="mt-5 text-[11px] font-extrabold uppercase text-obligon-text">TOTAL AMOUNT</p>
          <p className="mt-1 font-display text-3xl font-extrabold">₦154,200.00</p>
          {[
            ["MERCHANT & STATION", "NNPC Retail Station #42\nLekki Phase 1, Lagos"],
            ["FUEL TYPE", "Premium Motor Spirit"],
            ["VOLUME", "250.4 Liters"]
          ].map(([label, value]) => (
            <div key={label} className="mt-5">
              <p className="text-[10px] font-extrabold uppercase text-obligon-text">{label}</p>
              {value.split("\n").map((part) => <p key={part} className="text-sm font-bold">{part}</p>)}
            </div>
          ))}
          <div className="mt-6 rounded-lg bg-[#fbfbff] p-4">
            <p className="text-[10px] font-extrabold uppercase text-obligon-text">AUDIT TRAIL</p>
            {["Request Authorized", "Fuel Dispensed", "Settlement Completed"].map((item) => (
              <p key={item} className="mt-3 flex items-center gap-2 text-xs font-bold"><CheckCircle2 size={14} className="text-obligon-green" />{item}</p>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => onAction({ title: "Send Receipt", body: "Confirm the recipient note before preparing this receipt for the current frontend session.", confirmLabel: "Prepare Receipt" })} className="h-10 rounded-lg bg-obligon-green text-xs font-extrabold text-white">Send Receipt</button>
            <button type="button" onClick={() => onAction({ title: "Raise Dispute", body: "Describe the transaction issue so it can be recorded for this frontend session.", confirmLabel: "Create Dispute", requiresNote: true })} className="h-10 rounded-lg border border-[#d7d8e4] text-xs font-extrabold">Dispute</button>
          </div>
        </aside>
      </section>
    </DashboardCanvas>
  );
}

function ReportsPage({ onAction }: { onAction: (action: ActionPayload) => void }) {
  const metrics: Metric[] = [
    { label: "TOTAL VOLUME", value: "1,402,890 Ltrs", delta: "+12.4% vs last month", tone: "success" },
    { label: "TOTAL TRANSACTIONS", value: "42,518", delta: "+5.2", tone: "success" },
    { label: "FLEET UTILIZATION", value: "88.4%", delta: "-1.1", tone: "pending" },
    { label: "AVG. FUEL SPEND", value: "₦842.10/Ltr", delta: "Stable", tone: "info" }
  ];

  return (
    <DashboardCanvas>
      <FigmaHeader pageKey="reports" onAction={onAction} />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <SmallMetric key={metric.label} metric={metric} icon={<BarChart3 size={20} />} />)}
      </div>
      <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_310px]">
        <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-extrabold">Sales Trend</h2>
              <p className="mt-1 text-sm text-obligon-text">Real-time aggregate fleet volume by weekday.</p>
            </div>
            <Tabs items={["Day", "Week", "Month"]} />
          </div>
          <div className="mt-8 flex h-64 items-end gap-4 border-b border-l border-[#d7d8e4] px-4">
            {[42, 68, 54, 88, 73, 96, 61].map((height, index) => (
              <div key={height} className="flex flex-1 flex-col items-center justify-end gap-2">
                <span className="w-full rounded-t-lg bg-obligon-green" style={{ height: `${height}%` }} />
                <span className="text-xs font-bold text-obligon-text">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span>
              </div>
            ))}
          </div>
        </article>
        <aside className="rounded-lg border border-[#d7d8e4] bg-white p-6">
          <h2 className="font-display text-xl font-extrabold">Peak Performance</h2>
          <p className="mt-2 text-sm text-obligon-text">Top stations</p>
          {[
            ["Enyo Retail - Lekki I", "124k L"],
            ["TotalEnergies - Apapa", "98k L"],
            ["Ardova PLC - Ikeja", "81k L"]
          ].map(([name, value]) => (
            <div key={name} className="mt-5 flex items-center justify-between border-b border-[#ececf5] pb-4">
              <p className="text-sm font-bold">{name}</p>
              <p className="text-sm font-extrabold text-obligon-green">{value}</p>
            </div>
          ))}
          <button type="button" onClick={() => onAction({ title: "Top Stations", body: "Station rankings are shown in the current report view.", viewOnly: true })} className="mt-5 h-10 w-full rounded-lg bg-[#f0f4e8] text-xs font-extrabold text-obligon-green">VIEW ALL STATIONS</button>
        </aside>
      </section>
      <div className="mt-8">
        <DataTable title="Top Companies & Vehicles" subtitle="Comparative analysis by account and primary route." columns={["Company / Fleet ID", "Primary Route", "Total Volume", "Total Spend", "Status"]} rows={reportRows} actionLabel="Filter" onAction={onAction} />
      </div>
    </DashboardCanvas>
  );
}

function StaffPage({ onAction }: { onAction: (action: ActionPayload) => void }) {
  const stats = [
    ["TOTAL ATTENDANTS", "142"],
    ["ACTIVE SHIFTS", "84"],
    ["CARD ACCESS ENABLED", "112"],
    ["INACTIVE ACCOUNTS", "06"]
  ];

  return (
    <DashboardCanvas>
      <FigmaHeader pageKey="staff" controls={<Tabs items={pageCopy.staff.tabs ?? []} />} onAction={onAction} />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value]) => (
          <article key={label} className="rounded-lg border border-[#d7d8e4] bg-white p-5">
            <p className="text-[11px] font-extrabold uppercase text-obligon-text">{label}</p>
            <p className="mt-2 font-display text-3xl font-extrabold">{value}</p>
          </article>
        ))}
      </div>
      <div className="mt-8">
        <DataTable title="Staff Directory" columns={["Staff ID", "Name & Contact", "Role", "Card Verification Access", "Status"]} rows={staffRows} actionLabel="Add Staff Member" onAction={onAction} />
        <p className="mt-4 text-xs font-semibold text-obligon-text">Showing 1 to 4 of 142 attendants 1 2 3 ... 12</p>
      </div>
    </DashboardCanvas>
  );
}

function VerificationPage({ onAction }: { onAction: (action: ActionPayload) => void }) {
  const [code, setCode] = React.useState("821");
  const [codeError, setCodeError] = React.useState("");
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  function verifyCode() {
    if (code.length !== 6) {
      setCodeError("Enter all six authorization digits before verifying the transaction.");
      return;
    }
    setCodeError("");
    onAction({ title: "Verify Transaction", body: `Review authorization code ${code.slice(0, 3)}-${code.slice(3)} before preparing the frontend-only verification.`, confirmLabel: "Verify", details: [`Authorization code: ${code.slice(0, 3)}-${code.slice(3)}`] });
  }

  return (
    <DashboardCanvas>
      <section className="grid gap-8 xl:grid-cols-[420px_1fr]">
        <article className="rounded-lg bg-[#071853] p-8 text-white shadow-card">
          <div className="flex items-center justify-between">
            <CreditCard className="text-obligon-lime" size={28} />
            <StatusPill status="SECURE LINK" tone="success" />
          </div>
          <h1 className="mt-8 font-display text-4xl font-extrabold">{pageCopy.verification.title}</h1>
          <p className="mt-3 text-sm leading-6 text-white/65">{pageCopy.verification.description}</p>
          <div className="mt-8 flex items-center justify-center gap-3 rounded-lg bg-white/8 p-5 font-display text-3xl font-extrabold tracking-[8px]">
            {`${code.padEnd(6, "•").slice(0, 3)}-${code.padEnd(6, "•").slice(3, 6)}`}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {keys.map((key) => (
              <button key={key} type="button" onClick={() => { setCode((current) => (current + key).slice(0, 6)); setCodeError(""); }} className="h-14 rounded-lg bg-white/10 text-xl font-extrabold hover:bg-white/15">
                {key}
              </button>
            ))}
            <button type="button" onClick={() => { setCode(""); setCodeError(""); }} className="h-14 rounded-lg bg-white/10 text-xs font-extrabold">CLEAR</button>
            <button type="button" onClick={verifyCode} className="col-span-2 h-14 rounded-lg bg-obligon-lime text-xs font-extrabold uppercase text-[#182900]">
              Verify Transaction
            </button>
            {codeError ? <p className="col-span-3 text-center text-sm font-bold text-[#ffb4b4]" role="alert">{codeError}</p> : null}
          </div>
        </article>
        <div className="space-y-6">
          <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-extrabold">Shell Lagos</h2>
                <p className="text-sm font-semibold text-obligon-text">Fleet #402</p>
              </div>
              <StatusPill status="ACTIVE POOL" tone="success" />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div><p className="text-[10px] font-extrabold text-obligon-text">Driver</p><p className="font-bold">Ahmed Musa</p></div>
              <div><p className="text-[10px] font-extrabold text-obligon-text">DAILY CREDIT LIMIT</p><p className="font-display text-2xl font-extrabold">₦1,450,200.00</p></div>
            </div>
          </article>
          <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
            <h2 className="font-display text-xl font-extrabold">Recent Approvals <span className="text-xs text-obligon-green">LIVE FEED</span></h2>
            {["Truck #9920 • Mobil Lekki • Auth Code 992-001 • 2 mins ago • ₦42k", "Haulage Exp • MRS Yaba • Auth Code 112-902 • 12 mins ago • ₦150k", "GIG Logistics • Oando Ikeja • Auth Code 887-221 • 15 mins ago • ₦88k"].map((item) => (
              <p key={item} className="mt-4 rounded-lg bg-[#fbfbff] p-3 text-sm font-semibold">{item}</p>
            ))}
          </article>
          <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
            <h2 className="font-display text-xl font-extrabold">Declined Attempts</h2>
            {["Unknown Terminal ID • Unrecognized POS Request • Lagos Toll • BLOCKED", "Insufficient Credit • Fleet #110 • Total Energies VI • 34M AGO"].map((item) => (
              <p key={item} className="mt-4 flex items-start gap-2 rounded-lg bg-[#ffecef] p-3 text-sm font-semibold text-[#9f1027]"><AlertTriangle size={16} />{item}</p>
            ))}
          </article>
        </div>
      </section>
    </DashboardCanvas>
  );
}

function DisputesPage({ onAction }: { onAction: (action: ActionPayload) => void }) {
  return (
    <DashboardCanvas>
      <FigmaHeader pageKey="disputes" onAction={onAction} />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["OPEN DISPUTES", "24", "+12% Current Month"],
          ["RESOLVED", "142", "SLA Target: 4h"],
          ["AVG. RESPONSE TIME", "2.4 hrs", "Support velocity"]
        ].map(([label, value, helper]) => (
          <article key={label} className="rounded-lg border border-[#d7d8e4] bg-white p-5">
            <p className="text-[11px] font-extrabold uppercase text-obligon-text">{label}</p>
            <p className="mt-2 font-display text-3xl font-extrabold">{value}</p>
            <p className="mt-2 text-xs font-bold text-obligon-green">{helper}</p>
          </article>
        ))}
      </div>
      <div className="mt-8">
        <DataTable title="All Tickets" subtitle="All Pending Under Review" columns={["Ticket ID", "Date / Subject", "Category", "Status"]} rows={disputeRows} actionLabel="Export CSV" onAction={onAction} />
      </div>
      <footer className="mt-8 flex flex-wrap gap-4 text-xs font-bold text-obligon-text">
        <span>Operational Status</span>
        <span>Knowledge Base</span>
        <span>Legal & Compliance</span>
      </footer>
    </DashboardCanvas>
  );
}

function NotificationsPage({ onAction }: { onAction: (action: ActionPayload) => void }) {
  const [dismissed, setDismissed] = React.useState<string[]>([]);

  return (
    <DashboardCanvas>
      <FigmaHeader pageKey="notifications" onAction={onAction} />
      <section className="mt-8 max-w-3xl rounded-lg border border-[#d7d8e4] bg-white">
        {notificationGroups.map((group) => (
          <div key={group.label} className="border-b border-[#ececf5] p-6 last:border-b-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[1px] text-obligon-text">{group.label}</p>
            <div className="mt-4 space-y-3">
              {group.items
                .filter(([title]) => !dismissed.includes(title))
                .map(([title, time, body]) => (
                  <article key={title} className="rounded-lg border border-[#e3e4ef] bg-[#fbfbff] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="font-display text-lg font-extrabold">{title}</h2>
                        <p className="mt-2 text-sm leading-6 text-obligon-text">{body}</p>
                      </div>
                      <p className="shrink-0 text-xs font-extrabold text-obligon-text">{time}</p>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button type="button" onClick={() => onAction({ title: "View Transaction", body: body })} className="text-xs font-extrabold text-obligon-green">VIEW TRANSACTION</button>
                      <button type="button" onClick={() => setDismissed((current) => [...current, title])} className="text-xs font-extrabold text-obligon-text">DISMISS</button>
                    </div>
                  </article>
                ))}
            </div>
          </div>
        ))}
      </section>
      <button type="button" onClick={() => onAction({ title: "Older Notifications", body: "There are no additional notifications available in this frontend-only view.", viewOnly: true })} className="mt-6 h-11 rounded-lg border border-[#d7d8e4] bg-white px-5 text-xs font-extrabold text-obligon-navy">Load older notifications</button>
    </DashboardCanvas>
  );
}

function SettingsPage({ onAction }: { onAction: (action: ActionPayload) => void }) {
  return (
    <DashboardCanvas>
      <FigmaHeader pageKey="settings" controls={<Tabs items={pageCopy.settings.tabs ?? []} />} onAction={onAction} />
      <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_280px]">
        <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
          <div className="grid gap-5 md:grid-cols-2">
            {[
              ["STATION NAME", "Obligon LTD Lagos Central Hub"],
              ["CONTACT EMAIL", "ops@obligon-lagos.com"],
              ["PHONE NUMBER", "+234 812 345 6789"],
              ["STATION ADDRESS", "15 Industrial Avenue, Ikeja, Lagos State, Nigeria."]
            ].map(([label, value]) => (
              <label key={label} className={label.includes("ADDRESS") ? "md:col-span-2" : ""}>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">{label}</span>
                <input className="mt-2 h-12 w-full rounded-lg border border-[#d7d8e4] bg-[#fbfbff] px-4 text-sm font-bold outline-none" defaultValue={value} />
              </label>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => onAction({ title: "Discard Changes", body: "Discard unsaved station configuration changes for this frontend session.", confirmLabel: "Discard Changes" })} className="h-10 rounded-lg border border-[#d7d8e4] px-4 text-xs font-extrabold">Discard Changes</button>
            <button type="button" onClick={() => onAction({ title: "Save Changes", body: "Review the station configuration change before completing it for this frontend session.", confirmLabel: "Save Changes" })} className="h-10 rounded-lg bg-obligon-green px-4 text-xs font-extrabold text-white">Save Changes</button>
          </div>
        </article>
        <aside className="space-y-5">
          <article className="rounded-lg border border-[#d7d8e4] bg-[#071853] p-6 text-white">
            <ShieldCheck className="text-obligon-lime" size={26} />
            <p className="mt-5 text-xs font-extrabold uppercase text-white/60">ENCRYPTED END-TO-END</p>
            <p className="mt-2 font-display text-2xl font-extrabold">OBLIGON FINTECH V2.4.0</p>
          </article>
          <article className="rounded-lg border border-[#d7d8e4] bg-white p-6">
            {[
              ["Two-factor authentication", true],
              ["Finance email alerts", true],
              ["Terminal risk alerts", true]
            ].map(([label, enabled]) => (
              <label key={String(label)} className="mt-4 flex first:mt-0 items-center justify-between gap-4 text-sm font-bold">
                <span>{label}</span>
                <input type="checkbox" defaultChecked={Boolean(enabled)} className="size-4 accent-obligon-green" />
              </label>
            ))}
          </article>
        </aside>
      </section>
    </DashboardCanvas>
  );
}

export function DashboardScreen({ pageKey }: { pageKey: DashboardPageKey }) {
  const [action, setAction] = React.useState<ActionPayload | null>(null);

  const pages: Record<DashboardPageKey, React.ReactNode> = {
    overview: <OverviewPage onAction={setAction} />,
    settlements: <SettlementsPage onAction={setAction} />,
    station: <StationPage onAction={setAction} />,
    pricing: <PricingPage onAction={setAction} />,
    transactions: <TransactionsPage onAction={setAction} />,
    reports: <ReportsPage onAction={setAction} />,
    staff: <StaffPage onAction={setAction} />,
    verification: <VerificationPage onAction={setAction} />,
    disputes: <DisputesPage onAction={setAction} />,
    notifications: <NotificationsPage onAction={setAction} />,
    settings: <SettingsPage onAction={setAction} />
  };

  return (
    <>
      {pages[pageKey]}
      <ActionModal action={action} onClose={() => setAction(null)} />
    </>
  );
}
