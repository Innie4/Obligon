"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "@/components/shared/AuthContext";
import { routes } from "@/components/site/routes";

type Role = "customer" | "partner" | "company" | "admin";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
  redirectTo?: string;
}

const rolePaths: Record<Role, string> = {
  customer: "/customer",
  partner: "/dashboard",
  company: "/company",
  admin: "/admin",
};

export function AuthGuard({
  children,
  allowedRoles,
  redirectTo,
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, refresh } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      const redirectUrl = redirectTo ?? routes.login;
      router.push(`${redirectUrl}?returnUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    if (user && allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(user.role)) {
        const correctPath = rolePaths[user.role];
        if (!pathname.startsWith(correctPath)) {
          router.push(correctPath);
        }
      }
    }
  }, [status, user, pathname, router, allowedRoles, redirectTo]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-obligon-green border-t-transparent" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <>{children}</>;
}

export function RequireAuth({ children, redirectTo }: { children: React.ReactNode; redirectTo?: string }) {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-obligon-green border-t-transparent" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <>{children}</>;
}

export function RoleGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: Role[];
}) {
  const { status, user } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") return;

    if (user && !allowedRoles.includes(user.role)) {
      const correctPath = rolePaths[user.role];
      if (!pathname.startsWith(correctPath)) {
        router.push(correctPath);
      }
    }
  }, [status, user, pathname, router, allowedRoles]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-obligon-green border-t-transparent" />
      </div>
    );
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}