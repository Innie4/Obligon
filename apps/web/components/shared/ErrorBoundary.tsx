"use client";

import * as React from "react";
import { TriangleAlert, type LucideProps } from "lucide-react";
import { StatusPopup } from "./StatusPopup";

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
  return <StatusPopup tone="error" title={title} message={error?.message ? `${message}\n${error.message}` : message} onRetry={onReset} icon={Icon} dismissible={false} />;
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
