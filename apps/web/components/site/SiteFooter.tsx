"use client";

import Link from "next/link";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { routes } from "./routes";
import { publicApi } from "@/lib/services";
import { useToast } from "@/components/shared/Toast";

type SiteFooterProps = {
  active?: "privacy" | "terms" | "cookies" | "careers" | "solutions" | "support";
};

const columns = [
  {
    title: "Company",
    links: [
      { label: "About", href: "/#get-started" },
      { label: "Careers", href: routes.careers, key: "careers" },
      { label: "Contact", href: routes.support, key: "support" }
    ]
  },
  {
    title: "Solutions",
    links: [
      { label: "FuelVista", href: routes.fuelvista, key: "solutions" },
      { label: "EnergyVista", href: routes.energyvista, key: "solutions" },
      { label: "GenVista", href: routes.genvista, key: "solutions" }
    ]
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: routes.privacy, key: "privacy" },
      { label: "Terms of Service", href: routes.terms, key: "terms" },
      { label: "Cookies Policy", href: routes.cookies, key: "cookies" }
    ]
  }
];

export function SiteFooter({ active }: SiteFooterProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [email, setEmail] = React.useState("");
  const [subscribing, setSubscribing] = React.useState(false);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toastError("Enter a valid email address.");
      return;
    }
    setSubscribing(true);
    try {
      const result = await publicApi.submitLead({ type: "newsletter", email });
      toastSuccess(result?.message ?? "You're subscribed to Obligon updates.");
      setEmail("");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not subscribe. Please try again.");
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <footer className="border-t border-obligon-border bg-white">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-5 lg:px-16 lg:py-20">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Obligon LTD</h2>
          <p className="mt-6 max-w-[220px] text-sm leading-5 text-obligon-text">
            Enterprise energy logistics and fintech solutions for Nigerian fleets.
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.6px] text-obligon-navy">{column.title}</h3>
            <ul className="mt-6 space-y-4">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className={`text-sm leading-5 transition hover:text-obligon-green ${
                      link.key === active ? "font-bold text-obligon-green" : "text-obligon-text"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.6px] text-obligon-navy">Stay Updated</h3>
          <form onSubmit={handleSubscribe} className="mt-6 space-y-3">
            <label htmlFor="footer-newsletter" className="sr-only">
              Email address
            </label>
            <input
              id="footer-newsletter"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.ng"
              className="h-11 w-full rounded-xl border border-obligon-border px-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
              disabled={subscribing}
            />
            <button
              type="submit"
              disabled={subscribing}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-obligon-green text-sm font-bold text-white shadow-green transition hover:bg-obligon-green/90 disabled:opacity-60"
            >
              {subscribing ? <Loader2 size={16} className="animate-spin" /> : "Subscribe"}
            </button>
          </form>
          <p className="mt-3 text-xs leading-4 text-obligon-text">Product updates and fleet insights. Unsubscribe anytime.</p>
        </div>
      </div>

      <div className="border-t border-obligon-border">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-8 text-sm text-obligon-text sm:px-8 md:flex-row md:items-center md:justify-between lg:px-16">
          <p>&copy; 2024 Obligon LTD Energy. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="h-px w-16 bg-gradient-to-r from-transparent via-obligon-green to-transparent" />
            <span className="text-xs uppercase tracking-[1.6px] text-obligon-navy">Lagos, Nigeria</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
