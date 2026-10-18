import { SolutionPage } from "@/components/solutions/SolutionPage";

export default function EnergyVistaPage() {
  return (
    <SolutionPage
      eyebrow="EnergyVista Solution"
      name="EnergyVista"
      accent="blue"
      title={
        <>
          Business <span className="text-obligon-lime">fuel supply</span>
        </>
      }
      body="Tell our team what fuel your business needs. We will confirm availability, delivery coverage, timing, and contract terms before you proceed."
      stats={[
        { value: "Discuss", label: "Supply requirements" },
        { value: "Confirm", label: "Availability" },
        { value: "Agree", label: "Service terms" }
      ]}
      features={[
        { title: "Supply Requirements", body: "Share the fuel type, quantity, location, and schedule your business requires.", icon: "gauge" },
        { title: "Partner Availability", body: "Our team checks which partners can support the request before confirming service.", icon: "tower" },
        { title: "Delivery Planning", body: "Discuss delivery coverage and timing with the team before placing an order.", icon: "chart" },
        { title: "Commercial Terms", body: "Confirm pricing, payment arrangements, and contract terms before work begins.", icon: "lock" }
      ]}
      modules={[
        "Submit your fuel supply requirements",
        "Confirm partner availability and delivery coverage",
        "Review the proposed scope and commercial terms",
        "Agree a contract before service starts"
      ]}
    />
  );
}
