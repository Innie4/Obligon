# Obligon API

Express 5 backend serving every Obligon dashboard (customer, company, partner, admin)
plus the public marketing/careers/support endpoints. **Supabase Postgres** is the
database and file-storage backend; **Sudo Africa** issues the virtual fuel cards;
**Flutterwave** is the configured primary checkout and settlement processor.
Paystack compatibility paths remain for previously recorded Paystack payments.

## Setup

```bash
cp apps/api/.env.example .env    # local development configuration; use an isolated database
pnpm install
pnpm --filter @obligon/api migrate        # creates all tables in Supabase
pnpm --filter @obligon/api seed           # demo data, only in a disposable local environment
pnpm --filter @obligon/api dev            # http://localhost:4000
```

Point the frontend at it: copy `apps/web/.env.example` to `apps/web/.env.local`
and set `NEXT_PUBLIC_API_URL=http://localhost:4000`. Offline demo data requires
`NEXT_PUBLIC_ENABLE_MOCK_MODE=true` with no configured API URL in development.
Production defaults to live transport; configure its exact API origin explicitly.

## Vercel + Render deployment

The Next.js frontend can run on Vercel, but the Express API must run as a
separate public HTTPS service. This repository includes `render.yaml` for a
Render deployment. Create the service from that Blueprint, provide the
`sync: false` values in the Render dashboard, and set `APP_URL` and
`CORS_ORIGINS` to the final Vercel URL. The API runs pending migrations before it
opens its HTTP listener, including on Render's free plan, which does not support
pre-deploy commands. A failed migration rolls back and prevents startup; the
Render logs identify the failed migration. `/health` is exposed after startup.
The manual `migrate` command uses the same runner. A database advisory lock
serializes simultaneous deployments and manual runs, and each migration and its
ledger entry commit together. Restarts skip migrations already recorded.

Supabase database connections automatically trust Supabase's published production
CA alongside Node's standard roots, with certificate and hostname verification
enabled. `DATABASE_CA_CERT` is an optional PEM override (literal `\n` escapes are
accepted) for a custom database CA; it is not required for standard Supabase
direct or pooler connections.

In Vercel, set `NEXT_PUBLIC_API_URL` to the deployed API URL, for example
`https://obligon-api.onrender.com`, and set `NEXT_PUBLIC_APP_URL` to the Vercel
domain. Keep `NEXT_PUBLIC_ENABLE_MOCK_MODE=false`. Login and signup then use
the API, Supabase Auth, and the server-returned role to route customers to
`/customer`, companies to `/company`, partners to `/dashboard`, and admins to
`/admin`.

## Local demo accounts and retired test access

`seed` and `seed:demo` create synthetic development accounts. Their shared
credentials and the optional demo sign-in panel belong only in a disposable local
or explicitly designated test environment. Both scripts refuse production unless
`ALLOW_DEMO_SEED=true` is deliberately supplied; do not enable that override in a
real production environment. Keep `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false` in release
builds. Use normal account authentication for production access.

The temporary deployed partner bootstrap is disabled by default and forcibly
disabled in production in the reviewed source. On startup it suspends the exact
legacy temporary test account, revokes its sessions, and cancels its test
subscription. These source changes do not prove that the live service has deployed
them. Verify account retirement after an approved deployment and review any
historical exposure separately; deleting source alone does not revoke database
access. No shared temporary credential is documented for production use.

## Provider status

`GET /health` reports which providers are configured. Run
`pnpm config:check` before deployment. Production startup fails with a clear
list when database, authentication, email, SMS, payment, or card credentials
required by the enabled product flows are missing. Maps and web push remain
optional because the frontend has an OpenStreetMap fallback and notifications
are best-effort.

