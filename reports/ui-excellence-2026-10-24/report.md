# Obligon UI release report

24 October 2026. Base: `a28e2564a08bbaad40b63b9c9addfea51e1a3f38`. Responsive web refinement using the requested app-designer process and all ten installed design-source catalogs.

## Changes by page and dashboard

| Area | What changed |
|---|---|
| Landing `/` | Tighter mobile header/hero spacing, clear Get started CTA, stronger heading hierarchy, concise story title, one-plan mobile comparison with full benefits, readable footer contrast. |
| Solutions `/solutions/fuelvista`, `/solutions/genvista`, `/solutions/energyvista` | Compact three-column mobile facts, specific tool headings, fewer redundant labels and static button shadows, sentence-case actions; all services and enquiry destinations retained. |
| Sign in and signup | One main task heading, compact mobile account choices with pressed-state semantics, customer/company/partner options retained, clearer Google/passkey availability wording. |
| Admin sign in | Main h1, wider phone form, wrapping remember/recovery controls, concise instructions. Same authentication handlers. |
| Authentication status | Stable initial success markup prevents hydration mismatch; popup-only progress/failure retains main heading semantics and cannot be dismissed into a blank screen. Retry/cancel/login/support destinations remain. Sign-out uses the same visible popup treatment without changing its handler. |
| Customer overview/history/stations | Clear h1 headings, neutral ordinary spend, compact summary empty states with History recovery, compact phone metrics and transaction records, wrapping receipt values, persistent search/filter controls, recoverable no-results and correct zero pagination count. |
| Customer My Card | Direct Status/Plans/Budget/Pay/Orders links, current-plan identification, separate comparison selection, full benefits in accessible disclosures, loading/error/empty recovery, readable empty-order copy. Existing payment handlers unchanged. |
| Customer profile | Details/Appearance/Sign-in/Notifications/Security section links with focusable destinations. Existing theme/security actions retained. |
| Station partner overview | Compact daily metrics and secondary totals; contextual authorization empty state and permitted existing history action. |
| Station profile/workshop | Section navigation and top Save buttons use the same existing form submit and validation path. Profile/unit/location/approval fields retained. Workshop team action uses role-appropriate wording. |
| Partner controls | Edit, staff, API-key, bank, pricing and discount affordances reflect existing server role permissions. No backend authorization change. |
| Company | Shared pale-green active navigation; compact phone card controls/metrics; purchase-specific empty states and existing View cards destination. Keyboard-scrollable tables remain. |
| Admin | Compact labelled phone queue selector retains all eight queues; mobile funding form stacks safely; exact balances/quantities wrap; selected support item uses aria-pressed; discount review field has a label and shared empty state. |
| Shared | Section scroll-margin and readable hierarchy. Permanent scroll instruction strips removed while focusable table regions and scrolling remain. No new runtime dependency. |

## Verification

- Final full web regression: **708 passed, 0 failed, 0 skipped**.
- Production build and TypeScript passed. Lint exits successfully with existing warning output; it is not warning-free. The local build uses a disposable localhost API and is never uploaded; Vercel builds from Git using its own production configuration.
- Production-mode route sweep: **324 frames, 81 route/role contexts**, at **1440, 768, 390 and 320px**. No uncaught page errors and no document-width overflow.
- Final representative WCAG axe 4.11 run: **38 frames**, 19 contexts at desktop/phone, **0 detected A/AA violations**. Automated rules do not establish full accessibility compliance.
- Independent source review and focused tests preserved full plan inventories, selected purchase payloads, role permissions and solution CTA paths.
- Independent narrow-screen QA: 64 nonrepresentative company/partner/workshop/admin fold screenshots and eight full screenshots. The workshop invitation copy finding was corrected.
- Third-party OSM preview renders in ordinary visible viewport screenshots. Full-page screenshots can miscompose its WebGL canvas; see [diagnosis](map-diagnosis.md). No unsupported resize patch was added. List, directions and provider retry remain available.

## Additional state evidence

- [Customer state QA](customer-state-qa.md): nine production-mode state checks passed, including persisted dark preference, visible Security focus, browser required-field rejection without a write, station no-results recovery, visible map, loading and error/retry. Dark overview/card/profile each have zero axe violations and zero incomplete checks.
- `evidence/error-recovery-other-roles/checks.json`: company, partner and admin held GET, simulated 503 and retry-to-real-200 checks passed. Nine screenshots inspected; no unexpected account/money writes, external calls, page errors or width overflow.
- Populated transaction and downloaded receipt checks preserve exact amount, balance, reference and approved CNG unit. The adversarial long-reference/large-amount case exposed a receipt overflow absent from empty fixtures; the final display-only wrap fix passes at **390px and 320px**, with dialog scroll widths equal to client widths, no overflowing descendants and unchanged downloaded values.

