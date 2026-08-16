"use client";

import Image from "next/image";
import { useState } from "react";
import { assets } from "./assets";

const organizationPlans = [
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

const individualPlans = [
  {
    name: "Pay As You Go",
    price: "0",
    suffix: "setup",
    features: ["No monthly fee", "Pay only for fuel used", "Access to 850+ stations"],
    cta: "Start Free"
  },
  {
    name: "Personal",
    price: "75k",
    suffix: "/year",
    features: ["1 Vehicle", "Monthly statements", "200 Partner Stations"],
    cta: "Go Personal",
    recommended: true
  },
  {
    name: "Pro Driver",
    price: "120k",
    suffix: "/year",
    features: ["Up to 3 Vehicles", "Fuel spend alerts", "500 Partner Stations"],
    cta: "Go Pro"
  },
  {
    name: "Family Fleet",
    price: "Custom",
    features: ["Up to 10 Vehicles", "Shared wallet", "Full Network Access"],
    cta: "Custom Quote",
    dark: true
  }
];

export function Pricing() {
  const [tab, setTab] = useState<"individual" | "organization">("individual");
  const plans = tab === "individual" ? individualPlans : organizationPlans;

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

        <div className="mt-[52px] grid min-w-0 gap-5 lg:grid-cols-4 lg:items-start">
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

              <ul className="mt-8 space-y-4">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className={`flex items-center gap-3 text-sm leading-5 ${
                      plan.dark ? "text-white/80" : plan.recommended ? "font-medium text-obligon-navy" : "text-obligon-text"
                    }`}
                  >
                    <Image src={plan.dark ? assets.checkGreen : assets.checkLarge} width={10} height={20} alt="" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#get-started"
                className={`mt-auto inline-flex h-14 items-center justify-center rounded-lg px-6 text-base font-bold ${
                  plan.dark
                    ? "bg-white text-obligon-navy"
                    : plan.recommended
                      ? "bg-obligon-green text-white"
                      : "border border-obligon-navy text-obligon-navy"
                }`}
              >
                {plan.cta}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
