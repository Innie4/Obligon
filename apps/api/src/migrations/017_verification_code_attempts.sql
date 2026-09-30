-- 017: bound the guesses against a verification code.
--
-- Signup now sends an OTP to both the email address and the phone number the
-- account was registered with, so the confirm endpoints are on the critical path
-- of every new account rather than an optional extra. A six-digit code is a
-- million possibilities inside a ten-minute window, and the confirm endpoints
-- previously had no rate limit and no attempt counter: an authenticated session
-- could guess continuously, and an attacker holding one leaked session could keep
-- verifying accounts they do not own.
--
-- The counter lives on the code rather than in memory, so it survives a restart
-- and applies per code: a new code starts a fresh allowance, and burning one
-- code's allowance does not lock out a resend.
--
-- Rollback: DROP COLUMN. Confirmation reverts to unlimited attempts inside the
-- existing expiry window.

ALTER TABLE verification_codes
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0
    CHECK (attempts >= 0);

-- Kept in step with MAX_CODE_ATTEMPTS in routes/auth.routes.js. Five is chosen
-- because a real person mistyping six digits is rare, while five guesses against
-- a million-key space is not a search.
ALTER TABLE verification_codes
  ADD CONSTRAINT verification_codes_attempt_cap CHECK (attempts <= 10);
