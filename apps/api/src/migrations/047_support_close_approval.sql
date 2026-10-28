SET LOCAL lock_timeout = '5s';

ALTER TABLE support_tickets ADD COLUMN support_revision integer NOT NULL DEFAULT 0 CHECK (support_revision >= 0);
ALTER TABLE support_tickets ADD COLUMN closure_pending_request_id uuid;

CREATE TABLE support_ticket_close_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason varchar(1000) NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn','cancelled')),
  decided_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  decision_note varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE(ticket_id,id),
  CHECK ((status='pending' AND decided_at IS NULL AND decided_by IS NULL) OR (status<>'pending' AND decided_at IS NOT NULL))
);
CREATE UNIQUE INDEX support_ticket_one_pending_close_idx ON support_ticket_close_requests(ticket_id) WHERE status='pending';
CREATE INDEX support_ticket_close_history_idx ON support_ticket_close_requests(ticket_id,created_at DESC);
ALTER TABLE support_tickets ADD CONSTRAINT support_pending_close_matches_ticket FOREIGN KEY(id,closure_pending_request_id) REFERENCES support_ticket_close_requests(ticket_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE support_tickets ADD CONSTRAINT support_pending_close_is_active CHECK(closure_pending_request_id IS NULL OR status='active');

CREATE FUNCTION increment_support_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.support_revision := OLD.support_revision + 1;
  RETURN NEW;
END;
$$;
CREATE TRIGGER support_ticket_revision BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION increment_support_revision();

-- A new message makes an earlier proposed closure stale, including replies from existing customer clients.
CREATE FUNCTION refresh_support_after_message() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ticket support_tickets%ROWTYPE;
BEGIN
  -- Message foreign keys hold KEY SHARE; a stronger UPDATE lock can deadlock concurrent replies.
  SELECT * INTO ticket FROM support_tickets WHERE id=NEW.ticket_id FOR NO KEY UPDATE;
  IF ticket.closure_pending_request_id IS NOT NULL THEN
    UPDATE support_ticket_close_requests SET status='cancelled',decided_by=NEW.sender_user_id,decision_note='New message received',decided_at=now()
    WHERE id=ticket.closure_pending_request_id AND status='pending';
    INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    VALUES(NEW.sender_user_id,NEW.sender_role,'support.closure_cancelled','ticket',ticket.id,jsonb_build_object('requestId',ticket.closure_pending_request_id,'messageId',NEW.id,'reason','new_message'));
  END IF;
  IF ticket.status='closed' AND NEW.sender_role<>'admin' THEN
    INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    VALUES(NEW.sender_user_id,NEW.sender_role,'support.reopened_by_requester','ticket',ticket.id,jsonb_build_object('messageId',NEW.id));
  END IF;
  UPDATE support_tickets SET closure_pending_request_id=NULL,
    status=CASE WHEN ticket.closure_pending_request_id IS NOT NULL OR (ticket.status='closed' AND NEW.sender_role<>'admin') THEN 'active' ELSE status END,
    updated_at=now() WHERE id=NEW.ticket_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER support_message_refresh AFTER INSERT ON ticket_messages FOR EACH ROW EXECUTE FUNCTION refresh_support_after_message();

ALTER TABLE support_ticket_close_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE support_ticket_close_requests FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION increment_support_revision() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION refresh_support_after_message() FROM PUBLIC,anon,authenticated;
