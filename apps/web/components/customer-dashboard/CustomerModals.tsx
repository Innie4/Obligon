"use client";

import * as React from "react";
import type { ComponentType } from "react";
import { AlertTriangle, Building2, Check, CreditCard, FileWarning, Fingerprint, LockKeyhole, ShieldCheck, Snowflake, Upload, X, type LucideProps } from "lucide-react";

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
};

export function ModalFrame({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[#20251f]/55 px-0 backdrop-blur-sm sm:place-items-center sm:px-5">
      <section className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-hero sm:max-w-[560px] sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-[#e0e7de] px-6 py-5">
          <p className="font-display text-xl font-extrabold">Obligon LTD</p>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg bg-[#f1f5f0]" aria-label="Close modal">
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
  onCardBlockedChange
}: CustomerModalsProps) {
  if (!modal) return null;
  if (modal === "topup") return <TopUpModal onClose={onClose} />;
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

  React.useEffect(() => {
    if (step !== "success") return;
    const timer = setTimeout(onClose, 2400);
    return () => clearTimeout(timer);
  }, [step, onClose]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
    setStep("success");
  }

  return (
    <ModalFrame onClose={onClose}>
      {step === "form" ? (
        <form onSubmit={handleSubmit} className="p-6">
          <span className="grid size-12 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <LockKeyhole size={22} />
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold">Change PIN</h2>
          <p className="mt-2 text-sm text-obligon-text">
            Update the 4-digit access code used to authorize fleet transactions.
          </p>

          <PinInput label="Current PIN" value={currentPin} onChange={setCurrentPin} placeholder="••••" autoFocus />
          <PinInput label="New PIN" value={newPin} onChange={setNewPin} placeholder="••••" />
          <PinInput label="Confirm New PIN" value={confirmPin} onChange={setConfirmPin} placeholder="••••" />

          {error ? <p className="mt-4 rounded-lg bg-[#ffe8e8] p-3 text-sm font-bold text-[#c1121f]">{error}</p> : null}

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">
              Cancel
            </button>
            <button type="submit" className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white">
              Update PIN
            </button>
          </div>
        </form>
      ) : (
        <div className="p-6 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Check size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold">PIN Updated</h2>
          <p className="mt-2 text-sm text-obligon-text">
            Your access code was changed successfully. Use your new PIN for future transactions.
          </p>
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

  React.useEffect(() => {
    if (step !== "scanning") return;
    const timer = setTimeout(() => {
      onChange(true);
      setStep("success");
    }, 1800);
    return () => clearTimeout(timer);
  }, [step, onChange]);

  return (
    <ModalFrame onClose={onClose}>
      {step === "intro" ? (
        <div className="p-6 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#eef3ff] text-obligon-blue">
            <Fingerprint size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold">Enable Biometrics</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-obligon-text">
            Use FaceID or Fingerprint to unlock your fleet dashboard and approve transactions instantly — no PIN required.
          </p>
          <ul className="mx-auto mt-6 max-w-sm space-y-3 text-left">
            {["Your biometric data never leaves this device", "Fallback to PIN is always available", "Can be disabled at any time"].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm font-bold">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
                  <Check size={12} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">
              Not Now
            </button>
            <button
              type="button"
              onClick={() => setStep("scanning")}
              className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white"
            >
              Enable
            </button>
          </div>
        </div>
      ) : null}

      {step === "scanning" ? (
        <div className="p-6 py-12 text-center">
          <span className="mx-auto grid size-24 animate-pulse place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Fingerprint size={48} />
          </span>
          <h2 className="mt-6 font-display text-2xl font-extrabold">Scanning...</h2>
          <p className="mt-2 text-sm text-obligon-text">Touch the sensor or look at the camera to register your biometrics.</p>
        </div>
      ) : null}

      {step === "success" ? (
        <div className="p-6 py-12 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <ShieldCheck size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold">Biometrics Enabled</h2>
          <p className="mt-2 text-sm text-obligon-text">FaceID and Fingerprint login are now active on this device.</p>
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
          <h2 className="mt-5 font-display text-2xl font-extrabold">Disable Biometrics?</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-obligon-text">
            You will need your 4-digit PIN to sign in and approve transactions on this device.
          </p>
          <div className="mt-7 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">
              Keep Enabled
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(false);
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

function TopUpModal({ onClose }: { onClose: () => void }) {
  const [method, setMethod] = React.useState("Main Operating Acct");
  const [amount, setAmount] = React.useState("5,000.00");
  const [state, setState] = React.useState<"form" | "processing" | "success" | "error">("form");
  const paymentMethods: Array<{ title: string; body: string; Icon: ComponentType<LucideProps> }> = [{ title: "Main Operating Acct", body: "Acct ending in ****4921", Icon: Building2 }, { title: "Corporate Card", body: "Visa ending in ****1184", Icon: CreditCard }];
  const numericAmount = Number(amount.replace(/,/g, ""));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setState("error"); return; }
    setState("processing");
    window.setTimeout(() => setState("success"), 450);
  }

  return <ModalFrame onClose={onClose}><form onSubmit={submit} className="p-6">{state === "success" ? <div className="py-8 text-center"><Check className="mx-auto size-12 rounded-full bg-[#e8fbd7] p-2 text-obligon-green" /><h2 className="mt-5 font-display text-3xl font-extrabold">Top-up prepared</h2><p className="mt-3 text-sm leading-6 text-obligon-text">A top-up request for ₦{amount} using {method} is complete for this frontend session. A payment service is required before funds are actually moved.</p><button type="button" onClick={onClose} className="mt-8 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white">Close</button></div> : <><span className="rounded-full bg-[#e8fbd7] px-3 py-1 text-[10px] font-extrabold uppercase text-obligon-green">Secure Transaction</span><h2 className="mt-4 font-display text-3xl font-extrabold">Top Up Balance</h2><p className="mt-2 text-sm text-obligon-text">Choose a funding source and amount for a frontend-only top-up request.</p><label className="mt-7 block"><span className="text-xs font-extrabold uppercase text-obligon-text">Amount</span><div className="mt-2 flex h-14 rounded-lg border border-[#cfd8cc] bg-[#f7fbf8]"><span className="grid w-14 place-items-center font-extrabold">₦</span><input value={amount} onChange={(event) => { setAmount(event.target.value); setState("form"); }} inputMode="decimal" className="w-full bg-transparent pr-4 font-display text-2xl font-extrabold outline-none" /></div></label><div className="mt-7"><p className="text-xs font-extrabold uppercase text-obligon-text">Payment Method</p>{paymentMethods.map(({ title, body, Icon }) => <button key={title} type="button" onClick={() => setMethod(title)} aria-pressed={method === title} className={`mt-3 flex w-full items-center gap-4 rounded-lg border p-4 text-left ${method === title ? "border-obligon-green bg-[#f3ffe8]" : "border-[#cfd8cc] bg-white"}`}><span className="grid size-10 place-items-center rounded-full bg-[#eef3ff] text-obligon-blue"><Icon size={18} /></span><span><span className="block font-extrabold">{title}</span><span className="text-sm text-obligon-text">{body}</span></span></button>)}</div><div className="mt-7 flex items-center justify-between rounded-lg bg-[#f7fbf8] p-4 text-sm"><span className="font-bold text-obligon-text">Processing Fee</span><span className="font-extrabold">₦0.00</span></div>{state === "error" ? <p className="mt-4 rounded-lg bg-[#ffe8e8] p-3 text-sm font-bold text-[#c1121f]" role="alert">Enter a valid top-up amount greater than zero.</p> : null}{state === "processing" ? <p className="mt-4 rounded-lg bg-[#eef3ff] p-3 text-sm font-bold text-obligon-blue" role="status">Preparing your frontend-only request…</p> : null}<div className="mt-6 flex gap-3"><button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">Cancel</button><button disabled={state === "processing"} type="submit" className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60">{state === "processing" ? "Preparing…" : "Confirm Top Up"}</button></div></>}</form></ModalFrame>;
}

function ReportProblemModal({ onClose }: { onClose: () => void }) {
  const [issue, setIssue] = React.useState("Incorrect Amount");
  const [details, setDetails] = React.useState("");
  const [attachment, setAttachment] = React.useState("");
  const [state, setState] = React.useState<"form" | "processing" | "success" | "error">("form");
  const fileInput = React.useRef<HTMLInputElement>(null);

  function submit(event: React.FormEvent) { event.preventDefault(); if (details.trim().length < 12) { setState("error"); return; } setState("processing"); window.setTimeout(() => setState("success"), 450); }

  return <ModalFrame onClose={onClose}><form onSubmit={submit} className="p-6">{state === "success" ? <div className="py-8 text-center"><Check className="mx-auto size-12 rounded-full bg-[#e8fbd7] p-2 text-obligon-green" /><h2 className="mt-5 font-display text-3xl font-extrabold">Report prepared</h2><p className="mt-3 text-sm leading-6 text-obligon-text">Your {issue.toLowerCase()} report is recorded for this frontend session. A support service is required to create and track a real ticket.</p><button type="button" onClick={onClose} className="mt-8 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white">Close</button></div> : <><h2 className="font-display text-3xl font-extrabold">Report a Problem</h2><p className="mt-2 text-sm leading-6 text-obligon-text">Provide enough context for a support team to investigate the issue.</p><div className="mt-7"><p className="text-xs font-extrabold uppercase text-obligon-text">Issue Type</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{["Incorrect Amount", "Station Not Found", "Fuel Quality Issue", "Other Issue"].map((item) => <button key={item} type="button" onClick={() => setIssue(item)} aria-pressed={issue === item} className={`rounded-lg border px-4 py-3 text-left text-sm font-extrabold ${issue === item ? "border-obligon-green bg-[#f3ffe8] text-obligon-green" : "border-[#cfd8cc] bg-white"}`}>{item}</button>)}</div></div><label className="mt-6 block"><span className="text-xs font-extrabold uppercase text-obligon-text">Transaction ID (Optional)</span><input className="mt-2 h-12 w-full rounded-lg border border-[#cfd8cc] px-4 outline-none" placeholder="e.g. TXN-84729" /></label><label className="mt-5 block"><span className="text-xs font-extrabold uppercase text-obligon-text">Additional Details</span><textarea value={details} onChange={(event) => { setDetails(event.target.value); setState("form"); }} className="mt-2 min-h-32 w-full rounded-lg border border-[#cfd8cc] p-4 outline-none" placeholder="Describe the problem in detail, including the date, time, and location." /></label><input ref={fileInput} type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" onChange={(event) => setAttachment(event.target.files?.[0]?.name ?? "")} /><button type="button" onClick={() => fileInput.current?.click()} className="mt-5 flex w-full items-center justify-center gap-3 rounded-lg border border-dashed border-[#cfd8cc] bg-[#f7fbf8] p-6 text-sm font-extrabold text-obligon-text"><Upload size={18} />{attachment ? `Attached: ${attachment}` : "Add an image or document"}</button><p className="mt-2 text-xs text-obligon-text">PNG, JPG, PDF up to 5MB</p>{state === "error" ? <p className="mt-4 rounded-lg bg-[#ffe8e8] p-3 text-sm font-bold text-[#c1121f]" role="alert">Describe the issue with at least a short sentence before submitting.</p> : null}{state === "processing" ? <p className="mt-4 rounded-lg bg-[#eef3ff] p-3 text-sm font-bold text-obligon-blue" role="status">Preparing your frontend-only report…</p> : null}<div className="mt-6 flex gap-3"><button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">Cancel</button><button disabled={state === "processing"} type="submit" className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60">{state === "processing" ? "Preparing…" : "Submit Report"}</button></div></>}</form></ModalFrame>;
}

function ReplaceCardModal({ onClose, blocked }: { onClose: () => void; blocked: boolean }) {
  const [step, setStep] = React.useState<"form" | "success">("form");
  const [reason, setReason] = React.useState("Damaged");
  const [address, setAddress] = React.useState("Obligon LTD Enterprise Fleet, 14 Marina Road, Lagos");
  const [reference, setReference] = React.useState("");

  const reasons = ["Damaged", "Expired", "Stolen / Lost", "Chip Upgrade"];

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address.trim()) return;
    setReference(`RC-${Math.floor(100000 + Math.random() * 899999)}`);
    setStep("success");
  }

  return (
    <ModalFrame onClose={onClose}>
      {step === "form" ? (
        <form onSubmit={handleSubmit} className="p-6">
          <span className="grid size-12 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <CreditCard size={22} />
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold">Replace Card</h2>
          <p className="mt-2 text-sm text-obligon-text">
            {blocked ? "Your card is currently blocked. " : ""}Order a new physical card and we will ship it to your registered address.
          </p>

          <p className="mt-7 text-xs font-extrabold uppercase text-obligon-text">Reason for replacement</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {reasons.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setReason(item)}
                className={`rounded-lg border px-4 py-3 text-left text-sm font-extrabold ${
                  reason === item ? "border-obligon-green bg-[#f3ffe8] text-obligon-green" : "border-[#cfd8cc] bg-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="mt-6 block">
            <span className="text-xs font-extrabold uppercase text-obligon-text">Delivery Address</span>
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-lg border border-[#cfd8cc] p-4 outline-none"
            />
          </label>

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">
              Cancel
            </button>
            <button type="submit" className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white">
              Order Replacement
            </button>
          </div>
        </form>
      ) : (
        <div className="p-6 py-10 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Check size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold">Replacement Ordered</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-obligon-text">
            Your new card will arrive in 3-5 business days. Reference <span className="font-extrabold text-obligon-navy">{reference}</span>.
          </p>
          <div className="mx-auto mt-6 max-w-sm space-y-3 text-left">
            <div className="flex items-center gap-3 rounded-lg bg-[#f7fbf8] p-3 text-sm font-bold">
              <span className="text-obligon-green">●</span> Order received
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#f7fbf8] p-3 text-sm font-bold">
              <span className="text-obligon-text">●</span> Printing &amp; personalizing
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#f7fbf8] p-3 text-sm font-bold">
              <span className="text-obligon-text">○</span> Shipped to address
            </div>
          </div>
          <button type="button" onClick={onClose} className="mt-7 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white">
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

  function handleBlock() {
    setReference(`BL-${Math.floor(100000 + Math.random() * 899999)}`);
    onBlockedChange(true);
    setStep("success");
  }

  return (
    <ModalFrame onClose={onClose}>
      {step === "confirm" ? (
        <div className="p-6">
          <span className="grid size-12 place-items-center rounded-full bg-[#ffe8e8] text-[#c1121f]">
            <FileWarning size={22} />
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold">Report Lost Card</h2>
          <p className="mt-2 text-sm text-obligon-text">
            This will immediately block card •••• 4092. Pending and recurring transactions will be paused until a replacement is issued.
          </p>
          <div className="mt-6 space-y-3">
            {["Card blocked instantly across all stations", "Recurring payments paused", "A replacement can be ordered immediately"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg bg-[#fff3d8] p-3 text-sm font-bold text-[#9a6300]">
                <AlertTriangle size={16} /> {item}
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">
              Cancel
            </button>
            <button type="button" onClick={handleBlock} className="h-12 flex-1 rounded-lg bg-[#c1121f] font-extrabold text-white">
              Block Card Now
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 py-10 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#ffe8e8] text-[#c1121f]">
            <FileWarning size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold">Card Blocked</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-obligon-text">
            Card •••• 4092 is now blocked. Reference <span className="font-extrabold text-obligon-navy">{reference}</span>. Order a replacement to resume spending.
          </p>
          <div className="mt-7 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">
              Close
            </button>
            <button onClick={onClose} className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white">
              Order Replacement
            </button>
          </div>
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
  const [step, setStep] = React.useState<"confirm" | "success">("confirm");
  const next = !frozen;

  function handleConfirm() {
    onChange(next);
    setStep("success");
  }

  return (
    <ModalFrame onClose={onClose}>
      {step === "confirm" ? (
        <div className="p-6 text-center">
          <span className={`mx-auto grid size-16 place-items-center rounded-full ${next ? "bg-[#eef3ff] text-obligon-blue" : "bg-[#e8fbd7] text-obligon-green"}`}>
            <Snowflake size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold">{next ? "Freeze Card" : "Unfreeze Card"}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-obligon-text">
            {next
              ? "Temporarily lock transactions on card •••• 4092. Your balance and subscriptions stay safe, and you can unfreeze anytime."
              : "Resume transactions on card •••• 4092. The card will be active immediately."}
          </p>
          <div className="mt-7 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`h-12 flex-1 rounded-lg font-extrabold text-white ${next ? "bg-obligon-blue" : "bg-obligon-green"}`}
            >
              {next ? "Freeze Now" : "Unfreeze"}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 py-10 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Check size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold">{next ? "Card Frozen" : "Card Unfrozen"}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-obligon-text">
            {next
              ? "Card •••• 4092 is temporarily locked. No transactions can be authorized until you unfreeze it."
              : "Card •••• 4092 is active again and ready for transactions."}
          </p>
          <button type="button" onClick={onClose} className="mt-7 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white">
            Done
          </button>
        </div>
      )}
    </ModalFrame>
  );
}
