"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, KeyRound, Moon, Sun } from "lucide-react";
import { useSession } from "@/components/shared/AuthContext";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { api } from "@/lib/services";

export type CustomerTheme = "light" | "dark";
export type CustomerPreferences = { theme: CustomerTheme; stationLocation: { prompted: boolean; enabled: boolean } };
export type CustomerPreferencesUpdate = { theme?: CustomerTheme; stationLocation?: { prompted?: true; enabled?: boolean } };
const defaultPreferences: CustomerPreferences = { theme: "light", stationLocation: { prompted: false, enabled: false } };
type ThemeContextValue = {
  preferences: CustomerPreferences;
  loading: boolean;
  saving: boolean;
  error: string;
  saved: boolean;
  reloadPreferences: () => void;
  savePreferences: (update: CustomerPreferencesUpdate) => Promise<CustomerPreferences>;
};
const CustomerThemeContext = React.createContext<ThemeContextValue | null>(null);

function validatePreferences(response: CustomerPreferences): CustomerPreferences {
  if ((response?.theme !== "light" && response?.theme !== "dark") || typeof response?.stationLocation?.prompted !== "boolean" || typeof response?.stationLocation?.enabled !== "boolean") {
    throw new Error("Could not load your account preferences. Please try again.");
  }
  return response;
}

function CustomerThemeSession({ accountId, children }: { accountId: string | null; children: React.ReactNode }) {
  const [preferences, setPreferences] = React.useState<CustomerPreferences>(defaultPreferences);
  const currentPreferences = React.useRef(preferences);
  const [loading, setLoading] = React.useState(Boolean(accountId));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  const alive = React.useRef(true);
  const writeQueue = React.useRef<Promise<unknown>>(Promise.resolve());
  const mutationVersion = React.useRef(0);
  const theme = preferences.theme;

  function applyPreferences(next: CustomerPreferences) {
    currentPreferences.current = next;
    setPreferences(next);
  }

  React.useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  React.useLayoutEffect(() => {
    document.body.dataset.customerTheme = theme;
    return () => { delete document.body.dataset.customerTheme; };
  }, [theme]);

  React.useEffect(() => {
    if (!accountId) { setLoading(false); return; }
    let current = true;
    setLoading(true);
    setError("");
    void writeQueue.current.then(async () => {
      if (!current) return;
      const version = mutationVersion.current;
      const response = await api.request<CustomerPreferences>("/api/customer/preferences");
      if (current && version === mutationVersion.current) applyPreferences(validatePreferences(response));
    }).catch((failure: unknown) => {
      if (current) setError(failure instanceof Error ? failure.message : "Could not load your appearance preference.");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [accountId, revision]);

  const savePreferences = React.useCallback((update: CustomerPreferencesUpdate): Promise<CustomerPreferences> => {
    if (!accountId || loading) return Promise.reject(new Error("Your account preferences are not ready. Please try again."));
    const save = async () => {
      if (!alive.current) throw new Error("Your account has changed. Please try again.");
      mutationVersion.current += 1;
      const previous = currentPreferences.current;
      applyPreferences({ ...previous, ...update, stationLocation: { ...previous.stationLocation, ...update.stationLocation } });
      setSaving(true);
      setSaved(false);
      setError("");
      try {
        const response = validatePreferences(await api.request<CustomerPreferences>("/api/customer/preferences", { method: "PATCH", body: JSON.stringify(update) }));
        if (!alive.current) throw new Error("Your account has changed. Please try again.");
        applyPreferences(response);
        setSaved(true);
        return response;
      } catch (failure) {
        if (alive.current) {
          applyPreferences(previous);
          setError(failure instanceof Error ? failure.message : "Could not save your account preferences. Please try again.");
        }
        throw failure;
      } finally {
        if (alive.current) setSaving(false);
      }
    };
    const result = writeQueue.current.then(save, save);
    writeQueue.current = result.then(() => undefined, () => undefined);
    return result;
  }, [accountId, loading]);
  const reloadPreferences = React.useCallback(() => setRevision(value => value + 1), []);

  return <CustomerThemeContext.Provider value={{ preferences, loading, saving, error, saved, reloadPreferences, savePreferences }}>
    {children}
  </CustomerThemeContext.Provider>;
}

/** Remounting prevents a previous account's preference or late request from reaching the next account. */
export function CustomerThemeProvider({ enabled = true, children }: { enabled?: boolean; children: React.ReactNode }) {
  const { user, status } = useSession();
  const accountId = enabled && status === "authenticated" && user?.role === "customer" ? user.id : null;
  return <CustomerThemeSession key={accountId ?? "disabled"} accountId={accountId}>{children}</CustomerThemeSession>;
}

export function useCustomerPreferences() {
  const value = React.useContext(CustomerThemeContext);
  if (!value) throw new Error("Customer preferences require the customer dashboard.");
  return value;
}

export function CustomerPreferencesPanel() {
  const { preferences, loading, saving, error, saved, reloadPreferences, savePreferences } = useCustomerPreferences();
  const theme = preferences.theme;
  return <section className="customer-preferences mt-8 border-y border-obligon-border py-6" aria-labelledby="customer-appearance-title">
    {loading ? <StatusPopup tone="loading" message="Loading your appearance preference." /> : null}
    {saving ? <StatusPopup tone="pending" title="Saving appearance" message="Your theme is being saved to your account." dismissible={false} /> : null}
    {error ? <StatusPopup tone="error" title="Check your preferences" message={error} onRetry={reloadPreferences} retryLabel="Reload preference" /> : null}
    {saved && !saving && !error ? <StatusPopup tone="success" title="Preferences saved" message="Your preferences are saved to your account." /> : null}
    <h2 id="customer-appearance-title" className="font-display text-xl font-bold tracking-tight text-obligon-navy">Appearance</h2>
    <p className="mt-2 text-sm leading-6 text-obligon-text">Choose the theme for your customer dashboard.</p>
    <fieldset disabled={loading || saving} className="mt-5 min-w-0">
      <legend className="sr-only">Dashboard theme</legend>
      <div className="grid grid-cols-2 gap-3">
        {(["light", "dark"] as const).map(option => {
          const Icon = option === "light" ? Sun : Moon;
          return <label key={option} className={`customer-theme-choice relative flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border px-4 py-4 text-sm font-bold ${theme === option ? "border-obligon-green bg-obligon-mist text-obligon-green" : "border-obligon-border text-obligon-navy"}`}>
            <input type="radio" name="customer-theme" value={option} checked={theme === option} onChange={() => { void savePreferences({ theme: option }).catch(() => undefined); }} className="size-4 shrink-0 accent-obligon-green" />
            <Icon size={20} aria-hidden="true" className="hidden shrink-0 min-[375px]:block" />
            {option === "light" ? "Light" : "Dark"}
          </label>;
        })}
      </div>
    </fieldset>
    <div className="mt-7 border-t border-obligon-border pt-6">
      <h2 id="sign-in-options" className="scroll-mt-28 font-display text-xl font-bold tracking-tight text-obligon-navy">Sign-in options</h2>
      <p className="mt-2 text-sm leading-6 text-obligon-text">Manage Google sign-in and passkeys. Your device may use fingerprint, Face ID or its PIN. Transaction approvals still use your password, card PIN and two-factor authentication.</p>
      <Link href="/auth/sign-in-options" className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl border border-obligon-border px-4 py-3 text-sm font-bold text-obligon-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green">
        <KeyRound size={18} aria-hidden="true" />Manage sign-in options<ArrowUpRight size={17} aria-hidden="true" />
      </Link>
    </div>
  </section>;
}
