import { AuthShell } from "@/components/auth/AuthShell";
import { AuthStatus } from "@/components/auth/AuthStatus";

export default function AuthInProgressPage() {
  return (
    <AuthShell compact>
      <AuthStatus status="progress" />
    </AuthShell>
  );
}

