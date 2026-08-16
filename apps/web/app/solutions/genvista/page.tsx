import { SolutionPage } from "@/components/solutions/SolutionPage";

export default function GenVistaPage() {
  return (
    <SolutionPage
      eyebrow="GenVista Solution"
      name="GenVista"
      accent="lime"
      title={
        <>
          Generator intelligence for <span className="text-obligon-lime">always-on facilities</span>.
        </>
      }
      body="GenVista helps companies control generator fueling, uptime telemetry, service checks, and energy spend for distributed facilities."
      stats={[
        { value: "99%", label: "Uptime" },
        { value: "Live", label: "Telemetry" },
        { value: "Naira", label: "Ledger" }
      ]}
      features={[
        { title: "Runtime Telemetry", body: "Monitor generator status, consumption, and uptime across locations.", icon: "cpu" },
        { title: "Fuel Dispatch", body: "Plan refills and station coordination around actual equipment demand.", icon: "zap" },
        { title: "Exception Alerts", body: "Detect unusual burn rates, service gaps, or downtime risk early.", icon: "gauge" },
        { title: "Facility Reporting", body: "Give finance and operations one view of cost, usage, and reliability.", icon: "chart" }
      ]}
      modules={[
        "Register facilities and generator assets",
        "Connect fuel orders to verified delivery windows",
        "Monitor runtime, downtime, and consumption anomalies",
        "Export operational and finance-ready reports"
      ]}
    />
  );
}

