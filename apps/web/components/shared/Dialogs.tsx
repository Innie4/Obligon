"use client";

import * as React from "react";
import { AlertTriangle, LockKeyhole, X } from "lucide-react";

export function DialogFrame({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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
    <DialogFrame onClose={onClose}>
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
            className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`h-12 flex-1 rounded-lg font-extrabold ${toneClasses[tone]}`}
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
    <DialogFrame onClose={onClose}>
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
            className="mt-2 h-12 w-full rounded-lg border border-[#cfd8cc] bg-white px-3 text-center font-mono text-2xl tracking-[8px] outline-none"
          />
        </label>
        {error ? <p className="mt-3 text-sm font-bold text-[#c1121f]">{error}</p> : null}
        <div className="mt-7 flex gap-3">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold">
            Cancel
          </button>
          <button type="submit" className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white">
            {confirmLabel}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}
