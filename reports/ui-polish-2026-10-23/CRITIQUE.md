# Obligon independent UI critique

23 October 2026. Reviewer: `ui_design_critic23`. Report-only ownership; no application changes or browser mutations.

> **Current assessment — final Round4:** named P1/P2 visual corrections are resolved in inspected states. The optional Intake320 selector density remains H3; its eight readable category controls take six rows before the queue. The every-page/every-applicable-state5/5 target is not established because state/accessibility evidence remains incomplete. Complete route/dimension scores stay null. See the final Round4 section; earlier inventory/round tables are historical.

## Review contract

The target is **5/5 on every applicable dimension for every canonical page**. A screenshot, passing test, or a high average does not establish this by itself. Unknown or blocked evidence stays `not_reviewed`/`blocked`, with a null score. A verified broken route earns 0; missing evidence does not.

The overall page score is the minimum of its reviewed applicable dimension scores. If any applicable dimension remains unreviewed, the overall score stays unscored. A strong landing page cannot compensate for a broken dialog or error state. The scores assess UI quality within the evidence; they do not establish backend, payment-provider, authentication, or production-release readiness.

This existing web product uses the applicable app-designer craft: rendered direction comparison, specificity, hierarchy, rich but purposeful brand material, fresh-eye criticism, and retained round history. Native iPhone chrome, Apple font migration, App Store presentation, and speculative product changes are outside this polish task. Preserve the existing logo, green/navy identity, role semantics, subscriptions in My Card, company contract approval, and partner/workshop restrictions.

## Five dimensions

| Dimension | A score of 5 requires | Evidence |
|---|---|---|
| Hierarchy and visual coherence | The current role and page task are evident in the first viewport; one primary action or information group leads. Existing Obligon logo, green/navy roles, icon treatment, type scale, surfaces, and spacing remain coherent across shared shells and page content. Desktop and phone renders have no competing decorative emphasis, collisions, accidental nested containers, or inconsistent state styling. | Current full-page desktop and phone screenshots; Chosen direction and before/after comparison; Measured color contrast for distinct text and control surfaces |
| Responsive fit and readability | Layouts fit 1440, 768, 390, and 320 CSS-pixel widths; 200% zoom preserves readable content and reachable actions. No page-level horizontal overflow, clipped text, obscured footer action, or inappropriate fixed width; genuine tables retain all columns through an accessible scroll container or deliberate responsive treatment. Long names, amounts, references, validation messages, and empty states wrap predictably; scrolling remains available after visible indicators are removed. | Viewport screenshots or recorded geometry at 1440/768/390/320; 200% zoom/reflow check; Pointer, touch, and keyboard scrolling checks including nested containers |
| Interaction and accessibility | Visible controls operate; keyboard focus is visible and ordered; labels, semantics, and touch targets support the actual task. Dialogs, menus, search, tabs, and mobile navigation open, close, restore focus, and expose their status using established accessible patterns. Normal text reaches 4.5:1 contrast, large text and non-text controls reach 3:1; reduced motion and appropriate announcements are verified. | Keyboard walkthrough including Escape/focus restoration; Measured contrast and target sizes; Interaction receipt or test output for shared controls and route-specific actions; Screen-reader/accessible-tree verification where provided; omissions disclosed |
| State completeness and honest feedback | Every applicable initial/loading/ready/empty/no-results/error/retry/validation/submitting/success/disabled/session-expired or denied state is evidenced. Errors preserve user input, identify the problem, provide a usable recovery route, and do not masquerade as empty/success; loading does not obscure stale or partial failures. Money/auth actions distinguish pending, failed, and uncertain outcomes through existing product semantics, without redesign-driven behavior changes. | Per-state screenshots or deterministic test receipts tied to the current source; Error/retry and successful action recordings/receipts; Explicit N/A reason for inapplicable states; no blanket assumption |
| Route and task clarity | Page heading, active navigation, role context, and action names agree; a user can identify the next task without guessing. Links, selected search results, return paths, query-driven destinations, and aliases reach the intended canonical location with relevant context. Existing kept features and restrictions remain reachable and understandable, including subscriptions in My Card, company approval, and partner/workshop distinctions. | Route/role walkthrough and navigation/search destination checks; Before/after keep-list evidence; Redirect and query-preservation receipts for aliases |

## Score anchors

| Score | Meaning |
|---|---|
| 0 | Verified unusable or unavailable: the route or essential task cannot be used. |
| 1 | Verified serious obstruction: the task fails or the presentation conceals essential information. |
| 2 | Verified substantial defects: several material issues obstruct the task or create misleading feedback. |
| 3 | Usable within the reviewed scope, with a concrete quality, interaction, or coverage gap. |
| 4 | Polished and usable within evidenced scope; only minor concrete defects or limited unverified edge cases remain. |
| 5 | All dimension acceptance criteria are met by current relevant evidence; no unresolved finding in this dimension. |

