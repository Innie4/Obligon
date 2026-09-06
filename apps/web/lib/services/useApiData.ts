"use client";

import * as React from "react";
import type { AsyncStatus } from "@/lib/services/types";

export interface AsyncData<T> {
  data: T | null;
  status: AsyncStatus;
  error: string | null;
  reload: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Standard data-loading hook for dashboard pages: loading -> success/error,
 * with a manual reload for refresh buttons.
 */
export function useApiData<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncData<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [status, setStatus] = React.useState<AsyncStatus>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const loaderRef = React.useRef(loader);
  loaderRef.current = loader;

  React.useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    loaderRef.current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);
  return { data, status, error, reload, setData };
}
