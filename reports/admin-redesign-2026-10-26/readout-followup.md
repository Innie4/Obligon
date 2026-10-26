# Admin readout follow-up

26 October 2026. Base: `53975e346697b6d5abd6526ab3eddf3a3058b3b5`.

The user approved the admin release and authorized pushing and deploying, while retaining a universal 5/5 quality target. The base was already pushed and deployed. A fresh live check then found a company count display defect.

## Corrections

- `/admin` and `/admin/companies`: the Active cards column now always displays the existing organization-scoped count. Previously an inactive subscription replaced the count with `ONBOARDING`, even when active card records existed.
- `/admin/disputes`: `Category` replaces the misleading `Subject` column heading; the API already supplies category there.
- `/admin/reports`: `Share of listed revenue` makes the existing top-20-station denominator explicit.

There are no changes to queries, persisted data, approval requirements, authorization, payment calculations or provider calls. The same routes, controls, centered feedback and review dialogs remain in place. Rollback is the base commit above; no database rollback is required.

## Verification

Four new real PostgreSQL/HTTP regression cases failed on the original `ONBOARDING` projection. They cover pending/verified canceled companies with zero/two active cards, exclude frozen and foreign cards, and verify that separate Pending/Frozen statuses remain intact. The red reproduction is saved locally under `evidence/headings/company-card-count-before.tap`.

The full admin PostgreSQL/API integration suite passed 59 tests, with zero failures or skips. The full web suite passed 733 tests, with zero failures or skips. Its first sandbox run could not bind the localhost port used by an existing HTTP test; rerunning with local networking enabled passed. The production web build and typecheck passed. Independent source review found no issue with the count/status contract, organization scope or revised headings. `git diff --check` passed.

Raw results are local under `evidence/headings/`. Deployment checks are recorded in the local `readout-release-receipt.md` after release. This document does not predeclare deployment success.

## Visual quality target

The original four App Designer critique rounds remain unchanged. The existing critic clarified that those final renders contain no documented unresolved visible defect. Scores below 5 reflect refinement and portfolio distinctiveness; they do not become 5 because the user approved a release. This fresh live data defect was outside that isolated screenshot set and has been corrected separately.

The [App Designer skill](/home/inimfon-udoh/.codex/skills/app-designer/SKILL.md) specifies “At least two rounds, at most four” and requires “target unmet” when the cap is reached with a lower score. No fifth scoring round, replacement critic, lowered threshold or guaranteed score was introduced. Existing visual scores remain 3–5/5; the universal 5/5 target remains unmet. These count/label corrections are unscored visual revisions, with focused verification instead.

GitHub Actions was previously blocked by account billing. Successful Vercel/Render builds must not be represented as passing GitHub CI. Broader external launch requirements remain outside this display correction.
