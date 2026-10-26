# Admin redesign critique

26 October 2026. Independent retained critic for the admin redesign. Current status: baseline source inventory; rendered scoring pending.

## Scope and preservation contract

| Route | Reachable screen | Features to preserve |
|---|---|---|
| `/admin` | Company oversight | Server metrics, company search/pagination, company provisioning, contract-gated approval, subscription decision, notes |
| `/admin/companies` | Redirect to company oversight | Existing redirect |
| `/admin/partner-applications` | Partner applications and customer card queue | Search/pagination, complete applicant data, approve/reject decisions, required review notes, customer BVN/card/replacement controls |
| `/admin/discount-approvals` | Station discount requests | Dates/rate, status, required rejection reason, existing review action |
| `/admin/customer-benefits` | Customer benefit programme | Exact funding balances, funding history/recovery, checkout restrictions, repair quote/review/payment controls and confirmations |
| `/admin/operations` | Support, payment exceptions, settlement, bank verification and recovery | Ticket attachments/messages/reply/status; refunds; payouts/settlements; bank review; issuance/replacement recovery; refund reconciliation |
| `/admin/intake` | Requests and activity | Station publication, jobs, applications, leads, privacy, email, activity, financial queues; search/pagination; decisions; approved selling units; evidence; resume; job publishing; email retry |
| `/admin/reports` | Platform reports | Exact metric values and approved unit phrases, reporting window, station table, PDF download |
| `/admin/disputes` | Disputes | Search/pagination, original dispute data, resolution/escalation, notes, payment-workflow link |
| `/admin/staff` | Staff and access | All four metrics, search/pagination, administrator creation, suspension and required reason |
| `/admin/login` | Administrator sign-in | Existing authentication, MFA routing, role check, recovery and Google/passkey route |

Account sign-in settings are a shared route and retain their existing behavior. No authentication, authorization, money, or provider contract change is implied by this UI redesign.

## Baseline findings from source

- `AdminScreen` renders the selected review/create form below the table. The form is easy to miss after a long table and leaves the original record out of view.
- `IntakeConsole` places review details in a second grid column. `OperationsInbox` places the selected ticket beside the list. These are inconsistent with the requested centered review dialog and collapse into long pages on phones.
- `CardApprovalQueue`, `DiscountApprovals`, benefit repair records and recovery records expose dense inline controls. The review pattern should be consistent while preserving consequential confirmations.
- The shared `StatusPopup` stack is positioned at the upper right on desktop and near the top on phones. Its provider merges duplicate feedback and scopes popups to dialog hosts. Admin centering must preserve this behavior and leave other dashboards unchanged.
- Admin shell/header, six generic records pages and specialist queues use different spacing/control conventions. Multiple equal-weight headings, repeated refresh controls and boxed rows flatten hierarchy.
- Admin navigation repeatedly uses the settings icon for unrelated workflows. Several route keys share application metadata; the visible active route, search destination, and page title must remain accurate.
- Request queues describe queue type but do not consistently show customer/partner/company origin. Use backend-provided provenance; ambiguous or anonymous records must remain explicitly unknown/public rather than inferred from their content.
- Existing tests preserve search during loading, stale-response suppression, retry after failures, accurate empty states, all staff metrics, unit phrases, mobile field labels, unique navigation destinations, and company contract approval. Retain these guarantees.
- `AdminModals` contains older hardcoded sample details and a simulated permission-update success. Verify whether it is reachable before treating it as a current admin workflow; do not introduce it into the redesign.

## Acceptance criteria for implementation and verification

1. Every reachable route above is visually covered at 1440, 768, 390 and 320 CSS pixels, including useful populated records and empty states. No clipped content, inaccessible controls, page-level horizontal overflow, or duplicate headings.
2. Record review/create opens a named centered dialog. Backdrop press, close control and Escape close it; clicks inside do not. Focus starts inside, cycles inside and returns to the opener. Body scroll is locked; dialog content scrolls without hiding actions. Unsaved local input is cleared or explicitly preserved according to existing behavior.
3. Initial loading, refresh/loading, mutation pending, success and failure feedback appear at the viewport center for admin routes. Multiple simultaneous reads remain understandable. A review dialog must not trap keyboard focus behind its feedback. Retry/dismiss actions remain reachable and progress dismissal must not cancel the actual request.
4. A success message only appears after confirmed API success. Errors retain entered review data and a retry path. Failed loads cannot render as an empty queue. Late responses cannot replace a newer selected record or search result.
5. Requests support clearly labeled Customer, Partner and Company origins and a visible Unknown/Public state where data does not establish one. Filters and counts agree with the supplied data and pagination semantics. The list and review dialog agree about origin.
6. Existing permission checks, financial values, approved selling units, request payloads, endpoint paths, validations, contract/BVN gates and consequential action confirmations remain unchanged.
7. Keyboard, touch, visible focus, reduced motion, semantic headings/table labels and contrast are checked on changed controls. Important text remains readable without relying on color alone.
8. Focused behavior tests, existing admin regression tests, build/typecheck and relevant broader tests pass. Browser evidence verifies outside click/Escape/focus return, populated review, failed load/retry, mutation outcome and responsive layout.

