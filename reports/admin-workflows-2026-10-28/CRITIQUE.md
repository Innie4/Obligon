# Admin workflow visual critique

28 October 2026. Two rendered review rounds by the same delegated critic. This is a responsive web adaptation of the existing Service Hall direction, not an iOS build. Scores describe the supplied screenshots; they do not certify universal quality, accessibility behavior or payment readiness.

## Scope and evidence

Reviewed administrator role/page assignment, the support workflow board and ticket review, discount workflow board, and customer-benefit funding/repair reviews. The existing direction is documented in `../admin-redesign-2026-10-26/DIRECTION.md`: light content, dark navigation, serif page titles, existing green actions and quiet record layouts. No new visual identity or dependencies were requested.

The UI Reference Guide ten-source catalog and App Designer critique rubric were read. Existing brand and workflow clarity take priority over decorative effects. Native iOS, Apple fonts, Liquid Glass and App Store build criteria are not applicable to these browser screens.

Round 1 images inspected individually:

- `evidence/staff-popup-desktop.jpg`, `evidence/staff-persisted.jpg`
- `evidence/operations-desktop.jpg`, `evidence/operations-maximized.jpg`, `evidence/operations-phone.jpg`
- `evidence/closure-review-desktop.jpg`, `evidence/ticket-popup-phone.jpg`, `evidence/staff-popup-phone.jpg`
- `evidence/discounts-desktop.jpg`, `evidence/discounts-phone.jpg`

Round 2 images inspected individually:

- `evidence/staff-popup-desktop-r2.jpg`, `evidence/staff-popup-320-r2.jpg`, `evidence/staff-save-320-r2.jpg`
- `evidence/operations-desktop-r2.jpg`, `evidence/operations-phone-r2.jpg`, `evidence/ticket-popup-phone-r2.jpg`
- `evidence/discounts-desktop-r2.jpg`, `evidence/discounts-phone-r2.jpg`
- `evidence/benefits-desktop-r2.jpg`, `evidence/benefit-quote-desktop-r2.jpg`, `evidence/benefit-quote-phone.jpg`
- Same-round verification captures: `evidence/ticket-popup-phone-verified.jpg`, `evidence/staff-restricted-navigation.jpg`, `evidence/staff-pending-dialog.jpg`

The root agent reports measured CSS widths of 1440, 390 and 320 after correcting browser zoom. Initial phone image labels were not proof of exact CSS viewport width. The root also reports dialog header `y=12.55`, height `124.8`, and `scrollTop=0` at 390 pixels; Escape/backdrop dismissal, reachable Save at 320 pixels, board controls, and persisted staff/repair fields were exercised in the browser. These measurements and interactions were supplied by the root agent, not independently repeated by this critic.

The additional same-round viewport capture shows the complete ticket title and Close control. The earlier crop came from a screenshot API mismatch, not a changed dialog layout. The restricted Staff navigation capture shows only Support & settlements and Platform reports. Its pending-ticket capture shows the Active and Closure approval pending states. The root separately reports that the restricted account was redirected away from Staff & access, requested closure successfully, and had Withdraw without approval controls; the lower action controls are outside this particular saved crop.

## Round 1 findings

1. **Fix the board card anatomy.** Inline title and metadata spans visibly concatenate station, organization, fuel/date, reference, subject and requester fields. Examples include `stationFixture partner organization` and `PMS Petrol28/10/2026`. This affects both boards on desktop and phone, and makes scanning unreliable. Make title/metadata block elements; place the support badge/reference in a wrapping flex row with an explicit gap.
2. **Use creation-specific staff dialog copy.** The Add administrator dialog says to review a record and record a decision. Replace it with instructions to enter account details, choose a role and assign pages.
3. **Resolve incomplete phone capture evidence.** The ticket-phone image omits its title/Close at the top. The staff image shows an intact header and form, while its save controls are below the normal scroll fold. Verify scroll reachability and dialog geometry instead of treating every off-frame form field as a clipped control.

