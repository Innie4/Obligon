"use client";

import { ErrorFallback } from "@/components/shared/ErrorBoundary";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} onReset={reset} />;
}
