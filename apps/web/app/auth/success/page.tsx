import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { SuccessAutoRedirect } from "@/components/auth/SuccessAutoRedirect";

export default function AuthSuccessPage() {
  return (
    <AuthShell compact>
      <Suspense fallback={null}>
        <SuccessAutoRedirect />
      </Suspense>
      <AuthStatus status="success" />
    </AuthShell>
  );
}