| Capability | Provider | Where the key lives |
|---|---|---|
| Database + storage | Supabase | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Authentication (optional) | Supabase Auth (GoTrue) | `SUPABASE_AUTH_ENABLED=true` + `SUPABASE_ANON_KEY` — delegates password validation to Supabase; bcrypt fallback otherwise |
| Virtual fuel cards | Sudo Africa | `SUDO_SECRET_API_KEY` (+ `SUDO_WEBHOOK_SECRET`) |
| Checkout / subscriptions / settlement transfers | Flutterwave | `FLW_SECRET_KEY`, `FLW_PUBLIC_KEY`, `FLW_SECRET_HASH` |
| Legacy payment compatibility | Paystack | `PAYSTACK_SECRET_KEY` only when recorded legacy flows require it |
| Transactional email | Resend | `RESEND_API_KEY` |
| SMS / OTP | Termii | `TERMII_API_KEY` |
| Maps / directions | Google Maps Platform | `GOOGLE_MAPS_API_KEY` (server) + `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser) |
| Web push | VAPID web-push | `WEB_PUSH_VAPID_*` |

There are no backup payment, transfer, card, email, SMS, or push vendors in
this repository. The provider boundary therefore fails closed for writes,
uses bounded timeouts, retries only safe reads, and relies on stable internal
references plus webhook/idempotency reconciliation rather than submitting a
financial write to an invented secondary vendor. Add a real secondary vendor
only after its account, contract, API semantics, and reconciliation behavior
are defined.

Webhooks to register with providers:

Use the public **API** HTTPS origin, not the Vercel frontend origin in `APP_URL`:

- Flutterwave v3 → `<API_ORIGIN>/api/webhooks/flutterwave` (`verif-hash` with `FLW_SECRET_HASH`)
- Paystack legacy callbacks → `<API_ORIGIN>/api/webhooks/paystack` (raw-payload HMAC-SHA512 with secret key)
- Sudo Africa → `<API_ORIGIN>/api/webhooks/sudo` (raw-payload HMAC-SHA256 with webhook secret)

`API_ORIGIN` above is a documentation placeholder for the deployed API URL.
Authenticated callbacks are corroborated with recorded provider references and
amounts; a valid callback signature alone does not establish a successful credit.

## Real-time & Push

Server-Sent Events at `GET /api/realtime/stream` push `notification`,
`pos.approved`, `pos.declined`, `roadside.updated`, `pricing.updated`,
`verification.approved` events. Auth via the access token.

Web push subscription management is available at `/api/push` (`/key`, `/subscribe`, `/unsubscribe`).

## Scheduled Tasks & Cron

The API includes automated maintenance routines (session/code purging, partner auto-settlement):

- **In-process scheduler**: set `ENABLE_SCHEDULER=true` in `.env` to run hourly sweeps within the server process.
- **Standalone cron job**: run on a schedule (e.g. AWS Lambda / K8s CronJob / GitHub Actions) via:
  ```bash
  pnpm --filter @obligon/api cron
  ```

## Tests

```bash
SMOKE_BASE_URL=http://localhost:4000 pnpm --filter @obligon/api test
```

The suite covers login/session, role isolation, customer/company/partner read
surfaces, public endpoints and focused financial/access regression cases.
Database integration tests require `OBLIGON_TEST_DATABASE_URL` (and selected
issuer suites use `TEST_DATABASE_URL`) pointing to disposable localhost PostgreSQL.
Provider tests use mocks unless an explicit manual provider check is selected.

CI (`.github/workflows/ci.yml`) declares migrations and tests against PostgreSQL16.
Fresh database migrations expect Supabase roles and `auth.uid()`; the supplied
plain PostgreSQL CI service does not bootstrap them. That existing infrastructure
gap remains unverified here and must be resolved in the authorized CI workflow.
Do not treat a local green suite as a green hosted deployment or provider test.

## Current release review — 2026-10-14

The current production-readiness work is prepared on
`codex/production-readiness-2026-10-14`; evidence and outstanding checks are tracked
in `../../reports/production-readiness-2026-10-14/`. It is not a declaration of
production readiness. Authentication, authorization, tenant isolation, database
access and money-flow changes require qualified human review before release.
Production provider sandbox/staging acceptance, actual deployed configuration,
monitoring, reconciliation and rollback evidence remain separate required checks.
No local test should use production seed data or real funds.
