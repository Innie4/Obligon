import { AdminScreen } from "@/components/admin-dashboard/AdminScreen";
import { AdminShell } from "@/components/admin-dashboard/AdminShell";

export default function AdminPartnerApplicationsPage() {
  return (
    <AdminShell>
      <AdminScreen pageKey="applications" />
    </AdminShell>
  );
}

