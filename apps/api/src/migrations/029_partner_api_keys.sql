CREATE TABLE partner_api_keys (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id),
 created_by UUID NOT NULL REFERENCES users(id), label VARCHAR(100) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE,
 token_hint VARCHAR(12) NOT NULL, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX partner_api_keys_org_idx ON partner_api_keys(organization_id,created_at DESC);
ALTER TABLE partner_api_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON partner_api_keys FROM anon, authenticated;
COMMENT ON TABLE partner_api_keys IS 'Hashed, revocable, organization-scoped read-only integration credentials';
CREATE TRIGGER business_activity AFTER INSERT OR UPDATE OR DELETE ON partner_api_keys FOR EACH ROW EXECUTE FUNCTION record_business_activity();
CREATE TRIGGER business_activity AFTER INSERT OR UPDATE OR DELETE ON partner_applications FOR EACH ROW EXECUTE FUNCTION record_business_activity();
