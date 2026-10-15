"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { signInDestination } from "@/lib/auth-routing";

export default function AuthFailurePage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    // Read search params from URL
    const urlParams = new URLSearchParams(window.location.search);
    const fromError = urlParams.get("error");
    setServerError(fromError ?? null);
  }, []);

  const handleRetry = () => {
    const returnPath = new URLSearchParams(window.location.search).get("returnUrl");
    router.push(signInDestination(returnPath));
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
