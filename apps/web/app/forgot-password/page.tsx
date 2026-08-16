import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/site/Input";
import { routes } from "@/components/site/routes";

export default function ForgotPasswordPage() {
  return (
    <AuthShell compact>
      <section className="w-full max-w-[440px] rounded-3xl border border-obligon-border bg-white p-8 shadow-card">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-obligon-green/10 text-obligon-green">
          <ShieldCheck size={32} />
        </div>
        <h1 className="mt-8 text-center font-display text-3xl font-extrabold leading-10 text-obligon-navy">
          Forgot Password?
        </h1>
        <p className="mt-4 text-center text-base leading-6 text-obligon-text">
          Enter your email address and we&apos;ll send you a secure link to reset your password.
        </p>
        <form className="mt-8 space-y-5">
          <Input label="Work Email Address" name="email" type="email" placeholder="james.adenuga@enterprise.ng" />
          <Link
            href={routes.authInProgress}
            className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-obligon-green text-base font-bold text-white shadow-green"
          >
            Send Reset Link
          </Link>
        </form>
        <Link href={routes.login} className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[1.2px] text-obligon-green">
          <ArrowLeft size={16} />
          Back to Login
        </Link>
        <p className="mt-8 border-t border-obligon-border pt-6 text-center text-xs uppercase tracking-[1.2px] text-obligon-text">
          Trusted by 200+ fleet operators
        </p>
      </section>
    </AuthShell>
  );
}

