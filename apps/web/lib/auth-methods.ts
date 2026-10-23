import type { startAuthentication, startRegistration } from "@simplewebauthn/browser";

export type PasskeyAuthenticationOptions = Parameters<typeof startAuthentication>[0]["optionsJSON"];
export type PasskeyRegistrationOptions = Parameters<typeof startRegistration>[0]["optionsJSON"];
export type PasskeyAuthenticationCredential = Awaited<ReturnType<typeof startAuthentication>>;
export type PasskeyRegistrationCredential = Awaited<ReturnType<typeof startRegistration>>;

export interface AuthMethodsConfig {
  google: { enabled: boolean; clientId?: string };
  passkeys: { enabled: boolean; rpName: string };
}
export interface GoogleChallenge { challengeId: string; clientId: string; nonce: string }
export interface SignInMethods {
  google: { enabled: boolean; linked: boolean };
  passkeys: Array<{ id: string; label: string; createdAt: string; lastUsedAt: string | null; deviceType: string; backedUp: boolean }>;
}

export function passkeySupportError(): string | null {
  if (typeof window === "undefined" || !window.isSecureContext) return "Passkeys need a secure connection. Open this site with HTTPS.";
  if (typeof window.PublicKeyCredential === "undefined") return "This browser does not support passkeys. Try a current browser or sign in with your password.";
  return null;
}

export async function authenticateWithPasskey(optionsJSON: PasskeyAuthenticationOptions): Promise<PasskeyAuthenticationCredential> {
  const unsupported = passkeySupportError();
  if (unsupported) throw new Error(unsupported);
  const { startAuthentication: authenticate } = await import("@simplewebauthn/browser");
  return authenticate({ optionsJSON });
}

export async function registerDevicePasskey(optionsJSON: PasskeyRegistrationOptions): Promise<PasskeyRegistrationCredential> {
  const unsupported = passkeySupportError();
  if (unsupported) throw new Error(unsupported);
  const { startRegistration: register } = await import("@simplewebauthn/browser");
  return register({ optionsJSON });
}

export function authMethodError(error: unknown): string {
  const detail = error as { name?: string; code?: string; cause?: { name?: string } } | null;
  const name = detail?.cause?.name ?? detail?.name ?? "";
  if (name === "NotAllowedError" || name === "AbortError" || detail?.code === "ERROR_CEREMONY_ABORTED") return "The passkey request was cancelled or timed out. Try again or use your password.";
  if (name === "InvalidStateError") return "This passkey is already registered. Choose another passkey or use one you have already added.";
  if (name === "SecurityError") return "The passkey could not be used on this site. Check that you opened the correct HTTPS address.";
  return error instanceof Error ? error.message : "We could not complete that request. Please try again.";
}

export interface GoogleIdentityApi {
  initialize(options: { client_id: string; nonce: string; callback: (response: { credential?: string }) => void; auto_select: false; ux_mode: "popup" }): void;
  renderButton(element: HTMLElement, options: { type: "standard"; theme: "outline"; size: "large"; text: "signin_with" | "continue_with"; shape: "rectangular"; width: number }): void;
}

let googleLoading: Promise<GoogleIdentityApi> | null = null;
const googleScriptUrl = "https://accounts.google.com/gsi/client";

export function loadGoogleIdentity(): Promise<GoogleIdentityApi> {
  const current = () => (window as unknown as { google?: { accounts?: { id?: GoogleIdentityApi } } }).google?.accounts?.id;
  if (typeof window === "undefined") return Promise.reject(new Error("Google sign-in is only available in a browser."));
  const ready = current();
  if (ready) return Promise.resolve(ready);
  if (googleLoading) return googleLoading;
  googleLoading = new Promise<GoogleIdentityApi>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => { script.remove(); googleLoading = null; reject(new Error("Google sign-in took too long to load. Please try again.")); }, 15000);
    script.src = googleScriptUrl;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timer);
      const api = current();
      if (api) resolve(api);
      else { googleLoading = null; reject(new Error("Google sign-in did not load. Please try again.")); }
    };
    script.onerror = () => { window.clearTimeout(timer); script.remove(); googleLoading = null; reject(new Error("Google sign-in could not load. Check your connection and try again.")); };
    document.head.appendChild(script);
  });
  return googleLoading;
}
