# Obligon admin redesign

26 October 2026. Self-authored brief based on the user's explicit request. Responsive Next.js web administration, not a native iOS app.

## Brief and acceptance criteria
Administrators review company and partner accounts, customer identity submissions, discounts, support, benefits and financial exceptions. The first action is finding the relevant record and opening its review. The interface should feel clear, deliberate and accountable.

- Preserve all existing routes, records, actions, permissions, required confirmations, exact amounts and selling units.
- Every record review opens centered at desktop and phone sizes; inside clicks retain it; backdrop, Escape and Close dismiss it. Keyboard focus stays inside and returns to the opener.
- Loading, pending, success and failure feedback is a centered popup within admin. Persistent record statuses remain readable record data. Other dashboards retain their current feedback positions.
- Distinguish Customer, Partner, Company, Public enquiry and Unknown requests using server-supplied identity/organization metadata.
- Verify every admin page at 1440, 768, 390 and 320 pixels, action states and keyboard behavior. No real production approvals or money movements for QA.

## Current app
The source baseline is eeb38d1. Forms appeared below tables or alongside the intake list. Card approvals and repair quotes expanded every record. Feedback floated at the edge. Requests did not expose the originating account type. Navigation and panels used a similar weight, and stacked empty sections occupied excessive space.

Baseline evidence: historical isolated screenshot from 24 October in `evidence/before/admin-intake-1440.png`; source structure was inspected freshly. A fresh baseline attempt failed because the local server initially had the wrong API variable. No claim of a complete fresh baseline capture is made.

| Keep | Treatment |
|---|---|
| Company overview and /admin/companies alias | Same contracts/credit/status fields in focused dialog |
| Partner applications | Same application decisions and notes |
| Customer card identity and replacements | Same encrypted/server identity workflow, masked details and approval checks |
| Discount approvals | Same rates, dates and rejection reason |
| Customer benefits | Same funding, repair quotes and reconciliation actions |
| Requests and all eight intake queues | Same search/pagination/job and station decisions; modal review |
| Support, settlements, bank review | Same handlers, with source metadata and focused conversation |
| Disputes | Same outcomes and original-payment workflow link |
| Reports | Same ranges and PDF export |
| Staff/access | Same status controls and full-admin access warning |
| Admin login, security link, sign-out | Same role check/MFA routing; scoped centered feedback |

Lose: inline review panels, expanded forms for every row, decorative scrollbar strips, redundant nested empty boxes, fake access-level labels. Unknown/outside scope: actual provider reliability and broader financial launch requirements.

