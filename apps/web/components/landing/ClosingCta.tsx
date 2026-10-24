import Link from "next/link";

export function ClosingCta() {
  return (
    <section id="get-started" className="bg-white py-24" data-node-id="2:185">
      <div className="mx-auto w-[calc(100%-40px)] max-w-landing rounded-[40px] border border-obligon-border bg-obligon-panel px-6 py-16 sm:w-auto sm:px-12 lg:px-24 lg:py-24">
        <h2 className="text-center font-display text-3xl leading-tight text-obligon-navy sm:text-4xl">Our Commitment to the Nation</h2>

        <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="h-1 w-12 bg-obligon-green" />
            <h3 className="mt-6 font-display text-base leading-6 text-obligon-navy">Mission</h3>
            <p className="mt-6 max-w-[447px] text-base leading-6 text-obligon-text">
              Help people and businesses in Nigeria manage fuel spending, find approved stations, and keep clear
              records of their energy use.
            </p>
          </div>

          <div>
            <div className="h-1 w-12 bg-obligon-green" />
            <h3 className="mt-6 font-display text-base leading-6 text-obligon-navy">Vision</h3>
            <p className="mt-6 max-w-[447px] text-base leading-6 text-obligon-text">
              Build a dependable energy network that connects drivers, businesses, and service providers across
              Nigeria.
            </p>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-8 pt-10 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-base font-medium leading-6 text-obligon-text">
            Ready to manage your fuel spending?
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/auth/signup"
              className="inline-flex h-[58px] items-center justify-center rounded-lg bg-obligon-green px-8 text-base font-bold text-white"
            >
              Get Started
            </Link>
            <Link
              href="/support"
              className="inline-flex h-[58px] items-center justify-center rounded-lg border border-obligon-navy px-8 text-base font-bold text-obligon-navy"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
