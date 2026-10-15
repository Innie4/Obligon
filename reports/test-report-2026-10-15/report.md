# OBLIGON TEST follow-up

15 October 2026 · Baseline `2a497be5883b262c42b6ba23ce49c3e952a1af0d`

This follow-up checked the 14 issues in the supplied test document against the current source and available browser access. Eleven required application changes, one was already corrected, email delivery remains dependent on external sender-domain setup, and card issuing now has an application readiness check while issuer setup remains external. Account credentials and personal details from the original document are excluded.

This is the verification checkpoint before the requested commit and push. It does not claim that hosted email delivery or virtual card issuance is working. The final chat response records the actual pushed commit.

## Results for every reported issue

| # | Page / dashboard | Reported issue | Status and resulting behavior |
| --- | --- | --- | --- |
| 1 | Public landing · header | Logo not vertically centered | **Fixed.** Reuses the existing tightly cropped `DashboardLogo` inside a centered link instead of scaling an image with internal whitespace. |
| 2 | Public landing · hero | Green glow looks misplaced on mobile/tablet | **Fixed.** Both decorative glow layers are hidden below the desktop breakpoint. Desktop keeps the established effect. |
| 3 | Public landing · hero | “Our Solutions” looks like a dropdown | **Fixed.** Uses the link arrow and keeps its existing solution-page destination. |
| 4 | Public landing · plans | Benefit ticks are not vertically centered | **Fixed.** Uses the existing Lucide icon system with centered benefit rows and decorative icon semantics. |
| 5 | Public landing · individual plans | Benefits crowd the plan button | **Fixed.** Adds space after the individual benefits list; organization cards retain their existing layout. |
| 6 | Public landing · individual plans | Inconsistent plan button wording | **Fixed.** Uses “Choose Bronze,” “Choose Gold,” and “Choose Platinum.” Plan tabs, prices, and destinations are preserved. |
| 7 | Signup / authentication header | Support resembles information/help | **Fixed.** A headset and visible “Support” label identify the destination. The link has a 44px target and visible keyboard focus. |
| 8 | Customer · profile/account menu | Mobile menu blocks sign-out | **Already corrected in the baseline; reverified locally.** In the production build at 320px, profile logout and account-menu confirmation targets are unobstructed, cancelling restores focus, and profile logout returns to Login. Today's live sign-in was blocked, so this report does not claim a new authenticated live sign-out result. |
| 9 | Customer signup | Arbitrary city/state accepted | **Fixed using the approved product decision.** Replaces the combined free-text field with State/FCT and LGA/Area Council selectors. Both client and API require a valid pair from one shared 37-entry, 774-area catalog. The API derives stored display text and ignores forged city/address text. These choices identify administrative areas; they do not prove residence. |
| 10 | Signup | Password copy promises an unenforced composition rule | **Fixed.** Says “At least 8 characters,” matching the established minimum-length rule. The input has an associated hint/error and `minLength`; no arbitrary new numbers/symbols rule was introduced. |
| 11 | Signup verification | Sending email domain is unverified | **External setup blocked.** Existing code already reports provider refusal truthfully and does not pretend the code was delivered. Provider/DNS access is required to verify the sender domain and prove real delivery. No real verification email was sent during this check. |
| 12 | Company · overview/header | Generic Obligon company name replaces the entered company | **Fixed.** Displays the signed-in organization name with an honest fallback. Generic navigation copy no longer claims every fleet is named Obligon. |
| 13 | Company · vehicles | Edit opens card assignment; driver changes cannot save | **Fixed.** The vehicle row action opens a populated “Edit Fleet Vehicle” form, calls the update endpoint, preserves unchanged assignments, saves driver changes, and supports explicit unassignment. Missing edit data blocks submission with refresh guidance. |
| 14 | Company · cards | Issuing reaches “Sudo is not configured” | **Application preflight fixed; external setup blocked.** The API exposes issuer readiness and rejects unavailable issuance before customer/card work. The form explains unavailable setup, disables issuance, and avoids requesting identity details while unavailable. Real issuance still requires valid provider configuration and provider acceptance. |

