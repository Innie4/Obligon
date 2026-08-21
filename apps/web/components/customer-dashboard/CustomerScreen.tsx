"use client";

import * as React from "react";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
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
  stations,
  topUpHistory,
  transactionHistory,
  vehicles,
  type CustomerPageKey,
  type CustomerTone,
  type CustomerTransaction
} from "./customer-data";
import { CustomerModals, type CustomerModalType } from "./CustomerModals";

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
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-6 py-6">
        <h2 className="font-display text-2xl font-extrabold">Vehicle Performance</h2>
        <button className="text-sm font-extrabold text-obligon-green" type="button">View All</button>
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
  return (
    <Canvas compact>
      <div className="lg:hidden">
        <h1 className="font-display text-3xl font-extrabold">Transaction History</h1>
        <div className="mt-5 grid grid-cols-3 gap-3">{["Date Range", "Station", "Vehicle"].map((item) => <button key={item} className="h-10 rounded-lg border border-[#dbe2d8] bg-white text-xs font-bold" type="button">{item}</button>)}</div>
        <div className="mt-6 space-y-7">
          {mobileHistory.map((group) => <section key={group.group}><p className="mb-3 text-sm font-extrabold text-obligon-green">{group.group}</p><div className="space-y-3">{group.items.map((item) => <a key={item.station + item.time} href="/customer/transaction-detail" className="flex rounded-lg bg-white p-4 shadow-sm"><div className="flex-1"><p className="font-extrabold">{item.station}</p><p className="text-sm text-obligon-text">{item.meta}</p></div><div className="text-right"><p className="font-extrabold">{item.amount}</p><p className="text-sm text-obligon-text">{item.time}</p></div></a>)}</div></section>)}
        </div>
      </div>
      <div className="hidden lg:block">
        <div className="mb-7 flex flex-wrap gap-4 rounded-lg border border-[#dbe2d8] bg-white p-5">
          {["Date Range Oct 1 - Oct 31, 2023", "Station All Stations", "Vehicle All Vehicles"].map((item) => <button key={item} className="h-11 rounded-lg border border-[#dbe2d8] px-4 text-sm font-bold" type="button">{item}</button>)}
          <button className="ml-auto h-11 rounded-lg bg-obligon-green px-5 text-sm font-extrabold text-white" type="button">Apply Filters</button>
        </div>
        <Card className="overflow-hidden"><table className="w-full text-left"><thead className="bg-[#f0f4f0] text-xs uppercase text-[#3f463d]"><tr>{["Station Name", "Vehicle ID", "Fuel Type", "Amount", "Timestamp"].map((h) => <th key={h} className="px-6 py-4">{h}</th>)}</tr></thead><tbody className="divide-y divide-[#eef3ee]">{transactionHistory.map((row) => <tr key={`${row.station}-${row.time}`}><td className="px-6 py-5"><p className="font-extrabold">{row.station}</p><p className="text-sm text-obligon-text">{row.meta}</p></td><td>{row.vehicle}</td><td>{row.fuel}</td><td className="font-extrabold">{row.amount}</td><td>{row.time}</td></tr>)}</tbody></table><div className="flex justify-between border-t border-[#eef3ee] p-5 text-sm"><span>Showing 1-5 of 124 transactions</span><span className="space-x-3"><button>Previous</button><button>Next</button></span></div></Card>
      </div>
    </Canvas>
  );
}

function CardPage() {
  const cardActions: Array<{ title: string; body: string; Icon: ComponentType<LucideProps>; tone: CustomerTone }> = [
    { title: "Replace Card", body: "Request a new physical card", Icon: CreditCard, tone: "green" },
    { title: "Report Lost", body: "Block and report stolen card", Icon: FileWarning, tone: "red" },
    { title: "Freeze Card", body: "Temporarily lock transactions", Icon: Snowflake, tone: "green" }
  ];

  return (
    <Canvas>
      <div className="lg:hidden"><h1 className="font-display text-3xl font-extrabold">Card Management</h1><p className="mt-2 text-obligon-text">View and manage your active fleet subscription card.</p></div>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <Card className="relative min-h-[280px] overflow-hidden bg-[#050816] p-8 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(170,248,87,.32),transparent_28%),linear-gradient(135deg,#061958,#050816)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex justify-between"><p className="font-display text-3xl font-extrabold">Obligon</p><span className="rounded-full bg-[#e8fbd7] px-3 py-1 text-xs font-extrabold text-obligon-green">ACTIVE STATUS</span></div>
            <div><p className="font-mono text-2xl tracking-[3px]">•••• •••• •••• 4092</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-white/60">CARDHOLDER NAME</p><p className="font-extrabold">Obligon Enterprise Fleet</p></div><div><p className="text-xs text-white/60">AVAILABLE BALANCE</p><p className="font-extrabold">₦12,450.00</p></div></div></div>
          </div>
        </Card>
        <div className="space-y-4">
          {cardActions.map(({ title, body, Icon, tone }) => <Card key={title} className="p-5"><div className="flex gap-4"><MiniIcon tone={tone}><Icon size={19} /></MiniIcon><div><h2 className="font-extrabold">{title}</h2><p className="text-sm text-obligon-text">{body}</p></div></div></Card>)}
        </div>
      </div>
    </Canvas>
  );
}

