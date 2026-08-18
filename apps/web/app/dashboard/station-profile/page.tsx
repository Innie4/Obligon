import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

export default function StationProfilePage() {
  return (
    <PartnershipShell>
      <DashboardScreen pageKey="station" />
    </PartnershipShell>
  );
}