## Research and three directions
Actual source pages consulted: Stripe Dashboard basics (https://docs.stripe.com/dashboard/basics), Shopify admin help (https://help.shopify.com/en/manual/shopify-admin), Linear features (https://linear.app/features). Their public text documents search/navigation, desktop/mobile back-office use and issue workflows. Competitor application screenshots were not inspected and no visual claims about them are made. The inferred category default is a uniformly boxed statistic grid preceding the task list; this design gives the work list priority.

1. **Service Hall:** Obligon is a civic service hall, with quiet walls, a clear counter and identifiable case files. Light ground, serif title, existing green action, shaped dark navigation. Selected for legibility and focused review.
2. **Switchboard:** Obligon is a physical switchboard. Dark ground, monospace headline, amber signal and inset material. Rejected because the terminal tone and amber depart from the established brand.
3. **Route Atlas:** Obligon is a route diagram. Saturated lime ground, bold grotesque title and connected illustrated record nodes. Rejected because the broad color field consumes attention that belongs to the decision.

`explore.html` renders all three. The existing logo and fonts are retained. No image generation, hosted canvas, new package or remote asset was needed.

## Tokens and materials
Ground #f4f6f2; surface #ffffff; ink #18271f; secondary #526057; rule #dce3dc; navigation #15271f; action #3d6a00; on-action white; active navigation #e5efdc. Red/amber/green status tints indicate state only.

Screen titles use a CSS serif stack led by Georgia (the Linux font resolver falls back to Noto Serif locally) to distinguish the page from dense controls. Existing bundled Inter is deliberately retained for table legibility and tabular numbers; existing Plus Jakarta Sans remains in dialog headings. Their OFL files are in apps/web/public/fonts. No new font was downloaded. The renderer uses platform fallback fonts for exploration, including the serif fallback; Apple-font verification is not applicable to this web implementation.

Type: 12 metadata, 13 controls, 14 body, 17 fallback metrics, 21/23 section/dialog titles, 30-42 page titles. Numeric metrics use 26-35 with tabular figures. Spacing 4/8/12/16/20/24/28/32/40; field radius 10, panel 14, dialog 20 desktop / 16 phone. Content margins 16 phone / 40 desktop. Richness comes from the shaped navigation rail, distinct page typography and aligned record anatomy, without generated illustrations in operational screens.

Admin has no existing dark-theme preference. A new theme setting is outside this requested redesign; it is not introduced just to satisfy a native mockup criterion. Native Liquid Glass, app-icon replacement, haptics, Apple fonts and App Store panels are N/A.

## Signature and states
The review counter is the signature: select a row; its case opens centered over a dimmed list; review the fields; save or return directly to the same list. Self-authored motion is 180ms opacity and 7px translation, not a measurement from a licensed library. Escape/backdrop/Close return focus and restore scrolling. Reduced motion removes the animation.

| Trigger/state | Presentation |
|---|---|
| Initial/refresh loading | Centered progress popup owned by request lifecycle |
| Review pending | Centered popup inside focused dialog, action disabled while processing |
| Save success | Centered confirmation; refreshed records retain actual state |
| Failure | Centered error; entered values preserved; retry when available |
| Empty | Quiet contextual record message, not an error |
| Stored pending/failed status | Persistent status badge, not repeated unsolicited dialog |
| Interrupted/late request | Closed review stays closed; queue responses cannot overwrite newer views |

## Resource decisions
| Source | Decision | Observed path/URL and limitation | Application |
|---|---|---|---|
| Superdesign | Adapt | local superdesign-skill/skills/superdesign, catalog and focused workflow | Concept exploration; hosted canvas not used |
| Better Design | Adapt | local better-design/scripts/transitions-src/modal-transition.tsx and LICENSE | Centered review anatomy, existing focus helper; no copied dependency |
| Design Taste | Adapt | local design-taste/skills/corporate-trust/SKILL.md | Precise tables and semantic states; existing green brand wins over fixed blue |
| Canvas UI | N/A | catalog-only consideration | GPU canvas has no task value |
| Paper Shaders | N/A | catalog-only consideration | Shaders compete with record reading |
| UI Layouts | N/A | catalog-only consideration | Creative gallery layout would reduce operational density |
| Hyperiux | N/A | catalog-only consideration | Decorative effects unnecessary; pro sources not available |
| Motion Primitives | Adapt | local components/core/dialog.tsx; MIT LICENCE.md inspected | Reference anatomy only; reuse existing React and focus hook |
| Cursify | N/A | catalog-only; reuse permission unestablished | Preserve native pointer and touch behavior |
| Trickle | N/A | catalog and file inventory only | Text animation would interfere with record scanning |
| Jiro | N/A | https://jiro.build public catalog text | No paid account, template upload or generation |
| Recent/Godly | N/A | https://recent.design public category catalog | App-gallery style not substituted for a tested admin workflow |
| Landdding | N/A | https://landdding.com public category catalog | Marketing layouts outside admin task; no asset copying |
| Font In Logo | N/A | https://www.fontinlogo.com public text catalog | Existing licensed fonts and logo retained |
| 60fps | Adapt locally | https://60fps.design and local feedback-states/SKILL.md | State inventory/reduced motion only; licensed MCP and measured clips unavailable |

## History comparison
Selected row: place | light | serif | green | shape. Compared with the existing history, it differs on at least three columns per row. Previous Obligon refinement was place | dark | grotesque | green | photo: changed ground, type and richness. The desktop navigation remains dark for hierarchy, while the content ground stays light.

## Verification and remaining evidence
See CRITIQUE.md for independent rounds and report.md for final test/deployment receipts. Scores must describe the actual renders; neither reference coverage nor test results prove a perfect design.
