# Obligon LTD Milestone Tracker

| Milestone | Status | Scope | Completion criteria |
|---|---|---|---|
| 1. Figma design | Complete | Site structure, screens, user flows, and visual direction | Approved Figma designs cover the required pages and states. |
| 2. Frontend build | Complete | Implement approved screens, navigation, responsive layouts, forms, dialogs, and client-side feedback | All in-scope screens match the approved design, work across target screen sizes, and pass the production build. |
| 3. Backend and service integration | Built (pending live credentials) | Connect authentication, data storage, core business actions, notifications, payments where required, and support workflows | Core user actions persist correctly, access rules are enforced, and service errors are handled in the interface. |
| 4. Release readiness and launch | Planned | Complete functional testing, accessibility review, performance checks, content review, deployment configuration, and launch approval | Critical journeys pass testing, release settings are complete, production checks pass, and the launch owner approves release. |

## Current focus

Milestones 1 and 2 are complete. Milestone 3 (backend + service integration) is built: Express API in `apps/api`, Supabase Postgres schema in `apps/api/src/migrations`, Sudo Africa / Paystack / Resend / Termii / Google Maps integrations, and the frontend wired through `apps/web/lib/services/client.ts` (live mode activates when `NEXT_PUBLIC_API_URL` is set). Remaining for Milestone 3 sign-off: fill provider credentials from `.env.example`, run `migrate` + `seed` against Supabase, and complete UAT (Milestone 4).
