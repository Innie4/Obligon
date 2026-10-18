import Image from "next/image";
import { LandingButton } from "./Button";
import { assets } from "./assets";

export function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-obligon-navy pt-[104px]"
      data-node-id="2:3"
    >

      <div className="relative mx-auto grid min-h-[764px] w-full max-w-[1280px] min-w-0 items-center gap-16 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:px-16 lg:py-0">
        <div className="min-w-0 max-w-[544px]">
          <h1 className="font-display text-[44px] font-extrabold leading-[1.07] text-white sm:text-[56px] lg:text-[64px] lg:leading-[72px]">
            Your fuel.
            <br />
            <span className="text-obligon-lime">Your control.</span>
          </h1>

          <p className="mt-6 max-w-[536px] text-base leading-6 text-white/70 lg:mt-8">
            Obligon LTD helps individuals and companies track fuel spending, manage virtual fuel cards, and find
            approved stations in Nigeria.
          </p>

          <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row lg:mt-10">
            <LandingButton href="/auth/signup" icon="arrow">
              Get Started
            </LandingButton>
            <LandingButton href="/solutions/fuelvista" variant="secondary" icon="arrow">
              Explore FuelVista
            </LandingButton>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[calc(100vw-40px)] min-w-0 sm:max-w-[544px] lg:mt-[14px]">
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
