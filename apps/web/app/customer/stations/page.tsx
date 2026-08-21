import { CustomerScreen } from "@/components/customer-dashboard/CustomerScreen";
import { CustomerShell } from "@/components/customer-dashboard/CustomerShell";

export default function CustomerStationsPage() {
  return (
    <CustomerShell>
      <CustomerScreen pageKey="stations" />
    </CustomerShell>
  );
}

