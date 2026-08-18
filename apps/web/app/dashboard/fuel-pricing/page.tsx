import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

export default function FuelPricingPage() {
  return (
    <PartnershipShell>
      <DashboardScreen pageKey="pricing" />
    </PartnershipShell>
  );
}

