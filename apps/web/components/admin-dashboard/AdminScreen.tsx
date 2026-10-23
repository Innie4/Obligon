"use client";
import { StatusPopup } from "@/components/shared/StatusPopup";
import * as React from "react";
import Link from "next/link";
import { api, authenticatedRequest, saveBlob } from "@/lib/services";
import { CardApprovalQueue } from "./CardApprovalQueue";
import { DashboardSearchQuery } from "@/components/shared/DashboardSearchQuery";
import { AdminRecords } from "./AdminRecords";
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
  verificationStatus?: string;
  subscriptionStatus?: string;
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
    "Quantities",
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
    [loadFailed, setLoadFailed] = React.useState(false),
    [loading, setLoading] = React.useState(true),
    [busy, setBusy] = React.useState(false),
    [selected, setSelected] = React.useState<Row | null>(null),
    [page, setPage] = React.useState(0),
    [search, setSearch] = React.useState(""),
    [range, setRange] = React.useState("30"),
    [creating, setCreating] = React.useState(false),
    [notice, setNotice] = React.useState(""),
    [reviewVerification, setReviewVerification] = React.useState("pending");
  const sequence = React.useRef(0);
  const load = React.useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setLoadFailed(false);
    setError("");
    try {
      const result = await authenticatedRequest<Data>(
        `/api/admin/${paths[pageKey]}?limit=20&offset=${page * 20}&search=${encodeURIComponent(search)}&range=${range}`,
      );
      if (current === sequence.current) setData(result);
    } catch (e) {
      if (current === sequence.current) {
        setLoadFailed(true);
        setError((e as Error).message);
      }
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
  const field = "mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-obligon-border bg-white p-3 text-sm text-obligon-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    if (pageKey === "companies" && !creating) {
      const contractAgreed = body.contractAgreed === "true";
      if (body.verificationStatus === "verified" && selected?.verificationStatus !== "verified" && !contractAgreed) {
        setError("Confirm that the company contract is agreed before approving operations.");
        return;
      }
      Object.assign(body, { contractAgreed });
    }
    setBusy(true);
    setError("");
    try {
      let savedMessage = "Saved to the backend and activity register.";
      if (creating) {
        const result = await authenticatedRequest<{ message?: string }>(`/api/admin/${paths[pageKey]}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (pageKey === "companies") savedMessage = result.message ?? "Fleet created pending contract approval.";
      } else if (selected?.id) {
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
      setNotice(savedMessage);
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
    <section className="mx-auto w-full min-w-0 max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {(busy) ? <StatusPopup tone="pending" message="Saving review…" /> : null}
      <DashboardSearchQuery onSearch={value => { setSearch(value); setPage(0); }} />
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-obligon-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{adminPageCopy[pageKey].title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-obligon-text">
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
              disabled={busy}
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
        <StatusPopup tone="error" message={error} />
      )}
      {notice && (
        <StatusPopup tone="info" message={notice} />
      )}
      {!loading && !loadFailed && (
        <dl aria-label="Platform metrics" className={`my-6 grid grid-cols-2 gap-3 sm:gap-4 ${(data?.metrics.length ?? 0) > 3 ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}>
          {data?.metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 rounded-xl border border-obligon-border bg-white p-3 sm:p-5">
              <dt className="text-xs font-medium leading-5 text-obligon-text sm:text-sm">{metric.label}</dt>
              <dd className="mt-1 break-words text-2xl font-bold tracking-tight tabular-nums sm:mt-2 sm:text-3xl">{metric.value}</dd>
              {metric.helper && <dd className="mt-1 text-xs leading-5 text-obligon-text">{metric.helper}</dd>}
            </div>
          ))}
        </dl>
      )}
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
            maxLength={254}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
      )}
      {loading ? (
        <StatusPopup tone="loading" message="Loading live records…" />
      ) : !loadFailed ? (
        <>
          <AdminRecords title={adminPageCopy[pageKey].title} columns={columns[pageKey]} rows={rows} busy={busy} onReview={pageKey === "reports" ? undefined : row => {
            setSelected(row);
            setCreating(false);
            setReviewVerification(row.verificationStatus ?? "pending");
          }} />
          {data?.total !== undefined && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <button
                disabled={page === 0}
                className="min-h-11 rounded-lg border border-obligon-border bg-white px-4 font-semibold disabled:cursor-not-allowed disabled:bg-obligon-panel disabled:text-obligon-text/50"
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                {data.total} records · Page {page + 1}
              </span>
              <button
                disabled={(page + 1) * 20 >= data.total}
                className="min-h-11 rounded-lg border border-obligon-border bg-white px-4 font-semibold disabled:cursor-not-allowed disabled:bg-obligon-panel disabled:text-obligon-text/50"
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : null}
      {(selected || creating) && (
        <form
          key={selected?.id ?? "new"}
          onSubmit={submit}
          className="mt-7 max-w-2xl space-y-5 rounded-xl border border-obligon-border bg-white p-5 sm:p-6"
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
                  <p className="text-sm">
                    New fleets remain pending. Company operations require admin approval after the contract is agreed.
                  </p>
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
          ) : pageKey === "companies" ? (
            <>
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
              <label className="block">
                Verification decision
                <select name="verificationStatus" className={field} value={reviewVerification} onChange={event => setReviewVerification(event.target.value)}>
                  <option value="unverified">Unverified</option>
                  <option value="pending">Pending contract review</option>
                  <option value="verified">Approve company operations</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label className="block">
                Subscription state
                <select name="status" className={field} defaultValue={selected?.subscriptionStatus ?? "canceled"}>
                  <option value="canceled">Inactive</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past due</option>
                  <option value="trialing">Trialing</option>
                </select>
              </label>
              {reviewVerification === "verified" && selected?.verificationStatus !== "verified" && (
                <label className="flex min-h-12 items-start gap-3 rounded border p-3">
                  <input type="checkbox" name="contractAgreed" value="true" required aria-describedby="company-contract-approval-help" className="mt-1 size-5" />
                  <span>I confirm the company contract is agreed and company operations may be approved.</span>
                </label>
              )}
              <p id="company-contract-approval-help" className="text-sm">
                Approval enables company operations. The decision and contract confirmation are recorded under your administrator account.
              </p>
            </>
          ) : null}
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
              disabled={busy}
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
