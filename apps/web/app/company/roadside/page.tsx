import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanyRoadsidePage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="roadside" />
    </CompanyShell>
  );
}