Visual preference alone is not a blocking finding. Findings name the page, viewport, visible element or observed interaction, evidence path, severity, and the smallest complete fix. Contrast is measured, not inferred from a screenshot. Existing brand and product requirements override an aesthetic ban from a reference.

## State and viewport coverage

Required widths: 1440, 768, 390, and 320 CSS pixels, with 200% zoom/reflow. Existing screenshots may establish a baseline, but they are not automatically current acceptance evidence. Each interactive route needs its applicable ready, loading, empty, filtered no-results, validation, submitting, success, error/retry, disabled/denied, and session-expired states. A static legal page need not invent loading or success states; its navigation and responsive reading still need evidence. Alias routes are checked for redirect destination, relevant query context, and back behavior rather than awarded an imaginary visual score.

Shared-shell evidence may be reused only for unchanged shared components under the same relevant conditions. Each route still needs its own content fit, state applicability, and task checks. Search needs ready/loading/results/no-results/partial-error/error plus keyboard navigation, focus restoration, and correct destination context. Hidden scrollbar indicators need positive evidence that pointer, touch, and keyboard scrolling still work in full pages, tables, dialogs, menus, and sidebars.

## Reference selection

All ten installed-source summaries were consulted. Their specific role in this review is recorded below; no hosted service or upstream code execution was used.

| Source | Review decision |
|---|---|
| Superdesign | Useful direction comparison and reusable context; local reference only, no hosted canvas claim. |
| Better Design | Consistent semantic tokens, shared components, and review discipline; no connected MCP score claimed. |
| Design Taste | Screenshot-first hierarchy/spacing critique and measured accessibility criteria. |
| Canvas UI | GPU decoration is not needed for the operational task; avoid a new rendering dependency. |
| Paper Shaders | Decorative texture adds no task value here; a static surface is easier to read and verify. |
| UI Layouts | Responsive layout and overflow patterns are relevant; creative effects are optional. |
| Hyperiux Components | Navigation/scroll references are relevant; no pro effects or account assumed. |
| Motion Primitives | Dialog transitions and state feedback are relevant; animation must preserve focus and reduced motion. |
| Cursify | Custom cursors would add little task value and complicate touch/keyboard support; retain native pointers. |
| Trickle UI Kit | Motion should explain state changes; ornamental animated text is unnecessary in financial forms. |

Read sources: `app-designer/SKILL.md`, `references/critique.md`, `references/slop.md`; `ui-reference-guide/SKILL.md` and `references/catalog.md`; `taste-design-review/SKILL.md`; `taste-accessibility/SKILL.md`. The app-designer six quick tests are applied to rendered work: logo, squint, category, specificity, feature, and subtraction. Familiar navigation and accurate financial semantics remain useful even when decorative category defaults are removed.

## Route coverage matrix

Inventory: **75 page routes plus 2 system surfaces** from the current `apps/web/app` tree. This is a coverage inventory, not a completion claim. Exact route states and role variants must be confirmed in the route review. Machine-readable criteria, evidence slots, and scores live in `rubric.json`.

