import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
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

export function SolutionPage({ name, title, body, stats, features, modules }: SolutionPageProps) {
  return (
    <main className="min-h-screen bg-obligon-mist text-obligon-navy">
      <SiteHeader />

      <section className="overflow-hidden bg-obligon-navy text-white">
        <div className="mx-auto grid min-h-[640px] max-w-[1280px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_520px] lg:px-16">
          <div>
            <PageIntro
              title={title}
              body={body}
              tone="inverse"
            />
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href={name==="FuelVista"?routes.signup:`/support?request=${name}` } className="inline-flex h-14 items-center justify-center gap-2 rounded-lg bg-obligon-green px-7 text-base font-bold text-white">
                Start with {name}
                <ArrowRight size={16} />
              </Link>
              <Link href={routes.support} className="inline-flex h-14 items-center justify-center rounded-lg border border-white/20 px-7 text-base font-bold text-white">
                Talk to sales
              </Link>
            </div>
          </div>

          <div className="relative min-w-0">
            <div className="relative overflow-hidden">
              {name === "FuelVista" ? <Image src={assets.fuelvistaCard} width={512} height={341} alt="FuelVista virtual fuel card" className="w-full rounded-2xl" priority /> : <div className="bg-obligon-blue p-7 sm:p-10">
                <p className="text-lg font-semibold text-obligon-lime">{name}</p>
                <h2 className="mt-5 font-display text-3xl font-bold leading-tight">What to include in your enquiry</h2>
                <ul className="mt-6 space-y-4 text-base leading-7 text-white/85">
                  {(name === "EnergyVista" ? ["Fuel type and quantity", "Delivery location and access", "Required dates and supply schedule"] : ["Facility location and access", "Generator model and capacity", "Fuel or maintenance requirements"]).map(detail => <li key={detail} className="flex items-start gap-3"><CheckCircle2 size={18} aria-hidden="true" className="mt-1 shrink-0 text-obligon-lime" />{detail}</li>)}
                </ul>
              </div>}
              <div className="mt-7 grid grid-cols-3 gap-3 border-t border-white/20 pt-6 sm:gap-6">
                {stats.map((stat) => (
                  <div key={stat.label} className="min-w-0">
                    <p className="break-words font-display text-lg font-bold text-obligon-lime sm:text-2xl">{stat.value}</p>
                    <p className="mt-2 text-sm leading-6 text-white/80">{stat.label}</p>
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
            <h2 className="font-display text-4xl font-extrabold leading-[44px]">{name} tools</h2>
            <p className="mt-5 text-base leading-6 text-obligon-text">
              Review the available tools or discuss the service scope with our team before you proceed.
            </p>
          </div>
          <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2">
            {features.map((feature) => {
              return (
                <article key={feature.title}>
                  <h3 className="font-display text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-3 text-base leading-6 text-obligon-text">{feature.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_420px] lg:px-16 lg:py-24">
          <div>
            <h2 className="font-display text-4xl font-extrabold">Operational workflow</h2>
            <ul className="mt-8 space-y-5">
              {modules.map((module) => (
                <li key={module} className="flex items-start gap-3">
                  <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-obligon-green" />
                  <p className="text-base leading-7 text-obligon-navy">{module}</p>
                </li>
              ))}
            </ul>
          </div>
          <aside className="rounded-[32px] bg-obligon-navy p-8 text-white">
            <h3 className="font-display text-3xl font-extrabold leading-10">Plan your company requirements</h3>
            <p className="mt-4 text-base leading-6 text-[#b8c4ff]">
              Discuss {name} with our team. We will confirm account setup, available services, partner requirements, and support.
            </p>
            <ul className="mt-8 space-y-4">
              {["Role-based approvals", "Recorded fuel transactions", "Partner support workflows"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-base text-white/85">
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
          <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight sm:text-4xl">Discuss your requirements</h2>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href={name==="FuelVista"?routes.signup:`/support?request=${name}` } className="inline-flex h-14 items-center justify-center rounded-lg bg-obligon-green px-8 text-base font-bold text-white">
              Request onboarding
            </Link>
            <Link href={routes.support} className="inline-flex h-14 items-center justify-center rounded-lg border border-obligon-navy px-8 text-base font-bold text-obligon-navy">
              Contact support
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter active="solutions" />
    </main>
  );
}
