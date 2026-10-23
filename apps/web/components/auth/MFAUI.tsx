"use client";

import { StatusPopup } from "@/components/shared/StatusPopup";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, ArrowLeft, ShieldCheck, Smartphone, QrCode, Key, Copy, Check, AlertCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";
import { authApi } from "@/lib/services";
import { authReturnPath } from "@/lib/company-invitation-routing";
import { useSession } from "@/components/shared/AuthContext";

/** Six-box controlled TOTP input bound to a single 6-digit state value. */
function TotpInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-6 gap-0.5 sm:flex sm:gap-3">
      {[...Array(6)].map((_, i) => (
        <input
          key={i}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, "").slice(-1);
            const next = (value.slice(0, i) + digit + value.slice(i + 1)).slice(0, 6);
            onChange(next);
            if (digit && e.target.parentElement) {
              const boxes = e.target.parentElement.querySelectorAll("input");
              (boxes[i + 1] as HTMLInputElement | undefined)?.focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) {
              const boxes = (e.target as HTMLInputElement).parentElement?.querySelectorAll("input");
              (boxes?.[i - 1] as HTMLInputElement | undefined)?.focus();
            }
          }}
          className="h-14 w-full min-w-0 text-center text-2xl font-bold rounded-lg border-obligon-border bg-white focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20 sm:w-12"
          autoComplete="one-time-code"
          disabled={disabled}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

type MFAStage = "setup" | "verify" | "backup" | "complete" | "challenge";

interface MFAUIProps {
  stage?: MFAStage;
  redirect?: string;
}

