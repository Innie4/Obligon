import Image from "next/image";
import { LandingButton } from "./Button";
import { assets } from "./assets";

export function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[linear-gradient(137deg,#011554_0%,#00010c_100%)] pt-[95px]"
      data-node-id="2:3"
    >
      <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_center,rgba(61,106,0,0.85)_0%,rgba(61,106,0,0.22)_20%,rgba(61,106,0,0)_45%)]" />

      <div className="relative mx-auto grid min-h-[764px] w-full max-w-[1280px] min-w-0 items-center gap-16 px-5 py-20 sm:px-8 lg:grid-cols-[544px_544px] lg:px-16 lg:py-0">
        <div className="min-w-0 max-w-[544px]">
          <h1 className="font-display text-[44px] font-extrabold leading-[1.07] text-white sm:text-[56px] lg:text-[64px] lg:leading-[72px]">
            Redefining
            <br />
            <span className="text-obligon-lime">African</span>
            <br />
            <span className="text-obligon-lime">Energy</span> through
            <br />
            Innovation.
          </h1>

          <p className="mt-6 max-w-[536px] text-base leading-6 text-white/70 lg:mt-8">
            The operating system for smarter fleets. Obligon LTD provides enterprise-grade fuel management and logistics
            solutions tailored for the Nigerian landscape.
          </p>

          <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row lg:mt-10">
            <LandingButton href="/login#signup" icon="arrow">
              Join the Future
            </LandingButton>
            <LandingButton href="/solutions/fuelvista" variant="secondary" icon="chevron">
              Our Solutions
            </LandingButton>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[calc(100vw-40px)] min-w-0 sm:max-w-[544px] lg:mt-[14px]">
          <div className="absolute -inset-20 rounded-full bg-obligon-green/5 blur-[60px]" />
          <div className="relative mx-auto w-full max-w-[512px] overflow-hidden rounded-3xl border border-obligon-lime/20 shadow-hero">
            <Image
              src={assets.fuelvistaCard}
              width={512}
              height={341}
              alt="FuelVista fleet card"
              className="h-auto w-full max-w-full"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