- Error boundary component harness: real production React renders a throwing child, shows the unchanged non-dismissible ErrorFallback/StatusPopup, and restores the child via Try again. This proves the component in isolated Chrome, not a deliberately crashed Next production route.
- Auth logout completes local clearing and reaches login even with its remote request held. The pending popup/h1 was briefly observed; a sustained pending screenshot is unverified because local logout resolves immediately. All **76 defined page paths** are now represented across the full sweep plus final system-route checks. The 404 state is additional. Framework-level global error layout is not claimed as browser-crash tested.

## Design evidence and honest scoring

The brief is self-authored from the existing product and user instructions. Three rendered directions were compared: Roadbook, Service lane and Fuel pass. The chosen direction combines Service lane task hierarchy with Roadbook content rhythm, preserving Obligon green/navy, bundled fonts and real product assets. See [direction and all ten repository decisions](DIRECTION.md), [retained independent critic rounds](CRITIQUE.md), and [before/after comparison](before-after.html). **Final independent result: 4/5 in all five dimensions across the 15 deeply reviewed families. The requested 5/5 on every page is not achieved or demonstrated.** No blocking visual defect remains in that inspected evidence. Desktop Overview retains a spacious empty-summary band; the new History action is useful but did not move analytics higher. Scores apply to the inspected evidence; an application-wide perfect score is not inferred from tests.

## Public inspector findings

[Exact final public inspector findings and decisions](public-inspector.md) list FAILs before WARNs with routes, widths, detector evidence and proposed fixes. Raw reports and desktop/tablet/phone screenshots are preserved under `evidence/taste-*`. Earlier eyebrow and static-shadow findings informed the heading and button simplifications. This detector also reports stylistic FAILs for sparse imagery, restrained motion, small display scale and sticky-header overlap. The final inspector exits 1 on these style rules; this is **not** a claim that all design scans pass. These are not silently converted into passing tests: product pages retain authentic product imagery and service-enquiry content rather than invented proof, video or decoration; operational information remains readable. The opaque sticky header deliberately covers scrolled-away content, while navigable sections have scroll offsets. WCAG contrast and actual viewport containment are checked separately. Typography/box/footage warnings are intentional within this existing brand. Raw flags remain available for a human aesthetic review.

## Route coverage

Each row below was rendered at all four widths. Redirects are listed by their actual destination. A rendered state, especially an empty synthetic account, does not prove every possible populated state or external provider outcome. Synthetic account data is isolated from production and external financial effects are disabled. System error/loading states and authenticated routes are checked separately.

