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
      body="FuelVista combines card controls, partner-station access, spend limits, and transaction intelligence for Nigerian fleet operators."
      stats={[
        { value: "850+", label: "Stations" },
        { value: "24/7", label: "Controls" },
        { value: "99.9%", label: "Ledger" }
      ]}
      features={[
        { title: "Fuel Card Governance", body: "Issue cards, set daily limits, and assign vehicle-specific policies from one control room.", icon: "card" },
        { title: "Partner Station Access", body: "Route drivers through verified stations and keep disbursement records clean.", icon: "map" },
        { title: "Real-Time Alerts", body: "Flag abnormal spend, location mismatches, or unusual purchase behavior as it happens.", icon: "lock" },
        { title: "Spend Analytics", body: "Track fuel volume, cost trends, station usage, and vehicle-level consumption.", icon: "chart" }
      ]}
      modules={[
        "Create fleet wallet and card issuance request",
        "Assign limits by vehicle, driver, route, or station",
        "Approve transactions with location-aware controls",
        "Reconcile activity into finance-ready reports"
      ]}
    />
  );
}

