import { AdminScreen } from "@/components/admin-dashboard/AdminScreen";
import { AdminShell } from "@/components/admin-dashboard/AdminShell";

export default function AdminCompanyOversightPage() {
  return (
    <AdminShell>
      <AdminScreen pageKey="companies" />
    </AdminShell>
  );
}