## Additional defects found while reproducing these issues

- **Landing at 1024px:** fixed desktop hero columns extended beyond the viewport. Fluid grid columns now fit the available width.
- **Company signup:** the fleet manager input used `contact`, but the payload ignored it. The supplied manager name now reaches `fullName`.
- **Company signup:** the CAC field used `license`, but `rcNumber` read absent keys. Company registration now maps that value correctly.
- **Company vehicle editing:** saved lowercase fuel/type values and legacy values now have matching options. Editing another field preserves those values instead of silently replacing them.
- **Company driver removal:** omission means “leave unchanged”; explicit `null` means “unassign.” Server validation retains the existing fleet ownership checks.

## Implementation map

| Surface | Files |
| --- | --- |
| Public landing | `apps/web/components/landing/Header.tsx`, `Hero.tsx`, `Pricing.tsx` |
| Signup and support | `apps/web/components/auth/AuthForms.tsx`, `AuthShell.tsx` |
| Shared administrative catalog | `packages/shared/nigeria-locations.mjs`, `.d.mts`, `.sources.json` |
| API signup validation | `apps/api/src/routes/auth.routes.js` |
| Company display, edit form, and card availability | `apps/web/components/company-dashboard/CompanyScreen.tsx`, `CompanyShell.tsx`, `CompanyModals.tsx` |
| Company data contracts and copy | `apps/web/lib/services/company.ts`, `apps/web/lib/mock/company-data.ts` |
| Company API | `apps/api/src/routes/company.routes.js` |
| Focused regressions | `apps/api/tests/signup-location.integration.test.mjs`, `company-dashboard.integration.test.mjs`; `apps/web/tests/signup-report-regression.test.cjs`, `nigeria-locations.test.cjs`, `landing-test-report.test.cjs`, `test-report-company.test.cjs` |
| Existing fixture updates | `apps/web/tests/production-company-invitations.test.cjs`, `company-empty-pages.test.cjs` |

No dependency changes, database migration, CI changes, new provider integration, or changes to authentication proofs, sessions, money movement, or tenant boundaries are included in this follow-up.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Full API suite with disposable local PostgreSQL | **1,032 cases: 1,030 passed, 0 failed, 2 skipped** | `/tmp/obligon-test-report-api-final.log` |
| Full web suite | **284 passed, 0 failed, 0 skipped** | `/tmp/obligon-test-report-web-final.log` |
| Production web build | **Passed, exit 0** | `/tmp/obligon-test-report-build.log` |
| Web lint | **0 errors; 78 warnings remain** | `/tmp/obligon-test-report-lint.log` |
| TypeScript | **Passed, exit 0** | `pnpm exec tsc --noEmit --incremental false` |
| New API location reproduction | **9 failures before the fix; 9 passes afterward** | Rejected missing/invented/mismatched/array/prototype values; canonical Lagos/FCT persistence despite forged display fields |
| Local browser evidence | Actual browser checks and screenshots saved below | Development rendering for landing/company edits; final production-build checks for pricing, signup selectors, and customer profile logout |
| Live authenticated retest | **Blocked** | Two normal login attempts returned a generic failure; browser diagnostics included `net::ERR_ABORTED`. Available evidence does not establish the server cause. |

The two API skips compare real `.env` credentials; they are not passed hosted checks. The API's invalid-location integration cases directly verify that user, wallet, and verification-code counts remain unchanged. Validation preceding hashing and provider signup is additionally confirmed by control-flow review. The valid cases use isolated local records and disable external provider calls.

The [verification receipt](evidence/source-verification.json) records the 23 changed source/test/catalog file hashes, exact test totals, command/log hashes, independent review, privacy checks, and cleanup. The local offline secret scan reported no findings; no registry metadata export was needed for this follow-up.

