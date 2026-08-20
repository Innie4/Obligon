"use client";

import * as React from "react";
import { Check, Grid2X2, ReceiptText, ShieldCheck, UserRoundCheck, X } from "lucide-react";

export type AdminModalType = "permissions" | "fleet" | "resolve" | null;

type AdminModalsProps = {
  modal: AdminModalType;
  onClose: () => void;
};

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#050816]/78 px-5 backdrop-blur-sm">
      <section className="max-h-[92vh] w-full max-w-[896px] overflow-hidden rounded-lg bg-white shadow-hero">
        <button className="absolute right-[calc(50%-432px)] top-[calc(50%-380px)] z-10 hidden size-8 place-items-center rounded-lg text-obligon-text xl:grid" onClick={onClose} type="button" aria-label="Close modal">
          <X size={22} />
        </button>
        {children}
      </section>
    </div>
  );
}

export function AdminModals({ modal, onClose }: AdminModalsProps) {
  if (!modal) return null;

  if (modal === "permissions") return <EditStaffPermissionsModal onClose={onClose} />;
  if (modal === "fleet") return <ProvisionFleetModal onClose={onClose} />;
  return <ResolveDisputeModal onClose={onClose} />;
}

function EditStaffPermissionsModal({ onClose }: { onClose: () => void }) {
  const [notify, setNotify] = React.useState(true);
  const rows = [
    ["Dashboard", Grid2X2, "write"],
    ["Billing", ReceiptText, "none"],
    ["Approvals", UserRoundCheck, "full"],
    ["Admin", ShieldCheck, "none"]
  ] as const;
  const columns = ["NONE", "READ", "WRITE", "FULL"];

  return (
    <ModalShell onClose={onClose}>
      <div className="border-b border-[#eef1fb] px-6 py-7">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-full border-2 border-obligon-lime bg-[#e9efff] text-sm font-extrabold text-obligon-blue">FA</span>
          <div>
            <h2 className="font-display text-[26px] font-extrabold">Folake Adenuga</h2>
            <p className="text-xs font-extrabold uppercase tracking-[0.4px] text-obligon-text">SENIOR OPERATIONS ASSOCIATE • ID: OBL-042</p>
          </div>
          <button className="ml-auto grid size-9 place-items-center rounded-lg text-obligon-text xl:hidden" onClick={onClose} type="button" aria-label="Close permissions modal">
            <X size={22} />
          </button>
        </div>
      </div>
      <div className="max-h-[calc(92vh-82px)] overflow-y-auto bg-[#f7f7fd] px-6 py-8">
        <h3 className="font-display text-xl font-extrabold text-obligon-blue">Edit Staff Permissions</h3>
        <p className="mt-1 text-sm text-obligon-text">Define module-specific access levels for this staff member across the Obligon ecosystem.</p>

        <div className="mt-7 overflow-hidden rounded-lg border border-[#c8ccdb] bg-white">
          <div className="grid grid-cols-5 bg-[#061958] text-sm font-semibold text-white">
            <div className="px-4 py-4">MODULE</div>
            {columns.map((column) => <div key={column} className="border-l border-white/10 px-4 py-4 text-center">{column}</div>)}
          </div>
          {rows.map(([label, Icon, selected]) => (
            <div key={label} className="grid grid-cols-5 border-t border-[#eef1fb]">
              <div className="flex items-center gap-3 px-4 py-4 text-sm font-extrabold">
                <Icon size={18} className="text-[#8090dc]" />
                {label}
              </div>
              {columns.map((column) => {
                const active = column.toLowerCase() === selected;
                return (
                  <label key={column} className="grid place-items-center border-l border-[#eef1fb]">
                    <input className="sr-only" type="radio" name={label} defaultChecked={active} />
                    <span className={`size-5 rounded-full border ${active ? "border-obligon-green bg-obligon-green ring-4 ring-white" : "border-[#7d8293] bg-white"}`} />
                  </label>
                );
              })}
            </div>
          ))}
        </div>

        <label className="mt-8 block">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-blue">Reason for change</span>
          <textarea className="mt-3 min-h-28 w-full rounded-lg border border-[#c8ccdb] bg-white p-4 text-sm outline-none focus:border-obligon-green" placeholder="E.g., Promotion to Team Lead or Change in departmental responsibilities..." />
        </label>

        <label className="mt-6 flex items-center gap-3 text-sm text-obligon-text">
          <button type="button" onClick={() => setNotify((value) => !value)} className={`flex h-6 w-11 items-center rounded-full p-0.5 ${notify ? "justify-end bg-obligon-green" : "justify-start bg-[#cfd3e1]"}`} aria-label="Toggle email notification">
            <span className="size-5 rounded-full bg-white" />
          </button>
          Notify Folake Adenuga of these changes via email
        </label>
      </div>
      <div className="flex justify-end gap-4 bg-[#eef3ff] px-6 py-6">
        <button type="button" onClick={onClose} className="h-11 rounded-lg border border-[#050816] px-8 text-sm font-extrabold">Cancel</button>
        <button type="button" onClick={onClose} className="h-11 rounded-lg bg-obligon-green px-8 text-sm font-extrabold text-white">Update Permissions</button>
      </div>
    </ModalShell>
  );
}

function ProvisionFleetModal({ onClose }: { onClose: () => void }) {
  const [tier, setTier] = React.useState("Enterprise");

  return (
    <ModalShell onClose={onClose}>
      <div className="max-h-[92vh] overflow-y-auto bg-[#f7f7fd] p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-2xl font-extrabold">Obligon<br />Admin</p>
            <p className="mt-1 text-[10px] font-extrabold uppercase text-obligon-text">INTERNAL VIEW</p>
          </div>
          <button className="grid size-9 place-items-center rounded-lg text-obligon-text" onClick={onClose} type="button" aria-label="Close fleet modal">
            <X size={22} />
          </button>
        </div>
        <h2 className="mt-8 font-display text-3xl font-extrabold">Provision New Fleet</h2>
        <p className="mt-2 text-sm text-obligon-text">Onboard a new enterprise logistics partner to the Obligon network.</p>

        <div className="mt-8 space-y-8">
          <section className="rounded-lg border border-[#c8ccdb] bg-white p-5">
            <p className="text-xs font-extrabold text-obligon-green">01</p>
            <h3 className="mt-1 text-sm font-extrabold uppercase tracking-[1px]">Company Identity</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label><span className="text-[11px] font-extrabold uppercase text-obligon-text">Company Name</span><input className="mt-2 h-11 w-full rounded-lg border border-[#c8ccdb] px-4 text-sm outline-none" placeholder="e.g. Dangote Logistics" /></label>
              <label><span className="text-[11px] font-extrabold uppercase text-obligon-text">Fleet ID (System Generated)</span><input className="mt-2 h-11 w-full rounded-lg border border-[#c8ccdb] bg-[#eef3ff] px-4 text-sm font-extrabold outline-none" defaultValue="OB-FLT-2024-X99" /></label>
            </div>
          </section>
          <section>
            <p className="text-xs font-extrabold text-obligon-green">02</p>
            <h3 className="mt-1 text-sm font-extrabold uppercase tracking-[1px]">Service Level</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[
                ["Enterprise", "Unlimited fueling points & advanced analytics.", "MAX TIER"],
                ["Pro", "Up to 50 fueling stations nationwide.", "MID TIER"],
                ["Basic", "Regional fueling access for small fleets.", "ENTRY TIER"]
              ].map(([name, copy, label]) => (
                <button key={name} type="button" onClick={() => setTier(name)} className={`rounded-lg border p-5 text-left ${tier === name ? "border-obligon-green bg-[#f3ffe6]" : "border-[#c8ccdb] bg-white"}`}>
                  <p className="font-display text-xl font-extrabold">{name}</p>
                  <p className="mt-2 min-h-12 text-sm leading-5 text-obligon-text">{copy}</p>
                  <p className="mt-4 text-[10px] font-extrabold uppercase text-obligon-green">{label}</p>
                </button>
              ))}
            </div>
          </section>
          <section className="grid gap-4 md:grid-cols-2">
            <label><span className="text-[11px] font-extrabold uppercase text-obligon-text">Initial Credit Limit</span><div className="mt-2 flex h-12 rounded-lg border border-[#c8ccdb] bg-white"><span className="grid w-12 place-items-center font-extrabold">₦</span><input className="w-full bg-transparent pr-4 font-display text-xl font-extrabold outline-none" defaultValue="5,000,000" /></div><p className="mt-2 text-xs text-obligon-text">Limits can be adjusted via the Risk Management panel after provisioning.</p></label>
            <div><span className="text-[11px] font-extrabold uppercase text-obligon-text">Billing Contact</span><button type="button" className="mt-2 h-12 w-full rounded-lg border border-dashed border-obligon-green bg-white text-xs font-extrabold text-obligon-green">ADD CONTACT</button></div>
            <label><span className="text-[11px] font-extrabold uppercase text-obligon-text">Full Name</span><input className="mt-2 h-11 w-full rounded-lg border border-[#c8ccdb] px-4 outline-none" /></label>
            <label><span className="text-[11px] font-extrabold uppercase text-obligon-text">Email Address</span><input className="mt-2 h-11 w-full rounded-lg border border-[#c8ccdb] px-4 outline-none" type="email" /></label>
          </section>
        </div>
        <div className="mt-8 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-[#050816] px-7 text-sm font-extrabold">CANCEL ACTION</button>
          <button type="button" onClick={onClose} className="h-11 rounded-lg bg-obligon-green px-7 text-sm font-extrabold text-white">Provision Fleet</button>
        </div>
      </div>
    </ModalShell>
  );
}

