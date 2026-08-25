"use client";

import * as React from "react";
import { Inbox, Loader2, TriangleAlert, type LucideProps } from "lucide-react";
import type { AsyncStatus } from "@/lib/services/types";

export function LoadingState({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 text-obligon-text ${className}`}>
      <Loader2 size={26} className="animate-spin text-obligon-green" />
      <p className="text-sm font-bold">{label}</p>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-obligon-panel ${className}`} />;
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
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-obligon-panel text-obligon-text">
        <Icon size={22} />
      </span>
      <p className="font-display text-lg font-extrabold text-obligon-navy">{title}</p>
      {message ? <p className="max-w-sm text-sm text-obligon-text">{message}</p> : null}
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
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-[#ffe8e8] text-[#c1121f]">
        <TriangleAlert size={22} />
      </span>
      <p className="font-display text-lg font-extrabold text-obligon-navy">{title}</p>
      {message ? <p className="max-w-sm text-sm text-obligon-text">{message}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 h-11 rounded-lg bg-obligon-green px-5 font-extrabold text-white"
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
  empty?: { title?: string; message?: string; icon?: React.ComponentType<LucideProps> };
  loadingLabel?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (status === "loading" || status === "idle") return <LoadingState label={loadingLabel} />;
  if (status === "error" || error) {
    return <ErrorState message={error ?? undefined} onRetry={onRetry} />;
  }
  if (isEmpty) {
    return <EmptyState title={empty?.title} message={empty?.message} icon={empty?.icon} />;
  }
  return <>{children}</>;
}