Initial integration runs exposed test setup problems: a missing disposable database URL, then a missing partner plan fixture and an accumulated rate limiter. Those fixture/setup failures were corrected before the final full green API run. They are distinct from the intentional nine-case location failure reproduction. Raw failure logs containing synthetic session responses are kept out of this report.

### Saved browser images

- [Landing desktop](evidence/landing-desktop-after.jpg)
- [Pricing desktop](evidence/pricing-desktop-after.jpg)
- [Signup phone](evidence/signup-phone-after.jpg)
- [Company overview](evidence/company-overview-after.jpg)
- [Vehicle editing on phone](evidence/company-edit-vehicle-phone-after.jpg)
- [Unavailable issuer state](evidence/company-issuer-unavailable-after.jpg)
- [Location selectors in the production build](evidence/signup-locations-phone-production.jpg)
- [Customer profile logout in the production build](evidence/customer-profile-logout-phone.jpg)

The images use public content or isolated synthetic local data. They do not publish the supplied test accounts or private live account screenshots. [Browser verification](evidence/browser-verification.json) records the measured states and limitations.

Final browser checks confirmed:

- Landing at 320, 768, 1024, and 1280px has no document overflow. Both hero glows are hidden at 320/768px; the complete card image fits the viewport at all four widths. The cropped logo's center differs from the header center by only 0.5px. Individual CTA spacing measures at least 32px; all measured tick centers align with their benefit rows.
- Signup clears the old area when State/FCT changes. Akwa Ibom offers 31 areas, FCT offers six area councils, and Lagos/Ikeja remains selected in the final production build with no horizontal overflow. No browser signup was submitted.
- The synthetic company name appears in Overview. A newly created synthetic driver can be selected and saved through the populated vehicle editor without selecting a card; the assignment and lowercase fuel value survive reload.
- With the issuer deliberately unconfigured locally, the card form disables Save and omits BVN/identity inputs. No issuer request was submitted through the browser.
- Customer profile logout at 320px works in the production build. Pointer hit tests reach both profile and account-menu confirmation buttons; Cancel restores the profile trigger's focus. A real pointer click on profile Log Out returns to Login.

Temporary browser metrics and tabs were reset/closed. The owned local API, web server, and disposable PostgreSQL cluster were stopped after verification. Production business records were not changed; live actions were normal sign-in attempts only. The failed live login requires matching Render logs to identify its server-side cause.

## Catalog provenance and release considerations

The State/FCT and LGA choices come from the [official INEC directory](https://inecnigeria.org/about/state-offices/), its public state PDF directories, the [OSGF-hosted Constitution First Schedule](https://www.osgf.gov.ng/storage/app/media/pdf/Nigeria%20Constitution%201999.pdf), and the [Gombe State Government LGA page](https://gombestate.gov.ng/pages/lgas.php). The shared provenance JSON records each downloaded PDF hash, per-state counts, and transcription repairs. Gombe's linked INEC PDF returned 404, so its official government page provides the eleven names. Malformed office rows were resolved explicitly rather than inventing locality names.

Customer signup callers must now send both `state` and `localGovernmentArea`. A stale client without those choices receives a clear API 400; deploy the updated frontend with the API. Existing account records are not migrated or reclassified. Company and partner registration retain their existing address fields.

Provider acceptance cannot be inferred from a configured key or a successful local test. Complete Resend sender-domain verification/DNS and a real permitted delivery check; complete Sudo issuer setup and sandbox/provider acceptance before describing those flows as operational. Production remains subject to the broader outstanding checks in the earlier production-readiness report. This follow-up does not establish a flaw-free or fully production-ready application.

## Committed application changes

- `75a5b79c493c4f66b2dec3224a8b2dc43b9cdfbd fix: polish reported landing page layout`
- `658e5ca64eb4b778760427b2b28766efc6111472 fix: validate signup locations and clarify account guidance`
- `511928b911814480e9cabb22720005979a8d130e fix: restore company identity and fleet vehicle editing`