| Route | Group / role | Required state set | Review status |
|---|---|---|---|
| `/admin/companies` | redirect / as required by destination | redirect, destination_context, history_back | Not reviewed |
| `/admin/discount-approvals` | authenticated / admin | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/admin/disputes` | authenticated / admin | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/admin/intake` | authenticated / admin | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/admin/login` | auth_form / auth flow context | ready, validation, submitting, success, error, retry, expired_or_invalid_context | Not reviewed |
| `/admin/operations` | authenticated / admin | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/admin` | authenticated / admin | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/admin/partner-applications` | authenticated / admin | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/admin/reports` | authenticated / admin | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/admin/staff` | authenticated / admin | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/auth/company-invitation` | auth_form / auth flow context | ready, validation, submitting, success, error, retry, expired_or_invalid_context | Not reviewed |
| `/auth/failure` | auth_status / auth flow context | ready, next_action, session_present, session_absent | Not reviewed |
| `/auth/in-progress` | auth_status / auth flow context | ready, next_action, session_present, session_absent | Not reviewed |
| `/auth/login` | auth_form / auth flow context | ready, validation, submitting, success, error, retry, expired_or_invalid_context | Not reviewed |
| `/auth/logout` | auth_status / auth flow context | ready, next_action, session_present, session_absent | Not reviewed |
| `/auth/mfa/challenge` | auth_form / auth flow context | ready, validation, submitting, success, error, retry, expired_or_invalid_context | Not reviewed |
| `/auth/mfa/setup` | auth_form / auth flow context | ready, validation, submitting, success, error, retry, expired_or_invalid_context | Not reviewed |
| `/auth/session-expired` | auth_status / auth flow context | ready, next_action, session_present, session_absent | Not reviewed |
| `/auth/sign-in-options` | auth_form / auth flow context | ready, validation, submitting, success, error, retry, expired_or_invalid_context | Not reviewed |
| `/auth/signup` | auth_form / auth flow context | ready, validation, submitting, success, error, retry, expired_or_invalid_context | Not reviewed |
| `/auth/success` | auth_status / auth flow context | ready, next_action, session_present, session_absent | Not reviewed |
| `/auth/verify-email` | auth_form / auth flow context | ready, validation, submitting, success, error, retry, expired_or_invalid_context | Not reviewed |
| `/auth/verify-phone` | redirect / as required by destination | redirect, destination_context, history_back | Not reviewed |
| `/careers` | public_interactive / public | ready, empty_or_unavailable, validation, submitting, success, error, retry | Not reviewed |
| `/company/billing` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/company/cards` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/company/maintenance` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/company/notifications` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/company` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/company/reports` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/company/roadside` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/company/settings` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/company/stations` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/company/support` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/company/team` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/company/transactions` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/company/vehicles` | authenticated / authorized company role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/cookie-policy` | public_content / public | ready, navigation, mobile_navigation | Not reviewed |
| `/customer/card` | authenticated / customer | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/customer/fuel-checkout` | redirect / as required by destination | redirect, destination_context, history_back | Not reviewed |
| `/customer/notifications` | authenticated / customer | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/customer` | authenticated / customer | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/customer/profile` | authenticated / customer | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/customer/report-problem` | authenticated / customer | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/customer/stations` | authenticated / customer | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/customer/subscription` | redirect / as required by destination | redirect, destination_context, history_back | Not reviewed |
| `/customer/support` | authenticated / customer | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/customer/transaction-detail` | authenticated / customer | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/customer/transactions` | authenticated / customer | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/customer/wallet` | authenticated / customer | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/billing` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/card-verification` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/disputes` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/fuel-pricing` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/notifications` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/reports` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/settings` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/settlements` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/staff` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/station-profile` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/transactions` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/verify` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/dashboard/workshop` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/forgot-password` | auth_form / auth flow context | ready, validation, submitting, success, error, retry, expired_or_invalid_context | Not reviewed |
| `/login` | redirect / as required by destination | redirect, destination_context, history_back | Not reviewed |
| `/mechanic` | authenticated / authorized partner/mechanic role | loading, ready, empty, no_results_if_filterable, error, retry, validation_if_form, submitting_if_action, success_if_action, disabled_or_denied, expired_session | Not reviewed |
| `/` | public_content / public | ready, navigation, mobile_navigation | Not reviewed |
| `/privacy-policy` | public_content / public | ready, navigation, mobile_navigation | Not reviewed |
| `/reset-password` | auth_form / auth flow context | ready, validation, submitting, success, error, retry, expired_or_invalid_context | Not reviewed |
| `/solutions/energyvista` | public_content / public | ready, navigation, mobile_navigation | Not reviewed |
| `/solutions/fuelvista` | public_content / public | ready, navigation, mobile_navigation | Not reviewed |
| `/solutions/genvista` | public_content / public | ready, navigation, mobile_navigation | Not reviewed |
| `/support` | public_interactive / public | ready, empty_or_unavailable, validation, submitting, success, error, retry | Not reviewed |
| `/terms-of-service` | public_content / public | ready, navigation, mobile_navigation | Not reviewed |
| `[not found]` | system / any | not_found, recovery_navigation | Not reviewed |
| `[global error]` | system / any | error, retry, recovery_navigation | Not reviewed |

## Critique rounds

### Round 0 — acceptance rubric and inventory

No direction or current acceptance render has been scored. Waiting for the root-provided three rendered web directions and current screenshots. Prior evidence is available in `reports/google-passkey-2026-10-23/evidence` and `reports/payments-partner-access-2026-10-23/evidence`; these remain baseline evidence until compared with the current patch.

The next review will compare the three directions, select or critique the proposed choice without inventing a score, and identify the five concrete changes with the greatest effect on the lowest-scoring dimensions. At least two and at most four render rounds are retained. A fix after the latest reviewed render is rescored or explicitly marked unscored.

**Stop-rule status: not done — current rendered direction, per-page states, and interaction evidence are pending.**

### Concept review 1 — before implementation

Evidence: `evidence/directions.jpg` (1440×1000), inspected as pixels through the host Node image emitter; `DIRECTION.md`. This sheet is a **static wallet fragment**, not the current application shell or route acceptance evidence. No route score has changed.

**Selection:** Clear workspace is the strongest operational fit. White surfaces, restrained green selection/action, plain dividers, and readable financial records fit the existing task better than the dark treatment or the new serif voice. The light direction gives the next action a clear location without adding extra cards. Retaining bundled brand fonts is appropriate; a default-font aesthetic rule does not justify a font migration.

