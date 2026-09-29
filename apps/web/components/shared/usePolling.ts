"use client";

import * as React from "react";

export interface PollingOptions {
  /** Interval in milliseconds. */
  intervalMs?: number;
  /**
   * Turn polling on and off. Polling a page the user cannot see is pure load on
   * the API and the database, with nothing on screen to update.
   */
  enabled?: boolean;
}

/**
 * Calls `tick` on an interval for as long as the page is visible.
 *
 * Two behaviours matter for anything watching a balance:
 *
 * 1. It pauses when the tab is hidden. A customer who switches tabs to do the
 *    bank transfer should not be paying for a timer that updates an invisible
 *    page, and on return the first thing they see must be current.
 * 2. It ticks once on becoming visible again, rather than waiting out the
 *    remainder of the interval. The whole point is that the number on screen is
 *    not stale, and a user who just came back to the tab is exactly when stale
 *    data is read.
 */
export function usePolling(tick: () => void, { intervalMs = 5000, enabled = true }: PollingOptions = {}): void {
  // Held in a ref so a caller passing an inline arrow does not reset the timer
  // on every render, which would mean the interval never actually fires.
  const tickRef = React.useRef(tick);
  tickRef.current = tick;

  React.useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    const run = () => {
      if (document.visibilityState !== "visible") return;
      tickRef.current();
    };

    const interval = window.setInterval(run, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, enabled]);
}
