import { AdminScreen } from "@/components/admin-dashboard/AdminScreen";
import { AdminShell } from "@/components/admin-dashboard/AdminShell";

export default function AdminReportsPage() {
  return (
    <AdminShell>
      <AdminScreen pageKey="reports" />
    </AdminShell>
  );
}

