import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanySettingsPage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="settings" />
    </CompanyShell>
  );
}

