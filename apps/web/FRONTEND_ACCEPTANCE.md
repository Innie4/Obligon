# Frontend Acceptance Rule

This document governs what counts as a finished, shippable control in the Obligon
web frontend. It exists because the app is currently **frontend-only**: every
interactive element must be honest about the fact that no production backend is
wired yet, and must give the user a clear, visible outcome in every case.

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
  as the `fetch` integration point for when the backend lands.
- **Mock boundary** — all fake datasets live under `lib/mock/`. They are the only
  place hardcoded fixture data belongs; components import from there, never inline.
- **Toasts** — `useToast().success/error/warning/info(...)` for transient feedback.
- **Async states** — `LoadingState`, `Skeleton`, `EmptyState`, `ErrorState`,
  `AsyncBoundary` for screens driven by async data.
- **Error boundary** — route segments are wrapped by `app/error.tsx`; the app root
  is wrapped by `Providers` (`ToastProvider > AuthProvider > ErrorBoundary`). There
  is also `app/not-found.tsx` (404) and `app/global-error.tsx`.
- **Session** — identity is read from `useSession()` (`AuthContext`), not hardcoded
  strings. Shells/headers fall back to their previous literal only until the real
  session is provided by `api.getSession()`.

## Definition of done for a flow

- [ ] Handler is wired (real effect or deterministic mock result).
- [ ] Loading + success + empty/active states are visible.
- [ ] Invalid input / error is surfaced to the user (not a console-only throw).
- [ ] No hardcoded identity or dataset inside the component (use session / `@/lib/mock`).
- [ ] Reads go through `@/lib/services`, not raw mock imports.

## Status

Frontend-only. No real backend, auth SDK, or persistence is connected. The service
layer, session context, toasts, async states, and error boundaries are in place so
the app is **backend-ready**: switching `createApiClient("mock")` to `"live"` plus
implementing `LiveApiClient` is the only change required to go live per endpoint.
