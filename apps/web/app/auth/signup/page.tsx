import { AuthForms } from "@/components/auth/AuthForms";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignupPage() {
  return (
    <AuthShell>
      <AuthForms mode="signup" />
    </AuthShell>
  );
}