function WalletPage({ onModal }: { onModal: (modal: CustomerModalType) => void }) {
  return (
    <Canvas>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="font-display text-3xl font-extrabold">Wallet Management</h1><p className="mt-2 text-obligon-text">Top up and manage your fleet balance.</p></div><button onClick={() => onModal("topup")} className="h-12 rounded-lg bg-obligon-green px-6 font-extrabold text-white" type="button">Add Funds</button></div>
      <Card className="mt-8 p-7"><p className="text-xs font-extrabold uppercase text-obligon-text">Available Balance</p><p className="mt-3 font-display text-5xl font-extrabold">₦24,500.00</p><p className="mt-3 text-sm font-bold text-obligon-green">+12% • Auto-recharge enabled at ₦5,000</p></Card>
      <Card className="mt-8 overflow-hidden"><div className="flex items-center justify-between px-6 py-5"><h2 className="font-display text-2xl font-extrabold">Recent Transactions</h2><button className="text-sm font-bold text-obligon-green" type="button">View All</button></div><div className="hidden lg:block"><table className="w-full text-left"><thead className="bg-[#f0f4f0] text-xs uppercase"><tr>{["Date","Reference","Method","Amount"].map(h=><th className="px-6 py-4" key={h}>{h}</th>)}</tr></thead><tbody>{desktopTopUps.map(row=><tr className="border-t border-[#eef3ee]" key={row[1]}>{row.map(cell=><td className="px-6 py-4" key={cell}>{cell}</td>)}</tr>)}</tbody></table></div><div className="divide-y divide-[#eef3ee] lg:hidden">{topUpHistory.map(([method,date,amount])=><div key={date} className="flex justify-between p-5"><div><p className="font-extrabold">{method}</p><p className="text-sm text-obligon-text">{date}</p></div><p className="font-extrabold text-obligon-green">{amount}</p></div>)}</div></Card>
    </Canvas>
  );
}

function StationsPage() {
  return (
    <Canvas>
      <div className="mb-6 flex gap-3 rounded-lg border border-[#dbe2d8] bg-white p-3"><input className="flex-1 bg-transparent px-3 outline-none" placeholder="Search locations or routes..." /><button className="rounded-lg bg-obligon-green px-4 font-extrabold text-white" type="button">All Fuels</button></div>
      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <Card className="min-h-[520px] overflow-hidden bg-[#dfe8ed]"><div className="h-full min-h-[520px] bg-[linear-gradient(30deg,rgba(6,25,88,.12)_12%,transparent_12.5%,transparent_87%,rgba(6,25,88,.12)_87.5%),linear-gradient(150deg,rgba(6,25,88,.12)_12%,transparent_12.5%,transparent_87%,rgba(6,25,88,.12)_87.5%)] bg-[length:52px_88px] p-6"><span className="rounded-lg bg-white px-4 py-2 font-extrabold text-obligon-green">₦3.45</span></div></Card>
        <div className="space-y-4">{stations.map((station, index)=><Card key={station.name} className="p-5"><div className="flex justify-between"><div><h2 className="font-display text-xl font-extrabold">{station.name}</h2><p className="text-sm text-obligon-text">{station.distance}</p><p className="mt-1 text-sm text-obligon-text">{station.address}</p></div><MapPinned className="text-obligon-green" /></div><div className="mt-5 grid grid-cols-2 gap-3"><p className="rounded-lg bg-[#f7fbf8] p-3 text-sm"><span className="block text-xs font-bold">DIESEL</span><span className="font-extrabold">{station.diesel}</span> /gal</p><p className="rounded-lg bg-[#f7fbf8] p-3 text-sm"><span className="block text-xs font-bold">UNLEADED</span><span className="font-extrabold">{station.unleaded}</span> /gal</p></div><div className="mt-4 flex gap-3"><button className="h-10 flex-1 rounded-lg bg-obligon-green font-extrabold text-white" type="button">Directions</button><button className="h-10 flex-1 rounded-lg border border-[#dbe2d8] font-extrabold" type="button">Details</button></div>{index===0 ? <p className="mt-3 text-xs font-bold text-obligon-green">Open 24/7 • 1.2 mi away</p> : null}</Card>)}</div>
      </div>
    </Canvas>
  );
}

