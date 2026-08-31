import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SuccessAutoRedirect } from "@/components/auth/SuccessAutoRedirect";

export default function AuthSuccessPage() {
  return (
    <AuthShell compact>
      <div className="w-full max-w-[480px] mx-auto rounded-3xl border border-obligon-border bg-white p-8 shadow-card text-center">
        <span className="inline-flex rounded-full bg-obligon-lime/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[1px] text-[#131f00]">
          Identity Verified
        </span>
        <div className="mx-auto mt-6 grid size-20 place-items-center rounded-full bg-obligon-mist text-obligon-green">
          <svg className="size-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold leading-10 text-obligon-navy">
          Authentication Complete
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-base leading-6 text-obligon-text">
          Your profile and security credentials have been verified. Welcome to Obligon LTD.
        </p>
        <Suspense fallback={<p className="mt-6 text-sm text-obligon-text">Redirecting to dashboard...</p>}>
          <SuccessAutoRedirect />
        </Suspense>
      </div>
    </AuthShell>
  );
}
