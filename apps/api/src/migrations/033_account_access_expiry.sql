-- Existing public.users is the application's private identity table. Retain its
-- ownership, RLS and ACLs from migration 032; do not grant access to new roles.
-- Row count/growth are deployment-specific. This nullable, no-default addition
-- requires no backfill or table rewrite. Existing accounts remain unrestricted.
-- Authentication reads by primary key/email, so no additional index is needed.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS access_expires_at timestamptz;
COMMENT ON COLUMN public.users.access_expires_at IS
  'Server-controlled absolute account access deadline; NULL has no additional account deadline. Expiry denies login, refresh, API requests and realtime delivery independently of subscription or scheduler state.';
