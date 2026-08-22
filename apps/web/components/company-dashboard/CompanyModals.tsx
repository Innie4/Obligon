"use client";

import * as React from "react";
import { AlertTriangle, Car, CheckCircle2, CreditCard, Download, Loader2, UserPlus, Wrench, X } from "lucide-react";
import type { CompanyModalKey } from "./company-data";

type CompanyModalsProps = {
  modal: CompanyModalKey;
  onClose: () => void;
};

const modalCopy: Record<Exclude<CompanyModalKey, null>, {
  title: string;
  description: string;
  primary: string;
  icon: React.ReactNode;
  fields?: string[];
  warning?: string;
}> = {
  vehicle: { title: "Add Vehicle", description: "Enter details for the new fleet asset.", primary: "Save Vehicle", icon: <Car size={22} />, fields: ["Make", "Model", "Plate Number", "Assign Fuel Card"] },
  service: { title: "Schedule Maintenance", description: "Create a service booking and assign optional technicians.", primary: "Schedule Service", icon: <Wrench size={22} />, fields: ["Vehicle", "Service Type", "Scheduled Date", "Priority", "Assign To (Optional)"] },
  assign: { title: "Assign Assets", description: "Assign a vehicle and Fuelvista card to a driver.", primary: "Confirm Assignment", icon: <UserPlus size={22} />, fields: ["Driver Details", "Select Vehicle", "Select Fuelvista Card"] },
  roadside: { title: "Request Roadside Assistance", description: "Submit an immediate support request for your vehicle.", primary: "Dispatch Assistance", icon: <AlertTriangle size={22} />, fields: ["Unit #4092 - Freightliner Cascadia", "Precise Location", "Direction of Travel", "Primary Issue Category", "Detailed Description"] },
  newCard: { title: "Issue New Card", description: "Create a virtual Fuelvista card to instantly assign to a driver or vehicle.", primary: "Issue Card", icon: <CreditCard size={22} />, fields: ["Assign To", "Select Driver", "Initial Spend Limit"] },
  cardConfirm: { title: "Freeze Card", description: "You are about to freeze this physical fuel card. This action will immediately decline any new transactions attempted with this card.", primary: "Confirm Freeze", icon: <CreditCard size={22} />, warning: "Impact: drivers cannot use this card for new fuel purchases while it is frozen." },
  driver: { title: "Add New Driver", description: "Enter the details for the new operator. Ensure the license information matches the physical documentation for compliance verification.", primary: "Save Driver", icon: <UserPlus size={22} />, fields: ["Full Name", "Employee ID", "Phone Number", "License Type", "License Expiry"] },
  teamMember: { title: "Add Team Member", description: "Invite a new colleague to your organization.", primary: "Send Invite", icon: <UserPlus size={22} />, fields: ["Email Address", "Assign Role"] },
  supportTicket: { title: "Raise Support Ticket", description: "Provide ticket details and optional attachments for enterprise support.", primary: "Submit Ticket", icon: <AlertTriangle size={22} />, fields: ["Issue Category", "Related Asset (Optional)", "Subject", "Description", "Attachments (Optional)"] },
  export: { title: "Export Transactions", description: "Select parameters for your data download.", primary: "Prepare Export", icon: <Download size={22} />, fields: ["Date Range", "File Format", "Filter By (Optional)"] },
  action: { title: "Complete Dashboard Action", description: "Review the request and add an optional note before completing the frontend-only workflow.", primary: "Complete Action", icon: <CheckCircle2 size={22} />, fields: ["Reference Note (Optional)"] }
};

function isOptional(field: string) {
  return field.toLowerCase().includes("optional");
}

