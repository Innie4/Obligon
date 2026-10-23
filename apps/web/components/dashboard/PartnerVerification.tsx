"use client";

import { StatusPopup } from "@/components/shared/StatusPopup";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Mail,
  Phone,
  ShieldCheck,
  Store
} from "lucide-react";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";
import { useSession } from "@/components/shared/AuthContext";
import { authApi, type VerificationChannelResult } from "@/lib/services";

/**
 * Partner account verification.
 *
 * Structurally the same page as the signup verification step — same field, same
 * countdown, same per-channel state — because a partner verifying their contact
 * details is doing the same thing as a customer and should not have to learn a
 * second interface for it. What differs is where it lives and where it returns:
 * this sits inside the partner console, sends a code to the partner's own work
 * email and number, and goes back to the dashboard rather than to a customer's
 * home.
 *
 * The two codes stay separate values. Sending one code to both channels would mean
 * an intercepted text message could claim an email address, which is precisely the
 * claim the email code exists to support.
 */

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

type Stage = "input" | "verifying" | "success" | "failed";

/** Masks an address for display without hiding which one it is. */
function maskEmail(email: string) {
  if (!email) return "your email address";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"*".repeat(Math.max(3, local.length - head.length))}@${domain}`;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone || "your phone number";
  return `••• ••• ${digits.slice(-4)}`;
}

export function PartnerVerificationUI() {
  const router = useRouter();
  const { user, status: sessionStatus, refresh: refreshSession } = useSession();
  const businessLabel = user?.partnerType === "mechanic" || user?.role === "mechanic"
    ? "workshop"
    : user?.partnerType === "other" ? "partner" : "station";
  const { success: toastSuccess, error: toastError } = useToast();

  // From the session, never the URL. Contact details as `?contact=` query
  // parameters would land an email address and a phone number in browser history,
  // referrer headers and every proxy log on the way.
  const contactEmail = user?.email ?? "";
  const contactPhone = user?.phone ?? "";

  const [code, setCode] = React.useState("");
  const [stage, setStage] = React.useState<Stage>("input");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [sendingCode, setSendingCode] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [channels, setChannels] = React.useState<{
    email?: VerificationChannelResult;
    phone?: VerificationChannelResult;
  }>({});
  const sendInFlight = React.useRef(false);
  const autoSendAccount = React.useRef<string | null>(null);
  const redirectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (redirectTimer.current !== null) clearTimeout(redirectTimer.current); }, []);
  const [optionalContact, setOptionalContact] = React.useState(false);
  const [selectedChannel, setSelectedChannel] = React.useState<"email" | "phone">(user?.emailVerified ? "phone" : "email");
  const emailVerified = user?.emailVerified === true || channels.email?.alreadyVerified === true;
  const phoneVerified = user?.phoneVerified === true || channels.phone?.alreadyVerified === true;
  const accountVerified = emailVerified || phoneVerified || user?.accountVerified === true;
  const canRequestCode = sessionStatus === "authenticated" && (!accountVerified || optionalContact) && (
    (Boolean(contactEmail.trim()) && !emailVerified) || (Boolean(contactPhone.trim()) && !phoneVerified)
  );

  const busy = stage === "verifying";
  const ready = code.length === CODE_LENGTH && !busy && !(selectedChannel === "email" ? emailVerified : phoneVerified);

  const chooseChannel = (channel: "email" | "phone") => {
    if (busy || channel === selectedChannel) return;
    setSelectedChannel(channel);
    setCode("");
    setError(null);
    if (stage === "failed") setStage("input");
  };
  React.useEffect(() => {
    if (emailVerified !== phoneVerified) {
      setSelectedChannel(emailVerified ? "phone" : "email");
      setCode("");
      setError(null);
    }
  }, [emailVerified, phoneVerified]);

  // One interval, cleared on every re-run and on unmount. Two were used to exist:
  // one here and one implied by the resend button, so the count could drift from
  // what the server would actually accept.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const applyResult = React.useCallback(
    (result: { channels?: { email?: VerificationChannelResult; phone?: VerificationChannelResult } }) => {
      setChannels(result.channels ?? {});
      if ((result.channels?.email?.alreadyVerified && result.channels?.phone?.alreadyVerified) || ((result.channels?.email?.alreadyVerified || result.channels?.phone?.alreadyVerified) && !optionalContact)) {
        setOptionalContact(false);
        setStage("success");
        setCooldown(0);
        return "Your account verification is complete.";
      }
      const outcomes = [
        { label: "email", result: result.channels?.email },
        { label: "SMS", result: result.channels?.phone }
      ];
      const sent = outcomes.filter(({ result }) => result?.sent === true).map(({ label }) => label);
      const failed = outcomes
        .filter(({ result }) => result?.sent === false && !result.alreadyVerified)
        .map(({ label, result }) => `${label}: ${result?.reason ?? "the code could not be delivered"}`);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      if (sent.length === 0) {
        setError(`We could not send a verification code. ${failed.join(". ") || "Please try again in a moment."}`);
        return null;
      }
      if (failed.length) setNotice(failed.join(". "));
      return `A new code was sent by ${sent.join(" and ")}.`;
    },
    [optionalContact]
  );

  const sendCodes = React.useCallback(async () => {
    if (!canRequestCode || sendInFlight.current) return;
    sendInFlight.current = true;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      applyResult(await authApi.verifySendBoth());
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send a verification code.");
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  }, [applyResult, canRequestCode]);

  // Sent on arrival. A partner arriving here mid-verification was sent here by
  // something that asked them to be verified; making them press Send to receive a
  // code that was already on its way is a step that exists only here.
  React.useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    if (accountVerified && !optionalContact) {
      autoSendAccount.current = user?.id ?? contactEmail;
      setStage("success");
      return;
    }
    if (!canRequestCode) return;
    const account = user?.id ?? contactEmail;
    // Session refreshes update verified flags after a code is accepted. Sending
    // again then would invalidate the code already delivered to the other contact.
    if (autoSendAccount.current === account) return;
    autoSendAccount.current = account;
    void sendCodes();
  }, [sendCodes, sessionStatus, canRequestCode, user?.id, contactEmail, accountVerified, optionalContact]);

  const resend = async () => {
    if (!canRequestCode || cooldown > 0 || sending || sendingCode || sendInFlight.current) return;
    sendInFlight.current = true;
    setSendingCode(true);
    setError(null);
    setNotice(null);
    // A replacement request consumes earlier codes even if delivery fails.
    setChannels((current) => ({
      email: current.email?.alreadyVerified ? current.email : undefined,
      phone: current.phone?.alreadyVerified ? current.phone : undefined
    }));
    try {
      const message = applyResult(await authApi.verifySendBoth());
      if (message) toastSuccess(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not resend the code.";
      setError(message);
      toastError(message);
    } finally {
      sendInFlight.current = false;
      setSendingCode(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setStage("verifying");
    setError(null);
    try {
      const result = await authApi.verifyConfirmEither(code, selectedChannel);
      setChannels(current => ({
        ...current,
        email: { sent: false, ...current.email, alreadyVerified: emailVerified || result.emailVerified },
        phone: { sent: false, ...current.phone, alreadyVerified: phoneVerified || result.phoneVerified }
      }));
      // The session carries the verified flags the rest of the console reads, so it
      // is refreshed before navigating. A failure here must not block a verification
      // that the server already accepted.
      await refreshSession().catch(() => undefined);
      setStage("success");
      if (result.accountVerified || emailVerified || phoneVerified || result.emailVerified || result.phoneVerified) {
        setOptionalContact(false);
        toastSuccess("Your partner account is verified.");
        redirectTimer.current = setTimeout(() => router.push(routes.dashboard), 1200);
      } else {
        toastSuccess("The code was accepted.");
        setNotice(
          `Your ${(result.remaining ?? []).join(" and ")} is still unverified. Enter its code to continue.`
        );
        setStage("input");
        setCode("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code is not correct.");
      setStage("failed");
    }
  };

  const onCodeChange = (value: string) => {
    // Digits only, and a pasted code with a space in it ("123 456") is a normal
    // thing to do — stripping non-digits handles it.
    setCode(value.replace(/\D/g, "").slice(0, CODE_LENGTH));
    if (stage === "failed") setStage("input");
    if (error) setError(null);
  };

  const missingPhone = sessionStatus === "authenticated" && !contactPhone.trim() && !accountVerified;
  const sentChannels = [channels.email?.sent === true ? "email" : null, channels.phone?.sent === true ? "SMS" : null].filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-[440px] px-5 py-10 sm:py-16">
      {(sending || sendingCode || busy) ? <StatusPopup tone="pending" message={busy ? "Verifying your code…" : "Sending verification codes…"} /> : null}
      {/* Top left. At the bottom of the card it sat below the form, so someone who
          mistyped a code had to scroll past their own mistake to leave. */}
      <Link
        href={routes.dashboard}
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[1.2px] text-obligon-green hover:underline"
      >
        <ArrowLeft size={15} />
        Back to Dashboard
      </Link>

      <div className="mt-8 grid size-16 place-items-center rounded-full bg-obligon-green/10 text-obligon-green">
        <ShieldCheck size={32} />
      </div>

      <h1 className="mt-6 text-center font-display text-2xl font-bold tracking-tight sm:text-3xl leading-10 text-obligon-navy">
        {stage === "success" ? "Verified" : `Verify your ${businessLabel} account`}
      </h1>
      <p className="mt-4 text-center text-base leading-6 text-obligon-text">
        {stage === "success"
          ? `Your ${businessLabel} account is verified.`
          : sentChannels.length
            ? `We sent a 6-digit code by ${sentChannels.join(" and ")}. Select its delivery method below.`
            : "Select the delivery method for the 6-digit code you received."}
      </p>

      <div className="mt-5 space-y-2">
        {[
          { label: "Email", Icon: Mail, detail: contactEmail.trim() ? maskEmail(contactEmail) : "No email address added", present: Boolean(contactEmail.trim()), verified: Boolean(contactEmail.trim()) && emailVerified, sent: Boolean(contactEmail.trim()) && channels.email?.sent === true },
          { label: "Phone", Icon: Phone, detail: contactPhone.trim() ? maskPhone(contactPhone) : "No phone number added", present: Boolean(contactPhone.trim()), verified: Boolean(contactPhone.trim()) && phoneVerified, sent: Boolean(contactPhone.trim()) && channels.phone?.sent === true }
        ].map(({ label, Icon, detail, present, verified, sent }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border border-obligon-border bg-obligon-mist/60 px-4 py-3"
          >
            <Icon size={17} className="shrink-0 text-obligon-navy" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase text-obligon-text">{label}</p>
              <p className="truncate text-sm font-bold text-obligon-navy">{detail}</p>
            </div>
            {verified || sent ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-obligon-lime/30 px-2.5 py-1 text-xs font-extrabold text-obligon-navy">
                <Check size={12} /> {verified ? "Verified" : "Sent"}
              </span>
            ) : (
              <span className="rounded-full bg-[#fff3d8] px-2.5 py-1 text-xs font-extrabold text-[#9a6300]">
                {present ? "Not sent" : "Not added"}
              </span>
            )}
          </div>
        ))}
      </div>

      {missingPhone ? (
        <p className="mt-5 rounded-lg border border-obligon-border bg-[#fff3d8] p-3 text-sm text-[#9a6300]" role="status">
          No phone number is saved for this account. You can verify by email, or{" "}
          <Link href={routes.support} className="font-bold underline">contact support</Link>.
        </p>
      ) : null}

      {notice && !error ? (
        <StatusPopup tone="info" message={notice} />
      ) : null}

      {error ? (
        <StatusPopup tone="error" message={error} />
      ) : null}

      {stage === "success" ? (
        <div className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-obligon-lime/20 p-4 text-sm font-extrabold text-obligon-navy">
          <Check size={18} />
          Account verification complete. Use Back to Dashboard to continue.
        </div>
      ) : canRequestCode ? (
        <form onSubmit={verify} className="mt-8">
          <fieldset disabled={busy} className="mb-6">
            <legend className="text-xs font-semibold uppercase text-obligon-text">Code delivery method</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {([
                { channel: "email", label: "Email code", verified: emailVerified },
                { channel: "phone", label: "SMS code", verified: phoneVerified }
              ] as const).map(({ channel, label, verified }) => (
                <label key={channel} className={`flex min-h-12 items-center gap-2 rounded-xl border border-obligon-border bg-white px-3 py-2 text-sm font-bold text-obligon-navy focus-within:ring-2 focus-within:ring-obligon-green focus-within:ring-offset-2 ${verified ? "opacity-60" : ""}`}>
                  <input type="radio" name="partner-verification-channel" value={channel} checked={selectedChannel === channel} disabled={verified} onChange={() => chooseChannel(channel)} className="size-4 accent-obligon-green" />
                  <span>{label}{verified ? " (verified)" : ""}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="partner-otp-code" className="block text-sm font-semibold text-obligon-text">
            6-digit {selectedChannel === "email" ? "email" : "SMS"} code
          </label>
          <input
            id="partner-otp-code"
            // type=tel rather than type=text: paired with inputMode=numeric this puts
            // the numeric keypad on a phone, which is where most of these codes are
            // read. type=number silently drops a leading zero, and a code may
            // legitimately start with one.
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            onChange={(e) => onCodeChange(e.target.value)}
            value={code}
            disabled={busy}
            maxLength={CODE_LENGTH}
            placeholder="000000"
            aria-describedby="partner-otp-help"
            aria-invalid={stage === "failed"}
            className="mt-2 h-16 w-full rounded-xl border border-obligon-border bg-white px-4 text-center font-mono text-3xl font-extrabold tracking-[0.5em] text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 disabled:opacity-60"
          />
          <p id="partner-otp-help" className="mt-2 text-center text-xs font-semibold text-obligon-text">
            {code.length < CODE_LENGTH
              ? `${CODE_LENGTH - code.length} digit${CODE_LENGTH - code.length === 1 ? "" : "s"} to go`
              : busy ? "Verifying…" : "Ready to verify."}
          </p>
          <button
            type="submit"
            disabled={!ready}
            className="mt-5 h-12 w-full rounded-xl bg-obligon-green font-extrabold text-white shadow-none transition hover:bg-obligon-green/90 disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify account"}
          </button>
        </form>
      ) : null}

      <div className="mt-6 flex items-center justify-between text-sm">
        {stage === "success" && ((!emailVerified && Boolean(contactEmail.trim())) || (!phoneVerified && Boolean(contactPhone.trim()))) ? <button type="button" onClick={() => { if (redirectTimer.current !== null) clearTimeout(redirectTimer.current); autoSendAccount.current = null; setOptionalContact(true); setStage("input"); setCode(""); setError(null); setNotice("Your account is already verified. Verifying your other contact is optional."); }} className="min-h-12 font-bold text-obligon-green underline focus-visible:ring-2 focus-visible:ring-obligon-green">Verify remaining contact</button> :
        <button
          type="button"
          onClick={() => void resend()}
          disabled={!canRequestCode || stage === "success" || cooldown > 0 || sending || sendingCode}
          className="font-bold text-obligon-green hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
        }
        <Link href={routes.support} className="font-bold text-obligon-text hover:underline">
          Having trouble?
        </Link>
      </div>

      {/*
        Why this matters for a partner specifically. A partner's contact details are
        what makes their stations trustworthy to a fleet: a fleet deciding where to
        fuel needs to know the operator is reachable. Stated here rather than left as
        an unexplained form.
      */}
      <p className="mt-8 flex items-start gap-2 rounded-xl border border-obligon-border bg-obligon-mist/60 p-4 text-xs font-medium leading-5 text-obligon-text">
        <Store size={16} className="mt-0.5 shrink-0 text-obligon-green" />
        <span>
          Verifying confirms we can reach you at these contact details.
        </span>
      </p>
    </div>
  );
}
