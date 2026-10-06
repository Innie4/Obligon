"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "@/components/shared/AuthContext";
import { routes } from "@/components/site/routes";

type Role = "customer" | "partner" | "company" | "mechanic" | "admin";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
  redirectTo?: string;
}

const rolePaths: Record<Role, string> = {
  customer: "/customer",
  partner: "/dashboard",
  company: "/company",
  mechanic: "/dashboard",
  admin: "/admin",
};

export function AuthGuard({
  children,
  allowedRoles,
  redirectTo,
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  // `refresh` is not read: the guard redirects rather than revalidating, and a
  // session that needs refreshing is refreshed by the API client on its next call.
  // Destructured away explicitly so it does not read as an oversight.
  const { status, user } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      const redirectUrl = redirectTo ?? routes.login;
      router.push(`${redirectUrl}?returnUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    // An empty allow-list means "no role may view this", so the check is on
    // `allowedRoles` being *provided*, not on it being non-empty. Skipping the empty
    // case inverted the meaning of the one caller that passes an empty list:
    // `PartnershipShell` passes `[]` for a partner page the API refuses to a mechanic
    // account, and the guard read `[]` as "no restriction" and rendered the page
    // anyway — a full editable fuel-price form whose every submission 403s.
    //
    // Only `PartnershipShell` passes an empty list, and it does so deliberately. The
    // other callers (customer, company, admin) all pass a single non-empty role, so
    // an omitted `allowedRoles` still means "any signed-in role".
    if (user && allowedRoles) {
      if (!allowedRoles.includes(user.role)) {
        const correctPath = rolePaths[user.role];
        // Compared for equality, not with `startsWith`. The prefix test could never
        // fire for a mechanic: their home is `/dashboard` and the pages the API
        // refuses are `/dashboard/fuel-pricing`, `/dashboard/settlements` and so on,
        // which all start with it — so the guard decided there was nowhere to send
        // them and rendered the forbidden page in place.
        if (pathname !== correctPath) {
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

  // Nothing is mounted for a role that is not permitted, so the page never appears
  // for the frames between the guard deciding and the redirect landing. The effect
  // above has already scheduled the navigation; rendering through it would flash a
  // form the user is not allowed to fill in.
  if (user && allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Requires a signed-in session, of any role.
 *
 * `redirectTo` is accepted for signature compatibility with `AuthGuard` but not
 * used: there is nowhere to redirect to without knowing the user's role, which is
 * exactly what this component declines to require. `RoleGuard` is for that.
 */
export function RequireAuth({ children, redirectTo: _redirectTo }: { children: React.ReactNode; redirectTo?: string }) {
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
      // Equality, not `startsWith` — see AuthGuard above. A mechanic's home is
      // `/dashboard`, which prefixes every partner page the API refuses, so the
      // prefix test could not fire for them.
      if (pathname !== correctPath) {
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