import { PartnerVerificationUI } from "@/components/dashboard/PartnerVerification";
import { PartnershipShell } from "@/components/dashboard/PartnershipShell";

/**
 * Partner account verification, inside the console.
 *
 * Shares `PartnershipShell` so the sidebar, header and sign-out affordance are the
 * same as every other partner page — this is a step in the dashboard, not a
 * separate site — but deliberately does not wrap the body in `DashboardCanvas`, so
 * the centred card reads as a focused task rather than as another table page.
 */
export default function PartnerVerificationPage() {
  return (
    <PartnershipShell>
      <PartnerVerificationUI />
    </PartnershipShell>
  );
}