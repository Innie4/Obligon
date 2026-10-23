# Google and passkey sign-in review

23 October 2026. Base revision: `a27caac35d740a2dd4b8c53ea83c948a3163a400`.

Status: authentication implementation and bounded local acceptance completed. Google Cloud configuration is prepared and published with the user's explicit approvals. The application patch has not been committed, pushed or deployed. This authentication increment and the preceding payment/partner-access increment require qualified human review together before production release.

## User-facing changes

| Page or dashboard | Behavior |
| --- | --- |
| `/auth/login` | Retains password sign-in and adds Google's official sign-in button plus a separate passkey action. Passkeys may use fingerprint, face recognition or the device PIN. The application does not select or collect the biometric method. |
| `/auth/login`: failure states | Provider configuration failures preserve password access. Unsupported browsers, insecure origins, cancelled ceremonies, repeated clicks and failed provider callbacks have explicit states. Google errors remain visible until the user retries. |
| `/auth/sign-in-options` | A shared authenticated page lists linked Google status and enrolled passkeys. Linking, enrollment and removal require the current password. Password text is cleared after use. |
| Customer: account navigation and Profile security | Opens the shared management page. The old unavailable biometric sign-in card is replaced with a working sign-in options link; card transaction approval continues to use the existing controls. |
| Partner and mechanic: desktop and mobile Account | Opens the same page without exposing fuel-only functionality to workshops. |
| Company: desktop, mobile menu and company-selection screen | Keeps sign-in management available in the current account context. |
| Admin: desktop sidebar and mobile menu | Provides the same management link. |
| MFA challenge | Google and passkeys use the existing TOTP step when enabled. They do not bypass it or accept a browser-supplied account role. |

Google and passkeys are additional methods for existing accounts. Users first sign in with their current password and enroll the desired method. Google is keyed by its verified issuer and stable subject; a matching email never creates, merges or links a local identity and never marks local contact details verified.

## Server behavior and stored data

The API exposes `/api/auth/methods/config` and authenticated `/manage`, with separate Google start/finish/link/unlink and passkey login/register/remove routes. Configuration exposes the public Google client ID only. The Google ID token is verified using JOSE against Google's fixed official key endpoint, with signature, RS256 algorithm, issuer, audience, expiry, nonce and subject validation.

SimpleWebAuthn verifies real registration and authentication signatures. Enrollment requests discoverable passkeys and user verification. An exact trusted browser origin and the configured relying-party domain bind each ceremony. The server stores credential identifiers, public keys, counters, labels and limited device metadata. It never receives private keys, fingerprint scans or face scans.

Migration `039_account_signin_methods.sql` adds private Google identity, passkey and durable challenge tables. All three enable row security and revoke public/Data API role access. Challenges expire after five minutes and are consumed once through database transactions. Account and session locks, final expiry checks and database rollback protect completion after waits, concurrent requests and audit failures.

Fresh-password enrollment proofs bind the original account, session, password state, role, MFA state and organization context. Method login preserves suspension, temporary access expiry, lockout and password-reset checks. Pending TOTP also binds the original method and current organization state. Removing a method invalidates pending authenticated proofs and revokes other sessions while preserving the managing session. Existing methods can be removed even if their provider has been disabled.

Supabase password and reauthentication checks now compare the returned provider identity with the stored identity, preventing a recreated provider account with the same email from proving ownership of an older local account.

## Browser and Google configuration

Chrome access was restored during this task. The Google Cloud account had reached its project limit. The user explicitly authorized configuring the previously unconfigured `feisty-gasket-469408-u4` project for Obligon, accepting Google's User Data Policy, creating the prepared client and publishing its audience.

The web client is named **Obligon web sign-in**. Its JavaScript origins are exactly `https://obligon.vercel.app` and `http://localhost:4310`. It has no redirect URI because the implementation uses Google's ID-token popup callback. No Gmail, Drive or other Google API access is requested by the application. Existing public homepage, privacy-policy and terms links are configured. Google visibly reports **In production**; this is the OAuth configuration status, not an application deployment claim.

The public client ID is stored in the ignored root `.env`; no client secret was retained. Local WebAuthn uses RP ID `localhost`. Production must use the stable Obligon host, `obligon.vercel.app`, with matching trusted origins. The shared `vercel.app` domain must never be used as the application's RP ID.

## Fresh verification

