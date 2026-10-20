-- Preserve existing hashed codes as local verification. New contact OTPs retain
-- their provider and canonical recipient so configuration/contact changes cannot
-- redirect an outstanding proof. Password reset and MFA continue using local codes.
-- This private table retains migration 032 ownership, ACLs and RLS. Existing
-- user/purpose indexing covers these lookups; no additional index is required.
-- PostgreSQL applies this constant default without rewriting existing rows.
ALTER TABLE public.verification_codes
  ADD COLUMN IF NOT EXISTS delivery_provider text NOT NULL DEFAULT 'local'
    CHECK (delivery_provider IN ('local', 'descope')),
  ADD COLUMN IF NOT EXISTS destination text;

COMMENT ON COLUMN public.verification_codes.delivery_provider IS
  'Provider bound to this issued verification record; legacy local hashes remain local after provider configuration changes.';
COMMENT ON COLUMN public.verification_codes.destination IS
  'Canonical recipient bound to a managed contact OTP; trusted API access only. NULL for legacy local codes.';
