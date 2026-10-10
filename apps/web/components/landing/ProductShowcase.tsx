import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { assets } from "./assets";

const benefits = ["Virtual Card Controls", "Multi-Station Access", "Real-time Alerts", "Daily Limits"];

export function ProductShowcase() {
  return (
    <section id="product" className="bg-obligon-navy py-24" data-node-id="2:33">
      <div className="mx-auto w-[calc(100%-40px)] max-w-landing overflow-hidden rounded-[32px] border border-white/10 bg-obligon-blue px-6 py-8 sm:w-auto sm:px-10 lg:px-16 lg:py-16">
        <div className="relative grid min-w-0 items-center gap-12 lg:grid-cols-[479px_479px] lg:gap-16">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-obligon-green/10 blur-[50px]" />
          <div className="min-w-0 overflow-hidden rounded-3xl">
            <Image src={assets.fuelvistaCard} width={512} height={341} alt="FuelVista Card" className="w-full" />
          </div>

          <div className="relative">
            <h2 className="font-display text-[36px] leading-10 text-white sm:text-5xl sm:leading-[48px]">
              Elite Control for
              <br />
              Every Vehicle.
            </h2>
            <p className="mt-8 max-w-[475px] text-lg leading-7 text-white/70">
              The FuelVista Card is the standard in Nigerian fleet management. A single, powerful tool to manage
              spending, track usage, and secure discounts at approved partner stations. Physical cards and delivery are coming soon.
            </p>

            <Link
              href="/auth/signup?role=customer"
              className="mt-8 inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-white px-6 text-base font-bold text-obligon-navy"
            >
              Get started
              <ArrowRight size={16} aria-hidden="true" className="shrink-0" />
            </Link>

            <div className="mt-8 grid gap-x-4 gap-y-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 text-sm leading-5 text-white/80">
                  <Image src={assets.droplet} width={22} height={21} alt="" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
