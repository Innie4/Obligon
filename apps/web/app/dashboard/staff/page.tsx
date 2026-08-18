import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

export default function StaffManagementPage() {
  return (
    <PartnershipShell>
      <DashboardScreen pageKey="staff" />
    </PartnershipShell>
  );
}

