"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Mail, Phone, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";
import { useSession } from "@/components/shared/AuthContext";
import { authReturnPath } from "@/lib/company-invitation-routing";
import { authApi, type VerificationChannelResult } from "@/lib/services";

/** Six digits, as a numeric input. Length is a server concern; see CODE_LENGTH. */
const CODE_LENGTH = 6;

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

/** Verify email and phone separately, using the selected delivery channel. */
export function VerificationUI() {
  const router = useRouter();
  const [returnPath, setReturnPath] = React.useState<string | null>(null);
  const [returnPathReady, setReturnPathReady] = React.useState(false);
  React.useEffect(() => { setReturnPath(authReturnPath(window.location.search)); setReturnPathReady(true); }, []);
  const { user, status: sessionStatus, refresh: refreshSession } = useSession();
  const { success: toastSuccess, error: toastError } = useToast();

  // Read from the session rather than the URL. They used to arrive as
  // `?contact=` parameters, which put an email address and a phone number into
  // browser history, referrer headers and proxy logs for no benefit.
  const contactEmail = user?.email ?? "";
  const contactPhone = user?.phone ?? "";

  const [code, setCode] = React.useState("");
  const [stage, setStage] = React.useState<Stage>("input");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [sendingCode, setSendingCode] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [channels, setChannels] = React.useState<{ email?: VerificationChannelResult; phone?: VerificationChannelResult }>({});
  const [optionalContact, setOptionalContact] = React.useState(false);
  const autoSendAccount = React.useRef<string | null>(null);
  const redirectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (redirectTimer.current !== null) clearTimeout(redirectTimer.current); }, []);
  const [selectedChannel, setSelectedChannel] = React.useState<"email" | "phone">(user?.emailVerified ? "phone" : "email");
  const emailVerified = user?.emailVerified === true || channels.email?.alreadyVerified === true;
  const phoneVerified = user?.phoneVerified === true || channels.phone?.alreadyVerified === true;
  const allVerified = emailVerified && phoneVerified;
  const accountVerified = emailVerified || phoneVerified || user?.accountVerified === true;
  const invitationRequiresEmail = returnPath?.startsWith("/auth/company-invitation?") === true;
  const verificationComplete = !optionalContact && (invitationRequiresEmail ? emailVerified : accountVerified);

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

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Send on arrival. A customer arriving here is mid-verification because
  // something asked them to be, and making them press Send first to receive a
  // code that was already on its way is a step that exists only here.
  React.useEffect(() => {
    if (!returnPathReady || sessionStatus === "loading" || !user) return;
    if (verificationComplete) {
      autoSendAccount.current = user.id;
      setStage("success");
      return;
    }
    if (autoSendAccount.current === user.id) return;
    autoSendAccount.current = user.id;
    void sendCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnPathReady, sessionStatus, user?.id, verificationComplete]);

  /** Issue a code for every channel that is not already verified, in one call. */
  const sendCodes = async () => {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await authApi.verifySendBoth();
      setChannels(result.channels ?? {});
      if ((result.channels?.email?.alreadyVerified && result.channels?.phone?.alreadyVerified) || ((invitationRequiresEmail ? result.channels?.email?.alreadyVerified : result.channels?.email?.alreadyVerified || result.channels?.phone?.alreadyVerified) && !optionalContact)) { setOptionalContact(false); setStage("success"); setNotice("Your account verification is complete."); setCooldown(0); return; }
      const sent = [result.channels?.email?.sent, result.channels?.phone?.sent].filter(Boolean).length;
      const failed = [
        result.channels?.email?.sent === false && !result.channels?.email?.alreadyVerified ? "email" : null,
        result.channels?.phone?.sent === false && !result.channels?.phone?.alreadyVerified ? "SMS" : null
      ].filter(Boolean);
      if (sent === 0) {
        setError("We could not send a verification code. Please try again in a moment.");
      } else if (failed.length) {
        // Said plainly rather than as a silent half-delivery: a customer who
        // waits for a text that was never sent has no way to know.
        setNotice(`We sent your code by ${failed.length === 2 ? "neither channel" : failed[0] === "email" ? "SMS" : "email"}. We could not send it by ${failed.join(" or ")}. Please retry.`);
      }
      setCooldown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send a verification code.");
    } finally {
      setSending(false);
    }
  };

  const resend = async () => {
    if (stage === "success" || cooldown > 0 || sendingCode) return;
    setSendingCode(true);
    setError(null);
    try {
      const result = await authApi.verifySendBoth();
      setChannels(result.channels ?? {});
      if(result.channels?.email?.alreadyVerified&&result.channels?.phone?.alreadyVerified){setStage("success");setNotice("Your contact details are already verified.");}else toastSuccess("Delivery requested for your unverified contact details.");
      setCooldown(30);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not resend the code.";
      setError(message);
      toastError(message);
    } finally {
      setSendingCode(false);
    }
  };

  /** Confirm only the channel the user selected. */
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
      await refreshSession().catch(() => undefined);
      setStage("success");
      const emailComplete = emailVerified || result.emailVerified;
      const accountComplete = result.accountVerified || emailComplete || phoneVerified || result.phoneVerified;
      if (invitationRequiresEmail ? emailComplete : accountComplete) {
        setOptionalContact(false);
        const plan=sessionStorage.getItem("obligon_selected_plan");
        const destination=user?.role==='company'?routes.companyDashboard:user?.role==='partner'||user?.role==='mechanic'?'/dashboard/billing':plan?`/customer/card?chosenPlan=${encodeURIComponent(plan)}`:routes.customerDashboard;
        redirectTimer.current = setTimeout(() => router.push(returnPath ?? destination),1200);
      } else {
        setStage("input"); setCode(""); setNotice("Your account is verified. Verify your email address to accept this company invitation.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code is not correct.");
      setStage("failed");
    }
  };

  const onCodeChange = (value: string) => {
    // Digits only. The field also carries inputMode and type below, so this is
    // belt and braces — but a pasted code with a space in it ("123 456") is a
    // normal thing to do, and stripping non-digits handles it.
    setCode(value.replace(/\D/g, "").slice(0, CODE_LENGTH));
    if (stage === "failed") setStage("input");
    if (error) setError(null);
  };

  const sentChannels = [channels.email?.sent === true ? "email" : null, channels.phone?.sent === true ? "SMS" : null].filter(Boolean);

  return (
    <AuthShell compact>
      <div className="mx-auto w-full max-w-[440px]">
        {/* Top left, as asked. It used to sit at the bottom of the card, below the
            form, where a customer who mistyped a code had to scroll past their own
            mistake to leave. */}
        <Link
          href={routes.login}
          className="inline-flex items-center gap-2 text-xs font-extrabold text-obligon-green hover:underline"
        >
          <ArrowLeft size={15} />
          Back to Login
        </Link>

        <div className="mt-8 grid size-16 place-items-center rounded-full bg-obligon-green/10 text-obligon-green">
          <ShieldCheck size={32} />
        </div>

        <h1 className="mt-6 text-center font-display text-3xl font-extrabold leading-10 text-obligon-navy">
          {stage === "success" ? "Account verified" : "Verify your account"}
        </h1>
        <p className="mt-4 text-center text-base leading-6 text-obligon-text">
          {stage === "success"
            ? allVerified ? "Your email and phone are verified." : emailVerified ? "Your email is verified. Account verification is complete." : phoneVerified ? "Your phone is verified. Account verification is complete." : "Account verification is complete."
            : sentChannels.length
              ? `We sent a 6-digit code by ${sentChannels.join(" and ")}. Select its delivery method below.`
              : "Select the delivery method for the 6-digit code you received."}
        </p>

        <div className="mt-5 space-y-2">
          {[
            { label: "Email", Icon: Mail, detail: maskEmail(contactEmail), verified: emailVerified, sent: channels.email?.sent === true },
            { label: "Phone", Icon: Phone, detail: maskPhone(contactPhone), verified: phoneVerified, sent: channels.phone?.sent === true }
          ].map(({ label, Icon, detail, verified, sent }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-obligon-border bg-[#f7fbf8] px-4 py-3"
            >
              <Icon size={17} className="shrink-0 text-obligon-navy" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-obligon-text">{label}</p>
                <p className="truncate text-sm font-bold text-obligon-navy">{detail}</p>
              </div>
              {verified || sent ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-obligon-lime/30 px-2.5 py-1 text-xs font-extrabold text-obligon-navy">
                  <Check size={12} /> {verified ? "Verified" : "Sent"}
                </span>
              ) : (
                <span className="rounded-full bg-[#fff3d8] px-2.5 py-1 text-xs font-extrabold text-[#9a6300]">
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
            {invitationRequiresEmail ? "Email verified. You can now join your company." : "Account verification complete"}
            <button type="button" className="min-h-12 underline" onClick={()=>{const plan=sessionStorage.getItem("obligon_selected_plan");router.push(returnPath ?? (user?.role==="company"?routes.companyDashboard:user?.role==="partner"||user?.role==="mechanic"?"/dashboard/billing":plan?`/customer/card?chosenPlan=${encodeURIComponent(plan)}`:routes.customerDashboard));}}>Continue</button>
          </div>
        ) : (
          <form onSubmit={verify} className="mt-8">
            <fieldset disabled={busy} className="mb-6">
              <legend className="text-xs font-semibold text-obligon-text">Code delivery method</legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {([
                  { channel: "email", label: "Email code", verified: emailVerified },
                  { channel: "phone", label: "SMS code", verified: phoneVerified }
                ] as const).map(({ channel, label, verified }) => (
                  <label key={channel} className={`flex min-h-12 items-center gap-2 rounded-xl border border-obligon-border bg-white px-3 py-2 text-sm font-bold text-obligon-navy focus-within:ring-2 focus-within:ring-obligon-green focus-within:ring-offset-2 ${verified ? "opacity-60" : ""}`}>
                    <input type="radio" name="verification-channel" value={channel} checked={selectedChannel === channel} disabled={verified} onChange={() => chooseChannel(channel)} className="size-4 accent-obligon-green" />
                    <span>{label}{verified ? " (verified)" : ""}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label htmlFor="otp-code" className="block text-xs font-semibold text-obligon-text">
              6-digit {selectedChannel === "email" ? "email" : "SMS"} code
            </label>
            <input
              id="otp-code"
              // type=tel rather than type=text: paired with inputMode=numeric this
              // puts the numeric keypad on a phone, which is where most of these
              // codes are read. type=number is rejected because it silently drops
              // a leading zero, and a code may legitimately start with one.
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              // Fires once the field is full. A six-digit code is complete the
              // moment the sixth digit lands, and making someone also press the
              // button is the same friction as the Send button.
              onChange={(e) => onCodeChange(e.target.value)}
              value={code}
              disabled={busy}
              maxLength={CODE_LENGTH}
              placeholder="000000"
              aria-describedby="otp-code-help"
              aria-invalid={stage === "failed"}
              className="mt-2 h-16 w-full rounded-xl border border-obligon-border bg-white px-4 text-center font-mono text-3xl font-extrabold tracking-[0.5em] text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 disabled:opacity-60"
            />
            <p id="otp-code-help" className="mt-2 text-center text-xs font-semibold text-obligon-text">
              {code.length < CODE_LENGTH
                ? `${CODE_LENGTH - code.length} digit${CODE_LENGTH - code.length === 1 ? "" : "s"} to go`
                : busy ? "Verifying…" : "Ready to verify."}
            </p>
            <button
              type="submit"
              disabled={!ready}
              className="mt-5 h-12 w-full rounded-xl bg-obligon-green font-extrabold text-white shadow-green transition hover:bg-obligon-green/90 disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify account"}
            </button>
          </form>
        )}

        {optionalContact ? <button type="button" onClick={() => { setOptionalContact(false); setStage("success"); setCode(""); setError(null); }} className="mt-4 min-h-12 w-full font-bold text-obligon-green underline focus-visible:ring-2 focus-visible:ring-obligon-green">Skip optional verification</button> : null}
        <div className="mt-6 flex items-center justify-between text-sm">
          {stage === "success" && ((!emailVerified && Boolean(contactEmail.trim())) || (!phoneVerified && Boolean(contactPhone.trim()))) ? <button type="button" onClick={() => { if (redirectTimer.current !== null) clearTimeout(redirectTimer.current); autoSendAccount.current = null; setOptionalContact(true); setStage("input"); setCode(""); setError(null); setNotice("Your account is already verified. Verifying your other contact is optional."); }} className="min-h-12 font-bold text-obligon-green underline focus-visible:ring-2 focus-visible:ring-obligon-green">Verify remaining contact</button> :
          <button
            type="button"
            onClick={() => void resend()}
            disabled={stage === "success" || cooldown > 0 || sendingCode}
            className="font-bold text-obligon-green hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
          }
          <Link href={routes.support} className="font-bold text-obligon-text hover:underline">
            Having trouble?
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
