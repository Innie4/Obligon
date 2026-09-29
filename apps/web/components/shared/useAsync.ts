"use client";

import * as React from "react";

export type AsyncStatus = "loading" | "success" | "error";

export interface AsyncResult<T> {
  status: AsyncStatus;
  data: T | null;
  error: Error | null;
  reload: () => void;
  /**
   * Re-fetches without moving the status back to "loading". Polling needs this:
   * a background balance check must not replace a populated page with a
   * skeleton every few seconds, which reads as a fault to the user.
   */
  refresh: () => void;
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
  // Kept separate from `nonce` so a silent refresh can skip the "loading" state,
  // and because a full reload and a background poll are different intentions.
  const [silentNonce, setSilentNonce] = React.useState(0);

  const fnRef = React.useRef(fn);
  fnRef.current = fn;

  // A poll can outlive its interval on a slow network. Without this the requests
  // queue up and responses can arrive out of order, leaving the balance showing
  // a value older than the one already on screen.
  const inFlight = React.useRef(false);

  React.useEffect(() => {
    let active = true;
    inFlight.current = true;
    setStatus("loading");
    fnRef
      .current()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
        setStatus("success");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("error");
      })
      .finally(() => {
        inFlight.current = false;
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  React.useEffect(() => {
    if (silentNonce === 0) return;
    let active = true;
    // Dropped rather than queued. Polling fires again on its own interval, so a
    // request that would have to wait is not one worth holding onto: the value it
    // would return is already superseded by the time it could run.
    if (inFlight.current) return;
    inFlight.current = true;
    fnRef
      .current()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
        // Only success once data exists, so a silent refresh during the very
        // first load cannot briefly claim success with nothing to show.
        setStatus((current) => (current === "loading" ? "success" : current));
      })
      .catch((err) => {
        if (!active) return;
        // A failed background poll keeps the last known good data on screen. The
        // previous version replaced the page with an error for a transient blip.
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        inFlight.current = false;
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silentNonce]);

  return {
    status,
    data,
    error,
    reload: () => setNonce((n) => n + 1),
    refresh: () => setSilentNonce((n) => n + 1)
  };
}
