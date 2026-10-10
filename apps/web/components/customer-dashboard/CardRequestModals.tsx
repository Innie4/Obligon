"use client";

import * as React from "react";
import { AlertTriangle, Check, CircleDashed, CircleSlash, Clock, CreditCard, Loader2, ShieldCheck, X } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import type { CardPlan, CardRequest, CardRequestProgress, ProgressStepState } from "@/lib/services";
import { ModalFrame } from "./CustomerModals";

/** Nigerian BVN: 11 digits beginning with 2. */
const BVN_RE = /^2\d{10}$/;

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara"
];

function PlanBadge({ state }: { state: string }) {
  if (state === "unavailable") {
    return (
      <span className="shrink-0 rounded-full bg-[#f0f4f0] px-2 py-0.5 text-[10px] font-extrabold uppercase text-obligon-text/60">
        &mdash;
      </span>
    );
  }
  if (state === "included") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e8fbd7] px-2 py-0.5 text-[10px] font-extrabold uppercase text-obligon-green">
        <Check size={10} /> Included
      </span>
    );
  }
  // "Advanced", "Premium" and percentage benefits stay distinct from Included.
  return (
    <span className="shrink-0 rounded-full bg-obligon-blue/10 px-2 py-0.5 text-[10px] font-extrabold uppercase text-obligon-blue">
      {state}
    </span>
  );
}

/**
 * Step 1 — choose an individual subscription plan. The customer cannot skip
 * this: a fuel card is only issued against a paid plan.
 */
