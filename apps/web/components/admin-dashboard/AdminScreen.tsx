"use client";
import * as React from "react";
import Link from "next/link";
import { api, authenticatedRequest, saveBlob } from "@/lib/services";
import { CardApprovalQueue } from "./CardApprovalQueue";
import {
  adminPageCopy,
  type AdminPageKey,
  type AdminMetric,
  type AdminRow,
} from "@/lib/mock/admin-data";
type Row = AdminRow & {
  name?: string;
  email?: string;
  role?: string;
  statusRaw?: string;
  creditLimit?: number;
  plan?: string;
  businessName?: string;
  rcNumber?: string;
  address?: string;
  city?: string;
  contactEmail?: string;
  reviewNote?: string;
  description?: string;
  transactionRef?: string;
};
type Data = {
  metrics: AdminMetric[];
  companies?: Row[];
  applications?: Row[];
  stations?: Row[];
  disputes?: Row[];
  staff?: Row[];
  total?: number;
};
const paths: Record<AdminPageKey, string> = {
  companies: "companies",
  applications: "applications",
  reports: "reports",
  disputes: "disputes",
  staff: "staff",
};
const columns: Record<AdminPageKey, string[]> = {
  companies: [
    "Company / city",
    "Fleet ID",
    "Plan",
    "Active cards",
    "Credit ceiling",
    "Status",
  ],
  applications: [
    "Reference",
    "Business",
    "Location",
    "Contact",
    "Submitted",
    "Status",
  ],
  reports: [
    "Station",
    "Location",
    "Litres",
    "Transactions",
    "Revenue share",
    "Status",
  ],
  disputes: ["Reference", "Filed", "Station", "Subject", "Amount", "Status"],
  staff: ["Name / email", "Role label", "Access", "Status"],
};
export function AdminScreen({ pageKey }: { pageKey: AdminPageKey }) {
  const [data, setData] = React.useState<Data | null>(null),
    [error, setError] = React.useState(""),
    [loading, setLoading] = React.useState(true),
    [busy, setBusy] = React.useState(false),
    [selected, setSelected] = React.useState<Row | null>(null),
    [page, setPage] = React.useState(0),
    [search, setSearch] = React.useState(""),
    [range, setRange] = React.useState("30"),
    [creating, setCreating] = React.useState(false),
    [notice, setNotice] = React.useState("");
  const sequence = React.useRef(0);
  const load = React.useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await authenticatedRequest<Data>(
        `/api/admin/${paths[pageKey]}?limit=20&offset=${page * 20}&search=${encodeURIComponent(search)}&range=${range}`,
      );
      if (current === sequence.current) setData(result);
    } catch (e) {
      if (current === sequence.current) setError((e as Error).message);
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [pageKey, page, search, range]);
  React.useEffect(() => {
    setSelected(null);
    setCreating(false);
    void load();
  }, [load]);
  const rows =
    data?.[
      paths[pageKey] as "companies" | "applications" | "disputes" | "staff"
    ] ??
    data?.stations ??
    [];
  const field = "mt-2 block min-h-12 w-full rounded border p-3";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      if (creating)
        await authenticatedRequest(`/api/admin/${paths[pageKey]}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      else if (selected?.id) {
        const path =
          pageKey === "applications"
            ? `applications/${selected.id}/review`
            : pageKey === "disputes"
              ? `disputes/${selected.id}/resolve`
              : `${paths[pageKey]}/${selected.id}`;
        await authenticatedRequest(`/api/admin/${path}`, {
          method: ["applications", "disputes"].includes(pageKey)
            ? "POST"
            : "PUT",
          body: JSON.stringify(body),
        });
      }
      setNotice("Saved to the backend and activity register.");
      setSelected(null);
      setCreating(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="px-5 py-9 sm:px-8 xl:px-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{adminPageCopy[pageKey].title}</h1>
          <p className="mt-2 text-sm">
            Live platform records. Changes are recorded in Requests &amp;
            Activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={busy}
            className="min-h-12 rounded border px-5"
            onClick={() => void load()}
          >
            Refresh
          </button>
          {["companies", "staff"].includes(pageKey) && (
            <button
              className="min-h-12 rounded bg-obligon-green px-5 font-bold text-white"
              onClick={() => {
                setCreating(true);
                setSelected(null);
              }}
            >
              {pageKey === "companies"
                ? "Provision fleet"
                : "Add administrator"}
            </button>
          )}
          {pageKey === "reports" && (
            <button
              disabled={busy}
              className="min-h-12 rounded border px-5"
              onClick={async () => {
                setBusy(true);
                try {
                  saveBlob(
                    await api.download(
                      `/api/admin/reports/export?format=pdf&range=${range}`,
                    ),
                    "obligon-platform-report.pdf",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Download report PDF
            </button>
          )}
        </div>
      </header>
      {error && (
        <p role="alert" className="mt-4 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-green-900">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status" className="mt-6">
          Loading live records…
        </p>
      ) : (
        <>
          <div className="my-7 grid gap-4 md:grid-cols-3">
            {data?.metrics.map((metric) => (
              <div key={metric.label} className="border-b pb-4">
                <p className="text-xs font-bold">{metric.label}</p>
                <p className="mt-2 text-3xl font-bold">{metric.value}</p>
                {metric.helper && <p className="text-sm">{metric.helper}</p>}
              </div>
            ))}
          </div>
          {pageKey === "reports" ? (
            <label>
              Reporting window
              <select
                className={field}
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
          ) : (
            <label>
              Search records
              <input
                className={field}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
          )}
          <div className="mt-5 overflow-x-auto rounded border bg-white">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead>
                <tr>
                  {columns[pageKey].map((column) => (
                    <th key={column} className="p-4">
                      {column}
                    </th>
                  ))}
                  {pageKey !== "reports" && <th className="p-4">Review</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr className="border-t" key={row.id ?? index}>
                    {row.cells.map((cell, i) => (
                      <td className="whitespace-pre-line p-4" key={i}>
                        {cell}
                      </td>
                    ))}
                    <td className="p-4">{row.status}</td>
                    {pageKey !== "reports" && (
                      <td className="p-4">
                        <button
                          className="min-h-12 underline"
                          onClick={() => {
                            setSelected(row);
                            setCreating(false);
                          }}
                        >
                          Review record
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="p-6">No records match this view.</p>}
          </div>
          {data?.total !== undefined && (
            <div className="mt-4 flex items-center gap-4">
              <button
                disabled={page === 0}
                className="min-h-12 underline"
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                {data.total} records · Page {page + 1}
              </span>
              <button
                disabled={(page + 1) * 20 >= data.total}
                className="min-h-12 underline"
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      {(selected || creating) && (
        <form
          key={selected?.id ?? "new"}
          onSubmit={submit}
          className="mt-7 max-w-2xl space-y-4 rounded border bg-white p-6"
        >
          <h2 className="text-2xl font-bold">
            {creating
              ? "Create account"
              : `Review ${selected?.name ?? selected?.businessName ?? selected?.cells[0] ?? "record"}`}
          </h2>
          {selected && (
            <p className="whitespace-pre-line">
              {[
                selected.address,
                selected.city,
                selected.rcNumber,
                selected.contactEmail,
                selected.description,
                selected.transactionRef,
                selected.reviewNote,
              ]
                .filter(Boolean)
                .join("\n")}
            </p>
          )}
          {creating ? (
            <>
              {pageKey === "companies" ? (
                <>
                  <label>
                    Company name
                    <input
                      name="companyName"
                      required
                      maxLength={200}
                      className={field}
                    />
                  </label>
                  <label>
                    Owner name
                    <input
                      name="adminName"
                      required
                      maxLength={200}
                      className={field}
                    />
                  </label>
                  <label>
                    Owner email
                    <input
                      name="adminEmail"
                      type="email"
                      required
                      className={field}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Full name
                    <input
                      name="fullName"
                      required
                      maxLength={200}
                      className={field}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      name="email"
                      type="email"
                      required
                      className={field}
                    />
                  </label>
                  <p>
                    Active administrators receive full platform access. Role
                    labels are descriptive.
                  </p>
                </>
              )}
            </>
          ) : pageKey === "applications" ? (
            <>
              <label>
                Decision
                <select name="decision" required className={field}>
                  <option value="under_review">Continue review</option>
                  <option value="approve">Approve operator</option>
                  <option value="reject">Reject</option>
                </select>
              </label>
              <p>Station publication requires a separate location review.</p>
            </>
          ) : pageKey === "disputes" ? (
            <>
              <label>
                Outcome
                <select name="outcome" className={field}>
                  <option value="resolve">Resolve without a refund</option>
                  <option value="reject">Reject</option>
                  <option value="escalate">
                    Escalate for settlement review
                  </option>
                </select>
              </label>
              <Link
                href="/admin/operations"
                className="block min-h-12 underline"
              >
                Open original-payment refund and settlement workflows
              </Link>
            </>
          ) : pageKey === "staff" ? (
            <>
              <p>
                Active administrators have full platform access. Suspend an
                account to revoke access.
              </p>
              <label>
                Status
                <select
                  name="status"
                  className={field}
                  defaultValue={selected?.statusRaw ?? "active"}
                >
                  <option>active</option>
                  <option>suspended</option>
                </select>
              </label>
            </>
          ) : (
            <label>
              Credit ceiling (naira)
              <input
                name="creditLimit"
                type="number"
                min={0}
                step="0.01"
                className={field}
                defaultValue={selected?.creditLimit ?? 0}
              />
            </label>
          )}
          {["applications", "disputes"].includes(pageKey) && (
            <label>
              Review note
              <textarea
                name="note"
                required
                maxLength={2000}
                className={field}
              />
            </label>
          )}
          <div className="flex gap-4">
            <button
              disabled={busy}
              className="min-h-12 rounded bg-obligon-green px-5 font-bold text-white"
            >
              {busy ? "Saving…" : "Save record"}
            </button>
            <button
              type="button"
              className="min-h-12 underline"
              onClick={() => {
                setSelected(null);
                setCreating(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {pageKey === "applications" && <CardApprovalQueue />}
    </section>
  );
}
