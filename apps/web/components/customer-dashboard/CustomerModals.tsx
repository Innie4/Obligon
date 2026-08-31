"use client";

import * as React from "react";
import type { ComponentType } from "react";
import { AlertTriangle, Building2, Check, CreditCard, FileWarning, Fingerprint, LockKeyhole, ShieldCheck, Snowflake, Upload, X, Loader2, ArrowRight, type LucideProps } from "lucide-react";
import { useToast } from "@/components/shared/Toast";

export type CustomerModalType = "topup" | "report" | "changePin" | "biometrics" | "replaceCard" | "lostCard" | "freezeCard" | null;

type CustomerModalsProps = {
  modal: CustomerModalType;
  onClose: () => void;
  biometrics: boolean;
  onBiometricsChange: (enabled: boolean) => void;
  cardFrozen: boolean;
  onCardFrozenChange: (frozen: boolean) => void;
  cardBlocked: boolean;
  onCardBlockedChange: (blocked: boolean) => void;
  onTopUpSuccess?: (amount: number) => void;
};

export function ModalFrame({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[#20251f]/55 px-0 backdrop-blur-sm sm:place-items-center sm:px-5">
      <section className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-hero sm:max-w-[560px] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[#e0e7de] px-6 py-5">
          <p className="font-display text-xl font-extrabold text-obligon-navy">Obligon LTD</p>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg bg-[#f1f5f0] text-obligon-navy hover:bg-[#e2eae0] transition" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function CustomerModals({
  modal,
  onClose,
  biometrics,
  onBiometricsChange,
  cardFrozen,
  onCardFrozenChange,
  cardBlocked,
  onCardBlockedChange,
  onTopUpSuccess
}: CustomerModalsProps) {
  if (!modal) return null;
  if (modal === "topup") return <TopUpModal onClose={onClose} onSuccess={onTopUpSuccess} />;
  if (modal === "report") return <ReportProblemModal onClose={onClose} />;
  if (modal === "changePin") return <ChangePinModal onClose={onClose} />;
  if (modal === "biometrics") return <BiometricsModal onClose={onClose} enabled={biometrics} onChange={onBiometricsChange} />;
  if (modal === "replaceCard") return <ReplaceCardModal onClose={onClose} blocked={cardBlocked} />;
  if (modal === "lostCard")
    return (
      <LostCardModal
        onClose={onClose}
        blocked={cardBlocked}
        onBlockedChange={(blocked) => {
          onCardBlockedChange(blocked);
          if (blocked) onCardFrozenChange(false);
        }}
      />
    );
  return (
    <FreezeCardModal
      onClose={onClose}
      frozen={cardFrozen}
      onChange={(frozen) => {
        onCardFrozenChange(frozen);
        if (frozen) onCardBlockedChange(false);
      }}
    />
  );
}

function PinInput({
  label,
  value,
  onChange,
  placeholder,
  autoFocus = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="mt-5 block">
      <span className="text-xs font-extrabold uppercase text-obligon-text">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder={placeholder}
        className="mt-2 h-14 w-full rounded-lg border border-[#cfd8cc] bg-[#f7fbf8] text-center font-mono text-2xl tracking-[10px] outline-none focus:border-obligon-green"
      />
    </label>
  );
}

function ChangePinModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = React.useState<"form" | "success">("form");
  const [currentPin, setCurrentPin] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { success: toastSuccess } = useToast();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!/^\d{4}$/.test(currentPin)) {
      setError("Enter your current 4-digit PIN.");
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setError("Your new PIN must be exactly 4 digits.");
      return;
    }
    if (newPin === currentPin) {
      setError("Your new PIN must be different from your current PIN.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("New PIN and confirmation do not match.");
      return;
    }

    setError("");
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setStep("success");
    toastSuccess("Transaction PIN changed successfully.");
  }

  return (
    <ModalFrame onClose={onClose}>
      {step === "form" ? (
        <form onSubmit={handleSubmit} className="p-6">
          <span className="grid size-12 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <LockKeyhole size={22} />
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-obligon-navy">Change Transaction PIN</h2>
          <p className="mt-2 text-sm text-obligon-text">
            Update the 4-digit authorization PIN used to approve POS station payments.
          </p>

          <PinInput label="Current PIN" value={currentPin} onChange={setCurrentPin} placeholder="••••" autoFocus />
          <PinInput label="New 4-Digit PIN" value={newPin} onChange={setNewPin} placeholder="••••" />
          <PinInput label="Confirm New PIN" value={confirmPin} onChange={setConfirmPin} placeholder="••••" />

          {error ? <p className="mt-4 rounded-lg bg-[#ffe8e8] p-3 text-sm font-bold text-[#c1121f]">{error}</p> : null}

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold text-obligon-navy">
              Cancel
            </button>
            <button disabled={submitting} type="submit" className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white flex items-center justify-center gap-2">
              {submitting ? <Loader2 size={18} className="animate-spin" /> : "Update PIN"}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Check size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">PIN Updated Successfully</h2>
          <p className="mt-2 text-sm text-obligon-text">
            Your transaction access code has been securely updated. Use your new PIN for future station payments.
          </p>
          <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white">
            Done
          </button>
        </div>
      )}
    </ModalFrame>
  );
}

function BiometricsModal({
  onClose,
  enabled,
  onChange
}: {
  onClose: () => void;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const [step, setStep] = React.useState<"intro" | "scanning" | "success" | "disable">(enabled ? "disable" : "intro");
  const { success: toastSuccess } = useToast();

  React.useEffect(() => {
    if (step !== "scanning") return;
    const timer = setTimeout(() => {
      onChange(true);
      setStep("success");
      toastSuccess("Biometric authentication enabled.");
    }, 1200);
    return () => clearTimeout(timer);
  }, [step, onChange, toastSuccess]);

  return (
    <ModalFrame onClose={onClose}>
      {step === "intro" ? (
        <div className="p-6 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#eef3ff] text-obligon-blue">
            <Fingerprint size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">Enable Biometrics</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-obligon-text">
            Use FaceID or Fingerprint to unlock your fleet dashboard and approve transactions instantly without typing your PIN each time.
          </p>
          <ul className="mx-auto mt-6 max-w-sm space-y-3 text-left">
            {["Biometric data never leaves your secure device enclave", "Fallback to PIN is always available", "Can be revoked anytime from security settings"].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm font-bold text-obligon-navy">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
                  <Check size={12} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold text-obligon-navy">
              Not Now
            </button>
            <button
              type="button"
              onClick={() => setStep("scanning")}
              className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white"
            >
              Scan &amp; Register
            </button>
          </div>
        </div>
      ) : null}

      {step === "scanning" ? (
        <div className="p-6 py-12 text-center">
          <span className="mx-auto grid size-24 animate-pulse place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Fingerprint size={48} />
          </span>
          <h2 className="mt-6 font-display text-2xl font-extrabold text-obligon-navy">Authenticating Sensor...</h2>
          <p className="mt-2 text-sm text-obligon-text">Touch your fingerprint reader or face the camera to verify.</p>
        </div>
      ) : null}

      {step === "success" ? (
        <div className="p-6 py-12 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <ShieldCheck size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">Biometrics Activated</h2>
          <p className="mt-2 text-sm text-obligon-text">FaceID and Fingerprint authorization are now active on this device.</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-7 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white"
          >
            Done
          </button>
        </div>
      ) : null}

      {step === "disable" ? (
        <div className="p-6 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#fff3d8] text-[#9a6300]">
            <Fingerprint size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">Disable Biometrics?</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-obligon-text">
            You will need your 4-digit transaction PIN to authorize payments and access sensitive settings.
          </p>
          <div className="mt-7 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold text-obligon-navy">
              Keep Enabled
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(false);
                toastSuccess("Biometric authentication disabled.");
                onClose();
              }}
              className="h-12 flex-1 rounded-lg bg-[#c1121f] font-extrabold text-white"
            >
              Disable
            </button>
          </div>
        </div>
      ) : null}
    </ModalFrame>
  );
}

function TopUpModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: (amount: number) => void }) {
  const [method, setMethod] = React.useState("Direct Bank Transfer");
  const [amount, setAmount] = React.useState("25000");
  const [submitting, setSubmitting] = React.useState(false);
  const [successData, setSuccessData] = React.useState<{ reference: string; amount: number; method: string } | null>(null);
  const { error: toastError, success: toastSuccess } = useToast();

  const quickAmounts = [5000, 10000, 25000, 50000, 100000];

  const paymentMethods = [
    { title: "Direct Bank Transfer", body: "Instant funding via dedicated virtual NUBAN", Icon: Building2 },
    { title: "Corporate Debit / Fuel Card", body: "Mastercard / Visa ending in •••• 4092", Icon: CreditCard },
    { title: "USSD / Quick Bank Code", body: "*737# or *894# direct checkout", Icon: ArrowRight },
  ];

  const numericAmount = Number(amount.replace(/[^0-9.]/g, ""));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!Number.isFinite(numericAmount) || numericAmount < 1000) {
      toastError("Please enter a valid top-up amount of at least ₦1,000.");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    const ref = `TOPUP-${Math.floor(100000 + Math.random() * 899999)}`;
    setSuccessData({ reference: ref, amount: numericAmount, method });
    setSubmitting(false);
    onSuccess?.(numericAmount);
    toastSuccess(`₦${numericAmount.toLocaleString()} added to your fleet wallet.`);
  }

  return (
    <ModalFrame onClose={onClose}>
      {successData ? (
        <div className="p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Check size={32} />
          </span>
          <h2 className="mt-5 font-display text-3xl font-extrabold text-obligon-navy">Top-Up Successful</h2>
          <p className="mt-2 text-sm text-obligon-text">
            Your wallet balance has been credited with{" "}
            <strong className="text-obligon-green font-extrabold text-base">₦{successData.amount.toLocaleString()}</strong>.
          </p>

          <div className="mt-6 divide-y divide-[#eef3ee] rounded-xl border border-[#dbe2d8] bg-[#f7fbf8] p-4 text-left text-sm">
            <div className="flex justify-between py-2">
              <span className="text-obligon-text font-medium">Reference Code</span>
              <span className="font-mono font-bold text-obligon-navy">{successData.reference}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-obligon-text font-medium">Funding Method</span>
              <span className="font-bold text-obligon-navy">{successData.method}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-obligon-text font-medium">Status</span>
              <span className="font-bold text-obligon-green">COMPLETED</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-8 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white shadow-green"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="p-6 sm:p-8">
          <span className="rounded-full bg-[#e8fbd7] px-3 py-1 text-[10px] font-extrabold uppercase text-obligon-green">
            Instant Wallet Recharge
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-obligon-navy">Top Up Fleet Wallet</h2>
          <p className="mt-1 text-sm text-obligon-text">Select an amount and payment method to instantly fund your account.</p>

          <div className="mt-6">
            <label className="text-xs font-extrabold uppercase text-obligon-text block mb-2">
              Select or Enter Amount (₦)
            </label>
            <div className="flex h-14 rounded-xl border border-[#cfd8cc] bg-[#f7fbf8] focus-within:border-obligon-green focus-within:ring-2 focus-within:ring-obligon-green/20">
              <span className="grid w-14 place-items-center font-display text-2xl font-extrabold text-obligon-navy">₦</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
                placeholder="25,000"
                className="w-full bg-transparent pr-4 font-display text-2xl font-extrabold text-obligon-navy outline-none"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt.toString())}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                    numericAmount === amt
                      ? "border-obligon-green bg-[#e8fbd7] text-obligon-green"
                      : "border-[#cfd8cc] bg-white text-obligon-navy hover:bg-[#f7fbf8]"
                  }`}
                >
                  +₦{amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-extrabold uppercase text-obligon-text mb-2">Funding Method</p>
            <div className="space-y-2.5">
              {paymentMethods.map(({ title, body, Icon }) => {
                const selected = method === title;
                return (
                  <button
                    key={title}
                    type="button"
                    onClick={() => setMethod(title)}
                    className={`flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition ${
                      selected ? "border-obligon-green bg-[#f3ffe8] ring-2 ring-obligon-green/20" : "border-[#cfd8cc] bg-white hover:bg-[#f7fbf8]"
                    }`}
                  >
                    <span className="grid size-10 place-items-center rounded-lg bg-[#eef3ff] text-obligon-blue shrink-0">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold text-obligon-navy">{title}</span>
                      <span className="block text-xs text-obligon-text truncate">{body}</span>
                    </span>
                    {selected ? <Check size={18} className="text-obligon-green shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between rounded-xl bg-[#f7fbf8] p-4 text-sm">
            <span className="font-bold text-obligon-text">Gateway Transaction Fee</span>
            <span className="font-extrabold text-obligon-green">₦0.00 (Zero Fee)</span>
          </div>

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold text-obligon-navy">
              Cancel
            </button>
            <button
              disabled={submitting || !numericAmount || numericAmount < 1000}
              type="submit"
              className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white shadow-green flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ₦${(numericAmount || 0).toLocaleString()}`
              )}
            </button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}

