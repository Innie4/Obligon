import { CustomerScreen } from "@/components/customer-dashboard/CustomerScreen";
import { CustomerShell } from "@/components/customer-dashboard/CustomerShell";

export default function CustomerReportProblemPage() {
  return (
    <CustomerShell>
      <CustomerScreen pageKey="reportProblem" />
    </CustomerShell>
  );
}

