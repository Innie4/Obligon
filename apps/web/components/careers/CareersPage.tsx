"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Sparkles, Wifi, HeartPulse, ShieldCheck, Users, X, Loader2, Check, Upload } from "lucide-react";
import { assets } from "@/components/landing/assets";
import { PageIntro } from "@/components/site/PageIntro";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";

const stats = [
  { value: "150M+", label: "Litres Managed", body: "Powering the backbone of logistics across Nigeria with precision and speed." },
  { value: "12+", label: "Key Regions", body: "Growing footprint across the continent, tackling complex infrastructure challenges." },
  { value: "4.8/5", label: "Team Happiness", body: "Voted one of the most innovative and supportive fintech environments in West Africa." }
];

const roles = [
  {
    id: "eng-01",
    badge: "Engineering",
    location: "Lagos / Hybrid",
    title: "Senior Backend Engineer (Go/Node)",
    body: "Scale our cross-region transaction ledger supporting millions of daily energy interactions and sub-second POS authorization.",
    urgent: false
  },
  {
    id: "ops-01",
    badge: "Operations",
    location: "Lagos / Field",
    title: "Fleet Operations Manager",
    body: "Partner with enterprise customers and partner station networks to improve operational velocity and reliability.",
    urgent: false
  },
  {
    id: "comp-01",
    badge: "Compliance",
    location: "Remote / Nigeria",
    title: "Risk & Compliance Officer",
    body: "Ensure our fintech-energy hybrid platform meets the highest DPR, CBN, and NDPR regulatory standards.",
    urgent: true
  },
  {
    id: "prod-01",
    badge: "Product",
    location: "Lagos / Hybrid",
    title: "Product Designer (Fintech)",
    body: "Craft high-precision, low-latency interfaces for complex industrial fleet management and station operator consoles.",
    urgent: false
  },
  {
    id: "eng-02",
    badge: "Engineering",
    location: "Remote / Nigeria",
    title: "Mobile App Engineer (React Native / iOS)",
    body: "Build our driver fleet companion app featuring offline NFC card scanning and biometric transaction authorizations.",
    urgent: true
  }
];

