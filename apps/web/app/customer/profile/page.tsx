import { CustomerScreen } from "@/components/customer-dashboard/CustomerScreen";
import { CustomerShell } from "@/components/customer-dashboard/CustomerShell";

export default function CustomerProfilePage() {
  return (
    <CustomerShell>
      <CustomerScreen pageKey="profile" />
    </CustomerShell>
  );
}

