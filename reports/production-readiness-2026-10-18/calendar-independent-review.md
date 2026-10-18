# Independent calendar review: 18 October 2026

What this change does: The shared calendar now provides named day buttons, month/year selection, keyboard movement, disabled-date and range handling. DateField adds a labelled date input and calendar disclosure; DateTimeField preserves the existing local date/time form shape. Customer identity dates, company filters and forms, and station discount scheduling use these controls without changing server contracts.

Review method: Ponytail Review, connected callers and helpers inspected, focused tests executed independently. The final 320px screenshot was viewed directly. The root task owns whole-project integration and final browser acceptance.

## Findings resolved before completion

1. CardPlan unavailable features briefly rendered the full phrase Not included in a 12px decorative icon slot. The calendar implementer replaced that slot with the existing X icon and retained textual availability badges.
2. Clearing one part of an existing date/time value briefly caused the parent empty-value echo to clear both parts. The implementer added a last-emitted-value guard so the separate drafts remain editable, while incomplete aggregate form data remains empty. Regression cases cover clearing either part and genuine external replacement/reset.
3. The company first-card VM fixture initially lacked the newly imported calendar-date helper. It now loads the actual helper, preserving the configured identity form checks.

## Evidence and outcome

- Independent command: `node --test --experimental-test-isolation=none tests/calendar-date.test.cjs tests/test-report-company.test.cjs` from `apps/web`.
- Fresh result: **42 tests passed, zero failed, zero skipped**. Log: `/tmp/obligon-calendar-independent-review-18.log`.
- The tests cover leap dates, years below 100, local date serialization, month-end/year rollover, range ordering, disabled dates, keyboard navigation, min/max bounds, empty selection, manual validation, outside/Escape/disabled closure, selection focus return, datetime form serialization, independent partial drafts, and external replacement/reset.
- Existing date-only `YYYY-MM-DD` payloads remain date-only. Discount date/time payloads remain local datetime strings converted by the existing caller. No date is selected merely by displaying the calendar.
- The final `evidence/calendar-320.png` shows readable full month and year controls, a visible selected day, labelled fields, and no clipped horizontal content. The calendar implementer also supplies 390px/desktop artifacts and five-width overflow checks in `calendar.md`.
- `git diff --check` passes.

Verdict: Ship this UI slice after the root task's integration checks. No remaining concrete correctness or data-contract finding was identified in the reviewed calendar change.

Not checked: Physical iOS/Android keyboards, assistive-technology hardware, every browser/time-zone combination, and live production identity or discount submissions. No identity data, payment, or production discount was submitted during this independent review.
