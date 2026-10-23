"use client";

import { StatusPopup } from "@/components/shared/StatusPopup";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Fingerprint, KeyRound, Loader2 } from "lucide-react";
import { authApi } from "@/lib/services";
import { authMethodError, passkeySupportError, registerDevicePasskey, type AuthMethodsConfig, type GoogleChallenge, type SignInMethods } from "@/lib/auth-methods";
import { dashboardDestination } from "@/lib/auth-routing";
import { useSession } from "@/components/shared/AuthContext";
import { GoogleIdentityButton } from "./GoogleIdentityButton";

const fieldClass = "mt-2 min-h-12 w-full min-w-0 rounded-xl border border-obligon-border bg-white px-3 text-base text-obligon-navy focus:outline-none focus:ring-2 focus:ring-obligon-green disabled:opacity-50";
const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-obligon-green px-4 py-2 text-sm font-bold text-obligon-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green disabled:cursor-not-allowed disabled:opacity-50";

export function SignInOptions() {
  const { user } = useSession();
  const [data, setData] = React.useState<SignInMethods | null>(null);
  const [config, setConfig] = React.useState<AuthMethodsConfig | null>(null);
  const [password, setPassword] = React.useState("");
  const [label, setLabel] = React.useState("My device");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [linkChallenge, setLinkChallenge] = React.useState<GoogleChallenge | null>(null);
  const [removeId, setRemoveId] = React.useState<string | null>(null);
  const [unsupported, setUnsupported] = React.useState<string | null>(null);
  const active = React.useRef(true);
  const inFlight = React.useRef(false);
  const requestGeneration = React.useRef(0);
  const actionGeneration = React.useRef(0);

  const reload = React.useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    try {
      const [methods, methodsConfig] = await Promise.all([authApi.signInMethods(), authApi.methodsConfig()]);
      if (active.current && generation === requestGeneration.current) { setData(methods); setConfig(methodsConfig); }
    } catch (failure) { if (active.current && generation === requestGeneration.current) setError(authMethodError(failure)); }
    finally { if (active.current && generation === requestGeneration.current) setLoading(false); }
  }, [user?.id]);

  React.useEffect(() => {
    active.current = true;
    setData(null);
    setConfig(null);
    setPassword("");
    setLabel("My device");
    inFlight.current = false;
    setBusy(null);
    setRemoveId(null);
    setError(null);
    setNotice(null);
    setLinkChallenge(null);
    setUnsupported(passkeySupportError());
    void reload();
    return () => { active.current = false; requestGeneration.current += 1; actionGeneration.current += 1; };
  }, [reload]);

  async function withPassword<T>(action: string, operation: (currentPassword: string) => Promise<T>): Promise<T | undefined> {
    if (inFlight.current || !password) return;
    inFlight.current = true;
    const generation = ++actionGeneration.current;
    const currentPassword = password;
    setPassword("");
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const result = await operation(currentPassword);
      return active.current && generation === actionGeneration.current ? result : undefined;
    } catch (failure) { if (active.current && generation === actionGeneration.current) setError(authMethodError(failure)); }
    finally { if (active.current && generation === actionGeneration.current) { inFlight.current = false; setBusy(null); } }
  }

  async function beginGoogleLink() {
    const challenge = await withPassword("google-start", value => authApi.googleLinkStart(value));
    if (challenge) { setLinkChallenge(challenge); setNotice("Choose your Google account using the button below."); }
  }
  const prepareGoogle = React.useCallback(async () => {
    if (!linkChallenge) throw new Error("Confirm your password to start again.");
    return linkChallenge;
  }, [linkChallenge]);
  const finishGoogle = React.useCallback(async (challenge: GoogleChallenge, credential: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const generation = ++actionGeneration.current;
    setBusy("google-finish");
    setError(null);
    try {
      const result = await authApi.googleLinkFinish(challenge, credential);
      if (!result.ok) throw new Error("Google could not be linked. Confirm your password and try again.");
      if (active.current && generation === actionGeneration.current) { setLinkChallenge(null); setNotice("Google is linked to your account."); await reload(); }
    } catch (failure) {
      if (active.current && generation === actionGeneration.current) { setLinkChallenge(null); setError(`${authMethodError(failure)} Confirm your password to start again.`); }
      throw failure;
    } finally { if (active.current && generation === actionGeneration.current) { inFlight.current = false; setBusy(null); } }
  }, [reload]);
  async function unlinkGoogle() {
    const result = await withPassword("google-remove", value => authApi.unlinkGoogle(value));
    if (result?.ok) { setLinkChallenge(null); setNotice("Google has been unlinked. Your other sessions have been signed out."); await reload(); }
  }
  async function addPasskey() {
    if (!config?.passkeys.enabled || unsupported || !label.trim()) return;
    const result = await withPassword("passkey-add", value => authApi.registerPasskey(value, label.trim(), registerDevicePasskey));
    if (result?.ok) { setLabel("My device"); setNotice("Passkey added. You can use it on the sign-in page."); await reload(); }
  }
  async function removePasskey(id: string) {
    const result = await withPassword(`passkey-remove-${id}`, value => authApi.removePasskey(id, value));
    if (result?.ok) { setRemoveId(null); setNotice("Passkey removed. Your other sessions have been signed out."); await reload(); }
  }

  const googleEnabled = Boolean(config?.google.enabled && config.google.clientId && data?.google.enabled);
  const actionsDisabled = Boolean(busy) || loading || !password;
  return <div className="w-full min-w-0 max-w-3xl space-y-6">
    <Link href={dashboardDestination(user?.role)} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-obligon-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green"><ArrowLeft size={18} aria-hidden="true" />Back to dashboard</Link>
    <header><h1 className="font-display text-3xl font-extrabold text-obligon-navy">Sign-in options</h1><p className="mt-3 text-base leading-6 text-obligon-text">Link Google or add a passkey to this existing account. Your password remains available.</p></header>
    {error ? <StatusPopup tone="error" message={error} /> : null}
    {notice ? <StatusPopup tone="info" message={notice} /> : null}
    {busy ? <StatusPopup tone="pending" message="Updating your sign-in options…" /> : null}
    {loading && !data ? <StatusPopup tone="loading" message="Loading sign-in options…" /> : !data ? <button type="button" className={actionClass} onClick={() => void reload()}>Retry loading sign-in options</button> : <>
      <section aria-labelledby="confirm-password-title" className="rounded-2xl border border-obligon-border bg-white p-5 sm:p-6">
        <h2 id="confirm-password-title" className="flex items-center gap-2 text-lg font-bold"><KeyRound size={20} aria-hidden="true" />Confirm it is you</h2>
        <p id="method-password-help" className="mt-2 text-sm leading-6 text-obligon-text">Enter your current password before adding or removing a sign-in method. We clear this field after each request. Removing a method signs out your other sessions. This session stays signed in.</p>
        <label htmlFor="method-current-password" className="mt-4 block text-sm font-bold">Current password</label><input id="method-current-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={Boolean(busy)} aria-describedby="method-password-help" className={fieldClass} />
      </section>
      <section aria-labelledby="google-options-title" className="min-w-0 rounded-2xl border border-obligon-border bg-white p-5 sm:p-6">
        <h2 id="google-options-title" className="text-xl font-bold">Google</h2>
        <p className="mt-2 text-sm leading-6 text-obligon-text">{data.google.linked ? "A Google account is linked to this Obligon account." : "Link your Google account after confirming your password. This will not create a new Obligon account."}</p>
        {data.google.linked ? <><button type="button" onClick={() => void unlinkGoogle()} disabled={actionsDisabled} className={`mt-4 ${actionClass}`}>Unlink Google</button>{!googleEnabled ? <p className="mt-3 text-sm text-obligon-text">Google sign-in is currently unavailable. You can still unlink the saved account with your password.</p> : null}</> : !googleEnabled ? <p className="mt-3 text-sm text-obligon-text">Google sign-in is not configured for this deployment.</p> : linkChallenge ? <div className="mt-4 space-y-3"><GoogleIdentityButton prepare={prepareGoogle} onCredential={finishGoogle} disabled={Boolean(busy)} text="continue_with" /><button type="button" onClick={() => { setLinkChallenge(null); setNotice(null); }} disabled={Boolean(busy)} className={actionClass}>Cancel linking</button></div> : <button type="button" onClick={() => void beginGoogleLink()} disabled={actionsDisabled} className={`mt-4 ${actionClass}`}>Verify password to continue</button>}
      </section>
      <section aria-labelledby="passkey-options-title" className="min-w-0 rounded-2xl border border-obligon-border bg-white p-5 sm:p-6">
        <h2 id="passkey-options-title" className="flex items-center gap-2 text-xl font-bold"><Fingerprint size={22} aria-hidden="true" />Passkeys</h2>
        <p className="mt-2 text-sm leading-6 text-obligon-text">Your device may use a fingerprint, Face ID or device PIN. Biometric data stays on your device.</p>
        {config?.passkeys.enabled ? <><label htmlFor="passkey-label" className="mt-4 block text-sm font-bold">Passkey name</label><input id="passkey-label" value={label} onChange={event => setLabel(event.target.value)} maxLength={80} disabled={Boolean(busy)} className={fieldClass} /><button type="button" onClick={() => void addPasskey()} disabled={actionsDisabled || Boolean(unsupported) || !label.trim()} className={`mt-4 ${actionClass}`}>{busy === "passkey-add" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}Add a passkey</button>{unsupported ? <p className="mt-3 text-sm text-obligon-text">{unsupported}</p> : null}</> : <p className="mt-3 text-sm text-obligon-text">Passkeys are not enabled on this deployment.</p>}
        {data.passkeys.length ? <ul className="mt-6 divide-y divide-obligon-border">{data.passkeys.map(passkey => <li key={passkey.id} className="space-y-3 py-4"><div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-bold">{passkey.label}</h3><p className="mt-1 text-xs leading-5 text-obligon-text">Added {new Date(passkey.createdAt).toLocaleDateString("en-GB")} · {passkey.lastUsedAt ? `Last used ${new Date(passkey.lastUsedAt).toLocaleDateString("en-GB")}` : "Not used yet"}</p></div><button type="button" onClick={() => setRemoveId(passkey.id)} aria-expanded={removeId === passkey.id} disabled={Boolean(busy)} className={actionClass}>Remove</button></div>{removeId === passkey.id ? <div className="space-y-3 rounded-xl bg-obligon-mist p-4"><p className="text-sm">Remove “{passkey.label}”? Confirm your current password above, then remove this passkey.</p><div className="flex flex-wrap gap-3"><button type="button" onClick={() => void removePasskey(passkey.id)} disabled={actionsDisabled} className={actionClass}>Remove this passkey</button><button type="button" onClick={() => setRemoveId(null)} disabled={Boolean(busy)} className={actionClass}>Cancel</button></div></div> : null}</li>)}</ul> : <p className="mt-5 text-sm text-obligon-text">{config?.passkeys.enabled ? "No passkeys added. Confirm your password and add a passkey on a device you use." : "No passkeys added."}</p>}
      </section>
    </>}
  </div>;
}
