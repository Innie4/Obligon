import { createHash } from "node:crypto";
import { verifyAccessToken } from "../lib/security.js";
import { unauthorized, forbidden } from "../lib/errors.js";
import { one } from "../db.js";

/** Attach req.user when a valid bearer token is present. Optional (public or hybrid routes). */
export async function attachUser(req, _res, next) {
  const header = req.headers.authorization ?? "";
  // EventSource cannot set headers — accept the access token via ?token= too.
  const queryToken =
    req.path === "/api/realtime/stream" && typeof req.query?.token === "string"
      ? req.query.token
      : null;
  const token = header.startsWith("Bearer ") ? header.slice(7) : queryToken;
  if (token) {
    try {
      if (token.startsWith("oblp_")) {
        const path = req.originalUrl.split("?")[0];
        const allowed = new Set([
          "/api/partner/transactions",
          "/api/partner/transactions/export",
          "/api/partner/pricing",
          "/api/partner/stations",
          "/api/partner/reports",
          "/api/partner/reports/export",
        ]);
        if (req.method !== "GET" || !allowed.has(path)) return next();
        const user = await one(
          `SELECT u.*,o.id AS "orgId",o.type AS "orgType" FROM partner_api_keys k
          JOIN users u ON u.id=k.created_by JOIN organizations o ON o.id=k.organization_id
          JOIN memberships m ON m.organization_id=o.id AND m.user_id=u.id
          JOIN subscriptions s ON s.organization_id=o.id JOIN pricing_plans p ON p.code=s.plan_code
          WHERE k.token_hash=$1 AND k.revoked_at IS NULL AND k.expires_at>now() AND u.status='active'
          AND m.status='active' AND m.role IN('owner','admin') AND s.status='active'
          AND s.current_period_start<=now() AND s.current_period_end>now() AND p.active AND p.features @> '["API access"]'::jsonb`,
          [createHash("sha256").update(token).digest("hex")],
        );
        if (user) req.user = user;
        return next();
      }
      const payload = verifyAccessToken(token);
      const user = await one(
        payload.sid
          ? `SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id
             WHERE u.id = $1 AND u.status = 'active' AND s.id = $2
               AND s.revoked_at IS NULL AND s.expires_at > now()`
          : "SELECT * FROM users WHERE id = $1 AND status = 'active'",
        payload.sid ? [payload.sub, payload.sid] : [payload.sub],
      );
      if (user) {
        req.auth = payload;
        req.user = {
          ...user,
          orgId: payload.org ?? null,
          orgType: payload.orgType ?? null,
        };
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
    if (!allowed.includes(req.user.role))
      return next(
        forbidden(`This area requires role: ${allowed.join(" or ")}`),
      );
    next();
  };
}

/**
 * Ensure the caller belongs to the org named in their token, and attach `req.org`.
 *
 * `requireOrg` is the existing membership check and it is correct — but it reads
 * the org id from `req.params.orgId ?? req.user.orgId`, and `req.user.orgId` is
 * the `org` claim *inside the JWT*. Nothing re-checks that claim against the
 * `memberships` table, so the org a request acts on is whatever the token said at
 * issue time.
 *
 * That matters because the partner router used no membership check at all: it
 * only asserted `req.user.orgId` was truthy. So removing a staff member — deleting
 * their `memberships` row, which is what `DELETE /staff/:memberId` does — revoked
 * nothing. Their access token carried `org`, stayed valid for its full lifetime,
 * and kept read and write access to that org's stations, transactions, payouts,
 * bank accounts and staff. It survives until the token expires, and because
 * `/refresh` re-reads the org from the database, the exposure is bounded by one
 * access-token period rather than the whole session — but "bounded by 15 minutes"
 * is not the same as revoked, and nothing in the system said so.
 *
 * This closes it: membership is read from the database on every request, so
 * removing someone takes effect immediately rather than at token expiry.
 */
export async function requireOrgMembership(req, _res, next) {
  if (!req.user) return next(unauthorized());
  const orgId = req.user.orgId;
  if (!orgId)
    return next(forbidden("No organization is linked to this account"));

  const membership = await one(
    `SELECT m.id, m.role AS member_role, m.status AS member_status, m.permissions,
            o.type AS org_type, o.name AS org_name, o.verification_status
     FROM memberships m
     JOIN organizations o ON o.id = m.organization_id
     WHERE m.organization_id = $1 AND m.user_id = $2`,
    [orgId, req.user.id],
  );

  if (!membership) {
    // The token names an org this account is no longer a member of. Access was
    // revoked; say so rather than reporting a generic auth failure.
    return next(
      forbidden(
        "Your access to this organisation has ended. Sign in again, or ask the account owner to restore your access.",
      ),
    );
  }
  if (membership.member_status !== "active") {
    return next(forbidden("Your account at this organisation is not active."));
  }

  req.org = membership;
  // The membership's role is authoritative — not the token's — so a demotion takes
  // effect on the next request.
  req.orgRole = membership.member_role ?? "viewer";
  next();
}

/**
 * Require a capability for the caller's org role.
 *
 * `permissions` on a membership is a list of capabilities; a role grants a set.
 * The role check is what the product actually relies on, so it is expressed as
 * ordinal ranking rather than a scattered list of role names at every call site.
 */
const ROLE_RANK = { viewer: 0, dispatcher: 1, manager: 2, admin: 3, owner: 4 };

export function requireOrgRole(minimum) {
  const needed = ROLE_RANK[minimum];
  if (needed === undefined)
    throw new Error(`requireOrgRole: unknown role "${minimum}"`);
  return (req, _res, next) => {
    const rank = ROLE_RANK[req.orgRole] ?? -1;
    if (rank < needed) {
      return next(forbidden(`This action needs the ${minimum} role or above.`));
    }
    next();
  };
}

/** Require an explicit capability on the membership, regardless of role. */
export function requireCapability(capability) {
  return (req, _res, next) => {
    if (req.orgRole === "owner") return next();
    const perms = req.org?.permissions;
    if (Array.isArray(perms) && perms.includes(capability)) return next();
    return next(forbidden(`Missing permission: ${capability}`));
  };
}

/** Ensure the user belongs to the org (owner or active membership) and attach req.org. */
export async function requireOrg(req, _res, next) {
  if (!req.user) return next(unauthorized());
  const orgId = req.params.orgId ?? req.user.orgId;
  if (!orgId)
    return next(forbidden("No organization is linked to this account"));
  const membership = await one(
    `SELECT m.role AS member_role, m.permissions, o.* FROM organizations o
     LEFT JOIN memberships m ON m.organization_id = o.id AND m.user_id = $2
     WHERE o.id = $1`,
    [orgId, req.user.id],
  );
  if (!membership)
    return next(forbidden("You do not belong to this organization"));
  if (membership.owner_user_id !== req.user.id && !membership.member_role) {
    return next(forbidden("You are not a member of this organization"));
  }
  req.org = membership;
  req.orgRole =
    membership.owner_user_id === req.user.id
      ? "owner"
      : (membership.member_role ?? "viewer");
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
