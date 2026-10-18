# Calendar controls

18 October 2026. Focused implementation and verification for date selection across the web application.

## Inventory and changes

| Dashboard | Page or workflow | Control |
|---|---|---|
| Customer | My Card, identity details | Date of birth |
| Company | Transactions | Specific-date filter |
| Company | Cards, first card identity details | Date of birth |
| Company | Maintenance, schedule service | Scheduled date |
| Partner | Fuel Pricing, scheduled discounts | Start and end local date/time |

All six date-selecting fields now use the same branded calendar. Preset period selectors remain regular select controls. No other native date or datetime-local input was found in the web source, including indirect field-renderer calls. Public and admin pages currently have no date-selecting controls.

The calendar uses the existing Obligon colors, border treatment, typography, and React/TypeScript stack. It adds no runtime package. The ten-source UI Reference Guide catalog was consulted; the implementation follows the existing product and local Taste Accessibility guidance rather than introducing effects or another component system.

The earlier unused calendar had broken range completion, December/January rollover, disabled-day enforcement, and five-row month assumptions. Those defects are corrected. The shared calendar now provides:

- Month and year selectors that remain readable on a 320-pixel viewport.
- Six-week rendering where required; genuine disabled buttons for unavailable dates.
- Arrow keys, Home/End, Page Up/Down, and Shift plus Page Up/Down for year navigation.
- A roving tab stop, announced month changes, labelled grids, initial calendar focus, Escape dismissal, and focus return.
- Manual ISO date entry with visible, announced validation errors and native form validity. It uses the standard text keyboard so mobile users can enter the required hyphens.
- Independent date/time drafts. Clearing one part does not erase the other; incomplete values do not become a valid combined datetime.

Date-only strings stay `YYYY-MM-DD`. They are parsed as local calendar dates, avoiding UTC day shifts. Discount form values retain `YYYY-MM-DDTHH:mm`; the existing submit handler still converts the chosen local wall clock to an ISO timestamp for the API. No payment, authentication, authorization, or backend contract changed.

Customer card copy now uses a clear unavailable amount label, a textual unavailable benefit badge, and an icon in the narrow decorative benefit slot. It no longer renders an em dash there.

## Evidence

- New focused calendar tests: **30 passed, 0 failed**.
- Calendar plus related company integration/regression tests: **65 passed, 0 failed**. Log: `/tmp/obligon-calendar-integration-final.log`.
- TypeScript `tsc --noEmit --pretty false`: passed after removing the temporary route's stale generated type.
- Scoped ESLint for the calendar component, adapters, and helpers: passed. The existing legacy ESLint configuration emits a tooling deprecation notice.
- Independent review identified the decorative slot overflow and incomplete datetime draft reset. Both were fixed and covered by verification.
- Real browser checks used an isolated local form against the actual components. The temporary `/calendar-qa` route was removed afterwards.
- No overflow at widths **320, 390, 768, 1024, 1440**. Day targets are 44 pixels high; the smallest width is 30.4 pixels at 320. At tablet/desktop, targets are 44 by 44 pixels.
- Verified birth date selection, future birth date rejection, keyboard December 31 to January 1 navigation without unintended selection, and focus return.
- Verified actual native time keyboard entry and submitted local values: start `2026-10-18T13:15`, end `2026-10-19T08:05`.
- Browser evidence: `evidence/calendar-browser.json`, `evidence/calendar-320.png`, `evidence/calendar-390.png`, `evidence/calendar-1440.png`.

## Files

- `apps/web/components/shared/Calendar/Calendar.tsx`
- `apps/web/components/shared/Calendar/DateField.tsx`
- `apps/web/lib/calendar-date.ts`
- `apps/web/components/customer-dashboard/CardRequestModals.tsx`
- `apps/web/components/company-dashboard/CompanyScreen.tsx`
- `apps/web/components/company-dashboard/CompanyModals.tsx`
- `apps/web/components/dashboard/StationDiscounts.tsx`
- `apps/web/tests/calendar-date.test.cjs`
- `apps/web/tests/test-report-company.test.cjs`

## Limits

The local customer fixture has a cancelled card request, so the identity screen was verified through the shared component fixture and existing caller regression tests rather than completing a payment. No live station discount or identity submission was made. Physical phone, screen-reader, and hosted production calendar checks remain separate release checks. No automated accessibility score is claimed.
