"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, MapPin, Phone, Send, Loader2, Check, Upload, ArrowRight } from "lucide-react";
import { PageIntro } from "@/components/site/PageIntro";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";
import { publicApi } from "@/lib/services";

export default function SupportPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requestType, setRequestType] = useState("Enterprise Fleet Onboarding");
  React.useEffect(()=>{const request=new URLSearchParams(window.location.search).get("request");if(request){setRequestType("Sales / Product Enquiry");setMessage(`I would like to discuss ${request === "sales" ? "a custom requirement" : request}.`);}},[]);
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
    try {
      const result = await publicApi.submitContact({ name, email, subject: requestType, message, phone }, fileInputRef.current?.files?.[0]);
      setTicketRef(result.reference);
      setSubmitting(false);
      toastSuccess("Support request submitted successfully.");
    } catch (err) {
      setSubmitting(false);
      toastError(err instanceof Error ? err.message : "Could not submit the request. Please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-obligon-mist text-obligon-navy">
      <SiteHeader />
      <section className="mx-auto grid max-w-[1280px] gap-x-10 gap-y-6 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_480px] lg:grid-rows-[auto_1fr] lg:items-start lg:px-16 lg:py-24">
        <div className="lg:col-start-1 lg:row-start-1">
          <PageIntro
            eyebrow="Direct Enterprise Support"
            title="Contact Obligon LTD"
            body="Reach our team for enterprise fleet onboarding, partner fuel station verification, API integration, or technical support."
          />

        </div>

        {ticketRef ? (
          <div className="rounded-2xl border border-obligon-border bg-white p-8 shadow-hero text-center flex flex-col justify-center lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
              <Check size={32} />
            </span>
            <h2 className="mt-5 font-display text-3xl font-extrabold text-obligon-navy">Request Submitted</h2>
            <p className="mt-2 text-sm text-obligon-text">
              Reference: <strong className="tabular-nums font-extrabold text-obligon-navy text-base">{ticketRef}</strong>
            </p>
            <p className="mt-3 text-xs text-obligon-text leading-5">
              Thank you, <strong>{name}</strong>. An Obligon representative will review your inquiry and reach out at <strong>{email}</strong> by email.
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
              className="mt-7 h-12 w-full rounded-xl bg-obligon-green font-extrabold text-white "
            >
              Send Another Request
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-obligon-border bg-white p-6 sm:p-8 space-y-4 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Send an Inquiry</h2>
            <p className="text-xs text-obligon-text">Fill in the details below and we will get back to you promptly.</p>

            <div>
              <label htmlFor="contact-name" className="text-sm font-semibold text-obligon-text block mb-1">
Full Name
</label>
              <input
                id="contact-name" value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adaora Emeka"
                className="h-12 w-full rounded-xl border border-obligon-border bg-white px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-email" className="text-sm font-semibold text-obligon-text block mb-1">
Email Address
</label>
                <input
                  id="contact-email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="adaora@company.ng"
                  className="h-12 w-full rounded-xl border border-obligon-border bg-white px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                  required
                />
              </div>
              <div>
                <label htmlFor="contact-phone" className="text-sm font-semibold text-obligon-text block mb-1">
Phone (Optional)
</label>
                <input
                  id="contact-phone" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 801 234 5678"
                  className="h-12 w-full rounded-xl border border-obligon-border bg-white px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-requestType" className="text-sm font-semibold text-obligon-text block mb-1">
                Inquiry Category
              </label>
              <select
                id="contact-requestType" value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="h-12 w-full rounded-xl border border-obligon-border bg-white px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
              >
                <option>Enterprise Fleet Onboarding</option><option>Sales / Product Enquiry</option>
                <option>Partner Fuel Station Integration</option>
                <option>Driver App &amp; Fuelvista Card Issue</option>
                <option>Billing &amp; Settlement Reconciliation</option>
                <option>NDPR / Privacy &amp; Legal Request</option>
              </select>
            </div>

            <div>
              <label htmlFor="contact-message" className="text-sm font-semibold text-obligon-text block mb-1">
Message
</label>
              <textarea
                id="contact-message" value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Describe your question, issue, or service requirements..."
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
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-obligon-green text-base font-extrabold text-white  hover:bg-obligon-green/90 transition disabled:opacity-60"
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
        <div className="lg:col-start-1 lg:row-start-2">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Mail, label: "Official Email", value: "support@obligon.energy" },
              { icon: Phone, label: "Contact", value: "Contact us using this form" },
              { icon: MapPin, label: "Service enquiries", value: "Confirm coverage with our team" }
            ].map((item) => (
              <article key={item.label} className="rounded-2xl border border-obligon-border bg-white p-6 ">
                <item.icon className="text-obligon-green" size={24} />
                <p className="mt-4 text-sm font-semibold text-obligon-text">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-obligon-navy">{item.value}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-obligon-navy p-8 text-white shadow-hero">
            <h3 className="font-display text-2xl font-extrabold">Account and transaction support</h3>
            <p className="mt-2 text-sm text-[#b8c4ff] leading-6">
              For fuel card declines or payment issues, include the transaction reference in your inquiry. Signed-in customers can follow replies in Support.
            </p>
            <p className="mt-4 tabular-nums font-extrabold text-2xl text-obligon-lime">Keep your request reference for follow-up</p>
          </div>
        </div>
      </section>
      <SiteFooter active="support" />
    </main>
  );
}
