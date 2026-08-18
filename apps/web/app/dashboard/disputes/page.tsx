import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

export default function DisputesPage() {
  return (
    <PartnershipShell>
      <DashboardScreen pageKey="disputes" />
    </PartnershipShell>
  );
}

