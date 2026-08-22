import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanySupportPage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="support" />
    </CompanyShell>
  );
}

