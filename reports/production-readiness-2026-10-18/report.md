# Obligon end-to-end review and repairs

18 October 2026, Africa/Lagos. Base revision: `877b5ea965de5ea5fd87e98ef98737a4688a2eee`.

## Outcome

The verified application changes improve calendars, route clarity, public copy, responsive layout, dashboard headings, API error presentation and development setup. They preserve the existing Next.js/TypeScript, Node/Express and PostgreSQL stack. A language rewrite would not establish provider correctness, operational recovery or measured scalability.

The application is **not certified ready for unrestricted real-money production use**. The current free hosting arrangement, missing Sudo access, disabled scheduled recovery and unverified external operating requirements remain material limits. See [hosted operations and release requirements](operations.md).

## Work completed by page or dashboard

| Area | Pages or workflows | Changes and observed behavior |
| --- | --- | --- |
| Public | Homepage | Replaced vague marketing copy with concrete fuel-card/spending descriptions; simplified the hero; corrected category icons; improved readable labels and section headings. Preserved the Individual/Organization plan groups. Removed rendered exclusion dashes without changing entitlements. |
| Public | Product showcase | Replaced fixed 479px desktop columns with equal responsive columns so the panel fits around the 1024px breakpoint. Kept the existing brand and images. |
| Public | FuelVista, EnergyVista, GenVista | Clarified current FuelVista workflows and described supply/generator work as enquiries with confirmed scope and service terms. Removed unsupported telemetry/product promises; shortened headings and improved small-screen text and metric layout. |
| Public | Support and careers | Used direct enquiry copy and an inclusive email label. The careers API now rejects an empty email before database writes. An HTTP/PostgreSQL regression reproduced and verifies that correction. |
| Public | Privacy and cookie notice | Removed unsupported telemetry claims from interface copy and described actual records, optional GPS and preferences. Exact legal retention/commercial declarations still require owner/legal confirmation. |
| Customer | Overview, My Card, history, wallet, support, profile, notifications | Retained one page-level heading supplied by the shell and made nested screen headings subordinate. Replaced missing-value dash text with meaningful fallbacks. Card identity date of birth uses the shared calendar; plan exclusion uses an accessible existing icon/badge rather than overflowing text in a decorative slot. |
| Company | Card identity, maintenance, transactions | Added the shared calendar to date of birth, scheduled maintenance date and the specific-date transaction filter. Preserved the existing field values, submission contracts and date constraints. |
| Partner | Discount schedules | Replaced native datetime fields with shared calendar and time controls. Partial drafts survive editing and keep exact local wall-clock values before the existing API conversion. |
| Partner | Overview and settlements | Added missing primary headings; removed the disabled manual-payout promise while retaining actual direct-settlement information and account actions. No payout/collection rule changed. |
| Partner | Pricing, POS receipt details, settings and tables | Used readable missing-value labels instead of emitted em dashes. Existing station GPS, city and fuel controls were retained and covered by the full web regression suite. |
| Admin | Discount approval and data tables | Clarified static missing values and messages through frontend/backend presentation changes. Existing review and access actions were preserved. |
| Shared/auth UI | Login/session/verification and service transport | Removed emitted em dashes from static copy. Increased the bounded API timeout from 20 to 75 seconds to accommodate Render cold starts, preserving explicit cancellation and avoiding automatic write retries. No credential/session policy changed. |
| Backend | Routes, notifications, email, receipts and configuration messages | Removed static presentation em dashes, preserving legacy feature-exclusion comparisons. Added a regression that inspects emitted strings rather than changing user-authored data. |
| Development | Seeded partner/mechanic dashboard access | Supplied the exact disposable partner fixture's missing durable subscription. Repeated seeding preserves the subscription period and does not extend access. The existing production seed prohibition remains intact. |
| Local configuration | Ignored `.env` and `.env.live` | Configured disposable local database/API access with generated local JWT secrets and public deployment values. Local payment simulation is disabled; no hosted secret or environment file is committed. |

The complete source/test/configuration file inventory is in [changed-files.md](changed-files.md). Detailed findings and evidence are in [backend.md](backend.md), [calendar.md](calendar.md), [routes-copy.md](routes-copy.md) and the [independent calendar review](calendar-independent-review.md).

## Verification

- API: **1,070 passed, zero failed, zero skipped**, including 13 HTTP smoke checks and real isolated PostgreSQL integration suites. All 33 migrations applied in a disposable localhost database. External payment providers use controlled fixtures.
- Web: **417 passed, zero failed, zero skipped** after the new calendar and transport cases. Final source/build evidence is recorded in `evidence/verification.json` before commit.
- Calendars: 30 new focused cases; independent review reran 42 related cases. Browser checks covered 320/390/768/1024/1440px, strict dates, local date-time strings, leap years, month/year rollover, keyboard navigation, blocked dates, partial input, focus return and Escape. At 320px the day buttons are approximately 30.4px wide and 44px high; larger layouts reach 44px square.
- Routing: 73 production pages and 183 static local navigation/anchor references resolve. The temporary calendar QA route was removed. The 61 dynamic references still require their account/runtime states; a static link check does not establish every live workflow.
- Chrome: customer, company, partner and admin fixture sign-in/navigation exercised the real local API. The checked desktop pages showed no horizontal overflow or error alerts. No live identity, payment, bank-account or station mutation was submitted.
- Production dependency audit: zero reported advisories. A clean dependency result does not establish complete application security.
- Live pre-release health: configured database/auth/storage, Flutterwave/webhook, email/SMS/push booleans; Sudo absent; scheduler disabled. Render's deployed source was `877b5ea` before this release. Final deployment evidence is kept separately after pushing.

## Design inspection and limits

The ten-source UI catalog informed selection; existing Obligon typography, navy/green/lime palette and shared form patterns were preserved. Local source references and browser inspection were used. No hosted Better Design/Superdesign generation or review is claimed, and no new design runtime dependency was installed.

The prescribed public-page inspector saved desktop/tablet/phone screenshots and raw reports. It reports strict aesthetic FAIL/WARN items for retained plan labels, cards, outlines, dividers, shadows, sparse motion, lack of footage and image counts. These are not reported as a passing design gate. Readability, clipping, heading and sizing findings were addressed; retained brand/layout conventions and nonessential animation choices are explained in the route/copy report. Cookie consent can cover page content until a visitor makes a choice; inspection captures that initial state.

Real-device GPS accuracy, physical keyboards/phones, screen-reader use, representative load tests, real provider contracts, hosted database permissions/backups and full hosted company/admin acceptance were not established. Operational and commercial requirements are listed in [operations.md](operations.md), rather than inferred from isolated tests.

## Release and rollback

Only the reviewed application changes, focused tests, learning note and redacted reports are included in the commit. Earlier untracked reports/screenshots and all environment files remain outside it. The requested `master` push uses a normal fast-forward push. No production database migration, permission change, new paid service, provider credential rotation or scheduler activation is part of this change set.

If a release smoke check fails, restore the preceding Vercel/Render deployment or revert this release commit through the normal reviewed Git workflow. No migration rollback is necessary for these changes. Hosted rollback and full restore timing have not been exercised here, so a five-minute recovery guarantee is not claimed.
