"use client";

import { ErrorFallback } from "@/components/shared/ErrorBoundary";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ErrorFallback error={error} onReset={reset} />
      </body>
    </html>
  );
}
