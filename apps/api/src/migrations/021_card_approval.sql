-- Durable review and provider issuance checkpoints. Existing UUID/public schema retained.
ALTER TABLE card_requests
 ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500),
 ADD COLUMN IF NOT EXISTS issuance_state VARCHAR(24) NOT NULL DEFAULT 'not_started',
 ADD COLUMN IF NOT EXISTS provider_card JSONB,
 ADD COLUMN IF NOT EXISTS issued_card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS bvn_encrypted TEXT,
 ADD COLUMN IF NOT EXISTS bvn_last_four VARCHAR(4);
CREATE INDEX IF NOT EXISTS card_requests_admin_review_idx ON card_requests(created_at) WHERE verification_status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS cards_sudo_card_id_uk ON cards(sudo_card_id) WHERE sudo_card_id IS NOT NULL;
COMMENT ON COLUMN card_requests.issuance_state IS 'not_started, creating, provider_created, complete or review_required; ambiguous provider failures must be reconciled before retry';
COMMENT ON COLUMN card_requests.provider_card IS 'Minimal provider-issued identifier, masked PAN and expiry; never stores PAN or CVV';
COMMENT ON COLUMN card_requests.bvn_encrypted IS 'AES-256-GCM identity data under CARD_IDENTITY_KEY, never returned by ordinary APIs';
UPDATE card_requests SET bvn_last_four = right(bvn, 4) WHERE bvn IS NOT NULL;
-- Legacy plaintext identities require resubmission for secure storage and review.
UPDATE card_requests SET bvn = NULL, verification_status = 'not_started' WHERE bvn IS NOT NULL AND verification_status <> 'verified';
UPDATE card_requests SET bvn = NULL WHERE bvn IS NOT NULL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS replacement_state VARCHAR(24), ADD COLUMN IF NOT EXISTS replacement_card JSONB;

ALTER TABLE cards ADD COLUMN IF NOT EXISTS replacement_next_card_id UUID REFERENCES cards(id) ON DELETE SET NULL;

ALTER TABLE card_requests ADD COLUMN IF NOT EXISTS date_of_birth DATE, ADD COLUMN IF NOT EXISTS postal_code VARCHAR(12), ADD COLUMN IF NOT EXISTS identity_phone VARCHAR(30);
