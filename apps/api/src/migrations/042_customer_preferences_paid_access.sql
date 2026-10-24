-- Existing accounts have already seen location controls. Only new accounts receive a first-use prompt.
ALTER TABLE users
 ADD COLUMN IF NOT EXISTS ui_theme VARCHAR(5) NOT NULL DEFAULT 'light' CHECK (ui_theme IN ('light','dark')),
 ADD COLUMN IF NOT EXISTS station_location_prompted BOOLEAN NOT NULL DEFAULT TRUE,
 ADD COLUMN IF NOT EXISTS station_location_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN station_location_prompted SET DEFAULT FALSE;
COMMENT ON COLUMN users.station_location_enabled IS 'Consent preference only; device coordinates are never persisted here.';

ALTER TABLE card_requests ADD COLUMN IF NOT EXISTS subscription_activated_at TIMESTAMPTZ;
COMMENT ON COLUMN card_requests.subscription_activated_at IS 'One-time paid dashboard access activation; card approval and callback replays cannot restart the paid period.';

-- Preserve already-started paid periods exactly, including canceled periods.
UPDATE card_requests r SET subscription_activated_at=s.current_period_start
 FROM customer_subscriptions s WHERE s.user_id=r.user_id AND s.payment_reference=r.payment_reference
 AND r.subscription_activated_at IS NULL;

-- Grandfather paid applicants whose old contract started the period at card approval.
-- Give that waiting group its full month now, without changing the immutable payment timestamp.
WITH candidates AS (
 SELECT DISTINCT ON(r.user_id) r.id FROM card_requests r
 WHERE r.subscription_activated_at IS NULL AND r.payment_status='paid' AND r.paid_at IS NOT NULL
   AND r.plan_code IS NOT NULL AND r.status NOT IN('withdrawn','cancelled','rejected')
   AND r.issuance_state NOT IN('refund_pending','refunded')
   AND NOT EXISTS(SELECT 1 FROM customer_subscriptions s WHERE s.user_id=r.user_id)
 ORDER BY r.user_id,r.paid_at DESC,r.id
), eligible AS (
 UPDATE card_requests r SET subscription_activated_at=now() WHERE r.id IN(SELECT id FROM candidates)
 RETURNING r.user_id,r.plan_code,r.payment_reference,r.subscription_activated_at
)
INSERT INTO customer_subscriptions(user_id,plan_code,payment_reference,current_period_start,current_period_end)
 SELECT user_id,plan_code,payment_reference,subscription_activated_at,subscription_activated_at+interval '1 month' FROM eligible
 ON CONFLICT(user_id) DO NOTHING;

-- A historical full withdrawal must not retain access on that same charge.
UPDATE customer_subscriptions s SET status='canceled',updated_at=now()
 FROM card_requests r WHERE r.user_id=s.user_id AND r.payment_reference=s.payment_reference
 AND (r.status='withdrawn' OR r.payment_status='refunded');
