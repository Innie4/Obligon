import { Menu } from "lucide-react";
import Image from "next/image";
import { LandingButton } from "./Button";
import { assets } from "./assets";

const navItems = ["Home", "Product", "Pricing", "About Us", "Partners"];

export function Header() {
  return (
    <header
      className="absolute left-0 top-0 z-20 h-[95px] w-full border-b border-obligon-border bg-white/90 backdrop-blur-md"
      data-node-id="2:325"
    >
      <nav className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-16">
        <div className="flex h-[62px] items-center gap-12">
          <a className="relative block h-[62px] w-[93px]" href="#" aria-label="Obligon home">
            <Image src={assets.obligonLogo} fill sizes="93px" alt="Obligon" className="object-contain" priority />
          </a>

          <div className="hidden items-center gap-8 lg:flex">
            {navItems.map((item) => (
              <a
                key={item}
                className="text-xs font-semibold tracking-[0.6px] text-obligon-text transition hover:text-obligon-green"
                href={item === "Home" ? "#" : `#${item.toLowerCase().replaceAll(" ", "-")}`}
              >
                {item}
              </a>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <a
            className="inline-flex h-8 items-center justify-center px-4 text-xs font-semibold tracking-[0.6px] text-obligon-text"
            href="#login"
          >
            Login
          </a>
          <LandingButton className="h-9 px-6" href="#get-started">
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