export function MFASetupUI({ stage = "setup", redirect }: MFAUIProps) {
  const router = useRouter();
  const [returnPath, setReturnPath] = React.useState<string | null>(null);
  React.useEffect(() => { setReturnPath(authReturnPath(window.location.search)); }, []);
  const { success: toastSuccess } = useToast();
  const { user, setUser } = useSession();

  const [currentStage, setCurrentStage] = React.useState<MFAStage>(stage);
  const [totpCode, setTotpCode] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState<string | null>(null);
  const [secretKey, setSecretKey] = React.useState("");
  const [challengeAvailable, setChallengeAvailable] = React.useState(false);
  const [useBackupCode, setUseBackupCode] = React.useState(false);
  const active = React.useRef(true);
  React.useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const dashboardForRole = (role?: string) => role === "admin" ? routes.adminDashboard : role === "company" ? routes.companyDashboard : role === "partner" || role === "mechanic" ? "/dashboard" : routes.customerDashboard;

  // Setup stage: fetch the real TOTP secret + QR from the API
  React.useEffect(() => {
    if (stage !== "setup") {
      if (stage === "challenge") {
        const available = Boolean(authApi.pendingMfaChallenge());
        setChallengeAvailable(available);
        if (!available) setError("Your sign-in challenge is missing or expired. Sign in with your password again.");
      }
      return;
    }
    let active = true;
    (async () => {
      try {
        const setup = await authApi.mfaSetup();
        if (!active) return;
        setQrCodeDataUrl(setup.qrDataUrl);
        setSecretKey(setup.secret);
      } catch (err) {
        if (!active) return;
        setQrCodeDataUrl(null);
        setSecretKey("");
        setError(err instanceof Error ? err.message : "Authenticator setup is unavailable. Please try again later.");
      }
    })();
    return () => {
      active = false;
    };
  }, [stage]);

  const handleVerifyTOTP = async () => {
    if (!/^\d{6}$/.test(totpCode)) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setSubmitting(true);
    setError(null);
    const revision = authApi.sessionRevision();
    try {
      const result = await authApi.mfaEnable(totpCode);
      if (!active.current || !authApi.isCurrentAuthResult(result)) return;
      if (result?.backupCodes) setBackupCodes(result.backupCodes);
      if (user) setUser({ ...user, twoFactorEnabled: true });
      setCurrentStage("backup");
    } catch (err) {
      if (!active.current || revision !== authApi.sessionRevision()) return;
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      if (active.current && revision === authApi.sessionRevision()) setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      toastSuccess("Two-factor authentication enabled!");
      router.push(user ? dashboardForRole(user.role) : redirect ?? routes.login);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChallenge = async () => {
    if (!(useBackupCode ? /^[a-f0-9]{4}-?[a-f0-9]{4}$/i : /^\d{6}$/).test(totpCode.trim())) {
      setError(useBackupCode ? "Enter one of your saved backup codes" : "Enter the 6-digit code from your authenticator app");
      return;
    }
    setSubmitting(true);
    setError(null);
    const revision = authApi.sessionRevision();
    const backup = totpCode.trim().replace("-", "").toUpperCase();
    try {
      const result = await authApi.mfaChallenge({ totp: useBackupCode ? `${backup.slice(0, 4)}-${backup.slice(4)}` : totpCode });
      if (!active.current || !authApi.isCurrentAuthResult(result)) return;
      setUser(result.user);
      router.push(returnPath ?? dashboardForRole(result.user.role));
    } catch (err) {
      if (!active.current || revision !== authApi.sessionRevision()) return;
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      if (active.current && revision === authApi.sessionRevision()) setSubmitting(false);
    }
  };

  return (
    <AuthShell compact>
      {submitting || (currentStage === "setup" && !qrCodeDataUrl && !error) ? <StatusPopup tone={submitting ? "pending" : "loading"} message={submitting ? "Verifying your authenticator…" : "Preparing your authenticator setup…"} /> : null}
      {error ? <StatusPopup tone="error" message={error} /> : null}
      <div className="w-full max-w-[440px] mx-auto">
        {currentStage === "setup" && (
          <div>
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-obligon-green/[0.1] text-obligon-green">
              <ShieldCheck size={32} />
            </div>
            <h1 className="mt-8 text-center font-display text-3xl font-extrabold leading-10 text-obligon-navy">
              Enable Two-Factor Authentication
            </h1>
            <p className="mt-4 text-center text-base leading-6 text-obligon-text">
              {qrCodeDataUrl
                ? "Scan the QR code with your authenticator app."
                : error
                  ? "Return to sign in to start setup again."
                  : "Add an authenticator app to protect your account."}
            </p>

            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="rounded-xl border border-obligon-border bg-white p-6">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="QR Code for TOTP setup" className="mx-auto w-48 h-48" />
                ) : null}
                {secretKey ? <>
                  <p className="mt-4 text-center text-sm font-bold text-obligon-navy">{secretKey}</p>
                  <p className="mt-2 text-center text-xs text-obligon-text">Enter this key manually if QR scan fails</p>
                </> : null}
              </div>
              {qrCodeDataUrl ? <div className="rounded-xl border border-obligon-border bg-white p-4">
                <p className="text-xs font-bold text-obligon-text">Setup Instructions</p>
                <ol className="mt-3 space-y-2 text-sm text-obligon-text list-decimal list-inside">
                  <li>Open Google Authenticator, Authy, or Microsoft Authenticator</li>
                  <li>Tap &quot;+&quot; to add a new account</li>
                  <li>Scan the QR code above or enter the secret key manually</li>
                  <li>Enter the 6-digit code from the app to verify</li>
                </ol>
              </div> : null}
            </div>

            <button
              onClick={() => setCurrentStage("verify")}
              disabled={!qrCodeDataUrl}
              className="mt-6 h-12 w-full rounded-lg bg-obligon-green text-base font-bold text-white shadow-green disabled:opacity-60"
            >
              {qrCodeDataUrl ? "Continue" : error ? "Setup unavailable" : "Loading authenticator setup..."}
            </button>
          </div>
        )}
        {currentStage === "verify" && (
          <div>
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-obligon-green/[0.1] text-obligon-green">
              <ShieldCheck size={32} />
            </div>
            <h1 className="mt-8 text-center font-display text-3xl font-extrabold leading-10 text-obligon-navy">
              Enter Verification Code
            </h1>
            <p className="mt-4 text-center text-base leading-6 text-obligon-text">
              Open your authenticator app and enter the 6-digit code.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); if (totpCode.length === 6) handleVerifyTOTP(); }} className="mt-6 space-y-4">
              <TotpInput value={totpCode} onChange={setTotpCode} disabled={submitting} />
              <button type="submit" className="h-12 w-full rounded-lg bg-obligon-green text-base font-bold text-white shadow-green" disabled={submitting}>
                {submitting ? "Verifying..." : "Verify & Continue"}
              </button>
            </form>
          </div>
        )}
        {currentStage === "backup" && (
          <div>
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-obligon-green/[0.1] text-obligon-green">
              <ShieldCheck size={32} />
            </div>
            <h1 className="mt-8 text-center font-display text-3xl font-extrabold leading-10 text-obligon-navy">
              Save Your Backup Codes
            </h1>
            <p className="mt-4 text-center text-base leading-6 text-obligon-text">
              Store these codes safely. They can be used to access your account if you lose your authenticator app.
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(backupCodes.length ? backupCodes : Array.from({ length: 8 }, () => "•••• ••••")).map((code, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-lg border border-obligon-border bg-white">
                    <code className="font-mono text-sm font-bold text-obligon-navy flex-1">
                      {i < 9 ? `0${i + 1}` : i + 1}.{" "}
                      <span className="font-mono text-sm font-bold text-obligon-green">{code}</span>
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(code);
                        setCopiedIndex(i);
                      }}
                      className="p-2 rounded-lg border border-obligon-border hover:bg-obligon-mist"
                      aria-label="Copy code"
                    >
                      {copiedIndex === i ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleComplete}
                className="mt-6 h-12 w-full rounded-lg bg-obligon-green text-base font-bold text-white shadow-green"
                disabled={submitting}
              >
                {submitting ? "Enabling..." : "I have Saved My Codes - Enable 2FA"}
              </button>
            </div>
          </div>
        )}
        {currentStage === "complete" && (
          <div>
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-obligon-green/[0.1] text-obligon-green">
              <ShieldCheck size={32} />
            </div>
            <h1 className="mt-8 text-center font-display text-3xl font-extrabold leading-10 text-obligon-navy">
              Two-Factor Authentication Enabled
            </h1>
            <p className="mt-4 text-center text-base leading-6 text-obligon-text">
              Your account is now protected with two-factor authentication.
            </p>
            <button onClick={() => router.push("/dashboard")} className="mt-6 h-12 w-full rounded-lg bg-obligon-green text-base font-bold text-white shadow-green">
              Go to Dashboard
            </button>
          </div>
        )}
        {currentStage === "challenge" && (
          <div>
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-obligon-green/[0.1] text-obligon-green">
              <ShieldCheck size={32} />
            </div>
            <h1 className="mt-8 text-center font-display text-3xl font-extrabold leading-10 text-obligon-navy">
              Two-Factor Authentication Required
            </h1>
            <p className="mt-4 text-center text-base leading-6 text-obligon-text">
              Enter the 6-digit code from your authenticator app to continue.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); if (challengeAvailable) void handleChallenge(); }} className="mt-6 space-y-4">
              {useBackupCode ? <label className="block text-sm font-bold text-obligon-navy">
                Backup code
                <input type="text" autoComplete="off" value={totpCode} onChange={event => setTotpCode(event.target.value)} disabled={submitting || !challengeAvailable} className="mt-2 h-12 w-full rounded-lg border border-obligon-border p-3 font-mono" />
              </label> : <TotpInput value={totpCode} onChange={setTotpCode} disabled={submitting || !challengeAvailable} />}
              <button type="button" onClick={() => { setUseBackupCode(current => !current); setTotpCode(""); }} disabled={submitting || !challengeAvailable} className="min-h-11 text-sm font-bold text-obligon-green underline disabled:cursor-not-allowed disabled:opacity-50">{useBackupCode ? "Use an authenticator code" : "Use a backup code"}</button>
              <button type="submit" className="h-12 w-full rounded-lg bg-obligon-green text-base font-bold text-white shadow-green disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting || !challengeAvailable}>
                {submitting ? "Verifying..." : "Verify & Continue"}
              </button>
            </form>
          </div>
        )}
        <Link
          href={routes.login}
          className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-obligon-green"
        >
          <ArrowLeft size={16} />
          Back to Login
        </Link>
      </div>
    </AuthShell>
  );
}
