import { CustomerScreen } from "@/components/customer-dashboard/CustomerScreen";
import { CustomerShell } from "@/components/customer-dashboard/CustomerShell";

export default function CustomerOverviewPage() {
  return (
    <CustomerShell>
      <CustomerScreen pageKey="overview" />
    </CustomerShell>
  );
}

