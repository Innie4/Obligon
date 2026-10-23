import { PartnershipShell } from "@/components/dashboard/PartnershipShell";
import { WorkshopDashboard } from "@/components/dashboard/WorkshopDashboard";

export default function WorkshopPage() {
  return <PartnershipShell><WorkshopDashboard edit /></PartnershipShell>;
}
