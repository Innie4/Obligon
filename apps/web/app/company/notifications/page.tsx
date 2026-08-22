import { CompanyScreen } from "@/components/company-dashboard/CompanyScreen";
import { CompanyShell } from "@/components/company-dashboard/CompanyShell";

export default function CompanyNotificationsPage() {
  return (
    <CompanyShell>
      <CompanyScreen pageKey="notifications" />
    </CompanyShell>
  );
}

