"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { assets } from "./assets";

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
    cta: "Deploy Now"
  },
  {
    name: "Business",
    price: "250k",
    suffix: "/year",
    features: ["Up to 50 Vehicles", "Advanced Analytics", "250 Partner Stations", "Dedicated Account Exec"],
    cta: "Scale Faster",
    recommended: true
  },
  {
    name: "Enterprise",
    price: "500k",
    suffix: "/year",
    features: ["Up to 200 Vehicles", "Custom API Integration", "Full Network Access"],
    cta: "Contact Sales"
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
  "Physical Fuel Card",
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
      "25%",
      false,
      false,
      "30%",
      false,
      false,
      false,
      false
    ],
    cta: "Start Free"
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
      "50%",
      false,
      true,
      "60%",
      true,
      false,
      true,
      false
    ],
    cta: "Go Gold",
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
      "75%",
      true,
      true,
      "100%",
      true,
      true,
      true,
      true
    ],
    cta: "Go Platinum"
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
  const plans =
    tab === "individual" ? resolvePlans(individualPlans, true) : resolvePlans(organizationPlans, false);

  return (
    <section id="pricing" className="bg-obligon-mist py-20 lg:py-32" data-node-id="2:71">
      <div className="mx-auto w-full max-w-[1216px] min-w-0 px-5 sm:px-8">
        <div className="mx-auto max-w-[672px] text-center">
          <p className="text-xs font-semibold uppercase tracking-[2.4px] text-obligon-green">Pricing Strategy</p>
          <h2 className="mt-4 font-display text-[32px] leading-10 text-obligon-navy sm:text-4xl">
            Built for Scaling Enterprises
          </h2>
          <p className="mt-4 text-base leading-6 text-obligon-text">
            Choose a plan that matches your fleet&apos;s complexity and geographical footprint.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <div className="flex rounded-full border border-[#e5e7eb] bg-[#f3f4f6] p-[5px]">
            <button
              type="button"
              onClick={() => setTab("individual")}
              className={`h-[42px] rounded-full px-8 text-sm font-semibold transition ${
                tab === "individual"
                  ? "border border-[#e5e7eb] bg-white text-[#060b19] shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
                  : "text-[#4b5563]"
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setTab("organization")}
              className={`h-[42px] rounded-full px-8 text-sm font-semibold transition ${
                tab === "organization"
                  ? "border border-[#e5e7eb] bg-white text-[#060b19] shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
                  : "text-[#4b5563]"
              }`}
            >
              Organization
            </button>
          </div>
        </div>

        <div
          className={`mt-[52px] grid min-w-0 gap-5 lg:items-start ${
            plans.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
          }`}
        >
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex min-h-[384px] min-w-0 flex-col rounded-3xl p-8 ${
                plan.dark
                  ? "border border-obligon-blue bg-obligon-blue text-white"
                  : plan.recommended
                    ? "z-10 -mt-2 border-2 border-obligon-green bg-white text-obligon-navy shadow-card lg:scale-105"
                    : "border border-obligon-border bg-white text-obligon-navy"
              }`}
            >
              {plan.recommended ? (
                <div className="absolute right-0 top-0 rounded-tr-[22px] bg-obligon-green px-4 py-1 text-[10px] font-bold uppercase leading-[15px] text-white">
                  Recommended
                </div>
              ) : null}

              <p
                className={`text-xs font-bold uppercase tracking-[1.2px] ${
                  plan.dark ? "text-obligon-lime" : plan.recommended ? "text-obligon-green" : "text-obligon-text"
                }`}
              >
                {plan.name}
              </p>

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

              <ul className="mt-8 space-y-3.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature.label}
                    className={`flex items-start gap-3 text-sm leading-5 ${
                      !feature.enabled
                        ? plan.dark
                          ? "text-white/40"
                          : "text-obligon-text/50"
                        : plan.dark
                          ? "text-white/80"
                          : plan.recommended
                            ? "font-medium text-obligon-navy"
                            : "text-obligon-text"
                    }`}
                  >
                    {feature.enabled ? (
                      <Image
                        src={plan.dark ? assets.checkGreen : assets.checkLarge}
                        width={10}
                        height={20}
                        alt=""
                        className="shrink-0"
                      />
                    ) : (
                      <>
                        <span
                          aria-hidden="true"
                          className="inline-flex w-[10px] shrink-0 translate-y-[3px] justify-center text-xs"
                        >
                          &mdash;
                        </span>
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
                href="/auth/signup"
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
