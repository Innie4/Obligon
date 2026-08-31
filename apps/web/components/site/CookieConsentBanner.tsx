"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { routes } from "@/components/site/routes";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("obligon_cookie_consent");
      if (!consent) {
        // Delay showing banner slightly for smooth entrance
        const timer = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  function handleAcceptAll() {
    try {
      localStorage.setItem("obligon_cookie_consent", JSON.stringify({ essential: true, analytics: true, functional: true, marketing: true }));
    } catch {}
    setVisible(false);
  }

  function handleEssentialOnly() {
    try {
      localStorage.setItem("obligon_cookie_consent", JSON.stringify({ essential: true, analytics: false, functional: false, marketing: false }));
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      aria-label="Cookie Consent"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl rounded-2xl border border-obligon-border bg-white/95 p-5 shadow-hero backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-obligon-lime/20 text-obligon-green">
            <Cookie size={20} />
          </span>
          <div className="text-xs text-obligon-text leading-5">
            <strong className="text-obligon-navy font-bold block text-sm">Privacy &amp; Cookie Consent</strong>
            We use essential cookies to maintain secure sessions and optimize fleet logistics telemetry. You can customize your preferences anytime in our{" "}
            <Link href={routes.cookies} className="font-bold text-obligon-green underline hover:text-obligon-navy">
              Cookie Policy
            </Link>
            .
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleEssentialOnly}
            className="h-10 rounded-xl border border-obligon-border bg-white px-4 text-xs font-bold text-obligon-navy hover:bg-obligon-mist transition"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="h-10 rounded-xl bg-obligon-green px-5 text-xs font-bold text-white shadow-green hover:bg-obligon-green/90 transition"
          >
            Accept All
          </button>
        </div>
      </div>
    </aside>
  );
}
