import { safeInternalPath } from "@/lib/auth-routing";

export function companyInvitationPath(token: string | null | undefined): string | null {
  return token && /^[a-f0-9]{48}$/i.test(token) ? `/auth/company-invitation?invite=${encodeURIComponent(token)}` : null;
}

export function authReturnPath(search: string): string | null {
  const params = new URLSearchParams(search);
  return safeInternalPath(params.get("returnUrl")) ?? companyInvitationPath(params.get("invite"));
}

export function withAuthReturn(path: string, destination: string | null): string {
  const safePath = safeInternalPath(destination);
  return safePath ? `${path}?returnUrl=${encodeURIComponent(safePath)}` : path;
}
