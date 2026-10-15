# Repair signup and fleet editing

15 October 2026 · Recheck the supplied test report, repair remaining application defects, and verify the changes.

## In short

Signup now uses real administrative choices and accurate password guidance. Fleet managers can edit vehicles rather than accidentally opening card assignment, while unavailable card issuing is explained before identity details are requested. Landing-page alignment, spacing, and link cues were also repaired.

## What changed

- `apps/web/components/auth/AuthForms.tsx` and `AuthShell.tsx`: location selectors, linked password guidance, recognizable Support, and correct manager/CAC payload fields.
- `packages/shared/nigeria-locations.mjs`, `.d.mts`, and `.sources.json`: one sourced catalog and validator for 37 State/FCT entries and 774 areas.
- `apps/api/src/routes/auth.routes.js`: validates customer pairs and derives stored location text.
- `apps/web/components/company-dashboard/CompanyScreen.tsx`, `CompanyShell.tsx`, and `CompanyModals.tsx`: organization naming, populated vehicle editing, preserved saved options, and issuer availability.
- `apps/web/lib/services/company.ts` and `lib/mock/company-data.ts`: matching vehicle/readiness contracts and honest generic company copy.
- `apps/api/src/routes/company.routes.js`: vehicle detail fields, explicit driver unassignment, and issuer preflight.
- `apps/web/components/landing/Header.tsx`, `Hero.tsx`, and `Pricing.tsx`: cropped-logo alignment, responsive glow/grid behavior, link arrows, benefit spacing, and consistent plan buttons.
- Focused tests: API `signup-location.integration.test.mjs`, `company-dashboard.integration.test.mjs`; web `signup-report-regression`, `nigeria-locations`, `landing-test-report`, and `test-report-company`. Existing `production-company-invitations` and `company-empty-pages` fixtures were updated.

## How it works

1. A customer chooses a State/FCT, then one of its areas. Changing state clears the previous area.
2. `isNigeriaLocation` checks the exact pair. The API repeats that check before database work, hashing, or provider signup.
3. The server stores its own canonical label, ignoring forged city/address text.
4. Vehicle editing starts from the selected record. The update sends changed driver assignments; explicit `null` removes one, while omission preserves it.
5. Issuer readiness controls whether card creation can proceed. Provider acceptance remains a separate requirement.

## Why it's built this way

A shared catalog prevents frontend/backend lists from drifting. Administrative areas were chosen instead of pretending a short invented city list could verify every town. Password text follows the established rule instead of silently introducing new complexity requirements. Editing preserves legacy values because changing a driver should not unexpectedly change fuel type.

## The concept worth knowing: validating at the boundary

Like checking a ticket at the entrance even after someone selected a seat online, the server validates information again. Browser controls guide users, but callers can bypass them. The API accepts only a catalog pair and derives the stored label itself.

## Watch out for

Old customer signup clients must refresh to send both fields. Choosing an administrative area does not prove residence. Real email delivery and Sudo issuance remain dependent on external setup; live login blocked today's authenticated retest. Local checks passed: 1,030 API cases and 284 web cases; two credential comparisons were skipped, and lint retains 78 warnings.

## Check yourself

1. Why repeat the location check on the server?
   <details><summary>Answer</summary>A direct API caller can bypass the selectors; server validation prevents fabricated or mismatched pairs from being stored.</details>

2. What if changing state left the previous LGA selected?
   <details><summary>Answer</summary>The form could display an impossible pair. Clearing it requires a fresh choice, while server validation still rejects a mismatch.</details>

3. Why distinguish omitted driver assignment from `null`?
   <details><summary>Answer</summary>Omission preserves the existing driver; explicit null requests removal. Treating both alike would prevent unassignment or accidentally remove drivers.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
