import Link from "next/link";
import { Activity, CreditCard, Gauge, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { routes } from "@/components/site/routes";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-obligon-mist text-obligon-navy">
      <SiteHeader />
      <section className="mx-auto max-w-[1180px] px-5 py-12 sm:px-8 lg:px-16">
        <div className="rounded-[32px] bg-obligon-navy p-8 text-white lg:p-12">
          <p className="text-xs uppercase tracking-[1.6px] text-obligon-lime">Dashboard Preview</p>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[44px]">Welcome to Obligon Control.</h1>
          <p className="mt-4 max-w-2xl text-base leading-6 text-[#b8c4ff]">
            This frontend-only preview confirms the authenticated journey and links into the solution modules.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-4">
          {[
            { icon: CreditCard, label: "Active Cards", value: "248" },
            { icon: Gauge, label: "Monthly Volume", value: "85k L" },
            { icon: Activity, label: "Open Reviews", value: "12" },
            { icon: ShieldCheck, label: "Risk Status", value: "Clear" }
          ].map((item) => (
            <article key={item.label} className="rounded-xl border border-obligon-border bg-white p-6">
              <item.icon className="text-obligon-green" size={24} />
              <p className="mt-5 text-sm text-obligon-text">{item.label}</p>
              <p className="mt-1 font-display text-3xl font-bold">{item.value}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {[
            { title: "FuelVista", href: routes.fuelvista, body: "Manage fuel cards, limits, stations, and transaction controls." },
            { title: "EnergyVista", href: routes.energyvista, body: "Plan supply, inventory pressure, fulfilment, and exposure." },
            { title: "GenVista", href: routes.genvista, body: "Track generator runtime, dispatch, uptime, and facility spend." }
          ].map((item) => (
            <Link key={item.title} href={item.href} className="rounded-xl border border-obligon-border bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-card">
              <h2 className="font-display text-2xl font-bold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-obligon-text">{item.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

