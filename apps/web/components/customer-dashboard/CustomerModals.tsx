"use client";

import * as React from "react";
import type { ComponentType } from "react";
import { Building2, CreditCard, Upload, X, type LucideProps } from "lucide-react";

export type CustomerModalType = "topup" | "report" | null;

type CustomerModalsProps = {
  modal: CustomerModalType;
  onClose: () => void;
};

function ModalFrame({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[#20251f]/55 px-0 backdrop-blur-sm sm:place-items-center sm:px-5">
      <section className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-hero sm:max-w-[560px] sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-[#e0e7de] px-6 py-5">
          <p className="font-display text-xl font-extrabold">Obligon</p>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg bg-[#f1f5f0]" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function CustomerModals({ modal, onClose }: CustomerModalsProps) {
  if (!modal) return null;
  return modal === "topup" ? <TopUpModal onClose={onClose} /> : <ReportProblemModal onClose={onClose} />;
}

function TopUpModal({ onClose }: { onClose: () => void }) {
  const [method, setMethod] = React.useState("Main Operating Acct");
  const paymentMethods: Array<{ title: string; body: string; Icon: ComponentType<LucideProps> }> = [
    { title: "Main Operating Acct", body: "Acct ending in ****4921", Icon: Building2 },
    { title: "Corporate Card", body: "Visa ending in ****1184", Icon: CreditCard }
  ];

  return (
    <ModalFrame onClose={onClose}>
      <div className="p-6">
        <span className="rounded-full bg-[#e8fbd7] px-3 py-1 text-[10px] font-extrabold uppercase text-obligon-green">Secure Transaction</span>
        <h2 className="mt-4 font-display text-3xl font-extrabold">Top Up Balance</h2>
        <p className="mt-2 text-sm text-obligon-text">Add funds to your Obligon account instantly.</p>

        <label className="mt-7 block">
          <span className="text-xs font-extrabold uppercase text-obligon-text">Amount</span>
          <div className="mt-2 flex h-14 rounded-lg border border-[#cfd8cc] bg-[#f7fbf8]">
            <span className="grid w-14 place-items-center font-extrabold">₦</span>
            <input className="w-full bg-transparent pr-4 font-display text-2xl font-extrabold outline-none" defaultValue="5,000.00" />
          </div>
        </label>

        <div className="mt-7">
          <p className="text-xs font-extrabold uppercase text-obligon-text">Payment Method</p>
          {paymentMethods.map(({ title, body, Icon }) => (
            <button
              key={title as string}
              type="button"
              onClick={() => setMethod(title as string)}
              className={`mt-3 flex w-full items-center gap-4 rounded-lg border p-4 text-left ${
                method === title ? "border-obligon-green bg-[#f3ffe8]" : "border-[#cfd8cc] bg-white"
              }`}
            >
              <span className="grid size-10 place-items-center rounded-full bg-[#eef3ff] text-obligon-blue">
                <Icon size={18} />
              </span>
              <span>
                <span className="block font-extrabold">{title}</span>
                <span className="text-sm text-obligon-text">{body}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-7 flex items-center justify-between rounded-lg bg-[#f7fbf8] p-4 text-sm">
          <span className="font-bold text-obligon-text">Processing Fee</span>
          <span className="font-extrabold">₦0.00</span>
        </div>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">Cancel</button>
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white">Confirm Top Up</button>
        </div>
      </div>
    </ModalFrame>
  );
}

function ReportProblemModal({ onClose }: { onClose: () => void }) {
  const [issue, setIssue] = React.useState("Incorrect Amount");

  return (
    <ModalFrame onClose={onClose}>
      <div className="p-6">
        <h2 className="font-display text-3xl font-extrabold">Report a Problem</h2>
        <p className="mt-2 text-sm leading-6 text-obligon-text">
          Please provide details about the issue you encountered. This helps our technical team investigate and resolve it promptly.
        </p>

        <div className="mt-7">
          <p className="text-xs font-extrabold uppercase text-obligon-text">Issue Type</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {["Incorrect Amount", "Station Not Found", "Fuel Quality Issue", "Other Issue"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setIssue(item)}
                className={`rounded-lg border px-4 py-3 text-left text-sm font-extrabold ${
                  issue === item ? "border-obligon-green bg-[#f3ffe8] text-obligon-green" : "border-[#cfd8cc] bg-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-6 block">
          <span className="text-xs font-extrabold uppercase text-obligon-text">Transaction ID (Optional)</span>
          <input className="mt-2 h-12 w-full rounded-lg border border-[#cfd8cc] px-4 outline-none" placeholder="e.g. TXN-84729" />
        </label>
        <label className="mt-5 block">
          <span className="text-xs font-extrabold uppercase text-obligon-text">Additional Details</span>
          <textarea className="mt-2 min-h-32 w-full rounded-lg border border-[#cfd8cc] p-4 outline-none" placeholder="Describe the problem in detail. If applicable, mention the date, time, and location." />
        </label>
        <button type="button" className="mt-5 flex w-full items-center justify-center gap-3 rounded-lg border border-dashed border-[#cfd8cc] bg-[#f7fbf8] p-6 text-sm font-extrabold text-obligon-text">
          <Upload size={18} />
          Drag and drop an image or browse
        </button>
        <p className="mt-2 text-xs text-obligon-text">PNG, JPG, PDF up to 5MB</p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">Cancel</button>
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white">Submit Report</button>
        </div>
      </div>
    </ModalFrame>
  );
}