export function CareersPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("All Roles");
  const [activeRole, setActiveRole] = useState<(typeof roles)[0] | null>(null);
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const categories = ["All Roles", "Engineering", "Operations", "Compliance", "Product"];

  const filteredRoles = roles.filter(
    (role) => selectedCategory === "All Roles" || role.badge === selectedCategory
  );

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!applicantName || !applicantEmail) {
      toastError("Please fill out your name and email.");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    setSubmitted(true);
    toastSuccess(`Application submitted for ${activeRole?.title}!`);
  }

  function handleCloseModal() {
    setActiveRole(null);
    setSubmitted(false);
    setApplicantName("");
    setApplicantEmail("");
    setApplicantPhone("");
    setCoverNote("");
    setResumeName("");
  }

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
            <a href="#open-roles" className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-obligon-navy px-7 text-sm font-bold text-white shadow-hero hover:bg-obligon-navy/90 transition">
              View Open Roles
              <ArrowRight size={16} />
            </a>
            <a href="#culture" className="inline-flex h-14 items-center justify-center rounded-xl border border-obligon-text px-7 text-sm font-bold text-obligon-navy hover:bg-white transition">
              Our Culture
            </a>
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
              <h2 className="mt-2 font-display text-2xl font-bold leading-8 text-obligon-navy">{stat.label}</h2>
              <p className="mx-auto mt-3 max-w-[280px] text-sm leading-5 text-obligon-text">{stat.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="culture" className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 lg:px-16 lg:py-32">
        <div>
          <h2 className="font-display text-5xl font-extrabold leading-[56px] text-obligon-navy">Life at Obligon LTD</h2>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-obligon-text">
            We value transparency, physical-world impact, and radical ownership. We don&apos;t just write code; we power national infrastructure.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-6">
          <article className="rounded-2xl border border-obligon-border bg-white p-8 lg:col-span-3 shadow-card">
            <Sparkles className="text-obligon-green" size={28} />
            <h3 className="mt-8 font-display text-2xl font-bold text-obligon-navy">Radical Accountability</h3>
            <p className="mt-3 text-sm leading-6 text-obligon-text">Small teams own real outcomes, from station onboarding to sub-second settlement velocity.</p>
            <div className="mt-8 overflow-hidden rounded-xl">
              <Image src={assets.fuelvistaCard} width={512} height={341} alt="FuelVista dashboard card" className="w-full" />
            </div>
          </article>
          <article className="rounded-2xl bg-obligon-navy p-8 text-white lg:col-span-3 shadow-hero">
            <Users className="text-obligon-lime" size={28} />
            <h3 className="mt-8 font-display text-2xl font-bold">Unified Logistics</h3>
            <p className="mt-3 text-sm leading-6 text-[#b8c4ff]">
              Our work spans energy retail, automated financing, compliance, and field operations across a connected national network.
            </p>
          </article>
          <article className="rounded-2xl border border-obligon-border bg-[#e6eeff] p-8 lg:col-span-2 shadow-sm">
            <Wifi className="text-obligon-green" size={28} />
            <h3 className="mt-6 font-display text-2xl font-bold text-obligon-navy">Remote-First Flexibility</h3>
            <p className="mt-3 text-sm leading-5 text-obligon-text">Autonomy that empowers you to do your highest impact work from anywhere.</p>
          </article>
          <article className="rounded-2xl border border-obligon-border bg-white p-8 lg:col-span-4 shadow-card">
            <div className="grid gap-8 md:grid-cols-[1fr_260px] md:items-center">
              <div>
                <HeartPulse className="text-obligon-green" size={28} />
                <h3 className="mt-6 font-display text-2xl font-bold text-obligon-navy">Health &amp; Wellness First</h3>
                <p className="mt-3 text-base leading-6 text-obligon-text">Comprehensive private HMO insurance, annual mental health stipends, and continuous learning budgets.</p>
              </div>
              <div className="grid h-32 place-items-center rounded-xl border border-dashed border-obligon-green bg-obligon-mist text-center text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">
                Wellness Stipend Included
              </div>
            </div>
          </article>
        </div>
      </section>

      <section id="open-roles" className="mx-auto max-w-[1280px] px-5 pb-20 sm:px-8 lg:px-16 lg:pb-32">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-4xl font-extrabold text-obligon-navy">Open Positions</h2>
            <p className="mt-3 text-sm text-obligon-text">Join us at our Lagos HQ or work remotely from across Nigeria.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  selectedCategory === cat ? "bg-obligon-navy text-white" : "bg-white text-obligon-text border border-obligon-border hover:bg-obligon-mist"
                }`}
                type="button"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {filteredRoles.map((role) => (
            <article
              key={role.title}
              onClick={() => setActiveRole(role)}
              className="relative overflow-hidden rounded-2xl border border-obligon-border bg-white p-6 shadow-card hover:border-obligon-green hover:shadow-hero transition cursor-pointer"
            >
              {role.urgent ? <span className="absolute right-[-34px] top-5 rotate-45 bg-obligon-green px-10 py-1 text-[10px] font-extrabold uppercase tracking-[1px] text-white">Urgent</span> : null}
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-lg bg-obligon-lime/30 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[1px] text-[#131f00]">{role.badge}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-obligon-text font-medium">
                      <MapPin size={13} />
                      {role.location}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-2xl font-bold text-obligon-navy">{role.title}</h3>
                  <p className="mt-2 text-sm leading-5 text-obligon-text">{role.body}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl bg-obligon-green px-5 py-2.5 text-xs font-bold text-white shadow-green hover:bg-obligon-green/90 transition shrink-0"
                >
                  Apply Now
                  <ArrowRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Application Modal */}
      {activeRole ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#07162f]/65 px-5 backdrop-blur-sm" onMouseDown={handleCloseModal}>
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-2xl bg-white p-6 sm:p-8 shadow-hero"
          >
            <div className="flex items-center justify-between border-b border-obligon-border pb-4">
              <div>
                <span className="rounded-lg bg-obligon-lime/30 px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#131f00]">
                  {activeRole.badge}
                </span>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-obligon-navy">{activeRole.title}</h2>
              </div>
              <button onClick={handleCloseModal} className="grid size-9 place-items-center rounded-lg bg-obligon-mist text-obligon-navy">
                <X size={20} />
              </button>
            </div>

            {submitted ? (
              <div className="p-8 text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
                  <Check size={32} />
                </span>
                <h2 className="mt-5 font-display text-3xl font-extrabold text-obligon-navy">Application Received!</h2>
                <p className="mt-2 text-sm text-obligon-text">
                  Thank you, <strong>{applicantName}</strong>. Our recruiting team has received your application for <strong>{activeRole.title}</strong> and will follow up via {applicantEmail}.
                </p>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="mt-7 h-12 w-full rounded-xl bg-obligon-green font-extrabold text-white shadow-green"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleApply} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-xs font-extrabold uppercase text-obligon-text">Full Name</span>
                  <input
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    className="mt-1.5 h-12 w-full rounded-xl border border-obligon-border px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                    placeholder="Adaora Okafor"
                    required
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Email Address</span>
                    <input
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      type="email"
                      className="mt-1.5 h-12 w-full rounded-xl border border-obligon-border px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      placeholder="adaora@gmail.com"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Phone Number</span>
                    <input
                      value={applicantPhone}
                      onChange={(e) => setApplicantPhone(e.target.value)}
                      className="mt-1.5 h-12 w-full rounded-xl border border-obligon-border px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      placeholder="+234 801 234 5678"
                      required
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-extrabold uppercase text-obligon-text">Cover Note &amp; Relevant Experience</span>
                  <textarea
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-obligon-border p-3.5 text-sm font-medium outline-none focus:border-obligon-green"
                    placeholder="Tell us about your background, notable projects, or why you'd like to join Obligon..."
                  />
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="sr-only"
                  onChange={(e) => setResumeName(e.target.files?.[0]?.name ?? "")}
                />
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-obligon-border bg-obligon-mist p-4 text-xs font-bold text-obligon-text hover:border-obligon-green hover:text-obligon-green transition"
                  >
                    <Upload size={16} />
                    {resumeName ? `Attached: ${resumeName}` : "Attach Resume / CV (PDF, DOCX up to 10MB)"}
                  </button>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-obligon-border">
                  <button type="button" onClick={handleCloseModal} className="h-12 px-6 rounded-xl border border-obligon-navy text-sm font-extrabold">
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className="h-12 px-8 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green flex items-center gap-2"
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : "Submit Application"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      <SiteFooter active="careers" />
    </main>
  );
}
