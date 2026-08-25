"use client";

import * as React from "react";
import { api } from "@/lib/services";
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
  /** Re-fetch the session from the service layer. */
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<SessionStatus>("loading");
  const [user, setUser] = React.useState<SessionUser | null>(null);

  const refresh = React.useCallback(async () => {
    setStatus("loading");
    try {
      const session = await api.getSession();
      setUser(session);
      setStatus(session ? "authenticated" : "unauthenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = React.useCallback(async (_payload: { email: string; password: string; role?: UserRole }) => {
    // TODO: wire to real auth endpoint once available. For now re-read the mock session.
    await refresh();
  }, [refresh]);

  const logout = React.useCallback(() => {
    // TODO: call api.request("/auth/logout", { method: "POST" }) once the backend exists.
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, setUser, refresh }),
    [status, user, login, logout, refresh]
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
