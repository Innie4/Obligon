import { AuthShell } from "@/components/auth/AuthShell";
import { AuthStatus } from "@/components/auth/AuthStatus";

export default function AuthSuccessPage() {
  return (
    <AuthShell compact>
      <AuthStatus status="success" />
    </AuthShell>
  );
}

