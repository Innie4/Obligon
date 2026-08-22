"use client";

import * as React from "react";
import { Check, Grid2X2, ReceiptText, ShieldCheck, UserRoundCheck, X } from "lucide-react";
import { ActionFeedback, type ActionState } from "@/components/shared/Dialogs";

export type AdminModalType = "permissions" | "fleet" | "resolve" | "action" | null;

type AdminModalsProps = {
  modal: AdminModalType;
  onClose: () => void;
};

function ModalShell({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#050816]/78 px-5 backdrop-blur-sm" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} className="max-h-[92vh] w-full max-w-[896px] overflow-hidden rounded-lg bg-white shadow-hero outline-none">
        {children}
      </section>
    </div>
  );
}

export function AdminModals({ modal, onClose }: AdminModalsProps) {
  if (!modal) return null;
  if (modal === "permissions") return <EditStaffPermissionsModal onClose={onClose} />;
  if (modal === "fleet") return <ProvisionFleetModal onClose={onClose} />;
  if (modal === "resolve") return <ResolveDisputeModal onClose={onClose} />;
  return <FrontendActionModal onClose={onClose} />;
}

function FrontendActionModal({ onClose }: { onClose: () => void }) {
  const [note, setNote] = React.useState("");
  const [state, setState] = React.useState<ActionState>("idle");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("loading");
    window.setTimeout(() => setState("success"), 400);
  }

  return (
    <ModalShell onClose={onClose} label="Complete admin action">
      <form onSubmit={submit} className="p-8">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-extrabold uppercase tracking-[1px] text-obligon-green">Admin workflow</p><h2 className="mt-2 font-display text-3xl font-extrabold">Complete Frontend Action</h2></div>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg text-obligon-text focus:outline-none focus:ring-2 focus:ring-obligon-green" aria-label="Close admin action"><X size={22} /></button>
        </div>
        <p className="mt-4 max-w-xl text-sm leading-6 text-obligon-text">This control now provides a complete frontend-only flow. Add optional context, review the action, and receive clear completion feedback. A server-side integration is required before this action can persist or send data.</p>
        <label className="mt-7 block"><span className="text-[11px] font-extrabold uppercase text-obligon-text">Reference note (optional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-32 w-full rounded-lg border border-[#c8ccdb] p-4 text-sm outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20" placeholder="Add operational context…" /></label>
        <ActionFeedback state={state} loadingMessage="Completing this frontend-only action…" successMessage="Completed for this session. No server-side data was changed." />
        <div className="mt-8 flex justify-end gap-4">
          {state === "success" ? <button type="button" onClick={onClose} className="h-11 rounded-lg bg-obligon-green px-7 text-sm font-extrabold text-white">Close</button> : <><button type="button" onClick={onClose} className="h-11 rounded-lg border border-[#050816] px-7 text-sm font-extrabold">Cancel</button><button disabled={state === "loading"} type="submit" className="h-11 rounded-lg bg-obligon-green px-7 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60">{state === "loading" ? "Working…" : "Complete Action"}</button></>}
        </div>
      </form>
    </ModalShell>
  );
}

function EditStaffPermissionsModal({ onClose }: { onClose: () => void }) {
  const rows = [["Dashboard", Grid2X2, "write"], ["Billing", ReceiptText, "none"], ["Approvals", UserRoundCheck, "full"], ["Admin", ShieldCheck, "none"]] as const;
  const columns = ["NONE", "READ", "WRITE", "FULL"] as const;
  const [permissions, setPermissions] = React.useState<Record<string, string>>(() => Object.fromEntries(rows.map(([label, , selected]) => [label, selected])));
  const [notify, setNotify] = React.useState(true);
  const [reason, setReason] = React.useState("");
  const [state, setState] = React.useState<ActionState>("idle");
  const [error, setError] = React.useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 8) { setError("Provide a short reason for the permission change before updating access."); setState("error"); return; }
    setError(""); setState("loading"); window.setTimeout(() => setState("success"), 450);
  }

  return (
    <ModalShell onClose={onClose} label="Edit staff permissions">
      <form onSubmit={submit}>
        <div className="border-b border-[#eef1fb] px-6 py-7"><div className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-full border-2 border-obligon-lime bg-[#e9efff] text-sm font-extrabold text-obligon-blue">FA</span><div><h2 className="font-display text-[26px] font-extrabold">Folake Adenuga</h2><p className="text-xs font-extrabold uppercase tracking-[0.4px] text-obligon-text">SENIOR OPERATIONS ASSOCIATE • ID: OBL-042</p></div><button className="ml-auto grid size-9 place-items-center rounded-lg text-obligon-text focus:outline-none focus:ring-2 focus:ring-obligon-green" onClick={onClose} type="button" aria-label="Close permissions modal"><X size={22} /></button></div></div>
        <div className="max-h-[calc(92vh-160px)] overflow-y-auto bg-[#f7f7fd] px-6 py-8"><h3 className="font-display text-xl font-extrabold text-obligon-blue">Edit Staff Permissions</h3><p className="mt-1 text-sm text-obligon-text">Define module-specific access levels for this staff member across the Obligon ecosystem.</p>
          <div className="mt-7 overflow-hidden rounded-lg border border-[#c8ccdb] bg-white"><div className="grid grid-cols-5 bg-[#061958] text-sm font-semibold text-white"><div className="px-4 py-4">MODULE</div>{columns.map((column) => <div key={column} className="border-l border-white/10 px-4 py-4 text-center">{column}</div>)}</div>{rows.map(([label, Icon]) => <div key={label} className="grid grid-cols-5 border-t border-[#eef1fb]"><div className="flex items-center gap-3 px-4 py-4 text-sm font-extrabold"><Icon size={18} className="text-[#8090dc]" />{label}</div>{columns.map((column) => { const value = column.toLowerCase(); const active = permissions[label] === value; return <label key={column} className="grid cursor-pointer place-items-center border-l border-[#eef1fb]"><input className="sr-only" type="radio" name={label} checked={active} onChange={() => setPermissions((current) => ({ ...current, [label]: value }))} /><span className={`size-5 rounded-full border ${active ? "border-obligon-green bg-obligon-green ring-4 ring-white" : "border-[#7d8293] bg-white"}`} /></label>; })}</div>)}</div>
          <label className="mt-8 block"><span className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-blue">Reason for change</span><textarea value={reason} onChange={(event) => { setReason(event.target.value); setError(""); if (state === "error") setState("idle"); }} aria-invalid={Boolean(error)} className="mt-3 min-h-28 w-full rounded-lg border border-[#c8ccdb] bg-white p-4 text-sm outline-none focus:border-obligon-green" placeholder="E.g., promotion to team lead or a change in responsibilities…" /></label>
          <label className="mt-6 flex items-center gap-3 text-sm text-obligon-text"><button type="button" onClick={() => setNotify((value) => !value)} className={`flex h-6 w-11 items-center rounded-full p-0.5 ${notify ? "justify-end bg-obligon-green" : "justify-start bg-[#cfd3e1]"}`} aria-pressed={notify} aria-label="Toggle email notification"><span className="size-5 rounded-full bg-white" /></button>Notify Folake Adenuga of these changes via email</label>
          <ActionFeedback state={state} loadingMessage="Updating permissions…" successMessage="Permissions were updated for this frontend session. A server integration is required to persist access changes." errorMessage={error} />
        </div>
        <div className="flex justify-end gap-4 bg-[#eef3ff] px-6 py-6">{state === "success" ? <button type="button" onClick={onClose} className="h-11 rounded-lg bg-obligon-green px-8 text-sm font-extrabold text-white">Close</button> : <><button type="button" onClick={onClose} className="h-11 rounded-lg border border-[#050816] px-8 text-sm font-extrabold">Cancel</button><button disabled={state === "loading"} type="submit" className="h-11 rounded-lg bg-obligon-green px-8 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60">{state === "loading" ? "Updating…" : "Update Permissions"}</button></>}</div>
      </form>
    </ModalShell>
  );
}

function ProvisionFleetModal({ onClose }: { onClose: () => void }) {
  const [tier, setTier] = React.useState("Enterprise");
  const [companyName, setCompanyName] = React.useState("");
  const [contactVisible, setContactVisible] = React.useState(true);
  const [contactName, setContactName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<ActionState>("idle");
  const [error, setError] = React.useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!companyName.trim() || !contactName.trim() || !/^\S+@\S+\.\S+$/.test(email)) { setError("Enter the company name, billing contact, and a valid email address before provisioning the fleet."); setState("error"); return; }
    setError(""); setState("loading"); window.setTimeout(() => setState("success"), 500);
  }

  return (
    <ModalShell onClose={onClose} label="Provision new fleet"><form onSubmit={submit} className="max-h-[92vh] overflow-y-auto bg-[#f7f7fd] p-8"><div className="flex items-start justify-between gap-4"><div><p className="font-display text-2xl font-extrabold">Obligon<br />Admin</p><p className="mt-1 text-[10px] font-extrabold uppercase text-obligon-text">INTERNAL VIEW</p></div><button className="grid size-9 place-items-center rounded-lg text-obligon-text focus:outline-none focus:ring-2 focus:ring-obligon-green" onClick={onClose} type="button" aria-label="Close fleet modal"><X size={22} /></button></div><h2 className="mt-8 font-display text-3xl font-extrabold">Provision New Fleet</h2><p className="mt-2 text-sm text-obligon-text">Onboard a new enterprise logistics partner to the Obligon network.</p>
      <div className="mt-8 space-y-8"><section className="rounded-lg border border-[#c8ccdb] bg-white p-5"><p className="text-xs font-extrabold text-obligon-green">01</p><h3 className="mt-1 text-sm font-extrabold uppercase tracking-[1px]">Company Identity</h3><div className="mt-5 grid gap-4 md:grid-cols-2"><label><span className="text-[11px] font-extrabold uppercase text-obligon-text">Company Name</span><input value={companyName} onChange={(event) => { setCompanyName(event.target.value); setError(""); }} className="mt-2 h-11 w-full rounded-lg border border-[#c8ccdb] px-4 text-sm outline-none" placeholder="e.g. Dangote Logistics" /></label><label><span className="text-[11px] font-extrabold uppercase text-obligon-text">Fleet ID (System Generated)</span><input readOnly className="mt-2 h-11 w-full rounded-lg border border-[#c8ccdb] bg-[#eef3ff] px-4 text-sm font-extrabold outline-none" value="OB-FLT-2024-X99" /></label></div></section>
        <section><p className="text-xs font-extrabold text-obligon-green">02</p><h3 className="mt-1 text-sm font-extrabold uppercase tracking-[1px]">Service Level</h3><div className="mt-4 grid gap-4 md:grid-cols-3">{[["Enterprise", "Unlimited fueling points & advanced analytics.", "MAX TIER"], ["Pro", "Up to 50 fueling stations nationwide.", "MID TIER"], ["Basic", "Regional fueling access for small fleets.", "ENTRY TIER"]].map(([name, copy, label]) => <button key={name} type="button" onClick={() => setTier(name)} aria-pressed={tier === name} className={`rounded-lg border p-5 text-left ${tier === name ? "border-obligon-green bg-[#f3ffe6]" : "border-[#c8ccdb] bg-white"}`}><p className="font-display text-xl font-extrabold">{name}</p><p className="mt-2 min-h-12 text-sm leading-5 text-obligon-text">{copy}</p><p className="mt-4 text-[10px] font-extrabold uppercase text-obligon-green">{label}</p></button>)}</div></section>
        <section className="grid gap-4 md:grid-cols-2"><label><span className="text-[11px] font-extrabold uppercase text-obligon-text">Initial Credit Limit</span><div className="mt-2 flex h-12 rounded-lg border border-[#c8ccdb] bg-white"><span className="grid w-12 place-items-center font-extrabold">₦</span><input className="w-full bg-transparent pr-4 font-display text-xl font-extrabold outline-none" defaultValue="5,000,000" /></div><p className="mt-2 text-xs text-obligon-text">Limits can be adjusted via the Risk Management panel after provisioning.</p></label><div><span className="text-[11px] font-extrabold uppercase text-obligon-text">Billing Contact</span><button type="button" onClick={() => setContactVisible((visible) => !visible)} className="mt-2 h-12 w-full rounded-lg border border-dashed border-obligon-green bg-white text-xs font-extrabold text-obligon-green">{contactVisible ? "HIDE CONTACT" : "ADD CONTACT"}</button></div>{contactVisible ? <><label><span className="text-[11px] font-extrabold uppercase text-obligon-text">Full Name</span><input value={contactName} onChange={(event) => { setContactName(event.target.value); setError(""); }} className="mt-2 h-11 w-full rounded-lg border border-[#c8ccdb] px-4 outline-none" /></label><label><span className="text-[11px] font-extrabold uppercase text-obligon-text">Email Address</span><input value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} className="mt-2 h-11 w-full rounded-lg border border-[#c8ccdb] px-4 outline-none" type="email" /></label></> : null}</section>
      </div>
      <ActionFeedback state={state} loadingMessage="Provisioning the fleet…" successMessage={`The ${tier} fleet setup is complete for this frontend session. A backend service is required before the fleet is created.`} errorMessage={error} />
      <div className="mt-8 flex justify-end gap-4">{state === "success" ? <button type="button" onClick={onClose} className="h-11 rounded-lg bg-obligon-green px-7 text-sm font-extrabold text-white">Close</button> : <><button type="button" onClick={onClose} className="h-11 rounded-lg border border-[#050816] px-7 text-sm font-extrabold">Cancel</button><button disabled={state === "loading"} type="submit" className="h-11 rounded-lg bg-obligon-green px-7 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60">{state === "loading" ? "Provisioning…" : "Provision Fleet"}</button></>}</div>
    </form></ModalShell>
  );
}

