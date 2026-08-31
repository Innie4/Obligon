"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Check, Eye, EyeOff, ShieldCheck, Loader2, AlertCircle, Mail, Lock, AlertTriangle, ChevronDown, Building2, User, Fuel, Wrench } from "lucide-react";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";
import { useSession } from "@/components/shared/AuthContext";
import { readRememberedEmail, writeRememberedEmail } from "@/lib/session-store";
import type { UserRole } from "@/lib/services/types";

export type AuthFormMode = "login" | "signup";
type SignupRole = "customer" | "company" | "fuelStation" | "mechanic";

const signupFields: Record<SignupRole, Array<{ label: string; name: string; placeholder: string; type?: string; required?: boolean }>> = {
  customer: [
    { label: "Full Name", name: "name", placeholder: "Adaora Emeka", required: true },
    { label: "Phone Number", name: "phone", placeholder: "+234 801 234 5678", required: true },
    { label: "Email Address", name: "email", placeholder: "adaora@gmail.com", type: "email", required: true },
    { label: "City / State", name: "location", placeholder: "Lagos, Nigeria", required: true },
  ],
  company: [
    { label: "Company / Fleet Name", name: "company", placeholder: "Apex Logistics Ltd", required: true },
    { label: "Fleet Size (Est. Vehicles)", name: "fleetSize", placeholder: "25", required: true },
    { label: "Contact Person", name: "contact", placeholder: "James Adenuga", required: true },
    { label: "Phone Number", name: "phone", placeholder: "+234 802 345 6789", required: true },
    { label: "Work Email Address", name: "email", placeholder: "james@apexlogistics.ng", type: "email", required: true },
    { label: "CAC Registration Number", name: "license", placeholder: "RC 9876543", required: true },
  ],
  fuelStation: [
    { label: "Station Brand / Name", name: "station", placeholder: "Mainland Energy Station", required: true },
    { label: "Primary Location", name: "location", placeholder: "Ikeja, Lagos", required: true },
    { label: "Station Manager Name", name: "contact", placeholder: "Tunde Bakare", required: true },
    { label: "Phone Number", name: "phone", placeholder: "+234 803 456 7890", required: true },
    { label: "Email Address", name: "email", placeholder: "ops@mainlandenergy.ng", type: "email", required: true },
    { label: "DPR / License Number", name: "license", placeholder: "DPR-NG-2024-884", required: true },
  ],
  mechanic: [
    { label: "Workshop / Service Center Name", name: "workshop", placeholder: "Ade Auto Clinic", required: true },
    { label: "Service Coverage Area", name: "location", placeholder: "Lekki-Epe Expressway, Lagos", required: true },
    { label: "Lead Technician Name", name: "contact", placeholder: "Ade Balogun", required: true },
    { label: "Phone Number", name: "phone", placeholder: "+234 804 567 8901", required: true },
    { label: "Email Address", name: "email", placeholder: "service@adeauto.ng", type: "email", required: true },
    { label: "Certification / CAC Number", name: "license", placeholder: "MECH-20458", required: true },
  ],
};

const roleLabels: Record<SignupRole, string> = {
  customer: "Customer / Driver",
  company: "Fleet Enterprise",
  fuelStation: "Partner Station",
  mechanic: "Roadside & Mechanic",
};

const fuelTypes = ["PMS Petrol", "AGO Diesel", "DPK Kerosene", "CNG Compressed Gas", "EV Charging"];
const mechanicServices = ["Diagnostics", "Engine Repair", "Brake Service", "Tyres & Alignment", "Electrical", "Emergency Towing"];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[\d\s-]{10,}$/;

const fieldClass = (invalid: boolean) =>
  `h-12 w-full rounded-lg border px-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 ${
    invalid ? "border-[#fecaca] bg-[#fff0f0]" : "border-obligon-border bg-white"
  }`;

function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  if (!emailRegex.test(email)) return "Enter a valid email address";
  return null;
}

function validateRequired(value: string, fieldName: string): string | null {
  if (!value.trim()) return `${fieldName} is required`;
  return null;
}

