import { AuthShell } from "@/components/auth/AuthShell";
import { AuthStatus } from "@/components/auth/AuthStatus";

export default function AuthFailurePage() {
  return (
    <AuthShell compact>
      <AuthStatus status="failure" />
    </AuthShell>
  );
}

