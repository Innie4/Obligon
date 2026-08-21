import { CustomerScreen } from "@/components/customer-dashboard/CustomerScreen";
import { CustomerShell } from "@/components/customer-dashboard/CustomerShell";

export default function CustomerCardPage() {
  return (
    <CustomerShell>
      <CustomerScreen pageKey="card" />
    </CustomerShell>
  );
}

