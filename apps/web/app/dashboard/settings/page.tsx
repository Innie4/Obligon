import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

export default function SettingsPage() {
  return (
    <PartnershipShell>
      <DashboardScreen pageKey="settings" />
    </PartnershipShell>
  );
}

