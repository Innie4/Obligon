"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

const REDIRECT_DELAY_MS = 3000;

export function SuccessAutoRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  useEffect(() => {
    if (!redirect || !redirect.startsWith("/")) {
      return;
    }

    const timer = setTimeout(() => {
      router.replace(redirect);
    }, REDIRECT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [redirect, router]);

  if (!redirect) {
    return null;
  }

  return (
    <p className="mx-auto mt-6 inline-flex w-full items-center justify-center gap-2 text-sm font-semibold text-obligon-text">
      <Loader2 size={16} className="animate-spin text-obligon-green" />
      Taking you to your dashboard...
    </p>
  );
}
