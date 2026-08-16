"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Check, ShieldCheck } from "lucide-react";
import { Input } from "@/components/site/Input";
import { routes } from "@/components/site/routes";

type SignupRole = "customer" | "partner" | "company";

const signupFields: Record<SignupRole, Array<{ label: string; name: string; placeholder: string; type?: string }>> = {
  customer: [
    { label: "Full Name", name: "fullName", placeholder: "Ada Okafor" },
    { label: "Email Address", name: "email", placeholder: "ada@example.com", type: "email" },
    { label: "Phone Number", name: "phone", placeholder: "+234 801 000 0000" },
    { label: "Primary City", name: "city", placeholder: "Lagos" }
  ],
  partner: [
    { label: "Station Name", name: "station", placeholder: "Mainland Energy Station" },
    { label: "Primary Location", name: "location", placeholder: "Ikeja, Lagos" },
    { label: "Contact Person", name: "contact", placeholder: "James Adenuga" },
    { label: "Phone Number", name: "phone", placeholder: "+234 801 000 0000" },
    { label: "Email Address", name: "email", placeholder: "ops@station.ng", type: "email" },
    { label: "License / CAC Number", name: "license", placeholder: "RC 1234567" }
  ],
  company: [
    { label: "Company Legal Name", name: "company", placeholder: "Northline Logistics Ltd" },
    { label: "Work Email", name: "email", placeholder: "procurement@company.ng", type: "email" },
    { label: "Fleet Size", name: "fleet", placeholder: "120 vehicles" },
    { label: "Monthly Fuel Volume", name: "volume", placeholder: "85,000 litres" },
    { label: "Operating States", name: "states", placeholder: "Lagos, Ogun, Abuja" },
    { label: "Procurement Lead", name: "lead", placeholder: "Mariam Bello" }
  ]
};

const roleLabels: Record<SignupRole, string> = {
  customer: "Customer",
  partner: "Partner",
  company: "Company"
};

export function AuthForms() {
  const router = useRouter();
  const [role, setRole] = React.useState<SignupRole>("customer");

  function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(routes.authInProgress);
  }

  function submitSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(routes.authSuccess);
  }

  return (
    <div className="mx-auto grid max-w-[820px] gap-8 xl:grid-cols-[380px_1fr]">
      <form onSubmit={submitLogin} className="rounded-2xl border border-obligon-border bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Partner Login</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-obligon-navy">Secure access</h2>
          </div>
          <ShieldCheck className="text-obligon-green" size={28} />
        </div>
        <div className="mt-6 space-y-4">
          <Input label="Corporate Email" name="loginEmail" placeholder="james@enterprise.ng" type="email" />
          <Input label="Password" name="password" placeholder="Enter password" type="password" />
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <label className="inline-flex items-center gap-2 text-obligon-text">
            <input className="size-4 accent-obligon-green" type="checkbox" />
            Remember me
          </label>
          <Link href={routes.forgotPassword} className="font-bold text-obligon-green">
            Forgot?
          </Link>
        </div>
        <button className="mt-6 h-12 w-full rounded-lg bg-obligon-green text-base font-bold text-white shadow-green" type="submit">
          Secure Login
        </button>
      </form>

      <form id="signup" onSubmit={submitSignup} className="rounded-2xl border border-obligon-border bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Apply to Join</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-obligon-navy">Create an Obligon account</h2>
            <p className="mt-2 text-sm leading-5 text-obligon-text">Choose your account type and complete the matching verification details.</p>
          </div>
          <span className="rounded-full bg-obligon-lime px-3 py-1 text-[10px] font-extrabold uppercase tracking-[1px] text-[#131f00]">
            New Partner
          </span>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 rounded-full bg-[#eef1fb] p-1">
          {(Object.keys(roleLabels) as SignupRole[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRole(key)}
              className={`h-10 rounded-full text-xs font-bold transition sm:text-sm ${
                role === key ? "bg-white text-obligon-green shadow-sm" : "text-obligon-text hover:text-obligon-navy"
              }`}
            >
              {roleLabels[key]}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {signupFields[role].map((field) => (
            <Input key={field.name} {...field} />
          ))}
        </div>

        {role === "partner" ? (
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Available Fuel Type</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["PMS Petrol", "AGO Diesel", "DPK Kerosene", "LPG Gas"].map((item, index) => (
                <button
                  key={item}
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${
                    index < 2
                      ? "border-obligon-green bg-obligon-green/10 text-obligon-green"
                      : "border-obligon-border bg-white text-obligon-text"
                  }`}
                >
                  {index < 2 ? <Check size={14} /> : null}
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <button className="mt-6 h-12 w-full rounded-lg bg-obligon-navy text-base font-bold text-white" type="submit">
          Submit {roleLabels[role]} Application
        </button>
      </form>

      <div className="rounded-2xl border border-obligon-border bg-white p-6 xl:col-span-2">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-text">Application Tracker</p>
            <p className="mt-2 text-sm text-obligon-text">Last update: 2 mins ago</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {["Submitted", "Under Review", "Approved"].map((step, index) => (
              <span
                key={step}
                className={`rounded-full px-3 py-2 text-xs font-bold ${
                  index < 2 ? "bg-obligon-green/10 text-obligon-green" : "bg-[#eef1fb] text-obligon-text"
                }`}
              >
                {step}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-5 rounded-xl bg-obligon-panel p-4 text-sm leading-6 text-obligon-text">
          A regional field officer will verify GPS coordinates, pump capacity, and onboarding documents. Typical review
          time is 2-3 business days.
        </p>
      </div>
    </div>
  );
}
