import Image from "next/image";
import { assets } from "./assets";

type LandingButtonProps = {
  children: React.ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "darkOutline" | "light";
  icon?: "arrow" | "chevron";
  className?: string;
};

const variantClasses = {
  primary: "bg-obligon-green text-white shadow-green",
  secondary: "border border-white/10 bg-white/[0.03] text-white backdrop-blur-md",
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

  return (
    <a
      className={`inline-flex h-[58px] max-w-full items-center justify-center gap-4 rounded-lg px-8 text-center text-xs font-semibold tracking-[0.6px] transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-obligon-lime focus:ring-offset-2 ${variantClasses[variant]} ${className}`}
      href={href}
    >
      <span>{children}</span>
      {iconSrc ? (
        <Image src={iconSrc} width={icon === "arrow" ? 16 : 12} height={icon === "arrow" ? 16 : 8} alt="" />
      ) : null}
    </a>
  );
}
