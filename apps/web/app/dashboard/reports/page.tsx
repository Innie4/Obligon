import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

export default function ReportsPage() {
  return (
    <PartnershipShell>
      <DashboardScreen pageKey="reports" />
    </PartnershipShell>
  );
}

