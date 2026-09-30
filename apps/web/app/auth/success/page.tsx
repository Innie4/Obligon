import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SuccessAutoRedirect } from "@/components/auth/SuccessAutoRedirect";
import { SuccessHonesty } from "@/components/auth/SuccessHonesty";

/**
 * Shown after signup, once verification is done.
 *
 * This used to state "Identity Verified" and "Your profile and security
 * credentials have been verified" unconditionally, while signup verified
 * nothing at all — it sent one email code and redirected straight here. It now
 * reports the flags the session actually carries, so the page cannot claim
 * something the account has not done.
 */
export default function AuthSuccessPage() {
  return (
    <AuthShell compact>
      <SuccessHonesty />
      <Suspense fallback={<p className="mt-6 text-sm text-obligon-text">Redirecting to dashboard...</p>}>
        <SuccessAutoRedirect />
      </Suspense>
    </AuthShell>
  );
}
