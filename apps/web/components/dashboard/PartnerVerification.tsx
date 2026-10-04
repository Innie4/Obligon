"use client";

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
  const { user, refresh: refreshSession } = useSession();
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

  const busy = stage === "verifying";
  const ready = code.length === CODE_LENGTH && !busy;

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
      const sent = [result.channels?.email?.sent, result.channels?.phone?.sent].filter(Boolean).length;
      const failed = [
        result.channels?.email?.sent === false ? "email" : null,
        result.channels?.phone?.sent === false ? "SMS" : null
      ].filter(Boolean);
      if (sent === 0) {
        setError("We could not send a verification code. Please try again in a moment.");
      } else if (failed.length) {
        // Said plainly rather than as a silent half-delivery: an operator who waits
        // for a text that was never sent has no way to know.
        setNotice(
          `We sent your code by ${failed.length === 2 ? "neither channel" : failed[0] === "email" ? "SMS" : "email"} — check your ${failed.join(" and ")}.`
        );
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
    },
    []
  );

  const sendCodes = React.useCallback(async () => {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      applyResult(await authApi.verifySendBoth());
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send a verification code.");
    } finally {
      setSending(false);
    }
  }, [applyResult]);

  // Sent on arrival. A partner arriving here mid-verification was sent here by
  // something that asked them to be verified; making them press Send to receive a
  // code that was already on its way is a step that exists only here.
  React.useEffect(() => {
    void sendCodes();
  }, [sendCodes]);

  const resend = async () => {
    if (cooldown > 0 || sendingCode) return;
    setSendingCode(true);
    setError(null);
    try {
      applyResult(await authApi.verifySendBoth());
      toastSuccess("A new code has been sent to your email and phone.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not resend the code.";
      setError(message);
      toastError(message);
    } finally {
      setSendingCode(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setStage("verifying");
    setError(null);
    try {
      const result = await authApi.verifyConfirmEither(code);
      // The session carries the verified flags the rest of the console reads, so it
      // is refreshed before navigating. A failure here must not block a verification
      // that the server already accepted.
      await refreshSession().catch(() => undefined);
      setStage("success");
      toastSuccess("Your partner account is verified.");
      // Only redirects once every channel is verified. Otherwise this is a dead end
      // with no route back.
      if (result.allVerified) {
        setTimeout(() => router.push(routes.dashboard), 1200);
      } else {
        setError(
          `Your ${(result.remaining ?? []).join(" and ")} is still unverified. Request a new code and try again.`
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

  const emailSent = channels.email?.sent === true || channels.email?.alreadyVerified === true;
  const phoneSent = channels.phone?.sent === true || channels.phone?.alreadyVerified === true;

  return (
    <div className="mx-auto w-full max-w-[440px] px-5 py-10 sm:py-16">
      {/* Top left. At the bottom of the card it sat below the form, so someone who
          mistyped a code had to scroll past their own mistake to leave. */}
      <Link
        href={routes.dashboard}
        className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[1.2px] text-obligon-green hover:underline"
      >
        <ArrowLeft size={15} />
        Back to Dashboard
      </Link>

      <div className="mt-8 grid size-16 place-items-center rounded-full bg-obligon-green/10 text-obligon-green">
        <ShieldCheck size={32} />
      </div>

      <h1 className="mt-6 text-center font-display text-3xl font-extrabold leading-10 text-obligon-navy">
        {stage === "success" ? "Verified" : "Verify your station account"}
      </h1>
      <p className="mt-4 text-center text-base leading-6 text-obligon-text">
        {stage === "success"
          ? "Your station account is verified."
          : "We sent a 6-digit code to your email and phone. Enter whichever one you receive."}
      </p>

      <div className="mt-5 space-y-2">
        {[
          { label: "Email", Icon: Mail, detail: maskEmail(contactEmail), ok: emailSent },
          { label: "Phone", Icon: Phone, detail: maskPhone(contactPhone), ok: phoneSent }
        ].map(({ label, Icon, detail, ok }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border border-obligon-border bg-[#f7fbf8] px-4 py-3"
          >
            <Icon size={17} className="shrink-0 text-obligon-navy" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase text-obligon-text">{label}</p>
              <p className="truncate text-sm font-bold text-obligon-navy">{detail}</p>
            </div>
            {ok ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-obligon-lime/30 px-2.5 py-1 text-[11px] font-extrabold text-obligon-navy">
                <Check size={12} /> Sent
              </span>
            ) : (
              <span className="rounded-full bg-[#fff3d8] px-2.5 py-1 text-[11px] font-extrabold text-[#9a6300]">
                Not sent
              </span>
            )}
          </div>
        ))}
      </div>

      {sending ? (
        <p className="mt-5 text-center text-sm font-semibold text-obligon-text">Sending your code…</p>
      ) : null}

      {notice && !error ? (
        <p className="mt-5 rounded-lg border border-obligon-border bg-[#fff3d8] p-3 text-sm text-[#9a6300]" role="status">
          {notice}
        </p>
      ) : null}

      {error ? (
        <div
          className="mt-5 flex items-start gap-2 rounded-lg border border-[#fecaca] bg-[#fff0f0] p-3 text-sm text-[#93000a]"
          role="alert"
        >
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {stage === "success" ? (
        <div className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-obligon-lime/20 p-4 text-sm font-extrabold text-obligon-navy">
          <Check size={18} />
          Code accepted — returning to your dashboard
        </div>
      ) : (
        <form onSubmit={verify} className="mt-8">
          <label htmlFor="partner-otp-code" className="block text-xs font-extrabold uppercase text-obligon-text">
            6-digit code
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
              : "Verifying…"}
          </p>
          <button
            type="submit"
            disabled={!ready}
            className="mt-5 h-12 w-full rounded-xl bg-obligon-green font-extrabold text-white shadow-green transition hover:bg-obligon-green/90 disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify station account"}
          </button>
        </form>
      )}

      <div className="mt-6 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => void resend()}
          disabled={cooldown > 0 || sendingCode}
          className="font-bold text-obligon-green hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
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
      <p className="mt-8 flex items-start gap-2 rounded-xl border border-obligon-border bg-[#f7fbf8] p-4 text-xs font-medium leading-5 text-obligon-text">
        <Store size={16} className="mt-0.5 shrink-0 text-obligon-green" />
        <span>
          Verifying confirms your station operator can be reached at these details.
          Fleets use it to decide where to fuel.
        </span>
      </p>
    </div>
  );
}