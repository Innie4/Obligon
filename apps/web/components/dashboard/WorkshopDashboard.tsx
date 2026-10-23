"use client";

import { StatusPopup } from "@/components/shared/StatusPopup";
import Link from "next/link";
import * as React from "react";
import { useSession } from "@/components/shared/AuthContext";
import { AsyncBoundary } from "@/components/shared/States";
import { useAsync } from "@/components/shared/useAsync";
import { authenticatedRequest } from "@/lib/services";
import { workshopServices, type WorkshopData, type WorkshopProfile } from "@/lib/partner-workshop";

const fieldClass = "mt-2 block min-h-12 w-full rounded-xl border border-obligon-border bg-white px-4 py-3 text-sm text-obligon-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-obligon-green disabled:bg-obligon-mist";

function WorkshopEditor({ profile, canEdit, onSaved }: { profile: WorkshopProfile; canEdit: boolean; onSaved: () => void }) {
  const [draft, setDraft] = React.useState(profile);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const submitting = React.useRef(false);
  const options = [...new Set<string>([...workshopServices, ...profile.services])];
  const change = <K extends keyof WorkshopProfile>(key: K, value: WorkshopProfile[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
    setSaved(false);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit || submitting.current) return;
    submitting.current = true;
    setSaving(true); setError(""); setSaved(false);
    try {
      await authenticatedRequest("/api/partner/workshop", { method: "PUT", body: JSON.stringify(draft) });
      setSaved(true);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your workshop profile could not be saved. Please try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return <form onSubmit={submit} className="mt-6 max-w-4xl space-y-6 rounded-2xl border border-obligon-border bg-white p-5 sm:p-8">
      {(saving) ? <StatusPopup tone="pending" message="Saving workshop profile…" /> : null}
    {!canEdit ? <p className="rounded-lg bg-obligon-mist p-4 text-sm text-obligon-text">Your team can view this profile. An owner or administrator can update it.</p> : null}
    <fieldset disabled={!canEdit || saving} className="grid gap-5 sm:grid-cols-2">
      <legend className="font-display text-lg font-bold tracking-tight sm:text-xl text-obligon-navy">Workshop details</legend>
      {([
        ["name", "Workshop name", 200], ["address", "Street address", 500],
        ["city", "City / town", 200], ["website", "Website (optional)", 500]
      ] as const).map(([name, label, limit]) => <label key={name} className="block text-sm font-bold text-obligon-navy">
        {label}<input name={name} value={draft[name]} onChange={event => change(name, event.target.value)} required={name === "name"} type={name === "website" ? "url" : "text"} autoComplete={name === "address" ? "street-address" : name === "city" ? "address-level2" : name === "website" ? "url" : "organization"} maxLength={limit} className={fieldClass} />
      </label>)}
      <label className="block text-sm font-semibold text-obligon-navy sm:col-span-2">About your workshop
        <textarea name="description" value={draft.description} onChange={event => change("description", event.target.value)} maxLength={2000} rows={4} className={fieldClass} />
      </label>
      <fieldset className="sm:col-span-2"><legend className="text-sm font-semibold text-obligon-navy">Services offered</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{options.map(service => <label key={service} className="flex min-h-12 items-center gap-3 rounded-xl border border-obligon-border px-4 py-3 text-sm text-obligon-navy transition-colors has-[:checked]:border-obligon-green has-[:checked]:bg-obligon-mist">
          <input type="checkbox" checked={draft.services.includes(service)} onChange={event => change("services", event.target.checked ? [...draft.services, service] : draft.services.filter(value => value !== service))} className="size-4 accent-obligon-green" />{service}
        </label>)}</div>
      </fieldset>
    </fieldset>
    {error ? <StatusPopup tone="error" message={error} /> : null}
    {saved ? <p role="status" className="rounded-lg bg-obligon-mist p-4 text-sm font-bold text-obligon-green">Workshop profile saved.</p> : null}
    {canEdit ? <button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-obligon-green px-5 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green disabled:opacity-60">{saving ? "Saving…" : "Save workshop profile"}</button> : null}
  </form>;
}

export function WorkshopDashboard({ edit = false }: { edit?: boolean }) {
  const { user } = useSession();
  const { status, data, error, reload } = useAsync(() => authenticatedRequest<WorkshopData>("/api/partner/workshop"));
  const canEdit = user?.organizationRole === "owner" || user?.organizationRole === "admin";
  return <section className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
    <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-obligon-navy">{edit ? "Workshop profile" : "Workshop overview"}</h1>
    <p className="mt-2 max-w-2xl text-sm text-obligon-text">{edit ? "Keep your workshop contact details and services up to date." : "Manage your workshop profile, team and support requests."}</p>
    <AsyncBoundary status={status} error={error?.message ?? null} onRetry={reload} loadingLabel="Loading your workshop…">
      {data ? edit ? <WorkshopEditor key={user?.organizationId} profile={data.profile} canEdit={canEdit} onSaved={reload} /> : <>
        <article className="mt-8 rounded-2xl border border-obligon-border bg-white p-6 sm:p-8">
          <h2 className="break-words font-display text-2xl font-bold text-obligon-navy">{data.profile.name}</h2>
          <p className="mt-2 text-sm text-obligon-text">{[data.profile.address, data.profile.city].filter(Boolean).join(", ") || "Add your workshop address in Workshop Profile."}</p>
          {data.profile.description ? <p className="mt-4 max-w-3xl text-sm leading-6 text-obligon-text">{data.profile.description}</p> : null}
          <Link href="/dashboard/workshop" className="mt-5 inline-flex min-h-11 items-center font-bold text-obligon-green underline">View workshop profile</Link>
          <h3 className="mt-6 text-sm font-bold text-obligon-navy">Services offered</h3>
          {data.profile.services.length ? <ul className="mt-3 flex flex-wrap gap-2">{data.profile.services.map(service => <li key={service} className="rounded-lg bg-obligon-mist px-3 py-2 text-sm text-obligon-navy">{service}</li>)}</ul> : <p className="mt-2 text-sm text-obligon-text">No services have been added yet.</p>}
        </article>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link href="/dashboard/staff" className="min-w-0 rounded-2xl border border-obligon-border bg-white p-6 transition-colors hover:border-obligon-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-obligon-green"><p className="text-sm font-bold text-obligon-text">Team members</p><p className="mt-2 text-3xl font-extrabold text-obligon-navy">{data.stats.staff}</p><p className="mt-3 text-sm font-bold text-obligon-green">View your team</p></Link>
          <Link href="/dashboard/settings#partner-support" className="min-w-0 rounded-2xl border border-obligon-border bg-white p-6 transition-colors hover:border-obligon-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-obligon-green"><p className="text-sm font-bold text-obligon-text">Support requests</p><p className="mt-2 text-3xl font-extrabold text-obligon-navy">{data.stats.supportTickets}</p><p className="mt-3 text-sm font-bold text-obligon-green">Open Support</p></Link>
        </div>
        <p className="mt-6 text-sm text-obligon-text">Job bookings and service payments are not available in this dashboard.</p>
      </> : null}
    </AsyncBoundary>
  </section>;
}

export function PartnerAccountOverview() {
  const { user } = useSession();
  return <section className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
    <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-obligon-navy">Partner account</h1>
    <article className="mt-6 max-w-3xl rounded-xl border border-obligon-border bg-white p-6 sm:p-8">
      <h2 className="break-words font-display text-xl font-bold text-obligon-navy">{user?.organization || "Your business"}</h2>
      <p className="mt-3 text-sm leading-6 text-obligon-text">Your partner specialization needs admin review before operational features can be enabled. Keep your account details current and contact Support to confirm the services your business provides.</p>
      <div className="mt-5 flex flex-wrap gap-4"><Link href="/dashboard/settings#partner-support" className="inline-flex min-h-12 items-center font-bold text-obligon-green underline">Open Support</Link><Link href="/dashboard/verify" className="inline-flex min-h-12 items-center font-bold text-obligon-green underline">Account verification</Link></div>
    </article>
  </section>;
}
