import { api } from "@/lib/services";
import { readTokens, writeTokens } from "@/lib/session-store";
import type { SessionUser } from "@/lib/services/types";

export interface CompanyInvitation {
  organizationId: string;
  companyName: string;
  role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
}
export interface CompanyContextOption { id: string; name: string }

export const companyInvitationsApi = {
  read(token: string) {
    return api.request<{ invitation: CompanyInvitation }>(`/api/auth/company-invitations/${encodeURIComponent(token)}`);
  },
  accept(token: string) {
    return api.request<{ ok: boolean; organization: CompanyContextOption }>(`/api/auth/company-invitations/${encodeURIComponent(token)}/accept`, { method: "POST", body: "{}" });
  },
  contexts() {
    return api.request<{ organizations: CompanyContextOption[] }>("/api/auth/company-contexts");
  },
  async select(organizationId: string | null): Promise<SessionUser> {
    const tokens = readTokens();
    if (!tokens?.refreshToken) throw new Error("Sign in again before selecting a company.");
    const result = await api.request<{ user: SessionUser; accessToken: string; refreshToken: string }>("/api/auth/company-context", {
      method: "POST", body: JSON.stringify({ organizationId, refreshToken: tokens.refreshToken })
    });
    if (readTokens()?.refreshToken !== tokens.refreshToken) throw new Error("Your session changed. Please select your company again.");
    writeTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    return result.user;
  }
};
