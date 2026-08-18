import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

export default function DashboardNotificationsPage() {
  return (
    <PartnershipShell>
      <DashboardScreen pageKey="notifications" />
    </PartnershipShell>
  );
}

