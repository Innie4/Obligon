import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { assets } from "./assets";

const benefits = ["Virtual Card Controls", "Multi-Station Access", "Transaction Notifications", "Daily Limits"];

export function ProductShowcase() {
  return (
    <section id="product" className="bg-obligon-navy py-24" data-node-id="2:33">
      <div className="mx-auto w-[calc(100%-40px)] max-w-landing overflow-hidden rounded-[32px] border border-white/10 bg-obligon-blue px-6 py-8 sm:w-auto sm:px-10 lg:px-16 lg:py-16">
        <div className="relative grid min-w-0 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0 overflow-hidden rounded-3xl">
            <Image src={assets.fuelvistaCard} width={512} height={341} alt="FuelVista Card" className="w-full" />
          </div>

          <div className="relative">
            <h2 className="font-display text-[36px] leading-10 text-white sm:text-5xl sm:leading-[48px]">
              Fuel Controls for
              <br />
              Every Vehicle.
            </h2>
            <p className="mt-8 max-w-[475px] text-lg leading-7 text-white/70">
              Use a FuelVista virtual fuel card to set spending limits, review transactions, and buy fuel at approved
              partner stations. Discounts depend on your plan and participating stations. Physical cards and delivery
              are not available yet.
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
