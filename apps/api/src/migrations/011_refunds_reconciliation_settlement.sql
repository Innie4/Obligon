-- Money movement, refunds, reconciliation and processor-level settlement.
--
-- Covers four gaps:
--   1. a paid-but-abandoned plan needs a self-serve withdrawal + refund
--   2. pending payments need a reconciliation pass (webhooks alone are not enough)
--   3. card-plan purchases must credit the wallet
--   4. company wallets need a funded path down to a member's spendable balance
--      and, optionally, split settlement at the processor

-- ---------------------------------------------------------------- refunds
-- Every refund we have issued or intend to issue, so a retry can never
-- double-refund and support can answer "was this paid out?".
CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('paystack','flutterwave')),
  provider_ref TEXT NOT NULL,             -- the charge being refunded
  provider_refund_id TEXT,                -- set once the provider accepts it
  kind TEXT NOT NULL DEFAULT 'full' CHECK (kind IN ('full','partial','excess')),
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed')),
  idempotency_key TEXT UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS payment_refunds_user_idx ON payment_refunds(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_refunds_status_idx ON payment_refunds(status) WHERE status = 'pending';
ALTER TABLE payment_refunds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS payment_refunds_provider_ref_idx
  ON payment_refunds(provider, provider_ref) WHERE kind = 'full' AND status <> 'failed';

-- --------------------------------------------------- wallet plan crediting
-- Which plan purchase credited which wallet, and how much, so crediting is
-- idempotent and auditable.
CREATE TABLE IF NOT EXISTS plan_wallet_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_request_id UUID NOT NULL UNIQUE REFERENCES card_requests(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A card request can be withdrawn (and refunded) once it is paid but not yet
-- verified. Tracked explicitly so we never offer a withdrawal twice.
ALTER TABLE card_requests
  ADD COLUMN IF NOT EXISTS refund_id UUID REFERENCES payment_refunds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wallet_credited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reconcile_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;

ALTER TABLE card_requests DROP CONSTRAINT IF EXISTS card_requests_status_check;
ALTER TABLE card_requests ADD CONSTRAINT card_requests_status_check
  CHECK (status IN ('awaiting_payment','pending','pending_verification','approved','rejected','cancelled','refunded','withdrawn'));

CREATE INDEX IF NOT EXISTS card_requests_reconcile_idx
  ON card_requests(status, created_at) WHERE status = 'awaiting_payment';

-- Reconciliation bookkeeping for wallet top-ups too.
ALTER TABLE top_ups
  ADD COLUMN IF NOT EXISTS reconcile_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS top_ups_reconcile_idx
  ON top_ups(status, created_at) WHERE status = 'pending';

-- ------------------------------------------- processor settlement accounts
-- Opt-in separation of money at the processor (Flutterwave collection
-- subaccounts / split payments). When a row is absent the charge settles to the
-- platform account exactly as before, so this is backwards compatible.
CREATE TABLE IF NOT EXISTS settlement_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'flutterwave' CHECK (provider IN ('paystack','flutterwave')),
  subaccount_id TEXT,                     -- processor collection subaccount id
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','suspended','failed')),
  split_ratio_bp INT NOT NULL DEFAULT 0 CHECK (split_ratio_bp BETWEEN 0 AND 10000),
  currency TEXT NOT NULL DEFAULT 'NGN',
  bank_name TEXT,
  account_number TEXT,
  account_number_mask TEXT,
  settlement_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Records the split actually applied to a charge, so reconciliation can prove
-- where the money went.
CREATE TABLE IF NOT EXISTS payment_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_account_id UUID REFERENCES settlement_accounts(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  top_up_id UUID REFERENCES top_ups(id) ON DELETE CASCADE,
  card_request_id UUID REFERENCES card_requests(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_ref TEXT NOT NULL,
  provider_split_id TEXT,
  subaccount_id TEXT NOT NULL,
  ratio_bp INT NOT NULL,
  amount_kobo BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed')),
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_splits_ref_idx ON payment_splits(provider, provider_ref);
CREATE INDEX IF NOT EXISTS payment_splits_org_idx ON payment_splits(organization_id, created_at DESC);
-- One split row per charge per subaccount, so a replayed webhook cannot
-- double-record the same settlement.
CREATE UNIQUE INDEX IF NOT EXISTS payment_splits_once_idx
  ON payment_splits(provider, provider_ref, subaccount_id);
