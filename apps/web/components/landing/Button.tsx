import Image from "next/image";
import Link from "next/link";
import { assets } from "./assets";

type LandingButtonProps = {
  children: React.ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "darkOutline" | "light";
  icon?: "arrow" | "chevron";
  className?: string;
};

const variantClasses = {
  primary: "bg-obligon-green text-white hover:bg-[#315600]",
  secondary: "border border-white/30 bg-transparent text-white hover:bg-white/10",
  darkOutline: "border border-obligon-navy bg-transparent text-obligon-navy",
  light: "bg-white text-obligon-navy"
};

export function LandingButton({
  children,
  href = "#contact",
  variant = "primary",
  icon,
  className = ""
}: LandingButtonProps) {
  const iconSrc = icon === "arrow" ? assets.arrowUpRight : icon === "chevron" ? assets.checkSmall : null;

  const classNames = `inline-flex min-h-12 max-w-full items-center justify-center gap-3 rounded-lg px-7 py-3 text-center text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-obligon-lime focus:ring-offset-2 ${variantClasses[variant]} ${className}`;
  const content = (
    <>
      <span>{children}</span>
      {iconSrc ? (
        <Image src={iconSrc} width={icon === "arrow" ? 16 : 12} height={icon === "arrow" ? 16 : 8} className={icon === "arrow" ? "size-4 shrink-0" : "h-2 w-3 shrink-0"} alt="" />
      ) : null}
    </>
  );

  return href.startsWith("/") ? (
    <Link className={classNames} href={href}>
      {content}
    </Link>
  ) : (
    <a className={classNames} href={href}>
      {content}
    </a>
  );
}