No additional material visual defects were found in those screenshots. The checklist is tall, but its sequential role-then-page structure is understandable. Dense mobile boards use vertical stacking rather than narrow simultaneous columns.

## Scores

A 4 means a strong interface suitable to ship; a 5 requires portfolio-level design evidence. No score is guaranteed by a test count. Round 1 fidelity was provisional while benefit and small-phone evidence was missing.

| Rubric | Round 1 | Round 2 | Visible evidence in the latest renders |
|---|---:|---:|---|
| Concept on the pixel | 3 | 3 | Dark service navigation and quiet light work areas remain consistent, but the case-file concept is not distinctive without the brand. |
| Not the category average | 3 | 3 | Serif page titles add character; boards and modal forms remain familiar administration patterns. |
| Not this skill's average | 4 | 4 | Green navigation, pale green work lanes and sans-serif controls avoid the skill's grey/mono/red default. |
| Hierarchy | 4 | 4 | Page title, workflow columns and record subject have clear roles; staff instructions and checklist are ordered. |
| Typography | 4 | 4 | Serif page titles contrast with compact control/body text; card data is readable after line separation. |
| Colour | 4 | 4 | Green actions and distinct semantic count tints are restrained and consistent. Dark-mode design is outside this change set. |
| Richness | 3 | 3 | The palette, navigation shape and lanes add material, but this remains primarily a utilitarian text interface. |
| Rhythm and space | 2 | 4 | Round 2 separates title, organization/date and footer; cards no longer run their content together. |
| Craft details | 2 | 4 | Board spacing is repaired, modal controls remain legible at 320, and requested/effective discount states are explicit. Capture caveats remain below. |
| Native fluency | N/A | N/A | This is a Next.js browser dashboard, not an iOS app. |
| Signature | 3 | 3 | Minimizing/maximizing work columns is useful and fits the workflow; it is not a distinctive design interaction. |
| Feature test | 3 | 3 | The screens are operationally clearer, but the current evidence does not support an editorial design-feature claim. |
| Fidelity | Provisional | 5 | Role/page assignment, all three workflow lanes, review controls, rejection/expiry history, funding and repair details remain present. Root browser evidence covers control behavior and persisted values. |

## Round 2 result

The two requested visual changes landed. Board cards now separate reference, title, requester/organization and date; all three lanes remain readable on phone. Add administrator now says: “Enter account details, choose a role and assign pages.” The 320-pixel start and save captures show that the header/Close and bottom Save/Cancel controls are reachable within the dialog.

The funding screen explains its actual provider/setup limitation and disables the unavailable action. The repair review clearly separates labour, parts, verified partner and scope, and shows the saved quote and next step. The root reports that exact amounts and quote fields survived saving/reopening. This visual review does not certify external benefit funding or repair-partner payout.

Remaining evidence caveats:

- The older ticket-phone images begin below the modal title; `ticket-popup-phone-verified.jpg` supersedes that capture limitation and visibly shows the full title and Close control. The benefit-quote-phone image still begins below its modal title; it alone does not prove the full header appearance.
- The full-page operations-phone image includes the sticky toolbar at the capture scroll position and a focused Skip link. It should not be treated as an initial-viewport screenshot.
- Synthetic fixture content identifies the screens as test evidence. Real production content extremes were not independently exercised by this critic.
- No App Designer renderer DOM scan, contrast measurement, real-device motion or keyboard audit was executed by this critic. Browser/test evidence belongs in the main verification report.

There is no unresolved material layout blocker in the inspected corrected boards or the 320-pixel staff form. Further category distinction, richer visual material and signature work would be a separate design exercise, not a reason to add decoration to this workflow patch.

**Not done by the App Designer 5/5 stop rule. Target unmet: applicable scores remain 3–5.** This is an honest two-round refinement result, not a universal 5/5 claim.