function LoginForm() {
  const router = useRouter();
  const { login, status, user } = useSession();
  const { error: toastError, success: toastSuccess } = useToast();

  const [selectedRole, setSelectedRole] = React.useState<UserRole>("customer");
  const [loginForm, setLoginForm] = React.useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [loginErrors, setLoginErrors] = React.useState<Record<string, string>>({});
  const [loginSubmitting, setLoginSubmitting] = React.useState(false);
  const [loginServerError, setLoginServerError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  React.useEffect(() => {
    const remembered = readRememberedEmail();
    if (remembered) {
      setLoginForm((prev) => ({ ...prev, email: remembered, rememberMe: true }));
    }
  }, []);

  const validateLogin = (): boolean => {
    const errors: Record<string, string> = {};
    const emailErr = validateEmail(loginForm.email);
    if (emailErr) errors.email = emailErr;
    if (!loginForm.password) errors.password = "Password is required";
    else if (loginForm.password.length < 8) errors.password = "Password must be at least 8 characters";
    setLoginErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLoginChange = (name: "email" | "password", value: string) => {
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
      await login({ email: loginForm.email, password: loginForm.password, role: selectedRole });
      writeRememberedEmail(loginForm.email, loginForm.rememberMe);
      toastSuccess(`Welcome back! Logged in as ${selectedRole}.`);

      const destination =
        selectedRole === "admin"
          ? routes.adminDashboard
          : selectedRole === "company"
            ? routes.companyDashboard
            : selectedRole === "partner"
              ? routes.dashboard
              : routes.customerDashboard;

      router.push(destination);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid credentials. Please try again.";
      setLoginServerError(message);
      toastError(message);
    } finally {
      setLoginSubmitting(false);
    }
  };

  const isLoginDisabled = loginSubmitting || !loginForm.email || !loginForm.password;

  return (
    <form onSubmit={handleLoginSubmit} className="mx-auto w-full max-w-[460px] rounded-2xl border border-obligon-border bg-white p-6 sm:p-8 shadow-card" noValidate>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Access Portal</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-obligon-navy">Welcome back</h2>
        </div>
        <ShieldCheck className="text-obligon-green" size={28} />
      </div>

      {status === "authenticated" && user ? (
        <div className="mt-4 rounded-lg border border-obligon-border bg-obligon-mist p-3 text-sm text-obligon-text">
          Active session as <strong>{user.email}</strong> ({user.role}).{" "}
          <Link
            href={
              user.role === "admin"
                ? routes.adminDashboard
                : user.role === "company"
                  ? routes.companyDashboard
                  : user.role === "partner"
                    ? routes.dashboard
                    : routes.customerDashboard
            }
            className="font-bold text-obligon-green hover:underline"
          >
            Go to dashboard →
          </Link>
        </div>
      ) : null}

      {loginServerError && (
        <div className="mt-4 rounded-lg bg-[#fff0f0] border border-[#fecaca] p-3 text-sm text-[#93000a] flex items-start gap-2" role="alert">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{loginServerError}</span>
        </div>
      )}

      {/* Role Selection Tabs */}
      <div className="mt-6">
        <label className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-2">
          Select Role / Dashboard
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { role: "customer" as UserRole, label: "Customer", icon: User },
            { role: "company" as UserRole, label: "Company", icon: Building2 },
            { role: "partner" as UserRole, label: "Partner", icon: Fuel },
            { role: "admin" as UserRole, label: "Admin", icon: ShieldCheck },
          ].map((item) => {
            const Icon = item.icon;
            const active = selectedRole === item.role;
            return (
              <button
                key={item.role}
                type="button"
                onClick={() => setSelectedRole(item.role)}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 px-2 text-xs font-bold transition ${
                  active
                    ? "border-obligon-green bg-[#e8fbd7] text-obligon-green ring-2 ring-obligon-green/20"
                    : "border-obligon-border bg-white text-obligon-text hover:bg-obligon-mist"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="relative">
          <label htmlFor="login-email" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-obligon-text/50" aria-hidden="true" />
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="user@obligon.energy"
              value={loginForm.email}
              onChange={(e) => handleLoginChange("email", e.target.value)}
              className={`${fieldClass(!!loginErrors.email)} pl-10 pr-4`}
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
              placeholder="••••••••"
              value={loginForm.password}
              onChange={(e) => handleLoginChange("password", e.target.value)}
              className={`${fieldClass(!!loginErrors.password)} pl-10 pr-12`}
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
              onChange={(e) => setLoginForm((prev) => ({ ...prev, rememberMe: e.target.checked }))}
              className="size-4 accent-obligon-green"
              disabled={loginSubmitting}
            />
            <span className="text-xs font-medium">Remember me</span>
          </label>
          <Link href={routes.forgotPassword} className="text-xs font-bold text-obligon-green hover:underline">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg text-base font-bold text-white shadow-green transition ${
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
            `Sign in to ${roleLabels[selectedRole === "partner" ? "fuelStation" : selectedRole === "admin" ? "company" : selectedRole]}`
          )}
        </button>

        <div className="pt-3 text-center space-y-2">
          <p className="text-sm text-obligon-text">
            New to Obligon?{" "}
            <Link href={routes.signup} className="font-bold text-obligon-green hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </form>
  );
}

function SignupForm() {
  const router = useRouter();
  const { login } = useSession();
  const { error: toastError, success: toastSuccess } = useToast();

  const [role, setRole] = React.useState<SignupRole>("customer");
  const [signupForm, setSignupForm] = React.useState<Record<string, string>>({});
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [signupErrors, setSignupErrors] = React.useState<Record<string, string>>({});
  const [signupSubmitting, setSignupSubmitting] = React.useState(false);
  const [signupServerError, setSignupServerError] = React.useState<string | null>(null);
  const [selectedFuelTypes, setSelectedFuelTypes] = React.useState<string[]>(["PMS Petrol", "AGO Diesel"]);
  const [fuelError, setFuelError] = React.useState(false);
  const [selectedMechanicServices, setSelectedMechanicServices] = React.useState<string[]>(["Diagnostics", "Brake Service"]);
  const [mechanicServiceError, setMechanicServiceError] = React.useState(false);

  const validateSignup = (): boolean => {
    const errors: Record<string, string> = {};
    signupFields[role].forEach((field) => {
      const value = signupForm[field.name] ?? "";
      const err = field.required ? validateRequired(value, field.label) : null;
      if (err) errors[field.name] = err;
      else if (field.type === "email" && value && !emailRegex.test(value)) {
        errors[field.name] = "Enter a valid email address";
      } else if (field.name === "phone" && value && !phoneRegex.test(value.replace(/\s/g, ""))) {
        errors[field.name] = "Enter a valid phone number";
      }
    });

    if (!password) errors.password = "Password is required";
    else if (password.length < 8) errors.password = "Password must be at least 8 characters";

    if (role === "fuelStation" && selectedFuelTypes.length === 0) {
      errors.fuelTypes = "Select at least one fuel type";
      setFuelError(true);
    }

    if (role === "mechanic" && selectedMechanicServices.length === 0) {
      errors.mechanicServices = "Select at least one service";
      setMechanicServiceError(true);
    }

    setSignupErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignupChange = (name: string, value: string) => {
    setSignupForm((prev) => ({ ...prev, [name]: value }));
    if (signupErrors[name]) setSignupErrors((prev) => ({ ...prev, [name]: "" }));
    if (signupServerError) setSignupServerError(null);
  };

  const handleRoleChange = (newRole: SignupRole) => {
    setRole(newRole);
    setFuelError(false);
    setMechanicServiceError(false);
    setSignupForm({});
    setSignupErrors({});
    setSignupServerError(null);
  };

  const handleSignupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateSignup()) return;

    setSignupSubmitting(true);
    setSignupServerError(null);

    try {
      const email = signupForm.email;
      const roleMap: Record<SignupRole, UserRole> = {
        customer: "customer",
        company: "company",
        fuelStation: "partner",
        mechanic: "mechanic",
      };
      await login({ email, password, role: roleMap[role] });
      toastSuccess(`${roleLabels[role]} registration submitted successfully!`);
      router.push(`${routes.authSuccess}?redirect=${
        role === "company"
          ? routes.companyDashboard
          : role === "fuelStation"
            ? routes.dashboard
            : role === "mechanic"
              ? "/company/roadside"
              : routes.customerDashboard
      }`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed. Please try again.";
      setSignupServerError(message);
      toastError(message);
    } finally {
      setSignupSubmitting(false);
    }
  };

  const isSignupDisabled = signupSubmitting;

  return (
    <form id="signup" onSubmit={handleSignupSubmit} className="mx-auto w-full max-w-[640px] rounded-2xl border border-obligon-border bg-white p-6 sm:p-8 shadow-card" noValidate>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Register on Obligon</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-obligon-navy">Create your account</h2>
        </div>
        <ShieldCheck className="text-obligon-green" size={28} />
      </div>

      {signupServerError && (
        <div className="mt-4 rounded-lg bg-[#fff0f0] border border-[#fecaca] p-3 text-sm text-[#93000a] flex items-start gap-2" role="alert">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{signupServerError}</span>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="signup-role" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
            Account Type
          </label>
          <div className="relative">
            <select
              id="signup-role"
              name="role"
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as SignupRole)}
              className={`${fieldClass(false)} appearance-none pr-10`}
              disabled={signupSubmitting}
            >
              {(Object.keys(roleLabels) as SignupRole[]).map((key) => (
                <option key={key} value={key}>
                  {roleLabels[key]}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-obligon-text/50" aria-hidden="true" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
                className={fieldClass(!!signupErrors[field.name])}
                required={field.required ?? true}
                disabled={signupSubmitting}
                aria-invalid={!!signupErrors[field.name]}
                aria-describedby={signupErrors[field.name] ? `signup-${field.name}-error` : undefined}
              />
              {signupErrors[field.name] && (
                <p id={`signup-${field.name}-error`} className="mt-1 text-xs font-medium text-[#93000a]" role="alert">{signupErrors[field.name]}</p>
              )}
            </div>
          ))}
        </div>

        <div className="relative">
          <label htmlFor="signup-password" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-obligon-text/50" aria-hidden="true" />
            <input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (signupErrors.password) setSignupErrors((prev) => ({ ...prev, password: "" }));
              }}
              className={`${fieldClass(!!signupErrors.password)} pl-10 pr-12`}
              required
              autoComplete="new-password"
              disabled={signupSubmitting}
              aria-invalid={!!signupErrors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-obligon-text transition hover:bg-obligon-mist hover:text-obligon-navy"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={signupSubmitting}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {signupErrors.password && (
            <p className="mt-1 text-xs font-medium text-[#93000a]" role="alert">{signupErrors.password}</p>
          )}
        </div>
      </div>

      {role === "fuelStation" ? (
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Available Fuel Types</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {fuelTypes.map((item) => {
              const selected = selectedFuelTypes.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setSelectedFuelTypes((current) =>
                      current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item]
                    );
                    setFuelError(false);
                  }}
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
          {fuelError || signupErrors.fuelTypes ? (
            <p className="mt-2 text-xs font-semibold text-[#93000a]" role="alert">
              {signupErrors.fuelTypes ?? "Select at least one available fuel type before submitting."}
            </p>
          ) : null}
        </div>
      ) : null}

      {role === "mechanic" ? (
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Service Specializations</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {mechanicServices.map((item) => {
              const selected = selectedMechanicServices.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setSelectedMechanicServices((current) =>
                      current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item]
                    );
                    setMechanicServiceError(false);
                  }}
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
          {mechanicServiceError || signupErrors.mechanicServices ? (
            <p className="mt-2 text-xs font-semibold text-[#93000a]" role="alert">
              {signupErrors.mechanicServices ?? "Select at least one service before submitting."}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg text-base font-bold text-white shadow-green transition ${
          isSignupDisabled ? "bg-obligon-green/50 cursor-not-allowed" : "bg-obligon-green hover:bg-obligon-green/90"
        }`}
        disabled={isSignupDisabled}
      >
        {signupSubmitting ? (
          <>
            <Loader2 size={18} className="mr-2 animate-spin" />
            Submitting Registration...
          </>
        ) : (
          `Complete ${roleLabels[role]} Registration`
        )}
      </button>

      <p className="mt-4 text-center text-sm text-obligon-text">
        Already registered?{" "}
        <Link href={routes.login} className="font-bold text-obligon-green hover:underline">
          Sign In Here
        </Link>
      </p>
    </form>
  );
}

export function AuthForms({ mode = "login" }: { mode?: AuthFormMode }) {
  return mode === "signup" ? <SignupForm /> : <LoginForm />;
}
