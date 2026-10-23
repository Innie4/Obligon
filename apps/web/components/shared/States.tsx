"use client";

import * as React from "react";
import { Inbox, Loader2, TriangleAlert, type LucideProps } from "lucide-react";
import type { AsyncStatus } from "@/lib/services/types";

export function LoadingState({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`flex min-h-48 flex-col items-center justify-center gap-4 px-5 py-12 text-obligon-text ${className}`}>
      <Loader2 size={24} aria-hidden="true" className="animate-spin text-obligon-green" />
      <p className="text-sm font-medium leading-6">{label}</p>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-obligon-panel ${className}`} />;
}

export function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  message,
  action
}: {
  icon?: React.ComponentType<LucideProps>;
  title?: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-5 py-12 text-center">
      <span className="mb-1 text-obligon-green">
        <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="font-display text-lg font-bold tracking-tight text-obligon-navy">{title}</p>
      {message ? <p className="max-w-sm text-sm leading-6 text-obligon-text">{message}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex min-h-52 flex-col items-center justify-center gap-3 px-5 py-12 text-center">
      <span className="mb-1 text-[#b42318]">
        <TriangleAlert size={28} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="font-display text-lg font-bold tracking-tight text-obligon-navy">{title}</p>
      {message ? <p className="max-w-sm text-sm leading-6 text-obligon-text">{message}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 min-h-11 rounded-lg bg-obligon-green px-5 text-sm font-semibold text-white transition-colors hover:bg-[#315600]"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

/**
 * Consistent switch between async states. Usage:
 *   <AsyncBoundary status={status} error={error} isEmpty={data.length === 0} empty={{ title: "No results" }}>
 *     {children}
 *   </AsyncBoundary>
 */
export function AsyncBoundary({
  status,
  error = null,
  isEmpty = false,
  empty,
  loadingLabel,
  onRetry,
  children
}: {
  status: AsyncStatus;
  error?: string | null;
  isEmpty?: boolean;
  empty?: { title?: string; message?: string; icon?: React.ComponentType<LucideProps>; action?: React.ReactNode };
  loadingLabel?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (status === "loading" || status === "idle") return <LoadingState label={loadingLabel} />;
  if (status === "error") {
    return <ErrorState message={error ?? undefined} onRetry={onRetry} />;
  }
  return <>
    {error ? <aside role="status" className="my-4 rounded-xl border border-[#e5c57b] bg-[#fff8e8] p-4 text-sm text-[#694b11]">
      <p className="font-bold">These records could not be refreshed. Showing the last loaded data.</p>
      <p className="mt-1">{error}</p>
      {onRetry ? <button type="button" onClick={onRetry} className="mt-2 min-h-11 rounded-lg px-3 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Retry refresh</button> : null}
    </aside> : null}
    {isEmpty ? <EmptyState title={empty?.title} message={empty?.message} icon={empty?.icon} action={empty?.action} /> : children}
  </>;
}
