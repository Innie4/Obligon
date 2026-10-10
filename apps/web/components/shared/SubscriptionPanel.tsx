"use client";
import * as React from "react";
import Link from "next/link";
import { authenticatedRequest } from "@/lib/services";
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
export function SubscriptionPanel({ kind }: { kind: "partner" | "customer" }) {
  const endpoint =
    kind === "partner" ? "/api/partner/billing" : "/api/customer/subscription";
  const [preferredPlan, setPreferredPlan] = React.useState<string>();
  React.useEffect(() => {
    const plan = sessionStorage.getItem("obligon_selected_plan");
    if (plan) {
      setPreferredPlan(plan);
      sessionStorage.removeItem("obligon_selected_plan");
    }
  }, []);
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
    const reference = params.get("reference");
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
          return refresh();
        })
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
    }
  }, [endpoint, refresh]);
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
      } else window.location.assign(result.authorization_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment could not start");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="p-6 sm:p-10">
      <h1 className="text-3xl font-extrabold">
        {kind === "partner" ? "Partner" : "Customer"} Subscription
      </h1>
      <p className="mt-3">
        {data?.active
          ? `${data.subscription?.name} active until ${new Date(data.subscription!.current_period_end).toLocaleDateString()}`
          : "Choose and pay for a plan to activate dashboard features."}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Each payment covers one month. Renew here before expiry. Subscription
        fees are separate from fuel funds.
      </p>
      {error && (
        <p role="alert" className="my-4 text-red-700">
          {error}
        </p>
      )}
      <div className="my-6 grid gap-5 md:grid-cols-3">
        {[...(data?.plans ?? [])]
          .sort(
            (a, b) =>
              Number(b.code === preferredPlan) -
              Number(a.code === preferredPlan),
          )
          .map((p) => (
            <article key={p.code} className="rounded-xl border bg-white p-5">
              <h2 className="text-xl font-bold">{p.name}</h2>
              <p className="my-3">
                ₦{(p.price_kobo / 100).toLocaleString()} / month
              </p>
              <ul className="space-y-2">
                {p.features.map((f, i) => (
                  <li key={i} className="text-sm">
                    {typeof f === "string" ? f : `${f.label}: ${f.state}`}
                  </li>
                ))}
              </ul>
              {data?.needsFirstCard ? (
                <Link
                  href={`/customer/card?chosenPlan=${p.code}`}
                  className="mt-5 block rounded-lg bg-obligon-green p-3 font-bold text-white"
                >
                  Request your first card
                </Link>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => void buy(p.code)}
                  className="mt-5 rounded-lg bg-obligon-green p-3 font-bold text-white disabled:opacity-50"
                >
                  {data?.active ? "Renew / change plan" : "Subscribe"}
                </button>
              )}
            </article>
          ))}
      </div>
      {!data && !error && <p>Loading plans…</p>}
    </section>
  );
}
