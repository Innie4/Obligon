import { SolutionPage } from "@/components/solutions/SolutionPage";

export default function FuelVistaPage() {
  return (
    <SolutionPage
      eyebrow="FuelVista Solution"
      name="FuelVista"
      accent="green"
      title={
        <>
          Elite control for <span className="text-obligon-lime">fleet fuel</span> operations.
        </>
      }
      body="FuelVista combines card controls, partner-station access, spend limits, and recorded fuel transactions for Nigerian fleet operators."
      stats={[
        { value: "Verified", label: "Station operators" },
        { value: "Plan-based", label: "Controls" },
        { value: "Recorded", label: "Transactions" }
      ]}
      features={[
        { title: "Fuel Card Governance", body: "Request cards, manage vehicle and driver assignments, and set daily and monthly spend limits.", icon: "card" },
        { title: "Partner Station Access", body: "Route drivers through verified stations and keep disbursement records clean.", icon: "map" },
        { title: "Transaction Alerts", body: "Receive notifications of recorded fuel transactions and account updates.", icon: "lock" },
        { title: "Spend Analytics", body: "Track fuel volume, cost trends, station usage, and vehicle-level consumption.", icon: "chart" }
      ]}
      modules={[
        "Manage company wallet funding and card requests",
        "Set daily and monthly limits for vehicle and driver cards",
        "Authorize wallet fuel purchases with single-use codes",
        "Review recorded purchases and export reports"
      ]}
    />
  );
}
