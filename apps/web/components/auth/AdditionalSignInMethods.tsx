"use client";

import { StatusPopup } from "@/components/shared/StatusPopup";

import * as React from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { authApi } from "@/lib/services";
import { authMethodError, passkeySupportError, type AuthMethodsConfig, type GoogleChallenge } from "@/lib/auth-methods";
import { useSession } from "@/components/shared/AuthContext";
import { GoogleIdentityButton } from "./GoogleIdentityButton";

export function AdditionalSignInMethods({ rememberMe, disabled, onComplete, onBusyChange }: {
  rememberMe: boolean;
  disabled: boolean;
  onComplete: (result: { mfaRequired?: boolean }) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { loginWithGoogle, loginWithPasskey } = useSession();
  const [config, setConfig] = React.useState<AuthMethodsConfig | null>(null);
  const [configError, setConfigError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [unsupported, setUnsupported] = React.useState<string | null>(null);
  const inFlight = React.useRef(false);
  const active = React.useRef(true);
  React.useEffect(() => {
    let current = true;
    active.current = true;
    setUnsupported(passkeySupportError());
    void authApi.methodsConfig().then(value => { if (current && active.current) setConfig(value); }).catch(() => { if (current && active.current) setConfigError("Additional sign-in methods are unavailable right now. You can still use your password."); });
    return () => { current = false; active.current = false; };
  }, []);

  const setMethodBusy = React.useCallback((value: boolean) => { inFlight.current = value; if (active.current) { setBusy(value); onBusyChange(value); } }, [onBusyChange]);
  const prepareGoogle = React.useCallback(() => authApi.googleStart(rememberMe), [rememberMe]);
  const finishGoogle = React.useCallback(async (challenge: GoogleChallenge, credential: string) => {
    const result = await loginWithGoogle(challenge, credential);
    if (active.current) onComplete(result);
  }, [loginWithGoogle, onComplete]);

  async function signInWithPasskey() {
    if (inFlight.current || disabled || !config?.passkeys.enabled || unsupported) return;
    setMethodBusy(true);
    setError(null);
    try { const result = await loginWithPasskey(rememberMe); if (active.current) onComplete(result); }
    catch (failure) { if (active.current) setError(authMethodError(failure)); }
    finally { setMethodBusy(false); }
  }

  return <section aria-labelledby="additional-sign-in-title" className="mt-6 min-w-0 border-t border-obligon-border pt-5">
    <h3 id="additional-sign-in-title" className="text-center text-sm font-bold text-obligon-navy">Other ways to sign in</h3>
    <p className="mt-2 text-xs leading-5 text-obligon-text">Link Google or add a passkey in Sign-in options after signing in with your password.</p>
    <div className="mt-4 space-y-4">
      {configError ? <StatusPopup tone="warning" message={configError} /> : !config ? <StatusPopup tone="loading" message="Checking sign-in options…" /> : <>
        {config.google.enabled && config.google.clientId ? <GoogleIdentityButton prepare={prepareGoogle} onCredential={finishGoogle} disabled={disabled || busy} onBusyChange={setMethodBusy} /> : <p className="text-xs text-obligon-text">Google sign-in is not configured for this deployment.</p>}
        {config.passkeys.enabled ? <div className="space-y-2"><button type="button" onClick={() => void signInWithPasskey()} disabled={disabled || busy || Boolean(unsupported)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-obligon-green bg-white px-4 font-bold text-obligon-green disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Fingerprint size={20} aria-hidden="true" />}Sign in with a passkey</button><p className="text-xs leading-5 text-obligon-text">{unsupported ?? "Your device may ask for a fingerprint, Face ID or device PIN. Biometric data stays on your device."}</p></div> : <p className="text-xs text-obligon-text">Passkey sign-in is not enabled on this deployment.</p>}
      </>}
      {error ? <StatusPopup tone="error" message={error} /> : null}
      {busy ? <StatusPopup tone="pending" message="Completing sign-in…" /> : null}
    </div>
  </section>;
}
