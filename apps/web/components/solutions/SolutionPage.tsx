import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Cpu, CreditCard, Gauge, LockKeyhole, MapPinned, RadioTower, Zap } from "lucide-react";
import { assets } from "@/components/landing/assets";
import { PageIntro } from "@/components/site/PageIntro";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { routes } from "@/components/site/routes";

type SolutionFeature = {
  title: string;
  body: string;
  icon: "card" | "map" | "lock" | "chart" | "gauge" | "tower" | "cpu" | "zap";
};

type SolutionPageProps = {
  eyebrow: string;
  name: string;
  title: React.ReactNode;
  body: string;
  stats: Array<{ label: string; value: string }>;
  features: SolutionFeature[];
  modules: string[];
  accent: "green" | "blue" | "lime";
};

const iconMap = {
  card: CreditCard,
  map: MapPinned,
  lock: LockKeyhole,
  chart: BarChart3,
  gauge: Gauge,
  tower: RadioTower,
  cpu: Cpu,
  zap: Zap
};

const accentClasses = {
  green: "from-obligon-green/30",
  blue: "from-[#011554]/35",
  lime: "from-obligon-lime/30"
};

export function SolutionPage({ eyebrow, name, title, body, stats, features, modules, accent }: SolutionPageProps) {
  return (
    <main className="min-h-screen bg-obligon-mist text-obligon-navy">
      <SiteHeader />

      <section className="overflow-hidden bg-obligon-navy text-white">
        <div className="mx-auto grid min-h-[640px] max-w-[1280px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_520px] lg:px-16">
          <div>
            <PageIntro
              eyebrow={eyebrow}
              title={title}
              body={body}
              tone="inverse"
            />
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href={`${routes.login}#signup`} className="inline-flex h-14 items-center justify-center gap-2 rounded-lg bg-obligon-green px-7 text-sm font-bold text-white shadow-green">
                Start with {name}
                <ArrowRight size={16} />
              </Link>
              <Link href={routes.support} className="inline-flex h-14 items-center justify-center rounded-lg border border-white/20 px-7 text-sm font-bold text-white">
                Talk to Sales
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className={`absolute -inset-16 rounded-full bg-gradient-to-br ${accentClasses[accent]} to-transparent blur-3xl`} />
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-5 shadow-hero">
              <div className="rounded-3xl bg-white p-5">
                <Image src={assets.fuelvistaCard} width={512} height={341} alt={`${name} product interface`} className="w-full rounded-2xl" priority />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="font-display text-2xl font-bold text-obligon-lime">{stat.value}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[1px] text-white/60">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 lg:px-16 lg:py-28">
        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[1.6px] text-obligon-green">Platform Modules</p>
            <h2 className="mt-4 font-display text-4xl font-extrabold leading-[44px]">Designed for daily operators.</h2>
            <p className="mt-5 text-base leading-6 text-obligon-text">
              Each module keeps field teams, finance leads, and operators aligned from request to reconciliation.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => {
              const Icon = iconMap[feature.icon];
              return (
                <article key={feature.title} className="rounded-xl border border-obligon-border bg-white p-6">
                  <Icon className="text-obligon-green" size={26} />
                  <h3 className="mt-5 font-display text-xl font-bold">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-obligon-text">{feature.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-obligon-border bg-white">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_420px] lg:px-16 lg:py-24">
          <div>
            <h2 className="font-display text-4xl font-extrabold">Operational workflow</h2>
            <div className="mt-10 grid gap-4">
              {modules.map((module, index) => (
                <div key={module} className="flex gap-4 rounded-xl border border-obligon-border bg-obligon-mist p-5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-obligon-green text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="self-center text-base font-semibold text-obligon-navy">{module}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="rounded-[32px] bg-obligon-navy p-8 text-white">
            <p className="text-xs uppercase tracking-[1.6px] text-obligon-lime">Enterprise Ready</p>
            <h3 className="mt-4 font-display text-3xl font-extrabold leading-10">One connected control surface.</h3>
            <p className="mt-4 text-sm leading-6 text-[#b8c4ff]">
              Combine {name} with Obligon onboarding, station verification, ledger controls, and support workflows.
            </p>
            <ul className="mt-8 space-y-4">
              {["Role-based approvals", "Secure settlement records", "Partner support workflows"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/85">
                  <CheckCircle2 className="text-obligon-lime" size={18} />
                  {item}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-[1152px] px-5 py-20 sm:px-8 lg:px-0">
        <div className="rounded-[40px] bg-obligon-panel px-6 py-14 text-center sm:px-12">
          <p className="text-xs font-bold uppercase tracking-[1.6px] text-obligon-green">{name} Deployment</p>
          <h2 className="mt-4 font-display text-4xl font-extrabold">Ready to deploy across your network?</h2>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href={`${routes.login}#signup`} className="inline-flex h-14 items-center justify-center rounded-lg bg-obligon-green px-8 text-base font-bold text-white shadow-green">
              Request Onboarding
            </Link>
            <Link href={routes.support} className="inline-flex h-14 items-center justify-center rounded-lg border border-obligon-navy px-8 text-base font-bold text-obligon-navy">
              Contact Support
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter active="solutions" />
    </main>
  );
}
