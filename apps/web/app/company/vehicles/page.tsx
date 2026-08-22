import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanyVehiclesPage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="vehicles" />
    </CompanyShell>
  );
}

