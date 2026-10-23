"use client";

import * as React from "react";
import { authMethodError, loadGoogleIdentity, type GoogleChallenge } from "@/lib/auth-methods";

export function GoogleIdentityButton({ prepare, onCredential, disabled = false, onBusyChange, text = "signin_with" }: {
  prepare: () => Promise<GoogleChallenge>;
  onCredential: (challenge: GoogleChallenge, credential: string) => Promise<void>;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  text?: "signin_with" | "continue_with";
}) {
  const container = React.useRef<HTMLDivElement>(null);
  const busy = React.useRef(false);
  const disabledRef = React.useRef(disabled);
  const previouslyDisabled = React.useRef(disabled);
  disabledRef.current = disabled;
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retry, setRetry] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    let observer: ResizeObserver | undefined;
    setLoading(true);
    setError(null);
    const host = container.current;
    async function prepareButton() {
      try {
        const api = await loadGoogleIdentity();
        if (!active) return;
        const challenge = await prepare();
        if (!active || !host) return;
        api.initialize({ client_id: challenge.clientId, nonce: challenge.nonce, auto_select: false, ux_mode: "popup", callback: response => {
          if (!active || busy.current || disabledRef.current) return;
          if (!response.credential) { setError("Google did not complete sign-in. Please try again."); return; }
          busy.current = true;
          onBusyChange?.(true);
          void onCredential(challenge, response.credential).catch(failure => { if (active) setError(authMethodError(failure)); }).finally(() => {
            busy.current = false;
            if (active) onBusyChange?.(false);
          });
        } });
        let previousWidth = 0;
        const render = () => {
          if (!active) return;
          const width = Math.min(400, Math.max(200, Math.floor(host.clientWidth)));
          if (width === previousWidth) return;
          previousWidth = width;
          host.replaceChildren();
          api.renderButton(host, { type: "standard", theme: "outline", size: "large", text, shape: "rectangular", width });
        };
        render();
        if (typeof ResizeObserver !== "undefined") { observer = new ResizeObserver(render); observer.observe(host); }
        setLoading(false);
      } catch (failure) {
        if (active) { setError(authMethodError(failure)); setLoading(false); }
      }
    }
    void prepareButton();
    return () => { active = false; observer?.disconnect(); host?.replaceChildren(); };
  }, [prepare, onCredential, onBusyChange, retry, text]);

  React.useEffect(() => {
    const wasDisabled = previouslyDisabled.current;
    previouslyDisabled.current = disabled;
    // Another sign-in attempt can invalidate the prepared nonce without a Google callback.
    if (wasDisabled && !disabled && !busy.current && !error) setRetry(value => value + 1);
  }, [disabled, error]);

  return <div className="min-w-0 space-y-2">
    {loading ? <p role="status" className="text-sm text-obligon-text">Loading Google sign-in...</p> : null}
    <div ref={container} inert={disabled} aria-label="Google sign-in" aria-disabled={disabled} className={`flex min-h-11 w-full min-w-0 justify-center ${disabled ? "pointer-events-none opacity-50" : ""}`} />
    {error ? <div className="space-y-2 text-sm"><p role="alert" className="text-red-700">{error}</p><button type="button" disabled={disabled} onClick={() => setRetry(value => value + 1)} className="min-h-11 font-bold text-obligon-green underline disabled:opacity-50">Reload Google sign-in</button></div> : null}
  </div>;
}
