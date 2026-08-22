import Image from "next/image";
import Link from "next/link";
import { assets } from "@/components/landing/assets";
import { routes } from "./routes";

const navLinks = [
  { label: "Solutions", href: routes.fuelvista },
  { label: "Pricing", href: "/#pricing" },
  { label: "Careers", href: routes.careers },
  { label: "Support", href: routes.support }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 h-20 border-b border-obligon-border bg-obligon-mist/95 backdrop-blur-md">
      <nav className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-16">
        <Link href={routes.home} className="relative block h-[72px] w-[112px]" aria-label="Obligon LTD home">
          <Image src={assets.obligonLogo} fill sizes="112px" alt="Obligon LTD" className="object-contain" priority />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-xs font-semibold tracking-[0.6px] text-obligon-text transition hover:text-obligon-green"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href={routes.login}
            className="hidden text-xs font-semibold tracking-[0.6px] text-obligon-navy sm:inline-flex"
          >
            Login
          </Link>
          <Link
            href={`${routes.login}#signup`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-obligon-green px-5 text-sm font-bold text-white shadow-green"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}

