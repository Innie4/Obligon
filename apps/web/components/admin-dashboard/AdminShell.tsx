import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  return (
    <main className="min-h-screen bg-[#f7f7fd] text-obligon-navy">
      <AdminSidebar />
      <div className="lg:pl-[280px]">
        <AdminHeader />
        {children}
      </div>
    </main>
  );
}

