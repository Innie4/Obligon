# Google and passkey acceptance

23 October 2026. Base: `a27caac35d740a2dd4b8c53ea83c948a3163a400`.

The requested outcome is a Google sign-in button and an independent passkey option on the existing login page, with enrollment available to every existing account role. Existing passwords, role routing, organization approval and TOTP MFA continue to apply. Google sign-in links explicitly to an existing account after password confirmation. Provider email claims never merge accounts or change local contact verification.

## Acceptance criteria

- The server verifies Google signatures, issuer, audience, expiry, nonce and stable subject using Google's official public keys. It rejects invalid or unlinked identities and consumes each login proof once.
- Passkey registration and authentication require exact trusted origins, RP binding and device user verification. The server stores public credentials only. A device may offer fingerprint, face recognition or its PIN.
- Enrollment and removal require a current authenticated session and fresh password proof. Removing a method revokes other sessions and pending authenticated proofs while preserving the managing session.
- Both new methods preserve TOTP, account status, access expiry, password reset state, current roles and memberships. Changes during an incomplete ceremony invalidate its proof.
- The browser preserves session race guards, presents disabled or unavailable states honestly and retains usable password login after errors or cancellation.
- The login and management pages are accessible at phone and desktop widths. All dashboard account menus can reach management.
- Fresh isolated PostgreSQL/HTTP, cryptographic, frontend, type and build evidence supports the result. Provider-account and actual device acceptance remain separate from synthetic tests.

## Boundaries and review

Trust boundaries include browser responses, Google ID tokens and remote public keys, WebAuthn client data and signatures, current database identities, durable sessions and challenges, and asynchronous browser callbacks. Replay, cross-account linking, changed sessions, stale memberships, disabled accounts, concurrent completions and audit rollback require explicit regression evidence.

No authentication provider migration, automatic signup, email matching, biometric collection, paid service or real-money test is part of this increment. A qualified human must review this exact combined payment and authentication change set before production release, as required by the user's AGENTS.md instructions. Earlier approvals apply to earlier patches.

## Official implementation references

- https://simplewebauthn.dev/docs/packages/server
- https://simplewebauthn.dev/docs/packages/browser
- https://github.com/panva/jose
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.google.com/identity/gsi/web/guides/integrate
- https://developers.google.com/identity/openid-connect/openid-connect

## Browser configuration record

Chrome automation became available again during this increment. The authenticated Google Cloud account has reached its project quota. No Obligon project was listed. The existing `feisty-gasket-469408-u4` project had no Google Auth Platform configuration; the user explicitly approved using that project for Obligon. No credentials or private tokens belong in this report.

Implementation and acceptance are in progress. This file defines the checks; it does not assert that all checks have passed.
