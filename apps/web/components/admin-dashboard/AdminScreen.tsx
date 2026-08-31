"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Filter,
  Fuel,
  Grid2X2,
  MoreVertical,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  UserPlus,
  WalletCards
} from "lucide-react";
import {
  applicationMetrics,
  applicationRows,
  adminPageCopy,
  companyMetrics,
  companyRows,
  disputeMetrics,
  disputeRows,
  reportMetrics,
  staffMetrics,
  staffRows,
  stationPerformanceRows,
  type AdminMetric,
  type AdminPageKey,
  type AdminRow,
  type AdminTone
} from "@/lib/mock/admin-data";
import { AdminModals, type AdminModalType } from "./AdminModals";
import { useToast } from "@/components/shared/Toast";

const tonePills: Record<AdminTone, string> = {
  green: "bg-[#e9f8dc] text-[#3d6a00]",
  blue: "bg-[#e9efff] text-[#061958]",
  red: "bg-[#ffe9ed] text-[#c1121f]",
  amber: "bg-[#fff0d8] text-[#bc5b00]",
  dark: "bg-[#061958] text-white",
  muted: "bg-[#eceef4] text-[#454650]"
};

const avatarTone: Record<AdminTone, string> = {
  green: "bg-obligon-lime text-[#061958]",
  blue: "bg-[#dce4ff] text-[#061958]",
  red: "bg-[#d1d3dc] text-white",
  amber: "bg-[#b8c7ff] text-[#061958]",
  dark: "bg-[#050816] text-white",
  muted: "bg-[#d8dce8] text-[#454650]"
};

function AdminCanvas({ children }: { children: React.ReactNode }) {
  return <section className="px-5 py-9 sm:px-8 lg:px-8 xl:px-12">{children}</section>;
}

