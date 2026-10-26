"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Clock3, Info, Loader2, X, XCircle, type LucideProps } from "lucide-react";

export type StatusPopupTone = "loading" | "pending" | "error" | "success" | "warning" | "info";

export interface StatusPopupProps {
  tone: StatusPopupTone;
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
  dismissible?: boolean;
  icon?: React.ComponentType<LucideProps>;
}

type PopupItem = StatusPopupProps & { id: string; host: HTMLElement; dismissed?: boolean };
type PopupGroup = PopupItem & { ids: string[] };
const PopupContext = React.createContext<{
  register: (item: PopupItem) => void;
  remove: (id: string) => void;
  registerOverlay: (id: string, host: HTMLElement) => void;
  removeOverlay: (id: string) => void;
} | null>(null);

const tones: Record<StatusPopupTone, { icon: React.ComponentType<LucideProps>; color: string; border: string; title: string }> = {
  loading: { icon: Loader2, color: "text-obligon-green", border: "border-obligon-green/30", title: "Please wait" },
  pending: { icon: Clock3, color: "text-[#9a6300]", border: "border-[#c98a00]/40", title: "Request pending" },
  error: { icon: XCircle, color: "text-[#b42318]", border: "border-[#c1121f]/35", title: "Something went wrong" },
  success: { icon: CheckCircle2, color: "text-obligon-green", border: "border-obligon-green/30", title: "Complete" },
  warning: { icon: AlertTriangle, color: "text-[#9a6300]", border: "border-[#c98a00]/40", title: "Please check" },
  info: { icon: Info, color: "text-obligon-blue", border: "border-obligon-blue/30", title: "Update" }
};

const isProgress = (item: StatusPopupProps) => item.tone === "loading" || item.tone === "pending";
const priority: Record<StatusPopupTone, number> = { error: 0, warning: 1, pending: 2, loading: 3, success: 4, info: 5 };

function sameFeedback(a: StatusPopupProps, b: StatusPopupProps) {
  return sameNoticeState(a, b) && a.onRetry === b.onRetry && a.action === b.action;
}

function sameNoticeState(a: StatusPopupProps, b: StatusPopupProps) {
  return a.tone === b.tone && a.title === b.title && a.message === b.message &&
    a.retryLabel === b.retryLabel && a.dismissible === b.dismissible && a.icon === b.icon;
}

/** Equal messages share a card; independent retry actions remain separate. */
function groupFeedback(items: PopupItem[]) {
  const groups: PopupGroup[] = [];
  for (const item of items) {
    if (item.dismissed) continue;
    const existing = groups.find(group => group.host === item.host && sameFeedback(group, item));
    if (existing) existing.ids.push(item.id);
    else groups.push({ ...item, ids: [item.id] });
  }
  return groups.sort((a, b) => priority[a.tone] - priority[b.tone]);
}

