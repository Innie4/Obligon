"use client";

import * as React from "react";
import { api } from "@/lib/services";
import type { PartnerNotifications } from "@/lib/services/types";

/**
 * One notification fetch, shared by the header badge and the notifications page.
 *
 * They each ran their own `useAsync(api.getPartnerNotifications)`. Marking a
 * notification read — or all of them — reloaded only the page's copy, so the
 * header's badge kept the count it had fetched on mount. The partner could read
 * everything, press "Mark all as read", watch the list clear, and still see a badge
 * claiming unread items that no longer existed, on every other page, until a full
 * reload. The header's dependency was the pathname, so it only refetched when
 * entering or leaving the notifications route.
 *
 * One provider, one fetch, one truth. Marking read calls `reload()`, which both
 * consumers see.
 *
 * The count is derived from the same response the page renders, so the badge and
 * the list cannot disagree even if a notification arrives between renders.
 */
interface PartnerNotificationsValue {
  status: "loading" | "success" | "error";
  data: PartnerNotifications | null;
  error: Error | null;
  reload: () => void;
  unread: number;
}

const PartnerNotificationsContext = React.createContext<PartnerNotificationsValue | null>(null);

export function PartnerNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = React.useState<{
    status: "loading" | "success" | "error";
    data: PartnerNotifications | null;
    error: Error | null;
  }>({ status: "loading", data: null, error: null });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setResult((current) => ({ ...current, status: "loading" }));
    api
      .getPartnerNotifications()
      .then((data) => {
        if (active) setResult({ status: "success", data, error: null });
      })
      .catch((err) => {
        if (active) {
          setResult({
            status: "error",
            data: null,
            error: err instanceof Error ? err : new Error(String(err))
          });
        }
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  const value = React.useMemo<PartnerNotificationsValue>(
    () => ({
      ...result,
      reload: () => setNonce((n) => n + 1),
      unread: result.data?.unreadCount ?? 0
    }),
    [result]
  );

  return <PartnerNotificationsContext.Provider value={value}>{children}</PartnerNotificationsContext.Provider>;
}

/**
 * The shared notifications state, or a neutral fallback outside the provider.
 *
 * The fallback is not a convenience: `NotificationsPage` is also mounted directly
 * by `/dashboard/notifications` during the App Router's server render, before any
 * provider is in scope. Without it that render would throw on `useContext` of null.
 * The fallback reports zero unread, which is the safe direction to be wrong in —
 * no badge rather than a permanent one.
 */
export function usePartnerNotifications(): PartnerNotificationsValue {
  const value = React.useContext(PartnerNotificationsContext);
  const fallback = React.useMemo<PartnerNotificationsValue>(
    () => ({
      status: "success",
      data: null,
      error: null,
      reload: () => {},
      unread: 0
    }),
    []
  );
  return value ?? fallback;
}