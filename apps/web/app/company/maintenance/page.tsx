import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanyMaintenancePage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="maintenance" />
    </CompanyShell>
  );
}