function ResolveDisputeModal({ onClose }: { onClose: () => void }) {
  const [resolution, setResolution] = React.useState("Refund to Partner");

  return (
    <ModalShell onClose={onClose}>
      <div className="max-h-[92vh] overflow-y-auto bg-[#f7f7fd] p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase text-obligon-text">Dispute Management</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold">Resolve Dispute</h2>
          </div>
          <button className="grid size-9 place-items-center rounded-lg text-obligon-text" onClick={onClose} type="button" aria-label="Close dispute modal">
            <X size={22} />
          </button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-[#061958] px-3 py-1.5 text-xs font-extrabold text-white">#DS-90214</span>
          <span className="font-extrabold">Incorrect Fueling Charge</span>
          <span className="rounded-full bg-[#ffecef] px-3 py-1 text-[10px] font-extrabold text-[#c1121f]">URGENT</span>
        </div>
        <section className="mt-6 rounded-lg border border-[#c8ccdb] bg-white p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[1px] text-obligon-text">Dispute Summary</p>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              ["Merchant", "TotalEnergies - VI Branch"],
              ["Fleet ID", "LG-294-LOG"],
              ["Disputed Amount", "₦142,500.00"],
              ["Status", "IN REVIEW"]
            ].map(([label, value]) => (
              <div key={label}><p className="text-[10px] font-extrabold uppercase text-obligon-text">{label}</p><p className="mt-1 text-sm font-extrabold">{value}</p></div>
            ))}
          </div>
        </section>
        <section className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
          <label><span className="text-[11px] font-extrabold uppercase text-obligon-text">Internal Investigation Notes</span><textarea className="mt-2 min-h-44 w-full rounded-lg border border-[#c8ccdb] bg-white p-4 text-sm outline-none" placeholder="Enter detailed findings from the investigation..." /><p className="mt-2 text-right text-[10px] font-extrabold text-obligon-text">CHARS: 0/1000</p></label>
          <aside className="space-y-4">
            <div className="rounded-lg border border-[#c8ccdb] bg-white p-4"><p className="text-[10px] font-extrabold uppercase text-obligon-text">Evidence Attachment</p><p className="mt-2 text-sm font-extrabold">fuel_receipt_DS90214.jpg</p></div>
            <div className="rounded-lg bg-[#061958] p-4 text-white"><Check className="text-obligon-lime" size={18} /><p className="mt-3 text-xs font-bold">Verified by Operation-Lead Node 4</p></div>
          </aside>
        </section>
        <section className="mt-6">
          <p className="text-[11px] font-extrabold uppercase text-obligon-text">Resolution Action</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {[
              ["Refund to Partner", "Reverse the charge and credit the fleet account."],
              ["Deny Claim", "The charge is valid. Close dispute without refund."],
              ["Escalated to Manager", "Requires higher-level audit approval."]
            ].map(([label, copy]) => (
              <button key={label} type="button" onClick={() => setResolution(label)} className={`rounded-lg border p-4 text-left ${resolution === label ? "border-obligon-green bg-[#f3ffe6]" : "border-[#c8ccdb] bg-white"}`}>
                <p className="font-extrabold">{label}</p>
                <p className="mt-2 text-xs leading-5 text-obligon-text">{copy}</p>
              </button>
            ))}
          </div>
        </section>
        <div className="mt-8 flex justify-between gap-4">
          <span className="rounded-full bg-[#eaf7db] px-3 py-1 text-xs font-extrabold text-obligon-green">Draft Saved</span>
          <div className="flex gap-3">
            <button type="button" className="h-11 rounded-lg border border-[#050816] px-7 text-sm font-extrabold">Save Draft</button>
            <button type="button" onClick={onClose} className="h-11 rounded-lg bg-obligon-green px-7 text-sm font-extrabold text-white">Finalize Resolution</button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

