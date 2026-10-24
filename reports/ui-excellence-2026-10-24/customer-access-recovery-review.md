# Customer access recovery UI review

Date: 2026-10-24

The subscription-check loading and error popups are now non-dismissible. The error keeps its existing retry callback and adds a “Sign in again” link to `/auth/login`.

## Scope

Only the two popup return statements changed in `CustomerAccess.tsx`. The status/error conditions, active-plan condition, My Card exception, children, provider polling and authentication handlers are unchanged. No refresh protocol or verification-provider configuration was changed.

## Verification

- Before: focused regression reproduced the missing non-dismissible property, with 7 passing and 1 failing test.
- After: `node apps/web/tests/customer-access-location.test.cjs` passed 8 tests, with no failures or skips.
- The regression checks loading, failed requests and stale paid data on Profile and My Card; all still hide protected children. It verifies the retained callable retry and the exact sign-in path and label.
- Scoped `git diff --check` passed.
- Read-only caller inspection confirmed `/auth/login` keeps its sign-in form available when an existing session is present.

## Independent review

Agent `recovery_ui_review` inspected the two-file diff and the shared StatusPopup contract. Result: clear, with no concrete findings. It confirmed the action and non-dismissible props are supported and found no access-gate, polling or handler changes. The reviewer made no edits and did not rerun tests or use the browser.

## Limits

This is a recovery presentation change. It does not resolve token refresh, alter authorization, or claim to repair provider configuration. A production expired-session click-through remains a deployment check for the root agent.

## Reviewed content

- CustomerAccess.tsx SHA-256: `c9aac0b869d76f68aed346f98b002010c4d415e5ce4b28b7f5f907a97948b431`
- customer-access-location.test.cjs SHA-256: `a82a8931095389e16c18a8ab004774b809051bc3773a56bd4f48cbfebc338ae3`
