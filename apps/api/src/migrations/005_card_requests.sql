-- 005: persisted customer card requests
CREATE TABLE IF NOT EXISTS card_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  label TEXT NOT NULL DEFAULT 'Fuel Card',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS card_requests_one_open_per_user_idx
  ON card_requests(user_id) WHERE status IN ('pending','approved');
CREATE INDEX IF NOT EXISTS card_requests_user_created_idx
  ON card_requests(user_id, created_at DESC);

ALTER TABLE card_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_requests_self_select ON card_requests FOR SELECT
  USING (user_id = public.current_obligon_user_id());
CREATE POLICY card_requests_self_insert ON card_requests FOR INSERT
  WITH CHECK (user_id = public.current_obligon_user_id());