| Dimension | Concept-only score | Visible evidence / limit |
|---|---|---|
| Hierarchy and visual coherence | 3/5 | Readable palette and green action; the title and balance have similar prominence while the task group is spread vertically. |
| Responsive fit and readability | Not reviewed | A three-column sheet does not establish breakpoint behavior. |
| Interaction and accessibility | Not reviewed | Focus, keyboard operation, target size, and measured contrast are absent. |
| State completeness | Not reviewed | Ready-state records only. |
| Route and task clarity | 2/5 | Overview is selected on Your wallet, and the deposit amount is absent while its status occupies the trailing value position. |

Five concrete changes, highest impact first:

1. **C1 / P1 — Wallet concept, navigation:** select **Wallet** while showing Your wallet. In the actual application, test every shell's selected item against its canonical route.
2. **C3 / P1 — Wallet concept, deposit row:** keep each record's amount and status in separate aligned positions. The deposit currently has Completed where the amount belongs. Preserve the existing financial data rather than simplifying it away.
3. **C5 / P1 — Actual application, all widths:** render full customer, partner, company and admin shells including search/navigation, plus public and auth pages. Include relevant long-content, loading, empty and error states. The isolated fragment cannot expose shell collisions.
4. **C4 / P2 — Wallet concept, hierarchy:** use a quieter 24–28px page title, retain a 32–36px balance where it is the useful hero, and group labels/value/action with 12–16px internal gaps and 24–32px section breaks. Avoid competing equal-size title and balance blocks.
5. **C2 / P2 — Wallet concept, funding action:** remove ↗ when Fund wallet opens an internal dialog or route; retain it only when the destination is external.

Quick tests: the squint test finds the heading and balance competing; the specificity test is supported by the existing brand and task; subtraction favors the plain dividers over extra cards. Covering the name leaves a generic wallet fragment, so distinctiveness must come from the real FuelVista card/brand material and actual account context rather than adding decoration to operational records.

Process limit: the three columns have the same composition and the first two share sans typography. Treat this as a simplified brand-preserving web treatment comparison, not evidence that every distinct-concept axis of the native-app exploration was completed.

**Stop-rule status: not done — implementation renders, all applicable states, responsive behavior, and interactions remain unreviewed.**

### Actual round 1 — public core viewports

Inspected `evidence/home-{320,390,768,1440}.png`, `home-menu-390.png`, and `solutions-{fuelvista,energyvista,genvista}-{390,1440}.png` at full supplied size. The old scaled JPG captures are excluded. These PNGs demonstrate the shown viewport only; full-page, role, and interaction checks remain pending.

| Page core | Provisional visual score | Visible reason |
|---|---|---|
| Home | 4/5 | The headline leads, primary/secondary actions differ, and real FuelVista material carries the brand. The visible logo is inset from the content gutter. |
| FuelVista | 4/5 | Clear task and specific card material, with no visible content collision at 390/1440. |
| EnergyVista | 3/5 | Readable, but the large blue panel repeats the intro/confirmation and the same idea appears again in Discuss/Confirm/Agree. |
| GenVista | 3/5 | Readable, but the supporting panel repeats the introduction rather than adding information for the request. |

These are **core-viewport visual observations**, not final dimension or route scores. Every route remains unscored until its required relevant evidence is reviewed.

Findings in priority order:

- **P1-R1 / P1 / evidence validity — Home320/768/1440, capture origin:** menu focus outlines and the desktop CTA touch the image top, with a header ending around75px rather than104px in the390 frame and source. This suggests retained scrollY around29. Reset to scroll0, wait for scroll/layout and record scrollY before comparing top-of-page frames. This is not filed as an application clipping defect.
- **P4-R1 / P1 / missing coverage — Public pages, full page and controls:** below-fold content, product pages at 320/768, destination checks, menu keyboard/Escape/link closure, and short-height menu scrolling are unobserved. Provide that evidence before a complete route rating.
- **P2-R1 / P2 — Home390 (also apparent in the other core frames), header logo:** the visible logo begins around60px; hero/menu content begins20px from the edge. The190px centered logo link adds40px of unintended inset. Use a content-width link and a suitable44px minimum hit target so the visible brand shares the content gutter. The solution pages' SiteHeader already demonstrate the aligned treatment.
- **P3-R1 / P2 — EnergyVista/GenVista390 and1440, blue supporting panel:** replace duplicate requirement/confirmation prose with existing specific request inputs, such as fuel type, quantity, location and schedule, or facility/generator/service details. Keep the meaningful confirmation terms once. The large colored panel should help the next task.

The390 mobile menu has readable rows and distinct Login/Get Started actions. Its close icon is obscured by the captured pointer; move the pointer away for the next capture. Pointer/highlight artifacts are not classified as application styling without supporting evidence. No additional defects were invented to fill a five-item quota.

**Stop-rule status: not done — current full-page fit and interactive/state coverage are incomplete.**

### Actual round 2 — admin family

