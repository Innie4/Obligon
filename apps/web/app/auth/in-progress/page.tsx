"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { routes } from "@/components/site/routes";
import { api } from "@/lib/services";
import type { SessionUser } from "@/lib/services/types";

/**
 * Pending/success/failure state machine driven by the real auth session
 * endpoint (`/api/auth/session`), with a retry path and a safe redirect
 * destination derived from the verified role.
 */
export default function AuthInProgressPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"progress" | "success" | "failure">("progress");
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState<string>(routes.dashboard);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromReturnUrl = urlParams.get("returnUrl");
    const fromError = urlParams.get("error");

    setReturnUrl(fromReturnUrl ?? routes.dashboard);
    if (fromError) {
      setStatus("failure");
      setServerError(fromError);
      return;
    }

    let active = true;
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
        setStatus("success");
        setMessage("Session secured. Redirecting...");
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (!active) return;
        const destination =
          user.role === "admin"
            ? routes.adminDashboard
            : user.role === "company"
              ? routes.companyDashboard
              : user.role === "partner" || user.role === "mechanic"
                ? routes.dashboard
                : routes.customerDashboard;
        router.push(returnUrl?.startsWith("/") ? returnUrl : destination);
      } catch {
        if (!active) return;
        setStatus("failure");
        setServerError("Session verification failed. Please try signing in again.");
      }
    })();

    return () => {
      active = false;
    };
  }, [router, returnUrl, nonce]);

  const handleRetry = () => {
    setNonce((n) => n + 1);
  };

  return (
    <AuthShell compact>
      <AuthStatus
        status={status}
        message={status === "success" ? "Session secured. Redirecting..." : undefined}
        serverError={serverError ?? undefined}
        onRetry={handleRetry}
      />
    </AuthShell>
  );
}
