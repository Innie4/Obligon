"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { routes } from "@/components/site/routes";

export default function AuthFailurePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"progress" | "success" | "failure">("failure");
  const [serverError, setServerError] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState<string>(routes.login);

  useEffect(() => {
    // Read search params from URL
    const urlParams = new URLSearchParams(window.location.search);
    const fromError = urlParams.get("error");
    const fromReturnUrl = urlParams.get("returnUrl");

    setServerError(fromError ?? null);
    setReturnUrl(fromReturnUrl ?? routes.login);
  }, [router]);

  const handleRetry = () => {
    setStatus("progress");
    setServerError(null);
    router.refresh();
  };

  return (
    <AuthShell compact>
      <AuthStatus
        status="failure"
        serverError={serverError ?? undefined}
        onRetry={handleRetry}
      />
    </AuthShell>
  );
}