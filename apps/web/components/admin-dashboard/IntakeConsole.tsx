"use client";
import * as React from "react";
import { authenticatedRequest } from "@/lib/services";
type RecordRow = {
  id: string;
  name?: string;
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
export function IntakeConsole() {
  const [queue, setQueue] = React.useState<Queue>("stations"),
    [rows, setRows] = React.useState<RecordRow[]>([]),
    [statuses, setStatuses] = React.useState<string[]>([]),
    [selected, setSelected] = React.useState<RecordRow | null>(null),
    [note, setNote] = React.useState(""),
    [decision, setDecision] = React.useState(""),
    [verified, setVerified] = React.useState(false),
    [loading, setLoading] = React.useState(true),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [page, setPage] = React.useState(0),
    [total, setTotal] = React.useState(0),
    [search, setSearch] = React.useState(""),
    [published, setPublished] = React.useState(false);
  const loadSequence = React.useRef(0);
  const load = React.useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
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
      if (sequence === loadSequence.current) setError((e as Error).message);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [queue, page, search]);
  React.useEffect(() => {
    void load();
  }, [load]);
  async function mutate(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await authenticatedRequest(`/api/admin${path}`, {
        method,
        body: JSON.stringify(body),
      });
      setSelected(null);
      setNote("");
      setPublished(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resume(row: RecordRow) {
    try {
      const result = await authenticatedRequest<{ url: string }>(
        `/api/admin/job-applications/${row.id}/resume`,
      );
      window.location.assign(result.url);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="p-5 sm:p-10">
      <p className="text-xs font-bold uppercase text-obligon-green">
        Obligon operations
      </p>
      <h1 className="mt-2 text-3xl font-bold">Requests and activity</h1>
      <p className="mt-3 text-slate-600">
        Review publication and incoming requests. Decisions and business changes
        are recorded in the activity register.
      </p>
      <nav aria-label="Review queues" className="my-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab}
            aria-pressed={queue === tab}
            className={`min-h-12 rounded-lg border px-4 font-bold ${queue === tab ? "bg-obligon-green text-white" : "bg-white"}`}
            onClick={() => {
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">{titles[queue]}</h2>
        <button
          type="button"
          className="min-h-12 rounded border bg-white px-4"
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
          onClick={() => setPublished(true)}
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
      {error && (
        <p
          role="alert"
          className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-800"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading records…</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 rounded-lg border bg-white">
            {rows.map((row) => (
              <article key={row.id} className="border-b p-5 last:border-0">
                <div className="flex flex-wrap justify-between gap-3">
                  <h3 className="font-bold">
                    {row.title ??
                      row.name ??
                      row.contact_name ??
                      row.action ??
                      row.subject ??
                      row.reference ??
                      row.email ??
                      row.id}
                  </h3>
                  <span className="text-sm font-bold">
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
                {queue === "activity" ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer">
                      Record {row.entity_id ?? row.id}
                    </summary>
                    <dl className="mt-2 space-y-2">
                      {Object.entries(row.metadata ?? {}).map(
                        ([key, value]) => (
                          <div key={key} className="break-words text-sm">
                            <dt className="font-bold">{key}</dt>
                            <dd>
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                            </dd>
                          </div>
                        ),
                      )}
                    </dl>
                  </details>
                ) : (
                  queue !== "email" &&
                  queue !== "financial" && (
                    <button
                      type="button"
                      className="mt-3 min-h-12 rounded border px-4 font-bold"
                      onClick={() => {
                        setSelected(row);
                        setDecision(row.status ?? statuses[0] ?? "");
                        setNote("");
                        setVerified(false);
                      }}
                    >
                      Review record
                    </button>
                  )
                )}
              </article>
            ))}
            {!rows.length && <p className="p-6">No records in this queue.</p>}
          </div>
          {selected && (
            <form
              className="self-start rounded-lg border bg-white p-5"
              onSubmit={(e) => {
                e.preventDefault();
                void mutate(
                  queue === "stations"
                    ? `/stations/${selected.id}/review`
                    : queue === "jobs"
                      ? `/jobs/${selected.id}`
                      : `/intake/${queue}/${selected.id}`,
                  { status: decision, note, identityVerified: verified },
                  queue === "stations" ? "POST" : "PATCH",
                );
              }}
            >
              <h3 className="text-xl font-bold">
                Review{" "}
                {selected.name ??
                  selected.contact_name ??
                  selected.title ??
                  "request"}
              </h3>
              <p className="mt-4 whitespace-pre-wrap break-words">
                {selected.message ??
                  selected.cover_note ??
                  selected.description ??
                  selected.review_note}
              </p>
              {selected.resume_path && (
                <button
                  type="button"
                  className="mt-4 min-h-12 rounded border px-4"
                  onClick={() => void resume(selected)}
                >
                  Open protected resume
                </button>
              )}
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
        </div>
      )}
      {total > 50 &&
        ["activity", "applications", "leads", "privacy", "financial"].includes(
          queue,
        ) && (
          <div className="mt-5 flex items-center gap-4">
            <button
              disabled={!page}
              onClick={() => setPage(page - 1)}
              className="min-h-12 rounded border px-4"
            >
              Previous
            </button>
            <span>
              {page + 1} / {Math.ceil(total / 50)}
            </span>
            <button
              disabled={(page + 1) * 50 >= total}
              onClick={() => setPage(page + 1)}
              className="min-h-12 rounded border px-4"
            >
              Next
            </button>
          </div>
        )}
      {published && (
        <form
          className="mt-6 max-w-2xl rounded-lg border bg-white p-6"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void mutate("/jobs", Object.fromEntries(form));
          }}
        >
          <h2 className="text-xl font-bold">Publish a role</h2>
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
    </section>
  );
}
