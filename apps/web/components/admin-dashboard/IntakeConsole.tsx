"use client";
import { StatusPopup } from "@/components/shared/StatusPopup";
import * as React from "react";
import { AdminDialog } from "./AdminDialog";
import Link from "next/link";
import { authenticatedRequest } from "@/lib/services";
import { partnerFuelCode, fuelSellingUnits, sellingUnitLabel, type SellingUnit } from "../../../../packages/shared/partner-access.mjs";
type RecordRow = {
  id: string;
  name?: string;
  fuels?: string[];
  sellingUnits?: Record<string, SellingUnit>;
  approvedSellingUnits?: Record<string, SellingUnit>;
  title?: string;
  contact_name?: string;
  email?: string;
  company_name?: string;
  organization?: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  location_confirmed?: boolean;
  verification_status?: string;
  subject?: string;
  status?: string;
  type?: string;
  message?: string;
  cover_note?: string;
  description?: string;
  review_note?: string;
  resume_path?: string;
  action?: string;
  actor_role?: string;
  request_type?: string;
  notes?: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  to_email?: string;
  attempts?: number;
  amount_kobo?: number;
  reference?: string;
  kind?: string;
  last_error?: string;
};
type Queue =
  | "stations"
  | "applications"
  | "leads"
  | "privacy"
  | "jobs"
  | "email"
  | "activity"
  | "financial";
