"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  AlertTriangle,
  ChevronDown,
  Building2,
  User,
  Fuel,
  Wrench,
  Zap,
  Gauge,
  Truck,
  Warehouse
} from "lucide-react";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";
import { useSession } from "@/components/shared/AuthContext";
import { readRememberedEmail, writeRememberedEmail } from "@/lib/session-store";
import type { UserRole } from "@/lib/services/types";

export type AuthFormMode = "login" | "signup";
type TopRole = "customer" | "company" | "partner";

export type PartnerType =
  | "fuelStation"
  | "mechanic"
  | "evCharging"
  | "cngConversion"
  | "heavyDuty"
  | "logisticsDepot";

interface PartnerTypeMeta {
  id: PartnerType;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  capabilities: string[];
  fields: Array<{ label: string; name: string; placeholder: string; type?: string; required?: boolean }>;
}

const partnerTypeConfigs: Record<PartnerType, PartnerTypeMeta> = {
  fuelStation: {
    id: "fuelStation",
    title: "Fuel Station / Energy Retailer",
    subtitle: "DPR licensed filling stations and fuel dispensers",
    icon: Fuel,
    capabilities: ["PMS Petrol", "AGO Diesel", "DPK Kerosene", "CNG Compressed Gas", "LPG Autogas", "Car Wash Bay"],
    fields: [
      { label: "Station Brand / Name", name: "stationName", placeholder: "Mainland Energy Station", required: true },
      { label: "Station Location / Address", name: "location", placeholder: "Plot 14 Commercial Ave, Ikeja, Lagos", required: true },
      { label: "Station Manager Full Name", name: "contactName", placeholder: "Tunde Bakare", required: true },
      { label: "Manager Phone Number", name: "phone", placeholder: "+234 803 456 7890", required: true },
      { label: "Official Station Email", name: "email", placeholder: "ops@mainlandenergy.ng", type: "email", required: true },
      { label: "DPR / NMDPRA License Number", name: "license", placeholder: "DPR-NG-2024-884", required: true },
    ]
  },
  mechanic: {
    id: "mechanic",
    title: "Auto Mechanic / Repair Center",
    subtitle: "Fleet diagnostics, servicing, and repair workshops",
    icon: Wrench,
    capabilities: ["Computer Diagnostics", "Engine Overhaul", "Brake & Suspension", "Tyres & Wheel Alignment", "Auto Electrical", "Mobile Roadside Unit"],
    fields: [
      { label: "Workshop / Garage Name", name: "workshopName", placeholder: "Ade Auto Diagnostic Hub", required: true },
      { label: "Service Area / Workshop Address", name: "location", placeholder: "Lekki-Epe Expressway, Lagos", required: true },
      { label: "Lead Technician / Manager Name", name: "contactName", placeholder: "Ade Balogun", required: true },
      { label: "Workshop Phone Number", name: "phone", placeholder: "+234 804 567 8901", required: true },
      { label: "Business Email", name: "email", placeholder: "service@adeauto.ng", type: "email", required: true },
      { label: "Trade Certification / CAC Number", name: "license", placeholder: "RC-8921004", required: true },
    ]
  },
  evCharging: {
    id: "evCharging",
    title: "EV Charging & Battery Hub",
    subtitle: "Commercial EV fast-charging and battery swap bays",
    icon: Zap,
    capabilities: ["DC Rapid Charger 150kW", "Dual CCS2 Outlets", "AC Type 2 22kW", "Swappable Battery Bank", "Solar Canopy Backup"],
    fields: [
      { label: "Charging Hub / Facility Name", name: "hubName", placeholder: "VoltDrive Lagos E-Station", required: true },
      { label: "Hub Location / Grid Node", name: "location", placeholder: "Victoria Island Power Corridor, Lagos", required: true },
      { label: "Site Operations Lead", name: "contactName", placeholder: "Chinedu Okeke", required: true },
      { label: "Contact Phone Number", name: "phone", placeholder: "+234 805 678 9012", required: true },
      { label: "Operational Email", name: "email", placeholder: "grid@voltdrive.ng", type: "email", required: true },
      { label: "Grid Interconnection / CAC Ref", name: "license", placeholder: "NERC-EV-2024-110", required: true },
    ]
  },
  cngConversion: {
    id: "cngConversion",
    title: "CNG Conversion & Refueling Center",
    subtitle: "Autogas vehicle conversion kits and cylinder recertification",
    icon: Gauge,
    capabilities: ["Sequential Gas Injection Kit", "Composite Type 4 Cylinders", "Cylinder Hydrostatic Testing", "Dual-Fuel ECU Tuning", "Mother-Daughter CNG Dispenser"],
    fields: [
      { label: "Conversion Facility Name", name: "cngCenterName", placeholder: "CleanEnergy Autogas Hub", required: true },
      { label: "Workshop & Testing Station Address", name: "location", placeholder: "Ibadan Expressway Logistics Park, Ogun", required: true },
      { label: "Certified Gas Engineer Name", name: "contactName", placeholder: "Engr. Yusuf Ibrahim", required: true },
      { label: "Operations Phone Number", name: "phone", placeholder: "+234 806 789 0123", required: true },
      { label: "Inquiry Email", name: "email", placeholder: "cng@cleanenergy.ng", type: "email", required: true },
      { label: "SON / NMDPRA Conversion License", name: "license", placeholder: "SON-CNG-90214", required: true },
    ]
  },
  heavyDuty: {
    id: "heavyDuty",
    title: "Heavy Duty Recovery & Towing",
    subtitle: "Interstate heavy truck breakdown and emergency recovery",
    icon: Truck,
    capabilities: ["50-Ton Heavy Duty Wrecker", "Flatbed Carrier", "Mobile Air Compressor Unit", "Interstate Highway Response", "Heavy Diesel Onsite Repair"],
    fields: [
      { label: "Fleet Recovery Company Name", name: "recoveryCompanyName", placeholder: "Eagle Eye Heavy Towing Ltd", required: true },
      { label: "Corridor / Base Depot Location", name: "location", placeholder: "Sagamu Interchange Base, Ogun/Lagos", required: true },
      { label: "Fleet Dispatch Officer", name: "contactName", placeholder: "Alhaji Musa Garba", required: true },
      { label: "24/7 Hotline Phone Number", name: "phone", placeholder: "+234 800 EAGLE TOW", required: true },
      { label: "Dispatch Email", name: "email", placeholder: "dispatch@eagletowing.ng", type: "email", required: true },
      { label: "Federal Safety / CAC License", name: "license", placeholder: "FRSC-REC-8840", required: true },
    ]
  },
  logisticsDepot: {
    id: "logisticsDepot",
    title: "Energy Depot & Terminal Hub",
    subtitle: "Bulk storage, fuel gantry loading, and terminal logistics",
    icon: Warehouse,
    capabilities: ["Bulk PMS Storage (MT)", "AGO Pipeline Offtake", "Automated Gantry Meters", "24/7 Tanker Loading", "Quality Lab Testing"],
    fields: [
      { label: "Depot / Terminal Facility Name", name: "depotName", placeholder: "Ibafon Energy Terminal Hub", required: true },
      { label: "Terminal Port / Jetty Address", name: "location", placeholder: "Dockyard Road, Apapa, Lagos", required: true },
      { label: "Terminal Operations Manager", name: "contactName", placeholder: "Khadija Danjuma", required: true },
      { label: "Terminal Phone Number", name: "phone", placeholder: "+234 807 890 1234", required: true },
      { label: "Terminal Scheduling Email", name: "email", placeholder: "terminal@ibafonenergy.ng", type: "email", required: true },
      { label: "DPR Bulk Terminal License", name: "license", placeholder: "DPR-DEPOT-2024-001", required: true },
    ]
  }
};

