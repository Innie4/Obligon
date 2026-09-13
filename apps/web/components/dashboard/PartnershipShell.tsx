import { DashboardHeader } from "./DashboardHeader";
import { PartnershipSidebar } from "./PartnershipSidebar";
import { AuthGuard } from "@/components/auth/AuthGuard";

type PartnershipShellProps = {
  children: React.ReactNode;
  allowedRoles?: Array<"partner" | "mechanic">;
};

export function PartnershipShell({ children, allowedRoles = ["partner"] }: PartnershipShellProps) {
  return (
    <AuthGuard allowedRoles={allowedRoles.length === 1 && allowedRoles[0] === "partner" ? ["partner", "mechanic"] : allowedRoles}>
      <main className="min-h-screen bg-[#f7f7fd] text-obligon-navy">
        <PartnershipSidebar />
        <div className="lg:pl-[280px]">
          <DashboardHeader />
          {children}
        </div>
      </main>
    </AuthGuard>
  );
}
