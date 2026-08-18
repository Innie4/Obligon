import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

export default function TransactionsPage() {
  return (
    <PartnershipShell>
      <DashboardScreen pageKey="transactions" />
    </PartnershipShell>
  );
}

