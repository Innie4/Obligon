"use client";

import * as React from "react";
import type { ComponentType } from "react";
import { AlertTriangle, Building2, Check, CreditCard, FileWarning, Fingerprint, LockKeyhole, ShieldCheck, Snowflake, Upload, X, Loader2, ArrowRight, type LucideProps } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import { api, authApi, mutationsApi, publicApi, type CustomerSpendProjection, type PaymentConfig, type PaymentFeeSchedule } from "@/lib/services";

/** Resolve the signed-in customer's card id against the live API (null in mock mode). */
async function resolveCardId(): Promise<string | null> {
  try {
    const data = await api.request<{ card: { id?: string } | null }>("/api/customer/card");
    return data?.card?.id ?? null;
  } catch {
    return null;
  }
}

export type CustomerModalType =
  | "topup"
  | "spendProjection"
  | "report"
  | "changePin"
  | "changePassword"
  | "twoFactor"
  | "cardPlan"
  | "cardDetails"
  | "cardSubmitted"
  | "replaceCard"
  | "lostCard"
  | "freezeCard"
  | null;

type CustomerModalsProps = {
  modal: CustomerModalType;
  onClose: () => void;
  onTwoFactorChange?: (enabled: boolean) => void;
  cardFrozen: boolean;
  onCardFrozenChange: (frozen: boolean) => void;
  cardBlocked: boolean;
  onCardBlockedChange: (blocked: boolean) => void;
  onTopUpSuccess?: (amount: number) => void;
  /**
   * The customer's projection for this month. Passed in rather than fetched
   * again so the prompt that opens on a new account and the edit opened from the
   * MTD Spend card show the same figures, even if one was already in flight.
   */
  spendProjection?: CustomerSpendProjection | null;
  /** Called after a projection is saved, so the MTD Spend card can redraw. */
  onSpendProjectionSaved?: () => void;
  /** Which processor the API selected, surfaced for copy in the top-up modal. */
  paymentProvider?: string;
};

