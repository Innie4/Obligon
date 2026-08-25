"use client";

import * as React from "react";

export type AsyncStatus = "loading" | "success" | "error";

export interface AsyncResult<T> {
  status: AsyncStatus;
  data: T | null;
  error: Error | null;
  reload: () => void;
}

/**
 * Runs an async function (typically an `api.*` call) and tracks loading /
 * success / error. Pass `deps` to re-run when inputs change. The result is
 * meant to be fed into <AsyncBoundary> for consistent UI states.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList = []): AsyncResult<T> {
  const [status, setStatus] = React.useState<AsyncStatus>("loading");
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [nonce, setNonce] = React.useState(0);

  const fnRef = React.useRef(fn);
  fnRef.current = fn;

  React.useEffect(() => {
    let active = true;
    setStatus("loading");
    fnRef
      .current()
      .then((result) => {
        if (!active) return;
        setData(result);
        setStatus("success");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("error");
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { status, data, error, reload: () => setNonce((n) => n + 1) };
}
