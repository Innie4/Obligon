import { env } from "../config/env.js";

/**
 * Supabase Auth (GoTrue) integration.
 *
 * When SUPABASE_AUTH_ENABLED=true (and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * are set), credential management is delegated to Supabase Auth:
 *   - signup creates the auth user (email confirmed, since the app sends its
 *     own verification codes)
 *   - login validates credentials against Supabase Auth
 *   - password changes/resets update the Supabase Auth user via the admin API
 *
 * The local `users.password_hash` column still exists: when Supabase Auth is
 * enabled it stores an unusable placeholder so bcrypt fallback can never match.
 * When Supabase Auth is disabled everything falls back to local bcrypt so the
 * platform runs with DATABASE_URL alone.
 */

const enabled = () =>
  env.SUPABASE_AUTH_ENABLED === true && Boolean(env.SUPABASE_URL) && Boolean(env.SUPABASE_SERVICE_ROLE_KEY);

export const supabaseAuthEnabled = enabled;

const ANON_HEADERS = () => ({
  apikey: env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
  "Content-Type": "application/json"
});

const ADMIN_HEADERS = () => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json"
});

async function gotrue(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1${path}`, {
    method,
    headers: headers ?? ANON_HEADERS(),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Create the Supabase Auth user. Returns { authUserId } or throws with message. */
export async function supabaseSignUp({ email, password, fullName }) {
  if (!enabled()) return { local: true };
  const { ok, data } = await gotrue("/admin/users", {
    method: "POST",
    headers: ADMIN_HEADERS(),
    body: {
      email,
      password,
      email_confirm: true, // the app handles its own verification codes
      user_metadata: { full_name: fullName ?? "" }
    }
  });
  if (!ok) {
    const msg = data?.msg || data?.message || "Supabase Auth signup failed";
    const err = new Error(msg);
    err.status = data?.code === 422 ? 409 : 502;
    throw err;
  }
  return { authUserId: data.id };
}

/** Validate credentials against Supabase Auth. Returns { authUserId } or null. */
export async function supabaseSignIn({ email, password }) {
  if (!enabled()) return null;
  const { ok, data } = await gotrue("/token?grant_type=password", {
    method: "POST",
    body: { email, password }
  });
  if (!ok) return null;
  return { authUserId: data.user?.id ?? null };
}

/** Update a Supabase Auth user's password via admin API. */
export async function supabaseUpdatePassword({ authUserId, password }) {
  if (!enabled() || !authUserId) return { local: true };
  const { ok, data } = await gotrue(`/admin/users/${authUserId}`, {
    method: "PUT",
    headers: ADMIN_HEADERS(),
    body: { password }
  });
  if (!ok) {
    throw Object.assign(new Error(data?.msg || "Supabase Auth password update failed"), { status: 502 });
  }
  return { ok: true };
}

/**
 * Placeholder hash stored locally when Supabase Auth owns credentials.
 * bcrypt.compare against this never succeeds, so if Supabase Auth is ever
 * disabled the affected users must reset their passwords (documented).
 */
export const LOCAL_AUTH_PLACEHOLDER = "$supabase-auth$managed-credentials";
