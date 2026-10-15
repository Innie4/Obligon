# Obligon LTD Milestone Tracker

| Milestone | Status | Scope | Completion criteria |
|---|---|---|---|
| 1. Figma design | Complete | Site structure, screens, user flows, and visual direction | Approved Figma designs cover the required pages and states. |
| 2. Frontend build | Complete | Implement approved screens, navigation, responsive layouts, forms, dialogs, and client-side feedback | All in-scope screens match the approved design, work across target screen sizes, and pass the production build. |
| 3. Backend and service integration | Implemented; production acceptance pending | Connect authentication, data storage, core business actions, notifications, payments where required, and support workflows | Core user actions persist correctly, access rules are enforced, service errors are handled, tests pass, and all domains are wired. |
| 4. Release readiness and launch | Planned | Complete functional testing, accessibility review, performance checks, content review, deployment configuration, and launch approval | Critical journeys pass testing, release settings are complete, production checks pass, and the launch owner approves release. |

## Current focus

2026-10-14: the Next.js frontend, Express API, database migrations and provider
integration code exist. Current production-readiness corrections are under review
on `codex/production-readiness-2026-10-14`; the evidence and remaining checks are
tracked in `reports/production-readiness-2026-10-14/`.

Production acceptance remains pending. Required evidence includes qualified human
review of authentication, authorization, tenant isolation, private database access
and money flows; provider sandbox/staging acceptance; live deployment configuration
and database permissions; reconciliation/recovery, monitoring and rollback checks.
Available access permits local synthetic tests and browser checks, while missing
hosted/provider access must be recorded as blocked. Supplying API keys alone does
not complete these requirements, and local tests do not prove live provider
behavior or authorize release.
