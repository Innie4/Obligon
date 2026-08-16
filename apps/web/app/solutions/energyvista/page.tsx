import { SolutionPage } from "@/components/solutions/SolutionPage";

export default function EnergyVistaPage() {
  return (
    <SolutionPage
      eyebrow="EnergyVista Solution"
      name="EnergyVista"
      accent="blue"
      title={
        <>
          Intelligent supply planning for <span className="text-obligon-lime">enterprise energy</span>.
        </>
      }
      body="EnergyVista gives procurement and operations teams a shared view of supply planning, inventory pressure, partner fulfilment, and financial exposure."
      stats={[
        { value: "12+", label: "Regions" },
        { value: "150M+", label: "Litres" },
        { value: "2-3d", label: "Review" }
      ]}
      features={[
        { title: "Supply Forecasting", body: "Plan purchase cycles around fleet demand, regional availability, and historical usage.", icon: "gauge" },
        { title: "Partner Coordination", body: "Coordinate fulfilment windows and settlement trails across partner stations.", icon: "tower" },
        { title: "Inventory Visibility", body: "Track stock, risk signals, and delivery pressure before service levels slip.", icon: "chart" },
        { title: "Financial Controls", body: "Connect purchase approvals to settlement and ledger workflows.", icon: "lock" }
      ]}
      modules={[
        "Forecast demand from fleet and facility history",
        "Match supply to approved partner capacity",
        "Track delivery, utilization, and exceptions",
        "Review spend exposure before settlement"
      ]}
    />
  );
}

