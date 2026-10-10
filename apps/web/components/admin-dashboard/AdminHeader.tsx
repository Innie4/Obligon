"use client";

import Link from "next/link";
import { useSession } from "@/components/shared/AuthContext";
import * as React from "react";
import { usePathname } from "next/navigation";
import { Bell, HelpCircle, Menu, Search } from "lucide-react";
import { adminNav, adminPageCopy } from "@/lib/mock/admin-data";

function currentPage(pathname: string) {
  return adminNav.find((item) => item.href === pathname)?.key ?? "companies";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AdminHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const {user}=useSession();
  const page = adminPageCopy[currentPage(pathname)];
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const filteredNav = adminNav.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <header className="sticky top-0 z-30 border-b border-[#cfd3e1] bg-[#f7f7fd]/95 backdrop-blur">
      <div className="flex h-[64px] items-center gap-5 px-6 lg:px-12">
        <button type="button" onClick={onOpenMenu} className="grid size-9 place-items-center rounded-lg border border-[#c8ccdb] bg-white lg:hidden" aria-label="Open admin menu"><Menu size={18} /></button>
        <div
          className="relative hidden w-full max-w-[448px] md:block"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchOpen(false);
          }}
        >
          <label className="flex h-[38px] w-full items-center gap-3 rounded-lg border border-[#c8ccdb] bg-[#eef3ff] px-3">
            <Search size={16} className="text-[#777c8f]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchOpen(false);
                  event.currentTarget.blur();
                }
              }}
              className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-[#7d8293]"
              placeholder={page.search}
              role="combobox"
              aria-expanded={searchOpen}
              aria-controls="admin-search-results"
              aria-autocomplete="list"
              aria-label={page.search}
            />
          </label>
          {searchOpen ? (
            <ul id="admin-search-results" role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-72 overflow-y-auto rounded-lg border border-[#c8ccdb] bg-white p-1.5 shadow-hero">
              {filteredNav.length ? (
                filteredNav.map((item) => (
                  <li key={item.key} role="option" aria-selected={pathname === item.href}>
                    <Link
                      href={item.href}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSearchOpen(false);
                        setQuery("");
                      }}
                      className={`block rounded-md px-3 py-2 text-sm font-bold ${pathname === item.href ? "bg-[#eef3ff] text-obligon-navy" : "text-[#4f5663] hover:bg-[#f2f6f2]"}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm font-medium text-obligon-text" role="status">No matching sections.</li>
              )}
            </ul>
          ) : null}
        </div>

        {page.eyebrow ? (
          <span className="hidden rounded-full border border-obligon-green bg-[#f3ffe6] px-4 py-1.5 text-[10px] font-extrabold uppercase text-obligon-green xl:inline-flex">
            {page.eyebrow}
          </span>
        ) : null}

        <div className="ml-auto" />
        <Link href="/admin/intake" className="inline-flex min-h-12 items-center text-obligon-navy" aria-label="Admin activity"><Bell size={19}/></Link>
        {pathname === "/admin/partner-applications" ? <HelpCircle size={18} className="text-obligon-navy" /> : null}
        <div className="h-10 w-px bg-[#d5d8e5]" />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-extrabold text-obligon-navy">{user?.name??"Administrator"}</p>
            <p className="text-[10px] font-bold uppercase text-obligon-text">Platform administrator</p>
          </div>
          <div className="grid size-9 place-items-center rounded-lg bg-[#050816] text-xs font-extrabold text-white">
            {initials(user?.name??"Admin")}
          </div>
        </div>
      </div>
    </header>
  );
}

