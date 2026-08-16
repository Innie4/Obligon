import Image from "next/image";
import { assets } from "./assets";

const benefits = ["Secure EMV Chip", "Multi-Station Access", "Real-time Alerts", "Daily Limits"];

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
              spending, track usage, and secure discounts across our vast partner network.
            </p>

            <div className="mt-8 flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[1.4px] text-obligon-lime">Issuance Fee</p>
                <p className="mt-1 font-display text-3xl leading-9 text-white">
                  &#8358;2,000 <span className="font-sans text-lg text-white/40">/ Vehicle</span>
                </p>
              </div>
              <a
                href="#order-cards"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-6 text-base font-bold text-obligon-navy"
              >
                Order Cards
              </a>
            </div>

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