## Rendered critique rounds

### Concepts

Inspected `evidence/concepts/01-service-hall.png`, `02-switchboard.png` and `03-route-atlas.png`. Service Hall is the strongest basis for operational review: the title and unboxed rows establish a calmer reading order. Switchboard's amber terminal direction weakens existing brand recognition. Route Atlas gives too much space to the saturated field and card containers for a dense admin task. The three concepts share nearly identical composition, so their differences in richness are less developed than their palette and type differences. Selection: Service Hall, as chosen by the implementer.

### Round 1

Inspected the full-page 1440px and 320px captures for every primary authenticated screen in `evidence/r1/`: company oversight, partner applications/customer cards, discounts, benefits, operations/recovery, intake, reports, disputes and staff. `/admin/companies` is a redirect. The known breadcrumb/hamburger problems were already being fixed when this review started; those defects are not repeated in the five asks below. Populated specialist reviews, admin login, dark theme and action feedback are not present in these captures, so their final quality remains unscored.

| Rubric | Score | Visible evidence |
|---|---:|---|
| Concept on the pixel | 4 | Georgia titles, a pale green ground and the dark green workspace rail visibly carry the Service Hall direction across the nine primary screens. |
| Not the category average | 3 | The rail, metric strip and table composition remains a conventional operations dashboard despite its calmer typography. |
| Not this skill's average | 4 | The green navigation field and serif titles avoid grey-paper/mono/red, although specialist pages still rely heavily on white cards. |
| Hierarchy | 4 | The title leads each page, then its records; operations still gives four zero-valued metric cards almost the same importance as its support queue. |
| Typography | 4 | Serif headings contrast clearly with legible body/table text; large `Not available` and `No fuel recorded` values wrap and dominate at 320px. |
| Colour | 4 | Dark green navigation and green actions are coherent, with restrained semantic badges; no dark-theme frame was supplied. |
| Richness | 3 | The dark navigation field supplies visual weight, but the rest of the pages remain mostly flat white containers and rules. |
| Rhythm and space | 3 | The full-width search/report filter panels surround small controls with substantial dead space; operations repeats large empty boxes down a long page. |
| Craft details | 3 | `1 records · Page 1` appears under populated lists; headings/status casing and refresh button shapes vary across specialist screens. |
| Native iOS fluency | N/A | This is a responsive web dashboard. No native iOS implementation is in scope. |
| Signature | 3, provisional | The requested centered record review has no rendered opened/transition evidence in this round; a standard list alone does not demonstrate a signature. |
| Feature test | 3 | The result is a calmer administrative interface but still conventional rather than a distinctive portfolio piece. |
| Redesign fidelity | 4, provisional | Existing data/controls remain visible in the captured lists. Specialist mutations, review dialogs, role provenance and recovery behavior require interaction evidence. |

Five highest-impact changes for the next round:

1. In company/application/report/dispute/staff pages, remove the unnecessary full-width white filter container or make the search field fill a deliberate 360–480px toolbar. Keep the filter and records aligned; reduce the empty vertical band before the table.
2. In operations, use the same quiet unboxed metric treatment as generic admin pages. Retain the support queue as the main container and make empty payment/settlement/bank sections compact plain rows instead of cards inside cards.
3. Fix singular pagination (`1 record`) and use coherent sentence casing and the same rounded refresh control across specialist screens.
4. Keep numerical metrics at display size, but render nonnumeric fallback values such as `Not available` and `No fuel recorded` at 16–18px without changing their text or unit/value data.
5. Add a visible route link from the intake explanation to the grouped support inbox. The current sentence mentions another location without giving the reader a direct way there.

Interaction checks still required: populated customer/partner/company support records, selected review/focus/backdrop, pending/success/failure feedback, retry after failure and admin login feedback. The source-level concern that dialog feedback was mounted outside the focus trap has been sent to the implementer and must be checked after its fix.

Not done by the stop rule in critique.md. Round 1 is provisional; the 5/5 target is unmet.

### Round 2

Inspected the new full-page company and operations screens at 1440px and 320px; reports and staff at 1440px and 320px; intake at 390px; and partner applications at 320px in `evidence/r2/`. Unchanged specialist baseline evidence remains in Round 1. The implementer reports a 40-capture responsive run with zero document overflow, zero detected axe violations and zero page errors; these numerical checks do not replace visual or interaction assessment.

