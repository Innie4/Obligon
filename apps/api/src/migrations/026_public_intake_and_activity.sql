ALTER TABLE contact_messages ADD COLUMN phone TEXT;
ALTER TABLE support_tickets ADD COLUMN contact_message_id UUID UNIQUE REFERENCES contact_messages(id);
ALTER TABLE support_tickets ADD COLUMN contact_name TEXT;
ALTER TABLE support_tickets ADD COLUMN contact_email TEXT;
ALTER TABLE support_tickets ADD COLUMN contact_phone TEXT;
ALTER TABLE ticket_messages ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'saved';
ALTER TABLE notifications ADD COLUMN in_app_visible BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX audit_created_idx ON audit_logs(created_at DESC, id);
CREATE INDEX support_contact_idx ON support_tickets(contact_email) WHERE contact_email IS NOT NULL;
-- Recover only unambiguous legacy public contacts, never guess an identity.
UPDATE support_tickets t SET contact_message_id=c.id,contact_name=c.name,contact_email=c.email,contact_phone=c.phone
FROM contact_messages c WHERE t.user_id IS NULL AND t.contact_message_id IS NULL AND t.message=c.message
AND ABS(EXTRACT(EPOCH FROM t.created_at-c.created_at))<60
AND (SELECT count(*) FROM contact_messages x WHERE x.message=t.message AND ABS(EXTRACT(EPOCH FROM t.created_at-x.created_at))<60)=1;
CREATE TABLE email_outbox (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),event_key TEXT NOT NULL UNIQUE,to_email TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','sending','accepted','failed','review')),
 attempts INT NOT NULL DEFAULT 0,last_error TEXT,next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),accepted_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_outbox_pending_idx ON email_outbox(next_attempt_at) WHERE status IN('pending','failed','sending');
-- Transactional, redacted lifecycle history. A failed audit insert rolls back the business write.
CREATE FUNCTION record_business_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r JSONB; old_r JSONB; snapshot JSONB;
BEGIN
 r:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 old_r:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 SELECT COALESCE(jsonb_object_agg(key,value),'{}'::jsonb) INTO snapshot FROM jsonb_each(r)
 WHERE key IN('reference','status','payment_status','verification_status','issuance_state','organization_id','partner_org_id','customer_user_id','user_id','station_id','plan_code','amount_kobo','gross_kobo','net_kobo','paid_kobo','fee_kobo','charged_kobo','discount_percent','starts_at','ends_at','delivery_status');
 INSERT INTO audit_logs(actor_role,action,entity_type,entity_id,metadata)
 VALUES('system',TG_TABLE_NAME||'.'||lower(TG_OP),TG_TABLE_NAME,COALESCE(r->>'id',r->>'code'),snapshot||jsonb_build_object('previousStatus',old_r->>'status'));
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DO $$ DECLARE tbl TEXT; BEGIN
 FOREACH tbl IN ARRAY ARRAY['transactions','wallet_topups','fuel_orders','subscription_payments','customer_subscriptions','subscriptions','payment_refunds','payouts','settlements','cards','card_requests','bank_accounts','settlement_accounts','stations','station_discounts','fuel_prices','support_tickets','ticket_messages','contact_messages','job_applications','job_postings','leads','data_requests','resupply_orders','equipment','memberships','invites','email_outbox'] LOOP
 IF to_regclass(tbl) IS NOT NULL THEN EXECUTE format('CREATE TRIGGER business_activity AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION record_business_activity()',tbl); END IF;
 END LOOP;
END $$;
