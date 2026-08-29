"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/components/shared/Toast";
import { useSession } from "@/components/shared/AuthContext";
import { Input } from "@/components/site/Input";
import { routes } from "@/components/site/routes";
import { AuthShell } from "@/components/auth/AuthShell";

type SignupRole = "customer" | "partner" | "company";

type PartnerType = "mechanic" | "fuel-station" | "other";

const signupFields: Record<SignupRole, Array<{ label: string; name: string; placeholder: string; type?: string; required?: boolean }>> = {
  customer: [
    { label: "Full Name", name: "fullName", placeholder: "Ada Okafor", required: true },
    { label: "Email Address", name: "email", placeholder: "ada@example.com", type: "email", required: true },
    { label: "Phone Number", name: "phone", placeholder: "+234 801 000 0000", required: true },
    { label: "Primary City", name: "city", placeholder: "Lagos", required: true },
  ],
  partner: [
    { label: "Station Name", name: "station", placeholder: "Mainland Energy Station", required: true },
    { label: "Primary Location", name: "location", placeholder: "Ikeja, Lagos", required: true },
    { label: "Contact Person", name: "contact", placeholder: "James Adenuga", required: true },
    { label: "Phone Number", name: "phone", placeholder: "+234 801 000 0000", required: true },
    { label: "Email Address", name: "email", placeholder: "ops@station.ng", type: "email", required: true },
    { label: "License / CAC Number", name: "license", placeholder: "RC 1234567", required: true },
  ],
  company: [
    { label: "Company Legal Name", name: "company", placeholder: "Northline Logistics Ltd", required: true },
    { label: "Work Email", name: "email", placeholder: "procurement@company.ng", type: "email", required: true },
    { label: "Fleet Size", name: "fleet", placeholder: "120 vehicles", required: true },
    { label: "Monthly Fuel Volume", name: "volume", placeholder: "85,000 litres", required: true },
    { label: "Operating States", name: "states", placeholder: "Lagos, Ogun, Abuja", required: true },
    { label: "Procurement Lead", name: "lead", placeholder: "Mariam Bello", required: true },
  ],
};

const roleLabels: Record<SignupRole, string> = {
  customer: "Customer",
  partner: "Partner",
  company: "Company",
};

const partnerTypeLabels: Record<PartnerType, string> = {
  mechanic: "Mechanic",
  "fuel-station": "Fuel Station",
  other: "Other",
};

const fuelTypes = ["PMS Petrol", "AGO Diesel", "DPK Kerosene", "LPG Gas"];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[\d\s-]{10,}$/;

function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  if (!emailRegex.test(email)) return "Enter a valid email address";
  return null;
}

function validatePhone(phone: string): string | null {
  if (!phone) return "Phone number is required";
  if (!phoneRegex.test(phone.replace(/\s/g, ""))) return "Enter a valid phone number";
  return null;
}

function validateRequired(value: string, fieldName: string): string | null {
  if (!value.trim()) return `${fieldName} is required`;
  return null;
}

