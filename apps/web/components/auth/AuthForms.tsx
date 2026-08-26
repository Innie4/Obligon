"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Check, Eye, EyeOff, ShieldCheck, Loader2, AlertCircle, Mail, User, Lock, AlertTriangle } from "lucide-react";
import { Input } from "@/components/site/Input";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";
import { useSession } from "@/components/shared/AuthContext";

type SignupRole = "customer" | "partner" | "company";

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

export function AuthForms() {
  const router = useRouter();
  const { login } = useSession();
  const { error: toastError, success: toastSuccess } = useToast();

  // Login state
  const [loginForm, setLoginForm] = React.useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [loginErrors, setLoginErrors] = React.useState<Record<string, string>>({});
  const [loginSubmitting, setLoginSubmitting] = React.useState(false);
  const [loginServerError, setLoginServerError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  // Signup state
  const [role, setRole] = React.useState<SignupRole>("customer");
  const [signupForm, setSignupForm] = React.useState<Record<string, string>>({});
  const [signupErrors, setSignupErrors] = React.useState<Record<string, string>>({});
  const [signupSubmitting, setSignupSubmitting] = React.useState(false);
  const [signupServerError, setSignupServerError] = React.useState<string | null>(null);
  const [showSignupPassword, setShowSignupPassword] = React.useState(false);
  const [selectedFuelTypes, setSelectedFuelTypes] = React.useState<string[]>(["PMS Petrol", "AGO Diesel"]);
  const [fuelError, setFuelError] = React.useState(false);

  // Remember Me persistence
  React.useEffect(() => {
    const remembered = localStorage.getItem("obligon_remember_me");
    if (remembered) {
      try {
        const { email, password } = JSON.parse(remembered);
        setLoginForm((prev) => ({ ...prev, email, password, rememberMe: true }));
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

  // Login validation
  const validateLogin = (): boolean => {
    const errors: Record<string, string> = {};
    const emailErr = validateEmail(loginForm.email);
    if (emailErr) errors.email = emailErr;
    if (!loginForm.password) errors.password = "Password is required";
    else if (loginForm.password.length < 8) errors.password = "Password must be at least 8 characters";
    setLoginErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLoginChange = (name: string, value: string) => {
    setLoginForm((prev) => ({ ...prev, [name]: value }));
    if (loginErrors[name]) setLoginErrors((prev) => ({ ...prev, [name]: "" }));
    if (loginServerError) setLoginServerError(null);
  };

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateLogin()) return;

    setLoginSubmitting(true);
    setLoginServerError(null);

    try {
      await login({ email: loginForm.email, password: loginForm.password, role: "customer" });
      persistRememberMe(loginForm.email, loginForm.password, loginForm.rememberMe);
      toastSuccess("Welcome back!");
      router.push(routes.customerDashboard);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid credentials. Please try again.";
      setLoginServerError(message);
      toastError(message);
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Signup validation
  const validateSignup = (): boolean => {
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

    if (role === "partner") {
      if (selectedFuelTypes.length === 0) {
        errors.fuelTypes = "Select at least one fuel type";
        setFuelError(true);
      }
    }

    setSignupErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignupChange = (name: string, value: string) => {
    setSignupForm((prev) => ({ ...prev, [name]: value }));
    if (signupErrors[name]) setSignupErrors((prev) => ({ ...prev, [name]: "" }));
    if (signupServerError) setSignupServerError(null);
  };

  const toggleFuelType = (fuelType: string) => {
    setSelectedFuelTypes((current) =>
      current.includes(fuelType) ? current.filter((item) => item !== fuelType) : [...current, fuelType]
    );
    setFuelError(false);
  };

  const handleSignupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateSignup()) return;

    setSignupSubmitting(true);
    setSignupServerError(null);

    try {
      // In a real app, this would call an API endpoint
      // await api.signup({ ...signupForm, role, fuelTypes: selectedFuelTypes });
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

  const handleRoleChange = (newRole: SignupRole) => {
    setRole(newRole);
    setFuelError(false);
    setSignupForm({});
    setSignupErrors({});
    setSignupServerError(null);
  };

  const isLoginDisabled = loginSubmitting || !loginForm.email || !loginForm.password;
  const isSignupDisabled = signupSubmitting || Object.keys(signupForm).length === 0;

  return (
    <div className="mx-auto grid max-w-[820px] gap-8 xl:grid-cols-[380px_1fr]">
      {/* Login Form */}
      <form onSubmit={handleLoginSubmit} className="rounded-2xl border border-obligon-border bg-white p-6 shadow-card" noValidate>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Customer Login</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-obligon-navy">Welcome back</h2>
          </div>
          <ShieldCheck className="text-obligon-green" size={28} />
        </div>

        {loginServerError && (
          <div className="mt-4 rounded-lg bg-[#fff0f0] border border-[#fecaca] p-3 text-sm text-[#93000a] flex items-start gap-2" role="alert">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{loginServerError}</span>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div className="relative">
            <label htmlFor="login-email" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
              Corporate Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-obligon-text/50" aria-hidden="true" />
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="james@enterprise.ng"
                value={loginForm.email}
                onChange={(e) => handleLoginChange("email", e.target.value)}
                className={`h-12 w-full rounded-lg border px-4 pl-10 pr-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 ${
                  loginErrors.email ? "border-[#fecaca] bg-[#fff0f0]" : "border-obligon-border bg-white"
                }`}
                required
                autoComplete="email"
                disabled={loginSubmitting}
                aria-invalid={!!loginErrors.email}
                aria-describedby={loginErrors.email ? "login-email-error" : undefined}
              />
              {loginErrors.email && (
                <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#fca5a5]" aria-hidden="true" />
              )}
            </div>
            {loginErrors.email && (
              <p id="login-email-error" className="mt-1 text-xs font-medium text-[#93000a]" role="alert">{loginErrors.email}</p>
            )}
          </div>

          <div className="relative">
            <label htmlFor="login-password" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-obligon-text/50" aria-hidden="true" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={loginForm.password}
                onChange={(e) => handleLoginChange("password", e.target.value)}
                className={`h-12 w-full rounded-lg border px-4 pl-10 pr-12 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 ${
                  loginErrors.password ? "border-[#fecaca] bg-[#fff0f0]" : "border-obligon-border bg-white"
                }`}
                required
                autoComplete="current-password"
                disabled={loginSubmitting}
                aria-invalid={!!loginErrors.password}
                aria-describedby={loginErrors.password ? "login-password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-obligon-text transition hover:bg-obligon-mist hover:text-obligon-navy"
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loginSubmitting}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              {loginErrors.password && (
                <AlertCircle className="absolute right-10 top-1/2 -translate-y-1/2 size-5 text-[#fca5a5]" aria-hidden="true" />
              )}
            </div>
            {loginErrors.password && (
              <p id="login-password-error" className="mt-1 text-xs font-medium text-[#93000a]" role="alert">{loginErrors.password}</p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <label className="inline-flex items-center gap-2 text-obligon-text cursor-pointer">
              <input
                type="checkbox"
                name="rememberMe"
                checked={loginForm.rememberMe}
                onChange={(e) => handleLoginChange("rememberMe", String(e.target.checked))}
                className="size-4 accent-obligon-green"
                disabled={loginSubmitting}
              />
              <span>Remember me</span>
            </label>
            <Link href={routes.forgotPassword} className="font-bold text-obligon-green hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className={`mt-6 h-12 w-full rounded-lg text-base font-bold text-white shadow-green transition ${
              isLoginDisabled ? "bg-obligon-green/50 cursor-not-allowed" : "bg-obligon-green hover:bg-obligon-green/90"
            }`}
            disabled={isLoginDisabled}
          >
            {loginSubmitting ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              "Secure Login"
            )}
          </button>
        </div>
      </form>

      {/* Signup Form */}
      <form id="signup" onSubmit={handleSignupSubmit} className="rounded-2xl border border-obligon-border bg-white p-6 shadow-card" noValidate>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Apply to Join</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-obligon-navy">Create an Obligon LTD account</h2>
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

        {signupServerError && (
          <div className="mt-4 rounded-lg bg-[#fff0f0] border border-[#fecaca] p-3 text-sm text-[#93000a] flex items-start gap-2" role="alert">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{signupServerError}</span>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {signupFields[role].map((field) => (
            <div key={field.name} className="relative">
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
                className={`h-12 w-full rounded-lg border px-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 ${
                  signupErrors[field.name] ? "border-[#fecaca] bg-[#fff0f0]" : "border-obligon-border bg-white"
                }`}
                required={field.required ?? true}
                disabled={signupSubmitting}
                aria-invalid={!!signupErrors[field.name]}
                aria-describedby={signupErrors[field.name] ? `signup-${field.name}-error` : undefined}
              />
              {signupErrors[field.name] && (
                <>
                  <AlertCircle className="absolute right-3 top-[37px] size-5 text-[#fca5a5]" aria-hidden="true" />
                  <p id={`signup-${field.name}-error`} className="mt-1 text-xs font-medium text-[#93000a]" role="alert">{signupErrors[field.name]}</p>
                </>
              )}
            </div>
          ))}
        </div>

        {role === "partner" ? (
          <div className="mt-5">
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
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${
                      selected
                        ? "border-obligon-green bg-obligon-green/10 text-obligon-green"
                        : "border-obligon-border bg-white text-obligon-text hover:border-obligon-green hover:text-obligon-green"
                    }`}
                    disabled={signupSubmitting}
                  >
                    {selected ? <Check size={14} /> : null}
                    {item}
                  </button>
                );
              })}
            </div>
            {selectedFuelTypes.map((fuelType) => (
              <input key={fuelType} type="hidden" name="fuelTypes" value={fuelType} />
            ))}
            {fuelError || signupErrors.fuelTypes ? (
              <p className="mt-2 text-xs font-semibold text-[#93000a]" role="alert">
                {signupErrors.fuelTypes ?? "Select at least one available fuel type before submitting a partner application."}
              </p>
            ) : null}
          </div>
        ) : null}

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
              <Loader2 size={18} className="mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            `Submit ${roleLabels[role]} Application`
          )}
        </button>
      </form>

      {/* Application Tracker */}
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