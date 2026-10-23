"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideProps } from "lucide-react";
import { StatusPopupProvider } from "./StatusPopup";

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

interface ScopedToastContextValue extends ToastContextValue {
  activateScope: (scope: object) => void;
  bindScope: (scope: object) => ScopedToastContextValue;
}

const ToastContext = React.createContext<ScopedToastContextValue | null>(null);

const toneConfig: Record<ToastTone, { icon: React.ComponentType<LucideProps>; ring: string; bg: string; text: string }> = {
  success: { icon: CheckCircle2, ring: "border-obligon-green/40", bg: "bg-white", text: "text-obligon-green" },
  warning: { icon: AlertTriangle, ring: "border-[#c98a00]/40", bg: "bg-white", text: "text-[#9a6300]" },
  error: { icon: XCircle, ring: "border-[#c1121f]/40", bg: "bg-white", text: "text-[#c1121f]" },
  info: { icon: Info, ring: "border-obligon-blue/40", bg: "bg-white", text: "text-obligon-blue" }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const itemsRef = React.useRef<ToastItem[]>([]);
  const timers = React.useRef(new Map<number, number>());
  const nextId = React.useRef(0);
  const rootScope = React.useRef({});
  const scopeRef = React.useRef<object>(rootScope.current);
  const activeRef = React.useRef(true);

  const dismiss = React.useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    itemsRef.current = itemsRef.current.filter((item) => item.id !== id);
    setItems(itemsRef.current);
  }, []);

  React.useEffect(() => {
    const activeTimers = timers.current;
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      activeTimers.forEach(timer => window.clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  const activateScope = React.useCallback((scope: object) => {
    if (scopeRef.current === scope) return;
    scopeRef.current = scope;
    timers.current.forEach(timer => window.clearTimeout(timer));
    timers.current.clear();
    itemsRef.current = [];
    setItems([]);
  }, []);

  const push = React.useCallback(
    (message: string, tone: ToastTone, ownerScope: object) => {
      if (!activeRef.current || ownerScope !== scopeRef.current) return;
      const duplicate = itemsRef.current.find(item => item.tone === tone && item.message === message);
      if (duplicate) dismiss(duplicate.id);
      const id = ++nextId.current;
      if (itemsRef.current.length >= 4) dismiss(itemsRef.current[0].id);
      itemsRef.current = [...itemsRef.current, { id, tone, message }];
      setItems(itemsRef.current);
      if (tone === "success" || tone === "info") timers.current.set(id, window.setTimeout(() => dismiss(id), 4500));
    },
    [dismiss]
  );

  const bindScope = React.useCallback((scope: object): ScopedToastContextValue => ({
    toast: (message, tone = "info") => push(message, tone, scope),
    success: (message) => push(message, "success", scope),
    warning: (message) => push(message, "warning", scope),
    error: (message) => push(message, "error", scope),
    info: (message) => push(message, "info", scope),
    activateScope,
    bindScope
  }), [push, activateScope]);
  const value = React.useMemo(() => bindScope(rootScope.current), [bindScope]);

  return (
    <ToastContext.Provider value={value}>
      <StatusPopupProvider>{children}</StatusPopupProvider>
      <div className="pointer-events-none fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-3 lg:bottom-4">
        {items.map((item) => {
          const config = toneConfig[item.tone];
          const Icon = config.icon;
          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              aria-atomic="true"
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${config.ring} ${config.bg} px-4 py-3 shadow-hero`}
            >
              <Icon size={20} className={`mt-0.5 shrink-0 ${config.text}`} />
              <p className="min-w-0 flex-1 break-words text-sm font-medium leading-6 text-obligon-navy">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="grid size-11 shrink-0 place-items-center rounded-lg text-obligon-text hover:bg-obligon-panel"
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

/** Only transient toasts reset; mounted request feedback retains its owner. */
export function ToastScope({ scopeKey, children }: { scopeKey: string; children: React.ReactNode }) {
  const context = React.useContext(ToastContext);
  const scope = React.useMemo(() => ({ scopeKey }), [scopeKey]);
  const bindScope = context?.bindScope;
  const activateScope = context?.activateScope;
  const scopedValue = React.useMemo(() => bindScope?.(scope) ?? null, [bindScope, scope]);
  React.useLayoutEffect(() => { activateScope?.(scope); }, [activateScope, scope]);
  return <ToastContext.Provider value={scopedValue}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
