import { AuthGuard } from "@/components/auth/AuthGuard";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInOptions } from "@/components/auth/SignInOptions";

export default function SignInOptionsPage() {
  return <AuthGuard><AuthShell compact><SignInOptions /></AuthShell></AuthGuard>;
}
