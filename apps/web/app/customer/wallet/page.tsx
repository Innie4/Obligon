import { CustomerScreen } from "@/components/customer-dashboard/CustomerScreen";
import { CustomerShell } from "@/components/customer-dashboard/CustomerShell";

export default function CustomerWalletPage() {
  return (
    <CustomerShell>
      <CustomerScreen pageKey="wallet" />
    </CustomerShell>
  );
}

