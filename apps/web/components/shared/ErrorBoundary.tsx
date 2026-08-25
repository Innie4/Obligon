"use client";

import * as React from "react";
import { RotateCcw, TriangleAlert, type LucideProps } from "lucide-react";

export function ErrorFallback({
  title = "Something went wrong",
  message = "An unexpected error occurred while rendering this screen.",
  error,
  onReset,
  icon: Icon = TriangleAlert
}: {
  title?: string;
  message?: string;
  error?: Error | null;
  onReset?: () => void;
  icon?: React.ComponentType<LucideProps>;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-[#ffe8e8] text-[#c1121f]">
        <Icon size={26} />
      </span>
      <h1 className="font-display text-2xl font-extrabold text-obligon-navy">{title}</h1>
      <p className="max-w-md text-sm text-obligon-text">{message}</p>
      {error?.message ? (
        <p className="max-w-md break-words rounded-lg bg-obligon-panel px-3 py-2 text-xs font-medium text-obligon-text">{error.message}</p>
      ) : null}
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-2 inline-flex h-12 items-center gap-2 rounded-lg bg-obligon-green px-6 font-extrabold text-white"
        >
          <RotateCcw size={18} /> Try again
        </button>
      ) : null}
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (typeof console !== "undefined") {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  private reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <ErrorFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}
