import Link from "next/link";
import { CheckCircle2, Cookie, Database, FileText, LockKeyhole, ShieldCheck, ToggleLeft } from "lucide-react";
import { PageIntro } from "@/components/site/PageIntro";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { routes } from "@/components/site/routes";

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
  return (
    <main className="min-h-screen bg-obligon-mist text-obligon-navy">
      <SiteHeader />
      <section className="mx-auto max-w-[1280px] px-5 pb-20 pt-16 sm:px-8 lg:px-16 lg:pb-28">
        <PageIntro eyebrow={eyebrow} title={title} body={`${intro} Last updated ${updated}.`} />

        <div className="mt-14 grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-4">
              <p className="pb-2 text-sm uppercase text-obligon-text">Contents</p>
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block border-l-2 border-obligon-green py-1 pl-4 text-sm font-bold text-obligon-green"
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
                className={section.dark ? "rounded-xl bg-obligon-navy p-8 text-white" : "rounded-xl border border-obligon-border bg-white p-6 sm:p-8"}
              >
                <div className="flex flex-col gap-3 border-b border-current/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
                  <h2 className={`font-display text-2xl font-bold leading-8 ${section.dark ? "text-white" : "text-obligon-navy"}`}>
                    {section.title}
                  </h2>
                  {section.table ? <span className="text-xs uppercase tracking-[1.2px] text-obligon-text">Updated Oct 2024</span> : null}
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
                        <article key={card.title} className={section.dark ? "rounded-lg border border-white/10 bg-white/5 p-5" : "rounded-lg border border-obligon-border bg-obligon-mist p-5"}>
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
                      <thead className="border-b border-obligon-border text-xs uppercase text-obligon-text">
                        <tr>
                          <th className="py-4 pr-4">Category</th>
                          <th className="py-4 pr-4">Purpose</th>
                          <th className="py-4 pr-4">Duration</th>
                          <th className="py-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.map((row) => (
                          <tr key={row.category} className="border-b border-obligon-border/60">
                            <td className="py-5 pr-4 font-bold text-obligon-navy">{row.category}</td>
                            <td className="py-5 pr-4 leading-5 text-obligon-text">{row.purpose}</td>
                            <td className="py-5 pr-4 text-obligon-navy">{row.duration}</td>
                            <td className="py-5 text-right">
                              {row.status === "toggle" ? (
                                <span className={`ml-auto flex h-6 w-11 items-center rounded-full p-0.5 ${row.active ? "bg-obligon-green" : "bg-[#c6c5d1]"}`}>
                                  <span className={`size-5 rounded-full bg-white transition ${row.active ? "translate-x-5" : ""}`} />
                                </span>
                              ) : (
                                <span className="rounded-full border border-obligon-green/20 bg-obligon-green/10 px-3 py-1 text-[10px] font-bold uppercase text-obligon-green">
                                  {row.status}
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
              <section className="rounded-xl bg-obligon-navy p-8 text-white">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h2 className="font-display text-2xl font-bold">Managing Your Controls</h2>
                    <p className="mt-4 text-sm leading-6 text-[#b8c4ff]">
                      You have the right to withdraw consent at any time. Adjusting settings may impact real-time
                      reporting for FuelVista and GenVista modules.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-obligon-green px-5 text-sm font-bold text-white" type="button">
                        Save Preferences
                        <ToggleLeft size={16} />
                      </button>
                      <button className="h-11 rounded-lg border border-white/20 px-5 text-sm font-bold text-white" type="button">
                        Accept All
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-[1.6px] text-obligon-lime">Browser Settings</p>
                    <p className="mt-4 text-sm leading-6 text-[#b8c4ff]">
                      Most browsers allow control of cookies through settings. You can also learn more at aboutcookies.org.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="border-t border-obligon-border pt-8 text-base leading-[26px] text-obligon-text">
              <p>
                Questions? Reach out to our data protection team at{" "}
                <Link href={routes.support} className="font-bold text-obligon-green">
                  privacy@obligon.energy
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

