import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LandingButton } from "./Button";
import { assets } from "./assets";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Product", href: "/solutions/fuelvista" },
  { label: "Pricing", href: "/#pricing" },
  { label: "About Us", href: "/#get-started" },
  { label: "Partners", href: "/#partners" }
];

export function Header() {
  return (
    <header
      className="absolute left-0 top-0 z-20 h-[95px] w-full border-b border-obligon-border bg-white/90 backdrop-blur-md"
      data-node-id="2:325"
    >
      <nav className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-16">
        <div className="flex h-[80px] items-center gap-12">
          <Link className="relative block h-[80px] w-[128px]" href="/" aria-label="Obligon LTD home">
            <Image src={assets.obligonLogo} fill sizes="128px" alt="Obligon LTD" className="object-contain" priority />
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                className="text-xs font-semibold tracking-[0.6px] text-obligon-text transition hover:text-obligon-green"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            className="inline-flex h-8 items-center justify-center px-4 text-xs font-semibold tracking-[0.6px] text-obligon-text"
            href="/auth/login"
          >
            Login
          </Link>
          <LandingButton className="h-9 px-6" href="/auth/signup">
            Get Started
          </LandingButton>
        </div>

        <button
          className="inline-flex size-10 items-center justify-center rounded-lg border border-obligon-border bg-white text-obligon-navy md:hidden"
          type="button"
          aria-label="Open navigation menu"
        >
          <Menu size={18} strokeWidth={2} />
        </button>
      </nav>
    </header>
  );
}
