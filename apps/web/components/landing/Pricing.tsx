"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type FeatureCell = true | false | string;

type SourcePlan = {
  name: string;
  price: string;
  suffix?: string;
  features: FeatureCell[];
  cta: string;
  recommended?: boolean;
  dark?: boolean;
};

type ResolvedFeature = {
  label: string;
  value: string | null;
  enabled: boolean;
};

type ResolvedPlan = {
  name: string;
  price: string;
  suffix?: string;
  features: ResolvedFeature[];
  cta: string;
  recommended?: boolean;
  dark?: boolean;
};

const organizationPlans: SourcePlan[] = [
  {
    name: "Starter",
    price: "150k",
    suffix: "/year",
    features: ["Up to 10 Vehicles", "Basic Reporting", "50 Partner Stations"],
    cta: "Choose Starter"
  },
  {
    name: "Business",
    price: "250k",
    suffix: "/year",
    features: ["Up to 50 Vehicles", "Advanced Analytics", "250 Partner Stations", "Dedicated Account Exec"],
    cta: "Choose Business",
    recommended: true
  },
  {
    name: "Enterprise",
    price: "500k",
    suffix: "/year",
    features: ["Up to 200 Vehicles", "Custom API Integration", "Full Network Access"],
    cta: "Choose Enterprise"
  },
  {
    name: "Organization",
    price: "Custom",
    features: ["Unlimited Vehicles", "White-label Options", "Bulk Fuel Management"],
    cta: "Custom Quote",
    dark: true
  }
];

const individualFeatureLabels = [
  "Digital Fuel Wallet",
  "Virtual Fuel Card",
  "Fuel Purchase",
  "Digital Receipts",
  "Transaction History",
  "Fuel Spend Tracking",
  "Fuel Budget Management",
  "Spending Limits",
  "Fuel Consumption Analytics",
  "Loyalty Rewards",
  "Partner Discounts",
  "Partner Mechanics",
  "Priority Support",
  "Generator Repairer",
  "Access to Car Wash",
  "VIP Lounge",
  "Intelligence Notifications",
  "Towing Services"
];

const individualPlans: SourcePlan[] = [
  {
    name: "Bronze",
    price: "2,500",
    suffix: "/month",
    features: [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      "Full station discount",
      false,
      false,
      "30%",
      false,
      false,
      false,
      false
    ],
    cta: "Choose Bronze"
  },
  {
    name: "Gold",
    price: "3,500",
    suffix: "/month",
    features: [
      true,
      true,
      true,
      true,
      true,
      "Advanced",
      true,
      true,
      "Advanced",
      "Premium",
      "Full station discount",
      false,
      true,
      "60%",
      true,
      false,
      true,
      false
    ],
    cta: "Choose Gold",
    recommended: true
  },
  {
    name: "Platinum",
    price: "5,000",
    suffix: "/month",
    features: [
      true,
      true,
      true,
      true,
      true,
      "Advanced",
      true,
      true,
      "Advanced",
      "Premium",
      "Full station discount",
      true,
      true,
      "100%",
      true,
      true,
      true,
      true
    ],
    cta: "Choose Platinum"
  }
];

function resolvePlans(source: SourcePlan[], usesSharedLabels: boolean): ResolvedPlan[] {
  return source.map((plan) => ({
    ...plan,
    features: plan.features.map((cell, index) => {
      if (typeof cell === "string") {
        return usesSharedLabels
          ? { label: individualFeatureLabels[index], value: cell, enabled: true }
          : { label: cell, value: null, enabled: true };
      }

      return { label: individualFeatureLabels[index], value: null, enabled: cell };
    })
  }));
}

