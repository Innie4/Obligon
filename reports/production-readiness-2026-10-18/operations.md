# Hosted operations and remaining release requirements

18 October 2026, Africa/Lagos. These are observed limits and a proposed operational change, not evidence of a completed production rollout.

## Scheduled recovery is disabled

The live `/health` response at `2026-10-18T21:19:53.273Z` reports `scheduler.enabled=false`, `running=false`, and no recorded reconciliation run. Chrome inspection of the existing Obligon Render service found no `ENABLE_SCHEDULER` environment key. The Obligon project lists one production service and an empty staging environment, with no separate worker or cron resource in that project. A scheduler outside this Render project has not been ruled out.

The existing `render.yaml` requests `ENABLE_SCHEDULER=true`, but that declaration has not populated the current service setting. The application code supports both its in-process scheduler and the existing `pnpm --filter @obligon/api cron` entry point.

### Concrete proposal for qualified operational review

1. Confirm whether any external scheduled runner already invokes this project's cron entry point. Assign an operator for uncertain payments, refunds and settlement exceptions.
2. Review the existing scheduler and provider/account bindings before enabling it. Its full task runner can purge expired records, accrue settlements, reconcile payments and payouts, flush email, and queue transfers for eligible partners. It is not a read-only health task.
3. If approved, configure exactly one intended scheduling arrangement and verify health/run evidence, durable payment records, provider reconciliation, alerts and failed/uncertain outcomes. Do not invoke the full cron against production merely to test whether it starts.
4. Reverting `ENABLE_SCHEDULER` to false and restarting stops the in-process schedule. It cannot undo a transfer already accepted by a provider. Any financial correction must follow the existing review/reconciliation process.

No scheduler activation or production financial action was performed. The user's AGENTS.md requires qualified human review before production release of money movement. Browser rules also require the user to perform consequential financial actions. Passing isolated tests does not satisfy those operating requirements.

## Free hosting limits

Render's current [free service documentation](https://render.com/docs/free) says free web services spin down after 15 minutes without inbound traffic and are not intended for production applications. In-process timers cannot continue while the service is stopped. Its current [cron documentation](https://render.com/docs/cronjobs) describes a separate service type; no paid service was purchased or configured here. The 75-second client timeout accommodates a documented cold start, but does not provide continuous job execution or an availability guarantee.

The existing free infrastructure is retained for testing, as requested. No traffic generator was installed to evade the free plan's idle policy.

## Providers and credentials

The live health contract reports configured database/auth/storage, Flutterwave and webhook verification, email, SMS and push integrations. These booleans do not prove successful external delivery, approved sender identities, merchant settlement bindings, or correct provider contracts. Sudo is absent; the user explicitly chose to leave its signup/credentials blocked. Paystack is absent and remains a legacy recorded-payment verifier. Google Maps is absent; the existing OpenStreetMap fallback is available, so a new Google project is not required for basic maps.

No hosted credential was rotated or copied into reports. The repository's ignored `.env` contains only disposable local QA configuration and generated local secrets; `.env.live` contains public deployment values. The existing configuration outside the checkout was left intact. Both new files have mode 0600 and are excluded from Git.

## Other requirements without fresh hosted evidence

- Provider sandbox acceptance for checkout, card issuing, refunds, settlements, delayed/duplicate webhooks and provider/bank reconciliation.
- Actual hosted database roles/grants/ownership, backup restoration, recovery ownership and alert delivery. The local 33-migration test is not a hosted permissions or restore test.
- Qualified review of complete balanced accounting and counterparty records. The earlier report documents that the existing wallet history alone is not a full financial accounting system.
- Owner/legal confirmation of plan fulfilment, partner services, exact retention declarations and contractual/regulatory disclosures.
- Authenticated production acceptance for company/admin roles, physical phones, screen readers, push devices and real GPS accuracy. No production roles or expiring test access were granted or extended.
- Representative load measurements. Retaining Node/TypeScript/PostgreSQL avoids an unverified rewrite; no claim of measured scalability follows from language choice or functional tests.

These requirements remain open. This report does not certify the application as ready for unrestricted real-money production use.
