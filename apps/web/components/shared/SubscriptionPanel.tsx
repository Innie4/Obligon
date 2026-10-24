"use client";
import * as React from "react";
import Link from "next/link";
import { authenticatedRequest } from "@/lib/services";
import { customerPaymentReference } from "@/lib/customer-card-routes";
import { ChevronDown } from "lucide-react";
import { StatusPopup } from "./StatusPopup";
import { EmptyState } from "./States";
interface State {
  active: boolean;
  needsFirstCard?: boolean;
  subscription: { name: string; current_period_end: string } | null;
  plans: Array<{
    code: string;
    name: string;
    price_kobo: number;
    features: Array<string | { label: string; state: string }>;
  }>;
}
export function SubscriptionPanel({ kind, embedded = false, preferredPlan: selectedPlan, onSubscriptionChange }: {
  kind: "partner" | "customer";
  embedded?: boolean;
  preferredPlan?: string;
  onSubscriptionChange?: () => void;
}) {
  const endpoint =
    kind === "partner" ? "/api/partner/billing" : "/api/customer/subscription";
  const [preferredPlan, setPreferredPlan] = React.useState<string>();
  React.useEffect(() => {
    const plan = selectedPlan ?? (!embedded ? sessionStorage.getItem("obligon_selected_plan") : null);
    if (plan) {
      setPreferredPlan(plan);
      if (!embedded) sessionStorage.removeItem("obligon_selected_plan");
    }
  }, [embedded, selectedPlan]);
  const [data, setData] = React.useState<State | null>(null),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false);
  const refresh = React.useCallback(async () => {
    try {
      setData(await authenticatedRequest<State>(endpoint));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load subscription");
    }
  }, [endpoint]);
  React.useEffect(() => {
    void refresh();
    const params = new URLSearchParams(window.location.search);
    const reference = kind === "customer"
      ? customerPaymentReference(window.location.search, "subscription")
      : params.get("reference");
    if (reference) {
      setBusy(true);
      void authenticatedRequest(endpoint + "/confirm", {
        method: "POST",
        body: JSON.stringify({
          reference,
          transactionId: params.get("transaction_id"),
          simulated: params.get("simulated") === "true",
        }),
      })
        .then(() => {
          window.history.replaceState({}, "", window.location.pathname);
          onSubscriptionChange?.();
          return refresh();
        })
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
    }
  // Only a processor return starts confirmation; parent refresh callbacks may change identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, kind, refresh]);
  async function buy(planCode: string) {
    setBusy(true);
    setError("");
    try {
      const result = await authenticatedRequest<{
        authorization_url: string;
        reference: string;
        simulated: boolean;
      }>(endpoint + "/checkout", {
        method: "POST",
        body: JSON.stringify({ planCode }),
      });
      if (result.simulated) {
        await authenticatedRequest(endpoint + "/confirm", {
          method: "POST",
          body: JSON.stringify({
            reference: result.reference,
            simulated: true,
          }),
        });
        await refresh();
        onSubscriptionChange?.();
      } else window.location.assign(result.authorization_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment could not start");
    } finally {
      setBusy(false);
    }
  }
  const plans = data?.plans ?? [];
  const currentPlanCode = data?.active
    ? plans.find(plan => plan.name.toLowerCase() === data.subscription?.name?.toLowerCase())?.code
    : undefined;
  const previewCode = plans.find(plan => plan.code === preferredPlan)?.code ?? currentPlanCode ?? plans[0]?.code;
  const comparisonLabels = ["Fuel Spend Tracking", "Loyalty Rewards", "Generator Repairer", "Towing Services"];
  const previewFeatures = (plan: State["plans"][number]) => {
    const comparison = kind === "customer" ? plan.features.filter(feature => typeof feature !== "string" && comparisonLabels.includes(feature.label)) : [];
    return comparison.length ? comparison : plan.features.slice(0, 4);
  };
  const PlanHeading = embedded ? "h3" : "h2";
  return (
    <section className={embedded ? "rounded-2xl border border-obligon-border bg-white p-5 sm:p-6" : "p-5 sm:p-10"}>
      {embedded ? <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Subscription</h2> : <h1 className="text-3xl font-extrabold">{kind === "partner" ? "Partner" : "Customer"} Subscription</h1>}
      <p className="mt-3">
        {data?.active
          ? `${data.subscription?.name ?? "Your plan"}${data.subscription?.current_period_end ? ` active until ${new Date(data.subscription.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : " is active"}`
          : "Choose and pay for a plan to activate dashboard features."}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Each payment covers one month. Renew here before expiry. Subscription
        fees are separate from fuel funds.
      </p>
      {error ? <StatusPopup tone="error" title="Could not load or update your plan" message={error} onRetry={() => void refresh()} /> : null}
      {busy ? <StatusPopup tone="pending" message="Preparing your plan payment…" /> : null}
      {data && !plans.length ? <EmptyState title="No plans available" message="We could not find a plan to offer right now." action={<button type="button" onClick={() => void refresh()} className="min-h-11 rounded-lg border border-obligon-border px-4 text-sm font-semibold">Reload plans</button>} /> : null}
      {plans.length > 1 ? <div className="mt-6 md:hidden" role="group" aria-label="Compare subscription plans">
        <p className="mb-3 text-sm font-semibold text-obligon-navy">Compare plans</p>
        <div className="grid grid-cols-3 gap-2">
          {plans.map(plan => <button key={plan.code} type="button" aria-pressed={previewCode === plan.code} aria-controls={`subscription-${kind}-${plan.code}`} onClick={() => setPreferredPlan(plan.code)} className={`min-h-12 min-w-0 rounded-xl px-2 py-3 text-sm font-semibold transition-colors ${previewCode === plan.code ? "bg-obligon-green text-white" : "bg-obligon-mist text-obligon-text hover:bg-obligon-panel"}`}>{plan.name}</button>)}
        </div>
      </div> : null}
      <div className="my-6 grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
            <article key={p.code} id={`subscription-${kind}-${p.code}`} className={`${p.code === previewCode ? "flex" : "hidden md:flex"} min-w-0 flex-col rounded-xl bg-obligon-mist p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <PlanHeading className="font-display text-xl font-bold tracking-tight">{p.name}</PlanHeading>
                {p.code === currentPlanCode ? <span className="text-xs font-bold text-obligon-green">Current plan</span> : null}
              </div>
              <p className="my-3 text-lg font-bold tabular-nums">
                ₦{(p.price_kobo / 100).toLocaleString()} / month
              </p>
              <ul className="space-y-3 text-sm leading-5">
                {previewFeatures(p).map((f, i) => <li key={i}>{typeof f === "string" ? f : `${f.label}: ${f.state}`}</li>)}
              </ul>
              <details className="group mb-5 mt-4 flex-1">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-obligon-green [&::-webkit-details-marker]:hidden">All plan benefits <ChevronDown size={16} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" /></summary>
                <ul className="mt-3 space-y-2.5 border-t border-obligon-border pt-4">
                {p.features.map((f, i) => (
                  <li key={i} className="text-sm leading-5">
                    {typeof f === "string" ? f : `${f.label}: ${f.state}`}
                  </li>
                ))}
                </ul>
              </details>
              {data?.needsFirstCard ? (
                <Link
                  href={`/customer/card?chosenPlan=${p.code}`}
                  className="mt-auto block rounded-lg bg-obligon-green p-3 text-center font-bold text-white"
                >
                  Request your first card
                </Link>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => void buy(p.code)}
                  className="mt-auto rounded-lg bg-obligon-green p-3 font-bold text-white disabled:opacity-50"
                >
                  {data?.active ? "Renew / change plan" : "Subscribe"}
                </button>
              )}
            </article>
          ))}
      </div>
      {!data && !error ? <StatusPopup tone="loading" message="Loading subscription plans…" /> : null}
    </section>
  );
}