Inspected all eight canonical admin pages at 1440, 768, 390 and 320px, using `admin-{width}.png` and `admin-{operations,intake,reports,disputes,staff,partner-applications,discount-approvals}-{width}.png`; also inspected `admin-search-1440.png`. `browser-observations.json` confirms matching image/viewport dimensions, document widths, scrollY0 and reduced-motion media state for the admin captures. The alias `admin-companies-*` repeats the canonical `/admin` view and is not a ninth designed page.

The shared shell is coherent: logo, active navigation, readable page headings, and green primary actions follow one system. Long headings/units wrap at 320/768 rather than forcing document overflow. The remaining visual weakness is task density: the phone metrics repeat a large desktop-card pattern and hide the records people came to work on.

| Canonical page | Provisional hierarchy / coherence | Provisional responsive fit | Evidence and limit |
|---|---|---|---|
| `/admin` | 3/5 | 4/5 | Three large phone metrics push the first company record near the fold. |
| `/admin/reports` | 3/5 | 4/5 | Three phone metrics precede the reporting control and data; quantities remain readable at 320/768. |
| `/admin/disputes` | 3/5 | 4/5 | Large metric stack precedes the empty queue; disabled pagination looks available. |
| `/admin/staff` | 3/5 | 4/5 | Four phone cards fill the first viewport; the fourth is stranded on a second desktop/tablet row. |
| `/admin/partner-applications` | 3/5 | 4/5 | Pending review is shown, but the actual review record is below the phone viewport. |
| `/admin/operations` | 3/5 | 4/5 | Queue headings/readability are clear; bank-verification content is blank. |
| `/admin/discount-approvals` | 3/5 | 4/5 | Empty state exposes an unexplained editable reason field. |
| `/admin/intake` | 3/5 | 4/5 | Eight category buttons wrap to six rows at 320px before the selected station card. |

These are **provisional visual scores only**. The responsive4 records demonstrated fit at four widths, with zoom, scrolling, and below-fold interaction still missing. Overall route scores remain null; none of these pages has complete evidence for 5/5.

Five changes that would raise the lowest scores most:

1. **A1-R2 / P2 — Admin overview/reports/disputes/staff/application queues,320/390px, metric summaries:** reduce the tall full-width stack with compact phone rows or a deliberate two-column layout, smaller padding and suitable value sizes. Preserve every financial/unit label, value and helper. Staff320 currently shows no search field or record in the first 844px. Also use a coherent four-card layout for staff at tablet/desktop.
2. **A4-R2 / P2 — Operations, all four widths, Partner bank verification:** show an explicit no-pending-verifications message after successful empty loading. The heading currently has no body, unlike nearby empty queues. Distinguish loading/error from confirmed empty; do not imply that a failed request returned no work.
3. **A2-R2 / P2 — Shared search,1440px result state:** `admin-search-1440.png` shows the native blue search-cancel cross next to the custom clear cross, with nested focus boundaries. Keep one clear affordance and one coherent field focus treatment; retain the custom 44px target and visible button focus. This is shared-component impact across all dashboard roles.
4. **A3-R2 / P2 — AdminRecords pagination,1440/768px:** Previous/Next are dark underlined actions with 0 or 1 records. The source correctly disables boundary buttons, but their styling suggests they remain available. Give disabled bounds a distinct, non-underlined treatment without weakening enabled focus/targets.
5. **A5-R2 / P2 — Discount approvals, all four widths, empty state:** defer or disable Review reason until there is a reviewable/selected request and explain its context. An editable input preceding No discount requests gives no meaningful task.

Secondary observation: Intake 320 spends six rows on category buttons, pushing the selected station record to around 716px. A compact accessible selector could improve density after the five main asks; preserve category discoverability and keyboard behavior.

Observed states: live ready fixture records in overview/reports/staff/intake/partner applications; empty discount/dispute/support/settlement queues; missing bank empty message; one ready search result. Root reports that ArrowDown+Enter on the actual API Fleet result reaches `/admin?search=Fleet+UI+Fixture` and fills the record search with Fleet UI Fixture. The screenshot independently establishes the result list, not the subsequent navigation; retain a durable URL/value receipt for final acceptance.

Unobserved: loading/error/retry transitions; modal validation/submitting/success/error; phone below-fold records/actions; mobile-menu focus restoration; screen-reader announcements; measured contrast; 200% zoom; pointer/touch/keyboard scrolling; reconciliation/provider effects. A screenshot of the recovery button does not verify reconciliation or financial readiness.

Prior public asks: root reports that logo alignment and duplicate supporting-panel copy were changed, but those files have not been rebuilt/recaptured; they remain unscored after the change.

**Stop-rule status: not done — no canonical admin page has evidence for 5/5 across every applicable dimension.**

### Actual round 3 — company, customer, partner and workshop

All scores below concern visible ready/empty fixture views. The full route target remains 5/5 in every applicable dimension; no complete route has that evidence.

Read-only helper independently checked refreshed 226-row registry:108 company/customer PNGs match viewport dimensions and document widths, with scroll origins0. Aliases record /customer/card. No browser/editing/visual scoring by helper.

