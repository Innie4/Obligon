-- 015: a projected monthly spend, set by the customer.
--
-- The dashboard's MTD Spend card had a "Budget Usage" bar driven by
-- wallets.budget_limit_kobo. That column is a single standing limit: it is not
-- per month, so it silently carried last month's intention into this month, and
-- a customer who had never set one saw a dead "-" bar with no way to fix it from
-- anywhere in the UI.
--
-- A projection is a forward-looking statement about one specific month: "I
-- expect to spend about this much". It is therefore keyed by month, so the first
-- of the month is genuinely a new question, and a new customer has no answer for
-- any month. Both cases are the same condition — no row for the current month —
-- which is why the prompt needs no separate "is this a new account" check.
--
-- The key is (user_id, month) rather than a single column on the wallet so that
-- changing a projection is an update, not a destructive overwrite of the last
-- one, and so a projection can be adjusted in either direction without any
-- history of the previous value being needed to explain the current bar.
--
-- Rollback: DROP TABLE monthly_spend_projections. The MTD Spend card falls back
-- to the wallet budget limit, which is what it showed before.

CREATE TABLE IF NOT EXISTS monthly_spend_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Always the first of the month. Storing a normalised date rather than a
  -- timestamp means "which month is this for" can never be ambiguous because of
  -- a timezone, and date_trunc() in Postgres is the single definition of it.
  month DATE NOT NULL,
  projected_kobo BIGINT NOT NULL CHECK (projected_kobo > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

CREATE INDEX IF NOT EXISTS monthly_spend_projections_user_month_idx
  ON monthly_spend_projections(user_id, month DESC);

-- A projection of zero is refused at the database level, not only in the route.
-- The usage bar divides by this figure, and a zero projection would either crash
-- that division or read as 0% used when it means "no expectation set".
ALTER TABLE monthly_spend_projections
  ADD CONSTRAINT monthly_spend_projections_positive CHECK (projected_kobo > 0);
