import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanyCardsPage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="cards" />
    </CompanyShell>
  );
}