Company: 13 routes × four widths plus schedule dialog 390/calendars 390/320 and search destination 768.
Customer: 12 filename stems × four widths, including 2 aliases to /customer/card; 10 distinct base destinations. Search, receipt, account menu and sign-in options at 390px also shown.
Partner/workshop: Gas-specific station profile, fuel pricing, transactions, reports, POS and settlement views; workshop profile/team/settings/notifications/verified/subscription/overview and restricted fuel destination.

**Role evidence warning:** Generic dashboard-* overlap files show Workshop/WO after mechanic capture and must not be counted as current gas coverage. Await role-qualified recapture; no application authorization defect inferred.

Provisional visual assessment: Most company ready/empty views H4/R4; density/assignment/unit exceptions H3. Customer overview/support/history/detail/notifications H3, blank map H2, other shown views H4. Partner staff/reports and workshop copy H3; other valid shown views H4. These are visual-only; overall scores remain null.

Concrete asks, P1 before P2:

| ID | Severity | Page / width | Visible finding | Smallest complete fix |
|---|---|---|---|---|
| U1-R3 | P1 | /customer/stations / 1440/768/390/320 | A large blank white map has no loading/unavailable message and precedes phone station results. | Show honest map state/fallback feedback and a usable list; prioritize the list before an unavailable map on phones. |
| C1-R3 | P2 | /company/cards / 1440 | Assigned · SEARCH-234 appears beside Assignment: Unassigned. | Name driver and vehicle assignment explicitly; preserve values and rules. |
| C2-R3 | P2 | /company/reports / 320 | 2.5 standard m³ wraps to three lines, splitting the approved unit phrase. | Keep the approved unit phrase together and quieter than the number; preserve its exact meaning. |
| C3-R3 | P2 | /company, /company/cards, /company/reports, /company/maintenance / 320/390/768 | Odd counts leave an empty fourth cell; cards at 768px delays actual records below the viewport. | Use compact intentional phone/tablet summaries without losing metrics or helpers. |
| C4-R3 | P2 | /company/settings / 1440 | A short status panel stretches to the full profile form height with a large blank area. | Use content-sized height aligned to the start. |
| U2-R3 | P2 | /customer/support / 768/390/320 | A full unusable coordination form precedes available support-message/reporting actions. | Show a compact plan gate when no service is available and lead with usable support; preserve plan rules. |
| U3-R3 | P2 | /customer / 1440/768/390/320 | The large balance card is mostly blank without a next action; a large mobile greeting occupies the title position. | Use an Overview/task title and compact balance group with an existing wallet/card route action. |
| U4-R3 | P2 | /customer/transactions and /customer/transaction-detail / 768/390/320 | The minus sign wraps separately above ₦1,000 at 768; partial amount columns have no scroll instruction on phones. | Keep sign/currency/digits non-breaking and add a short overflow cue while retaining named keyboard scrolling and all columns. |
| U5-R3 | P2 | /customer/notifications / 768/390/320 | The mobile/tablet empty state lacks a visible page title. | Add compact Notifications context without duplicating the desktop title. |
| P1-R3 | P2 | /dashboard/staff (gas/workshop) / 1440 | Five visible headers cover six row cells: access Enabled, ACTIVE membership and Details occupy separate cells. | Add the missing Access header before generic Status/Action; preserve authorization and data. |
| P2-R3 | P2 | /dashboard/reports / 390/1440 | Three tall phone metric cards hide consumption records; desktop Status is empty for all shown rows. | Compact the summaries and omit an inapplicable status column or label missing values honestly. |
| P3-R3 | P2 | /dashboard/settlements / 1440/390 | No Settlement Account appears with wording that the account already receives funds automatically. | Make automatic-settlement wording conditional on an added/verified account; preserve settlement rules. |
| P4-R3 | P2 | workshop /dashboard/verify and /dashboard/notifications / 1440/390/320 | Workshop screens say station/station network; verification shows No phone number added beside Verified. | Use role-appropriate nouns and fix inconsistent fixture or render missing contact honestly without changing backend verification rules. |
| P5-R3 | P2 | /dashboard/transactions, /dashboard/staff and other wide DataTables / 390/320 | Amount/status/action columns are offscreen with hidden scrollbar indicators and no visible scroll instruction. | Add a short overflow cue and retain keyboard/touch/pointer scrolling. |

Shared schedule/calendar: the dialog and date controls fit the shown320/390px frames. Root-executed keyboard/date checks are recorded separately from screenshot-visible properties. Customer receipt 390 is readable and preserves the exact approved quantity 1.25 standard m³. Fuel pricing shows CNG/standard m³ and LPG/kg; no liquid fuel option was inferred. Workshop profile/settings frames are coherent, and the restricted fuel destination shows workshop overview with no fuel navigation.