function SupportPage({ onModal }: { onModal: (modal: CustomerModalType) => void }) {
  return (
    <Canvas>
      <h1 className="font-display text-4xl font-extrabold">Support Center</h1><p className="mt-3 text-lg text-obligon-text">How can we help you accelerate your fleet operations today?</p>
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card className="p-6"><MessageCircle className="text-obligon-green" /><h2 className="mt-5 font-display text-2xl font-extrabold">Chat with us</h2><p className="mt-2 text-obligon-text">Connect with a support agent instantly for real-time assistance.</p><button className="mt-6 h-11 rounded-lg bg-obligon-green px-5 font-extrabold text-white" type="button">START CONVERSATION</button></Card>
        <Card className="p-6"><AlertTriangle className="text-[#c1121f]" /><h2 className="mt-5 font-display text-2xl font-extrabold">Report a transaction issue</h2><p className="mt-2 text-obligon-text">Dispute a charge or report anomalies in your billing statement.</p><button onClick={() => onModal("report")} className="mt-6 h-11 rounded-lg bg-[#20251f] px-5 font-extrabold text-white" type="button">FILE REPORT</button></Card>
      </div>
      <Card className="mt-8 p-6"><h2 className="font-display text-2xl font-extrabold">Frequently Asked Questions</h2>{["How to freeze my card", "Where can I use my card?", "Reporting a transaction issue"].map(q=><p key={q} className="border-b border-[#eef3ee] py-4 font-bold last:border-0">{q}</p>)}</Card>
    </Canvas>
  );
}

function TransactionDetailPage({ onModal }: { onModal: (modal: CustomerModalType) => void }) {
  return (
    <Canvas>
      <Card className="mx-auto max-w-3xl p-7"><p className="text-xs font-extrabold uppercase text-obligon-text">Transaction Detail</p><h1 className="mt-2 font-display text-3xl font-extrabold">Pilot Travel Center #492</h1><p className="mt-1 text-obligon-text">Oct 24, 2023 • 2:15 PM</p><div className="mt-7 rounded-lg bg-[#f7fbf8] p-6 text-center"><p className="text-sm font-bold text-obligon-text">Total Amount</p><p className="font-display text-5xl font-extrabold">₦342.50</p><Status status="Completed" /></div><div className="mt-7 grid gap-5 sm:grid-cols-2">{[["FUEL TYPE","Diesel #2"],["GALLONS","75.000 gal"],["PRICE PER GALLON","₦4.569"],["AUTH CODE","AUTH-88392-XT"],["CARD USED","•••• •••• •••• 4092"],["PAYMENT METHOD","•••• 4289"]].map(([l,v])=><div key={l}><p className="text-xs font-extrabold uppercase text-obligon-text">{l}</p><p className="mt-1 font-extrabold">{v}</p></div>)}</div><div className="mt-8 flex gap-3"><button className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold" type="button"><Download className="inline" size={17}/> Download Receipt</button><button onClick={()=>onModal("report")} className="h-12 flex-1 rounded-lg bg-[#20251f] font-extrabold text-white" type="button">Report a Problem</button></div></Card>
    </Canvas>
  );
}

function Status({ status }: { status: string }) {
  return <span className="mt-3 inline-flex rounded-full bg-[#e8fbd7] px-3 py-1 text-xs font-extrabold text-obligon-green">{status}</span>;
}

function ReportPage({ onModal }: { onModal: (modal: CustomerModalType) => void }) {
  return (
    <Canvas><Card className="mx-auto max-w-2xl p-7"><h1 className="font-display text-3xl font-extrabold">Report a Problem</h1><p className="mt-2 text-obligon-text">Transaction at Station #4092</p><button onClick={()=>onModal("report")} className="mt-8 h-12 rounded-lg bg-obligon-green px-6 font-extrabold text-white" type="button">Open Report Form</button></Card></Canvas>
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
          <button className="mt-8 h-12 rounded-lg bg-obligon-green px-6 font-extrabold text-white" type="button">Save Changes</button>
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

          <button className="mt-8 h-11 w-full rounded-lg border border-[#20251f] font-extrabold" type="button">Log Out</button>
        </Card>
      </div>
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
  const pages: Record<CustomerPageKey, React.ReactNode> = {
    overview: <OverviewPage />,
    transactions: <TransactionsPage />,
    card: <CardPage />,
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
      />
    </>
  );
}
