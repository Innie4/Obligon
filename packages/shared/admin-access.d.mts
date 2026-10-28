export type AdminRole = "super_admin" | "supervisor" | "staff";
export type AdminPageKey = "companies" | "intake" | "discounts" | "applications" | "benefits" | "operations" | "disputes" | "reports" | "staff";
export type AdminIdentity = { role?: string | null; staff_role?: string | null; staff_permissions?: string[] | null };
export const ADMIN_ROLES: readonly { value: AdminRole; label: string }[];
export const ADMIN_PAGES: readonly { key: AdminPageKey; title: string; href: string }[];
export function normalizeAdminRole(value: unknown): AdminRole | null;
export function hasAdminPage(user: AdminIdentity | null | undefined, key: string): boolean;
export function adminPageForPath(path: string): AdminPageKey | null;
export function adminPageForApiPath(path: string): AdminPageKey | null;