- Full API run: **1,264 tests, 1,251 passed, zero failures and 13 opt-in live-service checks skipped**. All 242 recorded API/shared/dependency inputs remained unchanged during that run. See `evidence/api-final.tap` and `evidence/api-final-receipt.json`.
- Focused native authentication HTTP coverage: **31 passed**, using disposable PostgreSQL, locally signed Google tokens and real ES256 passkey registration/assertion responses. This proves cryptographic and database behavior without claiming actual Google-user or biometric-device acceptance.
- Clean migration acceptance: migrations **001–039 applied**, then **zero** applied on the immediate second run. The new tables have RLS enabled and no `anon`/`authenticated` grants. See `evidence/migrations.json`.
- Production dependency audit: **zero advisories** at all severities. Offline source-secret scan of `apps`: **zero matches**, excluding dependencies, generated builds and environment files. Neither result proves the absence of all vulnerabilities or secrets.
- Frontend suite: **512 passed, zero failures/skips**. The later layout-only correction passed **66 focused checks**, another TypeScript check and a fresh production build. Desktop and 390/320 px Chrome checks passed; results and source hashes are stored in `evidence/frontend-final-verification.json`, `frontend-layout-verification.json` and `browser-acceptance.json`. Targeted suites overlap with the full suite and must not be added to its total.

The isolated suites cover invalid/expired claims, wrong origins, absent device verification, wrong user handles, counter replay, cross-account enrollment, account suspension/expiry/lockout, changed password/session/membership, removal during pending MFA, ten simultaneous challenge completions, and rollback of session creation when audit insertion fails. Existing MFA, password reset, session and temporary-access suites also run in the full API acceptance.

## Independent review findings resolved

1. Removing an identity or passkey initially left prior sessions usable. Removal now revokes other sessions and pending authenticated proofs atomically.
2. A challenge could expire while its completion waited for an account lock. Final consumption now checks the deadline again and rolls back every effect if it expired. The independent reproduction changed from a successful session to a 401 with zero sessions.
3. Password-provider latency could outlive the managing session. A final current-session check prevents that stale proof from changing methods.
4. Disabled Google controls remained focusable through their embedded button. Native `inert` now prevents keyboard activation during another request.
5. An alternate sign-in attempt could leave an older Google challenge prepared, while an automatic retry could erase a useful Google error. The lifecycle now distinguishes external attempts and preserves errors for explicit retry.
6. Switching accounts during a pending management action could leave the next account's form busy. Account changes reset local busy state while stale completions remain rejected.
7. Disabled providers initially hid removal of existing methods, and the desktop admin menu lacked the shared link. Those paths are corrected and covered.

## Local Chrome acceptance

The real official Google button rendered and opened Google’s account chooser branded **Obligon**, with the configured privacy and terms links. No account was selected. On disposable accounts, customer, gas partner, mechanic, company and admin all reached the shared settings page with the correct return destination. Partner, company and admin mobile account/menu links also worked. Incorrect current-password proof produced a visible error; correct proof prepared the official linking button, cleared the password field and allowed cancellation.

Chrome exposed a mobile min-content grid overflow that component tests had missed. Explicit shrinkable grid tracks and form containment corrected 390 px from a 489 px document to 390 px. At 320 px, document scroll width matched the available 305 px content area after the vertical scrollbar. Management layouts also had no horizontal overflow at 390/320 px. See the before/final screenshots and the independent layout review.

The user subsequently requested dynamic search across dashboards. That is a further increment and changes the eventual combined release snapshot; the authentication snapshot here is preserved for evidence rather than presented as the final release package.

## Remaining acceptance and release requirements

Actual Google-account linking/login, physical fingerprint/face/PIN ceremonies, synced passkeys, security keys and target-device support need actual provider/device acceptance. A software authenticator is not a handset test. Hosted origin/header configuration, migration execution and both Vercel/Render revisions must be verified after an approved release. Provider propagation may delay a newly configured client.

The preceding payment report's limits remain: Sudo sandbox access, full provider/bank/books reconciliation, hosted recovery/scheduling/alerts/backups, Nigerian SMS handset receipt and applicable qualified payment/security/regulatory reviews are not established by this increment. The project is not represented as fully launch-ready.

Before release, a qualified human must approve the final combined source manifest and diff, including the payment and partner authorization changes. Earlier approvals and Google Cloud setup approvals do not constitute approval of this new application patch.

## Recovery

Google can be disabled by clearing `GOOGLE_CLIENT_ID`; passkey login/enrollment can be disabled using `WEBAUTHN_ENABLED=false`. Password login remains available, and password-authorized removal of existing methods remains supported. Preserve public-key/identity records and audit evidence during incident investigation rather than deleting credentials or rewriting financial history.

The new authentication migration is additive. Do not reverse schema changes or delete durable financial claims as part of application rollback. The earlier payment changes require unit-aware recovery: reverting to code that interprets approved gas kilograms or standard cubic metres as litres is unsafe. Hosted rollback timing and operational recovery have not been rehearsed by this local acceptance.
