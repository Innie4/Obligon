"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowRight } from "lucide-react";
import { useSession } from "@/components/shared/AuthContext";
import { routes } from "@/components/site/routes";

const REDIRECT_DELAY_MS = 2500;

export function SuccessAutoRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status } = useSession();
  const [countdown, setCountdown] = useState(3);

  const redirectParam = searchParams.get("redirect");

  // Determine target destination based on query param or user's role
  const targetDestination = redirectParam && redirectParam.startsWith("/")
    ? redirectParam
    : user?.role === "admin"
      ? routes.adminDashboard
      : user?.role === "company"
        ? routes.companyDashboard
        : user?.role === "partner"
          ? routes.dashboard
          : routes.customerDashboard;

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    const redirectTimer = setTimeout(() => {
      router.replace(targetDestination);
    }, REDIRECT_DELAY_MS);

    return () => {
      clearInterval(timer);
      clearTimeout(redirectTimer);
    };
  }, [targetDestination, router]);

  return (
    <div className="mt-8 space-y-4 text-center">
      <p className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-obligon-text">
        <Loader2 size={16} className="animate-spin text-obligon-green" />
        Redirecting to dashboard in {countdown}s...
      </p>
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
