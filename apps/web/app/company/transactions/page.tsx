import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanyTransactionsPage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="transactions" />
    </CompanyShell>
  );
}

