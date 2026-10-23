"use client";

import * as React from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { bvnStatusLabel, canEditCardIdentity, safeBvnConsentUrl } from "@/lib/card-identity";
import { mutationsApi, type CardRequest } from "@/lib/services";
import { StatusPopup } from "@/components/shared/StatusPopup";

export function CardIdentityReviewStatus({ request, onChange, onEdit }: { request: CardRequest; onChange: (request: CardRequest) => void; onEdit: () => void }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const url = safeBvnConsentUrl(request.bvnConsentUrl);
  async function refresh() {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const result = await mutationsApi.getCardRequest();
      if (result.request) onChange(result.request);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to refresh identity status."); }
    finally { setLoading(false); }
  }
  return <section aria-label="Card identity checks" className="mt-5 border-t border-obligon-border pt-5">
    {loading ? <StatusPopup tone="loading" message="Refreshing your identity checks…" /> : null}
    {error ? <StatusPopup tone="error" message={error} onRetry={() => void refresh()} /> : null}
    <h3 className="text-sm font-bold text-obligon-navy">Your identity checks</h3>
    {request.identityStale ? <p className="mt-3 text-sm leading-6 text-obligon-text">Your account details changed. Submit your current details and confirm them again. If a BVN check is still open, ask Support to have an admin review it first.</p> : null}
    <dl className="mt-3 space-y-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt className="text-obligon-text">Email confirmation</dt><dd className="font-semibold text-obligon-navy">{request.emailConfirmationStatus === "verified" ? "Confirmed" : "Confirmation needed"}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-obligon-text">BVN and name</dt><dd className="font-semibold text-obligon-navy">{bvnStatusLabel(request.bvnStatus)}</dd></div></dl>
    {url ? <><p className="mt-4 text-sm leading-6 text-obligon-text">Complete the provider’s consent step, then refresh this page. Your admin will retrieve the result.</p><a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-obligon-green px-4 text-sm font-bold text-white">Continue identity consent<ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> in a new tab</span></a></> : null}
    <button type="button" disabled={loading} onClick={() => void refresh()} className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-obligon-border px-4 text-sm font-semibold text-obligon-navy disabled:opacity-50"><RefreshCw size={15} aria-hidden="true" />Refresh identity checks</button>
    {canEditCardIdentity(request) ? <button type="button" disabled={loading} onClick={onEdit} className="mt-2 min-h-11 text-sm font-semibold text-obligon-green underline underline-offset-2">Correct submitted details</button> : null}
  </section>;
}
