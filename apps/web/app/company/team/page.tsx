import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanyTeamPage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="team" />
    </CompanyShell>
  );
}

