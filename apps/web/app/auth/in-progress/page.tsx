"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { routes } from "@/components/site/routes";

export default function AuthInProgressPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"progress" | "success" | "failure">("progress");
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState<string>("dashboard");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Read search params from URL
    const urlParams = new URLSearchParams(window.location.search);
    const fromReturnUrl = urlParams.get("returnUrl");
    const fromError = urlParams.get("error");

    setReturnUrl(fromReturnUrl ?? routes.dashboard);
    setError(fromError ?? null);

    if (fromError) {
      setStatus("failure");
      setServerError(fromError);
      return;
    }

    // In a real app, this would poll an auth status endpoint
    // For now, simulate the flow
    const checkAuth = async () => {
      try {
        setStatus("success");
        setMessage("Session secured. Redirecting...");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        router.push(returnUrl);
      } catch {
        setStatus("failure");
        setMessage("Session verification failed. Please try logging in again.");
        setServerError("Session verification failed. Please try logging in again.");
      }
    };

    checkAuth();
  }, [router]);

  const handleRetry = () => {
    setStatus("progress");
    setMessage(null);
    setServerError(null);
    router.refresh();
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