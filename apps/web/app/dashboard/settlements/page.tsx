import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

export default function SettlementsPage() {
  return (
    <PartnershipShell>
      <DashboardScreen pageKey="settlements" />
    </PartnershipShell>
  );
}

