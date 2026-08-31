"use client";

import * as React from "react";
import { Check, Grid2X2, ReceiptText, ShieldCheck, UserRoundCheck, X, Loader2, Building2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/shared/Toast";

export type AdminModalType = "permissions" | "fleet" | "resolve" | "partnerReview" | "addStaff" | "action" | null;

type AdminModalsProps = {
  modal: AdminModalType;
  onClose: () => void;
  onFleetProvisioned?: (fleet: { name: string; tier: string; credit: string }) => void;
  onDisputeResolved?: (dispute: { id: string; resolution: string }) => void;
};

function ModalShell({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#050816]/78 px-5 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
        className="max-h-[92vh] w-full max-w-[896px] overflow-hidden rounded-2xl bg-white shadow-hero outline-none"
      >
        {children}
      </section>
    </div>
  );
}

export function AdminModals({ modal, onClose, onFleetProvisioned, onDisputeResolved }: AdminModalsProps) {
  if (!modal) return null;
  if (modal === "permissions") return <EditStaffPermissionsModal onClose={onClose} />;
  if (modal === "fleet") return <ProvisionFleetModal onClose={onClose} onSuccess={onFleetProvisioned} />;
  if (modal === "resolve") return <ResolveDisputeModal onClose={onClose} onSuccess={onDisputeResolved} />;
  if (modal === "partnerReview") return <PartnerReviewModal onClose={onClose} />;
  return <AddStaffModal onClose={onClose} />;
}

function EditStaffPermissionsModal({ onClose }: { onClose: () => void }) {
  const { success: toastSuccess } = useToast();
  const rows = [["Dashboard", Grid2X2, "write"], ["Billing", ReceiptText, "none"], ["Approvals", UserRoundCheck, "full"], ["Admin Oversight", ShieldCheck, "write"]] as const;
  const columns = ["NONE", "READ", "WRITE", "FULL"] as const;
  const [permissions, setPermissions] = React.useState<Record<string, string>>(() => Object.fromEntries(rows.map(([label, , selected]) => [label, selected])));
  const [notify, setNotify] = React.useState(true);
  const [reason, setReason] = React.useState("Promoted to Senior Fleet Operations Coordinator");
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setSuccess(true);
    toastSuccess("Staff permissions updated successfully.");
  }

  return (
    <ModalShell onClose={onClose} label="Edit staff permissions">
      {success ? (
        <div className="p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Check size={32} />
          </span>
          <h2 className="mt-5 font-display text-3xl font-extrabold text-obligon-navy">Permissions Updated</h2>
          <p className="mt-2 text-sm text-obligon-text">
            Access levels for Folake Adenuga (ID: OBL-042) have been applied across all clusters.
          </p>
          <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-xl bg-obligon-green font-extrabold text-white">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="border-b border-[#eef1fb] px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-full border-2 border-obligon-lime bg-[#e9efff] text-sm font-extrabold text-obligon-blue">FA</span>
              <div>
                <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Folake Adenuga</h2>
                <p className="text-xs font-extrabold uppercase tracking-[0.4px] text-obligon-text">SENIOR OPERATIONS ASSOCIATE • ID: OBL-042</p>
              </div>
            </div>
            <button className="grid size-9 place-items-center rounded-lg bg-[#f3f6fa] text-obligon-text" onClick={onClose} type="button">
              <X size={20} />
            </button>
          </div>

          <div className="max-h-[calc(92vh-170px)] overflow-y-auto bg-[#f7f7fd] px-6 py-6 space-y-6">
            <div>
              <h3 className="font-display text-lg font-extrabold text-obligon-navy">Module Access Matrix</h3>
              <p className="text-xs text-obligon-text">Define granular read/write/full permissions per module.</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#c8ccdb] bg-white">
              <div className="grid grid-cols-5 bg-[#061958] text-xs font-extrabold text-white">
                <div className="px-4 py-3">MODULE</div>
                {columns.map((col) => (
                  <div key={col} className="border-l border-white/10 px-3 py-3 text-center">{col}</div>
                ))}
              </div>
              {rows.map(([label, Icon]) => (
                <div key={label} className="grid grid-cols-5 border-t border-[#eef1fb]">
                  <div className="flex items-center gap-2.5 px-4 py-3 text-xs font-extrabold text-obligon-navy">
                    <Icon size={16} className="text-[#8090dc]" />
                    {label}
                  </div>
                  {columns.map((col) => {
                    const value = col.toLowerCase();
                    const active = permissions[label] === value;
                    return (
                      <label key={col} className="grid cursor-pointer place-items-center border-l border-[#eef1fb] py-3">
                        <input
                          type="radio"
                          name={label}
                          checked={active}
                          onChange={() => setPermissions((p) => ({ ...p, [label]: value }))}
                          className="size-4 accent-obligon-green"
                        />
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>

            <label className="block">
              <span className="text-xs font-extrabold uppercase text-obligon-text">Administrative Audit Reason</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-[#c8ccdb] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                required
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 bg-[#eef3ff] px-6 py-4 border-t border-[#d8e0f5]">
            <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl border border-[#050816] text-sm font-extrabold">
              Cancel
            </button>
            <button disabled={submitting} type="submit" className="h-11 px-6 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green flex items-center gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : "Save Permissions"}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

function ProvisionFleetModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: (f: { name: string; tier: string; credit: string }) => void }) {
  const { success: toastSuccess } = useToast();
  const [tier, setTier] = React.useState("Enterprise");
  const [companyName, setCompanyName] = React.useState("Dangote Logistics PLC");
  const [credit, setCredit] = React.useState("25,000,000");
  const [contactName, setContactName] = React.useState("Aliko Dangote Ops Team");
  const [email, setEmail] = React.useState("logistics@dangote-group.com");
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    setSubmitting(false);
    setSuccess(true);
    onSuccess?.({ name: companyName, tier, credit: `₦${credit}` });
    toastSuccess(`Fleet partner ${companyName} provisioned successfully.`);
  }

  return (
    <ModalShell onClose={onClose} label="Provision new fleet">
      {success ? (
        <div className="p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Check size={32} />
          </span>
          <h2 className="mt-5 font-display text-3xl font-extrabold text-obligon-navy">Fleet Provisioned</h2>
          <p className="mt-2 text-sm text-obligon-text">
            <strong>{companyName}</strong> has been onboarded under the <strong>{tier} Tier</strong> with an initial credit ceiling of <strong>₦{credit}</strong>.
          </p>
          <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-xl bg-obligon-green font-extrabold text-white">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[#eef1fb] pb-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[1px] text-obligon-green">Enterprise Onboarding</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-obligon-navy">Provision New Fleet Company</h2>
            </div>
            <button className="grid size-9 place-items-center rounded-lg bg-[#f3f6fa]" onClick={onClose} type="button">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-extrabold uppercase text-obligon-text">Company Name</span>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-[#c8ccdb] px-4 font-bold text-obligon-navy outline-none focus:border-obligon-green" required />
            </label>

            <div>
              <span className="text-xs font-extrabold uppercase text-obligon-text block mb-2">Service Tier</span>
              <div className="grid gap-3 sm:grid-cols-3">
                {["Enterprise", "Pro Fleet", "Standard"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    className={`p-3.5 rounded-xl border text-left font-bold transition ${
                      tier === t ? "border-obligon-green bg-[#e8fbd7] text-obligon-green" : "border-[#c8ccdb] bg-white text-obligon-navy"
                    }`}
                  >
                    <p className="text-sm font-extrabold">{t}</p>
                    <p className="text-[11px] text-obligon-text mt-0.5">{t === "Enterprise" ? "Unlimited cards" : "Up to 50 cards"}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-extrabold uppercase text-obligon-text">Initial Credit Ceiling (₦)</span>
                <input value={credit} onChange={(e) => setCredit(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-[#c8ccdb] px-4 font-bold text-obligon-navy outline-none focus:border-obligon-green" required />
              </label>
              <label className="block">
                <span className="text-xs font-extrabold uppercase text-obligon-text">Primary Administrator Email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1.5 h-12 w-full rounded-xl border border-[#c8ccdb] px-4 font-bold text-obligon-navy outline-none focus:border-obligon-green" required />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#eef1fb]">
            <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl border border-[#050816] text-sm font-extrabold">
              Cancel
            </button>
            <button disabled={submitting} type="submit" className="h-11 px-6 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green flex items-center gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : "Provision Fleet Partner"}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

function ResolveDisputeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: (d: { id: string; resolution: string }) => void }) {
  const { success: toastSuccess } = useToast();
  const [resolution, setResolution] = React.useState("Refund to Fleet Account");
  const [notes, setNotes] = React.useState("Pump meter log confirmed overdispense anomaly on dispenser nozzle 04.");
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setSuccess(true);
    onSuccess?.({ id: "#DS-90214", resolution });
    toastSuccess("Dispute case resolved and settlement updated.");
  }

  return (
    <ModalShell onClose={onClose} label="Resolve dispute">
      {success ? (
        <div className="p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Check size={32} />
          </span>
          <h2 className="mt-5 font-display text-3xl font-extrabold text-obligon-navy">Dispute Finalized</h2>
          <p className="mt-2 text-sm text-obligon-text">
            Case #DS-90214 resolved: <strong>{resolution}</strong>.
          </p>
          <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-xl bg-obligon-green font-extrabold text-white">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between border-b border-[#eef1fb] pb-3">
            <div>
              <span className="rounded-md bg-[#061958] px-2.5 py-1 text-xs font-extrabold text-white">Case #DS-90214</span>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-obligon-navy">Resolve Transaction Dispute</h2>
            </div>
            <button className="grid size-9 place-items-center rounded-lg bg-[#f3f6fa]" onClick={onClose} type="button">
              <X size={20} />
            </button>
          </div>

          <div className="rounded-xl bg-[#f7fbf8] p-4 border border-obligon-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div><p className="text-obligon-text font-bold">MERCHANT</p><p className="font-extrabold text-obligon-navy mt-1">TotalEnergies VI</p></div>
            <div><p className="text-obligon-text font-bold">FLEET ID</p><p className="font-extrabold text-obligon-navy mt-1">LG-294-LOG</p></div>
            <div><p className="text-obligon-text font-bold">CLAIM AMOUNT</p><p className="font-extrabold text-obligon-green mt-1">₦142,500.00</p></div>
            <div><p className="text-obligon-text font-bold">PRIORITY</p><p className="font-extrabold text-[#c1121f] mt-1">HIGH DISPUTE</p></div>
          </div>

          <label className="block">
            <span className="text-xs font-extrabold uppercase text-obligon-text">Investigation Findings</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-[#c8ccdb] p-3 text-sm font-medium outline-none focus:border-obligon-green" required />
          </label>

          <div>
            <span className="text-xs font-extrabold uppercase text-obligon-text block mb-2">Resolution Determination</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {["Refund to Fleet Account", "Deny Claim (Valid Charge)", "Split 50/50 Adjustment"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResolution(r)}
                  className={`p-3 rounded-xl border text-left text-xs font-bold transition ${
                    resolution === r ? "border-obligon-green bg-[#e8fbd7] text-obligon-green" : "border-[#c8ccdb] bg-white text-obligon-navy"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#eef1fb]">
            <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl border border-[#050816] text-sm font-extrabold">
              Cancel
            </button>
            <button disabled={submitting} type="submit" className="h-11 px-6 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green flex items-center gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : "Finalize Resolution"}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

function PartnerReviewModal({ onClose }: { onClose: () => void }) {
  const { success: toastSuccess } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  async function handleAction(approved: boolean) {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    toastSuccess(approved ? "Partner station approved and live in locator." : "Application rejected.");
    onClose();
  }

  return (
    <ModalShell onClose={onClose} label="Review Partner Application">
      <div className="p-6 sm:p-8 space-y-5">
        <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Partner Station Application</h2>
        <div className="rounded-xl bg-[#f7fbf8] p-4 border border-obligon-border space-y-2 text-sm">
          <p><strong>Brand:</strong> Mainland Energy Hub Ikeja</p>
          <p><strong>DPR License:</strong> DPR-NG-2024-884 (Verified)</p>
          <p><strong>Location:</strong> Plot 14 Commercial Ave, Ikeja, Lagos</p>
          <p><strong>Pumps:</strong> 12 Multi-Product Nozzles</p>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-[#eef1fb]">
          <button disabled={submitting} onClick={() => handleAction(false)} className="h-11 px-6 rounded-xl border border-[#c1121f] text-[#c1121f] text-sm font-extrabold">
            Reject
          </button>
          <button disabled={submitting} onClick={() => handleAction(true)} className="h-11 px-6 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green">
            Approve &amp; Activate
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function AddStaffModal({ onClose }: { onClose: () => void }) {
  const { success: toastSuccess } = useToast();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("Operations Officer");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    toastSuccess(`Staff member ${name} added.`);
    onClose();
  }

  return (
    <ModalShell onClose={onClose} label="Add Staff Member">
      <form onSubmit={submit} className="p-6 sm:p-8 space-y-4">
        <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Add Internal Staff</h2>
        <label className="block">
          <span className="text-xs font-extrabold uppercase text-obligon-text">Full Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-[#c8ccdb] px-4 font-bold outline-none focus:border-obligon-green" required />
        </label>
        <label className="block">
          <span className="text-xs font-extrabold uppercase text-obligon-text">Official Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1.5 h-12 w-full rounded-xl border border-[#c8ccdb] px-4 font-bold outline-none focus:border-obligon-green" required />
        </label>
        <div className="flex justify-end gap-3 pt-4 border-t border-[#eef1fb]">
          <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl border text-sm font-extrabold">Cancel</button>
          <button type="submit" className="h-11 px-6 rounded-xl bg-obligon-green text-sm font-extrabold text-white">Save Staff</button>
        </div>
      </form>
    </ModalShell>
  );
}
