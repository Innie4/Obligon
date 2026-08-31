"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, ArrowLeft, ShieldCheck, Smartphone, QrCode, Key, Copy, Check, AlertCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";
import { Input } from "@/components/site/Input";

type MFAStage = "setup" | "verify" | "backup" | "complete" | "challenge";

interface MFAUIProps {
  stage?: MFAStage;
  redirect?: string;
}

export function MFASetupUI({ stage = "setup", redirect = "/dashboard" }: MFAUIProps) {
  const router = useRouter();
  const { error: toastError, success: toastSuccess } = useToast();

  const [currentStage, setCurrentStage] = React.useState<MFAStage>(stage);
  const [totpCode, setTotpCode] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const qrCodeDataUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmMWYxIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+UVIgQ29kZSBQbGFjZWhvbGRlcjwvdGV4dD48L3N2Zz4=";
  const secretKey = "JBSWY3DPEHPK3PXP";

  const handleVerifyTOTP = async () => {
    if (!/^\d{6}$/.test(totpCode)) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setBackupCodes([
        "A1B2-C3D4", "E5F6-G7H8", "I9J0-K1L2",
        "M3N4-O5P6", "Q7R8-S9T0", "U1V2-W3X4",
        "Y5Z6-A7B8", "C9D0-E1F2", "G3H4-I5J6",
        "K7L8-M9N0",
      ]);
      setCurrentStage("backup");
    } catch (err) {
      setError("Invalid code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    toastSuccess("Two-factor authentication enabled!");
    router.push("/dashboard");
  };

  const handleChallenge = async () => {
    setSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push("/dashboard");
    } catch {
      setError("Invalid code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell compact>
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
              Add an extra layer of security. Scan the QR code with Google Authenticator, Authy, or similar.
            </p>

            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="rounded-xl border border-obligon-border bg-white p-6">
                <img src={qrCodeDataUrl} alt="QR Code for TOTP setup" className="mx-auto w-48 h-48" />
                <p className="mt-4 text-center text-sm font-bold text-obligon-navy">{secretKey}</p>
                <p className="mt-2 text-center text-xs text-obligon-text">Enter this key manually if QR scan fails</p>
              </div>
              <div className="rounded-xl border border-obligon-border bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[1.1px] text-obligon-text">Setup Instructions</p>
                <ol className="mt-3 space-y-2 text-sm text-obligon-text list-decimal list-inside">
                  <li>Open Google Authenticator, Authy, or Microsoft Authenticator</li>
                  <li>Tap "+" to add a new account</li>
                  <li>Scan the QR code above or enter the secret key manually</li>
                  <li>Enter the 6-digit code from the app to verify</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setCurrentStage("verify")}
              className="mt-6 h-12 w-full rounded-lg bg-obligon-green text-base font-bold text-white shadow-green"
            >
              Continue
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
              <div className="flex gap-3">
                {[...Array(6)].map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength={1}
                    className="h-14 w-12 text-center text-2xl font-bold rounded-lg border-obligon-border bg-white focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                    autoComplete="one-time-code"
                    disabled={submitting}
                    autoFocus
                  />
                ))}
              </div>
              <button type="submit" className="h-12 w-full rounded-lg bg-obligon-green text-base font-bold text-white shadow-green" disabled={submitting}>
                Verify & Continue
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
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-lg border border-obligon-border bg-white">
                    <code className="font-mono text-sm font-bold text-obligon-navy flex-1">
                      {i < 9 ? `0${i + 1}` : i + 1}.{" "}
                      <span className="font-mono text-sm font-bold text-obligon-green">
                        {i < 5 ? "A1B2-C3D4" : "E5F6-G7H8"}
                      </span>
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`A1B2-C3D4-${i}`);
                      }}
                      className="p-2 rounded-lg border border-obligon-border hover:bg-obligon-mist"
                      aria-label="Copy code"
                    >
                      <Copy size={16} />
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
            <form onSubmit={(e) => { e.preventDefault(); if (totpCode.length === 6) handleChallenge(); }} className="mt-6 space-y-4">
              <div className="flex gap-3">
                {[...Array(6)].map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength={1}
                    className="h-14 w-12 text-center text-2xl font-bold rounded-lg border-obligon-border bg-white focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
                    autoComplete="one-time-code"
                    disabled={submitting}
                    autoFocus
                  />
                ))}
              </div>
              <button type="submit" className="h-12 w-full rounded-lg bg-obligon-green text-base font-bold text-white shadow-green" disabled={submitting}>
                Verify & Continue
              </button>
            </form>
          </div>
        )}
        <Link
          href={routes.login}
          className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[1.2px] text-obligon-green"
        >
          <ArrowLeft size={16} />
          Back to Login
        </Link>
      </div>
    </AuthShell>
  );
}