import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanyStationsPage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="stations" />
    </CompanyShell>
  );
}

