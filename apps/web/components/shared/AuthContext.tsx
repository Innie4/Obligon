"use client";

import * as React from "react";
import { api, authApi, mutationsApi } from "@/lib/services";
import { readPersistedSession, writePersistedSession, readRememberedEmail, writeRememberedEmail } from "@/lib/session-store";
import type { SessionUser, UserRole } from "@/lib/services/types";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: SessionStatus;
  user: SessionUser | null;
  /** Exchange credentials with the backend and store the session. */
  login: (payload: { email: string; password: string; role?: UserRole; rememberMe?: boolean; totp?: string }) => Promise<{ mfaRequired?: boolean }>;
  /** Invalidate the server session/token and clear local state. */
  logout: () => Promise<void>;
  /** Replace the current user (used by dashboards that resolve a role-specific profile). */
  setUser: (user: SessionUser | null) => void;
  /** Update current user's profile fields (local + server). */
  updateProfile: (partial: Partial<SessionUser>) => void;
  /** Re-fetch the session from the service layer. */
  refresh: () => Promise<void>;
  rememberedEmail: string;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<SessionStatus>("loading");
  const [user, setUserState] = React.useState<SessionUser | null>(null);
  const [rememberedEmail, setRememberedEmail] = React.useState("");

  React.useEffect(() => {
    setRememberedEmail(readRememberedEmail());
  }, []);

  const setUser = React.useCallback((next: SessionUser | null) => {
    writePersistedSession(next);
    setUserState(next);
    setStatus(next ? "authenticated" : "unauthenticated");
  }, []);

  const updateProfile = React.useCallback((partial: Partial<SessionUser>) => {
    setUserState((current) => {
      if (!current) return current;
      const updated: SessionUser = { ...current, ...partial };
      if (partial.name) {
        updated.initials = initialsFromName(partial.name);
      }
      writePersistedSession(updated);
      return updated;
    });
    // Best-effort server sync for profile fields
    if (partial.name || partial.phone || partial.address) {
      void mutationsApi.updateProfile({
        fullName: partial.name,
        phone: partial.phone,
        address: partial.address
      }).catch(() => undefined);
    }
  }, []);

  const refresh = React.useCallback(async () => {
    setStatus("loading");
    try {
      const session = await api.getSession();
      setUserState(session);
      setStatus(session ? "authenticated" : "unauthenticated");
    } catch {
      setUserState(null);
      setStatus("unauthenticated");
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = React.useCallback(
    async (payload: { email: string; password: string; role?: UserRole; rememberMe?: boolean; totp?: string }) => {
      if (!payload.email || !payload.password) {
        throw new Error("Enter your email and password to continue.");
      }
      const result = await authApi.login({
        email: payload.email,
        password: payload.password,
        rememberMe: payload.rememberMe,
        role: payload.role,
        totp: payload.totp
      });
      writeRememberedEmail(payload.email, Boolean(payload.rememberMe));
      setRememberedEmail(payload.rememberMe ? payload.email : "");
      if (result.mfaRequired) {
        return { mfaRequired: true };
      }
      setUserState(result.user);
      writePersistedSession(result.user);
      setStatus("authenticated");
      return { mfaRequired: false };
    },
    []
  );

  const logout = React.useCallback(async () => {
    await authApi.logout();
    setUserState(null);
    setStatus("unauthenticated");
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, setUser, updateProfile, refresh, rememberedEmail }),
    [status, user, login, logout, setUser, updateProfile, refresh, rememberedEmail]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useSession must be used within an <AuthProvider>");
  }
  return ctx;
}