export default function SignupPage() {
  const router = useRouter();
  const { error: toastError, success: toastSuccess } = useToast();
  const { status, user, login } = useSession();

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      router.push(routes.customerDashboard);
    }
  }, [user, router]);

  const [role, setRole] = useState<SignupRole>("customer");
  const [partnerType, setPartnerType] = useState<PartnerType | null>(null);
  const [signupForm, setSignupForm] = useState<Record<string, string>>({});
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [signupServerError, setSignupServerError] = useState<string | null>(null);
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>(["PMS Petrol", "AGO Diesel"]);
  const [fuelError, setFuelError] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [mechanicError, setMechanicError] = useState(false);

  // Remember Me persistence
  useEffect(() => {
    const remembered = localStorage.getItem("obligon_remember_me");
    if (remembered) {
      try {
        const { email, password } = JSON.parse(remembered);
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const persistRememberMe = (email: string, password: string, remember: boolean) => {
    if (remember) {
      localStorage.setItem("obligon_remember_me", JSON.stringify({ email, password }));
    } else {
      localStorage.removeItem("obligon_remember_me");
    }
  };

  // Role validation helper
  const validateRole = (): boolean => {
    const errors: Record<string, string> = {};
    const fields = signupFields[role];
    fields.forEach((field) => {
      const value = signupForm[field.name] ?? "";
      const err = field.required ? validateRequired(value, field.label) : null;
      if (err) errors[field.name] = err;
      else if (field.type === "email" && value && !emailRegex.test(value)) {
        errors[field.name] = "Enter a valid email address";
      }
    });

    // Partner fuel type validation
    if (role === "partner") {
      if (selectedFuelTypes.length === 0) {
        errors.fuelTypes = "Select at least one fuel type";
        setFuelError(true);
      }
    }

    setSignupErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form changes
  const handleSignupChange = (name: string, value: string) => {
    setSignupForm((prev) => ({ ...prev, [name]: value }));
    if (signupErrors[name]) setSignupErrors((prev) => ({ ...prev, [name]: "" }));
    if (signupServerError) setSignupServerError(null);
  };

  // Toggle fuel type for partner
  const toggleFuelType = (fuelType: string) => {
    setSelectedFuelTypes((current) =>
      current.includes(fuelType) ? current.filter((item) => item !== fuelType) : [...current, fuelType]
    );
    setFuelError(false);
  };

  // Toggle service for mechanic partner
  const toggleService = (service: string) => {
    setSelectedServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service]
    );
    setMechanicError(false);
  };

  // Handle signup submission
  const handleSignupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateRole()) return;

    setSignupSubmitting(true);
    setSignupServerError(null);

    try {
      // In a real app, this would call an API endpoint
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call

      toastSuccess(`${roleLabels[role]} application submitted successfully!`);

      if (role === "partner") {
        router.push(routes.authInProgress);
      } else if (role === "customer") {
        router.push(`${routes.authSuccess}?redirect=${encodeURIComponent(routes.customerDashboard)}`);
      } else {
        router.push(routes.authSuccess);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Application failed. Please try again.";
      setSignupServerError(message);
      toastError(message);
    } finally {
      setSignupSubmitting(false);
    }
  };

  // Handle role change
  const handleRoleChange = (newRole: SignupRole) => {
    setRole(newRole);
    setFuelError(false);
    setSignupForm({});
    setSignupErrors({});
    setSignupServerError(null);
    setSelectedFuelTypes(["PMS Petrol", "AGO Diesel"]);
  };

  // Handle partner type change
  const handlePartnerTypeChange = (newPartnerType: PartnerType) => {
    setPartnerType(newPartnerType);
    setSignupForm({});
    setSignupErrors({});
    setSignupServerError(null);
    setSelectedFuelTypes(["PMS Petrol", "AGO Diesel"]);
    setSelectedServices([]);
  };

  const isSignupDisabled = signupSubmitting || Object.keys(signupForm).length === 0;

  return (
    <AuthShell>
      <div className="w-full max-w-[480px] mx-auto p-8">
        <div className="rounded-2xl border border-obligon-border bg-white p-8 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Apply to Join</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-obligon-navy">Create an Obligon LTD account</h2>
              <p className="mt-2 text-sm leading-5 text-obligon-text">Choose your account type and complete the matching verification details.</p>
            </div>
            <span className="rounded-full bg-obligon-lime px-3 py-1 text-[10px] font-extrabold uppercase tracking-[1px] text-[#131f00]">
              New Partner
            </span>
          </div>

          {signupServerError && (
            <div className="mt-4 rounded-lg bg-[#fff0f0] border border-[#fecaca] p-3 text-sm text-[#93000a] flex items-start gap-2" role="alert">
              <span>{signupServerError}</span>
            </div>
          )}

          <form id="signup" onSubmit={handleSignupSubmit} className="mt-8 space-y-4" noValidate>
            <div className="mt-6 grid gap-2 rounded-full bg-[#eef1fb] p-1">
              {(Object.keys(roleLabels) as SignupRole[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleRoleChange(key)}
                  className={`h-10 rounded-full text-xs font-bold transition sm:text-sm ${
                    role === key ? "bg-white text-obligon-green shadow-sm" : "text-obligon-text hover:text-obligon-navy"
                  }`}
                  disabled={signupSubmitting}
                >
                  {roleLabels[key]}
                </button>
              ))}
            </div>

            {role === "partner" && partnerType === null ? (
              <div className="mt-5">
                <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Partner Type</p>
                <div className="mt-3 grid gap-2">
                  {["mechanic", "fuel-station", "other"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handlePartnerTypeChange(type as PartnerType)}
                      className={`h-10 rounded-full text-xs font-bold transition sm:text-sm ${partnerType === type ? "bg-white text-obligon-green shadow-sm" : "text-obligon-text hover:text-obligon-navy"}`}
                      disabled={signupSubmitting}
                    >
                      {partnerTypeLabels[type as PartnerType]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {role === "partner" ? (
              <div className="mt-5">
                {partnerType === "mechanic" ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Primary Services</p>
                    <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text mt-2">Secondary Services</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {["Engine Repair & Maintenance", "Electrical & Diagnostics", "Brake Service", "Tire Service"].map((service) => (
                        <div
                          key={service}
                          onClick={() => toggleService(service)}
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${selectedServices.includes(service) ? "border-obligon-green bg-obligon-green/10 text-obligon-green" : "border-obligon-border bg-white text-obligon-text hover:border-obligon-green hover:text-obligon-green"}`}
                        >
                          {selectedServices.includes(service) && <span className="size-4" />}
                          {service}
                        </div>
                      ))}
                      {["AC Repair", "Transmission Service", "Electrical Wiring", "Painting"].map((service) => (
                        <div
                          key={service}
                          style={{ opacity: 0.5, cursor: "not-allowed" }}
                          className="mt-2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition disabled:bg-white disabled:text-obligon-text"
                        >
                          {selectedServices.includes(service) && <span className="size-4" />}
                          {service}
                        </div>
                      ))}
                    </div>
                    {selectedServices.map((service) => (
                      <input key={service} type="hidden" name="services" value={service} />
                    ))}
                    {mechanicError && (
                      <p className="mt-2 text-xs font-semibold text-[#93000a]" role="alert">
                        Select at least one service before submitting a mechanic application.
                      </p>
                    )}
                  </div>
                ) : null}

                {partnerType === "fuel-station" ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Available Fuel Type</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {fuelTypes.map((item) => {
                        const selected = selectedFuelTypes.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleFuelType(item)}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${selected ? "border-obligon-green bg-obligon-green/10 text-obligon-green" : "border-obligon-border bg-white text-obligon-text hover:border-obligon-green hover:text-obligon-green"}`}
                            disabled={signupSubmitting}
                          >
                            {selected && <span className="size-4" />}
                            {item}
                          </button>
                        );
                      })}
                    </div>
                    {selectedFuelTypes.map((fuelType) => (
                      <input key={fuelType} type="hidden" name="fuelTypes" value={fuelType} />
                    ))}
                    {fuelError && (
                      <p className="mt-2 text-xs font-semibold text-[#93000a]" role="alert">
                        Select at least one available fuel type before submitting a fuel station application.
                      </p>
                    )}
                  </div>
                ) : null}

                {partnerType === "other" ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Organization Description</p>
                    <div className="mt-3">
                      <input
                        type="text"
                        name="description"
                        placeholder="Describe your organization..."
                        value={signupForm.description ?? ""}
                        onChange={(e) => handleSignupChange("description", e.target.value)}
                        className="h-12 w-full rounded-lg border px-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                        required={true}
                      />
                      {signupErrors.description && (
                        <p className="mt-1 text-xs font-medium text-[#93000a]" role="alert">{signupErrors.description}</p>
                      )}
                    </div>
                  </div>
                ) : null}

                {signupFields.partner.map((field) => (
                  <div key={field.name} className="mt-5 relative">
                    <label htmlFor={`signup-${field.name}`} className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                      {field.label}
                    </label>
                    <input
                      id={`signup-${field.name}`}
                      name={field.name}
                      type={field.type ?? "text"}
                      placeholder={field.placeholder}
                      value={signupForm[field.name] ?? ""}
                      onChange={(e) => handleSignupChange(field.name, e.target.value)}
                      className="h-12 w-full rounded-lg border px-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                      required={field.required ?? true}
                      disabled={signupSubmitting}
                      aria-invalid={!!signupErrors[field.name]}
                      aria-describedby={signupErrors[field.name] ? `signup-${field.name}-error` : undefined}
                    />
                    {signupErrors[field.name] && (
                      <>
                        <span className="absolute right-3 top-[37px] size-5 text-[#fca5a5]" aria-hidden="true" />
                        <p id={`signup-${field.name}-error`} className="mt-1 text-xs font-medium text-[#93000a]" role="alert">{signupErrors[field.name]}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-8">
              <button
                type="submit"
                className={`mt-6 h-12 w-full rounded-lg text-base font-bold text-white transition ${
                  isSignupDisabled
                    ? "bg-obligon-navy/50 cursor-not-allowed"
                    : "bg-obligon-navy hover:bg-obligon-navy/90"
                }`}
                disabled={isSignupDisabled}
              >
                {signupSubmitting ? (
                  <>
                    <span className="mr-2 animate-spin size-18" />
                    Submitting...
                  </>
                ) : `Submit ${roleLabels[role]} Application`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AuthShell>
  );
}