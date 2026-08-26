"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { routes } from "@/components/site/routes";
import { useSession } from "@/components/shared/AuthContext";

export default function LogoutPage() {
  const router = useRouter();
  const { logout, status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      // In a real app, this would call an API logout endpoint
      // await api.logout();
      // For now, just clear local session
    }
    router.push("/login");
  }, []);

  return (
    <AuthShell compact>
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto animate-spin text-obligon-green" />
          <p className="mt-4 text-obligon-text">Signing you out...</p>
        </div>
      </div>
    </AuthShell>
  );
}