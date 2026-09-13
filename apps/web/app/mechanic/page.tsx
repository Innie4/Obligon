import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

export default function MechanicDashboardPage() {
  return (
    <PartnershipShell allowedRoles={["mechanic"]}>
      <DashboardScreen pageKey="overview" />
    </PartnershipShell>
  );
}