export function Pricing() {
  const [tab, setTab] = useState<"individual" | "organization">("individual");
  const [comparedPlans, setComparedPlans] = useState({ individual: "Gold", organization: "Business" });
  const plans =
    tab === "individual" ? resolvePlans(individualPlans, true) : resolvePlans(organizationPlans, false);

  return (
    <section id="pricing" className="bg-obligon-mist py-20 lg:py-32" data-node-id="2:71">
      <div className="mx-auto w-full max-w-[1216px] min-w-0 px-5 sm:px-8">
        <div className="mx-auto max-w-[672px] text-center">
          <h2 className="font-display text-[32px] font-bold leading-tight tracking-tight text-obligon-navy sm:text-4xl">
            Plans and access
          </h2>
          <p className="mt-4 text-base leading-6 text-obligon-text">
            Compare personal and Organization plans. Company fleet operations require an active Organization subscription.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <div role="group" aria-label="Plan audience" className="flex rounded-full border border-[#e5e7eb] bg-[#f3f4f6] p-[5px]">
            <button
              type="button"
              onClick={() => setTab("individual")}
              aria-pressed={tab === "individual"}
              className={`min-h-11 rounded-full px-8 text-sm font-semibold transition ${
                tab === "individual"
                  ? "border border-[#e5e7eb] bg-white text-[#060b19]"
                  : "text-[#4b5563]"
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setTab("organization")}
              aria-pressed={tab === "organization"}
              className={`min-h-11 rounded-full px-8 text-sm font-semibold transition ${
                tab === "organization"
                  ? "border border-[#e5e7eb] bg-white text-[#060b19]"
                  : "text-[#4b5563]"
              }`}
            >
              Organization
            </button>
          </div>
        </div>

        {tab === "organization" && (
          <p className="mt-6 text-center text-sm text-obligon-text">
            Subscribe to an Organization plan to activate company fleet operations. Partners join under an agreed, administrator-approved contract without a subscription.
          </p>
        )}

        <div role="group" aria-label={`Compare ${tab} plans`} className={`mt-8 grid gap-2 lg:hidden ${plans.length === 4 ? "grid-cols-2" : "grid-cols-3"}`}>
          {plans.map(plan => <button key={plan.name} type="button" aria-pressed={comparedPlans[tab] === plan.name} aria-controls={`public-plan-${plan.name.toLowerCase()}`} onClick={() => setComparedPlans(current => ({ ...current, [tab]: plan.name }))} className={`min-h-12 min-w-0 rounded-xl px-2 py-3 text-sm font-semibold transition-colors ${comparedPlans[tab] === plan.name ? "bg-obligon-green text-white" : "bg-white text-obligon-text hover:bg-obligon-panel"}`}>{plan.name}</button>)}
        </div>

        <div
          className={`mt-[52px] grid min-w-0 gap-5 lg:items-start ${
            plans.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
          }`}
        >
          {plans.map((plan) => (
            <article
              key={plan.name}
              id={`public-plan-${plan.name.toLowerCase()}`}
              className={`relative ${comparedPlans[tab] === plan.name ? "flex" : "hidden lg:flex"} min-h-[384px] min-w-0 flex-col rounded-3xl p-6 sm:p-8 ${
                plan.dark
                  ? "border border-obligon-blue bg-obligon-blue text-white"
                  : plan.recommended
                    ? "border-2 border-obligon-green bg-white text-obligon-navy"
                    : "border border-obligon-border bg-white text-obligon-navy"
              }`}
            >
              {plan.recommended ? (
                <div className="absolute right-0 top-0 rounded-tr-[22px] bg-obligon-green px-4 py-1 text-[13px] font-bold uppercase leading-5 text-white">
                  Recommended
                </div>
              ) : null}

              <h3
                className={`font-display text-xl font-bold tracking-tight ${
                  plan.dark ? "text-obligon-lime" : plan.recommended ? "text-obligon-green" : "text-obligon-text"
                }`}
              >
                {plan.name}
              </h3>

              <div className="mt-3 flex items-end gap-1">
                {plan.price === "Custom" ? (
                  <p className="font-display text-3xl leading-9">Custom</p>
                ) : (
                  <>
                    <p className="font-display text-3xl leading-9">&#8358;{plan.price}</p>
                    <span className={`pb-1 text-sm ${plan.dark ? "text-white/75" : "text-obligon-text"}`}>
                      {plan.suffix}
                    </span>
                  </>
                )}
              </div>

              <ul className={`mt-8 space-y-3.5 ${tab === "individual" ? "mb-8" : ""}`}>
                {plan.features.map((feature) => (
                  <li
                    key={feature.label}
                    className={`flex items-center gap-3 text-sm leading-5 ${
                      !feature.enabled
                        ? plan.dark
                          ? "text-white/75"
                          : "text-obligon-text"
                        : plan.dark
                          ? "text-white/80"
                          : plan.recommended
                            ? "font-medium text-obligon-navy"
                            : "text-obligon-text"
                    }`}
                  >
                    {feature.enabled ? (
                      <Check
                        aria-hidden="true"
                        size={12}
                        strokeWidth={2.5}
                        className={`shrink-0 ${plan.dark ? "text-obligon-lime" : "text-obligon-green"}`}
                      />
                    ) : (
                      <>
                        <X aria-hidden="true" size={12} strokeWidth={2.5} className="shrink-0" />
                        <span className="sr-only">Not included</span>
                      </>
                    )}
                    <span className="min-w-0">
                      {feature.label}
                      {feature.value ? (
                        <span
                          className={`ml-1.5 font-bold ${plan.dark ? "text-obligon-lime" : "text-obligon-green"}`}
                        >
                          {feature.value}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={
                  tab === "individual"
                    ? `/auth/signup?role=customer&plan=${plan.name.toLowerCase()}`
                    : plan.name === "Organization"
                      ? `/support?request=${encodeURIComponent("Custom Organization plan quote")}`
                      : `/auth/signup?role=company&plan=organization_${plan.name.toLowerCase()}`
                }
                className={`mt-auto inline-flex h-14 items-center justify-center rounded-lg px-6 text-base font-bold ${
                  plan.dark
                    ? "bg-white text-obligon-navy"
                    : plan.recommended
                      ? "bg-obligon-green text-white"
                      : "border border-obligon-navy text-obligon-navy"
                }`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
