-- Existing accounts explicitly enroll these independent sign-in methods.
SET LOCAL lock_timeout = '5s';
CREATE TABLE account_google_identities (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 issuer TEXT NOT NULL CHECK (issuer='https://accounts.google.com'),
 subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(issuer,subject)
);
CREATE TABLE account_passkeys (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 credential_id TEXT NOT NULL UNIQUE,
 public_key BYTEA NOT NULL,
 counter BIGINT NOT NULL CHECK(counter BETWEEN 0 AND 4294967295),
 transports TEXT[] NOT NULL DEFAULT '{}',
 label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 100),
 device_type TEXT NOT NULL CHECK(device_type IN ('singleDevice','multiDevice')),
 backed_up BOOLEAN NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_used_at TIMESTAMPTZ
);
CREATE INDEX account_passkeys_user_idx ON account_passkeys(user_id);
CREATE TABLE account_auth_challenges (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 purpose TEXT NOT NULL CHECK(purpose IN ('google_login','google_link','passkey_login','passkey_register')),
 challenge TEXT NOT NULL,
 origin TEXT NOT NULL,
 user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
 context JSONB NOT NULL DEFAULT '{}',
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '5 minutes',
 consumed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX account_auth_challenges_expiry_idx ON account_auth_challenges(expires_at);
ALTER TABLE account_google_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_auth_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON account_google_identities,account_passkeys,account_auth_challenges FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE account_passkeys IS 'Public WebAuthn keys only. Private keys and biometrics stay in authenticators.';
