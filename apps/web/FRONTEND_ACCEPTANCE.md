# Frontend Acceptance Rule

This document governs what counts as a finished, shippable control in the Obligon
web frontend. The application includes a live Express API and persisted database
workflows alongside explicit development mock datasets. Every interactive element
must be honest about its active mode and confirmed server outcome, and give the
user a clear, visible outcome in every case.

## The rule

> Every interactive control (button, link, toggle, form, modal action, route)
> MUST have all three of the following:
>
> 1. **A real handler** — an `onClick` / `onSubmit` / route that does something.
>    If a backend call is not available yet, the handler must call the service
>    layer (`@/lib/services`) in `mock` mode, or otherwise produce a deterministic
>    local result. Controls must never be dead (no-op) without a clear label.
> 2. **A visible state** — loading, success, empty, and active/inactive states
>    must be reflected in the UI using the shared components in
>    `components/shared/States.tsx` and toasts from `components/shared/Toast.tsx`.
> 3. **A visible failure path** — invalid input, rejected actions, and errors
>    must be surfaced (toast error, inline error text, or `ErrorState`), not
>    swallowed. Unexpected render errors are caught by `ErrorBoundary` /
>    `app/error.tsx`.

## Shared infrastructure to use

- **Service layer** — `@/lib/services` (`api` singleton). Components should read
  data via `api.*`, not import mock files directly. Add new endpoints to
  `ApiClient`; keep `MockApiClient` returning `@/lib/mock` data and `LiveApiClient`
  as the `fetch` integration point for the existing API.
- **Mock boundary** — all fake datasets live under `lib/mock/`. They are the only
  place hardcoded fixture data belongs; components import from there, never inline.
- **Toasts** — `useToast().success/error/warning/info(...)` for transient feedback.
- **Async states** — `LoadingState`, `Skeleton`, `EmptyState`, `ErrorState`,
  `AsyncBoundary` for screens driven by async data.
- **Error boundary** — route segments are wrapped by `app/error.tsx`; the app root
  is wrapped by `Providers` (`ToastProvider > AuthProvider > ErrorBoundary`). There
  is also `app/not-found.tsx` (404) and `app/global-error.tsx`.
- **Session** — identity is read from `useSession()` (`AuthContext`), not hardcoded
  strings. Account and organization identity must come from the authenticated
  server session. Unknown values must remain unknown rather than resemble a
  confirmed account.

## Definition of done for a flow

- [ ] Handler is wired (real effect or deterministic mock result).
- [ ] Loading + success + empty/active states are visible.
- [ ] Invalid input / error is surfaced to the user (not a console-only throw).
- [ ] No hardcoded identity or dataset inside the component (use session / `@/lib/mock`).
- [ ] Reads go through `@/lib/services`, not raw mock imports.

## Status

As of 2026-10-14, API, auth and persistence integrations exist. `NEXT_PUBLIC_API_URL`
selects live transport; development mock mode is a separate local demonstration
and cannot establish real account, payment, support or provider outcomes.

Current review evidence and remaining production checks are tracked in
`../../reports/production-readiness-2026-10-14/`. Build, unit and isolated integration
success do not establish live provider acceptance, deployment correctness or
production readiness. Qualified human review is required before releasing changes
to authentication, authorization, tenant isolation, private data access or money
movement. Responsive browser, keyboard and user-facing error/recovery checks must
cover each changed flow.
