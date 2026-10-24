"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { AuthShell } from "@/components/auth/AuthShell";
import { routes } from "@/components/site/routes";
import { useSession } from "@/components/shared/AuthContext";

export default function LogoutPage() {
  const router = useRouter();
  const { logout } = useSession();

  useEffect(() => {
    logout().finally(() => router.replace(routes.login));
  }, [logout, router]);

  return (
    <AuthShell compact>
      <h1 className="sr-only">Signing out</h1>
      <StatusPopup tone="loading" title="Signing out" message="Your session is being closed." dismissible={false} />
    </AuthShell>
  );
}