export function CardPlanModal({
  plans,
  loading,
  busyPlan,
  onSelect,
  onClose
}: {
  plans: CardPlan[];
  loading: boolean;
  busyPlan: string | null;
  onSelect: (plan: CardPlan) => void;
  onClose: () => void;
}) {
  return (
    <ModalFrame onClose={onClose} size="wide">
      <div className="p-6">
        <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Choose your plan</h2>
        <p className="mt-2 text-sm leading-6 text-obligon-text">
          Pick the subscription that matches how much you drive. You will be taken to our payment provider to
          complete the purchase, then we will verify your details before your card is issued.
        </p>

        {loading ? (
          <div className="mt-8 flex items-center justify-center gap-2 py-8 text-sm font-bold text-obligon-text">
            <Loader2 size={18} className="animate-spin" /> Loading plans…
          </div>
        ) : (
          <div className="mt-6 grid items-stretch gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const busy = busyPlan === plan.code;
              return (
                <div
                  key={plan.code}
                  className={`flex flex-col rounded-2xl border-2 bg-white p-5 transition ${
                    busyPlan && !busy
                      ? "border-obligon-border opacity-60"
                      : "border-obligon-border hover:border-obligon-green"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-[1.2px] text-obligon-green">
                      {plan.name}
                    </p>
                    <p className="mt-1.5 text-2xl font-extrabold text-obligon-navy">
                      {plan.amountLabel}
                      <span className="text-sm font-bold text-obligon-text">/{plan.interval}</span>
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-obligon-text">{plan.blurb}</p>
                  </div>

                  {/* Every benefit is listed under its own plan so the three
                      columns can be compared directly. */}
                  <ul className="mt-5 flex-1 space-y-2.5 border-t border-[#eef3ee] pt-4">
                    {plan.features.map((feature) => {
                      const unavailable = feature.state === "unavailable";
                      return (
                        <li key={feature.label} className="flex items-start justify-between gap-2">
                          <span className="flex min-w-0 items-start gap-2">
                            {unavailable ? (
                              <span aria-hidden="true" className="mt-px w-3 shrink-0 text-center text-xs text-obligon-text/50">
                                &mdash;
                              </span>
                            ) : (
                              <Check size={13} className="mt-0.5 shrink-0 text-obligon-green" />
                            )}
                            <span
                              className={`text-[11px] leading-4 ${
                                unavailable ? "text-obligon-text/50" : "font-bold text-obligon-navy"
                              }`}
                            >
                              {feature.label}
                            </span>
                          </span>
                          <PlanBadge state={feature.state} />
                        </li>
                      );
                    })}
                  </ul>

                  <button
                    type="button"
                    disabled={busyPlan !== null}
                    onClick={() => onSelect(plan)}
                    className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-obligon-green text-sm font-extrabold text-white transition hover:bg-obligon-green/90 disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                    {busy ? "Starting checkout…" : `Choose ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalFrame>
  );
}

/** Step 2 — identity details, collected only after payment is confirmed. */
export function CardDetailsModal({
  defaultName,
  defaultPhone,
  busy,
  onSubmit,
  onClose
}: {
  defaultName: string;
  defaultPhone: string;
  busy: boolean;
  onSubmit: (details: { fullName: string; bvn: string; address: string; city: string; state: string; dateOfBirth:string;postalCode:string;phone:string }) => void;
  onClose: () => void;
}) {
  const [fullName, setFullName] = React.useState(defaultName);
  const [dateOfBirth,setDateOfBirth]=React.useState("");
  const [postalCode,setPostalCode]=React.useState("");
  const [bvn, setBvn] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [phone, setPhone] = React.useState(defaultPhone);
  const [error, setError] = React.useState("");

  const field =
    "mt-1.5 h-12 w-full rounded-lg border border-obligon-border px-4 text-sm text-obligon-navy outline-none focus:border-obligon-green";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fullName.trim().length < 2) {
      setError("Enter your full legal name exactly as it appears on your ID.");
      return;
    }
    if (!BVN_RE.test(bvn)) {
      setError("BVN must be 11 digits starting with 2.");
      return;
    }
    if (!address.trim()) {
      setError("Enter your residential address for identity review.");
      return;
    }
    if (!city.trim()) {
      setError("Enter your city.");
      return;
    }
    if (!state) {
      setError("Select your state.");
      return;
    }
    setError("");
    onSubmit({ fullName: fullName.trim(), bvn, address: address.trim(), city: city.trim(), state,dateOfBirth,postalCode,phone });
  }

  return (
    <ModalFrame onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6">
        <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Verify your details</h2>
        <p className="mt-2 text-sm leading-6 text-obligon-text">
          We are required to confirm your identity before a fuel card is issued. Your BVN is checked against
          your submitted details and stored securely. Authorized administrators can review it.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Full legal name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className={field}
              placeholder="As shown on your ID"
              required
            />
          </label>

          <label className="block"><span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Date of birth</span><input type="date" className={field} required value={dateOfBirth} onChange={e=>setDateOfBirth(e.target.value)} max={new Date().toISOString().slice(0,10)}/></label>
          <label className="block"><span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Postal code</span><input className={field} required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={postalCode} onChange={e=>setPostalCode(e.target.value.replace(/\D/g,""))}/></label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">BVN</span>
            <input
              value={bvn}
              onChange={(e) => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))}
              inputMode="numeric"
              autoComplete="off"
              className={field}
              placeholder="11 digits, starting with 2"
              required
            />
            <span className="mt-1 block text-[11px] text-obligon-text">
              You can find this on your Bank Verification Number slip or in your bank app.
            </span>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Residential address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              className={field}
              placeholder="Street, area, city"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">City</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={field} required />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">State</span>
              <select value={state} onChange={(e) => setState(e.target.value)} className={field} required>
                <option value="">Select state</option>
                {NIGERIAN_STATES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Phone number</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              pattern="[+]234[0-9]{10}"
              required
              autoComplete="tel"
              className={field}
              placeholder="+234 801 000 0000"
            />
            <span className="mt-1 block text-[11px] text-obligon-text">
              Required by the issuer for card OTPs; use +234 followed by ten digits.
            </span>
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-[#fecaca] bg-[#fff0f0] p-3 text-sm text-[#93000a]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white disabled:opacity-60"
        >
          {busy ? "Submitting for verification…" : "Submit for verification"}
        </button>
      </form>
    </ModalFrame>
  );
}

/** Step 3 — confirmation that verification takes 1-3 business days. */
export function CardSubmittedModal({
  request,
  eta,
  onClose
}: {
  request: CardRequest | null;
  eta: string;
  onClose: () => void;
}) {
  const { success: toastSuccess } = useToast();

  React.useEffect(() => {
    // Surface the outcome once, as a toast, in addition to the dialog itself.
    if (request?.verificationStatus === "pending") {
      toastSuccess("Your details were submitted for verification.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.verificationStatus]);

  return (
    <ModalFrame onClose={onClose}>
      <div className="p-6 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
          <ShieldCheck size={30} />
        </span>

        <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">Verification submitted</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-obligon-text">
          {request?.planName ? `Your ${request.planName} payment is confirmed and ` : "Your payment is confirmed and "}
          we are now verifying your details.
        </p>

        <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-obligon-green/30 bg-[#f7fbf8] p-5 text-left">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[1.1px] text-obligon-green">
            <CreditCard size={14} /> What happens next
          </p>
          <ol className="mt-3 space-y-2.5 text-sm leading-5 text-obligon-navy">
            <li className="flex gap-2.5">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-obligon-green text-[10px] font-extrabold text-white">
                1
              </span>
              An Obligon administrator reviews your submitted identity details.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-obligon-green text-[10px] font-extrabold text-white">
                2
              </span>
              After approval, your virtual fuel card is issued and your paid subscription period begins.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-obligon-green text-[10px] font-extrabold text-white">
                3
              </span>
              Your virtual card appears in this dashboard. Physical cards and delivery are coming soon.
            </li>
          </ol>
        </div>

        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-obligon-lime/30 px-4 py-2 text-sm font-extrabold text-obligon-navy">
          <AlertTriangle size={15} className="text-obligon-green" />
          Verification takes {eta}
        </p>

        <p className="mt-3 text-xs text-obligon-text">
          We will notify you the moment your card status changes. You can track this request any time from
          your Card page.
        </p>

        <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white">
          Done
        </button>
      </div>
    </ModalFrame>
  );
}

/**
 * Real progress through a card request.
 *
 * Replaces a dialog that listed the three things that happen next, which read
 * identically whether the request was unpaid, mid-verification, rejected or
 * already holding an active card. Each state comes from the server, so the
 * tracker cannot disagree with the record, and a request that will not progress
 * says so instead of spinning forever.
 */
export function CardVerificationProgressModal({
  progress,
  loading,
  onClose
}: {
  progress: CardRequestProgress | null;
  loading: boolean;
  onClose: () => void;
}) {
  const steps = progress?.steps ?? [];
  const outcome = progress?.outcome;

  const headline: Record<string, string> = {
    complete: "Your card is ready",
    in_progress: "Verification in progress",
    awaiting_payment: "Payment required",
    rejected: "Verification unsuccessful",
    abandoned: "Request closed"
  };

  const tone: Record<string, string> = {
    complete: "bg-[#e8fbd7] text-obligon-green",
    in_progress: "bg-obligon-lime/30 text-obligon-navy",
    awaiting_payment: "bg-obligon-lime/30 text-obligon-navy",
    rejected: "bg-[#ffe8e8] text-[#c1121f]",
    abandoned: "bg-[#f1f5f0] text-obligon-text"
  };

  return (
    <ModalFrame onClose={onClose} size="wide">
      <div className="p-6 text-center sm:p-8">
        <span className={`mx-auto grid size-16 place-items-center rounded-full ${tone[outcome ?? "in_progress"]}`}>
          {outcome === "complete" ? (
            <ShieldCheck size={30} />
          ) : outcome === "rejected" || outcome === "abandoned" ? (
            <X size={30} />
          ) : (
            <Loader2 size={28} className="animate-spin" />
          )}
        </span>

        <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">
          {loading ? "Loading status…" : (headline[outcome ?? "in_progress"] ?? "Verification status")}
        </h2>
        {progress?.planName ? (
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-obligon-text">
            {progress.planName} plan{progress.planAmountLabel ? ` · ${progress.planAmountLabel}` : ""}
          </p>
        ) : null}

        {!loading && steps.length > 0 ? (
          <>
            <div className="mt-6">
              <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-[0.8px] text-obligon-text">
                <span>Progress</span>
                <span>
                  {progress?.completedSteps} of {progress?.totalSteps} complete
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#dce5da]">
                <span
                  className={`block h-full rounded-full transition-all ${outcome === "rejected" || outcome === "abandoned" ? "bg-[#b51f24]" : "bg-obligon-green"}`}
                  style={{ width: `${Math.max(0, Math.min(100, progress?.progressPercent ?? 0))}%` }}
                />
              </div>
            </div>

            <ol className="mt-7 space-y-1 text-left">
              {steps.map((step, index) => (
                <li key={step.key} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <StepIcon state={step.state} />
                    {index < steps.length - 1 ? (
                      <span
                        className={`my-1 w-0.5 flex-1 ${step.state === "done" ? "bg-obligon-green/40" : "bg-[#e0e7de]"}`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  <div className={`pb-5 ${index === steps.length - 1 ? "pb-0" : ""}`}>
                    <p
                      className={`text-sm font-extrabold ${
                        step.state === "failed"
                          ? "text-[#c1121f]"
                          : step.state === "done"
                            ? "text-obligon-navy"
                            : step.state === "active"
                              ? "text-obligon-green"
                              : "text-obligon-text"
                      }`}
                    >
                      {step.label}
                      {step.state === "active" ? <span className="sr-only"> (in progress)</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-obligon-text">{step.description}</p>
                    {step.eta ? (
                      <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-obligon-lime/30 px-2.5 py-1 text-[11px] font-extrabold text-obligon-navy">
                        <Clock size={12} />
                        {step.eta}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>

            {progress?.nextAction ? (
              <p className="mt-6 rounded-xl bg-[#f7fbf8] px-4 py-3 text-sm font-bold text-obligon-navy">{progress.nextAction}</p>
            ) : null}

            {progress?.card ? (
              <div className="mt-5 rounded-2xl border border-obligon-navy/10 bg-[#f7f9f8] p-5 text-left">
                <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[1.1px] text-obligon-green">
                  <CreditCard size={14} /> Your card
                </p>
                <p className="mt-2 font-mono text-sm font-extrabold text-obligon-navy">{progress.card.maskedPan}</p>
                <p className="mt-1 text-xs text-obligon-text">
                  {progress.card.label} · expires {progress.card.expiry} · {progress.card.status}
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        <button type="button" onClick={onClose} className="mt-7 h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white">
          Close
        </button>
      </div>
    </ModalFrame>
  );
}

/** One step's marker: a tick once done, a spinner while active, and so on. */
function StepIcon({ state }: { state: ProgressStepState }) {
  if (state === "done") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-obligon-green text-white">
        <Check size={15} strokeWidth={3} aria-hidden="true" />
        <span className="sr-only">Complete</span>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-obligon-green bg-white text-obligon-green">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        <span className="sr-only">In progress</span>
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#c1121f] text-white">
        <CircleSlash size={15} aria-hidden="true" />
        <span className="sr-only">Not completed</span>
      </span>
    );
  }
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-[#d0d8cf] bg-white text-[#9aa79b]">
      <CircleDashed size={14} aria-hidden="true" />
      <span className="sr-only">Not started</span>
    </span>
  );
}

/**
 * Offered when checkout reports that a request is already in flight.
 *
 * "You already have a plan awaiting payment" is a dead end on its own: the
 * customer cannot start the plan they just clicked, and nothing tells them what
 * to do instead. This hands back the two real choices — finish the payment that
 * was started, or cancel it and start fresh.
 */
export function PendingPaymentModal({
  request,
  reference,
  attemptedPlanName,
  resuming,
  cancelling,
  onResume,
  onCancel,
  onClose
}: {
  request: CardRequest;
  reference: string;
  attemptedPlanName: string | null;
  resuming: boolean;
  cancelling: boolean;
  onResume: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const busy = resuming || cancelling;
  const isSamePlan = attemptedPlanName && request.planName
    ? attemptedPlanName.toLowerCase() === request.planName.toLowerCase()
    : true;

  return (
    <ModalFrame onClose={busy ? () => undefined : onClose}>
      <div className="p-6 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-obligon-lime/30 text-obligon-navy">
          <CreditCard size={28} />
        </span>

        <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">
          You have a plan awaiting payment
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-obligon-text">
          {isSamePlan
            ? "This plan is already started. Continue to payment to finish it, or cancel it and start again."
            : `You already started the ${request.planName ?? "previous"} plan. Continue that payment, or cancel it to switch to ${attemptedPlanName}.`}
        </p>

        <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-obligon-navy/10 bg-[#f7f9f8] p-5 text-left">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold text-obligon-navy">{request.planName ?? "Plan"}</span>
            <span className="text-lg font-extrabold text-obligon-green">
              {request.planAmountLabel ?? "—"}
            </span>
          </div>
          <p className="mt-2 text-xs text-obligon-text">
            Reference <span className="font-mono font-bold text-obligon-navy">{reference}</span>
          </p>
        </div>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            disabled={busy}
            className="h-12 w-full rounded-lg bg-obligon-green font-extrabold text-white disabled:opacity-60"
          >
            {resuming ? "Opening payment…" : "Continue to payment"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-12 w-full rounded-lg border border-obligon-navy/20 font-extrabold text-obligon-navy disabled:opacity-60"
          >
            {cancelling ? "Cancelling…" : "Cancel this request"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-10 w-full text-sm font-bold text-obligon-text underline-offset-2 hover:underline disabled:opacity-60"
          >
            Decide later
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-obligon-text">
          No money has been taken yet. Cancelling costs nothing.
        </p>
      </div>
    </ModalFrame>
  );
}
