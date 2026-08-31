"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Cookie, Database, FileText, LockKeyhole, ShieldCheck, ToggleLeft, Check, Loader2 } from "lucide-react";
import { PageIntro } from "@/components/site/PageIntro";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";

type LegalCard = {
  title: string;
  body: string;
  icon?: "file" | "database" | "lock" | "shield" | "check" | "cookie";
};

export type LegalSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  cards?: LegalCard[];
  dark?: boolean;
  table?: Array<{ category: string; purpose: string; duration: string; status: string; active?: boolean }>;
};

type LegalPageProps = {
  active: "privacy" | "terms" | "cookies";
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

const iconMap = {
  file: FileText,
  database: Database,
  lock: LockKeyhole,
  shield: ShieldCheck,
  check: CheckCircle2,
  cookie: Cookie
};

export function LegalPage({ active, eyebrow, title, updated, intro, sections }: LegalPageProps) {
  const { success: toastSuccess } = useToast();
  const [cookiePrefs, setCookiePrefs] = useState({
    essential: true,
    analytics: true,
    functional: true,
    marketing: false
  });
  const [dataRequestModal, setDataRequestModal] = useState(false);
  const [dataReqEmail, setDataReqEmail] = useState("");
  const [dataReqType, setDataReqType] = useState("Export Personal Data Copy");
  const [dataReqSent, setDataReqSent] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("obligon_cookie_consent");
      if (stored) {
        setCookiePrefs((prev) => ({ ...prev, ...JSON.parse(stored) }));
      }
    } catch {}
  }, []);

  function handleSavePreferences() {
    setSavingPrefs(true);
    setTimeout(() => {
      try {
        localStorage.setItem("obligon_cookie_consent", JSON.stringify(cookiePrefs));
      } catch {}
      setSavingPrefs(false);
      toastSuccess("Cookie preferences saved.");
    }, 400);
  }

  function handleAcceptAll() {
    const all = { essential: true, analytics: true, functional: true, marketing: true };
    setCookiePrefs(all);
    try {
      localStorage.setItem("obligon_cookie_consent", JSON.stringify(all));
    } catch {}
    toastSuccess("All cookies accepted.");
  }

  return (
    <main className="min-h-screen bg-obligon-mist text-obligon-navy">
      <SiteHeader />
      <section className="mx-auto max-w-[1280px] px-5 pb-20 pt-16 sm:px-8 lg:px-16 lg:pb-28">
        <PageIntro eyebrow={eyebrow} title={title} body={`${intro} Last updated ${updated}.`} />

        <div className="mt-14 grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-4">
              <p className="pb-2 text-xs font-extrabold uppercase tracking-[1.2px] text-obligon-text">Table of Contents</p>
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block border-l-2 border-obligon-green py-1 pl-4 text-xs font-bold text-obligon-navy hover:text-obligon-green transition"
                >
                  {section.title.replace(/^\d+\.\s*/, "")}
                </a>
              ))}
            </div>
          </aside>

          <div className="space-y-12">
            {sections.map((section) => (
              <section
                id={section.id}
                key={section.id}
                className={section.dark ? "rounded-2xl bg-obligon-navy p-8 text-white shadow-hero" : "rounded-2xl border border-obligon-border bg-white p-6 sm:p-8 shadow-card"}
              >
                <div className="flex flex-col gap-3 border-b border-current/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
                  <h2 className={`font-display text-2xl font-bold leading-8 ${section.dark ? "text-white" : "text-obligon-navy"}`}>
                    {section.title}
                  </h2>
                  {section.table ? <span className="text-xs uppercase font-extrabold tracking-[1.2px] text-obligon-green">Nigeria Data Protection Act (NDPA) Compliant</span> : null}
                </div>

                {section.paragraphs ? (
                  <div className={`mt-6 space-y-4 text-base leading-[26px] ${section.dark ? "text-[#b8c4ff]" : "text-obligon-text"}`}>
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                ) : null}

                {section.cards ? (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {section.cards.map((card) => {
                      const Icon = iconMap[card.icon ?? "file"];
                      return (
                        <article key={card.title} className={section.dark ? "rounded-xl border border-white/10 bg-white/5 p-5" : "rounded-xl border border-obligon-border bg-obligon-mist p-5"}>
                          <Icon className={section.dark ? "text-obligon-lime" : "text-obligon-green"} size={22} />
                          <h3 className={`mt-4 font-display text-lg font-bold ${section.dark ? "text-white" : "text-obligon-navy"}`}>{card.title}</h3>
                          <p className={`mt-2 text-sm leading-5 ${section.dark ? "text-[#b8c4ff]" : "text-obligon-text"}`}>{card.body}</p>
                        </article>
                      );
                    })}
                  </div>
                ) : null}

                {section.table ? (
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-[720px] w-full border-collapse text-left text-sm">
                      <thead className="border-b border-obligon-border text-xs uppercase text-obligon-text font-bold">
                        <tr>
                          <th className="py-4 pr-4">Category</th>
                          <th className="py-4 pr-4">Purpose</th>
                          <th className="py-4 pr-4">Duration</th>
                          <th className="py-4 text-right">Consent Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { category: "Strictly Essential", purpose: "Authentication tokens, session security, fraud detection", duration: "Session / 1 Year", key: "essential" as const, toggleable: false },
                          { category: "Performance & Analytics", purpose: "Dispenser latency telemetry and error monitoring", duration: "6 Months", key: "analytics" as const, toggleable: true },
                          { category: "Functional Preferences", purpose: "Theme, remembering station locator filters and zoom", duration: "1 Year", key: "functional" as const, toggleable: true },
                          { category: "Marketing Communications", purpose: "Product announcements and industry logistics digests", duration: "90 Days", key: "marketing" as const, toggleable: true }
                        ].map((row) => (
                          <tr key={row.category} className="border-b border-obligon-border/60">
                            <td className="py-5 pr-4 font-bold text-obligon-navy">{row.category}</td>
                            <td className="py-5 pr-4 leading-5 text-obligon-text">{row.purpose}</td>
                            <td className="py-5 pr-4 text-obligon-navy font-mono text-xs">{row.duration}</td>
                            <td className="py-5 text-right">
                              {row.toggleable ? (
                                <button
                                  type="button"
                                  onClick={() => setCookiePrefs((p) => ({ ...p, [row.key]: !p[row.key] }))}
                                  className={`ml-auto flex h-6 w-11 items-center rounded-full p-0.5 transition ${cookiePrefs[row.key] ? "bg-obligon-green" : "bg-[#c6c5d1]"}`}
                                >
                                  <span className={`size-5 rounded-full bg-white transition ${cookiePrefs[row.key] ? "translate-x-5" : ""}`} />
                                </button>
                              ) : (
                                <span className="rounded-full border border-obligon-green/20 bg-obligon-green/10 px-3 py-1 text-[10px] font-extrabold uppercase text-obligon-green">
                                  ALWAYS ACTIVE
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            ))}

            {active === "cookies" ? (
              <section className="rounded-2xl bg-obligon-navy p-8 text-white shadow-hero">
                <div className="grid gap-6 md:grid-cols-2 items-center">
                  <div>
                    <h2 className="font-display text-2xl font-bold">Managing Your Privacy Controls</h2>
                    <p className="mt-3 text-sm leading-6 text-[#b8c4ff]">
                      You have the right to withdraw or customize consent at any time. Adjusting telemetry settings will not affect Fuelvista fleet card authorizations.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        onClick={handleSavePreferences}
                        disabled={savingPrefs}
                        className="inline-flex h-12 items-center gap-2 rounded-xl bg-obligon-green px-6 text-sm font-bold text-white shadow-green hover:bg-obligon-green/90 transition"
                        type="button"
                      >
                        {savingPrefs ? <Loader2 size={16} className="animate-spin" /> : "Save Preferences"}
                      </button>
                      <button
                        onClick={handleAcceptAll}
                        className="h-12 rounded-xl border border-white/20 px-6 text-sm font-bold text-white hover:bg-white/10 transition"
                        type="button"
                      >
                        Accept All
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                    <p className="text-xs font-bold uppercase tracking-[1.6px] text-obligon-lime">Statutory Rights</p>
                    <p className="mt-3 text-sm leading-6 text-[#b8c4ff]">
                      Obligon LTD complies with the Nigeria Data Protection Act (NDPA) 2023. You may request data access or deletion anytime via our Data Protection Officer.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {active === "privacy" ? (
              <section className="rounded-2xl border border-obligon-border bg-white p-8 shadow-card">
                <h2 className="font-display text-2xl font-bold text-obligon-navy">NDPA / GDPR Data Subject Request</h2>
                <p className="mt-2 text-sm text-obligon-text">
                  Exercise your right to access, rectify, or request erasure of your personal and vehicle telemetry records.
                </p>

                {dataReqSent ? (
                  <div className="mt-6 rounded-xl bg-[#e8fbd7] p-4 text-sm font-bold text-obligon-green flex items-center gap-2">
                    <Check size={18} />
                    Data subject request received. Our DPO will reply to {dataReqEmail} within 7 business days.
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (dataReqEmail) {
                        setDataReqSent(true);
                        toastSuccess("Data subject request submitted.");
                      }
                    }}
                    className="mt-6 space-y-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-bold text-obligon-text block mb-1">Your Account Email</label>
                        <input
                          type="email"
                          value={dataReqEmail}
                          onChange={(e) => setDataReqEmail(e.target.value)}
                          placeholder="user@obligon.energy"
                          className="h-11 w-full rounded-xl border border-obligon-border px-4 text-sm outline-none focus:border-obligon-green"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-obligon-text block mb-1">Request Type</label>
                        <select
                          value={dataReqType}
                          onChange={(e) => setDataReqType(e.target.value)}
                          className="h-11 w-full rounded-xl border border-obligon-border px-3 text-sm outline-none focus:border-obligon-green"
                        >
                          <option>Export Personal Data Copy (JSON/CSV)</option>
                          <option>Delete Telemetry &amp; Location History</option>
                          <option>Rectify Incorrect Account Data</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="h-11 rounded-xl bg-obligon-navy px-6 text-xs font-bold text-white shadow-hero hover:bg-obligon-navy/90 transition"
                    >
                      Submit Data Request
                    </button>
                  </form>
                )}
              </section>
            ) : null}

            <section className="border-t border-obligon-border pt-8 text-base leading-[26px] text-obligon-text">
              <p>
                Have questions about our terms or privacy policy? Contact our Data Protection Officer at{" "}
                <Link href={routes.support} className="font-bold text-obligon-green hover:underline">
                  dpo@obligon.energy
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </section>
      <SiteFooter active={active} />
    </main>
  );
}