The first, second, third and fifth asks landed: the extra filter card is gone, inputs occupy a deliberate width, operations uses quieter metric/empty treatments, pagination is singular and intake links directly to support. Headings and navigation labels now use sentence case. The fourth ask did not land in the captured pixels: a more specific existing CSS selector overrides the new nonnumeric metric rule. A selector correction was requested before Round 3.

| Rubric | Score | Visible evidence |
|---|---:|---|
| Concept on the pixel | 4 | The calmer green workspace and serif page titles remain coherent across generic and specialist pages. |
| Not the category average | 3 | Sidebar, metric strip and record panel remain familiar administrative conventions. |
| Not this skill's average | 4 | The colour field and serif headings retain a deliberate voice without mono/red or decoration. |
| Hierarchy | 4 | Operations now clearly prioritizes support; generic screens still place summary metrics before the review queue. |
| Typography | 4 | Sentence casing improves the hierarchy, but the oversized text fallback remains at 320px because the intended CSS did not win. |
| Colour | 4 | The green actions, dark rail and semantic status accents remain consistent. Existing admin theme behavior is intentionally preserved; a new dark theme is outside this task. |
| Richness | 3 | The palette and navigation field carry the visual character, while content remains deliberately utilitarian. |
| Rhythm and space | 4 | Flattened filters and simplified operations sections remove the most conspicuous empty containers. |
| Craft details | 4 | Singular labels, aligned search fields and repaired responsive header improve polish; the metric selector defect still needs correction. |
| Native iOS fluency | N/A | Responsive web app; native iOS is outside scope. |
| Signature | 3, provisional | Centered review/feedback state screenshots and actual interaction evidence were still incoming at this review. |
| Feature test | 3 | The redesign is a clearer working admin interface, rather than a visually distinctive portfolio example. |
| Redesign fidelity | 4, provisional | All captured navigation and record surfaces remain present; the richer workflow-state evidence is reviewed next. |

Next checks are specific rather than another general visual restart: verify the metric CSS at computed 17px; inspect every populated record dialog and feedback state; verify backdrop/Escape/focus return and keyboard access to in-dialog feedback; resolve the concrete asynchronous state findings from independent code review; and capture the admin login states. No new theme or decorative effect is requested.

Not done by the stop rule in critique.md. Round 2 remains provisional; the 5/5 target is unmet.

### Round 3

Reviewed `evidence/r3/admin-admin-reports-320.png`, `admin-admin-staff-320.png`, `admin-admin-intake-1440.png` and the populated `admin-admin-operations-768.png`, reusing Round 2 for unchanged composition. Parsed `evidence/r3/frames.json`: 40 route/viewport entries and zero document-width overflow. The metric fallback correction is visible: `No fuel recorded` and `Not available` now remain compact and legible.

Also inspected populated state captures for company, staff, partner application, customer card, station publication, discount, repair quote, refund and issuance recovery, plus admin login at 320px and centered pending/failure/success feedback. The updated state result file reports 41 named scenarios, no failures, no false recorded checks, maximum center deviation of 0.0078125 CSS pixels and zero recorded axe violations. Real local records and synthetic browser-intercepted responses are labeled separately in that artifact; no provider acceptance is inferred.

| Rubric | Score | Visible evidence |
|---|---:|---|
| Concept on the pixel | 4 | The green service workspace, serif titles and restrained review sheets are coherent across populated and empty screens. |
| Not the category average | 3 | The source grouping is useful, but the rail/metrics/table/modal composition remains a familiar admin pattern. |
| Not this skill's average | 4 | The design retains its green field, serif display and operational content instead of grey mono/red styling. |
| Hierarchy | 4 | Review dialogs clearly lead over the dimmed list, and the quieter text fallbacks no longer compete with numerical metrics. |
| Typography | 4 | The chosen display/body contrast is consistent; long phone reviews retain readable labels and values. |
| Colour | 4 | Green actions, neutral surfaces and amber/red semantic feedback stay restrained and readable in the supplied frames. |
| Richness | 3 | Colour and the focused overlay provide atmosphere, but the utilitarian content has no more distinctive visual material. |
| Rhythm and space | 4 | Flattened toolbars and compact metrics improve flow; the station review still has an empty optional paragraph creating a conspicuous blank band in its captured state. |
| Craft details | 4 | Dialog corners, control sizes and metadata alignment are consistent. Long phone dialogs can scroll their title/close control out of view in the current state captures. |
| Native iOS fluency | N/A | Responsive web app; native iOS is outside scope. |
| Signature | 4 | Centered review and feedback are now visible and interaction checks prove focus/backdrop behavior; it remains a conventional, carefully applied interaction. |
| Feature test | 3 | The interface is clearer and more usable, but would not be selected as a distinctive portfolio piece on visual novelty alone. |
| Redesign fidelity | 4, provisional | All kept workflows are represented by the new states. Newly identified asynchronous lifecycle defects require their focused corrections and regressions before final sign-off. |

