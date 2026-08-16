import Link from "next/link";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { Input } from "@/components/site/Input";
import { PageIntro } from "@/components/site/PageIntro";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { routes } from "@/components/site/routes";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-obligon-mist text-obligon-navy">
      <SiteHeader />
      <section className="mx-auto grid max-w-[1280px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_460px] lg:px-16 lg:py-24">
        <div>
          <PageIntro
            eyebrow="Support Desk"
            title="Contact Obligon"
            body="Reach the team for onboarding, enterprise sales, partnership verification, legal requests, or support escalations."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Mail, label: "Email", value: "support@obligon.energy" },
              { icon: Phone, label: "Phone", value: "+234 800 OBLIGON" },
              { icon: MapPin, label: "Office", value: "Lagos, Nigeria" }
            ].map((item) => (
              <article key={item.label} className="rounded-xl border border-obligon-border bg-white p-5">
                <item.icon className="text-obligon-green" size={22} />
                <p className="mt-4 text-xs font-bold uppercase tracking-[1.2px] text-obligon-text">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-obligon-navy">{item.value}</p>
              </article>
            ))}
          </div>
        </div>

        <form className="rounded-2xl border border-obligon-border bg-white p-6 shadow-card">
          <h2 className="font-display text-2xl font-bold">Send a request</h2>
          <div className="mt-6 space-y-4">
            <Input label="Full Name" name="name" placeholder="Ada Okafor" />
            <Input label="Work Email" name="email" type="email" placeholder="ada@company.ng" />
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Request Type</span>
              <select className="mt-2 h-12 w-full rounded-lg border border-obligon-border bg-white px-4 text-sm text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20" name="requestType">
                <option>Enterprise onboarding</option>
                <option>Partner verification</option>
                <option>Career application</option>
                <option>Legal or privacy request</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Message</span>
              <textarea className="mt-2 min-h-32 w-full rounded-lg border border-obligon-border bg-white px-4 py-3 text-sm text-obligon-navy outline-none placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20" name="message" placeholder="Tell us what you need." />
            </label>
          </div>
          <Link href={routes.authSuccess} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-obligon-green text-base font-bold text-white shadow-green">
            Submit Request
            <Send size={16} />
          </Link>
        </form>
      </section>
      <SiteFooter />
    </main>
  );
}