function ReportProblemModal({ onClose }: { onClose: () => void }) {
  const [issue, setIssue] = React.useState("Incorrect Dispensed Amount");
  const [txnId, setTxnId] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [attachmentName, setAttachmentName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [ticketResult, setTicketResult] = React.useState<{ ticketId: string; issue: string } | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const { error: toastError, success: toastSuccess } = useToast();

  const issueTypes = [
    "Incorrect Dispensed Amount",
    "POS Declined but Debited",
    "Fuel Quality / Contamination",
    "Station Closed / Overcharging",
    "Lost / Stolen Fleet Card",
    "Other Inquiries",
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (details.trim().length < 10) {
      toastError("Please provide at least 10 characters explaining the issue.");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    const ticketId = `TKT-${Math.floor(10000 + Math.random() * 89999)}`;
    setTicketResult({ ticketId, issue });
    setSubmitting(false);
    toastSuccess(`Ticket ${ticketId} created. Support team notified.`);
  }

  return (
    <ModalFrame onClose={onClose}>
      {ticketResult ? (
        <div className="p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Check size={32} />
          </span>
          <h2 className="mt-5 font-display text-3xl font-extrabold text-obligon-navy">Ticket Submitted</h2>
          <p className="mt-2 text-sm text-obligon-text">
            Your support request has been logged under reference{" "}
            <strong className="text-obligon-navy font-mono font-extrabold text-base">{ticketResult.ticketId}</strong>.
          </p>
          <p className="mt-2 text-xs text-obligon-text">
            Our 24/7 fleet support dispatch will review your case and update you via email and notification center.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-7 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white shadow-green"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="p-6 sm:p-8">
          <span className="rounded-full bg-[#e8fbd7] px-3 py-1 text-[10px] font-extrabold uppercase text-obligon-green">
            24/7 Dispute &amp; Support
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-obligon-navy">Report an Issue</h2>
          <p className="mt-1 text-sm text-obligon-text">Submit transaction disputes or station issues for immediate review.</p>

          <div className="mt-6">
            <p className="text-xs font-extrabold uppercase text-obligon-text mb-2">Category of Issue</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {issueTypes.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setIssue(item)}
                  className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-bold transition ${
                    issue === item
                      ? "border-obligon-green bg-[#f3ffe8] text-obligon-green ring-2 ring-obligon-green/20"
                      : "border-[#cfd8cc] bg-white text-obligon-navy hover:bg-[#f7fbf8]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-extrabold uppercase text-obligon-text">Transaction ID / Reference (Optional)</span>
            <input
              value={txnId}
              onChange={(e) => setTxnId(e.target.value)}
              className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 text-sm font-medium outline-none focus:border-obligon-green"
              placeholder="e.g. TXN-84729"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-extrabold uppercase text-obligon-text">Detailed Description</span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-[#cfd8cc] p-3.5 text-sm outline-none focus:border-obligon-green"
              placeholder="Describe the problem, including the pump number, amount discrepancy, or station location..."
              required
            />
          </label>

          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? "")}
          />
          <div className="mt-4">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#cfd8cc] bg-[#f7fbf8] p-4 text-xs font-bold text-obligon-text hover:border-obligon-green hover:text-obligon-green transition"
            >
              <Upload size={16} />
              {attachmentName ? `Attached: ${attachmentName}` : "Attach Receipt / Station Photo (PNG, JPG, PDF up to 10MB)"}
            </button>
            {attachmentName ? (
              <button
                type="button"
                onClick={() => setAttachmentName("")}
                className="mt-1 text-[11px] font-bold text-[#c1121f] hover:underline"
              >
                Remove attachment
              </button>
            ) : null}
          </div>

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold text-obligon-navy">
              Cancel
            </button>
            <button
              disabled={submitting || details.trim().length < 10}
              type="submit"
              className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white shadow-green flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Ticket"
              )}
            </button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}

function ReplaceCardModal({ onClose, blocked }: { onClose: () => void; blocked: boolean }) {
  const [step, setStep] = React.useState<"form" | "success">("form");
  const [reason, setReason] = React.useState("Damaged Chip");
  const [address, setAddress] = React.useState("Obligon LTD Enterprise Fleet, 14 Marina Road, Lagos");
  const [phone, setPhone] = React.useState("+234 801 234 5678");
  const [reference, setReference] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { success: toastSuccess } = useToast();

  const reasons = ["Damaged Chip / Wear", "Card Expiring Soon", "Stolen / Lost", "Fleet Upgrade to NFC"];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address.trim() || !phone.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    const ref = `RC-${Math.floor(100000 + Math.random() * 899999)}`;
    setReference(ref);
    setSubmitting(false);
    setStep("success");
    toastSuccess(`Replacement card order ${ref} placed.`);
  }

  return (
    <ModalFrame onClose={onClose}>
      {step === "form" ? (
        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <CreditCard size={22} />
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-obligon-navy">Order Replacement Card</h2>
          <p className="mt-2 text-sm text-obligon-text">
            {blocked ? "Your previous card is blocked. " : ""}Request a new Fuelvista card shipped directly to your fleet address.
          </p>

          <p className="mt-6 text-xs font-extrabold uppercase text-obligon-text mb-2">Reason for Replacement</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {reasons.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setReason(item)}
                className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-bold transition ${
                  reason === item
                    ? "border-obligon-green bg-[#f3ffe8] text-obligon-green ring-2 ring-obligon-green/20"
                    : "border-[#cfd8cc] bg-white text-obligon-navy"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-extrabold uppercase text-obligon-text">Delivery Address</span>
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-xl border border-[#cfd8cc] p-3 text-sm font-medium outline-none focus:border-obligon-green"
              required
            />
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-extrabold uppercase text-obligon-text">Recipient Contact Phone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd8cc] px-4 text-sm font-medium outline-none focus:border-obligon-green"
              required
            />
          </label>

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold text-obligon-navy">
              Cancel
            </button>
            <button
              disabled={submitting}
              type="submit"
              className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white shadow-green flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : "Confirm Order"}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Check size={32} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">Replacement Dispatched</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-obligon-text">
            Your replacement Fuelvista card will arrive in 2-3 business days. Tracking Order: <span className="font-mono font-extrabold text-obligon-navy">{reference}</span>.
          </p>
          <div className="mx-auto mt-6 max-w-sm space-y-2 text-left">
            <div className="flex items-center gap-3 rounded-lg bg-[#f7fbf8] p-3 text-xs font-bold text-obligon-navy">
              <span className="text-obligon-green font-black">✓</span> Card embossed and encoded
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#f7fbf8] p-3 text-xs font-bold text-obligon-navy">
              <span className="text-obligon-green font-black">✓</span> Courier handoff in progress
            </div>
          </div>
          <button type="button" onClick={onClose} className="mt-7 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white shadow-green">
            Done
          </button>
        </div>
      )}
    </ModalFrame>
  );
}

function LostCardModal({
  onClose,
  blocked,
  onBlockedChange
}: {
  onClose: () => void;
  blocked: boolean;
  onBlockedChange: (blocked: boolean) => void;
}) {
  const [step, setStep] = React.useState<"confirm" | "success">("confirm");
  const [reference, setReference] = React.useState("");
  const [reason, setReason] = React.useState("Physical theft");
  const { error: toastError, success: toastSuccess } = useToast();

  function handleBlock() {
    const ref = `BL-${Math.floor(100000 + Math.random() * 899999)}`;
    setReference(ref);
    onBlockedChange(true);
    setStep("success");
    toastSuccess("Card permanently blocked. All future authorizations will be declined.");
  }

  return (
    <ModalFrame onClose={onClose}>
      {step === "confirm" ? (
        <div className="p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-full bg-[#ffe8e8] text-[#c1121f]">
            <FileWarning size={22} />
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-[#c1121f]">Block Card Permanently</h2>
          <p className="mt-2 text-sm leading-6 text-obligon-text">
            This action will immediately stop all authorizations and permanently deactivate this card across all network stations.
          </p>

          <div className="mt-5">
            <p className="text-xs font-extrabold uppercase text-obligon-text mb-2">Report Reason</p>
            <div className="grid gap-2">
              {["Physical theft / stolen card", "Lost card in transit", "Suspicious / fraudulent transaction"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setReason(opt)}
                  className={`rounded-xl border p-3 text-left text-xs font-bold transition ${
                    reason === opt ? "border-[#c1121f] bg-[#ffecef] text-[#c1121f]" : "border-[#cfd8cc] bg-white text-obligon-navy"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-[#fff5f5] border border-[#fecaca] p-4 text-xs text-[#93000a] leading-5">
            <strong>Warning:</strong> Once blocked, this physical card cannot be unblocked. You will need to order a replacement card.
          </div>

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold text-obligon-navy">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBlock}
              className="h-12 flex-1 rounded-lg bg-[#c1121f] font-extrabold text-white"
            >
              Confirm Block
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#ffe8e8] text-[#c1121f]">
            <Check size={32} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold text-[#c1121f]">Card Blocked</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-obligon-text">
            The card has been blocked permanently. Fraud reference: <span className="font-mono font-extrabold text-obligon-navy">{reference}</span>.
          </p>
          <button type="button" onClick={onClose} className="mt-7 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white shadow-green">
            Done
          </button>
        </div>
      )}
    </ModalFrame>
  );
}

function FreezeCardModal({
  onClose,
  frozen,
  onChange
}: {
  onClose: () => void;
  frozen: boolean;
  onChange: (frozen: boolean) => void;
}) {
  const { success: toastSuccess } = useToast();

  function handleToggle() {
    const next = !frozen;
    onChange(next);
    toastSuccess(next ? "Card temporarily frozen." : "Card unfrozen and active.");
    onClose();
  }

  return (
    <ModalFrame onClose={onClose}>
      <div className="p-6 sm:p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#eef3ff] text-obligon-blue">
          <Snowflake size={32} />
        </span>
        <h2 className="mt-5 font-display text-3xl font-extrabold text-obligon-navy">
          {frozen ? "Unfreeze Fuelvista Card" : "Freeze Fuelvista Card"}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-obligon-text">
          {frozen
            ? "Unfreezing will restore immediate purchasing ability across all authorized stations."
            : "Freezing temporarily pauses all transactions. You can unfreeze anytime without losing your balance or settings."}
        </p>

        <div className="mt-8 flex gap-3">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold text-obligon-navy">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleToggle}
            className={`h-12 flex-1 rounded-lg font-extrabold text-white ${
              frozen ? "bg-obligon-green shadow-green" : "bg-[#bc5b00]"
            }`}
          >
            {frozen ? "Unfreeze Card" : "Freeze Card"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
