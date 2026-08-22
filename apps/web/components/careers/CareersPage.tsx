import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Sparkles, Wifi, HeartPulse, ShieldCheck, Users } from "lucide-react";
import { assets } from "@/components/landing/assets";
import { PageIntro } from "@/components/site/PageIntro";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { routes } from "@/components/site/routes";

const stats = [
  { value: "150M+", label: "Litres Managed", body: "Powering the backbone of logistics across Nigeria with precision and speed." },
  { value: "12+", label: "Key Regions", body: "Growing footprint across the continent, tackling complex infrastructure challenges." },
  { value: "4.8/5", label: "Team Happiness", body: "Voted one of the most innovative and supportive fintech environments in West Africa." }
];

const roles = [
  {
    badge: "Engineering",
    location: "Lagos / Hybrid",
    title: "Senior Backend Engineer (Go/Node)",
    body: "Scale our cross-region transaction ledger supporting millions of energy interactions.",
    urgent: false
  },
  {
    badge: "Operations",
    location: "Remote",
    title: "Fleet Operations Manager",
    body: "Partner with enterprise customers to improve operational velocity and reliability.",
    urgent: false
  },
  {
    badge: "Compliance",
    location: "Remote",
    title: "Risk & Compliance Officer",
    body: "Ensure our fintech-energy hybrid platform meets the highest regulatory standards.",
    urgent: true
  },
  {
    badge: "Product",
    location: "Lagos / Hybrid",
    title: "Product Designer (Fintech)",
    body: "Craft high-precision interfaces for complex industrial fleet management data.",
    urgent: false
  }
];