| Role | Requested route | Observed destination | Widths | JS errors / width overflow |
|---|---|---|---|---|
| public | `/` | `/` | 1440, 768, 390, 320 | none |
| public | `/solutions/fuelvista` | `/solutions/fuelvista` | 1440, 768, 390, 320 | none |
| public | `/solutions/genvista` | `/solutions/genvista` | 1440, 768, 390, 320 | none |
| public | `/solutions/energyvista` | `/solutions/energyvista` | 1440, 768, 390, 320 | none |
| public | `/support` | `/support` | 1440, 768, 390, 320 | none |
| public | `/careers` | `/careers` | 1440, 768, 390, 320 | none |
| public | `/privacy-policy` | `/privacy-policy` | 1440, 768, 390, 320 | none |
| public | `/terms-of-service` | `/terms-of-service` | 1440, 768, 390, 320 | none |
| public | `/cookie-policy` | `/cookie-policy` | 1440, 768, 390, 320 | none |
| public | `/auth/login` | `/auth/login` | 1440, 768, 390, 320 | none |
| public | `/auth/signup` | `/auth/signup` | 1440, 768, 390, 320 | none |
| public | `/forgot-password` | `/forgot-password` | 1440, 768, 390, 320 | none |
| public | `/reset-password` | `/reset-password` | 1440, 768, 390, 320 | none |
| public | `/auth/failure` | `/auth/failure` | 1440, 768, 390, 320 | none |
| public | `/auth/success` | `/auth/login` | 1440, 768, 390, 320 | none |
| public | `/auth/session-expired` | `/auth/session-expired` | 1440, 768, 390, 320 | none |
| public | `/auth/in-progress` | `/auth/in-progress` | 1440, 768, 390, 320 | none |
| public | `/login` | `/auth/login` | 1440, 768, 390, 320 | none |
| public | `/admin/login` | `/admin/login` | 1440, 768, 390, 320 | none |
| public | `/auth/company-invitation` | `/auth/company-invitation` | 1440, 768, 390, 320 | none |
| public | `/auth/mfa/challenge` | `/auth/mfa/challenge` | 1440, 768, 390, 320 | none |
| public | `/not-a-page-ui-test` | `/not-a-page-ui-test` | 1440, 768, 390, 320 | none |
| customer | `/customer` | `/customer` | 1440, 768, 390, 320 | none |
| customer | `/customer/card` | `/customer/card` | 1440, 768, 390, 320 | none |
| customer | `/customer/stations` | `/customer/stations` | 1440, 768, 390, 320 | none |
| customer | `/customer/profile` | `/customer/profile` | 1440, 768, 390, 320 | none |
| customer | `/customer/transactions` | `/customer/transactions` | 1440, 768, 390, 320 | none |
| customer | `/customer/wallet` | `/customer/wallet` | 1440, 768, 390, 320 | none |
| customer | `/customer/notifications` | `/customer/notifications` | 1440, 768, 390, 320 | none |
| customer | `/customer/support` | `/customer/support` | 1440, 768, 390, 320 | none |
| customer | `/customer/report-problem` | `/customer/report-problem` | 1440, 768, 390, 320 | none |
| customer | `/customer/transaction-detail` | `/customer/transaction-detail` | 1440, 768, 390, 320 | none |
| customer | `/customer/subscription` | `/customer/card` | 1440, 768, 390, 320 | none |
| customer | `/customer/fuel-checkout` | `/customer/card` | 1440, 768, 390, 320 | none |
| customer | `/auth/sign-in-options` | `/auth/sign-in-options` | 1440, 768, 390, 320 | none |
| customer | `/auth/mfa/setup` | `/auth/mfa/setup` | 1440, 768, 390, 320 | none |
| customer | `/auth/verify-email` | `/auth/verify-email` | 1440, 768, 390, 320 | none |
| customer | `/auth/verify-phone` | `/auth/verify-email` | 1440, 768, 390, 320 | none |
| company | `/company` | `/company` | 1440, 768, 390, 320 | none |
| company | `/company/cards` | `/company/cards` | 1440, 768, 390, 320 | none |
| company | `/company/vehicles` | `/company/vehicles` | 1440, 768, 390, 320 | none |
| company | `/company/team` | `/company/team` | 1440, 768, 390, 320 | none |
| company | `/company/transactions` | `/company/transactions` | 1440, 768, 390, 320 | none |
| company | `/company/stations` | `/company/stations` | 1440, 768, 390, 320 | none |
| company | `/company/maintenance` | `/company/maintenance` | 1440, 768, 390, 320 | none |
| company | `/company/roadside` | `/company/roadside` | 1440, 768, 390, 320 | none |
| company | `/company/reports` | `/company/reports` | 1440, 768, 390, 320 | none |
| company | `/company/billing` | `/company/billing` | 1440, 768, 390, 320 | none |
| company | `/company/support` | `/company/support` | 1440, 768, 390, 320 | none |
| company | `/company/settings` | `/company/settings` | 1440, 768, 390, 320 | none |
| company | `/company/notifications` | `/company/notifications` | 1440, 768, 390, 320 | none |
| partner | `/dashboard` | `/dashboard` | 1440, 768, 390, 320 | none |
| partner | `/dashboard/station-profile` | `/dashboard/station-profile` | 1440, 768, 390, 320 | none |
| partner | `/dashboard/fuel-pricing` | `/dashboard/fuel-pricing` | 1440, 768, 390, 320 | none |
| partner | `/dashboard/transactions` | `/dashboard/transactions` | 1440, 768, 390, 320 | none |
| partner | `/dashboard/settlements` | `/dashboard/settlements` | 1440, 768, 390, 320 | none |
| partner | `/dashboard/staff` | `/dashboard/staff` | 1440, 768, 390, 320 | none |
| partner | `/dashboard/disputes` | `/dashboard/disputes` | 1440, 768, 390, 320 | none |
| partner | `/dashboard/settings` | `/dashboard/settings` | 1440, 768, 390, 320 | none |
| partner | `/dashboard/reports` | `/dashboard/reports` | 1440, 768, 390, 320 | none |
| partner | `/dashboard/notifications` | `/dashboard/notifications` | 1440, 768, 390, 320 | none |
| partner | `/dashboard/card-verification` | `/dashboard/card-verification` | 1440, 768, 390, 320 | none |
| partner | `/dashboard/billing` | `/dashboard/billing` | 1440, 768, 390, 320 | none |
| partner | `/dashboard/verify` | `/dashboard/verify` | 1440, 768, 390, 320 | none |
| workshop | `/dashboard` | `/dashboard` | 1440, 768, 390, 320 | none |
| workshop | `/dashboard/workshop` | `/dashboard/workshop` | 1440, 768, 390, 320 | none |
| workshop | `/mechanic` | `/mechanic` | 1440, 768, 390, 320 | none |
| workshop | `/dashboard/staff` | `/dashboard/staff` | 1440, 768, 390, 320 | none |
| workshop | `/dashboard/settings` | `/dashboard/settings` | 1440, 768, 390, 320 | none |
| workshop | `/dashboard/billing` | `/dashboard/billing` | 1440, 768, 390, 320 | none |
| workshop | `/dashboard/verify` | `/dashboard/verify` | 1440, 768, 390, 320 | none |
| admin | `/admin` | `/admin` | 1440, 768, 390, 320 | none |
| admin | `/admin/companies` | `/admin` | 1440, 768, 390, 320 | none |
| admin | `/admin/intake` | `/admin/intake` | 1440, 768, 390, 320 | none |
| admin | `/admin/staff` | `/admin/staff` | 1440, 768, 390, 320 | none |
| admin | `/admin/partner-applications` | `/admin/partner-applications` | 1440, 768, 390, 320 | none |
| admin | `/admin/discount-approvals` | `/admin/discount-approvals` | 1440, 768, 390, 320 | none |
| admin | `/admin/disputes` | `/admin/disputes` | 1440, 768, 390, 320 | none |
| admin | `/admin/reports` | `/admin/reports` | 1440, 768, 390, 320 | none |
| admin | `/admin/operations` | `/admin/operations` | 1440, 768, 390, 320 | none |
| admin | `/admin/customer-benefits` | `/admin/customer-benefits` | 1440, 768, 390, 320 | none |

