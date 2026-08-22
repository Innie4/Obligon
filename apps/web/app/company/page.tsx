import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanyOverviewPage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="overview" />
    </CompanyShell>
  );
}