function ResolveDisputeModal({ onClose }: { onClose: () => void }) {
  const [resolution, setResolution] = React.useState("Refund to Partner");
  const [notes, setNotes] = React.useState("");
  const [state, setState] = React.useState<ActionState>("idle");
  const [draftSaved, setDraftSaved] = React.useState(false);
  const [error, setError] = React.useState("");

  function saveDraft() { setDraftSaved(true); setError(""); }
  function submit(event: React.FormEvent) { event.preventDefault(); if (notes.trim().length < 12) { setError("Add investigation notes before finalizing a dispute resolution."); setState("error"); return; } setError(""); setState("loading"); window.setTimeout(() => setState("success"), 450); }

  return (
    <ModalShell onClose={onClose} label="Resolve dispute"><form onSubmit={submit} className="max-h-[92vh] overflow-y-auto bg-[#f7f7fd] p-8"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase text-obligon-text">Dispute Management</p><h2 className="mt-2 font-display text-3xl font-extrabold">Resolve Dispute</h2></div><button className="grid size-9 place-items-center rounded-lg text-obligon-text focus:outline-none focus:ring-2 focus:ring-obligon-green" onClick={onClose} type="button" aria-label="Close dispute modal"><X size={22} /></button></div><div className="mt-6 flex flex-wrap items-center gap-3"><span className="rounded-lg bg-[#061958] px-3 py-1.5 text-xs font-extrabold text-white">#DS-90214</span><span className="font-extrabold">Incorrect Fueling Charge</span><span className="rounded-full bg-[#ffecef] px-3 py-1 text-[10px] font-extrabold text-[#c1121f]">URGENT</span></div>
      <section className="mt-6 rounded-lg border border-[#c8ccdb] bg-white p-5"><p className="text-[11px] font-extrabold uppercase tracking-[1px] text-obligon-text">Dispute Summary</p><div className="mt-5 grid gap-4 md:grid-cols-4">{[["Merchant", "TotalEnergies - VI Branch"], ["Fleet ID", "LG-294-LOG"], ["Disputed Amount", "₦142,500.00"], ["Status", "IN REVIEW"]].map(([label, value]) => <div key={label}><p className="text-[10px] font-extrabold uppercase text-obligon-text">{label}</p><p className="mt-1 text-sm font-extrabold">{value}</p></div>)}</div></section>
      <section className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]"><label><span className="text-[11px] font-extrabold uppercase text-obligon-text">Internal Investigation Notes</span><textarea value={notes} onChange={(event) => { setNotes(event.target.value); setError(""); }} className="mt-2 min-h-44 w-full rounded-lg border border-[#c8ccdb] bg-white p-4 text-sm outline-none" placeholder="Enter detailed findings from the investigation…" /><p className="mt-2 text-right text-[10px] font-extrabold text-obligon-text">CHARS: {notes.length}/1000</p></label><aside className="space-y-4"><div className="rounded-lg border border-[#c8ccdb] bg-white p-4"><p className="text-[10px] font-extrabold uppercase text-obligon-text">Evidence Attachment</p><p className="mt-2 text-sm font-extrabold">fuel_receipt_DS90214.jpg</p></div><div className="rounded-lg bg-[#061958] p-4 text-white"><Check className="text-obligon-lime" size={18} /><p className="mt-3 text-xs font-bold">Verified by Operation-Lead Node 4</p></div></aside></section>
      <section className="mt-6"><p className="text-[11px] font-extrabold uppercase text-obligon-text">Resolution Action</p><div className="mt-3 grid gap-3 md:grid-cols-3">{[["Refund to Partner", "Reverse the charge and credit the fleet account."], ["Deny Claim", "The charge is valid. Close dispute without refund."], ["Escalated to Manager", "Requires higher-level audit approval."]].map(([label, copy]) => <button key={label} type="button" onClick={() => setResolution(label)} aria-pressed={resolution === label} className={`rounded-lg border p-4 text-left ${resolution === label ? "border-obligon-green bg-[#f3ffe6]" : "border-[#c8ccdb] bg-white"}`}><p className="font-extrabold">{label}</p><p className="mt-2 text-xs leading-5 text-obligon-text">{copy}</p></button>)}</div></section>
      {draftSaved ? <p className="mt-5 rounded-lg bg-[#eaf7db] px-4 py-3 text-sm font-bold text-[#315d00]" role="status">Draft saved for this frontend session.</p> : null}<ActionFeedback state={state} loadingMessage="Finalizing the resolution…" successMessage={`${resolution} is recorded for this frontend session. A backend service is required to update the dispute.`} errorMessage={error} />
      <div className="mt-8 flex justify-between gap-4">{draftSaved ? <span className="rounded-full bg-[#eaf7db] px-3 py-1 text-xs font-extrabold text-obligon-green">Draft Saved</span> : <span className="text-xs font-bold text-obligon-text">Save your work before finalizing.</span>}<div className="flex gap-3">{state === "success" ? <button type="button" onClick={onClose} className="h-11 rounded-lg bg-obligon-green px-7 text-sm font-extrabold text-white">Close</button> : <><button type="button" onClick={saveDraft} className="h-11 rounded-lg border border-[#050816] px-7 text-sm font-extrabold">Save Draft</button><button disabled={state === "loading"} type="submit" className="h-11 rounded-lg bg-obligon-green px-7 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60">{state === "loading" ? "Finalizing…" : "Finalize Resolution"}</button></>}</div></div>
    </form></ModalShell>
  );
}