const customerFields = [
  { label: "Full Name", name: "name", placeholder: "Adaora Emeka", required: true },
  { label: "Phone Number", name: "phone", placeholder: "+234 801 234 5678", required: true },
  { label: "Personal Email Address", name: "email", placeholder: "adaora@gmail.com", type: "email", required: true },
  { label: "City / State", name: "location", placeholder: "Lagos, Nigeria", required: true },
];

const companyFields = [
  { label: "Company / Enterprise Name", name: "company", placeholder: "Apex Logistics Ltd", required: true },
  { label: "Estimated Fleet Size (Vehicles)", name: "fleetSize", placeholder: "35", required: true },
  { label: "Fleet Manager Full Name", name: "contact", placeholder: "James Adenuga", required: true },
  { label: "Official Phone Number", name: "phone", placeholder: "+234 802 345 6789", required: true },
  { label: "Enterprise Work Email", name: "email", placeholder: "james@apexlogistics.ng", type: "email", required: true },
  { label: "CAC Registration Number", name: "license", placeholder: "RC 9876543", required: true },
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[\d\s-]{10,}$/;

const fieldClass = (invalid: boolean) =>
  `h-12 w-full rounded-xl border px-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 ${
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
            : selectedRole === "partner" || selectedRole === "mechanic"
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
    <form onSubmit={handleLoginSubmit} className="mx-auto w-full max-w-[480px] rounded-2xl border border-obligon-border bg-white p-6 sm:p-8 shadow-card" noValidate>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Access Portal</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-obligon-navy">Welcome back</h2>
        </div>
        <ShieldCheck className="text-obligon-green" size={28} />
      </div>

      {status === "authenticated" && user ? (
        <div className="mt-4 rounded-xl border border-obligon-border bg-obligon-mist p-3.5 text-sm text-obligon-text">
          Active session as <strong>{user.email}</strong> ({user.role}).{" "}
          <Link
            href={
              user.role === "admin"
                ? routes.adminDashboard
                : user.role === "company"
                  ? routes.companyDashboard
                  : user.role === "partner" || user.role === "mechanic"
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
        <div className="mt-4 rounded-xl bg-[#fff0f0] border border-[#fecaca] p-3.5 text-sm text-[#93000a] flex items-start gap-2" role="alert">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{loginServerError}</span>
        </div>
      )}

      {/* Role Selection Tabs */}
      <div className="mt-6">
        <label className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-2">
          Select Dashboard Portal
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { role: "customer" as UserRole, label: "Customer", icon: User },
            { role: "company" as UserRole, label: "Fleet Co.", icon: Building2 },
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
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border py-2.5 px-2 text-xs font-bold transition ${
                  active
                    ? "border-obligon-green bg-[#e8fbd7] text-obligon-green ring-2 ring-obligon-green/20"
                    : "border-obligon-border bg-white text-obligon-text hover:bg-obligon-mist"
                }`}
              >
                <Icon size={18} />
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
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-obligon-text/50" aria-hidden="true" />
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
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-obligon-text/50" aria-hidden="true" />
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
          className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl text-base font-bold text-white shadow-green transition ${
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
            `Sign in as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`
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

  const [topRole, setTopRole] = React.useState<TopRole>("customer");
  const [partnerType, setPartnerType] = React.useState<PartnerType>("fuelStation");
  const [signupForm, setSignupForm] = React.useState<Record<string, string>>({});
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [signupErrors, setSignupErrors] = React.useState<Record<string, string>>({});
  const [signupSubmitting, setSignupSubmitting] = React.useState(false);
  const [signupServerError, setSignupServerError] = React.useState<string | null>(null);

  const [selectedCapabilities, setSelectedCapabilities] = React.useState<string[]>([
    "PMS Petrol",
    "AGO Diesel"
  ]);

  const activePartnerMeta = partnerTypeConfigs[partnerType];

  const handleTopRoleChange = (newRole: TopRole) => {
    setTopRole(newRole);
    setSignupForm({});
    setSignupErrors({});
    setSignupServerError(null);
    if (newRole === "partner") {
      setSelectedCapabilities(partnerTypeConfigs[partnerType].capabilities.slice(0, 2));
    }
  };

  const handlePartnerTypeChange = (newType: PartnerType) => {
    setPartnerType(newType);
    setSignupForm({});
    setSignupErrors({});
    setSignupServerError(null);
    setSelectedCapabilities(partnerTypeConfigs[newType].capabilities.slice(0, 2));
  };

  const currentFields =
    topRole === "customer"
      ? customerFields
      : topRole === "company"
        ? companyFields
        : activePartnerMeta.fields;

  const validateSignup = (): boolean => {
    const errors: Record<string, string> = {};
    currentFields.forEach((field) => {
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

    if (topRole === "partner" && selectedCapabilities.length === 0) {
      errors.capabilities = "Select at least one capability / service offered";
    }

    setSignupErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignupChange = (name: string, value: string) => {
    setSignupForm((prev) => ({ ...prev, [name]: value }));
    if (signupErrors[name]) setSignupErrors((prev) => ({ ...prev, [name]: "" }));
    if (signupServerError) setSignupServerError(null);
  };

  const handleSignupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateSignup()) return;

    setSignupSubmitting(true);
    setSignupServerError(null);

    try {
      const email = signupForm.email;
      const roleToAssign: UserRole =
        topRole === "customer"
          ? "customer"
          : topRole === "company"
            ? "company"
            : partnerType === "mechanic"
              ? "mechanic"
              : "partner";

      const orgName =
        topRole === "customer"
          ? "Individual Consumer"
          : topRole === "company"
            ? (signupForm.company ?? "Fleet Enterprise")
            : (signupForm.stationName ??
               signupForm.workshopName ??
               signupForm.hubName ??
               signupForm.cngCenterName ??
               signupForm.recoveryCompanyName ??
               signupForm.depotName ??
               "Partner Facility");

      await login({
        email,
        password,
        role: roleToAssign,
      });

      const partnerRoleLabel =
        topRole === "partner" ? activePartnerMeta.title : topRole === "company" ? "Fleet Company" : "Customer";

      toastSuccess(`${partnerRoleLabel} account registered successfully!`);

      const destination =
        topRole === "company"
          ? routes.companyDashboard
          : topRole === "partner"
            ? routes.dashboard
            : routes.customerDashboard;

      router.push(`${routes.authSuccess}?redirect=${destination}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed. Please try again.";
      setSignupServerError(message);
      toastError(message);
    } finally {
      setSignupSubmitting(false);
    }
  };

  return (
    <form id="signup" onSubmit={handleSignupSubmit} className="mx-auto w-full max-w-[680px] rounded-2xl border border-obligon-border bg-white p-6 sm:p-8 shadow-card" noValidate>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Onboard to Obligon</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-obligon-navy">Create your account</h2>
        </div>
        <ShieldCheck className="text-obligon-green" size={28} />
      </div>

      {signupServerError && (
        <div className="mt-4 rounded-xl bg-[#fff0f0] border border-[#fecaca] p-3.5 text-sm text-[#93000a] flex items-start gap-2" role="alert">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{signupServerError}</span>
        </div>
      )}

      {/* Top Level Role Selector */}
      <div className="mt-6">
        <label className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-2">
          Select Account Category
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "customer" as TopRole, title: "Customer / Driver", desc: "For individual vehicle owners & cards", icon: User },
            { key: "company" as TopRole, title: "Fleet Enterprise", desc: "For corporate fleets & transport firms", icon: Building2 },
            { key: "partner" as TopRole, title: "Partner Network", desc: "Stations, Mechanics, EV, CNG & Depots", icon: Fuel },
          ].map((item) => {
            const Icon = item.icon;
            const active = topRole === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleTopRoleChange(item.key)}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  active
                    ? "border-obligon-green bg-[#e8fbd7] text-obligon-green ring-2 ring-obligon-green/20"
                    : "border-obligon-border bg-white text-obligon-navy hover:bg-obligon-mist"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Icon size={20} className={active ? "text-obligon-green" : "text-obligon-navy"} />
                  {active && <span className="size-2 rounded-full bg-obligon-green" />}
                </div>
                <div className="mt-2.5">
                  <p className="font-extrabold text-xs leading-4">{item.title}</p>
                  <p className="text-[11px] font-medium text-obligon-text mt-0.5 leading-tight line-clamp-2">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-Partner Type Selector (When Partner Network is selected) */}
      {topRole === "partner" && (
        <div className="mt-6 rounded-2xl border border-obligon-border bg-[#f8fafc] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-[1px] text-obligon-navy">
              Select Specific Partner Specialization
            </span>
            <span className="text-[10px] font-bold uppercase bg-obligon-green text-white px-2.5 py-0.5 rounded-full">
              6 Options Available
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {(Object.keys(partnerTypeConfigs) as PartnerType[]).map((key) => {
              const meta = partnerTypeConfigs[key];
              const Icon = meta.icon;
              const active = partnerType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePartnerTypeChange(key)}
                  className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                    active
                      ? "border-obligon-green bg-white shadow-sm ring-2 ring-obligon-green/30"
                      : "border-obligon-border/80 bg-white/70 hover:bg-white text-obligon-navy"
                  }`}
                >
                  <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${active ? "bg-obligon-green text-white" : "bg-[#f1f5f9] text-obligon-navy"}`}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-bold text-xs leading-4 ${active ? "text-obligon-green" : "text-obligon-navy"}`}>
                      {meta.title}
                    </p>
                    <p className="text-[10px] font-medium text-obligon-text mt-0.5 leading-tight line-clamp-1">
                      {meta.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dynamic Form Fields */}
      <div className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {currentFields.map((field) => (
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

        {/* Partner Capabilities & Specialties */}
        {topRole === "partner" && (
          <div className="mt-4 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-2">
              Capabilities, Products &amp; Amenities Offered
            </span>
            <div className="flex flex-wrap gap-2">
              {activePartnerMeta.capabilities.map((cap) => {
                const selected = selectedCapabilities.includes(cap);
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => {
                      setSelectedCapabilities((prev) =>
                        prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
                      );
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                      selected
                        ? "border-obligon-green bg-[#e8fbd7] text-obligon-green ring-1 ring-obligon-green"
                        : "border-obligon-border bg-white text-obligon-text hover:border-obligon-green"
                    }`}
                  >
                    {selected && <Check size={13} />}
                    {cap}
                  </button>
                );
              })}
            </div>
            {signupErrors.capabilities && (
              <p className="mt-1.5 text-xs font-medium text-[#93000a]">{signupErrors.capabilities}</p>
            )}
          </div>
        )}

        {/* Password */}
        <div className="relative pt-2">
          <label htmlFor="signup-password" className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text block mb-1">
            Create Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-obligon-text/50" aria-hidden="true" />
            <input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Minimum 8 characters with numbers & symbols"
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

      <button
        type="submit"
        className={`mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl text-base font-bold text-white shadow-green transition ${
          signupSubmitting ? "bg-obligon-green/50 cursor-not-allowed" : "bg-obligon-green hover:bg-obligon-green/90"
        }`}
        disabled={signupSubmitting}
      >
        {signupSubmitting ? (
          <>
            <Loader2 size={18} className="mr-2 animate-spin" />
            Registering Account...
          </>
        ) : (
          `Complete ${
            topRole === "partner" ? activePartnerMeta.title : topRole === "company" ? "Fleet Company" : "Customer"
          } Signup`
        )}
      </button>

      <p className="mt-4 text-center text-sm text-obligon-text">
        Already registered on Obligon?{" "}
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
