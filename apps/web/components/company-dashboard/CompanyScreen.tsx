"use client";
import * as React from "react";
import Link from "next/link";
import { Car, CreditCard, Download, Fuel, Loader2, Plus, Search } from "lucide-react";
import { pageCopy, type CompanyModalKey, type CompanyPageKey, type CompanyTone, type Metric } from "@/lib/mock/company-data";
import { CompanyModals, type CompanyModalContext } from "./CompanyModals";
import { companyApi, type CompanyRow } from "@/lib/services/company";
import { mutationsApi } from "@/lib/services";
import { useAsync, type AsyncResult } from "@/components/shared/useAsync";
import { AsyncBoundary, EmptyState } from "@/components/shared/States";
import { useToast } from "@/components/shared/Toast";
import { useSession } from "@/components/shared/AuthContext";
type OpenModal = (modal: CompanyModalKey, context?: CompanyModalContext) => void;
type PageProps = {
  onModal: OpenModal;
};
const tone: Record<CompanyTone, string> = { green: "bg-[#e8fbd7] text-obligon-green", red: "bg-[#ffe8e8] text-[#c1121f]", amber: "bg-[#fff3d8] text-[#9a6300]", blue: "bg-[#e8efff] text-obligon-blue", dark: "bg-[#07162f] text-white", muted: "bg-[#edf1f5] text-obligon-text" };
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-obligon-green px-5 py-2 text-sm font-extrabold text-white";
const controlClass = "min-h-11 min-w-0 rounded-xl border border-[#dfe5ec] bg-white px-3 text-sm";
function Canvas({ children }: {
  children: React.ReactNode;
}) { return <section className="px-4 py-7 sm:px-8 lg:px-10">{children}</section>; }
function Header({ pageKey, action, onModal }: {
  pageKey: CompanyPageKey;
  action?: {
    label: string;
    modal: CompanyModalKey;
    context?: CompanyModalContext;
  };
  onModal: OpenModal;
}) {
  const page = pageCopy[pageKey];
  return <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

    <div>

      <p className="text-xs font-extrabold uppercase tracking-wide text-obligon-green">Company dashboard</p>

      <h1 className="mt-2 font-display text-3xl font-extrabold text-obligon-navy lg:text-4xl">{page.title}</h1>

      {page.description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-obligon-text">{page.description}</p> : null}

    </div>

    {action ? <button type="button" onClick={() => onModal(action.modal, action.context)} className={buttonClass}>

      {action.modal === "export" ? <Download size={17} /> : <Plus size={17} />}

      {action.label}

    </button> : null}

  </div>;
}
function DataBoundary<T>({ result, children }: {
  result: AsyncResult<T>;
  children: React.ReactNode;
}) {
  return <AsyncBoundary status={result.status} error={result.error?.message ?? null} onRetry={result.reload}>

    {children}

  </AsyncBoundary>;
}
function Status({ status, statusTone = "muted" }: {
  status: string;
  statusTone?: CompanyTone;
}) { return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tone[statusTone]}`}>{status}</span>; }
function Metrics({ metrics }: {
  metrics: Metric[];
}) {
  return <div className="mt-6 grid gap-4 md:grid-cols-3">

    {metrics.map((metric, index) => <article key={metric.label} className="rounded-xl border border-[#dfe5ec] bg-white p-5">

      <span className="text-obligon-green">

        {index === 0 ? <Car size={20} /> : index === 1 ? <Fuel size={20} /> : <CreditCard size={20} />}

      </span>

      <p className="mt-4 text-xs font-bold text-obligon-text">{metric.label}</p>

      <p className="mt-1 break-words text-3xl font-extrabold text-obligon-navy">{metric.value}</p>

      {metric.helper ? <p className="mt-2 text-xs text-obligon-text">{metric.helper}</p> : null}

    </article>)}

  </div>;
}
function Table({ title, columns, rows, empty = "No records yet.", actionLabel, onAction, onRowAction }: {
  title: string;
  columns: string[];
  rows: CompanyRow[];
  empty?: string;
  actionLabel?: string;
  onAction?: () => void;
  onRowAction?: (row: CompanyRow) => void;
}) {
  const hasStatus = rows.some(row => row.status);
  return <section className="mt-6 overflow-hidden rounded-xl border border-[#dfe5ec] bg-white">

    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe5ec] p-5">

      <h2 className="font-display text-xl font-extrabold text-obligon-navy">{title}</h2>

      {onAction && actionLabel ? <button type="button" onClick={onAction} className="min-h-11 rounded-lg px-3 text-sm font-bold text-obligon-green hover:underline">

        {actionLabel}

      </button> : null}

    </div>

    {rows.length ? <div className="overflow-x-auto">

      <table className="w-full text-left text-sm">

        <thead className="bg-[#f2f6fa] text-xs text-[#566171]">

          <tr>

            {columns.map(column => <th key={column} className="whitespace-nowrap px-5 py-4">{column}</th>)}

            {hasStatus ? <th className="px-5 py-4">Status</th> : null}

            {onRowAction ? <th className="px-5 py-4">Action</th> : null}

          </tr>

        </thead>

        <tbody className="divide-y divide-[#eef2f6]">

          {rows.map((row, index) => <tr key={row.id ?? `${row.cells[0]}-${index}`}>

            {row.cells.map((cell, cellIndex) => <td key={cellIndex} className="min-w-[120px] px-5 py-4 align-top">

              {cell.split("\n").map((part, partIndex) => <p key={partIndex} className={partIndex ? "mt-1 text-xs text-obligon-text" : "font-bold text-obligon-navy"}>{part}</p>)}

            </td>)}

            {hasStatus ? <td className="px-5 py-4">{row.status ? <Status status={row.status} statusTone={row.tone} /> : null}</td> : null}

            {onRowAction ? <td className="px-5 py-4">

              <button type="button" onClick={() => onRowAction(row)} className="relative min-h-11 rounded-lg px-3 font-bold text-obligon-green">Manage<span className="sr-only"> {row.cells[0]}</span></button>

            </td> : null}

          </tr>)}

        </tbody>

      </table>

    </div> : <EmptyState title={empty} />}

  </section>;
}
function Overview({ onModal }: PageProps) {
  const result = useAsync(companyApi.overview);
  return <Canvas>

    <Header pageKey="overview" onModal={onModal} />

    <DataBoundary result={result}>

      <Metrics metrics={result.data?.metrics ?? []} />

      <p className="mt-6 text-sm text-obligon-text">Metrics use recorded fleet transactions and cards. Open Reports for spend and station totals.</p>

      <Link href="/company/reports" className="mt-3 inline-flex min-h-11 items-center font-bold text-obligon-green">View fleet reports →</Link>

      <Table title="Recent transactions" columns={["Date", "Vehicle", "Driver", "Amount"]} rows={result.data?.recentTransactions ?? []} actionLabel="Export" onAction={() => onModal("export")} />

    </DataBoundary>

  </Canvas>;
}
function Vehicles({ onModal }: PageProps) {
  const result = useAsync(companyApi.vehicles);
  return <Canvas>

    <Header pageKey="vehicles" action={{ label: "Add Vehicle", modal: "vehicle" }} onModal={onModal} />

    <div className="mt-5 flex flex-wrap gap-3">

      <button type="button" onClick={() => onModal("driver")} className={controlClass}>Add Driver</button>

      <button type="button" onClick={() => onModal("assign")} className={controlClass}>Assign Card</button>

      <button type="button" onClick={() => onModal("export", { scope: "vehicles" })} className={controlClass}>Export Fleet</button>

    </div>

    <DataBoundary result={result}>

      <Table title="Fleet vehicles" columns={["Vehicle", "Plate", "Assigned card"]} rows={result.data?.vehicles ?? []} empty="No vehicles. Add your first vehicle above." onRowAction={row => onModal("assign", { vehicleId: row.id })} />

    </DataBoundary>

  </Canvas>;
}
function Cards({ onModal }: PageProps) {
  const result = useAsync(companyApi.cards);
  return <Canvas>

    <Header pageKey="cards" action={{ label: "Issue New Card", modal: "newCard" }} onModal={onModal} />

    <div className="mt-5 flex flex-wrap gap-3">

      <button type="button" onClick={() => onModal("assign")} className={controlClass}>Assign Card</button>

      <button type="button" onClick={() => onModal("cardConfirm")} className={controlClass}>Freeze / Unfreeze Card</button>

    </div>

    <DataBoundary result={result}>

      <Metrics metrics={result.data?.metrics ?? []} />

      <Table title="All cards" columns={["Card", "Number", "Assignment", "Remaining monthly limit"]} rows={result.data?.cards ?? []} empty="No cards. Issue your first card above." onRowAction={row => onModal("cardConfirm", { cardId: row.cardId ?? row.id })} />

    </DataBoundary>

  </Canvas>;
}
function Transactions({ onModal }: PageProps) {
  const [vehicle, setVehicle] = React.useState("");
  const [driver, setDriver] = React.useState("");
  const [range, setRange] = React.useState("30");
  const [date, setDate] = React.useState("");
  const choices = useAsync(companyApi.choices);
  const driverFilterReady = choices.data?.capabilities?.stableDriverFilters === true;
  const effectiveDriverId = driverFilterReady ? driver : "";
  const query = new URLSearchParams({ range, limit: "100" });
  if (vehicle)
    query.set("vehicle", vehicle);
  if (effectiveDriverId)
    query.set("driverId", effectiveDriverId);
  if (date)
    query.set("date", date);
  const result = useAsync(() => companyApi.transactions(query.toString()), [vehicle, effectiveDriverId, range, date]);
  const context = { scope: "transactions", range, vehicle, driverId: effectiveDriverId, date };
  return <Canvas>

    <Header pageKey="transactions" action={{ label: "Export CSV", modal: "export", context }} onModal={onModal} />

    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

      <label className="text-xs font-bold">Vehicle<select className={`${controlClass} mt-1 w-full`} value={vehicle} onChange={e => setVehicle(e.target.value)}>

        <option value="">All vehicles</option>

        {choices.data?.vehicles.map(v => <option key={v.id} value={v.plate}>{v.plate}</option>)}

      </select></label>

      <label className="text-xs font-bold">Driver<select className={`${controlClass} mt-1 w-full`} value={driver} disabled={!driverFilterReady} onChange={e => setDriver(e.target.value)}>

        <option value="">All drivers</option>

        {choices.data?.drivers.map(d => <option key={d.id} value={d.id}>{d.name} · {d.phone || d.licenseNo || `Driver ${d.id.slice(-8)}`}</option>)}

      </select></label>

      <label className="text-xs font-bold">Period<select className={`${controlClass} mt-1 w-full`} value={range} onChange={e => { setRange(e.target.value); setDate(""); }}>

        {[7, 30, 90, 365].map(days => <option key={days} value={days}>Last {days} days</option>)}

      </select></label>

      <label className="text-xs font-bold">Specific date<input className={`${controlClass} mt-1 w-full`} type="date" value={date} onChange={e => setDate(e.target.value)} /></label>

    </div>

    {choices.error ? <p role="alert" className="mt-3 text-sm text-red-700">Fleet filter choices could not load. <button className="underline" onClick={choices.reload}>Retry</button></p> : null}

    {!driverFilterReady && choices.status === "success" ? <p className="mt-3 text-sm text-obligon-text">Driver filtering is currently unavailable. Refresh this page to try again.</p> : null}
    <DataBoundary result={result}>

      <Table title="Transactions" columns={["Date & time", "Vehicle / driver", "Station / fuel", "Card", "Amount"]} rows={result.data?.transactions ?? []} empty="No transactions match these filters." />

      <p className="mt-3 text-xs text-obligon-text">Showing {result.data?.transactions.length ?? 0} of {result.data?.total ?? 0} matching transactions. Export includes all matching records.</p>

    </DataBoundary>

  </Canvas>;
}
function Reports({ onModal }: PageProps) {
  const result = useAsync(companyApi.reports);
  return <Canvas>

    <Header pageKey="reports" action={{ label: "Export CSV", modal: "export" }} onModal={onModal} />

    <DataBoundary result={result}>

      <p className="mt-5 text-sm text-obligon-text">Recorded successful transactions over the last 30 days.</p>

      <Metrics metrics={result.data?.metrics ?? []} />

      <Table title="Spend by vehicle and fuel" columns={["Report date", "Vehicle", "Fuel / litres", "Spend"]} rows={result.data?.spend ?? []} empty="No recorded spend in this period." />

      <section className="mt-6 rounded-xl border border-[#dfe5ec] bg-white p-5">

        <h2 className="text-xl font-extrabold">Station usage</h2>

        {result.data?.stationUsage.length ? <ul className="mt-4 divide-y">

          {result.data.stationUsage.map((station, index) => <li key={`${station.station}-${index}`} className="flex flex-wrap justify-between gap-3 py-3">

            <span className="font-bold">{station.station}</span>

            <span>{station.total} · {station.visits} visits</span>

          </li>)}

        </ul> : <p className="mt-3 text-sm text-obligon-text">Station usage will appear after fleet transactions are recorded.</p>}

      </section>

    </DataBoundary>

  </Canvas>;
}
function Stations({ onModal }: PageProps) {
  const [search, setSearch] = React.useState("");
  const result = useAsync(() => companyApi.stations(search), [search]);
  return <Canvas>

    <Header pageKey="stations" onModal={onModal} />

    <label className="mt-5 flex min-h-11 max-w-lg items-center gap-2 rounded-xl border border-[#dfe5ec] bg-white px-3">

      <Search size={18} />

      <input className="min-w-0 flex-1 bg-transparent py-3 text-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search station, address or city" aria-label="Search stations" />

    </label>

    <DataBoundary result={result}>

      <div className="mt-6 grid gap-4 md:grid-cols-2">

        {result.data?.details.map(station => {
          const prices = station.prices ?? [];
          const destination = station.lat != null && station.lng != null ? `${station.lat},${station.lng}` : `${station.name}, ${station.address}`;
          return <article key={station.id} className="flex flex-col rounded-xl border border-[#dfe5ec] bg-white p-5">

            <h2 className="text-xl font-extrabold">{station.name}</h2>

            <p className="mt-2 text-sm text-obligon-text">{station.address || "Address pending"}</p>

            <p className="mt-1 text-sm">{station.hours || "Opening hours pending"}</p>

            {prices.length ? <dl className="mt-4 space-y-2">

              {prices.map((price, index) => <div key={`${price.fuel}-${index}`} className="flex justify-between gap-3">

                <dt>{price.fuel}</dt>

                <dd className="font-bold">{price.priceLabel} /L</dd>

              </div>)}

            </dl> : <p className="mt-4 text-sm text-obligon-text">Fuel prices are currently unavailable.</p>}

            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex min-h-11 items-center pt-4 font-bold text-obligon-green">Get directions ↗</a>

          </article>;
        })}

      </div>

      {result.data?.details.length === 0 ? <EmptyState title="No matching stations" message="Try a different name or city." /> : null}

    </DataBoundary>

  </Canvas>;
}
function Roadside({ onModal }: PageProps) {
  const result = useAsync(companyApi.roadside);
  return <Canvas>

    <Header pageKey="roadside" action={{ label: "Request Emergency Help", modal: "roadside" }} onModal={onModal} />

    <DataBoundary result={result}>

      {result.data?.active.map(request => <article key={request.id} className="mt-5 rounded-xl border border-[#dfe5ec] bg-white p-5">

        <Status status={request.status} statusTone="amber" />

        <h2 className="mt-3 text-xl font-extrabold">{request.vehicle} · {request.issue}</h2>

        <p className="mt-2 text-sm">{request.location}</p>

        <p className="mt-2 text-sm text-obligon-text">Received: {request.time}{request.etaMinutes == null ? " · Arrival estimate pending" : ` · Estimated arrival: ${request.etaMinutes} minutes`}</p>

      </article>)}

      <Table title="Assistance history" columns={["Date", "Vehicle", "Issue"]} rows={result.data?.requests ?? []} empty="No assistance requests. Request help above when needed." />

    </DataBoundary>

  </Canvas>;
}
function Billing({ onModal }: PageProps) {
  const result = useAsync(companyApi.billing);
  const { user } = useSession();
  return <Canvas>

    <Header pageKey="billing" action={{ label: "Export Invoices", modal: "export", context: { scope: "invoices" } }} onModal={onModal} />

    <DataBoundary result={result}>

      <section className="mt-6 grid gap-4 md:grid-cols-2">

        <article className="rounded-xl border border-[#dfe5ec] bg-white p-5">

          <h2 className="text-xl font-extrabold">Contract and billing</h2>

          <p className="mt-3 text-sm text-obligon-text">Company access and commercial terms require an agreed contract.</p>

          {result.data?.plan ? <>
            <p className="mt-4 text-lg font-bold">{result.data.plan.name}</p>
            <p className="mt-1">Recorded plan amount: {result.data.plan.priceLabel}</p>
            <p className="mt-1">Status: {result.data.plan.status}</p>
            {result.data.plan.nextBilling ? <p className="mt-1">Next billing: {result.data.plan.nextBilling}</p> : null}
          </> : <p className="mt-4 text-sm">No billing plan is recorded. Use Support to confirm your contract and billing terms.</p>}

        </article>

        <article className="rounded-xl border border-[#dfe5ec] bg-white p-5">

          <h2 className="text-xl font-extrabold">Saved payment methods</h2>

          {result.data?.paymentMethods.length ? <ul className="mt-3 space-y-3">

            {result.data.paymentMethods.map(method => <li key={method.id}>{method.display}{method.isDefault ? " · Default" : ""}</li>)}

          </ul> : <p className="mt-3 text-sm text-obligon-text">No saved payment methods.</p>}

          <p className="mt-5 text-sm">Signed in as {user?.name ?? "company member"}{user?.email ? ` (${user.email})` : ""}</p>

        </article>

      </section>

      <Table title="Invoice history" columns={["Date", "Invoice", "Amount"]} rows={result.data?.invoices ?? []} empty="No invoices have been issued." />

    </DataBoundary>

  </Canvas>;
}
function Team({ onModal }: PageProps) {
  const [query, setQuery] = React.useState("");
  const result = useAsync(companyApi.team);
  const rows = (result.data?.team ?? []).filter(row => row.cells.join(" ").toLowerCase().includes(query.toLowerCase()));
  return <Canvas>

    <Header pageKey="team" action={{ label: "Invite Team Member", modal: "teamMember" }} onModal={onModal} />

    <label className="mt-5 block max-w-lg">

      <span className="text-xs font-bold">Search team members</span>

      <input value={query} onChange={e => setQuery(e.target.value)} className={`${controlClass} mt-1 w-full`} />

    </label>

    <DataBoundary result={result}>

      <Table title="Team members" columns={["Name", "Email", "Role", "Last active"]} rows={rows} empty={query ? "No members match that search." : "No team members. Invite a member above."} />

    </DataBoundary>

  </Canvas>;
}
function Notifications({ onModal }: PageProps) {
  const result = useAsync(companyApi.notifications);
  const [saving, setSaving] = React.useState(false);
  const { success, error } = useToast();
  async function markAll() {
    setSaving(true);
    try {
      await mutationsApi.companyNotificationReadAll();
      result.reload();
      success("Notifications marked as read.");
    }
    catch (err) {
      error(err instanceof Error ? err.message : "Could not update notifications.");
    }
    finally {
      setSaving(false);
    }
  }
  return <Canvas>

    <Header pageKey="notifications" onModal={onModal} />

    <DataBoundary result={result}>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">

        <p className="text-sm">{result.data?.unreadCount ?? 0} unread notifications</p>

        <button type="button" disabled={saving || !result.data?.unreadCount} onClick={markAll} className={`${buttonClass} disabled:opacity-50`}>

          {saving ? "Updating…" : "Mark all as read"}

        </button>

      </div>

      <section className="mt-5 space-y-4">

        {result.data?.detailed.map(notification => <article key={notification.id} className={`rounded-xl border border-[#dfe5ec] bg-white p-5 ${notification.read ? "opacity-75" : ""}`}>

          <div className="flex flex-wrap items-start justify-between gap-3">

            <h2 className="text-lg font-extrabold">{notification.title}</h2>

            <span className="text-xs text-obligon-text">{notification.time} · {notification.read ? "Read" : "Unread"}</span>

          </div>

          <p className="mt-2 text-sm text-obligon-text">{notification.body}</p>

          {notification.link?.startsWith("/company") ? <Link href={notification.link} className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-obligon-green">{notification.actionRequired ? "View required action" : "View details"} →</Link> : null}

        </article>)}

      </section>

      {result.data?.detailed.length === 0 ? <EmptyState title="No notifications" message="You're all caught up." /> : null}

    </DataBoundary>

  </Canvas>;
}
function Support({ onModal }: PageProps) {
  const result = useAsync(companyApi.tickets);
  return <Canvas>

    <Header pageKey="support" action={{ label: "Raise Support Ticket", modal: "supportTicket" }} onModal={onModal} />

    <section className="mt-6 rounded-xl border border-[#dfe5ec] bg-white p-5">

      <h2 className="text-xl font-extrabold">Frequently asked questions</h2>

      {[["How do I add a fleet vehicle?", "Open Vehicles, choose Add Vehicle, and save its plate, model, fuel type and tank capacity."], ["How are company billing terms agreed?", "Company access requires a contract. Submit a billing support ticket to confirm your agreed terms."], ["When will roadside assistance arrive?", "Submit the vehicle, location and issue. The request status and arrival estimate appear after the dispatch team confirms them."]].map(([question, answer]) => <details key={question} className="border-b py-4">

        <summary className="cursor-pointer text-sm font-bold">{question}</summary>

        <p className="mt-3 text-sm leading-6 text-obligon-text">{answer}</p>

      </details>)}

    </section>

    <DataBoundary result={result}>

      <Table title="Support tickets" columns={["Reference", "Date", "Subject"]} rows={result.data?.tickets ?? []} empty="No support tickets. Raise a ticket above." />

    </DataBoundary>

  </Canvas>;
}
function SettingsPage({ onModal }: PageProps) {
  const result = useAsync(companyApi.settings);
  const { user, refresh } = useSession();
  const { success, error } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", address: "", rcNumber: "", city: "", website: "", description: "" });
  React.useEffect(() => {
    if (result.data?.org) {
      const org = result.data.org;
      setForm({ name: org.name, address: org.address ?? "", rcNumber: org.rcNumber ?? "", city: org.city ?? "", website: org.website ?? "", description: org.description ?? "" });
    }
  }, [result.data]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await mutationsApi.updateOrgSettings(form);
      result.reload();
      await refresh();
      success("Company profile saved.");
    }
    catch (err) {
      error(err instanceof Error ? err.message : "Could not save your company profile.");
    }
    finally {
      setSaving(false);
    }
  }
  return <Canvas>

    <Header pageKey="settings" onModal={onModal} />

    <DataBoundary result={result}>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_320px]">

        <article className="rounded-xl border border-[#dfe5ec] bg-white p-5">

          <h2 className="text-xl font-extrabold">Company profile</h2>

          <form className="mt-5 space-y-4" onSubmit={save}>

            {([["Company name", "name"], ["Registered address", "address"], ["Registration number", "rcNumber"], ["City", "city"], ["Website", "website"], ["Description", "description"]] as const).map(([label, key]) => <label key={key} className="block text-xs font-bold">

              {label}

              <input required={key === "name"} value={form[key]} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))} className={`${controlClass} mt-1 w-full`} />

            </label>)}

            <button type="submit" disabled={saving} className={`${buttonClass} disabled:opacity-50`}>

              {saving ? <Loader2 size={16} className="animate-spin" /> : null}

              {saving ? "Saving…" : "Save Changes"}

            </button>

          </form>

        </article>

        <article className="rounded-xl border border-[#dfe5ec] bg-white p-5">

          <h2 className="text-xl font-extrabold">Account status</h2>

          <p className="mt-4 text-sm">Organization verification: {result.data?.org.verificationStatus ?? "Unavailable"}</p>

          <p className="mt-3 text-sm">Two-factor authentication: {user?.twoFactorEnabled ? "Enabled on your account" : "Not enabled on your account"}</p>

          <p className="mt-3 text-sm text-obligon-text">Spend limits are configured on individual fuel cards. View Cards to check recorded limits.</p>

          <Link href="/company/cards" className="mt-4 inline-flex min-h-11 items-center font-bold text-obligon-green">View fuel cards →</Link>

        </article>

      </section>

    </DataBoundary>

  </Canvas>;
}
function Maintenance({ onModal }: PageProps) {
  const result = useAsync(companyApi.maintenance);
  return <Canvas>

    <Header pageKey="maintenance" action={{ label: "Schedule Service", modal: "service" }} onModal={onModal} />

    <DataBoundary result={result}>

      <Metrics metrics={[{ label: "Fleet vehicles", value: String(result.data?.fleetHealth.total ?? 0) }, { label: "Active vehicles", value: result.data?.fleetHealth.total ? `${result.data.fleetHealth.healthyPct}%` : "No vehicles", helper: "Based on recorded vehicle status" }, { label: "In maintenance", value: String(result.data?.fleetHealth.inService ?? 0) }]} />

      <Table title="Service schedules" columns={["Date", "Vehicle", "Service", "Cost"]} rows={result.data?.schedules ?? []} empty="No schedules. Schedule a service above." actionLabel="Export" onAction={() => onModal("export", { scope: "maintenance" })} />

    </DataBoundary>

  </Canvas>;
}
const pages: Record<CompanyPageKey, React.ComponentType<PageProps>> = { overview: Overview, vehicles: Vehicles, cards: Cards, transactions: Transactions, reports: Reports, stations: Stations, roadside: Roadside, billing: Billing, team: Team, notifications: Notifications, support: Support, settings: SettingsPage, maintenance: Maintenance };
export function CompanyScreen({ pageKey }: {
  pageKey: CompanyPageKey;
}) {
  const [modal, setModal] = React.useState<CompanyModalKey>(null);
  const [context, setContext] = React.useState<CompanyModalContext>({});
  const [revision, setRevision] = React.useState(0);
  const Page = pages[pageKey];
  const open: OpenModal = (next, nextContext = {}) => { setContext(nextContext); setModal(next); };
  return <>
    <Page key={`${pageKey}-${revision}`} onModal={open} />
    {modal ? <CompanyModals key={modal} modal={modal} context={context} onClose={() => setModal(null)} onSaved={() => setRevision(current => current + 1)} /> : null}
  </>;
}
