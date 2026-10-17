/** NULL preserves ordinary account access; malformed deadlines fail closed. */
export function accountAccessExpired(user, now = Date.now()) {
  return user?.access_expires_at != null &&
    !(new Date(user.access_expires_at).getTime() > now);
}
