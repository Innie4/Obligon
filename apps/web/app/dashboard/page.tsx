import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

export default function DashboardOverviewPage() {
  return (
    <PartnershipShell>
      <DashboardScreen pageKey="overview" />
    </PartnershipShell>
  );
}
