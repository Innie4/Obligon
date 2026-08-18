import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

export default function CardVerificationPage() {
  return (
    <PartnershipShell>
      <DashboardScreen pageKey="verification" />
    </PartnershipShell>
  );
}

