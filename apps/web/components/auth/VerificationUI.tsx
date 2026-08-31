"use client";

import * as React from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, ArrowLeft, Mail, Phone, ShieldCheck, RotateCcw } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";

type VerificationType = "email" | "phone";
type VerificationStage = "input" | "sent" | "verifying" | "success" | "failed";

interface VerificationUIProps {
  type: VerificationType;
  redirect?: string;
}

export function VerificationUI({ type, redirect = "/" }: VerificationUIProps) {
  const router = useRouter();

  // Read search params from URL directly instead of useSearchParams()
  useEffect(() => {
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const contactValue = urlParams?.get("contact") ?? "";
    const token = urlParams?.get("token");

    if (token) {
      setStage("verifying");
      verifyCode(token);
    }
  }, []);

  const [stage, setStage] = React.useState<VerificationStage>("input");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const { success: toastSuccess } = useToast();

  // Read contact value from URL params (for display/masking) - safe for SSR
  const contactValue = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("contact") ?? "" : "";

  const verifyCode = async (codeToVerify: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStage("success");
      setTimeout(() => router.push(redirect), 2000);
    } catch (err) {
      setError("Invalid or expired code. Please try again.");
      setStage("failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) {
      verifyCode(code);
    }
  };

  const handleRetry = () => {
    setStage("input");
    setCode("");
  };

  const Icon = type === "email" ? Mail : Phone;
  const contactLabel = type === "email" ? "Email" : "Phone";
  const maskedContact = type === "email"
    ? contactValue.replace(/(.{2}).*(@.*)/, "$1****$2")
    : contactValue.replace(/(\+\d{2})(\d{3})(\d{3})(\d{4})/, "$1 $2 *** $4");

  const stages = {
    input: {
      title: `Verify Your ${contactLabel}`,
      body: `Enter the 6-digit code sent to ${maskedContact}`,
      showInput: true,
      showResend: true,
    },
    sent: {
      title: `Code Sent to ${contactLabel}`,
      body: `We've sent a 6-digit code to ${maskedContact}. Enter it below to verify.`,
      showInput: true,
      showResend: true,
    },
    verifying: {
      title: "Verifying...",
      body: "Please wait while we verify your code.",
      showInput: false,
      showResend: false,
    },
    success: {
      title: `${contactLabel} Verified!`,
      body: "Your account is now verified. Redirecting...",
      showInput: false,
      showResend: false,
    },
    failed: {
      title: "Verification Failed",
      body: "The code was invalid or has expired.",
      showInput: true,
      showResend: true,
    },
  };

  const current = stages[stage];

  const renderCodeInput = () => (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="flex gap-3">
        {[...code].map((char, i) => (
          <input
            key={i}
            type="text"
            maxLength={1}
            value={code[i] ?? ""}
            onChange={(e) => {
              if (e.target.value.length === 1 && i < 5) {
                setCode(code + e.target.value);
              } else if (e.target.value === "" && i > 0) {
                setCode(code.slice(0, -1));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !e.currentTarget.value && i > 0) {
                setCode(code.slice(0, -1));
              }
            }}
            className="h-14 w-12 text-center text-2xl font-bold rounded-lg border-obligon-border bg-white focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
            autoComplete="one-time-code"
            disabled={submitting}
            autoFocus
          />
        ))}
        <input type="hidden" value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
    </form>
  );

  const renderResendButton = () => (
    <button
      onClick={() => {
        if (resendCooldown > 0 || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
          setResendCooldown(60);
          const timer = setInterval(() => {
            setResendCooldown((c) => {
              if (c <= 1) {
                clearInterval(timer);
                return 0;
              }
              return c - 1;
            });
          }, 1000);
          toastSuccess(`${type === "email" ? "Email" : "SMS"} verification code resent`);
        } catch (err) {
          setError("Failed to resend code. Please try again.");
        } finally {
          setSubmitting(false);
        }
      }}
      disabled={submitting || resendCooldown > 0}
      className="mt-6 inline-flex w-full items-center justify-center text-sm font-bold text-obligon-green hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {resendCooldown > 0
        ? `Resend code in ${resendCooldown}s`
        : `Resend ${contactLabel.toLowerCase()} code`}
    </button>
  );

  return (
    <AuthShell compact>
      <div className="w-full max-w-[440px] mx-auto">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-obligon-green/10 text-obligon-green">
          <ShieldCheck size={32} />
        </div>

        <h1 className="mt-8 text-center font-display text-3xl font-extrabold leading-10 text-obligon-navy">
          {current.title}
        </h1>
        <p className="mt-4 text-center text-base leading-6 text-obligon-text">
          {current.body}
        </p>

        {error && (
          <div className="mt-6 rounded-lg bg-[#fff0f0] border border-[#fecaca] p-3 text-sm text-[#93000a] flex items-start gap-2" role="alert">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {current.showInput && renderCodeInput()}

        {stage === "failed" && (
          <button
            onClick={handleRetry}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-obligon-border px-6 py-3 text-sm font-bold text-obligon-navy hover:bg-obligon-mist"
          >
            <RotateCcw size={16} />
            Try Again
          </button>
        )}

        {stage !== "success" && stage !== "verifying" && current.showResend && renderResendButton()}

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