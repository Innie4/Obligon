-- Purpose-bound card identity evidence. Existing private table ACLs/RLS remain in force.
ALTER TABLE card_requests
 ADD COLUMN IF NOT EXISTS identity_revision UUID,
 ADD COLUMN IF NOT EXISTS identity_account_name TEXT,
 ADD COLUMN IF NOT EXISTS identity_email TEXT,
 ADD COLUMN IF NOT EXISTS identity_consent_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS identity_email_verified_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS identity_email_login_id TEXT,
 ADD COLUMN IF NOT EXISTS identity_email_code_hash TEXT,
 ADD COLUMN IF NOT EXISTS identity_email_provider VARCHAR(16),
 ADD COLUMN IF NOT EXISTS identity_email_expires_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS identity_email_sent_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS identity_email_attempts INTEGER NOT NULL DEFAULT 0 CHECK (identity_email_attempts BETWEEN 0 AND 5),
 ADD COLUMN IF NOT EXISTS bvn_status VARCHAR(24) NOT NULL DEFAULT 'not_started' CHECK (bvn_status IN ('not_started','starting','pending_consent','pending','matched','mismatch','failed','unavailable','review_required')),
 ADD COLUMN IF NOT EXISTS bvn_reference TEXT,
 ADD COLUMN IF NOT EXISTS bvn_archived_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS bvn_operation_id UUID,
 ADD COLUMN IF NOT EXISTS bvn_consent_url TEXT,
 ADD COLUMN IF NOT EXISTS bvn_checked_revision UUID,
 ADD COLUMN IF NOT EXISTS bvn_checked_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS bvn_name_match BOOLEAN,
 ADD COLUMN IF NOT EXISTS bvn_account_name_match BOOLEAN,
 ADD COLUMN IF NOT EXISTS bvn_dob_match BOOLEAN;

COMMENT ON COLUMN card_requests.identity_revision IS 'Immutable revision bound to the submitted details, email confirmation and provider BVN result.';
COMMENT ON COLUMN card_requests.identity_email_login_id IS 'Server-only scoped Descope login identifier; never reused for account authentication.';
COMMENT ON COLUMN card_requests.bvn_reference IS 'Server-only Flutterwave consent reference. Never contains the BVN or raw identity response.';
COMMENT ON COLUMN card_requests.bvn_status IS 'matched requires a completed provider record with the same BVN and both submitted and account names matching.';

-- Older pending details have neither consent nor purpose-bound confirmation.
-- Preserve payment and encrypted details, but require a fresh customer submission.
UPDATE card_requests SET verification_status='not_started',status='pending'
 WHERE identity_revision IS NULL AND verification_status='pending' AND issuance_state='not_started'
   AND issued_card_id IS NULL AND status='pending_verification';
