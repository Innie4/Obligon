"use client";

import * as React from "react";
import { Inbox, type LucideProps } from "lucide-react";
import type { AsyncStatus } from "@/lib/services/types";
import { StatusPopup } from "./StatusPopup";

export function LoadingState({ label = "Loading…" }: { label?: string; className?: string }) {
  return <StatusPopup tone="loading" message={label} />;
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
  return <StatusPopup tone="error" title={title} message={message} onRetry={onRetry} />;
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
    {error ? <StatusPopup tone="warning" title="These records could not be refreshed. Showing the last loaded data." message={error} onRetry={onRetry} retryLabel="Retry refresh" /> : null}
    {isEmpty ? <EmptyState title={empty?.title} message={empty?.message} icon={empty?.icon} action={empty?.action} /> : children}
  </>;
}
