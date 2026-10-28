import { one } from "../db.js";
import { asyncHandler, forbidden, badRequest } from "../lib/errors.js";
import { ADMIN_PAGES, normalizeAdminRole, hasAdminPage, adminPageForApiPath } from "../../../../packages/shared/admin-access.mjs";

export const requireAdminPage = asyncHandler(async (req, _res, next) => {
  const user = await one(`SELECT id,role,status,staff_role,staff_permissions FROM users
    WHERE id=$1 AND role='admin' AND status='active'
      AND (access_expires_at IS NULL OR access_expires_at>clock_timestamp())`, [req.user.id]);
  const page = adminPageForApiPath(req.path);
  if (!user || !page || !hasAdminPage(user, page)) throw forbidden("You do not have access to this administration page");
  req.user = { ...req.user, ...user };
  req.adminAccess = { role: user.staff_role, permissions: user.staff_permissions };
  next();
});

export function validateAdminGrants(role, permissions) {
  if (!normalizeAdminRole(role)) throw badRequest("Choose Super Admin, Supervisor or Staff");
  if (!Array.isArray(permissions) || !permissions.length || permissions.length > ADMIN_PAGES.length ||
    permissions.some(key => !ADMIN_PAGES.some(page => page.key === key)) || new Set(permissions).size !== permissions.length) {
    throw badRequest("Select at least one valid administration page");
  }
  if (role !== "super_admin" && permissions.includes("staff")) throw badRequest("Only Super Admins can manage staff and access");
  return permissions;
}

// Serialize privilege changes so two managers cannot revoke each other at once.
export async function lockAdminStaffManager(t, req) {
  await t.query("SELECT pg_advisory_xact_lock(hashtext('obligon:admin-staff-management'))");
  const current = await t.one(`SELECT id,role,status,staff_role,staff_permissions FROM users
    WHERE id=$1 AND status='active' AND role='admin'
      AND (access_expires_at IS NULL OR access_expires_at>clock_timestamp()) FOR UPDATE`, [req.user.id]);
  if (!current || current.staff_role !== "super_admin" || !hasAdminPage(current, "staff")) throw forbidden("A current Super Admin with staff access is required");
  return current;
}
