import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanyReportsPage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="reports" />
    </CompanyShell>
  );
}