const tabs: Queue[] = [
  "stations",
  "applications",
  "leads",
  "privacy",
  "jobs",
  "email",
  "activity",
  "financial",
];
const titles: Record<Queue, string> = {
  stations: "Station publication",
  applications: "Job applications",
  leads: "Sales and enquiries",
  privacy: "Privacy requests",
  jobs: "Job postings",
  email: "Email delivery",
  activity: "Business activity",
  financial: "Money movements",
};
const paths: Record<Queue, string> = {
  stations: "/stations/review",
  applications: "/intake/applications",
  leads: "/intake/leads",
  privacy: "/intake/privacy",
  jobs: "/jobs",
  email: "/email-delivery",
  activity: "/activity",
  financial: "/financial-activity",
};
function recordSource(queue: Queue, row: RecordRow) {
  if (queue === "stations") return "Partner";
  if (["leads", "privacy", "applications"].includes(queue)) return "Public enquiry";
  if (queue === "jobs") return "Obligon";
  if (queue === "activity") {
    if (row.actor_role === "customer") return "Customer";
    if (row.actor_role === "company") return "Company";
    if (row.actor_role === "partner" || row.actor_role === "mechanic") return "Partner";
    if (row.actor_role === "admin") return "Administrator";
    if (row.actor_role === "system") return "System";
  }
  return "Unknown";
}
export function IntakeConsole() {
  const [sellingUnits, setSellingUnits] = React.useState<Record<string, SellingUnit>>({});
  const [queue, setQueue] = React.useState<Queue>("stations"),
    [rows, setRows] = React.useState<RecordRow[]>([]),
    [statuses, setStatuses] = React.useState<string[]>([]),
    [selected, setSelected] = React.useState<RecordRow | null>(null),
    [note, setNote] = React.useState(""),
    [decision, setDecision] = React.useState(""),
    [verified, setVerified] = React.useState(false),
    [loading, setLoading] = React.useState(true),
    [loadFailed, setLoadFailed] = React.useState(false),
    [busy, setBusy] = React.useState(false),
    [resumeLoading, setResumeLoading] = React.useState(false),
    [error, setError] = React.useState(""),
    [success, setSuccess] = React.useState(""),
    [page, setPage] = React.useState(0),
    [total, setTotal] = React.useState(0),
    [search, setSearch] = React.useState(""),
    [published, setPublished] = React.useState(false);
  const loadSequence = React.useRef(0);
  const load = React.useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setLoadFailed(false);
    setError("");
    try {
      const result = await authenticatedRequest<{
        records?: RecordRow[];
        stations?: RecordRow[];
        jobs?: RecordRow[];
        messages?: RecordRow[];
        statuses?: string[];
        total?: number;
      }>(
        `/api/admin${paths[queue]}?page=${page}&search=${encodeURIComponent(search)}`,
      );
      if (sequence !== loadSequence.current) return;
      const records =
        result.records ??
        result.stations ??
        result.jobs ??
        result.messages ??
        [];
      setRows(records);
      setTotal(result.total ?? records.length);
      setStatuses(
        queue === "stations"
          ? ["active", "suspended"]
          : queue === "jobs"
            ? ["open", "closed"]
            : (result.statuses ?? []),
      );
    } catch (e) {
      if (sequence === loadSequence.current) { setError((e as Error).message); setLoadFailed(true); }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [queue, page, search]);
  const latestLoad = React.useRef(load);
  latestLoad.current = load;
  React.useEffect(() => {
    void load();
  }, [load]);
  async function mutate(path: string, body: unknown, method = "POST") {
    if (busy || resumeLoading) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await authenticatedRequest(`/api/admin${path}`, {
        method,
        body: JSON.stringify(body),
      });
      setSelected(null);
      setNote("");
      setPublished(false);
      await latestLoad.current();
      setSuccess(path === "/jobs" ? "Job posting published." : path === "/email-delivery/retry" ? "Due email messages processed. Check the updated delivery status." : "Review decision saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resume(row: RecordRow) {
    if (busy || resumeLoading) return;
    setResumeLoading(true);
    setError("");
    try {
      const result = await authenticatedRequest<{ url: string }>(
        `/api/admin/job-applications/${row.id}/resume`,
      );
      window.location.assign(result.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setResumeLoading(false);
    }
  }
  const feedback = <>
      {(busy) ? <StatusPopup tone="pending" message="Saving review…" /> : null}
      {resumeLoading ? <StatusPopup tone="loading" message="Opening protected resume…" /> : null}
      {success ? <StatusPopup tone="success" message={success} /> : null}
      {loading ? <StatusPopup tone="loading" message="Loading records…" /> : null}
      {error ? <StatusPopup tone="error" message={error} onRetry={loadFailed ? load : undefined} /> : null}
  </>;
  return (
    <section className="admin-page mx-auto w-full min-w-0 max-w-[1600px] px-4 py-6 text-sm sm:px-6 sm:py-8 lg:px-8">
      {!selected && !published ? feedback : null}
      <p className="text-sm font-semibold text-obligon-green">
        Obligon operations
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Requests and activity</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-obligon-text">
        Review station publication, public enquiries and business activity. Support requests are grouped by customer, partner and company in the support inbox.
      </p>
      <Link href="/admin/operations" className="mt-5 flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-2xl border border-obligon-border bg-white px-5 py-4 text-obligon-navy hover:border-obligon-green"><span><span className="block font-semibold">Account support requests</span><span className="mt-1 block text-sm text-obligon-text">Review customer, partner and company conversations in separate queues.</span></span><span className="text-sm font-semibold">Open support inbox <span aria-hidden="true">↗</span></span></Link>
      <label htmlFor="admin-review-queue" className="my-5 block text-sm font-semibold text-obligon-navy md:hidden">Review queue
        <select id="admin-review-queue" disabled={busy || resumeLoading} value={queue} className="mt-2 min-h-12 w-full rounded-xl border border-obligon-border bg-white px-3 font-normal" onChange={event => {
          if (busy || resumeLoading) return;
          setError(""); setSuccess("");
          setQueue(event.target.value as Queue);
          setSelected(null);
          setPage(0);
          setSearch("");
        }}>
          {tabs.map(tab => <option key={tab} value={tab}>{titles[tab]}</option>)}
        </select>
      </label>
      <nav aria-label="Review queues" className="my-6 hidden flex-wrap gap-2 rounded-2xl border border-obligon-border bg-white p-3 md:flex">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab}
            aria-pressed={queue === tab}
            disabled={busy || resumeLoading}
            className={`min-h-11 rounded-lg border px-4 font-semibold ${queue === tab ? "border-obligon-green bg-obligon-green text-white" : "border-transparent bg-white text-obligon-text hover:bg-obligon-mist"}`}
            onClick={() => {
              if (busy || resumeLoading) return;
              setError(""); setSuccess("");
              setQueue(tab);
              setSelected(null);
              setPage(0);
              setSearch("");
            }}
          >
            {titles[tab]}
          </button>
        ))}
      </nav>
      <div className="admin-toolbar mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold text-obligon-navy">{titles[queue]}</h2><p className="mt-1 text-sm text-obligon-text">{total.toLocaleString()} {total === 1 ? "record" : "records"}{total > 50 ? ` · Page ${page + 1}` : ""}</p></div>
        <button
          type="button"
          className="min-h-12 rounded border bg-white px-4"
          disabled={busy || resumeLoading || loading}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      {queue === "activity" && (
        <label className="mb-5 block">
          Search action or record ID
          <input
            value={search}
            onChange={(e) => {
              setPage(0);
              setSearch(e.target.value);
            }}
            className="mt-2 block min-h-12 w-full rounded border p-3"
          />
        </label>
      )}
      {queue === "jobs" && (
        <button
          type="button"
          className="mb-4 min-h-12 rounded bg-obligon-green px-5 text-white"
          disabled={busy || resumeLoading} onClick={() => { if (busy || resumeLoading) return; setError(""); setSuccess(""); setPublished(true); }}
        >
          Publish a role
        </button>
      )}
      {queue === "email" && (
        <>
          <p className="mb-4">
            Accepted means the delivery provider accepted the message. Delivery
            to an inbox is not guaranteed. Failed messages retry with the same
            delivery key; review messages require provider statement checks.
          </p>
          <button
            disabled={busy}
            className="mb-4 min-h-12 rounded border px-5"
            onClick={() => void mutate("/email-delivery/retry", {})}
          >
            Retry due messages
          </button>
        </>
      )}
      {loading ? (
        <div className="min-h-28 rounded-2xl border border-obligon-border bg-white" aria-busy="true" />
      ) : loadFailed ? null : (
        <div className="min-w-0">
          <div className="admin-panel min-w-0 overflow-hidden rounded-2xl border border-obligon-border bg-white">
            {rows.map((row) => (
              <article key={row.id} className="border-b border-obligon-border p-5 last:border-0 sm:p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2"><span className="rounded-md border border-obligon-border bg-obligon-mist px-2.5 py-1 text-xs font-semibold text-obligon-navy">{recordSource(queue, row)}</span>{queue === "leads" && row.type ? <span className="text-xs capitalize text-obligon-text">{row.type === "partner" ? "Partner interest" : row.type === "onboarding" ? "Company onboarding" : row.type}</span> : null}</div>
                <div className="flex flex-wrap justify-between gap-3">
                <h3 className="min-w-0 break-words text-base font-semibold text-obligon-navy [overflow-wrap:anywhere]">
                    {row.title ??
                      row.name ??
                      row.contact_name ??
                      row.action ??
                      row.subject ??
                      row.reference ??
                      row.email ??
                      row.id}
                  </h3>
                <span className="max-w-full break-words rounded-full bg-obligon-mist px-3 py-1.5 text-xs font-semibold capitalize text-obligon-navy">
                    {row.status ?? row.type ?? row.entity_type}
                  </span>
                </div>
                <p className="mt-2 break-words text-sm text-slate-600">
                  {[
                    row.organization,
                    row.company_name,
                    row.address,
                    row.city,
                    row.email ?? row.to_email,
                    row.created_at
                      ? new Date(row.created_at).toLocaleString()
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {queue === "stations" && (
                  <p className="mt-2 text-sm">
                    Operator: {row.verification_status ?? "unverified"} ·
                    Coordinates: {row.lat ?? "missing"}, {row.lng ?? "missing"}{" "}
                    ·{" "}
                    {row.location_confirmed
                      ? "Location confirmed"
                      : "Location confirmation required"}
                  </p>
                )}
                {row.amount_kobo != null && (
                  <p className="mt-2 font-bold">
                    ₦{(Number(row.amount_kobo) / 100).toLocaleString()} ·{" "}
                    {row.kind}
                  </p>
                )}
                {row.subject && <p className="mt-2">{row.subject}</p>}
                {row.last_error && (
                  <p className="mt-2 text-red-800">{row.last_error}</p>
                )}
                {queue === "email" && (
                  <p className="mt-2 text-sm">Attempts: {row.attempts}</p>
                )}
                {queue === "activity" ? <button type="button" className="mt-4 min-h-11 rounded-lg border border-obligon-border px-4 font-semibold" disabled={busy || resumeLoading} onClick={() => { if (busy || resumeLoading) return; setError(""); setSuccess(""); setSelected(row); }}>View activity</button> : queue !== "email" && queue !== "financial" ? <button type="button" className="mt-4 min-h-11 rounded-lg border border-obligon-border px-4 font-semibold" disabled={busy || resumeLoading} onClick={() => {
                  if (busy || resumeLoading) return; setError(""); setSuccess("");
                  setSelected(row);
                  setDecision(row.status ?? statuses[0] ?? "");
                  setSellingUnits(Object.fromEntries((row.fuels ?? []).flatMap(fuel => { const code = partnerFuelCode(fuel); const units = fuelSellingUnits(fuel); const unit = code ? row.sellingUnits?.[code] ?? (units.length === 1 ? units[0] : undefined) : undefined; return code && unit ? [[code, unit]] : []; })));
                  setNote(""); setVerified(false);
                }}>Review record <span aria-hidden="true" className="ml-2">↗</span></button> : null}
              </article>
            ))}
            {!rows.length && <div className="p-8 text-center"><h3 className="font-semibold text-obligon-navy">No records in this queue.</h3><p className="mt-2 text-obligon-text">New records will appear here when they are submitted.</p></div>}
          </div>
        </div>
      )}
      <AdminDialog open={Boolean(selected)} title={queue === "activity" ? "Business activity" : `Review ${selected?.name ?? selected?.contact_name ?? selected?.title ?? "record"}`} description={selected ? `${recordSource(queue, selected)} · ${selected.id}` : undefined} onClose={() => setSelected(null)} wide>
        {selected ? feedback : null}
          {selected && queue !== "activity" && (
            <form
              className="admin-form min-w-0"
              onSubmit={(e) => {
                e.preventDefault();
                void mutate(
                  queue === "stations"
                    ? `/stations/${selected.id}/review`
                    : queue === "jobs"
                      ? `/jobs/${selected.id}`
                      : `/intake/${queue}/${selected.id}`,
                  { status: decision, note, identityVerified: verified, ...(queue === "stations" ? { sellingUnits } : {}) },
                  queue === "stations" ? "POST" : "PATCH",
                );
              }}
            >
              <div className="mb-4"><span className="rounded-md border border-obligon-border bg-obligon-mist px-2.5 py-1 text-xs font-semibold">{recordSource(queue, selected)}</span></div>
              {(selected.message ?? selected.cover_note ?? selected.description ?? selected.notes ?? selected.review_note) ? (
              <p className="mt-4 whitespace-pre-wrap break-words">
                {selected.message ??
                  selected.cover_note ??
                  selected.description ??
                  selected.notes ??
                  selected.review_note}
              </p>
              ) : null}
              {selected.resume_path && (
                <button
                  type="button"
                  className="mt-4 min-h-12 rounded border px-4"
                  onClick={() => void resume(selected)}
                >
                  Open protected resume
                </button>
              )}
              {queue === "stations" ? <fieldset className="mt-5 space-y-4 rounded-xl border border-obligon-border p-4">
                <legend className="px-2 font-bold">Approved selling units</legend>
                <p className="text-sm text-obligon-text">Confirm how every fuel is sold at this station. This approval determines price and quantity labels; it does not convert existing transactions.</p>
                {(selected.fuels ?? []).map(fuel => { const code = partnerFuelCode(fuel); if (!code) return <p key={fuel} role="alert" className="text-sm text-red-800">Unsupported fuel: {fuel}. Ask the operator to correct its profile.</p>; const units = fuelSellingUnits(fuel); return <label key={fuel} className="block text-sm font-bold">{fuel}
                  <select required={decision === "active"} aria-label={`${fuel} approved selling unit`} value={sellingUnits[code] ?? (units.length === 1 ? units[0] : "")} onChange={event => setSellingUnits(current => ({ ...current, [code]: event.target.value as SellingUnit }))} className="mt-2 block min-h-12 w-full rounded-lg border border-obligon-border bg-white p-3">
                    {units.length > 1 ? <option value="">Choose selling unit</option> : null}
                    {units.map(unit => <option key={unit} value={unit}>{sellingUnitLabel(unit)}</option>)}
                  </select>
                  <span className="mt-1 block font-normal text-obligon-text">Requested: {selected.sellingUnits?.[code] ? sellingUnitLabel(selected.sellingUnits[code]) : "Not selected"}; previously approved: {selected.approvedSellingUnits?.[code] ? sellingUnitLabel(selected.approvedSellingUnits[code]) : "None"}</span>
                </label>; })}
              </fieldset> : null}
              <label className="mt-5 block">
                Decision
                <select
                  required
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  className="mt-2 block min-h-12 w-full rounded border p-3"
                >
                  <option value="">Choose a decision</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              {queue !== "jobs" && (
                <label className="mt-4 block">
                  Review note
                  <textarea
                    required
                    maxLength={2000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-2 block min-h-28 w-full rounded border p-3"
                  />
                </label>
              )}
              {queue === "privacy" && (
                <label className="mt-4 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                  />
                  I verified the requester’s identity and completed the
                  requested action under our retention policy.
                </label>
              )}
              <button
                disabled={busy}
                className="mt-5 min-h-12 rounded bg-obligon-green px-5 font-bold text-white"
              >
                {busy ? "Saving…" : "Record decision"}
              </button>
              <button
                type="button"
                className="ml-3 min-h-12 px-3"
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
            </form>
          )}
        {selected && queue === "activity" ? <div><p className="mb-4 font-semibold text-obligon-navy">{selected.action}</p><dl className="space-y-4"><div><dt className="text-sm text-obligon-text">Record</dt><dd className="mt-1 break-words font-mono text-sm">{selected.entity_id ?? selected.id}</dd></div>{Object.entries(selected.metadata ?? {}).map(([key, value]) => <div key={key}><dt className="text-sm font-semibold capitalize text-obligon-text">{key.replaceAll("_", " ")}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}</dd></div>)}</dl></div> : null}
      </AdminDialog>
      {total > 50 &&
        ["activity", "applications", "leads", "privacy", "financial"].includes(
          queue,
        ) && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              disabled={busy || resumeLoading || !page}
              onClick={() => setPage(page - 1)}
              className="min-h-12 rounded border px-4"
            >
              Previous
            </button>
            <span>
              {page + 1} / {Math.ceil(total / 50)}
            </span>
            <button
              disabled={busy || resumeLoading || (page + 1) * 50 >= total}
              onClick={() => setPage(page + 1)}
              className="min-h-12 rounded border px-4"
            >
              Next
            </button>
          </div>
        )}
      <AdminDialog open={published} title="Publish a role" description="Add a job opening to the public careers page." onClose={() => setPublished(false)}>
        {published ? feedback : null}
        {published && (
        <form
          className="admin-form min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void mutate("/jobs", Object.fromEntries(form));
          }}
        >
          {["title", "department", "location", "employmentType"].map(
            (field) => (
              <label className="mt-4 block" key={field}>
                {field.replace("Type", " type")}
                <input
                  required
                  name={field}
                  maxLength={200}
                  className="mt-2 block min-h-12 w-full rounded border p-3"
                />
              </label>
            ),
          )}
          <label className="mt-4 block">
            Description
            <textarea
              required
              name="description"
              maxLength={10000}
              className="mt-2 block min-h-28 w-full rounded border p-3"
            />
          </label>
          <button
            disabled={busy}
            className="mt-5 min-h-12 rounded bg-obligon-green px-5 text-white"
          >
            Publish role
          </button>
        </form>
      )}
      </AdminDialog>
    </section>
  );
}
