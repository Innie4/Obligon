"use client";
import { sellingUnitLabel } from "../../../../packages/shared/partner-access.mjs";
import * as React from "react";
import Link from "next/link";
import { Download, Loader2, Plus, Search } from "lucide-react";
import { pageCopy, type CompanyPageKey, type CompanyTone, type Metric } from "@/lib/mock/company-data";
import { CompanyModals, companyTopupStorageKey, type CompanyModalContext, type CompanyOperationModalKey } from "./CompanyModals";
import { companyApi, type CompanyRow } from "@/lib/services/company";
import { mutationsApi } from "@/lib/services";
import { useAsync, type AsyncResult } from "@/components/shared/useAsync";
import { AsyncBoundary, EmptyState } from "@/components/shared/States";
import { useToast } from "@/components/shared/Toast";
import { useSession } from "@/components/shared/AuthContext";
import { DateField } from "@/components/shared/Calendar/DateField";
import { DashboardSearchQuery } from "@/components/shared/DashboardSearchQuery";
type OpenModal = (modal: CompanyOperationModalKey, context?: CompanyModalContext) => void;
type PageProps = {
  onModal: OpenModal;
};
const tone: Record<CompanyTone, string> = { green: "bg-[#e8fbd7] text-obligon-green", red: "bg-[#ffe8e8] text-[#c1121f]", amber: "bg-[#fff3d8] text-[#9a6300]", blue: "bg-[#e8efff] text-obligon-blue", dark: "bg-[#07162f] text-white", muted: "bg-[#edf1f5] text-obligon-text" };
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-obligon-green px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-obligon-green/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green";
const controlClass = "min-h-11 min-w-0 rounded-xl border border-obligon-border bg-white px-3 text-sm text-obligon-navy transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green";
function Canvas({ children }: {
  children: React.ReactNode;
}) { return <section className="mx-auto w-full min-w-0 max-w-[1600px] break-words px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</section>; }
function Header({ pageKey, action, onModal }: {
  pageKey: CompanyPageKey;
  action?: {
    label: string;
    modal: CompanyOperationModalKey;
    context?: CompanyModalContext;
  };
  onModal: OpenModal;
}) {
  const page = pageCopy[pageKey];
  const { user } = useSession();
  return <div className="flex flex-col gap-4 border-b border-obligon-border pb-6 lg:flex-row lg:items-end lg:justify-between">

    <div>

      <p className="text-xs font-semibold tracking-wide text-obligon-green">Company workspace</p>

      <h1 className="mt-2 break-words font-display text-2xl font-bold tracking-tight text-obligon-navy sm:text-3xl">{pageKey === "overview" ? user?.organization || "Company dashboard" : page.title}</h1>

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
  return <dl aria-label="Company metrics" className={`mt-6 grid grid-cols-2 gap-3 sm:gap-4 ${metrics.length > 3 ? "sm:grid-cols-4" : metrics.length === 3 ? "sm:grid-cols-3" : ""}`}>

    {metrics.map((metric, index) => <div key={metric.label} className={`min-w-0 rounded-xl border border-obligon-border bg-white p-3 sm:p-4 xl:p-5 ${metrics.length === 3 && index === 2 ? "col-span-2 sm:col-span-1" : ""}`}>

      <dt className="text-xs font-medium leading-5 text-obligon-text sm:text-sm">{metric.label}</dt>

      <dd className="mt-1 break-words text-2xl font-bold tracking-tight text-obligon-navy tabular-nums sm:mt-2 xl:text-3xl">{metric.value.split(/(\s+(?:standard m³|kg|L)(?=\s|$|·))/).map((part, partIndex) => partIndex % 2 ? <span key={partIndex} className="whitespace-nowrap text-sm font-medium tracking-normal text-obligon-text sm:text-base">{part}</span> : part)}</dd>

      {metric.helper ? <dd className="mt-1 text-xs leading-5 text-obligon-text">{metric.helper}</dd> : null}

    </div>)}

  </dl>;
}
function Table({ title, columns, rows, empty = "No records yet.", actionLabel, onAction, onRowAction, rowActionLabel = "Manage" }: {
  title: string;
  columns: string[];
  rows: CompanyRow[];
  empty?: string;
  actionLabel?: string;
  onAction?: () => void;
  onRowAction?: (row: CompanyRow) => void;
  rowActionLabel?: string;
}) {
  const hasStatus = rows.some(row => row.status);
  return <section className="mt-6 min-w-0 overflow-hidden rounded-xl border border-obligon-border bg-white">

    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe5ec] p-5">

      <h2 className="font-display text-lg font-bold text-obligon-navy">{title}</h2>

      {onAction && actionLabel ? <button type="button" onClick={onAction} className="min-h-11 rounded-lg px-3 text-sm font-bold text-obligon-green hover:underline">

        {actionLabel}

      </button> : null}

    </div>

    {rows.length ? <>
      <ul aria-label={`${title} records`} className="divide-y divide-obligon-border md:hidden">
        {rows.map((row, index) => <li key={row.id ?? `${row.cells[0]}-${index}`} className="p-4 sm:p-5">
          <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4">
            {row.cells.map((cell, cellIndex) => <div key={cellIndex} className={cellIndex === 0 ? "col-span-2 min-w-0" : "min-w-0"}>
              <dt className="text-xs font-medium text-obligon-text">{columns[cellIndex]}</dt>
              <dd className={`mt-1 whitespace-pre-line break-words text-sm text-obligon-navy ${cellIndex === 0 ? "font-bold" : "font-medium"}`}>{cell}</dd>
            </div>)}
            {row.status ? <div className="col-span-2"><dt className="sr-only">Status</dt><dd><Status status={row.status} statusTone={row.tone} /></dd></div> : null}
          </dl>
          {onRowAction ? <button type="button" onClick={() => onRowAction(row)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-obligon-border px-4 text-sm font-bold text-obligon-green hover:bg-obligon-mist">{rowActionLabel}<span className="sr-only"> {row.cells[0]}</span></button> : null}
        </li>)}
      </ul>
      <p className="hidden border-b border-obligon-border bg-obligon-mist/50 px-5 py-3 text-xs leading-5 text-obligon-text md:block">Scroll horizontally when needed to view all columns and actions.</p>
      <div tabIndex={0} role="region" aria-label={`${title} table`} className="hidden overflow-x-auto md:block">

      <table className="w-full text-left text-sm">
        <caption className="sr-only">{title}</caption>

        <thead className="bg-[#f2f6fa] text-xs text-[#566171]">

          <tr>

            {columns.map(column => <th key={column} scope="col" className="whitespace-nowrap px-5 py-4 font-semibold">{column}</th>)}

            {hasStatus ? <th scope="col" className="px-5 py-4 font-semibold">Status</th> : null}

            {onRowAction ? <th scope="col" className="px-5 py-4 font-semibold">Action</th> : null}

          </tr>

        </thead>

        <tbody className="divide-y divide-[#eef2f6]">

          {rows.map((row, index) => <tr key={row.id ?? `${row.cells[0]}-${index}`} className="transition-colors hover:bg-obligon-mist/50">

            {row.cells.map((cell, cellIndex) => <td key={cellIndex} className="min-w-[120px] max-w-sm break-words px-5 py-4 align-top">

              {cell.split("\n").map((part, partIndex) => <p key={partIndex} className={partIndex ? "mt-1 text-xs text-obligon-text" : "font-semibold text-obligon-navy"}>{part}</p>)}

            </td>)}

            {hasStatus ? <td className="px-5 py-4">{row.status ? <Status status={row.status} statusTone={row.tone} /> : null}</td> : null}

            {onRowAction ? <td className="px-5 py-4">

              <button type="button" onClick={() => onRowAction(row)} className="relative min-h-11 rounded-lg px-3 font-bold text-obligon-green">{rowActionLabel}<span className="sr-only"> {row.cells[0]}</span></button>

            </td> : null}

          </tr>)}

        </tbody>

      </table>

      </div>
    </> : <div className="px-4"><EmptyState title={empty} /></div>}

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
const pageSize = 20;
function CompanyPagination({ page, total, count, onPageChange }: { page: number; total: number; count: number; onPageChange: (page: number) => void }) {
  return <nav aria-label="Record pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
    <p role="status" className="text-sm text-obligon-text">{count ? `${page * pageSize + 1}–${page * pageSize + count}` : "0"} of {total} records · Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))}</p>
    <div className="flex gap-2"><button type="button" className={`${controlClass} disabled:cursor-not-allowed disabled:bg-obligon-panel disabled:text-obligon-text/50`} disabled={page === 0} onClick={() => onPageChange(page - 1)}>Previous</button><button type="button" className={`${controlClass} disabled:cursor-not-allowed disabled:bg-obligon-panel disabled:text-obligon-text/50`} disabled={(page + 1) * pageSize >= total} onClick={() => onPageChange(page + 1)}>Next</button></div>
  </nav>;
}
function Vehicles({ onModal }: PageProps) {
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const result = useAsync(() => companyApi.vehicles(new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize), search }).toString()), [page, search]);
  return <Canvas>
    <DashboardSearchQuery onSearch={value => { setSearch(value); setPage(0); }} />

    <Header pageKey="vehicles" action={{ label: "Add Vehicle", modal: "vehicle" }} onModal={onModal} />

    <div className="mt-5 flex flex-wrap gap-3">

      <button type="button" onClick={() => onModal("driver")} className={controlClass}>Add Driver</button>

      <button type="button" onClick={() => onModal("assign")} className={controlClass}>Assign Card</button>

      <button type="button" onClick={() => onModal("export", { scope: "vehicles" })} className={controlClass}>Export Fleet</button>

    </div>
    <label className="mt-4 block max-w-lg text-sm font-bold">Search fleet vehicles<input type="search" maxLength={254} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className={`${controlClass} mt-1 w-full`} /></label>

    <DataBoundary result={result}>

      <Table title="Fleet vehicles" columns={["Vehicle", "Plate", "Assigned card"]} rows={result.data?.vehicles ?? []} empty="No vehicles. Add your first vehicle above." rowActionLabel="Edit vehicle" onRowAction={row => onModal("vehicle", { editVehicle: result.data?.vehicles.find(vehicle => vehicle.id === row.id) })} />
      <CompanyPagination page={page} total={result.data?.total ?? 0} count={result.data?.vehicles.length ?? 0} onPageChange={setPage} />

    </DataBoundary>

  </Canvas>;
}
function Cards({ onModal }: PageProps) {
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const result = useAsync(() => companyApi.cards(new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize), search }).toString()), [page, search]);
  const cards = (result.data?.cards ?? []).map(row => {
    const [driver, vehicle] = (row.cells[2] ?? "").split("\n");
    return { ...row, cells: row.cells.map((cell, index) => index === 0 ? cell.split("\n")[0] : index === 2 ? `Driver: ${driver || "Not recorded"}\nVehicle: ${vehicle === "Pool Card" ? "Unassigned" : vehicle || "Not recorded"}` : cell) };
  });
  return <Canvas>
    <DashboardSearchQuery onSearch={value => { setSearch(value); setPage(0); }} />

    <Header pageKey="cards" action={{ label: "Issue New Card", modal: "newCard" }} onModal={onModal} />

    <div className="mt-5 flex flex-wrap gap-3">

      <button type="button" onClick={() => onModal("assign")} className={controlClass}>Assign Card</button>

      <button type="button" onClick={() => onModal("cardConfirm")} className={controlClass}>Freeze / Unfreeze Card</button>
      <button type="button" onClick={() => onModal("posCode")} className={controlClass}>Get single-use fuel code</button>

    </div>
    <label className="mt-4 block max-w-lg text-sm font-bold">Search fuel cards<input type="search" maxLength={254} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className={`${controlClass} mt-1 w-full`} /></label>

    <DataBoundary result={result}>

      <Metrics metrics={result.data?.metrics ?? []} />

      <Table title="All cards" columns={["Card", "Number", "Driver / vehicle", "Remaining monthly limit"]} rows={cards} empty="No cards. Issue your first card above." onRowAction={row => onModal("cardConfirm", { cardId: row.cardId ?? row.id })} />
      <CompanyPagination page={page} total={result.data?.total ?? 0} count={result.data?.cards.length ?? 0} onPageChange={setPage} />

    </DataBoundary>

  </Canvas>;
}
function Transactions({ onModal }: PageProps) {
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [vehicle, setVehicle] = React.useState("");
  const [driver, setDriver] = React.useState("");
  const [range, setRange] = React.useState("30");
  const [date, setDate] = React.useState("");
  const choices = useAsync(companyApi.choices);
  const driverFilterReady = choices.data?.capabilities?.stableDriverFilters === true;
  const effectiveDriverId = driverFilterReady ? driver : "";
  const query = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
  if (range) query.set("range", range);
  if (search) query.set("search", search);
  if (vehicle)
    query.set("vehicle", vehicle);
  if (effectiveDriverId)
    query.set("driverId", effectiveDriverId);
  if (date)
    query.set("date", date);
  const result = useAsync(() => companyApi.transactions(query.toString()), [search, vehicle, effectiveDriverId, range, date, page]);
  const context = { scope: "transactions", range, vehicle, driverId: effectiveDriverId, date };
  return <Canvas>
    <DashboardSearchQuery onSearch={value => {
      setSearch(value); setPage(0);
      if (value) { setVehicle(""); setDriver(""); setDate(""); setRange(""); }
    }} />

    <Header pageKey="transactions" action={{ label: "Export CSV", modal: "export", context }} onModal={onModal} />

    <label className="mt-4 block max-w-lg text-sm font-bold">Search transactions<input type="search" value={search} maxLength={254} onChange={e => { setSearch(e.target.value); setPage(0); }} className={`${controlClass} mt-1 w-full`} placeholder="Reference, station, vehicle or driver" /></label>

    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

      <label className="text-xs font-bold">Vehicle<select className={`${controlClass} mt-1 w-full`} value={vehicle} onChange={e => { setVehicle(e.target.value); setPage(0); }}>

        <option value="">All vehicles</option>

        {choices.data?.vehicles.map(v => <option key={v.id} value={v.plate}>{v.plate}</option>)}

      </select></label>

      <label className="text-xs font-bold">Driver<select className={`${controlClass} mt-1 w-full`} value={driver} disabled={!driverFilterReady} onChange={e => { setDriver(e.target.value); setPage(0); }}>

        <option value="">All drivers</option>

        {choices.data?.drivers.map(d => <option key={d.id} value={d.id}>{d.name} · {d.phone || d.licenseNo || `Driver ${d.id.slice(-8)}`}</option>)}

      </select></label>

      <label className="text-xs font-bold">Period<select className={`${controlClass} mt-1 w-full`} value={range} onChange={e => { setRange(e.target.value); setDate(""); setPage(0); }}>

        <option value="">All time</option>

        {[7, 30, 90, 365].map(days => <option key={days} value={days}>Last {days} days</option>)}

      </select></label>

      <DateField label="Specific date" value={date} onChange={next => { setDate(next); setPage(0); }} />

    </div>

    {choices.error ? <p role="alert" className="mt-3 text-sm text-red-700">Fleet filter choices could not load. <button className="underline" onClick={choices.reload}>Retry</button></p> : null}

    {!driverFilterReady && choices.status === "success" ? <p className="mt-3 text-sm text-obligon-text">Driver filtering is currently unavailable. Refresh this page to try again.</p> : null}
    <DataBoundary result={result}>

      <Table title="Transactions" columns={["Date & time", "Vehicle / driver", "Station / fuel", "Card", "Amount"]} rows={result.data?.transactions ?? []} empty="No transactions match these filters." />

      <CompanyPagination page={page} total={result.data?.total ?? 0} count={result.data?.transactions.length ?? 0} onPageChange={setPage} />
      <p className="mt-3 text-xs text-obligon-text">Text search filters this table. CSV export uses its selected period and fleet filters.</p>

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

      <Table title="Spend by vehicle and fuel" columns={["Report date", "Vehicle", "Fuel / quantity", "Spend"]} rows={result.data?.spend ?? []} empty="No recorded spend in this period." />

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
    <DashboardSearchQuery onSearch={setSearch} />

    <Header pageKey="stations" onModal={onModal} />

    <label className="mt-5 flex min-h-11 max-w-lg items-center gap-2 rounded-xl border border-[#dfe5ec] bg-white px-3">

      <Search size={18} />

      <input className="min-w-0 flex-1 bg-transparent py-3 text-sm" maxLength={254} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search station, address or city" aria-label="Search stations" />

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

                <dd className="font-bold">{price.priceLabel} / {sellingUnitLabel(price.sellingUnit)}</dd>

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
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const cancelling = React.useRef(false);
  async function cancel(id: string) {
    if (cancelling.current) return;
    cancelling.current = true; setBusyId(id); setError(null);
    try { await mutationsApi.cancelRoadsideRequest(id); result.reload(); } catch (err) { setError(err instanceof Error ? err.message : "Could not cancel this request."); } finally { cancelling.current = false; setBusyId(null); }
  }
  return <Canvas>

    <Header pageKey="roadside" action={{ label: "Request Emergency Help", modal: "roadside" }} onModal={onModal} />
    <p className="mt-5 text-sm text-obligon-text">Requests record your location and issue. Assistance requires manual coordination; this screen does not confirm a dispatched provider or arrival time. Open Support and include the request ID for follow-up.</p>
    <Link href="/company/support" className="mt-2 inline-flex min-h-11 items-center font-bold text-obligon-green">Follow up with Support →</Link>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}

    <DataBoundary result={result}>

      {result.data?.active.map(request => <article key={request.id} className="mt-5 rounded-xl border border-[#dfe5ec] bg-white p-5">

        <Status status={request.status} statusTone="amber" />

        <h2 className="mt-3 text-xl font-extrabold">{request.vehicle} · {request.issue}</h2>

        <p className="mt-2 text-sm">{request.location}</p>

        <p className="mt-2 text-sm text-obligon-text">Received: {request.time}{request.etaMinutes == null ? " · Arrival estimate pending" : ` · Estimated arrival: ${request.etaMinutes} minutes`}</p>
        <p className="mt-2 break-all text-xs text-obligon-text">Request ID: {request.id}</p>
        {["RECEIVED", "DISPATCHING"].includes(request.status) ? <button type="button" disabled={Boolean(busyId)} onClick={() => cancel(request.id)} className={`${controlClass} mt-4 disabled:opacity-50`}>{busyId === request.id ? "Cancelling…" : "Cancel request"}</button> : null}

      </article>)}

      <Table title="Assistance history" columns={["Date", "Vehicle", "Issue"]} rows={result.data?.requests ?? []} empty="No assistance requests. Request help above when needed." />

    </DataBoundary>

  </Canvas>;
}
function CompanyWalletPanel({ onModal }: PageProps) {
  const result = useAsync(companyApi.wallet);
  const { user } = useSession();
  const [reference, setReference] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmed, setConfirmed] = React.useState<string | null>(null);
  const checking = React.useRef(false);
  React.useEffect(() => {
    if (!user) return;
    const query = new URLSearchParams(window.location.search);
    const returned = query.get("topup") || query.get("tx_ref") || query.get("reference");
    try { const stored = sessionStorage.getItem(companyTopupStorageKey(user.id)); setReference(returned || stored || ""); } catch { if (returned) setReference(returned); }
  }, [user]);
  async function confirm() {
    if (!reference.trim() || checking.current || !user) return;
    checking.current = true; setBusy(true); setError(null); setConfirmed(null);
    try {
      const query = new URLSearchParams(window.location.search);
      const response = await mutationsApi.companyConfirmTopUp(reference.trim(), query.get("transaction_id") ?? undefined);
      if (!response.ok) throw new Error("Payment has not been confirmed. Check again after completing checkout.");
      setConfirmed(`Company wallet funding confirmed${response.balanceLabel ? `. Balance: ${response.balanceLabel}` : "."}`);
      try { sessionStorage.removeItem(companyTopupStorageKey(user.id)); } catch { /* Server confirmation remains authoritative. */ }
      for (const key of ["topup", "tx_ref", "reference", "transaction_id", "status"]) query.delete(key);
      window.history.replaceState({}, "", `${window.location.pathname}${query.toString() ? `?${query}` : ""}`);
      setReference(""); result.reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Payment is unconfirmed. Keep this reference and try again."); } finally { checking.current = false; setBusy(false); }
  }
  return <section className="mt-6 rounded-xl border border-[#dfe5ec] bg-white p-5">
    <h2 className="text-xl font-extrabold">Company fuel wallet</h2>
    <p className="mt-3 text-sm text-obligon-text">Fleet cards spend directly from the company wallet. Member allocations transfer funds to personal wallets.</p>
    <DataBoundary result={result}>
      <p className="mt-4 text-3xl font-extrabold">{result.data?.company?.balanceLabel ?? "Balance unavailable"}</p>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={buttonClass} onClick={() => onModal("walletFund")}>Fund company wallet</button><button type="button" className={controlClass} onClick={() => onModal("walletAllocate")}>Allocate to member</button></div>
      {result.data?.recent?.length ? <ul className="mt-5 divide-y divide-[#dfe5ec]">{result.data.recent.map(entry => <li key={entry.id} className="py-3 text-sm"><p className="font-bold">{entry.direction === "credit" ? "+" : "−"}{entry.amountLabel} · {entry.description}</p><p className="mt-1 break-all text-xs text-obligon-text">{entry.reference} · {entry.date}</p></li>)}</ul> : <p className="mt-4 text-sm text-obligon-text">No recorded company wallet movements.</p>}
    </DataBoundary>
    <div className="mt-5 border-t border-[#dfe5ec] pt-4"><label className="block text-sm font-bold">Check a pending funding reference<input value={reference} disabled={busy} onChange={event => { setReference(event.target.value); setConfirmed(null); }} className={`${controlClass} mt-1 w-full`} /></label><button type="button" className={`${controlClass} mt-3 disabled:opacity-50`} disabled={busy || !reference.trim()} onClick={confirm}>{busy ? "Checking payment…" : "Check payment"}</button></div>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}{confirmed ? <p role="status" className="mt-3 text-sm">{confirmed}</p> : null}
  </section>;
}
function Billing({ onModal }: PageProps) {
  const result = useAsync(companyApi.billing);
  const { user } = useSession();
  return <Canvas>

    <Header pageKey="billing" action={{ label: "Export Invoices", modal: "export", context: { scope: "invoices" } }} onModal={onModal} />
    <CompanyWalletPanel onModal={onModal} />

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
  const rows = (result.data?.team ?? []).filter(row => row.cells.join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  return <Canvas>
    <DashboardSearchQuery onSearch={setQuery} />

    <Header pageKey="team" action={{ label: "Invite Team Member", modal: "teamMember" }} onModal={onModal} />

    <label className="mt-5 block max-w-lg">

      <span className="text-xs font-bold">Search team members</span>

      <input type="search" maxLength={254} value={query} onChange={e => setQuery(e.target.value)} className={`${controlClass} mt-1 w-full`} />

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

        {result.data?.detailed.map(notification => <article key={notification.id} className={`rounded-xl border border-obligon-border bg-white p-5 ${notification.read ? "" : "border-l-4 border-l-obligon-green"}`}>

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

      {[["How do I add a fleet vehicle?", "Open Vehicles, choose Add Vehicle, and save its plate, model, fuel type and tank capacity."], ["How are company billing terms agreed?", "Company access requires a contract. Submit a billing support ticket to confirm your agreed terms."], ["When will roadside assistance arrive?", "Requests require manual coordination. Include your request ID in a support conversation to confirm arrangements; submitting a request does not confirm dispatch or arrival."]].map(([question, answer]) => <details key={question} className="border-b py-4">

        <summary className="cursor-pointer text-sm font-bold">{question}</summary>

        <p className="mt-3 text-sm leading-6 text-obligon-text">{answer}</p>

      </details>)}

    </section>

    <DataBoundary result={result}>

      <Table title="Support tickets" columns={["Reference", "Date", "Subject"]} rows={result.data?.tickets ?? []} empty="No support tickets. Raise a ticket above." rowActionLabel="Open conversation" onRowAction={row => onModal("supportConversation", { ticketId: row.id, reference: row.reference ?? row.cells[0] })} />

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

      <section className="mt-6 grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">

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
    <p className="mt-5 text-sm text-obligon-text">Schedules are company records. Confirm the appointment with your service provider directly, then update the confirmed status here. Use Support with the schedule ID if you need help coordinating.</p>
    <Link href="/company/support" className="mt-2 inline-flex min-h-11 items-center font-bold text-obligon-green">Follow up with Support →</Link>

    <DataBoundary result={result}>

      <Metrics metrics={[{ label: "Fleet vehicles", value: String(result.data?.fleetHealth.total ?? 0) }, { label: "Active vehicles", value: result.data?.fleetHealth.total ? `${result.data.fleetHealth.healthyPct}%` : "No vehicles", helper: "Based on recorded vehicle status" }, { label: "In maintenance", value: String(result.data?.fleetHealth.inService ?? 0) }]} />

      <Table title="Service schedules" columns={["Date", "Vehicle", "Service", "Cost"]} rows={(result.data?.schedules ?? []).map(row => ({ ...row, cells: row.cells.map((cell, index) => index === 2 ? `${cell}\nSchedule ID: ${row.id}` : cell) }))} empty="No schedules. Schedule a service above." actionLabel="Export" onAction={() => onModal("export", { scope: "maintenance" })} rowActionLabel="Update status" onRowAction={row => onModal("maintenanceStatus", { maintenanceId: row.id, status: row.statusRaw })} />

    </DataBoundary>

  </Canvas>;
}
const pages: Record<CompanyPageKey, React.ComponentType<PageProps>> = { overview: Overview, vehicles: Vehicles, cards: Cards, transactions: Transactions, reports: Reports, stations: Stations, roadside: Roadside, billing: Billing, team: Team, notifications: Notifications, support: Support, settings: SettingsPage, maintenance: Maintenance };
export function CompanyScreen({ pageKey }: {
  pageKey: CompanyPageKey;
}) {
  const [modal, setModal] = React.useState<CompanyOperationModalKey>(null);
  const [context, setContext] = React.useState<CompanyModalContext>({});
  const [revision, setRevision] = React.useState(0);
  const Page = pages[pageKey];
  const open: OpenModal = (next, nextContext = {}) => { setContext(nextContext); setModal(next); };
  return <>
    <Page key={`${pageKey}-${revision}`} onModal={open} />
    {modal ? <CompanyModals key={modal} modal={modal} context={context} onClose={() => setModal(null)} onSaved={() => setRevision(current => current + 1)} /> : null}
  </>;
}
