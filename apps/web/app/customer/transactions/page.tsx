import { CustomerScreen } from "@/components/customer-dashboard/CustomerScreen";
import { CustomerShell } from "@/components/customer-dashboard/CustomerShell";

export default function CustomerTransactionsPage() {
  return (
    <CustomerShell>
      <CustomerScreen pageKey="transactions" />
    </CustomerShell>
  );
}

