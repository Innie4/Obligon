# Calendars, copy and reliable requests

> 2026-10-18 · Improve Obligon across public pages, dashboards and backend, then verify the release.

## In short
Date controls now share one calendar with keyboard navigation and validated dates. This work also clarifies public copy, repairs two backend setup/form defects, and lets bounded API requests survive a free host's cold start.

## What changed
- `apps/web/components/shared/Calendar/Calendar.tsx`, new `DateField.tsx` and `apps/web/lib/calendar-date.ts`: render, validate and serialize calendar values.
- `CardRequestModals.tsx`, `CompanyModals.tsx`, `CompanyScreen.tsx` and `StationDiscounts.tsx`: use those controls for identity, maintenance, filters and discount schedules.
- `apps/web/lib/services/client.ts` and `tests/transport-regression.test.cjs`: allow 75 seconds per request while retaining cancellation and testing that a slow write is sent once.
- `CustomerScreen.tsx` and `DashboardScreen.tsx`: correct heading hierarchy, missing values and an inactive payout control.
- Public landing, solution, site, privacy, support and careers files: clearer claims, larger text, responsive columns and accurate category icons. Auth/admin presentation and mock-data files receive copy corrections only.
- `apps/api/src/scripts/seed.js`: supply the precise development partner fixture's missing subscription without extending an existing period.
- `apps/api/src/routes/public.routes.js`: reject empty applicant email before saving; other backend runtime changes replace presentation dashes.
- Calendar, copy, seed and application tests add regressions. Existing fixtures follow the current controls. The [complete file inventory](../reports/production-readiness-2026-10-18/changed-files.md) describes every changed file.

## How it works
1. `DateField` accepts a typed date or opens `Calendar`. Dates must exist and satisfy bounds before reaching the parent form.
2. `calendarDateValue` keeps date-only values as `YYYY-MM-DD`. `DateTimeField` combines a valid date and time while preserving incomplete local drafts.
3. Existing callers submit their original payload shapes. No new database column or payment operation is introduced.
4. `boundedFetch` combines the caller's cancellation signal with a 75-second limit. It sends the request once and still reports a timeout if the host never responds.
5. The seed helper inserts a missing fixture subscription with conflict handling. Careers validation rejects an invalid email before database work.

## Why it's built this way
The project already has React, TypeScript and established form/API patterns. Shared controls avoid inconsistent date behavior without adding a calendar dependency. Longer bounded waiting addresses a documented hosting delay; replaying writes could repeat consequential effects.

## The concept worth knowing: calendar dates versus instants
**Simply put:** a birthday is a square on a calendar; a scheduled call is a point on a clock.

**More precisely:** converting a date-only string through UTC can move its displayed day in another time zone. These helpers construct local dates, validate each year/month/day, and format them explicitly. Discount date-time values retain local wall-clock text before the existing caller converts them for the API.

## Watch out for
Tests use an isolated database and controlled provider responses. They do not prove real bank/issuer behavior, hosted permissions or recovery. Physical devices and screen readers remain unverified. Free hosting can sleep, and live scheduled recovery is disabled; those operating limits are documented separately.

## Check yourself
1. Why not parse every birthday with `new Date(value)`?
   <details><summary>Answer</summary>Date-only ISO parsing can apply UTC and display a different local calendar day.</details>
2. What if a write times out after the server accepts it?
   <details><summary>Answer</summary>The outcome may be uncertain. This change does not automatically replay the write; existing verification and recovery rules must resolve it.</details>
3. Why does repeated seeding keep the existing subscription period?
   <details><summary>Answer</summary>Repairing a missing development fixture should not silently renew or extend access on every run.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
