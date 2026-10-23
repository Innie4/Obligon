"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { DashboardLogo } from "@/components/shared/DashboardLogo";
import { routes } from "./routes";

const navLinks = [
  { label: "Solutions", href: routes.fuelvista },
  { label: "Pricing", href: "/#pricing" },
  { label: "Careers", href: routes.careers },
  { label: "Support", href: routes.support }
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header onKeyDown={event => { if (event.key === "Escape" && open) { setOpen(false); event.currentTarget.querySelector<HTMLButtonElement>('[aria-controls="site-mobile-navigation"]')?.focus(); } }} className="sticky top-0 z-30 bg-white">
      <nav aria-label="Main navigation" className="mx-auto flex h-20 max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-16">
        <Link href={routes.home} className="flex min-h-11 items-center" aria-label="Obligon LTD home">
          <DashboardLogo width={112} priority />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="inline-flex min-h-11 items-center text-sm font-medium text-obligon-text transition-colors hover:text-obligon-green"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href={routes.login}
            className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-obligon-navy"
          >
            Login
          </Link>
          <Link
            href={routes.signup}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-obligon-green px-5 text-sm font-semibold text-white transition-colors hover:bg-[#315600]"
          >
            Get Started
          </Link>
        </div>
        <button type="button" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="site-mobile-navigation" onClick={() => setOpen(value => !value)} className="grid size-11 place-items-center rounded-lg border border-obligon-border bg-white md:hidden">
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </nav>
      {open ? <nav id="site-mobile-navigation" aria-label="Mobile navigation" className="max-h-[calc(100dvh-5rem)] overflow-y-auto px-5 py-4 md:hidden">
        {navLinks.map(link => <Link key={link.label} href={link.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center text-base font-medium">{link.label}</Link>)}
        <div className="mt-4 grid grid-cols-2 gap-3 pb-2">
          <Link href={routes.login} onClick={() => setOpen(false)} className="flex min-h-12 items-center justify-center rounded-lg border border-obligon-border bg-obligon-mist text-sm font-semibold">Login</Link>
          <Link href={routes.signup} onClick={() => setOpen(false)} className="flex min-h-12 items-center justify-center rounded-lg border border-obligon-green bg-obligon-green text-sm font-semibold text-white">Get started</Link>
        </div>
      </nav> : null}
    </header>
  );
}
