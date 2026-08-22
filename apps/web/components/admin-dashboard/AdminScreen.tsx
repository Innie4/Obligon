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
} from "./admin-data";
import { AdminModals, type AdminModalType } from "./AdminModals";

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
            onClick={() => onAction(action.modal ?? "action")}
            className="inline-flex h-[50px] items-center justify-center gap-3 rounded-lg bg-obligon-lime px-6 text-sm font-extrabold text-[#061958]"
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
    <article className="rounded-lg border border-[#c8ccdb] bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <span className={`grid size-12 place-items-center rounded-md ${tonePills[metric.tone ?? "muted"]}`}>{icon}</span>
        {metric.helper ? <span className={`rounded px-2 py-1 text-[10px] font-extrabold ${tonePills[metric.tone ?? "muted"]}`}>{metric.helper}</span> : null}
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
    <section className="overflow-hidden rounded-lg border border-[#c8ccdb] bg-white">
      <div className="flex flex-col gap-4 border-b border-[#c8ccdb] bg-white px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-[#07162f]">{title}</h2>
          {subtitle ? <div className="mt-1 text-sm text-obligon-text">{subtitle}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {search ? (
            <label className="flex h-10 w-full max-w-[320px] items-center gap-3 rounded-lg border border-[#c8ccdb] bg-[#f3f6ff] px-3">
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
              <tr key={`${row.cells[0]}-${index}`} className={row.tone === "red" ? "bg-[#fff4f4]" : ""}>
                {row.cells.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`} className="px-6 py-5 align-middle text-base">
                    <div className="flex items-center gap-3">
                      {cellIndex === 0 && row.avatar ? (
                        <span className={`grid size-8 shrink-0 place-items-center rounded text-xs font-extrabold ${avatarTone[row.tone ?? "blue"]}`}>{row.avatar}</span>
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
                  <button type="button" onClick={() => onRowAction?.(row)} className="inline-flex items-center gap-1 text-sm font-extrabold text-obligon-green">
                    {actionLabel}
                    {actionLabel === "Review Details" ? null : <ArrowRight size={14} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows.length === 0 ? <p className="px-6 py-10 text-center text-sm font-bold text-obligon-text" role="status">No records match your search. Clear or change the search terms and try again.</p> : null}
      </div>
      {footer ? (
        <div className="flex items-center justify-between border-t border-[#d7dbe8] bg-[#eef3ff] px-6 py-4 text-sm text-obligon-text">
          <span>{footer}</span>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 11].map((item, index) => <React.Fragment key={item}>{index === 3 ? <span className="px-1">...</span> : null}<button onClick={() => setPage(item)} aria-current={page === item ? "page" : undefined} className={`grid size-8 place-items-center rounded-lg ${page === item ? "bg-[#050816] text-white" : "focus:outline-none focus:ring-2 focus:ring-obligon-green"}`} type="button">{item}</button></React.Fragment>)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ApplicationsPage({ onModal }: { onModal: (modal: AdminModalType) => void }) {
  return (
    <AdminCanvas>
      <PageHeading
        pageKey="applications"
        onAction={onModal}
        secondaryAction={
          <button onClick={() => onModal("action")} className="inline-flex h-[62px] items-center gap-3 rounded-lg border border-[#050816] bg-white px-6 text-sm font-extrabold" type="button">
            <Download size={16} />
            Export<br />List
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
          title="Application Log"
          columns={["Application ID", "Station Name", "Location", "Contact Person", "Submitted Date", "Status"]}
          rows={applicationRows}
          search="Search applications..."
          footer="Showing 1 to 4 of 42 entries"
          actionLabel="Review Details"
          onRowAction={() => onModal("permissions")}
        />
      </div>
      <footer className="mt-10 flex flex-col gap-3 text-xs font-extrabold uppercase tracking-[1.5px] text-[#7d8293] sm:flex-row sm:items-center sm:justify-between">
        <span className="text-obligon-green">Internal Compliance Engine Active</span>
        <span>Last Sync: 2024-10-15 14:32:01 WAT</span>
      </footer>
    </AdminCanvas>
  );
}

function ReportsPage({ onModal }: { onModal: (modal: AdminModalType) => void }) {
  return (
    <AdminCanvas>
      <PageHeading pageKey="reports" onAction={onModal} action={{ label: "Export Report", icon: <Download size={16} /> }} />
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {reportMetrics.map((metric, index) => (
          <AdminMetricCard key={metric.label} metric={metric} icon={[<Truck key="truck" size={22} />, <WalletCards key="wallet" size={22} />, <Fuel key="fuel" size={22} />][index]} />
        ))}
      </div>
      <section className="mt-9 grid gap-8 xl:grid-cols-[1fr_280px]">
        <article className="rounded-lg border border-[#c8ccdb] bg-white p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-extrabold">Transaction Velocity</h2>
              <p className="mt-1 text-base text-obligon-text">Daily fueling volume across the Nigerian network</p>
            </div>
            <div className="flex rounded-full bg-[#e9efff] p-1">
              <button onClick={() => onModal("action")} className="rounded-full bg-obligon-green px-5 py-1.5 text-xs font-bold text-white" type="button">Volume</button>
              <button onClick={() => onModal("action")} className="rounded-full px-5 py-1.5 text-xs font-bold text-obligon-blue" type="button">Revenue</button>
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
            <span>01 OCT</span><span>07 OCT</span><span>14 OCT</span><span>21 OCT</span><span>28 OCT</span>
          </div>
        </article>
        <article className="rounded-lg border border-[#c8ccdb] bg-white p-8">
          <h2 className="font-display text-2xl font-extrabold">Revenue Split</h2>
          <p className="mt-2 text-base text-obligon-text">By fuel product type</p>
          <div className="relative mx-auto mt-10 size-44 rounded-full bg-[conic-gradient(#061958_0_55%,#63a800_55%_80%,#aaf857_80%_92%,#c9cbd6_92%_100%)]">
            <div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center">
              <p className="font-display text-3xl font-extrabold">₦8.4B</p>
              <p className="text-[10px] font-bold uppercase text-obligon-text">Total</p>
            </div>
          </div>
          <div className="mt-9 grid grid-cols-2 gap-5 text-xs font-bold">
            {["PMS 55% (₦4.6B)", "AGO 25% (₦2.1B)", "LPG 12% (₦1.0B)", "DPK 8% (₦0.7B)"].map((item) => <p key={item}>{item}</p>)}
          </div>
        </article>
      </section>
      <div className="mt-9">
        <AdminTable title="Station Performance" subtitle="Comparative analysis of top performing partner outlets" columns={["Station Name", "Location", "Volume (L)", "Transactions", "Growth (%)", "Status"]} rows={stationPerformanceRows} footer="Showing 4 of 850 Stations" actionLabel="Export CSV" onRowAction={() => onModal("action")} />
      </div>
    </AdminCanvas>
  );
}

function DisputesPage({ onModal }: { onModal: (modal: AdminModalType) => void }) {
  return (
    <AdminCanvas>
      <PageHeading
        pageKey="disputes"
        onAction={onModal}
        secondaryAction={<button onClick={() => onModal("action")} className="inline-flex h-[54px] items-center gap-3 rounded-lg border border-[#c8ccdb] bg-white px-6 text-xs font-extrabold" type="button"><Filter size={16} />FILTER<br />QUEUE</button>}
        action={{ label: "EXPORT REPORT (CSV)", icon: <Download size={16} /> }}
      />
      <div className="mt-9 grid gap-6 lg:grid-cols-3">
        {disputeMetrics.map((metric, index) => <AdminMetricCard key={metric.label} metric={metric} icon={[<AlertTriangle key="a" size={22} />, <CheckCircle2 key="b" size={22} />, <WalletCards key="c" size={22} />][index]} />)}
      </div>
      <div className="mt-9">
        <AdminTable
          title="Dispute Queue"
          subtitle={<span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-[#c1121f]" /> High Priority</span>}
          columns={["Ticket ID", "Date", "Station Name", "Subject", "Amount", "Status"]}
          rows={disputeRows}
          footer="Showing 1-10 of 24 open disputes"
          onRowAction={() => onModal("resolve")}
        />
      </div>
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-lg border border-[#d7dbe8] bg-[#f1f5ff] p-5">
          <h3 className="font-display text-lg font-extrabold">Resolution Protocol</h3>
          <p className="mt-2 text-sm leading-6 text-obligon-text">Disputes under review are automatically escalated to Fleet Managers if not resolved within 24 hours. Ensure all supporting documentation from fueling stations is attached before final approval.</p>
        </article>
        <article className="rounded-lg border border-[#d7dbe8] bg-[#f1f5ff] p-5">
          <h3 className="font-display text-lg font-extrabold">Active Escalations</h3>
          <p className="mt-2 text-sm leading-6 text-obligon-text">There are currently 4 tickets in high-priority state requiring immediate supervisor intervention. 2 are flagged for potential station-side fraud detection.</p>
        </article>
      </section>
    </AdminCanvas>
  );
}

function CompaniesPage({ onModal }: { onModal: (modal: AdminModalType) => void }) {
  return (
    <AdminCanvas>
      <PageHeading
        pageKey="companies"
        onAction={onModal}
        secondaryAction={<button onClick={() => onModal("action")} className="inline-flex h-[42px] items-center gap-2 rounded-lg border border-[#d7dbe8] bg-white px-5 text-sm font-extrabold" type="button"><Filter size={15} />Filters</button>}
        action={{ label: "Provision New Fleet", modal: "fleet", icon: <UserPlus size={16} /> }}
      />
      <div className="mt-9 grid gap-6 lg:grid-cols-3">
        {companyMetrics.map((metric, index) => <AdminMetricCard key={metric.label} metric={metric} icon={[<Grid2X2 key="grid" size={22} />, <WalletCards key="cards" size={22} />, <BarChart3 key="chart" size={22} />][index]} />)}
      </div>
      <div className="mt-9">
        <AdminTable title="Fleet Directory" columns={["Company Name", "Fleet ID", "Plan", "Active Cards", "Credit Limit", "Status"]} rows={companyRows} search="Search by Company or Fleet ID..." footer="Showing 1-10 of 156 fleets" actionLabel="View" onRowAction={() => onModal("fleet")} />
      </div>
      <section className="mt-9 grid gap-6 xl:grid-cols-[1fr_216px_216px]">
        <article className="rounded-lg bg-[#050816] p-8 text-white">
          <span className="rounded bg-obligon-lime px-3 py-1 text-[10px] font-extrabold text-[#061958]">SECURITY ALERT</span>
          <h2 className="mt-6 max-w-md font-display text-3xl font-extrabold leading-tight">3 Fleets flagged for high cross-border utilization.</h2>
          <button onClick={() => onModal("action")} className="mt-10 inline-flex items-center gap-2 text-sm font-extrabold text-obligon-lime" type="button">Review Security Logs <ArrowRight size={17} /></button>
        </article>
        <article className="rounded-lg border border-[#d7dbe8] bg-white p-8">
          <p className="text-xs font-extrabold uppercase tracking-[1.5px] text-obligon-text">PLAN DISTRIBUTION</p>
          <div className="mt-8 space-y-5 text-sm font-bold">
            <p>Enterprise <span className="float-right text-obligon-text">62%</span></p><div className="h-1.5 rounded-full bg-[#dfe7fb]"><span className="block h-full w-[62%] rounded-full bg-[#050816]" /></div>
            <p>Pro <span className="float-right text-obligon-text">28%</span></p><div className="h-1.5 rounded-full bg-[#dfe7fb]"><span className="block h-full w-[28%] rounded-full bg-obligon-lime" /></div>
          </div>
        </article>
        <article className="rounded-lg border border-[#d7dbe8] bg-white p-8 text-center">
          <ShieldCheck className="mx-auto text-obligon-lime" size={42} />
          <h2 className="mt-7 font-display text-xl font-extrabold">Automated Oversight</h2>
          <p className="mt-4 text-sm leading-6 text-obligon-text">AI identifies optimal credit thresholds for top-performing fleets.</p>
        </article>
      </section>
    </AdminCanvas>
  );
}

function StaffPage({ onModal }: { onModal: (modal: AdminModalType) => void }) {
  return (
    <AdminCanvas>
      <PageHeading pageKey="staff" onAction={onModal} action={{ label: "Add staff account", modal: "permissions", icon: <UserPlus size={17} /> }} />
      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {staffMetrics.map((metric) => <AdminMetricCard key={metric.label} metric={metric} icon={<UserPlus size={21} />} />)}
      </div>
      <section className="mt-9 overflow-hidden rounded-lg border border-[#c8ccdb] bg-white">
        <div className="flex items-center justify-between border-b border-[#c8ccdb] px-6 py-5">
          <div className="flex flex-wrap gap-5 text-sm font-bold">
            {["All Staff", "Compliance", "Operations", "Engineering"].map((tab, index) => <button key={tab} onClick={() => onModal("action")} className={index === 0 ? "border-b-2 border-obligon-green text-[#050816]" : "text-obligon-text"} type="button">{tab}</button>)}
          </div>
          <p className="text-xs font-bold text-obligon-text">Sort by: <span className="text-[#050816]">Recently Added</span></p>
        </div>
        <AdminTable title="All Staff" columns={["Staff Name", "Role", "Permissions Matrix", "Status"]} rows={staffRows} footer="Showing 1 - 10 of 142 staff members" actionLabel="Edit" onRowAction={() => onModal("permissions")} />
      </section>
      <section className="mt-9 grid gap-6 xl:grid-cols-[1fr_296px]">
        <article className="rounded-lg border border-[#c8ccdb] bg-white p-6">
          <h2 className="font-display text-xl font-extrabold">Role Definitions</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {["LEAD COMPLIANCE|Full access to KYC, audit logs, and transaction approvals. Can manage system security protocols.", "OPERATIONS MANAGER|Responsible for station monitoring and partner relations. Can manage fleet fuel disbursements.", "JUNIOR ANALYST|Read-only access to dashboard and analytics. Limited capability for data entry and report generation.", "SYSTEM ADMIN|Root access to all modules. Exclusively for the technology infrastructure team."].map((item) => {
              const [title, body] = item.split("|");
              return <div key={title}><h3 className="text-xs font-extrabold tracking-[1px]">{title}</h3><p className="mt-2 text-sm leading-6 text-obligon-text">{body}</p></div>;
            })}
          </div>
        </article>
        <article className="rounded-lg bg-[#061958] p-6 text-white">
          <h2 className="font-display text-xl font-extrabold">Security Overview</h2>
          <p className="mt-6 text-sm text-obligon-lime">MFA Adoption <span className="float-right font-extrabold text-white">100%</span></p>
          <div className="mt-3 h-1.5 rounded-full bg-white/15"><span className="block h-full w-full rounded-full bg-obligon-lime" /></div>
          <p className="mt-6 text-sm text-obligon-lime">Last Password Rotation <span className="float-right font-extrabold text-white">48h ago</span></p>
          <div className="mt-3 h-1.5 rounded-full bg-white/15"><span className="block h-full w-[80%] rounded-full bg-obligon-lime" /></div>
          <button onClick={() => onModal("action")} className="mt-8 h-11 w-full rounded-lg border border-white/20 text-sm font-extrabold" type="button">Run Access Audit</button>
        </article>
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