Supplemental `/auth/logout` captures at 1440/390px reach `/auth/login`; the isolated remote-request-held check confirms immediate local logout. These supplement the four-width main sweep rather than implying that its pending appearance was captured at every size.

## Scope and remaining limits

No API, database schema, provider credentials, fees, benefit funding, issuing or BVN configuration changed in this release. No real funds were moved. Existing external issuing/BVN/benefit-operation approvals and Nigerian SMS-delivery limitations are not resolved by a UI release. Google/passkey hardware, physical devices and every browser/network combination are not certified. The Apple font/native-iOS checks are unavailable on this Linux host; this deliverable is a responsive web application.

Hosted Better Design and Superdesign capabilities were unavailable. Their local pinned references and all other installed catalog sources informed the work; no hosted review or paid generation is claimed.

## Release and recovery

Push and deployment are explicitly authorized by the user. This increment is presentation and client affordance work; existing server security/payment contracts remain. Base production Vercel deployment is `6zWbdhGK5y7cgg92HUBS2fCTaJhn` (source `a28e256`). If the new UI causes a material regression, use Vercel deployment rollback to this known Ready production build, or revert the single UI release commit and push master. No data migration needs reversal. The prior deployment and project controls were verified before release; an actual production rollback was not executed or time-benchmarked.

The current hosting workflow is Git-triggered deployment, without configured percentage canaries. Validate provider Ready/Live against the exact pushed revision and smoke-test public pages/customer navigation. Abort on build failure, app errors, login/navigation failure or fresh health failure. This is not a claim of measured production traffic error rates or transaction readiness.

Source changes and this report are committed together. Generated PNGs and raw local QA artifacts remain in this workspace to avoid adding the large screenshot set to the repository. A separate local release receipt records the pushed SHA and provider verification after deployment.

## Live release findings and recovery follow-up

The main UI commit `fad05e8db9cd5c44d96815c070fcb4fddfd41f37` was pushed to master and observed as Vercel Ready/Current and Render Live. Public homepage, sign-in, FuelVista and admin sign-in returned HTTP 200; API health returned HTTP 200. The existing customer test account signed in and loaded Overview and My Card, including current plan and gated card state. No payment, identity submission or provider enrollment was performed.

During a long-lived browser session, the subscription lookup returned 401 and its popup offered only retry. A small display-only follow-up keeps required subscription loading/error feedback non-dismissible and adds the existing `/auth/login` **Sign in again** route beside retry. It does not alter tokens, refresh logic, entitlement checks, polling or authentication handlers. Focused tests prove protected children remain hidden during error and stale data; independent review is clear. This recovery-state follow-up is verified separately and is not a fifth aesthetic-scoring round.

**Remaining live launch blockers:** Render logged `EMAIL_DOMAIN_UNVERIFIED` from Resend when sending a notification: the configured sender uses an unverified gmail.com domain. The provider configuration flag in health is not proof of delivery. Descope contact verification and general notification email are separate paths. Issuing/BVN and benefit funding/reconciliation requirements remain as previously recorded. This UI release does not establish full financial or provider readiness.

The live customer session needed fresh sign-in after observed unauthorized subscription reads; fresh sign-in recovered the dashboard/card view. The underlying cause and long-duration multi-tab refresh behavior are not certified by this UI-only recovery fix. Live company/admin/partner accounts were unavailable for new authenticated smoke tests; isolated role testing provides their recorded evidence.
