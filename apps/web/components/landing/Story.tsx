import Image from "next/image";
import { assets } from "./assets";

const storyCards = [
  {
    title: "Retail Expansion",
    text: "Building a network of premium retail filling stations across Nigeria's major transit corridors.",
    icon: assets.facebook,
    iconSize: "h-[22.5px] w-[20.625px]"
  },
  {
    title: "Smart Logistics",
    text: "Advanced fleet tracking and delivery systems that ensure your energy arrives exactly when needed.",
    icon: assets.mapPin,
    iconSize: "h-5 w-[27.5px]"
  },
  {
    title: "Bulk Supply",
    text: "Large-scale energy distribution for industrial and commercial partners with guaranteed availability.",
    icon: assets.linkedin,
    iconSize: "h-[25px] w-[24.4375px]"
  },
  {
    title: "FuelVista Tech",
    text: "Our proprietary subscription card system powering thousands of vehicle transactions monthly.",
    icon: assets.zap,
    iconSize: "h-[25px] w-[22.5px]"
  }
];

export function Story() {
  return (
    <section id="about-us" className="bg-white py-20 sm:py-24 lg:py-32" data-node-id="2:279">
      <div className="mx-auto grid w-full max-w-landing min-w-0 gap-16 px-5 sm:px-8 lg:grid-cols-[442.67px_1fr] lg:px-0">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[2.4px] text-obligon-green">The Obligon Story</p>
          <h2 className="mt-4 font-display text-base leading-6 text-obligon-navy">
            Innovation-led Narrative of Commitment
          </h2>

          <div className="mt-4 space-y-6 text-base leading-[26px] text-obligon-text lg:mt-4">
            <p>
              At Obligon Limited, we are driven by a commitment to bridge the gap between energy accessibility and
              technological innovation. Our journey began with a vision to transform the Nigerian energy landscape
              through efficiency and transparency.
            </p>
            <p>
              Today, we are expanding our footprint into retail filling stations, logistics, and bulk supply, ensuring
              that every business-from local startups to national conglomerates-has the fuel to grow.
            </p>
          </div>
        </div>

        <div className="grid min-w-0 gap-8 sm:grid-cols-2">
          {storyCards.map((card, index) => (
            <article
              key={card.title}
              className={`min-w-0 rounded-3xl border border-obligon-border bg-obligon-panel p-8 ${
                index > 1 ? "lg:min-h-[242px]" : "lg:min-h-[262px]"
              }`}
            >
              <div className="flex size-14 items-center justify-center rounded-xl bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
                <span className={`relative block ${card.iconSize}`}>
                  <Image src={card.icon} fill alt="" sizes="28px" />
                </span>
              </div>
              <h3 className="mt-8 font-display text-base leading-6 text-obligon-navy">{card.title}</h3>
              <p className="mt-3 text-sm leading-5 text-obligon-text">{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