The empty station paragraph and sticky dialog header were sent as precise refinements. Source fixes made after these captures, including feedback reset, busy-entry guards, current-query reload and card refresh lifecycle preservation, require fresh focused evidence. The concurrency case of unrelated recovery feedback while a support dialog is open remains a named check. No new decorative direction, animation or theme is requested.

Not done by the stop rule in critique.md. The visual result is suitable for continued functional verification, with a 5/5 target still unmet. Final code sign-off remains pending the concrete state checks.

### Round 4, final

Reviewed the final sticky-header phone capture, same-instance BVN refresh and fresh-record screenshots, company fresh-review screenshot, and the refreshed concurrent recovery failure over a support review. Exact files are `evidence/states/lifecycle-card-bottom-sticky-close.png`, `lifecycle-card-refresh-same-dialog.png`, `lifecycle-card-fresh-review.png`, `lifecycle-company-fresh-review.png` and `lifecycle-concurrent-recovery-in-support-review.png`. The latter now visibly says `Card issuance records: Request failed (503)`, so its retry no longer appears to belong to the support conversation. Route composition uses the unchanged Round 3 evidence.

Also opened all three full-size `evidence/concepts-refined/` PNGs. Switchboard now uses inset mechanical panels and Route Atlas uses connected nodes, establishing clearer material differences than the initial concept sheet. Service Hall remains the most useful direction for this task.

The long card review keeps its title and 44px close control visible at the bottom of a 375×667 viewport. Pending writes keep other review entries disabled after backdrop dismissal. New reviews no longer replay old messages. BVN refresh keeps the same dialog DOM node and focus. Concurrent subsection feedback aggregates inside the active support focus boundary and remains dismissed after that boundary closes. These statements are supported by the eight passing final lifecycle cases; current hashes of all four recorded source files match the artifact. No source blocker remains in the independent review.

| Rubric | Final score | Evidence |
|---|---:|---|
| Concept on the pixel | 4 | The quiet green service workspace and serif display remain coherent on lists, forms and review overlays. |
| Not the category average | 3 | It remains a conventional sidebar/metric/table administration layout, chosen for its task rather than novelty. |
| Not this skill's average | 4 | The green field, serif titles and operational content have a voice distinct from grey mono/red templates. |
| Hierarchy | 4 | A focused review clearly leads; source badges, status and actions remain visible and separate. |
| Typography | 4 | Readable dense body text, restrained labels and compact fallback metrics work across the supplied narrow frames. |
| Colour | 4 | Brand green and neutral surfaces stay consistent; semantic error/warning colors retain their role. |
| Richness | 3 | The palette and focus treatment provide atmosphere, while the interface deliberately remains utilitarian. |
| Rhythm and space | 4 | Toolbars and empty sections are quieter; record anatomy is clear. The optional empty paragraph was removed in source after its earlier spacing finding. |
| Craft details | 4 | Sticky close controls, focus recovery, consistent corners and bounded feedback improve the long-form states. |
| Native iOS fluency | N/A | Responsive web dashboard; no native iOS build is in scope. |
| Signature | 4 | The centered review counter is consistent and verified, though it remains a familiar modal interaction. |
| Feature test | 3 | This is a clearer working administration interface, not a distinctive visual portfolio piece. |
| Redesign fidelity | 5 | Kept routes, fields, validations, decisions, exact amounts/units and recovery paths remain available, with no unresolved review regression in the checked flows. |

The source-level optional station-paragraph removal is not represented by a newly refreshed station screenshot; it is a small, explicitly unscored spacing refinement. No unverified motion timing, Apple font or native-device claim is made. The CSS serif stack is led by Georgia; local `fc-match Georgia` resolves to Noto Serif, so the renders must not be described as Georgia-font verified.

The required small-phone concept scan emitted an empty report and is not counted as a passing scan. The actual responsive implementation has separate 320px/375px browser evidence. The independent review has reached its four-round cap. No additional aesthetic iteration is requested in this task.

**Final status: 5/5 target unmet.** Functional/source review is accepted for the scoped admin change; that does not turn the lower visual scores or incomplete concept scan into a perfect-design claim. Not done by the 5/5 stop rule in critique.md. Preserve these scores and limitations in the release report.

Native iOS 26 fluency is not applicable to this responsive web dashboard; responsive web interaction quality is reviewed separately. Apple font/native build claims are not applicable.

The target remains 5/5 on every applicable app-designer rubric line plus redesign fidelity. At least two rounds and at most four; any lower final score is target unmet. Missing required interaction or rendering evidence is provisional.
