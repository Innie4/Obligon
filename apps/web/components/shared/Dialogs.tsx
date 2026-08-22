"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2, LockKeyhole, X } from "lucide-react";

export type ActionState = "idle" | "loading" | "success" | "error";

export function ActionFeedback({
  state,
  loadingMessage = "Working on your request…",
  successMessage,
  errorMessage
}: {
  state: ActionState;
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
}) {
  if (state === "idle") return null;

  if (state === "loading") {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-lg bg-[#eef3ff] px-3 py-2 text-sm font-semibold text-obligon-blue" role="status" aria-live="polite">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        {loadingMessage}
      </p>
    );
  }

  if (state === "success") {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-lg bg-[#eaf7db] px-3 py-2 text-sm font-semibold text-[#315d00]" role="status" aria-live="polite">
        <CheckCircle2 size={16} aria-hidden="true" />
        {successMessage ?? "Your changes have been saved for this session."}
      </p>
    );
  }

  return (
    <p className="mt-4 flex items-start gap-2 rounded-lg bg-[#ffecef] px-3 py-2 text-sm font-semibold text-[#9f1027]" role="alert">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {errorMessage ?? "We could not complete that request. Please review the information and try again."}
    </p>
  );
}

export function DialogFrame({ children, onClose, ariaLabel = "Obligon dialog" }: { children: React.ReactNode; onClose: () => void; ariaLabel?: string }) {
  const dialogRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const lastActiveElement = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    return () => lastActiveElement?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-[#20251f]/55 px-0 backdrop-blur-sm sm:place-items-center sm:px-5"
      onMouseDown={onClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-hero outline-none sm:max-w-[560px] sm:rounded-lg"
      >
        <div className="flex items-center justify-between border-b border-[#e0e7de] px-6 py-5">
          <p className="font-display text-xl font-extrabold">Obligon</p>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg bg-[#f1f5f0] focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

type Tone = "green" | "red" | "dark";

const toneClasses: Record<Tone, string> = {
  green: "bg-obligon-green text-white",
  red: "bg-[#c1121f] text-white",
  dark: "bg-[#20251f] text-white"
};

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "dark",
  icon = true
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  icon?: boolean;
}) {
  if (!open) return null;
  return (
    <DialogFrame onClose={onClose} ariaLabel={title}>
      <div className="p-6">
        {icon ? (
          <span className={`grid size-12 place-items-center rounded-full ${tone === "red" ? "bg-[#ffe8e8] text-[#c1121f]" : "bg-[#eef3ff] text-obligon-blue"}`}>
            <AlertTriangle size={22} />
          </span>
        ) : null}
        <h2 className="mt-4 font-display text-3xl font-extrabold">{title}</h2>
        <p className="mt-2 text-sm text-obligon-text">{message}</p>
        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`h-12 flex-1 rounded-lg font-extrabold focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2 ${toneClasses[tone]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </DialogFrame>
  );
}

export function PinModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  minLength = 4
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  minLength?: number;
}) {
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setPin("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pin.length < minLength) {
      setError(`Please enter your ${minLength}-digit PIN.`);
      return;
    }
    onConfirm(pin);
    onClose();
  }

  return (
    <DialogFrame onClose={onClose} ariaLabel={title}>
      <form onSubmit={submit} className="p-6">
        <span className="grid size-12 place-items-center rounded-full bg-[#eef3ff] text-obligon-blue">
          <LockKeyhole size={22} />
        </span>
        <h2 className="mt-4 font-display text-3xl font-extrabold">{title}</h2>
        <p className="mt-2 text-sm text-obligon-text">{message}</p>
        <label className="mt-6 block">
          <span className="text-xs font-extrabold uppercase text-obligon-text">Transaction PIN</span>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, "").slice(0, 8));
              setError("");
            }}
            placeholder="••••"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "pin-error" : undefined}
            className="mt-2 h-12 w-full rounded-lg border border-[#cfd8cc] bg-white px-3 text-center font-mono text-2xl tracking-[8px] outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
          />
        </label>
        {error ? <p id="pin-error" className="mt-3 text-sm font-bold text-[#c1121f]" role="alert">{error}</p> : null}
        <div className="mt-7 flex gap-3">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2">
            Cancel
          </button>
          <button type="submit" className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-obligon-green focus:ring-offset-2">
            {confirmLabel}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}
