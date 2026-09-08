# Obligon API

Express 5 backend serving every Obligon dashboard (customer, company, partner, admin)
plus the public marketing/careers/support endpoints. **Supabase Postgres** is the
database and file-storage backend; **Sudo Africa** issues the virtual fuel cards;
**Paystack** processes top-ups, subscriptions and payouts.

## Setup

```bash
cp apps/api/.env.example apps/api/.env    # fill in DATABASE_URL at minimum
pnpm install
pnpm --filter @obligon/api migrate        # creates all tables in Supabase
pnpm --filter @obligon/api seed           # demo data (idempotent)
pnpm --filter @obligon/api dev            # http://localhost:4000
```

Point the frontend at it: copy `apps/web/.env.example` to `apps/web/.env.local`
and set `NEXT_PUBLIC_API_URL=http://localhost:4000`. Without that variable the
frontend stays in offline mock mode.

## Demo accounts (created by seed)

| Role     | Email                 | Password      |
|----------|-----------------------|---------------|
| admin    | admin@obligon.com     | Admin#1234    |
| customer | customer@obligon.com  | Customer#123  |
| company  | fleet@obligon.com     | Company#123   |
| partner  | partner@obligon.com   | Partner#123   |

Change these immediately in production (`POST /api/auth/change-password`).

## Provider status

`GET /health` reports which providers are configured. Missing optional keys
degrade gracefully (simulated outcomes are recorded in `audit_logs`); only
`DATABASE_URL` is mandatory.

| Capability | Provider | Where the key lives |
|---|---|---|
| Database + storage | Supabase | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Authentication (optional) | Supabase Auth (GoTrue) | `SUPABASE_AUTH_ENABLED=true` + `SUPABASE_ANON_KEY` — delegates password validation to Supabase; bcrypt fallback otherwise |
| Virtual fuel cards | Sudo Africa | `SUDO_SECRET_API_KEY` (+ `SUDO_WEBHOOK_SECRET`) |
| Top-ups / subscriptions / payouts | Paystack | `PAYSTACK_SECRET_KEY` |
| Transactional email | Resend | `RESEND_API_KEY` |
| SMS / OTP | Termii | `TERMII_API_KEY` |
| Maps / directions | Google Maps Platform | `GOOGLE_MAPS_API_KEY` (server) + `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser) |
| Web push | VAPID web-push | `WEB_PUSH_VAPID_*` |

Webhooks to register with providers:

- Paystack → `<APP_URL>/api/webhooks/paystack` (signature: HMAC-SHA512 with secret key)
- Sudo Africa → `<APP_URL>/api/webhooks/sudo` (signature: HMAC-SHA256 with webhook secret)

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

The suite covers login/session, role isolation (403s), customer/company/partner
read surfaces, and public endpoints. CI (`.github/workflows/ci.yml`) runs
migrations + seed against a Postgres 16 service and executes the suite on every
push.
