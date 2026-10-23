"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Search, X } from "lucide-react";
import { useSession } from "./AuthContext";
import { useDialogFocus } from "./useDialogFocus";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { DashboardSearchUnavailableError, searchDashboardRecords, type DashboardSearchResult, type DashboardSearchScope } from "@/lib/dashboard-search";

export type DashboardSearchEntry = { href: string; label: string; keywords?: string };

function allowedHref(href: string, scope: DashboardSearchScope) {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\s\u0000-\u001f]/.test(href)) return false;
  const path = href.split(/[?#]/, 1)[0];
  const prefix = scope === "partner" ? "/dashboard" : `/${scope}`;
  return path === prefix || path.startsWith(`${prefix}/`) || path === "/auth/sign-in-options" || path === "/support";
}

export function DashboardSearch({ scope, entries, className = "", compact = false }: {
  scope: DashboardSearchScope;
  entries: readonly DashboardSearchEntry[];
  className?: string;
  compact?: boolean;
}) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const id = React.useId();
  const listId = `${id}-results`;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const mobileInputRef = React.useRef<HTMLInputElement>(null);
  const desktopRef = React.useRef<HTMLDivElement>(null);
  const clearButtonRef = React.useRef<HTMLButtonElement>(null);
  const retryButtonRef = React.useRef<HTMLButtonElement>(null);
  const dialogRef = React.useRef<HTMLElement>(null);
  const request = React.useRef(0);
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<"desktop" | "mobile" | null>(null);
  const [active, setActive] = React.useState(-1);
  const [retry, setRetry] = React.useState(0);
  const [remote, setRemote] = React.useState<{ owner: string; query: string; status: "loading" | "ready" | "error"; items: DashboardSearchResult[]; partial?: boolean } | null>(null);
  const owner = [scope, user?.id, user?.role, user?.organizationId, user?.organizationType, user?.organizationRole, user?.organizationVerificationStatus, user?.partnerType].join(":");
  const normalized = query.trim().toLowerCase();
  const open = mode !== null;
  const close = React.useCallback(() => { setMode(null); setQuery(""); setActive(-1); }, []);
  const withinDesktopSearch = React.useCallback((target: Node | null) => Boolean(desktopRef.current?.contains(target) || retryButtonRef.current?.closest("[data-status-popup]")?.contains(target)), []);
  useDialogFocus(dialogRef, close, mode === "mobile");

  React.useEffect(() => { close(); setRemote(null); }, [owner, pathname, close]);
  React.useEffect(() => { if (mode === "mobile") mobileInputRef.current?.focus(); }, [mode]);
  React.useEffect(() => {
    if (mode !== "desktop") return;
    const outsideFocus = (event: FocusEvent) => { if (!withinDesktopSearch(event.target as Node | null)) setMode(current => current === "desktop" ? null : current); };
    document.addEventListener("focusin", outsideFocus);
    return () => document.removeEventListener("focusin", outsideFocus);
  }, [mode, withinDesktopSearch]);
  React.useEffect(() => {
    const revision = ++request.current;
    setActive(-1);
    if (!open || !user || normalized.length < 2) { setRemote(null); return; }
    let current = true;
    setRemote({ owner, query: normalized, status: "loading", items: [] });
    const timer = window.setTimeout(() => {
      void searchDashboardRecords(scope, normalized, user).then(items => {
        if (current && request.current === revision) setRemote({ owner, query: normalized, status: "ready", items });
      }).catch(error => {
        if (!current || request.current !== revision) return;
        const partial = error instanceof DashboardSearchUnavailableError;
        setRemote({ owner, query: normalized, status: "error", items: partial ? error.results : [], partial });
      });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [open, normalized, owner, retry, scope, user]);

  const nav = entries.filter(item => allowedHref(item.href, scope) && normalized.split(/\s+/).every(word => `${item.label} ${item.href} ${item.keywords ?? ""}`.toLowerCase().includes(word))).map(item => ({ ...item, id: `page:${item.href}`, description: "Page", kind: "Page" }));
  const currentRemote = remote?.owner === owner && remote.query === normalized ? remote : null;
  const unique = new Map<string, DashboardSearchResult>();
  for (const item of [...nav, ...(currentRemote?.items ?? [])]) if (allowedHref(item.href, scope) && !unique.has(item.href)) unique.set(item.href, item);
  const results = [...unique.values()].slice(0, 30);
  const selected = active >= 0 && active < results.length ? active : -1;
  const loading = open && normalized.length >= 2 && (!currentRemote || currentRemote.status === "loading");

  function select(item: DashboardSearchResult, event?: React.MouseEvent<HTMLAnchorElement>) {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0)) return;
    const currentRecord = !item.id.startsWith("page:") && item.href === `${window.location.pathname}${window.location.search}`;
    close();
    if (currentRecord) { event?.preventDefault(); window.location.assign(item.href); }
    else if (!event) router.push(item.href);
  }

  function keyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); inputRef.current?.blur(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setMode("desktop");
      if (results.length) setActive(index => event.key === "ArrowDown" ? (index + 1) % results.length : index <= 0 ? results.length - 1 : index - 1);
    } else if (event.key === "Enter" && open && results.length) {
      event.preventDefault();
      const result = results[selected < 0 ? 0 : selected];
      select(result);
    }
  }

  React.useEffect(() => {
    if (selected >= 0 && open) document.getElementById(`${listId}-${selected}`)?.scrollIntoView?.({ block: "nearest" });
  }, [selected, open, listId]);

  function field(mobile: boolean) {
    return <div className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-obligon-border bg-white px-3 focus-within:ring-2 focus-within:ring-obligon-green focus-within:ring-offset-2">
      <Search size={18} className="shrink-0 text-obligon-text" aria-hidden="true" />
      <input ref={mobile ? mobileInputRef : inputRef} value={query} maxLength={80} type="text" inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false} placeholder="Search pages and recent records" aria-label={`Search ${scope} dashboard`} role="combobox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-autocomplete="list" aria-activedescendant={open && selected >= 0 ? `${listId}-${selected}` : undefined} onFocus={() => { if (!mobile) setMode("desktop"); }} onChange={event => { setQuery(event.target.value); setActive(-1); }} onKeyDown={keyDown} className="min-h-11 w-full min-w-0 bg-transparent text-base text-obligon-navy outline-none focus-visible:outline-none placeholder:text-obligon-text md:text-sm" />
      {query ? <button ref={mobile ? undefined : clearButtonRef} type="button" onKeyDown={event => { if (event.key === "Tab" && !event.shiftKey && mode === "desktop" && retryButtonRef.current) { event.preventDefault(); retryButtonRef.current.focus(); } }} onClick={() => { setQuery(""); setActive(-1); (mobile ? mobileInputRef : inputRef).current?.focus(); }} aria-label="Clear search" className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg text-obligon-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-obligon-green"><X size={17} aria-hidden="true" /></button> : null}
    </div>;
  }

  function resultList() {
    return <>
      {loading ? <StatusPopup tone="loading" message="Searching records..." dismissible={false} /> : null}
      {currentRemote?.status === "error" ? <StatusPopup tone="error" message={currentRemote.partial && currentRemote.items.length ? "Some records could not be searched. Available results are shown." : "Records could not be searched. You can still open matching pages."} action={<button ref={retryButtonRef} type="button" onKeyDown={event => { if (event.key === "Tab" && event.shiftKey && mode === "desktop") { const previous = clearButtonRef.current ?? inputRef.current; if (previous) { event.preventDefault(); previous.focus(); } } }} onMouseDown={event => event.preventDefault()} onClick={() => { setRetry(value => value + 1); (mode === "mobile" ? mobileInputRef : inputRef).current?.focus(); }} className="min-h-11 font-bold text-obligon-green underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-obligon-green">Retry search</button>} /> : null}
      <div className="border-b border-obligon-border px-4 py-3 text-xs leading-5 text-obligon-text" aria-live="polite">
        {normalized.length < 2 ? "Choose a page, or type at least 2 characters to find records." : <span role="status">{results.length} {results.length === 1 ? "result" : "results"}</span>}
      </div>
      <ul id={listId} role="listbox" aria-label="Search results" aria-busy={loading} className="max-h-[min(56vh,420px)] overflow-y-auto p-2">
        {results.map((item, index) => <li key={item.href} role="none"><Link id={`${listId}-${index}`} href={item.href} role="option" aria-selected={selected === index} tabIndex={-1} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={event => select(item, event)} className={`flex min-h-12 min-w-0 items-center gap-3 rounded-lg px-3 py-2 ${selected === index ? "bg-obligon-mist text-obligon-green" : "text-obligon-navy hover:bg-obligon-mist"}`}><span className="min-w-0 flex-1"><span className="block break-words text-sm font-bold">{item.label}</span>{item.description ? <span className="mt-0.5 block break-words text-xs leading-5 text-obligon-text">{item.description}</span> : null}</span><ArrowUpRight size={17} className="shrink-0" aria-hidden="true" /></Link></li>)}
      </ul>
      {!results.length && !loading && currentRemote?.status !== "error" ? <p role="status" className="px-4 pb-5 text-sm text-obligon-text">No matching pages or records. Try another name or reference.</p> : null}
    </>;
  }

  return <div className={`min-w-0 ${compact ? "" : "w-auto md:w-full md:max-w-[360px]"} ${className}`}>
    <button type="button" onClick={() => setMode("mobile")} aria-label={`Search ${scope} dashboard`} aria-haspopup="dialog" aria-expanded={mode === "mobile"} className={`grid size-11 shrink-0 place-items-center rounded-xl border border-obligon-border bg-white text-obligon-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green ${compact ? "" : "md:hidden"}`}><Search size={20} aria-hidden="true" /></button>
    {!compact ? <div ref={desktopRef} className="relative hidden min-w-0 md:block" onBlur={event => { if (!withinDesktopSearch(event.relatedTarget as Node | null)) setMode(current => current === "desktop" ? null : current); }}>
      {field(false)}
      {mode === "desktop" ? <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-obligon-border bg-white shadow-hero">{resultList()}</div> : null}
    </div> : null}
    {mode === "mobile" && typeof document !== "undefined" ? createPortal(<div className="fixed inset-0 z-[100] flex items-start justify-center bg-obligon-navy/50 p-3 pt-[max(16px,env(safe-area-inset-top))] sm:p-6" onMouseDown={close}><section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1} onMouseDown={event => event.stopPropagation()} className="max-h-[calc(100dvh-32px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-obligon-border bg-white shadow-hero outline-none"><div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3"><h2 id={`${id}-title`} className="text-lg font-extrabold text-obligon-navy">Search dashboard</h2><button type="button" onClick={close} aria-label="Close search" className="grid size-11 shrink-0 place-items-center rounded-lg text-obligon-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-obligon-green"><X size={20} aria-hidden="true" /></button></div><div className="px-4 pb-3">{field(true)}</div>{resultList()}</section></div>, document.body) : null}
  </div>;
}
