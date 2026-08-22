import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanyBillingPage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="billing" />
    </CompanyShell>
  );
}

