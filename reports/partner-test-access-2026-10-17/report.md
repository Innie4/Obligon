# One day partner dashboard access

17 October 2026 · Baseline `088d0f0` · Source revision `79e3a0f94bda6c551d2130cd656f94990b6b73979ac2edf9dfee87c4d914c002`

**Qualified human review approval reported by the user for the exact source revision below. Deployment and activation are in progress.** The requested password is not saved in this report, source, patch or learning breakdown. The 24-hour period starts only when the reviewed operator command successfully commits the grant.

## Result to review

- Reuse the exact existing partner test identity and its organization. Preserve its existing station details.
- Verify the supplied password through the normal bcrypt login path; preserve role, rate-limit, lockout, MFA and durable-session checks. This temporary lease does not create a permanent Supabase identity.
- Save one absolute database deadline exactly 24 hours after activation. No startup, login, refresh or subscription renewal extends it.
- Deny login, MFA completion, refresh, authenticated HTTP/API-key requests and realtime delivery after expiry. Cap durable sessions/refresh tokens. Access JWTs retain their usual encoded lifetime but require a live database account/session on every request.
- Restrict the leased account to dashboard reads plus normal login/refresh/logout. Block business writes, credential changes, staff/API-key creation and money movement.
- Revoke old sessions/API keys and turn off automatic settlement for the test organization at activation. Do not add funds, create invoices, erase station details or reset existing MFA/provider credentials.
- Refuse collisions, foreign membership, nonzero balances, credit/settlement limits, provider subscription bindings or financial history, including another customer's sales/orders through the test station.
- Startup remains off by default. It preserves an explicitly activated valid lease; an expired grant remains denied even with the scheduler disabled, then is retired on startup.

## Database impact

Migration033 adds one nullable, no-default timestamptz column to the existing private users table. Existing rows have no new deadline. Ownership, grants and RLS are unchanged; no table rewrite/backfill/index or new infrastructure is required. The existing database-permission suite now expects both migrations032 and033 and still checks private-table/column access denial.

## Live read-only preflight

The configured database contains exactly the expected suspended partner identity, with no MFA or linked Supabase identity and the expected unverified organization. It has one original owner membership, one zero-balance individual wallet and one station. Station-linked sales/orders, cards, payouts, settlements, bank/settlement accounts, invoices and other checked financial history are absent. Organization limits are zero and the enterprise catalog is active. Automatic settlement is currently enabled and will be disabled by the explicit grant. Migration033 is not yet deployed. One transient database connection timeout occurred; the bounded read-only retry succeeded. No production record was changed.

## Verification

Final full API: **1,067 tests, 1,065 passed, zero failures, two expected missing-environment credential-comparison skips**. Thirteen local HTTP smoke cases are included in that total. The 31 new expiry/activation integration cases, three account-expiry unit cases and one SSE race unit case are included, not added. Final source hashes match the tested patch. Offline Trivy reported zero production vulnerabilities and zero secret findings using its cached vulnerability database from14October; this is not a current registry-advisory check. Five CLI validation checks also passed without production queries or writes. The focused expiry reproduction failed against the previous authentication code: expired password and session access returned200, and an expired SSE connection remained open. Focused tests then passed with the fix. The station-history reproduction also failed before its two joins were added. Final results are appended once complete.

The unchanged frontend suite passed284 cases,0 failures,0 skips. No UI or dependency changes are included. Local tests use disposable PostgreSQL and synthetic accounts; external providers are denied or mocked. This does not establish production activation or real-money/provider acceptance.

## Release gate and rollout

The user-provided AGENTS.md requires qualified human review before production release of authentication/authorization changes. Independent agent review is additional code review and does not replace that human requirement. The exact source hashes and complete patch are linked below.

After approval: commit/push only these focused files and their documentation; confirm Render deploys the new source and migration before activation; run the operator preview and the explicit reviewed grant using protected password input; verify normal live login and partner reads; record the precise expiry in Africa/Lagos. Do not start the 24-hour timer before deployment succeeds.

Rollback/revocation: first suspend only the known test identity, revoke its sessions/API keys and cancel its test subscription. Keep the expiry column/data for audit; do not drop it during rollback. The previously deployed default startup also retires that exact test identity. Confirm revocation before removing the new runtime enforcement.

Independent review resolved the provider-identity lifetime, SSE closure race and station-linked financial-history findings. Final review evidence is recorded in the verification receipt. The user reported qualified human approval of this exact patch. Actual deployment and activation are now authorized and pending verification.

## Artifacts

- [Complete application patch](changes.diff)
- [Source revision and hashes](evidence/source-hashes.json)
- [Verification receipt](evidence/verification.json)
- [Learning breakdown](../../learn/2026-10-17-one-day-partner-access.md)
