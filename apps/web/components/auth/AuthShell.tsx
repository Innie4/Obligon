import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bell, CircleHelp } from "lucide-react";
import { assets } from "@/components/landing/assets";
import { routes } from "@/components/site/routes";

type AuthShellProps = {
  children: React.ReactNode;
  compact?: boolean;
};

export function AuthShell({ children, compact = false }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-obligon-mist text-obligon-navy">
      <header className="flex h-16 items-center justify-between border-b border-obligon-border bg-white px-5 sm:px-8 lg:px-16">
        <Link href={routes.home} className="relative block h-14 w-[90px]" aria-label="Obligon LTD home">
          <Image src={assets.obligonLogo} fill sizes="90px" alt="Obligon LTD" className="object-contain" priority />
        </Link>
        <div className="flex items-center gap-3 text-obligon-text">
          <Link href={routes.support} className="inline-flex size-9 items-center justify-center rounded-lg border border-obligon-border bg-white" aria-label="Help">
            <CircleHelp size={17} />
          </Link>
          <Link href={routes.notifications} className="inline-flex size-9 items-center justify-center rounded-lg border border-obligon-border bg-white" aria-label="Notifications">
            <Bell size={17} />
          </Link>
        </div>
      </header>

      {compact ? (
        <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[1280px] items-center justify-center px-5 py-12 sm:px-8">
          {children}
        </section>
      ) : (
        <section className="grid min-h-[calc(100vh-64px)] lg:grid-cols-[426px_1fr]">
          <aside className="relative hidden overflow-hidden bg-obligon-blue px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
            <Link href={routes.home} className="inline-flex items-center gap-2 text-sm text-white/70">
              <ArrowLeft size={16} />
              Back to home
            </Link>
            <div>
              <h1 className="font-display text-5xl font-extrabold leading-[56px]">
                Fueling Nigeria&apos;s Infrastructure.
              </h1>
              <p className="mt-5 text-base leading-6 text-white/70">
                Join over 850+ partner stations across the nation. Manage disbursements, track inventory, and grow your
                retail volume.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex -space-x-3">
                {["A", "B", "C"].map((item) => (
                  <span key={item} className="grid size-10 place-items-center rounded-full border-2 border-obligon-blue bg-obligon-lime text-xs font-bold text-obligon-navy">
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold text-white">+2k active partners</p>
            </div>
          </aside>
          <div className="bg-obligon-panel px-5 py-10 sm:px-8 lg:px-16">{children}</div>
        </section>
      )}
    </main>
  );
}