function PageHeading({
  pageKey,
  action,
  secondaryAction,
  onAction
}: {
  pageKey: AdminPageKey;
  action?: { label: string; modal?: AdminModalType; icon?: React.ReactNode };
  secondaryAction?: React.ReactNode;
  onAction: (modal: AdminModalType) => void;
}) {
  const page = adminPageCopy[pageKey];

  return (
    <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-[680px]">
        <h1 className="font-display text-[34px] font-extrabold leading-[1.1] tracking-normal text-[#07162f] md:text-[42px]">{page.title}</h1>
        {page.description ? <p className="mt-2 text-base leading-6 text-obligon-text">{page.description}</p> : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {secondaryAction}
        {action ? (
          <button
            type="button"
            onClick={() => onAction(action.modal ?? "fleet")}
            className="inline-flex h-[50px] items-center justify-center gap-3 rounded-xl bg-obligon-lime px-6 text-sm font-extrabold text-[#061958] shadow-sm hover:bg-obligon-lime/90 transition"
          >
            {action.icon}
            {action.label}
          </button>
        ) : null}
      </div>
    </header>
  );
}

function AdminMetricCard({ metric, icon }: { metric: AdminMetric; icon: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-[#c8ccdb] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <span className={`grid size-12 place-items-center rounded-xl ${tonePills[metric.tone ?? "muted"]}`}>{icon}</span>
        {metric.helper ? <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${tonePills[metric.tone ?? "muted"]}`}>{metric.helper}</span> : null}
      </div>
      <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[1.2px] text-obligon-text">{metric.label}</p>
      <p className="mt-2 font-display text-[38px] font-extrabold leading-none text-[#050816]">{metric.value}</p>
      <div className="mt-5 h-px bg-obligon-lime" />
    </article>
  );
}

function StatusPill({ status, tone = "muted" }: { status: string; tone?: AdminTone }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ${tonePills[tone]}`}>{status}</span>;
}

function CellText({ value }: { value: string }) {
  const parts = value.split("\n");
  return (
    <>
      <p className="font-extrabold text-[#07162f]">{parts[0]}</p>
      {parts.slice(1).map((part) => (
        <p key={part} className="mt-0.5 text-sm font-medium text-obligon-text">
          {part}
        </p>
      ))}
    </>
  );
}

function AdminTable({
  title,
  subtitle,
  columns,
  rows,
  search,
  footer,
  actionLabel = "View Details",
  onRowAction,
  headerAction
}: {
  title: string;
  subtitle?: React.ReactNode;
  columns: string[];
  rows: AdminRow[];
  search?: string;
  footer?: string;
  actionLabel?: string;
  onRowAction?: (row: AdminRow) => void;
  headerAction?: React.ReactNode;
}) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const visibleRows = rows.filter((row) => row.cells.join(" ").toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <section className="overflow-hidden rounded-xl border border-[#c8ccdb] bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[#c8ccdb] bg-white px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-[#07162f]">{title}</h2>
          {subtitle ? <div className="mt-1 text-sm text-obligon-text">{subtitle}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {search ? (
            <label className="flex h-10 w-full max-w-[320px] items-center gap-3 rounded-xl border border-[#c8ccdb] bg-[#f3f6ff] px-3">
              <SlidersHorizontal size={15} className="text-[#777c8f]" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#7d8293]" placeholder={search} aria-label={search} />
            </label>
          ) : null}
          {headerAction}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#d7dbe8] bg-[#eef3ff] text-[11px] font-extrabold uppercase tracking-[1px] text-[#555968]">
              {columns.map((column) => (
                <th key={column} className="px-6 py-4">
                  {column}
                </th>
              ))}
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef1fb]">
            {visibleRows.map((row, index) => (
              <tr key={`${row.cells[0]}-${index}`} className={`hover:bg-[#f7fbf8] transition ${row.tone === "red" ? "bg-[#fff4f4]" : ""}`}>
                {row.cells.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`} className="px-6 py-5 align-middle text-sm">
                    <div className="flex items-center gap-3">
                      {cellIndex === 0 && row.avatar ? (
                        <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-xs font-extrabold ${avatarTone[row.tone ?? "blue"]}`}>{row.avatar}</span>
                      ) : null}
                      <CellText value={cell} />
                    </div>
                  </td>
                ))}
                <td className="px-6 py-5">
                  {row.status ? <StatusPill status={row.status} tone={row.tone} /> : null}
                </td>
                <td className="relative px-6 py-5 text-right">
                  {row.flagged ? <span className="absolute right-0 top-0 bg-obligon-green px-3 py-1 text-[9px] font-extrabold uppercase text-white [clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)]">URGENT</span> : null}
                  <button type="button" onClick={() => onRowAction?.(row)} className="inline-flex items-center gap-1 text-xs font-extrabold text-obligon-green hover:underline">
                    {actionLabel}
                    {actionLabel === "Review Details" ? null : <ArrowRight size={14} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows.length === 0 ? <p className="px-6 py-10 text-center text-sm font-bold text-obligon-text" role="status">No records match your search.</p> : null}
      </div>
      {footer ? (
        <div className="flex items-center justify-between border-t border-[#d7dbe8] bg-[#eef3ff] px-6 py-4 text-sm text-obligon-text">
          <span>{footer}</span>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((item) => (
              <button key={item} onClick={() => setPage(item)} aria-current={page === item ? "page" : undefined} className={`grid size-8 place-items-center rounded-lg font-bold text-xs ${page === item ? "bg-[#050816] text-white" : "hover:bg-white"}`} type="button">{item}</button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ApplicationsPage({ onModal }: { onModal: (modal: AdminModalType) => void }) {
  const { success: toastSuccess } = useToast();

  return (
    <AdminCanvas>
      <PageHeading
        pageKey="applications"
        onAction={onModal}
        secondaryAction={
          <button onClick={() => toastSuccess("Applications ledger exported.")} className="inline-flex h-[50px] items-center gap-2 rounded-xl border border-[#050816] bg-white px-5 text-sm font-extrabold" type="button">
            <Download size={16} />
            Export List
          </button>
        }
        action={{ label: "Refresh Queue", icon: <RefreshCw size={16} /> }}
      />
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {applicationMetrics.map((metric, index) => (
          <AdminMetricCard key={metric.label} metric={metric} icon={[<ClipboardCheck key="a" size={21} />, <WalletCards key="b" size={21} />, <ShieldCheck key="c" size={21} />][index]} />
        ))}
      </div>
      <div className="mt-10">
        <AdminTable
          title="Station Onboarding Queue"
          columns={["Application ID", "Station Brand", "Location", "Manager Contact", "Submitted Date", "Status"]}
          rows={applicationRows}
          search="Search partner applications..."
          footer="Showing 1 to 4 of 42 entries"
          actionLabel="Review Application"
          onRowAction={() => onModal("partnerReview")}
        />
      </div>
      <footer className="mt-10 flex flex-col gap-3 text-xs font-extrabold uppercase tracking-[1.5px] text-[#7d8293] sm:flex-row sm:items-center sm:justify-between">
        <span className="text-obligon-green font-extrabold">DPR Compliance Verification Active</span>
        <span>Network Clearance: 99.8%</span>
      </footer>
    </AdminCanvas>
  );
}

function ReportsPage({ onModal }: { onModal: (modal: AdminModalType) => void }) {
  const { success: toastSuccess } = useToast();

  return (
    <AdminCanvas>
      <PageHeading pageKey="reports" onAction={() => toastSuccess("National audit report downloaded.")} action={{ label: "Export Audit PDF", icon: <Download size={16} /> }} />
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {reportMetrics.map((metric, index) => (
          <AdminMetricCard key={metric.label} metric={metric} icon={[<Truck key="truck" size={22} />, <WalletCards key="wallet" size={22} />, <Fuel key="fuel" size={22} />][index]} />
        ))}
      </div>
      <section className="mt-9 grid gap-8 xl:grid-cols-[1fr_280px]">
        <article className="rounded-xl border border-[#c8ccdb] bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Transaction Velocity</h2>
              <p className="mt-1 text-sm text-obligon-text">Daily fueling volume across the Nigerian network</p>
            </div>
            <div className="flex rounded-full bg-[#e9efff] p-1">
              <span className="rounded-full bg-obligon-green px-5 py-1.5 text-xs font-bold text-white">Volume</span>
            </div>
          </div>
          <div className="mt-10 h-[320px]">
            <svg viewBox="0 0 680 300" className="h-full w-full" role="img" aria-label="Transaction velocity chart">
              <defs>
                <linearGradient id="adminChartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#aaf857" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="#aaf857" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[50, 115, 180, 245].map((y) => <line key={y} x1="0" x2="680" y1={y} y2={y} stroke="#e8ebf4" strokeDasharray="4 4" />)}
              <path d="M0 250 L35 230 L70 240 L105 190 L140 215 L175 150 L210 175 L245 110 L280 130 L315 70 L350 95 L385 55 L420 92 L455 75 L490 125 L525 100 L560 142 L595 120 L630 165 L665 118 L680 130 L680 300 L0 300 Z" fill="url(#adminChartFill)" />
              <path d="M0 250 L35 230 L70 240 L105 190 L140 215 L175 150 L210 175 L245 110 L280 130 L315 70 L350 95 L385 55 L420 92 L455 75 L490 125 L525 100 L560 142 L595 120 L630 165 L665 118 L680 130" fill="none" stroke="#63a800" strokeWidth="4" />
            </svg>
          </div>
          <div className="mt-2 flex justify-between text-xs font-bold text-obligon-text">
            <span>01 AUG</span><span>07 AUG</span><span>14 AUG</span><span>21 AUG</span><span>28 AUG</span>
          </div>
        </article>
        <article className="rounded-xl border border-[#c8ccdb] bg-white p-8 shadow-sm">
          <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Revenue Split</h2>
          <p className="mt-2 text-sm text-obligon-text">By fuel product type</p>
          <div className="relative mx-auto mt-10 size-44 rounded-full bg-[conic-gradient(#061958_0_55%,#63a800_55%_80%,#aaf857_80%_92%,#c9cbd6_92%_100%)]">
            <div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center">
              <p className="font-display text-3xl font-extrabold text-obligon-navy">₦8.4B</p>
              <p className="text-[10px] font-bold uppercase text-obligon-text">Total</p>
            </div>
          </div>
          <div className="mt-9 grid grid-cols-2 gap-3 text-xs font-bold text-obligon-navy">
            {["PMS: 55%", "AGO: 25%", "CNG: 12%", "EV: 8%"].map((item) => <p key={item}>{item}</p>)}
          </div>
        </article>
      </section>
      <div className="mt-9">
        <AdminTable title="Station Performance" subtitle="Comparative throughput analysis" columns={["Station Brand", "Location", "Volume Dispensed", "Total Transactions", "Growth", "Status"]} rows={stationPerformanceRows} footer="Showing 4 of 850 Stations" actionLabel="Export Ledger" onRowAction={() => toastSuccess("Station ledger exported.")} />
      </div>
    </AdminCanvas>
  );
}

function DisputesPage({ onModal }: { onModal: (modal: AdminModalType) => void }) {
  const { success: toastSuccess } = useToast();

  return (
    <AdminCanvas>
      <PageHeading
        pageKey="disputes"
        onAction={onModal}
        secondaryAction={<button onClick={() => toastSuccess("Dispute queue exported.")} className="inline-flex h-[50px] items-center gap-2 rounded-xl border border-[#c8ccdb] bg-white px-5 text-sm font-extrabold" type="button"><Download size={16} />Export CSV</button>}
        action={{ label: "Resolve Case", modal: "resolve", icon: <ShieldCheck size={16} /> }}
      />
      <div className="mt-9 grid gap-6 lg:grid-cols-3">
        {disputeMetrics.map((metric, index) => <AdminMetricCard key={metric.label} metric={metric} icon={[<AlertTriangle key="a" size={22} />, <CheckCircle2 key="b" size={22} />, <WalletCards key="c" size={22} />][index]} />)}
      </div>
      <div className="mt-9">
        <AdminTable
          title="Dispute Investigation Queue"
          subtitle={<span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-[#c1121f]" /> Active Dispute Investigations</span>}
          columns={["Case ID", "Filing Date", "Station Outlet", "Claim Subject", "Amount Disputed", "Status"]}
          rows={disputeRows}
          footer="Showing 1-10 of 24 open disputes"
          actionLabel="Investigate & Resolve"
          onRowAction={() => onModal("resolve")}
        />
      </div>
    </AdminCanvas>
  );
}

function CompaniesPage({ onModal }: { onModal: (modal: AdminModalType) => void }) {
  return (
    <AdminCanvas>
      <PageHeading
        pageKey="companies"
        onAction={onModal}
        action={{ label: "Provision New Fleet", modal: "fleet", icon: <UserPlus size={16} /> }}
      />
      <div className="mt-9 grid gap-6 lg:grid-cols-3">
        {companyMetrics.map((metric, index) => <AdminMetricCard key={metric.label} metric={metric} icon={[<Grid2X2 key="grid" size={22} />, <WalletCards key="cards" size={22} />, <BarChart3 key="chart" size={22} />][index]} />)}
      </div>
      <div className="mt-9">
        <AdminTable title="Registered Fleet Enterprises" columns={["Company Name", "Fleet ID", "Plan Tier", "Active Cards", "Credit Ceiling", "Status"]} rows={companyRows} search="Search by Company Name or Fleet ID..." footer="Showing 1-10 of 156 fleets" actionLabel="Manage Fleet" onRowAction={() => onModal("fleet")} />
      </div>
    </AdminCanvas>
  );
}

function StaffPage({ onModal }: { onModal: (modal: AdminModalType) => void }) {
  return (
    <AdminCanvas>
      <PageHeading pageKey="staff" onAction={onModal} action={{ label: "Add Staff Member", modal: "addStaff", icon: <UserPlus size={17} /> }} />
      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {staffMetrics.map((metric) => <AdminMetricCard key={metric.label} metric={metric} icon={<UserPlus size={21} />} />)}
      </div>
      <section className="mt-9 overflow-hidden rounded-xl border border-[#c8ccdb] bg-white shadow-sm">
        <AdminTable title="Internal Personnel &amp; Permission Matrix" columns={["Staff Member", "Official Role", "Permissions Matrix", "Status"]} rows={staffRows} footer="Showing 1 - 10 of 142 staff members" actionLabel="Edit Matrix" onRowAction={() => onModal("permissions")} />
      </section>
    </AdminCanvas>
  );
}

export function AdminScreen({ pageKey }: { pageKey: AdminPageKey }) {
  const [modal, setModal] = React.useState<AdminModalType>(null);
  const pages: Record<AdminPageKey, React.ReactNode> = {
    applications: <ApplicationsPage onModal={setModal} />,
    reports: <ReportsPage onModal={setModal} />,
    disputes: <DisputesPage onModal={setModal} />,
    companies: <CompaniesPage onModal={setModal} />,
    staff: <StaffPage onModal={setModal} />
  };

  return (
    <>
      {pages[pageKey]}
      <AdminModals modal={modal} onClose={() => setModal(null)} />
    </>
  );
}
