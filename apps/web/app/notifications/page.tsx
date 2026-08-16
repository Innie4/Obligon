import Link from "next/link";
import { Bell, CheckCircle2, Clock, FileCheck2, ShieldAlert } from "lucide-react";
import { PageIntro } from "@/components/site/PageIntro";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { routes } from "@/components/site/routes";

const notifications = [
  {
    title: "Station verification is in review",
    body: "Your partner application has moved to regional field validation.",
    time: "2 mins ago",
    icon: FileCheck2,
    tone: "bg-obligon-green/10 text-obligon-green"
  },
  {
    title: "Security check completed",
    body: "Multi-factor validation is active on your Obligon account.",
    time: "18 mins ago",
    icon: CheckCircle2,
    tone: "bg-obligon-lime/30 text-[#131f00]"
  },
  {
    title: "Compliance document needed",
    body: "Upload an updated CAC document to complete company verification.",
    time: "Today",
    icon: ShieldAlert,
    tone: "bg-[#fff0f1] text-[#93000a]"
  }
];

export default function NotificationsPage() {
  return (
    <main className="min-h-screen bg-obligon-mist text-obligon-navy">
      <SiteHeader />
      <section className="mx-auto max-w-[960px] px-5 py-16 sm:px-8 lg:py-24">
        <PageIntro
          eyebrow="Account Center"
          title="Notifications"
          body="Track security alerts, onboarding updates, compliance requests, and operational messages from Obligon."
        />

        <div className="mt-10 rounded-2xl border border-obligon-border bg-white shadow-card">
          <div className="flex flex-col gap-4 border-b border-obligon-border p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-obligon-green/10 text-obligon-green">
                <Bell size={21} />
              </span>
              <div>
                <h2 className="font-display text-2xl font-bold">Recent activity</h2>
                <p className="text-sm text-obligon-text">3 unread account updates</p>
              </div>
            </div>
            <button className="h-10 rounded-lg border border-obligon-border px-4 text-sm font-bold text-obligon-navy" type="button">
              Mark all as read
            </button>
          </div>

          <div className="divide-y divide-obligon-border">
            {notifications.map((notification) => {
              const Icon = notification.icon;

              return (
                <article key={notification.title} className="flex gap-4 p-6">
                  <span className={`grid size-11 shrink-0 place-items-center rounded-full ${notification.tone}`}>
                    <Icon size={21} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <h3 className="font-display text-lg font-bold leading-6">{notification.title}</h3>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.6px] text-obligon-text">
                        <Clock size={13} />
                        {notification.time}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-obligon-text">{notification.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={routes.login} className="inline-flex h-12 items-center justify-center rounded-lg bg-obligon-green px-6 text-base font-bold text-white shadow-green">
            Back to Login
          </Link>
          <Link href={routes.support} className="inline-flex h-12 items-center justify-center rounded-lg border border-obligon-navy px-6 text-base font-bold text-obligon-navy">
            Contact Support
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
