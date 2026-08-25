"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideProps } from "lucide-react";

export type ToastTone = "success" | "warning" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const toneConfig: Record<ToastTone, { icon: React.ComponentType<LucideProps>; ring: string; bg: string; text: string }> = {
  success: { icon: CheckCircle2, ring: "border-obligon-green/40", bg: "bg-white", text: "text-obligon-green" },
  warning: { icon: AlertTriangle, ring: "border-[#c98a00]/40", bg: "bg-white", text: "text-[#9a6300]" },
  error: { icon: XCircle, ring: "border-[#c1121f]/40", bg: "bg-white", text: "text-[#c1121f]" },
  info: { icon: Info, ring: "border-obligon-blue/40", bg: "bg-white", text: "text-obligon-blue" }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = React.useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (message) => push(message, "success"),
      warning: (message) => push(message, "warning"),
      error: (message) => push(message, "error"),
      info: (message) => push(message, "info")
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-3">
        {items.map((item) => {
          const config = toneConfig[item.tone];
          const Icon = config.icon;
          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${config.ring} ${config.bg} px-4 py-3 shadow-hero`}
            >
              <Icon size={20} className={`mt-0.5 shrink-0 ${config.text}`} />
              <p className="flex-1 text-sm font-bold text-obligon-navy">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="grid size-6 shrink-0 place-items-center rounded-lg text-obligon-text hover:bg-obligon-panel"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
