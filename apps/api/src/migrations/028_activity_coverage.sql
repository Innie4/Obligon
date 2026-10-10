-- Keep delivery payloads accessible only through server-owned, admin-authorized APIs.
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_outbox FROM anon, authenticated;
-- Record operational changes as well as financial lifecycle changes. No identity
-- documents, credentials, account numbers or email bodies enter the audit snapshot.
DO $$ DECLARE tbl TEXT; BEGIN
 FOREACH tbl IN ARRAY ARRAY['organizations','vehicles','fueling_logs','loyalty_redemptions','card_applications','cookie_consents'] LOOP
 IF to_regclass(tbl) IS NOT NULL THEN EXECUTE format('CREATE TRIGGER business_activity AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION record_business_activity()',tbl); END IF;
 END LOOP;
END $$;
