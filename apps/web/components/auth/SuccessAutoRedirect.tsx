"use client";

import { StatusPopup } from "@/components/shared/StatusPopup";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSession } from "@/components/shared/AuthContext";
import { routes } from "@/components/site/routes";
import { dashboardDestination, safeInternalPath } from "@/lib/auth-routing";

const REDIRECT_DELAY_MS = 2500;

export function SuccessAutoRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status } = useSession();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const redirectParam = searchParams.get("redirect");

  const sessionReady = status === "authenticated" && Boolean(user);
  const targetDestination = safeInternalPath(redirectParam) ?? dashboardDestination(user?.role);

  useEffect(() => {
    if (status === "loading") return;
    if (!sessionReady) {
      router.replace(routes.login);
      return;
    }
    const redirectTimer = setTimeout(() => {
      router.replace(targetDestination);
    }, REDIRECT_DELAY_MS);

    return () => {
      clearTimeout(redirectTimer);
    };
  }, [status, sessionReady, targetDestination, router]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="mt-8 text-center">
        {!hydrated || status === "loading" ? (
          <StatusPopup tone="loading" message="Checking your sign-in session…" />
        ) : (
          <Link href={routes.login} className="inline-flex rounded-lg bg-obligon-green px-6 py-3 text-sm font-bold text-white shadow-green">
            Sign in to continue
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4 text-center">
      <StatusPopup tone="pending" message="Opening your dashboard…" />
      <div>
        <Link
          href={targetDestination}
          className="inline-flex items-center gap-2 rounded-lg bg-obligon-green px-6 py-3 text-sm font-bold text-white shadow-green hover:bg-obligon-green/90 transition"
        >
          Go to Dashboard Now
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
