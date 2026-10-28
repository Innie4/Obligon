"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { authenticatedRequest } from "@/lib/services";
import { useSession } from "@/components/shared/AuthContext";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { SubscriptionPanel } from "@/components/shared/SubscriptionPanel";

type Access = { active: boolean; expiresAt?: string | null; subscription?: { current_period_end?: string } | null };

export function CompanySubscriptionGate({ children, protectedSection = false }: { children: React.ReactNode; protectedSection?: boolean }) {
  const { user } = useSession();
  const pathname = usePathname();
  const exempt = !protectedSection && /^\/company\/(billing|settings|support|notifications)(\/|$)/.test(pathname);
  const [data, setData] = React.useState<Access | null>(null);
  const [error, setError] = React.useState("");
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    setData(null);
    setError("");
    if (!exempt) void authenticatedRequest<Access>("/api/company/subscription")
      .then(result => {
        if (!alive) return;
        const expiresAt = result.expiresAt ?? result.subscription?.current_period_end;
        const delay = expiresAt ? new Date(expiresAt).getTime() - Date.now() : NaN;
        setData(Number.isFinite(delay) && delay <= 0 ? { ...result, active: false } : result);
        if (result.active && Number.isFinite(delay) && delay > 0) expiryTimer = setTimeout(() => {
          setData(null);
          setRevision(value => value + 1);
        }, Math.min(delay, 2_147_483_647));
      })
      .catch(failure => { if (alive) setError(failure.message); });
    return () => { alive = false; if (expiryTimer) clearTimeout(expiryTimer); };
  }, [user?.organizationId, pathname, exempt, revision]);
  if (exempt) return <>{children}</>;
  if (error) return <StatusPopup tone="error" title="Your Organization subscription could not be checked." message={error} onRetry={() => setRevision(value => value + 1)} />;
  if (!data) return <StatusPopup tone="loading" message="Checking Organization subscription…" />;
  return data.active ? <>{children}</> : protectedSection ? null : <SubscriptionPanel kind="company" onSubscriptionChange={() => setRevision(value => value + 1)} />;
}
