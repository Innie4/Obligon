ALTER TABLE stations ADD COLUMN review_note TEXT;
ALTER TABLE stations ADD COLUMN reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE stations ADD COLUMN reviewed_at TIMESTAMPTZ;
CREATE TRIGGER business_activity AFTER INSERT OR UPDATE OR DELETE ON top_ups FOR EACH ROW EXECUTE FUNCTION record_business_activity();
CREATE TRIGGER business_activity AFTER INSERT OR UPDATE OR DELETE ON station_discount_requests FOR EACH ROW EXECUTE FUNCTION record_business_activity();
CREATE TRIGGER business_activity AFTER INSERT OR UPDATE OR DELETE ON wallet_ledger FOR EACH ROW EXECUTE FUNCTION record_business_activity();
