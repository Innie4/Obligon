import { AdminScreen } from "@/components/admin-dashboard/AdminScreen";
import { AdminShell } from "@/components/admin-dashboard/AdminShell";

export default function AdminStaffPage() {
  return (
    <AdminShell>
      <AdminScreen pageKey="staff" />
    </AdminShell>
  );
}