export function CareersPage() {
  return (
    <main className="min-h-screen bg-obligon-mist text-obligon-navy">
      <SiteHeader />

      <section className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:px-16 lg:py-20">
        <div>
          <PageIntro
            title={
              <>
                Join the <span className="text-obligon-green">Energy</span> Revolution.
              </>
            }
            body="We are building the digital infrastructure for Africa's energy and logistics ecosystem. Join a team of mission-driven innovators redefining fintech for physical assets."
          />
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link href="#open-roles" className="inline-flex h-14 items-center justify-center gap-2 rounded-lg bg-obligon-navy px-7 text-sm font-bold text-white">
              View Open Roles
              <ArrowRight size={16} />
            </Link>
            <Link href="#culture" className="inline-flex h-14 items-center justify-center rounded-lg border border-obligon-text px-7 text-sm font-bold text-obligon-navy">
              Our Culture
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-5 -rotate-2 rounded-[32px] bg-obligon-lime/20" />
          <div className="relative overflow-hidden rounded-[32px] border border-obligon-border bg-white p-1 shadow-card">
            <Image src={assets.stationPhoto} width={760} height={512} alt="Obligon LTD operations team" className="h-[420px] w-full object-cover" priority />
            <div className="absolute inset-x-1 bottom-1 h-28 bg-gradient-to-t from-obligon-navy/40 to-transparent" />
          </div>
        </div>
      </section>

      <section className="border-y border-obligon-border bg-white px-5 py-16 sm:px-8 lg:px-16 lg:py-24">
        <div className="mx-auto grid max-w-[1152px] gap-10 md:grid-cols-3">
          {stats.map((stat) => (
            <article key={stat.label} className="text-center">
              <p className="font-display text-5xl leading-[72px] text-obligon-green">{stat.value}</p>
              <h2 className="mt-2 font-display text-2xl font-bold leading-8">{stat.label}</h2>
              <p className="mx-auto mt-3 max-w-[280px] text-sm leading-5 text-obligon-text">{stat.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="culture" className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 lg:px-16 lg:py-32">
        <div>
          <h2 className="font-display text-5xl font-extrabold leading-[56px]">Life at Obligon LTD</h2>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-obligon-text">
            We value transparency, physical-world impact, and radical ownership. We don&apos;t just write code; we move
            energy.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-6">
          <article className="rounded-xl border border-obligon-border bg-white p-8 lg:col-span-3">
            <Sparkles className="text-obligon-green" size={28} />
            <h3 className="mt-8 font-display text-2xl font-bold">Radical Accountability</h3>
            <p className="mt-3 text-sm leading-6 text-obligon-text">Small teams own real outcomes, from station onboarding to settlement velocity.</p>
            <div className="mt-8 overflow-hidden rounded-lg">
              <Image src={assets.fuelvistaCard} width={512} height={341} alt="FuelVista dashboard card" className="w-full" />
            </div>
          </article>
          <article className="rounded-xl bg-obligon-navy p-8 text-white lg:col-span-3">
            <Users className="text-obligon-lime" size={28} />
            <h3 className="mt-8 font-display text-2xl font-bold">Unified Logistics</h3>
            <p className="mt-3 text-sm leading-6 text-[#b8c4ff]">
              Our work spans fuel, financing, compliance, and field operations across a connected national network.
            </p>
          </article>
          <article className="rounded-xl border border-obligon-border bg-[#e6eeff] p-8 lg:col-span-2">
            <Wifi className="text-obligon-green" size={28} />
            <h3 className="mt-6 font-display text-2xl font-bold">Remote-First</h3>
            <p className="mt-3 text-sm leading-5 text-obligon-text">Flexibility that helps you do your best work from anywhere.</p>
          </article>
          <article className="rounded-xl border border-obligon-border bg-white p-8 lg:col-span-4">
            <div className="grid gap-8 md:grid-cols-[1fr_260px] md:items-center">
              <div>
                <HeartPulse className="text-obligon-green" size={28} />
                <h3 className="mt-6 font-display text-2xl font-bold">Health & Wellness</h3>
                <p className="mt-3 text-base leading-6 text-obligon-text">Private insurance, mental health support, and wellness benefits for the team.</p>
              </div>
              <div className="grid h-32 place-items-center rounded-lg border border-dashed border-obligon-text bg-obligon-mist text-center text-xs uppercase tracking-[1.2px] text-obligon-text">
                Wellness Program Activated
              </div>
            </div>
          </article>
        </div>
      </section>

      <section id="open-roles" className="mx-auto max-w-[1280px] px-5 pb-20 sm:px-8 lg:px-16 lg:pb-32">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-4xl font-extrabold">Open Positions</h2>
            <p className="mt-3 text-sm text-obligon-text">Join us at our Lagos HQ or work remotely from across the globe.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["All Roles", "Engineering", "Operations"].map((item, index) => (
              <button key={item} className={`rounded-full px-4 py-2 text-xs font-bold ${index === 0 ? "bg-obligon-navy text-white" : "bg-white text-obligon-text"}`} type="button">
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {roles.map((role) => (
            <article key={role.title} className="relative overflow-hidden rounded-xl border border-obligon-border bg-white p-6">
              {role.urgent ? <span className="absolute right-[-34px] top-5 rotate-45 bg-obligon-green px-10 py-1 text-[10px] font-extrabold uppercase tracking-[1px] text-white">Urgent</span> : null}
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded bg-obligon-lime/30 px-2 py-1 text-[10px] font-bold uppercase tracking-[1px] text-[#131f00]">{role.badge}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-obligon-text">
                      <MapPin size={13} />
                      {role.location}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-2xl font-bold">{role.title}</h3>
                  <p className="mt-2 text-sm leading-5 text-obligon-text">{role.body}</p>
                </div>
                <Link href={routes.support} className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.6px] text-obligon-text">
                  Full-time
                  <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-obligon-text">Don&apos;t see a role that fits?</p>
          <Link href={routes.support} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-obligon-green">
            Send a General Application
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="mx-auto mb-20 max-w-[1152px] px-5 sm:px-8 lg:px-0">
        <div className="rounded-[40px] bg-obligon-navy px-6 py-16 text-center text-white sm:px-12 lg:px-24 lg:py-24">
          <ShieldCheck className="mx-auto text-obligon-lime" size={36} />
          <h2 className="mt-6 font-display text-4xl font-extrabold leading-[44px] lg:text-[64px] lg:leading-[72px]">
            Ready to power the future?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-6 text-[#b8c4ff]">
            We&apos;re looking for the brightest minds to help us solve the most complex energy problems on the continent.
          </p>
          <Link href={routes.support} className="mt-8 inline-flex h-14 items-center justify-center rounded-xl bg-obligon-green px-10 text-base font-bold text-white">
            Apply Now
          </Link>
        </div>
      </section>

      <SiteFooter active="careers" />
    </main>
  );
}