Root-executed interactions (not browser execution by this critic):
- ArrowRight+Enter from 23 October selects 2026-10-24; unsaved schedule cancelled. Search reaches /company/vehicles?search=SEARCH-234.
- Actual reference search reaches history; receipt shows debit -₦1,000 and CNG 1.25 standard m³; focused ArrowRight scrolling moves scrollLeft 0 to 13.8; Account Escape returns trigger focus.
- SEARCH-FLEET-23 search reaches /dashboard/transactions?search=...; workshop direct fuel pricing returns to /dashboard with no fuel navigation.

Unobserved or incomplete:
- Every applicable loading/error/retry transition
- Success/error/validation for unsubmitted forms
- Paid-plan/card-issued/available-order and nonempty financial variants
- Provider/funding/reconciliation/uncertain money outcomes
- Phone below-fold controls and full menu/sidebar reachability
- 200% zoom,measured contrast,screen-reader walkthrough
- Durable key/focus/before-after receipts for root-executed interactions

The blank-map fallback is the P1 visual/state defect. Static recovery/funding/approval controls do not establish backend or payment readiness. Root reports that prior public/admin fixes are implemented; current rebuilt/re-scored screenshots are still required.

**Stop-rule status: not done — concrete findings and unverified applicable states remain.**

### Actual round 4 — final recheck and evidence limits

This is the fourth and final actual review round, including its correction rechecks. The design is more coherent and the named earlier asks below have landed in the shown states. The requested **every-page, every-applicable-state 5/5 target is not established**. Every complete dimension score and canonical overall score remains null; no 5/5 was invented.

Two P2 observations received small corrections and passed their rebuilt visual recheck within this same Round4. The original observations are retained as history; the current files at the same paths contain the corrected views:

| ID | Page / viewport | Exact visible evidence | Smallest correction | Current status |
|---|---|---|---|---|
| R4-UX-01 | `/dashboard/reports`,390px | `final-gas-dashboard-reports-390.png` breaks the approved phrase between “standard” and “m³”;320 keeps it together. | Reuse company metric treatment: keep the approved unit phrase nonbreaking and subordinate to the number. | Resolved: intact subordinate phrase at390/320/768/1440. |
| R4-UX-02 | `/dashboard/settlements`,1440px; `/company/cards`,768px | `final-gas-dashboard-settlements-1440.png` clips the trailing Settlement Periods header without a cue (`xl:hidden`); cards768 clips the trailing Manage action without a cue. | Expose a short horizontal-scroll cue at these widths; retain columns and scrolling. | Resolved: cue visible in both rebuilt views. |

Both readability/discoverability asks are now resolved in the inspected views; no P1/P2 visual correction remains outstanding in this scope. They were not document overflow or lost-data claims. The existing secondary Intake320 observation remains: eight category controls occupy six rows before the selected queue. Its labels fit; a compact accessible selector could improve density later. No new round is requested.

#### Evidence and freshness

The final registry contains216 role-qualified dashboard captures plus16 corrected public/auth captures, at1440/768/390/320px. After the final unit/hint correction, the helper revalidated104 company/gas replacements; this critic checked36 replaced workshop PNG dimensions/metadata in ordinary code. The unchanged92 rows reuse earlier valid checks. The read-only helper checked file existence, uniqueness, dimensions and document widths; all match. Every row records its role and `build=current`. The index SHA256 is `2ac882e4927885d80bc94d8058f8c4843001ffb5aafd100ddc9ce15b9eed4b31`. Scroll origins are0 except the deliberate map-bottom frame, whose recorded scrollY is0.6000000238418579. No scrollX/requestedURL/canonicalURL fields are present. Matching page width cannot prove zoom, table scrolling or full-content reachability.

`final-gas-dashboard-*` and `final-workshop-dashboard-*` now separate overlapping routes correctly. The Round3 generic-filename warning is historical. Workshop station-profile/fuel-pricing captures record `/dashboard` redirects and must not be counted as distinct workshop fuel/station screens. Earlier public/auth core frames are reused only for unchanged source. Corrected Support/session/MFA frames supersede their earlier views. The old `public-mobile-menu-390.png` is a Cookie Policy SiteHeader capture, not homepage.

`rubric.json` lists named inspected frames, the final correction recheck with exact current PNG hashes, and merely registered current captures separately. Company/gas/workshop filenames were replaced after unit/hint-only changes; earlier visual observations remain scoped to that prior revision, with the final8 rechecks binding the current relevant changes. Ready/empty screens were reviewed across the families in earlier rounds; the final pass rechecks named changes and representative shared states. It does not claim that every registered frame or every below-fold state was independently reinspected.

The fresh root receipt records **623/623 web tests passed**, no failures/skips, and a successful production build. Existing unused-variable and workspace-lockfile warnings remain. The source review found no remaining required changes within its explicit eight-file/two-noun scope, backed by64 focused tests and3 isolated lifecycle assertions. Root additionally reports13 passing focused assertions and independent review for the final unit/hint-only patch, preserving table data/actions. This is bounded evidence, not a full product/security audit. Independently calculating white `#ffffff` on green `#3d6a00` gives6.4417:1; that verifies this token pair, not every rendered element.

