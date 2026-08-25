"use client";

import * as React from "react";
import { ToastProvider } from "@/components/shared/Toast";
import { AuthProvider } from "@/components/shared/AuthContext";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AuthProvider>
    </ToastProvider>
  );
}
