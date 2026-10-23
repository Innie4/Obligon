# Customer and partner critic corrections, round 3

23 October 2026. This follows the actual desktop/phone findings supplied by root. No provider calls, user geolocation, browser operations or money movement were performed in this increment.

## Changes

| Page/component | Correction |
|---|---|
| Customer Stations | Real station cards now precede the optional map in both document and visual order. Map height is smaller and responsive. The page has a visible task heading, and location controls keep usable targets. The list remains usable independently of map loading. |
| Shared StationMap | Bounded 12-second script/preview/tile waits replace indefinite silent loading. Google SDK shape is validated before use; construction failure is contained. Google tiles-loaded events confirm readiness. OSM iframe load is explicitly **unverified**, because the cross-origin document does not prove tiles were drawn. Error/timeout states show list guidance, explicit retry and an always-available full-map link. Late iframe events cannot overwrite a retry or update an unmounted instance; listeners/timers/markers are cleaned up. Existing provider choices remain. |
| Customer Overview | Replaced the phone greeting with the task title. The balance panel includes working Wallet and My Card actions and practical context, giving its space a purpose. |
| Customer Support | Messages and issue reports come before optional coordination. Inactive plans get a compact explanation and My Card link instead of a full unusable form. Eligible service submissions keep the same endpoint and payload. |
| Customer history/transaction-detail | Added a short horizontal-scroll cue. Signed amount and balance cells stay on one line so the sign, naira symbol and digits stay together. Receipt controls have usable targets; the existing keyboard-focusable table region remains. |
| Customer Notifications | Page heading/context remain visible while the data boundary is empty, loading or failed. |
| Partner shared DataTable | Added a short scroll cue, nonbreaking naira values, and omitted the Status column when all rows have no status. Header/body counts remain aligned. |
| Partner Reports | Summary cards use a compact two-column phone layout with the third summary spanning the row, then three columns on wider screens. Values and units are preserved. |
| Partner/workshop Staff | Added the missing Access header for the existing fourth data cell. Status and action columns stay separate, producing six headers for six cells. No access values or permissions changed. |
| Partner Settlements | Setup copy distinguishes missing account, missing default, unverified/re-nomination-required destination and a verified default destination. Automatic settlement wording is conditional on an eligible recorded destination; no payout behavior changed. |
| Workshop Notifications/Verification | Workshop-specific copy replaces station/fuel wording. Contact display badges also require a present contact value, so a missing phone never appears beside “Verified” even if an inconsistent fixture flag is true. The existing account-verification decisions and API behavior are unchanged. |

## Files

Source: `apps/web/components/customer-dashboard/CustomerScreen.tsx`, `apps/web/components/dashboard/DashboardScreen.tsx`, `apps/web/components/dashboard/PartnerVerification.tsx`, `apps/web/components/shared/StationMap.tsx`.

Tests: `apps/web/tests/ui-dashboard-polish.test.cjs`, `apps/web/tests/station-map-states.test.cjs`, `apps/web/tests/partner-audit-regression.test.cjs`, `apps/web/tests/partner-verification.test.cjs`.

## Verification

- `node tests/station-map-states.test.cjs`: 7 passed. Mocked actual iframe/script/map callbacks and timers cover loading, unverified document load, timeout, invalid SDK, map construction failure, tile readiness, retry freshness, callback freshness and cleanup.
- `node tests/ui-dashboard-polish.test.cjs`: 26 passed, including phone station ordering with no GPS request, inactive-plan support, real Overview destinations, financial cell preservation and empty Notifications heading.
- `node tests/partner-audit-regression.test.cjs`: 11 passed, including staff column alignment, conditional settlement setup copy and unchanged unit-aware POS behavior.
- `node tests/partner-verification.test.cjs`: 17 passed, including missing-phone/stale-flag display and existing either-contact verification behavior.
- Fresh final `pnpm exec tsc --noEmit --incremental false` exited 0. The settlement regression file was also rerun after the verified-default refinement and all 11 tests passed. Total focused assertion count: 61 passed, zero failed/skipped.
- Exact final source/test identity: `evidence/customer-partner-round3-source.json` (four source files and four test files).

The tests use isolated fixtures and no external network. They do not prove live map-provider availability, actual browser layout or a 5/5 visual score. Root owns the final browser recapture, complete build and independent review. Attempts to create/reuse an extra review agent hit the thread limit; root will dispatch the existing company/admin reviewer for this exact frozen increment.

## Final independent review follow-up

Other-type partners now see “partner account” on verification; fuel/gas retain “station” and mechanics retain “workshop”. Three focused subtype regressions first reproduced the Other wording failure, then all 20 verification tests passed after the correction. This changes display wording only. The independent reviewer also inspected the delta and reran all 20 tests. The final source manifest was updated; its aggregate SHA256 is `0a09687e4ed6b75fc8ac3521bc845b79419260263c1506104e2babdf14f2b613`. The earlier 44 tests for unchanged inputs remain valid, producing 64 focused passing tests across this bounded scope. Root owns the final combined suite and production build.
