import type { SessionUser } from "@/lib/services/types";

export const SESSION_STORAGE_KEY = "obligon_session";
export const REMEMBER_EMAIL_KEY = "obligon_remember_email";

export function readPersistedSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function writePersistedSession(user: SessionUser | null): void {
  if (typeof window === "undefined") return;
  if (!user) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
}

export function readRememberedEmail(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
}

export function writeRememberedEmail(email: string, remember: boolean): void {
  if (typeof window === "undefined") return;
  if (remember && email) {
    window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
  } else {
    window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
  }
  window.localStorage.removeItem("obligon_remember_me");
}
