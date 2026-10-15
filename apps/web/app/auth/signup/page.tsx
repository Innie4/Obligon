import { AuthForms } from "@/components/auth/AuthForms";
import { AuthShell } from "@/components/auth/AuthShell";

import { redirect } from "next/navigation";
import { companyInvitationPath } from "@/lib/company-invitation-routing";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ invite?: string | string[] }> }) {
  const { invite } = await searchParams;
  const destination = companyInvitationPath(typeof invite === "string" ? invite : null);
  if (destination) redirect(destination);
  return (
    <AuthShell>
      <AuthForms mode="signup" />
    </AuthShell>
  );
}