function PopupCard({ popup, onDismiss, otherProgress = 0 }: { popup: StatusPopupProps; onDismiss: () => void; otherProgress?: number }) {
  const config = tones[popup.tone];
  const Icon = popup.icon ?? config.icon;
  return (
    <section role={popup.tone === "error" ? "alert" : "status"} aria-live={popup.tone === "error" ? "assertive" : "polite"} aria-atomic="true"
      data-status-popup={popup.tone}
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border ${config.border} bg-white p-4 text-left shadow-hero`}>
      <Icon size={21} aria-hidden="true" className={`mt-0.5 shrink-0 ${config.color} ${popup.tone === "loading" ? "animate-spin motion-reduce:animate-none" : ""}`} />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-bold leading-6 text-obligon-navy">{popup.title ?? config.title}</p>
        {popup.message ? <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-obligon-text">{popup.message}</p> : null}
        {otherProgress ? <p className="mt-1 text-xs leading-5 text-obligon-text">{otherProgress} other {otherProgress === 1 ? "request is" : "requests are"} in progress.</p> : null}
        {popup.onRetry || popup.action ? <div className="mt-3 flex flex-wrap items-center gap-2">
          {popup.onRetry ? <button type="button" onClick={popup.onRetry} className="min-h-11 rounded-lg bg-obligon-green px-4 text-sm font-bold text-white hover:bg-[#315600] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green">{popup.retryLabel ?? "Try again"}</button> : null}
          {popup.action}
        </div> : null}
      </div>
      {popup.dismissible !== false ? <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-lg text-obligon-text hover:bg-obligon-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green"><X size={17} aria-hidden="true" /></button> : null}
    </section>
  );
}

function PopupStack({ children, placement = "corner" }: { children: React.ReactNode; placement?: "corner" | "center" }) {
  return <div data-status-popup-stack data-popup-placement={placement} className={placement === "center"
    ? "admin-feedback-stack pointer-events-none fixed left-1/2 top-1/2 z-[120] flex max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),440px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto overscroll-contain"
    : "pointer-events-none fixed right-3 top-[calc(5rem+env(safe-area-inset-top))] z-[120] flex max-h-[calc(100dvh-11rem)] w-[min(calc(100vw-1.5rem),400px)] flex-col gap-3 overflow-y-auto overscroll-contain sm:right-5 sm:top-5"}>{children}</div>;
}

export function StatusPopupProvider({ children, placement = "corner" }: { children: React.ReactNode; placement?: "corner" | "center" }) {
  const [items, setItems] = React.useState<PopupItem[]>([]);
  const [overlays, setOverlays] = React.useState<{ id: string; host: HTMLElement }[]>([]);
  const hostKeys = React.useRef(new WeakMap<HTMLElement, string>());
  const nextHostKey = React.useRef(0);
  const register = React.useCallback((item: PopupItem) => {
    setItems(previous => {
      const existing = previous.find(value => value.id === item.id);
      if (existing && existing.host === item.host && sameFeedback(existing, item)) return previous;
      const next = { ...item, dismissed: existing && sameNoticeState(existing, item) ? existing.dismissed : false };
      return existing ? previous.map(value => value.id === item.id ? next : value) : [...previous, next];
    });
  }, []);
  const remove = React.useCallback((id: string) => setItems(previous => previous.some(item => item.id === id) ? previous.filter(item => item.id !== id) : previous), []);
  const registerOverlay = React.useCallback((id: string, host: HTMLElement) => setOverlays(previous => {
    if (previous.some(item => item.id === id && item.host === host)) return previous;
    return [...previous.filter(item => item.id !== id), { id, host }];
  }), []);
  const removeOverlay = React.useCallback((id: string) => setOverlays(previous => previous.some(item => item.id === id) ? previous.filter(item => item.id !== id) : previous), []);
  const context = React.useMemo(() => ({ register, remove, registerOverlay, removeOverlay }), [register, remove, registerOverlay, removeOverlay]);
  const activeOverlay = placement === "center" ? overlays.at(-1)?.host : undefined;
  const groups = groupFeedback(activeOverlay ? items.map(item => ({ ...item, host: activeOverlay })) : items);
  const hosts = Array.from(new Set(groups.map(item => item.host)));
  function dismiss(ids: string[]) {
    setItems(previous => previous.map(item => ids.includes(item.id) ? { ...item, dismissed: true } : item));
  }
  return <PopupContext.Provider value={context}>
    {children}
    {hosts.map(host => {
      if (!hostKeys.current.has(host)) hostKeys.current.set(host, `status-popup-${++nextHostKey.current}`);
      const local = groups.filter(item => item.host === host);
      const progress = local.filter(isProgress);
      const visible = [...local.filter(item => !isProgress(item)).slice(0, 2), ...progress.slice(0, 1)];
      const hidden = local.filter(item => !isProgress(item)).length - visible.filter(item => !isProgress(item)).length;
      return createPortal(<PopupStack placement={placement}>
        {visible.map(item => <PopupCard key={item.id} popup={item} onDismiss={() => dismiss(isProgress(item) ? progress.flatMap(group => group.ids) : item.ids)} otherProgress={isProgress(item) ? progress.reduce((count, group) => count + group.ids.length, 0) - 1 : 0} />)}
        {hidden > 0 ? <p role="status" className="rounded-lg border border-obligon-border bg-white px-4 py-2 text-xs font-semibold leading-5 text-obligon-text">{hidden} more {hidden === 1 ? "update" : "updates"}. Dismiss a notification to view.</p> : null}
      </PopupStack>, host, hostKeys.current.get(host));
    })}
  </PopupContext.Provider>;
}

/** Centered admin feedback from sibling sections stays within the active focus boundary. */
export function useStatusPopupHost(ref: React.RefObject<HTMLElement | null>, open: boolean) {
  const context = React.useContext(PopupContext);
  const id = React.useId();
  React.useEffect(() => {
    if (!open || !ref.current || !context) return;
    context.registerOverlay(id, ref.current);
    return () => context.removeOverlay(id);
  }, [context, id, ref, open]);
}

/** Feedback lasts only as long as its owning state, without changing the request. */
export function StatusPopup(props: StatusPopupProps) {
  const context = React.useContext(PopupContext);
  const id = React.useId();
  const anchor = React.useRef<HTMLSpanElement>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const { tone, title, message, onRetry, retryLabel, action, dismissible, icon } = props;
  React.useEffect(() => {
    setDismissed(false);
  }, [tone, title, message, retryLabel, dismissible, icon]);
  React.useEffect(() => {
    const target = anchor.current?.closest<HTMLElement>('[role="dialog"], dialog[open]') ?? document.body;
    if (context) context.register({ id, host: target, tone, title, message, onRetry, retryLabel, action, dismissible, icon });
    else setHost(target);
  }, [context, id, tone, title, message, onRetry, retryLabel, action, dismissible, icon]);
  React.useEffect(() => () => context?.remove(id), [context, id]);
  const fallback = !context && !dismissed ? <PopupStack><PopupCard popup={props} onDismiss={() => setDismissed(true)} /></PopupStack> : null;
  return <>
    <span ref={anchor} hidden aria-hidden="true" data-feedback-anchor />
    {host && fallback ? createPortal(fallback, host) : fallback}
  </>;
}
