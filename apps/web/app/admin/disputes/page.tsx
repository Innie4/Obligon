import { AdminScreen } from "@/components/admin-dashboard/AdminScreen";
import { AdminShell } from "@/components/admin-dashboard/AdminShell";

export default function AdminDisputesPage() {
  return (
    <AdminShell>
      <AdminScreen pageKey="disputes" />
    </AdminShell>
  );
}

