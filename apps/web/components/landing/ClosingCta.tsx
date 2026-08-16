import Link from "next/link";

export function ClosingCta() {
  return (
    <section id="get-started" className="bg-white py-24" data-node-id="2:185">
      <div className="mx-auto w-[calc(100%-40px)] max-w-landing rounded-[40px] border border-obligon-border bg-obligon-panel px-6 py-16 sm:w-auto sm:px-12 lg:px-24 lg:py-24">
        <h2 className="text-center font-display text-base leading-6 text-obligon-navy">Our Commitment to the Nation</h2>

        <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="h-1 w-12 bg-obligon-green" />
            <h3 className="mt-6 font-display text-base leading-6 text-obligon-navy">Mission</h3>
            <p className="mt-6 max-w-[447px] text-base leading-6 text-obligon-text">
              To provide seamless energy solutions through innovative technology, fostering growth for businesses and
              improving the quality of life for all stakeholders in Nigeria.
            </p>
          </div>

          <div>
            <div className="h-1 w-12 bg-obligon-green" />
            <h3 className="mt-6 font-display text-base leading-6 text-obligon-navy">Vision</h3>
            <p className="mt-6 max-w-[447px] text-base leading-6 text-obligon-text">
              To be Africa&apos;s foremost technology-driven energy partner, recognized for excellence, reliability, and
              transformative impact on the energy sector.
            </p>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-8 border-t border-obligon-border pt-10 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-base font-medium leading-6 text-obligon-text">
            Ready to redefine your energy management?
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/login#signup"
              className="inline-flex h-[58px] items-center justify-center rounded-lg bg-obligon-green px-8 text-base font-bold text-white shadow-green"
            >
              Get Started
            </Link>
            <Link
              href="/support"
              className="inline-flex h-[58px] items-center justify-center rounded-lg border border-obligon-navy px-8 text-base font-bold text-obligon-navy"
            >
              Inquire Now
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