export function CompanyModals({ modal, onClose }: CompanyModalsProps) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [state, setState] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (modal) {
      setValues({});
      setState("idle");
      setError("");
    }
  }, [modal]);

  if (!modal) return null;
  const copy = modalCopy[modal];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const missing = copy.fields?.find((field) => !isOptional(field) && !values[field]?.trim());
    if (missing) {
      setError(`Enter ${missing.toLowerCase()} before continuing.`);
      setState("error");
      return;
    }
    setError("");
    setState("loading");
    window.setTimeout(() => setState("success"), 450);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#07162f]/60 px-5 backdrop-blur-sm" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label={copy.title} onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} tabIndex={-1} className="max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-lg bg-white shadow-hero outline-none">
        <div className="flex items-start justify-between border-b border-[#e1e6ee] p-6">
          <div className="flex gap-4"><span className="grid size-11 place-items-center rounded-lg bg-[#e8fbd7] text-obligon-green">{copy.icon}</span><div><h2 className="font-display text-2xl font-extrabold">{copy.title}</h2><p className="mt-1 text-sm leading-6 text-obligon-text">{copy.description}</p></div></div>
          <button type="button" className="grid size-9 place-items-center rounded-lg bg-[#f3f6fa] focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2" onClick={onClose} aria-label="Close company modal"><X size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="space-y-5 p-6">
            {copy.warning ? <p className="rounded-lg bg-[#fff3d8] p-4 text-sm font-bold text-[#9a6300]">{copy.warning}</p> : null}
            {copy.fields?.map((field) => (
              <label key={field} className="block"><span className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">{field}</span>{field.toLowerCase().includes("description") || field.toLowerCase().includes("notes") ? <textarea value={values[field] ?? ""} onChange={(event) => { setValues((current) => ({ ...current, [field]: event.target.value })); setError(""); if (state === "error") setState("idle"); }} className="mt-2 min-h-28 w-full rounded-lg border border-[#dfe5ec] p-4 text-sm outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20" placeholder={`Enter ${field.toLowerCase()}…`} /> : <input value={values[field] ?? ""} onChange={(event) => { setValues((current) => ({ ...current, [field]: event.target.value })); setError(""); if (state === "error") setState("idle"); }} className="mt-2 h-12 w-full rounded-lg border border-[#dfe5ec] px-4 text-sm outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20" placeholder={field.includes("Date") ? "mm / dd / yyyy" : `Enter ${field.toLowerCase()}…`} />}</label>
            ))}
            {modal === "newCard" ? <div className="rounded-lg bg-[#07162f] p-5 text-white"><p className="font-display text-xl font-extrabold">Fuelvista</p><p className="mt-4 font-mono text-lg tracking-[3px]">•••• •••• •••• ••••</p><p className="mt-3 text-xs text-white/60">VALID THRU 12/28 • ASSIGNED Unassigned</p></div> : null}
            {state === "loading" ? <p className="flex items-center gap-2 rounded-lg bg-[#e8efff] px-4 py-3 text-sm font-bold text-obligon-blue" role="status"><Loader2 size={16} className="animate-spin" />Completing this frontend-only action…</p> : null}
            {state === "error" ? <p className="rounded-lg bg-[#ffe8e8] px-4 py-3 text-sm font-bold text-[#c1121f]" role="alert">{error}</p> : null}
            {state === "success" ? <p className="flex items-center gap-2 rounded-lg bg-[#e8fbd7] px-4 py-3 text-sm font-bold text-obligon-green" role="status"><CheckCircle2 size={16} />Completed for this session. A backend service is required for permanent processing.</p> : null}
            <p className="text-xs leading-5 text-obligon-text">This dashboard is frontend-only. The flow is complete in the current session but does not claim that a server-side record, dispatch, payment, invitation, or export has been completed.</p>
          </div>
          <div className="flex justify-end gap-3 border-t border-[#e1e6ee] bg-[#f3f6fa] p-6">{state === "success" ? <button type="button" className="h-11 rounded-lg bg-obligon-green px-6 text-sm font-extrabold text-white" onClick={onClose}>Close</button> : <><button type="button" className="h-11 rounded-lg border border-[#07162f] px-6 text-sm font-extrabold" onClick={onClose}>Cancel</button><button disabled={state === "loading"} type="submit" className="h-11 rounded-lg bg-obligon-green px-6 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60">{state === "loading" ? "Working…" : copy.primary}</button></>}</div>
        </form>
      </section>
    </div>
  );
}
