"use client";

import * as React from "react";
import { ToastProvider, ToastScope } from "@/components/shared/Toast";
import { AuthProvider, useSession } from "@/components/shared/AuthContext";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

function SessionToastScope({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const scopeKey = JSON.stringify(user ? [user.id, user.role, user.organizationType ?? null, user.organizationId ?? null] : [null]);
  return <ToastScope scopeKey={scopeKey}>{children}</ToastScope>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SessionToastScope><ErrorBoundary>{children}</ErrorBoundary></SessionToastScope>
      </AuthProvider>
    </ToastProvider>
  );
}
