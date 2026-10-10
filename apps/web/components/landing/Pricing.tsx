"use client";
import * as React from "react";
import Link from "next/link";
import { api } from "@/lib/services";
type Plan = {
  code: string;
  name: string;
  price_kobo: number;
  interval: string;
  features: Array<string | { label: string; state: string }>;
};
export function Pricing() {
  const [kind, setKind] = React.useState<"customer" | "partner" | "company">(
      "customer",
    ),
    [data, setData] = React.useState<{
      plans: Plan[];
      customerPlans: Plan[];
    } | null>(null),
    [error, setError] = React.useState("");
  const load = React.useCallback(async () => {
    try {
      setData(await api.request("/api/public/plans"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  const plans = kind === "customer" ? data?.customerPlans : data?.plans;
  return (
    <section id="pricing" className="bg-obligon-mist px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-bold uppercase text-obligon-green">
          Plans and access
        </p>
        <h2 className="mt-3 font-display text-4xl font-extrabold text-obligon-navy">
          Choose the plan for your journey.
        </h2>
        <p className="mt-4 text-obligon-text">
          Subscription fees are separate from fuel funds. Dashboard access
          follows the selected plan’s limits.
        </p>
        <div className="my-8 flex flex-wrap gap-3">
          {(["customer", "partner", "company"] as const).map((role) => (
            <button
              key={role}
              aria-pressed={kind === role}
              onClick={() => setKind(role)}
              className={`min-h-12 rounded-lg border px-6 font-bold ${kind === role ? "bg-obligon-green text-white" : "bg-white text-obligon-navy"}`}
            >
              {role === "customer"
                ? "Individual"
                : role === "partner"
                  ? "Partner"
                  : "Organization"}
            </button>
          ))}
        </div>
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button className="min-h-12 underline" onClick={() => void load()}>
              Retry loading prices
            </button>
          </div>
        )}
        {!data && !error && <p role="status">Loading current plans…</p>}
        <div className="grid gap-6 md:grid-cols-3">
          {plans?.map((plan) => (
            <article
              key={plan.code}
              className="flex flex-col rounded-xl border border-obligon-border bg-white p-6"
            >
              <h3 className="font-display text-2xl font-bold">{plan.name}</h3>
              <p className="my-4 text-3xl font-bold">
                ₦{(Number(plan.price_kobo) / 100).toLocaleString()}
                <span className="text-sm font-normal"> / {plan.interval}</span>
              </p>
              <ul className="mb-6 space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="text-sm">
                    {typeof feature === "string"
                      ? feature
                      : `${feature.label}: ${feature.state.replaceAll("_", " ")}`}
                  </li>
                ))}
              </ul>
              <Link
                className="mt-auto flex min-h-12 items-center justify-center rounded-lg bg-obligon-green px-4 font-bold text-white"
                href={`/auth/signup?role=${kind}&plan=${plan.code}`}
              >
                Choose {plan.name}
              </Link>
            </article>
          ))}
        </div>
        <Link
          href="/support?request=sales"
          className="mt-8 inline-flex min-h-12 items-center font-bold text-obligon-green underline"
        >
          Contact sales for a custom requirement
        </Link>
      </div>
    </section>
  );
}
