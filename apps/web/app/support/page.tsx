"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, MapPin, Phone, Send, Loader2, Check, Upload, ArrowRight } from "lucide-react";
import { PageIntro } from "@/components/site/PageIntro";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";

export default function SupportPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requestType, setRequestType] = useState("Enterprise Fleet Onboarding");
  const [message, setMessage] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketRef, setTicketRef] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toastError("Please complete all required fields.");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    const ref = `REQ-${Math.floor(10000 + Math.random() * 89999)}`;
    setTicketRef(ref);
    setSubmitting(false);
    toastSuccess(`Support request ${ref} submitted successfully.`);
  }

  return (
    <main className="min-h-screen bg-obligon-mist text-obligon-navy">
      <SiteHeader />
      <section className="mx-auto grid max-w-[1280px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_480px] lg:px-16 lg:py-24">
        <div>
          <PageIntro
            eyebrow="Direct Enterprise Support"
            title="Contact Obligon LTD"
            body="Reach our team for enterprise fleet onboarding, partner fuel station verification, API integration, or 24/7 technical dispatch."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Mail, label: "Official Email", value: "support@obligon.energy" },
              { icon: Phone, label: "Hotline", value: "+234 800 OBLIGON" },
              { icon: MapPin, label: "Lagos Hub", value: "14 Marina Rd, Lagos Island" }
            ].map((item) => (
              <article key={item.label} className="rounded-2xl border border-obligon-border bg-white p-6 shadow-card">
                <item.icon className="text-obligon-green" size={24} />
                <p className="mt-4 text-xs font-extrabold uppercase tracking-[1.2px] text-obligon-text">{item.label}</p>
                <p className="mt-1 text-sm font-extrabold text-obligon-navy">{item.value}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-2xl bg-obligon-navy p-8 text-white shadow-hero">
            <h3 className="font-display text-2xl font-extrabold">24/7 Priority Hotline for Active Fleets</h3>
            <p className="mt-2 text-sm text-[#b8c4ff] leading-6">
              If your driver is stuck at a pump or experiencing a fuel card decline, call our emergency operations desk directly.
            </p>
            <p className="mt-4 font-mono font-extrabold text-2xl text-obligon-lime">+234 800 625 4466</p>
          </div>
        </div>

        {ticketRef ? (
          <div className="rounded-2xl border border-obligon-border bg-white p-8 shadow-hero text-center flex flex-col justify-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
              <Check size={32} />
            </span>
            <h2 className="mt-5 font-display text-3xl font-extrabold text-obligon-navy">Request Submitted</h2>
            <p className="mt-2 text-sm text-obligon-text">
              Reference: <strong className="font-mono font-extrabold text-obligon-navy text-base">{ticketRef}</strong>
            </p>
            <p className="mt-3 text-xs text-obligon-text leading-5">
              Thank you, <strong>{name}</strong>. An Obligon representative will review your inquiry and reach out at <strong>{email}</strong> within 2 hours.
            </p>
            <button
              type="button"
              onClick={() => {
                setTicketRef(null);
                setName("");
                setEmail("");
                setPhone("");
                setMessage("");
                setAttachmentName("");
              }}
              className="mt-7 h-12 w-full rounded-xl bg-obligon-green font-extrabold text-white shadow-green"
            >
              Send Another Request
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-obligon-border bg-white p-6 sm:p-8 shadow-card space-y-4">
            <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Send an Inquiry</h2>
            <p className="text-xs text-obligon-text">Fill in the details below and we will get back to you promptly.</p>

            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                Full Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adaora Emeka"
                className="h-12 w-full rounded-xl border border-obligon-border bg-white px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                  Work Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="adaora@company.ng"
                  className="h-12 w-full rounded-xl border border-obligon-border bg-white px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                  Phone (Optional)
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 801 234 5678"
                  className="h-12 w-full rounded-xl border border-obligon-border bg-white px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                Inquiry Category
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="h-12 w-full rounded-xl border border-obligon-border bg-white px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
              >
                <option>Enterprise Fleet Onboarding</option>
                <option>Partner Fuel Station Integration</option>
                <option>Driver App &amp; Fuelvista Card Issue</option>
                <option>Billing &amp; Settlement Reconciliation</option>
                <option>NDPR / Privacy &amp; Legal Request</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-[1.1px] text-obligon-text block mb-1">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Describe your fleet size, question, or specific requirement..."
                className="w-full rounded-xl border border-obligon-border bg-white p-4 text-sm font-medium text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                required
              />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              className="sr-only"
              onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? "")}
            />
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-obligon-border bg-obligon-mist p-3 text-xs font-bold text-obligon-text hover:border-obligon-green hover:text-obligon-green transition"
              >
                <Upload size={15} />
                {attachmentName ? `Attached: ${attachmentName}` : "Attach document or specification (Optional)"}
              </button>
            </div>

            <button
              disabled={submitting}
              type="submit"
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-obligon-green text-base font-extrabold text-white shadow-green hover:bg-obligon-green/90 transition disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Sending Request...
                </>
              ) : (
                <>
                  Submit Request
                  <Send size={16} />
                </>
              )}
            </button>
          </form>
        )}
      </section>
      <SiteFooter active="support" />
    </main>
  );
}
