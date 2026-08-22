"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Car,
  CheckCircle2,
  CreditCard,
  Download,
  Filter,
  Fuel,
  MapPinned,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wrench
} from "lucide-react";
import {
  assistanceHistory,
  cardMetrics,
  cardRows,
  companyNav,
  invoices,
  maintenanceRows,
  notifications,
  overviewMetrics,
  pageCopy,
  recentTransactions,
  spendRows,
  stations,
  teamRows,
  tickets,
  transactionRows,
  vehicleRows,
  type CompanyModalKey,
  type CompanyPageKey,
  type CompanyTone,
  type Metric,
  type Row
} from "./company-data";
import { CompanyModals } from "./CompanyModals";

const tone: Record<CompanyTone, string> = {
  green: "bg-[#e8fbd7] text-obligon-green",
  red: "bg-[#ffe8e8] text-[#c1121f]",
  amber: "bg-[#fff3d8] text-[#9a6300]",
  blue: "bg-[#e8efff] text-obligon-blue",
  dark: "bg-[#07162f] text-white",
  muted: "bg-[#edf1f5] text-obligon-text"
};

function Canvas({ children }: { children: React.ReactNode }) {
  return <section className="px-5 py-8 sm:px-8 lg:px-10">{children}</section>;
}

function Header({ pageKey, action, onModal }: { pageKey: CompanyPageKey; action?: { label: string; modal?: CompanyModalKey; icon?: React.ReactNode }; onModal: (modal: CompanyModalKey) => void }) {
  const page = pageCopy[pageKey];
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[1px] text-obligon-green">{pageKey === "reports" ? "More / Analytics" : "Obligon Dashboard"}</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-normal text-[#07162f] lg:text-4xl">{page.title}</h1>
        {page.description ? <p className="mt-2 max-w-2xl text-base leading-6 text-obligon-text">{page.description}</p> : null}
      </div>
      {action ? (
        <button type="button" onClick={() => onModal(action.modal ?? null)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-obligon-green px-5 text-sm font-extrabold text-white">
          {action.icon ?? <Plus size={17} />}
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

function MetricCard({ metric, icon }: { metric: Metric; icon: React.ReactNode }) {
  return (
    <article className="rounded-lg border border-[#dfe5ec] bg-white p-6">
      <div className="flex items-start justify-between">
        <span className={`grid size-11 place-items-center rounded-lg ${tone[metric.tone ?? "muted"]}`}>{icon}</span>
        {metric.helper ? <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${tone[metric.tone ?? "muted"]}`}>{metric.helper}</span> : null}
      </div>
      <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[1px] text-obligon-text">{metric.label}</p>
      <p className="mt-2 font-display text-4xl font-extrabold">{metric.value}</p>
    </article>
  );
}

function Status({ status, statusTone = "muted" }: { status: string; statusTone?: CompanyTone }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ${tone[statusTone]}`}>{status}</span>;
}

function Cell({ value }: { value: string }) {
  const parts = value.split("\n");
  return <><p className="font-extrabold text-[#07162f]">{parts[0]}</p>{parts.slice(1).map((part) => <p key={part} className="mt-0.5 text-sm text-obligon-text">{part}</p>)}</>;
}

function Table({ title, columns, rows, actionLabel = "View", onAction }: { title: string; columns: string[]; rows: Row[]; actionLabel?: string; onAction?: (row?: Row) => void }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#dfe5ec] bg-white">
      <div className="flex items-center justify-between border-b border-[#dfe5ec] px-6 py-5">
        <h2 className="font-display text-2xl font-extrabold">{title}</h2>
        <button type="button" onClick={() => onAction?.()} className="text-sm font-extrabold text-obligon-green focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2">{actionLabel}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-[#f2f6fa] text-[11px] uppercase tracking-[1px] text-[#566171]">
            <tr>{columns.map((c) => <th key={c} className="px-6 py-4">{c}</th>)}<th className="px-6 py-4 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-[#eef2f6]">
            {rows.map((row, index) => (
              <tr key={`${row.cells[0]}-${index}`}>
                {row.cells.map((cell) => <td key={cell} className="px-6 py-4 align-middle"><Cell value={cell} /></td>)}
                <td className="px-6 py-4">{row.status ? <Status status={row.status} statusTone={row.tone} /> : null}</td>
                <td className="px-6 py-4 text-right"><button type="button" onClick={() => onAction?.(row)} className="font-bold text-obligon-green focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2" aria-label={`Open actions for ${row.cells[0]}`}>•••</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SpendChart() {
  return <div className="h-64 rounded-lg bg-[linear-gradient(#eef2f6_1px,transparent_1px)] bg-[length:100%_52px] p-5"><svg viewBox="0 0 620 220" className="h-full w-full"><path d="M0 160 C80 120 130 130 190 84 C245 42 290 60 340 95 C400 138 462 90 520 52 C570 20 600 32 620 26" fill="none" stroke="#63b800" strokeWidth="5" /><path d="M0 160 C80 120 130 130 190 84 C245 42 290 60 340 95 C400 138 462 90 520 52 C570 20 600 32 620 26 L620 220 L0 220 Z" fill="rgba(170,248,87,.18)" /></svg></div>;
}

function Overview({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  return <Canvas><Header pageKey="overview" onModal={onModal} /><div className="mt-7 grid gap-5 md:grid-cols-3">{overviewMetrics.map((m, i) => <MetricCard key={m.label} metric={m} icon={[<Car key="car" size={20} />, <Fuel key="fuel" size={20} />, <CreditCard key="card" size={20} />][i]} />)}</div><section className="mt-7 grid gap-6 xl:grid-cols-[1fr_320px]"><article className="rounded-lg border border-[#dfe5ec] bg-white p-6"><div className="flex justify-between"><h2 className="font-display text-2xl font-extrabold">Monthly Spend</h2><span className="text-sm font-bold text-obligon-text">Last 6 Months</span></div><SpendChart /></article><article className="rounded-lg border border-[#dfe5ec] bg-white p-6"><h2 className="font-display text-2xl font-extrabold">Spend by Category</h2><div className="mx-auto mt-7 grid size-40 place-items-center rounded-full bg-[conic-gradient(#63b800_0_45%,#07162f_45%_80%,#aaf857_80%_100%)]"><div className="grid size-24 place-items-center rounded-full bg-white text-center"><p className="font-display text-2xl font-extrabold">₦4.2M</p></div></div>{["Fuel 45%","Maintenance 35%","Tolls/Fees 20%"].map((x)=><p key={x} className="mt-3 text-sm font-bold">{x}</p>)}</article></section><div className="mt-7"><Table title="Recent Transactions" columns={["Date","Vehicle","Driver","Amount","Status"]} rows={recentTransactions} actionLabel="View All" onAction={() => onModal("export")} /></div></Canvas>;
}

function Vehicles({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  return <Canvas><Header pageKey="vehicles" action={{ label: "Add Vehicle", modal: "vehicle" }} onModal={onModal} /><div className="mt-6 flex gap-3"><button type="button" onClick={() => onModal("action")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dfe5ec] bg-white px-4 text-sm font-bold"><Filter size={15}/>Filter</button><button onClick={()=>onModal("driver")} className="h-10 rounded-lg border border-[#dfe5ec] bg-white px-4 text-sm font-bold">Add Driver</button></div><div className="mt-6"><Table title="Vehicles" columns={["Vehicle","Plate Number","Assigned Card","Status"]} rows={vehicleRows} actionLabel="Assign Card" onAction={() => onModal("assign")} /></div><article className="mt-7 rounded-lg bg-[#07162f] p-7 text-white"><h2 className="font-display text-2xl font-extrabold">Optimize Your Fleet</h2><p className="mt-2 max-w-xl text-white/75">Assign Fuelvista cards to all your active vehicles to track real-time fuel spending and gain actionable insights.</p><button onClick={()=>onModal("assign")} className="mt-6 rounded-lg bg-obligon-lime px-5 py-3 font-extrabold text-[#07162f]">Bulk Assign Cards</button></article></Canvas>;
}

function Cards({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  return <Canvas><Header pageKey="cards" action={{ label: "Issue New Card", modal: "newCard" }} onModal={onModal} /><div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{cardMetrics.map((m)=><MetricCard key={m.label} metric={m} icon={<CreditCard size={20}/>} />)}</div><div className="mt-7"><Table title="All Cards" columns={["Card Details","Card Number","Assignment","Spend Limit","Status"]} rows={cardRows} actionLabel="Freeze" onAction={() => onModal("cardConfirm")} /></div></Canvas>;
}

function Transactions({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  return <Canvas><Header pageKey="transactions" action={{ label: "Export", modal: "export", icon: <Download size={16}/> }} onModal={onModal} /><div className="mt-6 flex flex-wrap gap-3">{["Filter","Last 30 Days","All Vehicles","All Drivers"].map((x)=><button type="button" onClick={() => onModal("action")} key={x} className="h-10 rounded-lg border border-[#dfe5ec] bg-white px-4 text-sm font-bold">{x}</button>)}</div><div className="mt-6"><Table title="Transactions" columns={["Date & Time","Vehicle / Driver","Merchant","Card","Amount","Status"]} rows={transactionRows} actionLabel="Export" onAction={() => onModal("export")} /></div></Canvas>;
}

function Reports({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  return <Canvas><Header pageKey="reports" action={{ label: "Export PDF", modal: "export", icon: <Download size={16}/> }} onModal={onModal} /><section className="mt-7 grid gap-6 xl:grid-cols-[1fr_320px]"><article className="rounded-lg border border-[#dfe5ec] bg-white p-6"><h2 className="font-display text-2xl font-extrabold">Efficiency Savings</h2><p className="mt-2 text-obligon-text">Estimated fuel and route optimizations vs previous period.</p><p className="mt-6 font-display text-5xl font-extrabold text-obligon-green">₦24,850</p><p className="mt-2 font-bold text-obligon-green">+12.4% • 78% to quarterly goal</p></article><article className="rounded-lg border border-[#dfe5ec] bg-white p-6"><h2 className="font-display text-2xl font-extrabold">Station Usage Breakdown</h2>{["National Network 50%","Regional Partners 30%","Independent 20%"].map(x=><p key={x} className="mt-4 font-bold">{x}</p>)}<p className="mt-8 font-display text-4xl font-extrabold">14.2k</p><p className="text-xs font-extrabold uppercase text-obligon-text">Gallons</p></article></section><div className="mt-7"><Table title="Significant Expenditures" columns={["Date","Vehicle ID","Category","Amount"]} rows={spendRows} actionLabel="View Details" onAction={() => onModal("action")} /></div></Canvas>;
}

function Stations({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  return <Canvas><Header pageKey="stations" onModal={onModal} /><div className="mt-6 grid gap-6 xl:grid-cols-[1fr_390px]"><div className="min-h-[580px] rounded-lg border border-[#dfe5ec] bg-[#dfe8ed] p-6 [background-image:linear-gradient(30deg,rgba(7,22,47,.12)_12%,transparent_12.5%,transparent_87%,rgba(7,22,47,.12)_87.5%)] [background-size:54px_90px]"><span className="rounded-lg bg-white px-4 py-2 font-extrabold">₦3.95</span></div><div className="space-y-4">{stations.map(([name,dist,address,price,badge])=><article key={name} className="rounded-lg border border-[#dfe5ec] bg-white p-5"><div className="flex justify-between"><div><h2 className="font-display text-xl font-extrabold">{name}</h2><p className="text-sm text-obligon-text">{dist}</p><p className="mt-1 text-sm text-obligon-text">{address}</p></div><Status status={badge} statusTone="green"/></div><p className="mt-5 text-xs font-extrabold uppercase text-obligon-text">Diesel Price</p><p className="text-3xl font-extrabold">{price}<span className="text-sm font-normal"> /gal</span></p></article>)}</div></div></Canvas>;
}

function Roadside({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  return <Canvas><Header pageKey="roadside" action={{ label: "Request Help", modal: "roadside" }} onModal={onModal} /><article className="mt-7 rounded-lg border-l-4 border-l-obligon-green bg-white p-6 shadow-sm"><Status status="ACTIVE" statusTone="green"/><h2 className="mt-4 font-display text-2xl font-extrabold">Unit #4092 - Breakdown</h2><p className="mt-1 text-obligon-text">Driver: Marcus Johnson • Location: I-95 North, Mile 142</p><div className="mt-6 grid gap-4 md:grid-cols-3"><p><b>RECEIVED</b><br/>10:42 AM</p><p><b>DISPATCHING</b><br/>Est. 15m</p><p><b>IN PROGRESS</b><br/>QuickTow Inc. accepted dispatch.</p></div></article><div className="mt-7"><Table title="Assistance History" columns={["Date","Unit","Issue","Status"]} rows={assistanceHistory} actionLabel="View All" onAction={() => onModal("action")} /></div></Canvas>;
}

function Billing({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  return <Canvas><Header pageKey="billing" onModal={onModal} /><section className="mt-7 grid gap-6 xl:grid-cols-[1fr_360px]"><article className="rounded-lg border border-[#dfe5ec] bg-white p-7"><p className="text-xs font-extrabold uppercase text-obligon-text">Current Plan</p><h2 className="mt-2 font-display text-3xl font-extrabold">Enterprise Fleet</h2><p className="mt-2 text-obligon-text">Billed annually. Next billing date: Nov 12, 2024</p><p className="mt-6 font-display text-5xl font-extrabold">₦499<span className="text-base font-normal"> /mo</span></p><div className="mt-6 flex gap-3"><button type="button" onClick={() => onModal("action")} className="rounded-lg bg-obligon-green px-5 py-3 font-extrabold text-white">Upgrade Plan</button><button type="button" onClick={() => onModal("action")} className="rounded-lg border border-[#dfe5ec] px-5 py-3 font-extrabold">Cancel Subscription</button></div></article><article className="rounded-lg border border-[#dfe5ec] bg-white p-7"><h2 className="font-display text-xl font-extrabold">Payment Method</h2><p className="mt-5 font-extrabold">VISA •••• •••• •••• 4242</p><p className="text-sm text-obligon-text">Expires 12/25 • Securely saved via Stripe</p><h3 className="mt-7 font-extrabold">Billing Contacts</h3><p className="mt-2">Sarah Connor <Status status="Primary" statusTone="green"/></p><p className="mt-2">finance@obligon.com</p></article></section><div className="mt-7"><Table title="Invoice History" columns={["Date","Invoice ID","Amount","Status"]} rows={invoices} actionLabel="Download All" onAction={() => onModal("export")} /></div></Canvas>;
}

function Team({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  const [query, setQuery] = React.useState("");
  const filteredRows = teamRows.filter((row) => row.cells.join(" ").toLowerCase().includes(query.toLowerCase()));
  return <Canvas><Header pageKey="team" action={{ label: "Add team member", modal: "teamMember" }} onModal={onModal} /><div className="mt-6 flex gap-3"><label className="flex h-10 items-center gap-2 rounded-lg border border-[#dfe5ec] bg-white px-3"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff..." aria-label="Search team members" className="bg-transparent outline-none"/></label><button type="button" onClick={() => onModal("action")} className="rounded-lg border border-[#dfe5ec] bg-white px-4 font-bold" aria-label="Filter team members"><Filter size={15}/></button></div><div className="mt-6">{filteredRows.length ? <Table title="Team Members" columns={["Name","Email","Role","Last Active"]} rows={filteredRows} actionLabel="Edit" onAction={() => onModal("teamMember")} /> : <p className="rounded-lg border border-dashed border-[#dfe5ec] bg-white p-8 text-center font-bold text-obligon-text">No team members match that search. Clear the search or add a team member.</p>}</div></Canvas>;
}

function Notifications({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  const [allRead, setAllRead] = React.useState(false);
  return <Canvas><Header pageKey="notifications" onModal={onModal} /><p className="mt-2 text-obligon-text">{allRead ? "All notifications are marked as read for this session." : "You have 3 unread notifications."}</p><button type="button" disabled={allRead} onClick={() => setAllRead(true)} className="mt-5 h-10 rounded-lg bg-obligon-green px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60">{allRead ? "ALL CAUGHT UP" : "MARK ALL AS READ"}</button><section className="mt-7 space-y-4">{notifications.map(([title,time,body,badge,action])=><article key={title} className={`rounded-lg border border-[#dfe5ec] bg-white p-5 ${allRead ? "opacity-70" : ""}`}><div className="flex justify-between"><h2 className="font-display text-xl font-extrabold">{title}</h2><span className="text-sm text-obligon-text">{time}</span></div><p className="mt-2 text-obligon-text">{body}</p><div className="mt-4 flex gap-2">{badge ? <Status status={badge} statusTone="blue"/> : null}{action ? <button type="button" onClick={() => onModal("action")} className="rounded-full bg-[#ffe8e8] px-3 py-1 text-[10px] font-extrabold uppercase text-[#c1121f]">{action}</button> : null}</div></article>)}</section></Canvas>;
}

function Support({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  return <Canvas><Header pageKey="support" action={{ label: "Contact Support", modal: "supportTicket" }} onModal={onModal} /><section className="mt-7 grid gap-6 xl:grid-cols-[1fr_340px]"><article className="rounded-lg border border-[#dfe5ec] bg-white p-6"><h2 className="font-display text-2xl font-extrabold">Frequently Asked Questions</h2>{["How do I add a new vehicle to my fleet?","How is billing calculated for fuel cards?"].map(q=><p key={q} className="border-b border-[#eef2f6] py-4 font-bold">{q}</p>)}</article><article className="rounded-lg bg-[#07162f] p-6 text-white"><Status status="PRO" statusTone="green"/><h2 className="mt-5 font-display text-2xl font-extrabold">Need Immediate Assistance?</h2><p className="mt-2 text-white/70">Our enterprise support team is available 24/7 for critical fleet operational issues.</p><p className="mt-6 font-display text-2xl font-extrabold">1-800-OBLIGON</p></article></section><div className="mt-7"><Table title="Past Tickets" columns={["ID","Date","Subject","Status"]} rows={tickets} actionLabel="View All Tickets" onAction={() => onModal("supportTicket")} /></div></Canvas>;
}

function SettingsPage({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  return <Canvas><Header pageKey="settings" onModal={onModal} /><section className="mt-7 grid gap-7 xl:grid-cols-[1fr_360px]"><article className="rounded-lg border border-[#dfe5ec] bg-white p-7"><h2 className="font-display text-2xl font-extrabold">Company Profile</h2>{[["Company Name","Obligon Logistics Inc."],["Registered Address","482 Fleetway Blvd, Suite 200, Seattle, WA 98104"],["Tax Identification Number","XX-XXXX892"],["Primary Operating Region","North America - Pacific Northwest"]].map(([l,v])=><label key={l} className="mt-5 block"><span className="text-xs font-extrabold uppercase text-obligon-text">{l}</span><input className="mt-2 h-12 w-full rounded-lg border border-[#dfe5ec] px-4 font-bold outline-none" defaultValue={v}/></label>)}<button type="button" onClick={() => onModal("action")} className="mt-7 rounded-lg bg-obligon-green px-5 py-3 font-extrabold text-white">SAVE CHANGES</button></article><article className="rounded-lg border border-[#dfe5ec] bg-white p-7"><h2 className="font-display text-2xl font-extrabold">Security</h2><p className="mt-4 font-bold">Update Password</p><p className="text-sm text-obligon-text">Ensure your account is using a long, random password to stay secure.</p>{["Current Password","New Password","Confirm Password"].map(x=><input key={x} className="mt-4 h-11 w-full rounded-lg border border-[#dfe5ec] px-4 outline-none" placeholder={x} type="password"/>)}<p className="mt-6 font-bold">Two-Factor Authentication</p><p className="mt-2 text-sm text-obligon-text">Authenticator App • Status: Active</p></article></section></Canvas>;
}

function Maintenance({ onModal }: { onModal: (modal: CompanyModalKey) => void }) {
  return <Canvas><Header pageKey="maintenance" action={{ label: "Schedule Service", modal: "service" }} onModal={onModal} /><section className="mt-7 grid gap-6 xl:grid-cols-[1fr_320px]"><article className="rounded-lg border border-[#dfe5ec] bg-white p-6"><h2 className="font-display text-2xl font-extrabold">Upcoming Service Schedule</h2>{["OVERDUE|TRK-9042 • Volvo VNL|Full Synthetic Oil Change & Brake Inspection|2 Days Ago", "SCHEDULED|VAN-402 • Ford Transit|Tire Rotation & Alignment|Oct 24, 2023"].map(x=>{const [s,v,d,t]=x.split('|');return <div key={v} className="mt-5 rounded-lg bg-[#f8fafc] p-4"><Status status={s} statusTone={s==="OVERDUE"?"red":"blue"}/><p className="mt-3 font-extrabold">{v}</p><p className="text-sm text-obligon-text">{d}</p><p className="mt-2 text-sm font-bold">{t}</p></div>})}</article><article className="rounded-lg border border-[#dfe5ec] bg-white p-6"><h2 className="font-display text-2xl font-extrabold">Fleet Health</h2><p className="mt-5 text-sm font-extrabold uppercase text-obligon-text">Preventative Maintenance</p><p className="font-display text-5xl font-extrabold text-obligon-green">85%</p><p className="mt-4">Active Critical Alerts <b>3</b></p><p className="mt-2">Healthy <b>142</b></p><p className="mt-2">Needs Service <b>12</b></p></article></section><div className="mt-7"><Table title="Recent Service History" columns={["Date","Vehicle ID","Service Type","Provider","Cost","Status"]} rows={maintenanceRows} actionLabel="Export" onAction={() => onModal("export")} /></div></Canvas>;
}

export function CompanyScreen({ pageKey }: { pageKey: CompanyPageKey }) {
  const [modal, setModal] = React.useState<CompanyModalKey>(null);
  const pages: Record<CompanyPageKey, React.ReactNode> = {
    overview: <Overview onModal={setModal} />,
    vehicles: <Vehicles onModal={setModal} />,
    cards: <Cards onModal={setModal} />,
    transactions: <Transactions onModal={setModal} />,
    reports: <Reports onModal={setModal} />,
    stations: <Stations onModal={setModal} />,
    roadside: <Roadside onModal={setModal} />,
    billing: <Billing onModal={setModal} />,
    team: <Team onModal={setModal} />,
    notifications: <Notifications onModal={setModal} />,
    support: <Support onModal={setModal} />,
    settings: <SettingsPage onModal={setModal} />,
    maintenance: <Maintenance onModal={setModal} />
  };
  return <>{pages[pageKey]}<CompanyModals modal={modal} onClose={() => setModal(null)} /></>;
}

