import { DashboardHeader } from "./DashboardHeader";
import { PartnershipSidebar } from "./PartnershipSidebar";

type PartnershipShellProps = {
  children: React.ReactNode;
};

export function PartnershipShell({ children }: PartnershipShellProps) {
  return (
    <main className="min-h-screen bg-[#f7f7fd] text-obligon-navy">
      <PartnershipSidebar />
      <div className="lg:pl-[280px]">
        <DashboardHeader />
        {children}
      </div>
    </main>
  );
}
