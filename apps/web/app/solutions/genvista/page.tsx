import { SolutionPage } from "@/components/solutions/SolutionPage";

export default function GenVistaPage() {
  return (
    <SolutionPage
      eyebrow="GenVista Solution"
      name="GenVista"
      accent="lime"
      title={
        <>
          Generator <span className="text-obligon-lime">support</span>
        </>
      }
      body="Share your generator fuel or maintenance requirements with our team. We will confirm the service scope, partner availability, and terms before you proceed."
      stats={[
        { value: "Discuss", label: "Facility requirements" },
        { value: "Confirm", label: "Partner availability" },
        { value: "Agree", label: "Service scope" }
      ]}
      features={[
        { title: "Fuel Planning", body: "Discuss the fuel type, quantity, delivery location, and schedule your facilities need.", icon: "gauge" },
        { title: "Service Requests", body: "Tell our team about the generator maintenance or service work you require.", icon: "cpu" },
        { title: "Facility Requirements", body: "Share site access details and operating needs so the proposed service fits your facilities.", icon: "tower" },
        { title: "Scope and Pricing", body: "Review the available service, pricing, and contract terms before work begins.", icon: "chart" }
      ]}
      modules={[
        "Describe your facilities and generator requirements",
        "Confirm the available partner service and coverage",
        "Review scope, timing, pricing, and responsibilities",
        "Agree service terms before work starts"
      ]}
    />
  );
}
