-- Include account access and dispute decisions in the redacted activity register.
CREATE TRIGGER business_activity AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION record_business_activity();
CREATE TRIGGER business_activity AFTER INSERT OR UPDATE OR DELETE ON disputes FOR EACH ROW EXECUTE FUNCTION record_business_activity();
CREATE TRIGGER business_activity AFTER INSERT OR UPDATE OR DELETE ON security_logs FOR EACH ROW EXECUTE FUNCTION record_business_activity();
