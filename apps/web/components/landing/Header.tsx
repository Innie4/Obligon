"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DashboardLogo } from "@/components/shared/DashboardLogo";
import { LandingButton } from "./Button";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Product", href: "/solutions/fuelvista" },
  { label: "Pricing", href: "/#pricing" },
  { label: "About Us", href: "/#about-us" },
  { label: "Partners", href: "/#partners" }
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="absolute left-0 top-0 z-20 h-[104px] w-full border-b border-obligon-border bg-white/90 backdrop-blur-md"
      data-node-id="2:325"
    >
      <nav className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-16">
        <div className="flex h-[95px] items-center gap-12">
          <Link className="flex h-[95px] w-[190px] shrink-0 items-center justify-center" href="/" aria-label="Obligon LTD home">
            <DashboardLogo width={112} priority />
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                className="text-[13px] font-semibold tracking-[0.6px] text-obligon-text transition hover:text-obligon-green"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-4 lg:flex">
          <Link
            className="inline-flex h-8 items-center justify-center px-4 text-[13px] font-semibold tracking-[0.6px] text-obligon-text"
            href="/auth/login"
          >
            Login
          </Link>
          <LandingButton className="h-9 px-6" href="/auth/signup">
            Get Started
          </LandingButton>
        </div>

        <button
          className="inline-flex size-11 items-center justify-center rounded-lg border border-obligon-border bg-white text-obligon-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obligon-green focus-visible:ring-offset-2 lg:hidden"
          type="button"
          aria-expanded={open}
          aria-controls="landing-mobile-navigation"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
        </button>
      </nav>

      {open ? (
        <div id="landing-mobile-navigation" className="absolute inset-x-0 top-[104px] border-b border-obligon-border bg-white px-5 py-6 shadow-card lg:hidden">
          <div className="flex flex-col gap-4">
            {navItems.map((item) => (
              <Link
                key={item.label}
                className="text-sm font-semibold text-obligon-navy"
                href={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-obligon-navy bg-obligon-mist px-4 py-2 text-center text-sm font-semibold text-obligon-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obligon-green focus-visible:ring-offset-2"
                href="/auth/login"
                onClick={() => setOpen(false)}
              >
                Login
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-obligon-green bg-obligon-green px-4 py-2 text-center text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obligon-green focus-visible:ring-offset-2"
                href="/auth/signup"
                onClick={() => setOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
