import { verifyAccessToken } from "../lib/security.js";
import { unauthorized, forbidden } from "../lib/errors.js";
import { one } from "../db.js";

/** Attach req.user when a valid bearer token is present. Optional (public or hybrid routes). */
export async function attachUser(req, _res, next) {
  const header = req.headers.authorization ?? "";
  // EventSource cannot set headers — accept the access token via ?token= too.
  const queryToken = typeof req.query?.token === "string" ? req.query.token : null;
  const token = header.startsWith("Bearer ") ? header.slice(7) : queryToken;
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      const user = await one(
        payload.sid
          ? `SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id
             WHERE u.id = $1 AND u.status = 'active' AND s.id = $2
               AND s.revoked_at IS NULL AND s.expires_at > now()`
          : "SELECT * FROM users WHERE id = $1 AND status = 'active'",
        payload.sid ? [payload.sub, payload.sid] : [payload.sub]
      );
      if (user) {
        req.user = { ...user, orgId: payload.org ?? null, orgType: payload.orgType ?? null };
      }
    } catch {
      // invalid/expired token -> anonymous
    }
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

/** requireRole("admin") or requireRole(["company","partner"]) */
export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!allowed.includes(req.user.role)) return next(forbidden(`This area requires role: ${allowed.join(" or ")}`));
    next();
  };
}

/** Ensure the user belongs to the org (owner or active membership) and attach req.org. */
export async function requireOrg(req, _res, next) {
  if (!req.user) return next(unauthorized());
  const orgId = req.params.orgId ?? req.user.orgId;
  if (!orgId) return next(forbidden("No organization is linked to this account"));
  const membership = await one(
    `SELECT m.role AS member_role, m.permissions, o.* FROM organizations o
     LEFT JOIN memberships m ON m.organization_id = o.id AND m.user_id = $2
     WHERE o.id = $1`,
    [orgId, req.user.id]
  );
  if (!membership) return next(forbidden("You do not belong to this organization"));
  if (membership.owner_user_id !== req.user.id && !membership.member_role) {
    return next(forbidden("You are not a member of this organization"));
  }
  req.org = membership;
  req.orgRole = membership.owner_user_id === req.user.id ? "owner" : (membership.member_role ?? "viewer");
  next();
}

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (req.orgRole === "owner" || req.orgRole === "admin") return next();
    const perms = req.org?.permissions ?? [];
    if (Array.isArray(perms) && perms.includes(permission)) return next();
    return next(forbidden(`Missing permission: ${permission}`));
  };
}
