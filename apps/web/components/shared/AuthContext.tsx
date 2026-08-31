"use client";

import * as React from "react";
import { api } from "@/lib/services";
import { sessionUser } from "@/lib/mock/customer-data";
import { readPersistedSession, writePersistedSession } from "@/lib/session-store";
import type { SessionUser, UserRole } from "@/lib/services/types";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: SessionStatus;
  user: SessionUser | null;
  /** Future: exchange credentials with the backend and store the session. */
  login: (payload: { email: string; password: string; role?: UserRole }) => Promise<void>;
  /** Future: invalidate the server session/token. */
  logout: () => void;
  /** Replace the current user (used by dashboards that resolve a role-specific profile). */
  setUser: (user: SessionUser | null) => void;
  /** Update current user's profile fields. */
  updateProfile: (partial: Partial<SessionUser>) => void;
  /** Re-fetch the session from the service layer. */
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "User";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "User";
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<SessionStatus>("loading");
  const [user, setUserState] = React.useState<SessionUser | null>(null);

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

  const login = React.useCallback(async (payload: { email: string; password: string; role?: UserRole }) => {
    if (!payload.email || payload.password.length < 8) {
      throw new Error("Invalid credentials. Please try again.");
    }

    const name = displayNameFromEmail(payload.email);
    const next: SessionUser = {
      ...sessionUser,
      id: `usr_${payload.email.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`,
      email: payload.email,
      name,
      initials: initialsFromName(name),
      role: payload.role ?? "customer"
    };

    writePersistedSession(next);
    setUserState(next);
    setStatus("authenticated");
  }, []);

  const logout = React.useCallback(() => {
    writePersistedSession(null);
    setUserState(null);
    setStatus("unauthenticated");
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, setUser, updateProfile, refresh }),
    [status, user, login, logout, setUser, updateProfile, refresh]
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