export function ModalFrame({
  children,
  onClose,
  size = "default"
}: {
  children: React.ReactNode;
  onClose: () => void;
  /** `wide` is for comparison layouts that place cards side by side. */
  size?: "default" | "wide";
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[#20251f]/55 px-0 backdrop-blur-sm sm:place-items-center sm:px-5">
      <section
        className={`max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-hero sm:rounded-2xl ${
          size === "wide" ? "sm:max-w-[1040px]" : "sm:max-w-[560px]"
        }`}
      >
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
  onTwoFactorChange,
  cardFrozen,
  onCardFrozenChange,
  cardBlocked,
  onCardBlockedChange,
  onTopUpSuccess,
  spendProjection,
  onSpendProjectionSaved,
  paymentProvider
}: CustomerModalsProps) {
  if (!modal) return null;
  if (modal === "topup") return <TopUpModal onClose={onClose} onSuccess={onTopUpSuccess} defaultProvider={paymentProvider} />;
  if (modal === "spendProjection") {
    return (
      <SpendProjectionModal
        onClose={onClose}
        projection={spendProjection ?? null}
        onSaved={onSpendProjectionSaved}
      />
    );
  }
  if (modal === "report") return <ReportProblemModal onClose={onClose} />;
  if (modal === "changePin") return <ChangePinModal onClose={onClose} />;
  if (modal === "changePassword") return <ChangePasswordModal onClose={onClose} />;
  if (modal === "twoFactor") return <TwoFactorModal onClose={onClose} onChange={onTwoFactorChange} />;
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

/** Figures offered as one-tap starting points, in naira. */
const PROJECTION_PRESETS = [10_000, 25_000, 50_000, 100_000, 250_000];

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Set or revise the customer's projected spend for this month.
 *
 * Opens two ways, from the same component: unprompted on a new account or on the
 * first of a new month, where there is no answer for the month in progress, and
 * on demand by clicking the MTD Spend card. The second case is a revision, not a
 * correction, so the field is pre-filled with what is already stored and the copy
 * says it can go up as well as down.
 */
function SpendProjectionModal({
  onClose,
  projection,
  onSaved
}: {
  onClose: () => void;
  projection: CustomerSpendProjection | null;
  onSaved?: () => void;
}) {
  const isRevision = Boolean(projection?.projectedKobo);
  // Pre-filled from the stored figure, not from a hardcoded default, so opening
  // the card to check the current plan and changing your mind does not silently
  // replace it with a round number.
  const [amount, setAmount] = React.useState(
    projection?.projectedKobo != null ? String(Math.round(projection.projectedKobo / 100)) : ""
  );
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { success: toastSuccess, error: toastError } = useToast();

  // Digits and one decimal point only. Left as typed rather than coerced on every
  // keystroke, so a half-entered "5." is not rewritten out from under the cursor.
  const onAmountChange = (value: string) => {
    setAmount(value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"));
    if (error) setError("");
  };

  const numericAmount = Number(amount);
  const valid = Number.isFinite(numericAmount) && numericAmount > 0;
  const spendSoFar = projection?.mtdKobo ?? 0;
  const resultingUsage = valid ? Math.round((spendSoFar / Math.round(numericAmount * 100)) * 100) : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) {
      setError("Enter the amount you expect to spend this month.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await mutationsApi.setSpendProjection(numericAmount);
      toastSuccess("Projected spend saved");
      onSaved?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save your projection";
      setError(message);
      toastError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalFrame onClose={onClose}>
      <form onSubmit={submit} className="p-6">
        <h2 className="font-display text-2xl font-extrabold text-obligon-navy">
          {isRevision ? "Change your projected spend" : "Set your projected spend"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-obligon-text">
          {isRevision
            ? "How much do you expect to spend on fuel this month? Raise or lower it whenever your plans change — your MTD Spend card measures against this."
            : "How much do you expect to spend on fuel this month? Your MTD Spend card will track your actual spending against it, so you always know where you stand."}
        </p>

        <label className="mt-6 block">
          <span className="text-xs font-extrabold uppercase text-obligon-text">Expected spend (₦)</span>
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            aria-invalid={amount.length > 0 && !valid}
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="50000"
            className="mt-2 h-14 w-full rounded-lg border border-[#cfd8cc] bg-[#f7fbf8] px-4 font-display text-2xl font-extrabold text-obligon-navy outline-none focus:border-obligon-green"
          />
        </label>

        {/* Said as soon as there is something typed to judge, rather than only
            after a failed submit, so the field is explained before it is
            rejected. */}
        {amount.length > 0 && !valid ? (
          <p className="mt-2 text-sm font-semibold text-[#93000a]">
            Enter an amount greater than zero, in naira.
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {PROJECTION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className="rounded-full border border-obligon-border px-3 py-1.5 text-xs font-extrabold text-obligon-navy hover:bg-[#eef3ee] transition"
            >
              {formatNaira(preset).replace(/\.00$/, "")}
            </button>
          ))}
        </div>

        {spendSoFar > 0 ? (
          <div className="mt-5 rounded-xl border border-obligon-border bg-[#f7fbf8] p-4 text-sm">
            <div className="flex justify-between">
              <span className="font-bold text-obligon-text">Spent so far this month</span>
              <span className="font-extrabold text-obligon-navy">{formatNaira(spendSoFar / 100)}</span>
            </div>
            {resultingUsage != null ? (
              <div className="mt-2 flex justify-between">
                <span className="font-bold text-obligon-text">
                  {resultingUsage >= 100 ? "Over projection by" : "That leaves you at"}
                </span>
                <span className="font-extrabold text-obligon-navy">
                  {resultingUsage >= 100
                    ? formatNaira(Math.max(0, (spendSoFar - numericAmount * 100) / 100))
                    : `${resultingUsage}% used`}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg border border-[#fecaca] bg-[#fff0f0] p-3 text-sm text-[#93000a]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-lg border border-obligon-border font-extrabold text-obligon-navy"
          >
            {isRevision ? "Cancel" : "Not now"}
          </button>
          <button
            type="submit"
            // Not disabled when the amount is unusable: a greyed-out Save with
            // no explanation of what is wrong with the field is a dead end. The
            // message below the field says it instead.
            disabled={submitting}
            className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function ChangePinModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = React.useState<"form" | "success">("form");
  const [currentPin, setCurrentPin] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { success: toastSuccess, error: toastError } = useToast();

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
    try {
      const cardId = await resolveCardId();
      if (!cardId) {
        setError("No active fuel card is linked to your account yet, so there is no PIN to change.");
        setSubmitting(false);
        return;
      }
      await mutationsApi.cardAction(cardId, "pin", { currentPin, newPin });
      setSubmitting(false);
      setStep("success");
      toastSuccess("Transaction PIN changed successfully.");
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Could not update your PIN. Please try again.");
    }
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

          <PinInput label="Current PIN" value={currentPin} onChange={setCurrentPin} placeholder="â€¢â€¢â€¢â€¢" autoFocus />
          <PinInput label="New 4-Digit PIN" value={newPin} onChange={setNewPin} placeholder="â€¢â€¢â€¢â€¢" />
          <PinInput label="Confirm New PIN" value={confirmPin} onChange={setConfirmPin} placeholder="â€¢â€¢â€¢â€¢" />

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

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const { success: toastSuccess } = useToast();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Your new password must be different from your current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setDone(true);
      toastSuccess("Password changed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const field =
    "mt-1.5 h-12 w-full rounded-lg border border-obligon-border px-4 text-sm text-obligon-navy outline-none focus:border-obligon-green";

  return (
    <ModalFrame onClose={onClose}>
      {done ? (
        <div className="p-6 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <Check size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">Password Updated</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-obligon-text">
            Your password has been changed and a confirmation email has been sent to your registered address.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Change Password</h2>
          <p className="mt-2 text-sm leading-6 text-obligon-text">
            Choose a strong password you do not use anywhere else. You will stay signed in on this device.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">
                Current Password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={field}
                required
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">New Password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={field}
                required
              />
              <span className="mt-1 block text-[11px] text-obligon-text">Minimum 8 characters.</span>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">
                Confirm New Password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={field}
                required
              />
            </label>
          </div>

          {error ? (
            <p
              className="mt-4 rounded-lg border border-[#fecaca] bg-[#fff0f0] p-3 text-sm text-[#93000a]"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white disabled:opacity-60"
          >
            {submitting ? "Updatingâ€¦" : "Update Password"}
          </button>
        </form>
      )}
    </ModalFrame>
  );
}

function TwoFactorModal({
  onClose,
  onChange
}: {
  onClose: () => void;
  onChange?: (enabled: boolean) => void;
}) {
  const [step, setStep] = React.useState<"choose" | "enroll" | "disable" | "enabled">("choose");
  const [secret, setSecret] = React.useState("");
  const [qrDataUrl, setQrDataUrl] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [token, setToken] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const { success: toastSuccess } = useToast();

  async function beginEnroll() {
    setBusy(true);
    setError("");
    try {
      const setup = await authApi.mfaSetup();
      setSecret(setup.secret);
      setQrDataUrl(setup.qrDataUrl);
      setStep("enroll");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start two-factor setup.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(token)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await authApi.mfaEnable(token);
      if (result.backupCodes?.length) setBackupCodes(result.backupCodes);
      setStep("enabled");
      onChange?.(true);
      toastSuccess("Two-factor authentication enabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code was not accepted. Try the next code.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setError("Enter your password to disable two-factor authentication.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await authApi.mfaDisable(password);
      onChange?.(false);
      toastSuccess("Two-factor authentication disabled.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable two-factor authentication.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame onClose={onClose}>
      {step === "choose" ? (
        <div className="p-6">
          <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Two-Factor Authentication</h2>
          <p className="mt-2 text-sm leading-6 text-obligon-text">
            Add a time-based code from an authenticator app. Even if your password is compromised, an attacker
            cannot sign in without your device.
          </p>
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => void beginEnroll()}
              disabled={busy}
              className="h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white disabled:opacity-60"
            >
              {busy ? "Preparingâ€¦" : "Set Up Two-Factor Authentication"}
            </button>
            <button
              type="button"
              onClick={() => setStep("disable")}
              className="h-12 w-full rounded-lg border border-obligon-border font-extrabold text-obligon-navy"
            >
              Disable Two-Factor Authentication
            </button>
          </div>
          {error ? (
            <p
              className="mt-4 rounded-lg border border-[#fecaca] bg-[#fff0f0] p-3 text-sm text-[#93000a]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {step === "enroll" ? (
        <form onSubmit={confirmEnroll} className="p-6">
          <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Scan this code</h2>
          <p className="mt-2 text-sm leading-6 text-obligon-text">
            Open your authenticator app, add a new account and scan the QR code, then enter the 6-digit code it
            shows.
          </p>

          <div className="mt-6 flex flex-col items-center gap-4">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Two-factor setup QR code"
                className="size-48 rounded-lg border border-obligon-border"
              />
            ) : null}
            {secret ? (
              <p className="text-center text-[11px] text-obligon-text">
                Cannot scan? Enter this key manually:{" "}
                <span className="font-mono font-bold text-obligon-navy">{secret}</span>
              </p>
            ) : null}
          </div>

          <label className="mt-6 block">
            <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">6-digit code</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              className="mt-1.5 h-14 w-full rounded-lg border border-obligon-border px-4 text-center text-lg font-extrabold tracking-[0.4em] text-obligon-navy outline-none focus:border-obligon-green"
              placeholder="000000"
              required
            />
          </label>

          {error ? (
            <p
              className="mt-4 rounded-lg border border-[#fecaca] bg-[#fff0f0] p-3 text-sm text-[#93000a]"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white disabled:opacity-60"
          >
            {busy ? "Verifyingâ€¦" : "Verify and Enable"}
          </button>
        </form>
      ) : null}

      {step === "disable" ? (
        <form onSubmit={confirmDisable} className="p-6">
          <h2 className="font-display text-2xl font-extrabold text-obligon-navy">
            Disable two-factor authentication?
          </h2>
          <p className="mt-2 text-sm leading-6 text-obligon-text">
            Your account will rely on your password alone. Confirm with your password to continue.
          </p>
          <label className="mt-6 block">
            <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-12 w-full rounded-lg border border-obligon-border px-4 text-sm text-obligon-navy outline-none focus:border-obligon-green"
              required
            />
          </label>
          {error ? (
            <p
              className="mt-4 rounded-lg border border-[#fecaca] bg-[#fff0f0] p-3 text-sm text-[#93000a]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="h-12 flex-1 rounded-lg border border-obligon-border font-extrabold text-obligon-navy"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-12 flex-1 rounded-lg bg-[#c1121f] font-extrabold text-white disabled:opacity-60"
            >
              {busy ? "Disablingâ€¦" : "Disable"}
            </button>
          </div>
        </form>
      ) : null}

      {step === "enabled" ? (
        <div className="p-6 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
            <ShieldCheck size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">
            Two-Factor Authentication On
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-obligon-text">
            A verification code is now required every time you sign in.
          </p>

          {backupCodes.length ? (
            <div className="mt-6 rounded-xl border border-obligon-border bg-[#f7fbf8] p-4 text-left">
              <p className="text-xs font-extrabold text-obligon-navy">Save your backup codes</p>
              <p className="mt-1 text-[11px] leading-4 text-obligon-text">
                Each code works once if you lose access to your authenticator. Store them somewhere safe.
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs font-bold text-obligon-navy">
                {backupCodes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="mt-6 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white"
          >
            Done
          </button>
        </div>
      ) : null}
    </ModalFrame>
  );
}

function TopUpModal({
  onClose,
  onSuccess,
  defaultProvider
}: {
  onClose: () => void;
  onSuccess?: (amount: number) => void;
  defaultProvider?: string;
}) {
  const [method, setMethod] = React.useState("Card / Bank");
  const [amount, setAmount] = React.useState("25000");
  const [submitting, setSubmitting] = React.useState(false);
  const [pending, setPending] = React.useState<{ reference: string; amount: number; provider: string } | null>(null);
  const [successData, setSuccessData] = React.useState<{ reference: string; amount: number; method: string; balanceLabel?: string } | null>(null);
  // The fee comes from the server so the figure shown is the figure charged. It
  // was previously a hardcoded "0.00 (Zero Fee)" that was true in neither
  // direction: the processor always charges something.
  const [feeSchedule, setFeeSchedule] = React.useState<PaymentFeeSchedule | null>(null);
  const [feeConfig, setFeeConfig] = React.useState<PaymentConfig | null>(null);
  const { error: toastError, success: toastSuccess } = useToast();

  React.useEffect(() => {
    let cancelled = false;
    void publicApi
      .getPaymentConfig()
      .then((cfg) => {
        if (cancelled) return;
        setFeeSchedule(cfg.fee ?? null);
        setFeeConfig(cfg);
      })
      // A failure here must not block topping up; the server remains the
      // authority on what is charged either way.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // The minimum comes from the server rather than being restated here. The two
  // copies used to disagree (₦500 enforced, ₦1,000 offered), so a customer could
  // be shown a Pay button the API then rejected.
  const minimumNaira = Math.max(1, Math.round((feeConfig?.minimumTopupKobo ?? 10_000) / 100));
  const quickAmounts = [5000, 10000, 25000, 50000, 100000];

  const paymentMethods = [
    { title: "Card / Bank", body: "Pay securely through our payment provider", Icon: CreditCard },
    { title: "Direct Bank Transfer", body: "Instant funding via dedicated virtual NUBAN", Icon: Building2 },
    { title: "USSD / Quick Bank Code", body: "*737# or *894# direct checkout", Icon: ArrowRight },
  ];

  const numericAmount = Number(amount.replace(/[^0-9.]/g, ""));

  // When the customer bears the fee it is added to the amount demanded, so the
  // total has to be shown before they authorise rather than afterwards. Rounded
  // up to match the server exactly: a total that differs by a naira from the
  // charge is a dispute waiting to happen.
  const feeCustomer = feeSchedule?.bearer === "customer";
  const feeKobo = feeCustomer ? Math.ceil((numericAmount * 100 * (feeSchedule?.basisPoints ?? 0)) / 10_000) : 0;
  const feeLabel = `₦${(feeKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const totalToPay = Math.round(numericAmount + feeKobo / 100);
  const belowMinimum = !Number.isFinite(numericAmount) || numericAmount < minimumNaira;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (belowMinimum) {
      toastError(`Please enter a valid top-up amount of at least \u20a6${minimumNaira.toLocaleString("en-NG")}.`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await mutationsApi.topUpWallet(numericAmount, method);
      const ref = result?.reference ?? `TOPUP-${Math.floor(100000 + Math.random() * 899999)}`;
      const provider = result?.provider ?? defaultProvider ?? "flutterwave";

      if (result?.simulated) {
        // No processor configured: settle immediately so the flow stays usable
        // in development instead of redirecting to a checkout that cannot exist.
        const confirmed = await mutationsApi.confirmTopUp(ref, { simulated: true });
        setSuccessData({ reference: ref, amount: numericAmount, method, balanceLabel: confirmed?.balanceLabel });
        onSuccess?.(numericAmount);
        toastSuccess(`\u20a6${numericAmount.toLocaleString()} top-up recorded.`);
        return;
      }

      if (result?.paymentUrl) {
        setPending({ reference: ref, amount: numericAmount, provider });
        // Keep the modal mounted while the browser navigates away.
        window.location.assign(result.paymentUrl);
        return;
      }

      // Provider accepted the intent but gave us nowhere to send the customer.
      setSubmitting(false);
      toastError("We could not start the payment. Please try again.");
    } catch (err) {
      setSubmitting(false);
      const message = err instanceof Error ? err.message : "Top-up failed. Please try again.";
      toastError(message);
    }
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
            <strong className="text-obligon-green font-extrabold text-base">
              {"\u20a6"}
              {successData.amount.toLocaleString()}
            </strong>
            {successData.balanceLabel ? `. New balance ${successData.balanceLabel}.` : "."}
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
      ) : pending ? (
        <div className="p-8 text-center">
          <Loader2 size={32} className="mx-auto animate-spin text-obligon-green" />
          <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">Redirecting to secure checkout</h2>
          <p className="mt-2 text-sm text-obligon-text">
            Taking you to {pending.provider === "paystack" ? "Paystack" : "Flutterwave"} to complete your{" "}
            {"\u20a6"}
            {pending.amount.toLocaleString()} payment.
          </p>
          <p className="mt-4 text-xs text-obligon-text">
            Reference <span className="font-mono font-bold text-obligon-navy">{pending.reference}</span>
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="p-6 sm:p-8">
          <span className="rounded-full bg-[#e8fbd7] px-3 py-1 text-[10px] font-extrabold uppercase text-obligon-green">
            Instant Wallet Recharge
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-obligon-navy">Top Up Fleet Wallet</h2>
          <p className="mt-1 text-sm text-obligon-text">Select an amount and payment method to instantly fund your account.</p>

          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <label className="text-xs font-extrabold uppercase text-obligon-text">
                Select or Enter Amount (₦)
              </label>
              {/* Stated up front so a customer is not left guessing why the
                  button is disabled. */}
              <span className="text-[11px] font-bold text-obligon-text">
                Minimum ₦{minimumNaira.toLocaleString("en-NG")}
              </span>
            </div>
            <div
              className={`flex h-14 rounded-xl border bg-[#f7fbf8] focus-within:border-obligon-green focus-within:ring-2 focus-within:ring-obligon-green/20 ${
                amount.length > 0 && belowMinimum ? "border-[#e0a3a3]" : "border-[#cfd8cc]"
              }`}
            >
              <span className="grid w-14 place-items-center font-display text-2xl font-extrabold text-obligon-navy">₦</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="25,000"
                aria-describedby="topup-minimum-hint"
                className="w-full bg-transparent pr-4 font-display text-2xl font-extrabold text-obligon-navy outline-none"
              />
            </div>
            {amount.length > 0 && belowMinimum ? (
              <p id="topup-minimum-hint" className="mt-2 text-xs font-bold text-[#c1121f]">
                Enter at least ₦{minimumNaira.toLocaleString("en-NG")}.
              </p>
            ) : null}
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

          <div className="mt-6 overflow-hidden rounded-xl bg-[#f7fbf8] text-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-bold text-obligon-text">Top-up amount</span>
              <span className="font-extrabold text-obligon-navy">₦{(numericAmount || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#e6ede4] px-4 py-3">
              <span className="font-bold text-obligon-text">
                Gateway Transaction Fee
                {feeCustomer && feeSchedule && feeSchedule.percent > 0 ? (
                  <span className="ml-1.5 font-semibold text-obligon-text/80">({feeSchedule.percent}%)</span>
                ) : null}
              </span>
              <span className={`font-extrabold ${feeCustomer ? "text-obligon-navy" : "text-obligon-green"}`}>
                {feeCustomer ? feeLabel : "₦0.00 (Absorbed by Obligon)"}
              </span>
            </div>
            {feeCustomer ? (
              <div className="flex items-center justify-between border-t border-[#e6ede4] bg-[#eef6ea] px-4 py-3">
                <span className="font-extrabold text-obligon-navy">Total to pay</span>
                <span className="text-lg font-extrabold text-obligon-green">₦{totalToPay.toLocaleString()}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-[#20251f] font-extrabold text-obligon-navy">
              Cancel
            </button>
            <button
              disabled={submitting || belowMinimum}
              type="submit"
              className="h-12 flex-1 rounded-lg bg-obligon-green font-extrabold text-white shadow-green flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ₦${(totalToPay || 0).toLocaleString()}`
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
    try {
      const result = await mutationsApi.createSupportTicket({ subject: issue, category: "complaint", message: details });
      const ticketId = result?.reference ?? `TKT-${Math.floor(10000 + Math.random() * 89999)}`;
      setTicketResult({ ticketId, issue });
      setSubmitting(false);
      toastSuccess(`Ticket ${ticketId} created. Support team notified.`);
    } catch (err) {
      setSubmitting(false);
      toastError(err instanceof Error ? err.message : "Could not create the ticket. Please try again.");
    }
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
  const { success: toastSuccess, error: toastError } = useToast();

  const reasons = ["Damaged Chip / Wear", "Card Expiring Soon", "Stolen / Lost", "Fleet Upgrade to NFC"];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      const cardId = await resolveCardId();
      if (cardId) {
        await mutationsApi.cardAction(cardId, "replace", { reason });
      }
      const ref = `RC-${Math.floor(100000 + Math.random() * 899999)}`;
      setReference(ref);
      setSubmitting(false);
      setStep("success");
      toastSuccess(`Replacement card order ${ref} placed.`);
    } catch (err) {
      setSubmitting(false);
      toastError(err instanceof Error ? err.message : "Could not place the replacement order. Please try again.");
    }
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
              <span className="text-obligon-green font-black">âœ“</span> Card embossed and encoded
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#f7fbf8] p-3 text-xs font-bold text-obligon-navy">
              <span className="text-obligon-green font-black">âœ“</span> Courier handoff in progress
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

  const [blocking, setBlocking] = React.useState(false);

  async function handleBlock() {
    setBlocking(true);
    try {
      const cardId = await resolveCardId();
      if (cardId) {
        await mutationsApi.cardAction(cardId, "report-lost", { reason });
      }
      const ref = `BL-${Math.floor(100000 + Math.random() * 899999)}`;
      setReference(ref);
      onBlockedChange(true);
      setStep("success");
      toastSuccess("Card permanently blocked. All future authorizations will be declined.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not block the card. Please try again.");
    } finally {
      setBlocking(false);
    }
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
              disabled={blocking}
              className="h-12 flex-1 rounded-lg bg-[#c1121f] font-extrabold text-white disabled:opacity-60"
            >
              {blocking ? "Blocking..." : "Confirm Block"}
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
  const { success: toastSuccess, error: toastError } = useToast();
  const [working, setWorking] = React.useState(false);

  async function handleToggle() {
    const next = !frozen;
    setWorking(true);
    try {
      const cardId = await resolveCardId();
      if (cardId) {
        await mutationsApi.cardAction(cardId, next ? "freeze" : "unfreeze");
      }
      onChange(next);
      toastSuccess(next ? "Card temporarily frozen." : "Card unfrozen and active.");
      onClose();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not update the card status. Please try again.");
    } finally {
      setWorking(false);
    }
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
            disabled={working}
            className={`h-12 flex-1 rounded-lg font-extrabold text-white disabled:opacity-60 ${
              frozen ? "bg-obligon-green shadow-green" : "bg-[#bc5b00]"
            }`}
          >
            {working ? "Working..." : frozen ? "Unfreeze Card" : "Freeze Card"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
