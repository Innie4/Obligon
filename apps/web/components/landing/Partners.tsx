const partners = ["NNPC", "Mobil", "Oando", "Conoil", "TotalEnergies"];

export function Partners() {
  return (
    <section id="partners" className="bg-obligon-mist py-20" data-node-id="2:213">
      <div className="mx-auto max-w-landing px-5 text-center sm:px-8 lg:px-0">
        <p className="text-xs font-semibold uppercase tracking-[3.6px] text-obligon-text">Institutional Partners</p>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-12 gap-y-5 opacity-40 lg:gap-x-16">
          {partners.map((partner) => (
            <span key={partner} className="text-2xl font-bold leading-8 text-obligon-navy">
              {partner}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