#### Earlier findings rechecked

| Finding | Result within shown evidence |
|---|---|
| P1/P2/P3-R1, public origin/logo/supporting copy | Current home origin and logo gutter fit; EnergyVista/GenVista panels now give useful enquiry inputs. |
| A1-R2, admin metric density | Compact phone summaries expose search/next record in overview, staff, reports, disputes and partner queue. Staff768 uses2×2. |
| A2-R2, shared search clear/focus | Source now uses `type=text`, `inputMode=search`, one custom clear button and one wrapper focus ring. Focused tests cover it; the final active-query/focus screenshot was not repeated. |
| A3/A4/A5-R2, admin feedback | Pagination bounds look disabled. Bank verification has an explicit empty message. Empty discount approvals no longer exposes a reason field without a request. |
| C1/C2/C3/C4-R3, company | Driver/vehicle assignments are explicit; company reports320 keeps approved unit intact; metric layouts use intentional phone/tablet grids; status panel is content-height. |
| U1-R3, customer map | Phone station list leads, and optional map has loading/fallback feedback with a list alternative. External map tiles/provider availability remain unverified independently. |
| U2/U3/U5-R3, customer task order | Available Support actions lead; inactive coordination is compact. Overview has wallet/card actions. Notifications has phone context. |
| U4-R3, customer history/detail | Debit sign/currency/digits stay together at768. Visible horizontal-scroll instruction appears in the table views. No new receipt-effect claim follows from those table captures. |
| P1/P2/P3-R3, partner tables/settlement | Staff has six aligned headings including Access. Reports omit inapplicable Status and compact summaries. No-account copy conditions settlement on added/verified destination. |
| P4-R3, workshop contact/nouns | Workshop nouns fit the role; absent phone says Not added. Backend account verification decision is a separate fact. |
| P5-R3, phone table discoverability | Staff/transactions/reports show a scroll instruction while retaining columns; desktop/tablet residual is tracked above. |
| Round4 Support/session corrections | Inquiry form follows intro on phones/tablet, with desktop two-column composition. Recovery links separate at390/768/1440 and wrap cleanly at320. |
| Round4 anonymous MFA corrections | Missing-challenge Verify/backup controls look unavailable, with explicit sign-in recovery. Setup error no longer asks to scan a missing QR. Root Chrome also reports actual submit `isEnabled=false`. No successful enrollment or biometric challenge is inferred. |

Provisional visual scores for corrected shown views generally rise to H4/R4. Intake remains H3/R4. The final report/unit and table-cue rechecks now also receive provisional H4/R4. Intake H3 is specifically the observed six-row category selector at320; the proposed compact accessible selector is optional, with no hidden defect implied. These values concern only the shown scope; canonical complete dimension/overall scores stay null.

#### Interaction/state evidence and residual gaps

Admin768 failure/recovery frames now show useful connection guidance and returned records; root reports the same session survived. Root reports Escape focus restoration, calendar ArrowRight+Enter selection, search destinations and focused ArrowRight table movement from earlier checks. This critic did not execute those browser actions. Standalone raw key/focus/scroll receipts are absent, so those observations remain attributed to root.

Actual200% zoom is **unverified**: the emulated Ctrl-plus attempt did not change viewport. Complete screen-reader testing and all-element rendered contrast are absent. Long public/legal bottoms, every phone below-fold action, all dialog/short-height paths, global error boundary and auth/logout transient do not have complete reviewed evidence. Representative map/admin failures do not demonstrate every route's loading/error/retry transitions. Unsubmitted form success/validation/error, paid-plan/issued-card variants, physical MFA/biometrics, provider funding/reconciliation and uncertain money outcomes remain incomplete or unobserved.

**Final process status:** four actual rounds are complete, including these corrections. The bounded critique is complete; the all-page/all-state5/5 objective remains unmet. Qualified human review of the consequential combined patch remains root's release gate. Screenshots, fixture tests and this report do not establish money/auth production readiness or authorize release.

Final receipt binding: application source patch SHA256 `446d9a44acc544b22b271caefa7cd15bd06f234f3ab818e3bb339baa0be7a775` (188 files per root manifest); final verification JSON SHA256 `fbf9a08905fa43491199da1f5aaa87bf014bccf83c88e9112a2c82dff6d5a971`. These bind the reviewed evidence, not a production release approval.

Redirect scoring clarification: anonymous `/auth/success` and `/auth/sign-in-options` show login redirects; `/auth/verify-phone` and the customer fuel/subscription aliases show their canonical destination. No distinct-screen visual score is assigned to those unseen screens. `/mechanic` source reuses the workshop overview composition, but the final current registry does not demonstrate fresh direct navigation to `/mechanic`; its complete score remains null.
