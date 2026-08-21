import Image from "next/image";
import Link from "next/link";
import { assets } from "./assets";

const footerColumns = [
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/#get-started" },
      { label: "Careers", href: "/careers" },
      { label: "Partners", href: "/#partners" },
      { label: "Contact", href: "/support" }
    ]
  },
  {
    title: "Product",
    links: [
      { label: "FuelVista Card", href: "/solutions/fuelvista" },
      { label: "EnergyVista", href: "/solutions/energyvista" },
      { label: "GenVista", href: "/solutions/genvista" },
      { label: "Pricing Plans", href: "/#pricing" }
    ]
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms of Service", href: "/terms-of-service" },
      { label: "Cookie Policy", href: "/cookie-policy" }
    ]
  }
];

export function Footer() {
  return (
    <footer id="contact" className="bg-obligon-navy py-20 text-white" data-node-id="2:228">
      <div className="mx-auto w-full max-w-landing min-w-0 px-5 sm:px-8 lg:px-0">
        <div className="grid gap-12 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-12">
          <div>
            <Link className="relative block h-14 w-[88px]" href="/" aria-label="Obligon home">
              <Image
                src={assets.obligonLogo}
                fill
                alt="Obligon"
                sizes="88px"
                className="object-contain"
              />
            </Link>
            <p className="mt-8 max-w-sm text-base leading-[26px] text-white/60">
              Obligon Limited is a Nigerian-based energy and technology firm committed to efficiency, transparency, and
              innovation.
            </p>
            <div className="mt-8 flex gap-4">
              {[assets.socialGlobe, assets.socialAt].map((icon, index) => (
                <a
                  key={icon}
                  className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5"
                  href={index === 0 ? "#facebook" : "#linkedin"}
                  aria-label={index === 0 ? "Facebook" : "LinkedIn"}
                >
                  <Image src={icon} width={12} height={12} alt="" />
                </a>
              ))}
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="text-xs font-normal uppercase tracking-[1.2px] text-obligon-lime">{column.title}</h3>
              <ul className="mt-6 space-y-4">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link className="text-sm leading-5 text-white/60 transition hover:text-white" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 border-t border-white/[0.05] pt-8 text-center text-xs leading-4 text-white/40">
          &copy; 2024 Obligon Limited. Registered in the Federal Republic of Nigeria. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
