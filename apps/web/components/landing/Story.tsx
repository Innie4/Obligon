const storyCards = [
  {
    title: "Partner Stations",
    text: "Find approved filling stations and view the fuels they offer. Confirm current availability with the station.",
  },
  {
    title: "Fleet Records",
    text: "Review fuel transactions and manage vehicle and driver assignments from the company dashboard.",
  },
  {
    title: "Bulk Supply",
    text: "Request bulk fuel for your business. Availability, quantity, and delivery terms are confirmed before an order proceeds.",
  },
  {
    title: "FuelVista Cards",
    text: "Virtual fuel cards, spending controls, and recorded fuel transactions for individuals and company fleets.",
  }
];

export function Story() {
  return (
    <section id="about-us" className="bg-white py-20 sm:py-24 lg:py-32" data-node-id="2:279">
      <div className="mx-auto grid w-full max-w-landing min-w-0 gap-16 px-5 sm:px-8 lg:grid-cols-[442.67px_1fr] lg:px-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-obligon-green">The Obligon LTD Story</p>
          <h2 className="mt-4 font-display text-3xl leading-tight text-obligon-navy sm:text-4xl">
            Fuel tools for people and businesses.
          </h2>

          <div className="mt-4 space-y-6 text-base leading-[26px] text-obligon-text lg:mt-4">
            <p>
              Obligon LTD brings fuel cards, spending records, and approved stations into one service. Individuals
              can manage their own fuel budget, while companies can set controls for their fleets.
            </p>
            <p>
              Our team also coordinates supply, maintenance, and energy service enquiries with partners. Availability
              and service terms are confirmed before work begins.
            </p>
          </div>
        </div>

        <div className="grid min-w-0 gap-x-10 gap-y-12 sm:grid-cols-2">
          {storyCards.map((card) => (
            <article
              key={card.title}
              className="min-w-0"
            >
              <h3 className="font-display text-xl font-semibold leading-7 text-obligon-navy">{card.title}</h3>
              <p className="mt-3 text-base leading-7 text-obligon-text">{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
