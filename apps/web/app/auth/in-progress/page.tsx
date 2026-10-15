"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { api } from "@/lib/services";
import type { SessionUser } from "@/lib/services/types";
import { dashboardDestination, safeInternalPath, signInDestination } from "@/lib/auth-routing";

/**
 * Pending/success/failure state machine driven by the real auth session
 * endpoint (`/api/auth/session`), with a retry path and a safe redirect
 * destination derived from the verified role.
 */
export default function AuthInProgressPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"progress" | "success" | "failure">("progress");
  const [serverError, setServerError] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromReturnUrl = urlParams.get("returnUrl");
    const fromError = urlParams.get("error");

    if (fromError) {
      setStatus("failure");
      setServerError(fromError);
      return;
    }

    let active = true;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;
    setStatus("progress");
    setServerError(null);

    (async () => {
      try {
        const user = (await api.getSession()) as SessionUser | null;
        if (!active) return;
        if (!user) {
          setStatus("failure");
          setServerError("Your session could not be verified. Please sign in again.");
          return;
        }
        const nextPath = safeInternalPath(fromReturnUrl) ?? dashboardDestination(user.role);
        setDestination(nextPath);
        setStatus("success");
        redirectTimer = setTimeout(() => {
          if (active) router.push(nextPath);
        }, 1200);
      } catch {
        if (!active) return;
        setStatus("failure");
        setServerError("Session verification failed. Please try signing in again.");
      }
    })();

    return () => {
      active = false;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [router]);

  const handleRetry = () => {
    const returnPath = new URLSearchParams(window.location.search).get("returnUrl");
    router.push(signInDestination(returnPath));
  };

  return (
    <AuthShell compact>
      <AuthStatus
        status={status}
        message={status === "success" ? "Session verified. Redirecting..." : "Checking your sign-in session..."}
        serverError={serverError ?? undefined}
        redirect={destination ?? undefined}
        onRetry={handleRetry}
      />
    </AuthShell>
  );
}
