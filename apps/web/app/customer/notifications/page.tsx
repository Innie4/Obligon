import { CustomerScreen } from "@/components/customer-dashboard/CustomerScreen";
import { CustomerShell } from "@/components/customer-dashboard/CustomerShell";

export default function CustomerNotificationsPage() {
  return (
    <CustomerShell>
      <CustomerScreen pageKey="notifications" />
    </CustomerShell>
  );
}

