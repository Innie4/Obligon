"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Cookie, Database, FileText, LockKeyhole, ShieldCheck, ToggleLeft, Check, Loader2 } from "lucide-react";
import { PageIntro } from "@/components/site/PageIntro";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";
import { publicApi } from "@/lib/services";

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
  const { success: toastSuccess, error: toastError } = useToast();
  const [cookiePrefs, setCookiePrefs] = useState({
    essential: true,
    analytics: true,
    functional: true,
    marketing: false
  });
  const [dataReqEmail, setDataReqEmail] = useState("");
  const [dataReqType, setDataReqType] = useState("export");
  const [dataReqSent, setDataReqSent] = useState(false);
  const [dataReqSubmitting, setDataReqSubmitting] = useState(false);
  const [dataReqError, setDataReqError] = useState("");
  const dataReqSubmittingRef = React.useRef(false);
  const dataReqSentRef = React.useRef(false);
  const dataReqVersion = React.useRef(0);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => () => { dataReqVersion.current += 1; }, []);

  async function handleDataRequest(event: React.FormEvent) {
    event.preventDefault();
    if (dataReqSubmittingRef.current || dataReqSentRef.current || !dataReqEmail.trim()) return;
    dataReqSubmittingRef.current = true;
    const version = dataReqVersion.current;
    setDataReqSubmitting(true);
    setDataReqError("");
    try {
      await publicApi.submitDataRequest({ email: dataReqEmail.trim(), requestType: dataReqType });
      if (dataReqVersion.current !== version) return;
      dataReqSentRef.current = true;
      setDataReqSent(true);
      toastSuccess("Data subject request submitted.");
    } catch (err) {
      if (dataReqVersion.current !== version) return;
      const message = err instanceof Error ? err.message : "Could not submit the request. Please try again.";
      setDataReqError(message);
      toastError(message);
    } finally {
      if (dataReqVersion.current === version) {
        dataReqSubmittingRef.current = false;
        setDataReqSubmitting(false);
      }
    }
  }

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
    (async () => {
      try {
        localStorage.setItem("obligon_cookie_consent", JSON.stringify(cookiePrefs));
        await publicApi.saveCookieConsent(cookiePrefs, navigator.doNotTrack === "1");
      } catch {setSavingPrefs(false);toastError("Saved on this device; server recording failed. Please retry.");return;}
      setSavingPrefs(false);
      toastSuccess("Cookie preferences saved.");
    })();
  }

  function handleAcceptAll() {
    const all = { essential: true, analytics: navigator.doNotTrack!=="1", functional: true, marketing: navigator.doNotTrack!=="1" };
    setCookiePrefs(all);
    try {
      localStorage.setItem("obligon_cookie_consent", JSON.stringify(all));
    } catch {}
    void publicApi.saveCookieConsent(all, navigator.doNotTrack === "1").then(()=>toastSuccess("Cookie preferences saved.")).catch(() => toastError("Saved on this device; server recording failed. Please retry."));
  }

  return (
    <main className="min-h-screen bg-obligon-mist text-obligon-navy">
      <SiteHeader />
      <section className="mx-auto max-w-[1280px] px-5 pb-20 pt-16 sm:px-8 lg:px-16 lg:pb-28">
        <PageIntro eyebrow={eyebrow} title={title} body={`${intro} Last updated ${updated}.`} />

        <div className="mt-14 grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12">
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

          <div className="min-w-0 space-y-12">
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
                  <div className="mt-6 max-w-full overflow-x-auto" role="region" aria-label="Cookie categories and preferences" tabIndex={0}>
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
                                  role="switch"
                                  aria-label={row.category}
                                  aria-checked={cookiePrefs[row.key]}
                                  onClick={() => setCookiePrefs((p) => ({ ...p, [row.key]: !p[row.key] }))}
                                  className="ml-auto flex min-h-11 w-11 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green"
                                >
                                  <span aria-hidden="true" className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${cookiePrefs[row.key] ? "bg-obligon-green" : "bg-[#c6c5d1]"}`}>
                                    <span className={`size-5 rounded-full bg-white transition ${cookiePrefs[row.key] ? "translate-x-5" : ""}`} />
                                  </span>
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
                      You can submit a request to access, correct, or delete your personal data using the form below. Our team will review your request and any identity checks needed to process it.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {active === "privacy" ? (
              <section className="rounded-2xl border border-obligon-border bg-white p-8 shadow-card">
                <h2 className="font-display text-2xl font-bold text-obligon-navy">Personal data request</h2>
                <p className="mt-2 text-sm text-obligon-text">
                  Ask to access, correct, or delete the personal data held about your account.
                </p>

                {dataReqSent ? (
                  <div role="status" className="mt-6 rounded-xl bg-[#e8fbd7] p-4 text-sm font-bold text-obligon-green flex items-center gap-2">
                    <Check size={18} />
                    Data request received. We will use {dataReqEmail} to contact you about the next steps.
                  </div>
                ) : (
                  <form
                    onSubmit={handleDataRequest}
                    aria-busy={dataReqSubmitting}
                    className="mt-6 space-y-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="privacy-request-email" className="text-xs font-bold text-obligon-text block mb-1">Your Account Email</label>
                        <input
                          id="privacy-request-email"
                          autoComplete="email"
                          disabled={dataReqSubmitting}
                          type="email"
                          value={dataReqEmail}
                          onChange={(e) => setDataReqEmail(e.target.value)}
                          placeholder="user@obligon.energy"
                          className="h-11 w-full rounded-xl border border-obligon-border px-4 text-sm outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="privacy-request-type" className="text-xs font-bold text-obligon-text block mb-1">Request Type</label>
                        <select
                          id="privacy-request-type"
                          disabled={dataReqSubmitting}
                          value={dataReqType}
                          onChange={(e) => setDataReqType(e.target.value)}
                          className="h-11 w-full rounded-xl border border-obligon-border px-3 text-sm outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                        >
                          <option value="export">Export Personal Data Copy (JSON/CSV)</option>
                          <option value="deletion">Delete Telemetry &amp; Location History</option>
                          <option value="correction">Rectify Incorrect Account Data</option>
                        </select>
                      </div>
                    </div>
                    {dataReqError ? <p role="alert" className="text-sm font-bold text-[#c1121f]">{dataReqError}</p> : null}
                    <button
                      type="submit"
                      disabled={dataReqSubmitting}
                      className="h-11 rounded-xl bg-obligon-navy px-6 text-xs font-bold text-white shadow-hero hover:bg-obligon-navy/90 transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2"
                    >
                      {dataReqSubmitting ? "Submitting Data Request…" : "Submit Data Request"}
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
